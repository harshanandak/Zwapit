// BMS movie-catalog crawler — runs as a Convex action (Convex can reach api.parallel.ai; BMS itself
// 403s Convex's datacenter IP, so Parallel does the fetch). Flow: Parallel-extract the synopsis
// sitemap -> parse entities -> lastmod-diff vs stored -> Parallel-extract the detail pages of the
// delta -> parse title + metadata -> internal upsert. Posters are deferred (Parallel strips images),
// so rows are metadata-only for v1. The PARALLEL_API_KEY lives in Convex env, never in code.

import { internalAction, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { bmsCatalogKey, diffByLastmod, parseParallelEntities } from "../src/lib/catalog/bmsSitemap";

const MOVIES_SITEMAP = "https://in.bookmyshow.com/sitemap/movies-synopsis.xml";
const PARALLEL_EXTRACT = "https://api.parallel.ai/v1beta/extract";
const BOOTSTRAP_LIMIT = 250;
const CRAWL_WAVE_SIZE = 25;

interface ExtractResult {
  content: string;
  title: string;
}

// Parallel Extract (batched). Returns url -> { full_content, title }. Throws on missing key / non-200.
async function parallelExtract(urls: string[]): Promise<Record<string, ExtractResult>> {
  const key = process.env.PARALLEL_API_KEY;
  if (!key) throw new Error("PARALLEL_API_KEY is not set on this deployment");
  const r = await fetch(PARALLEL_EXTRACT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "parallel-beta": "search-extract-2025-10-10",
    },
    body: JSON.stringify({ urls, full_content: true, excerpts: false }),
  });
  if (!r.ok) throw new Error(`Parallel extract failed: HTTP ${r.status}`);
  const j = (await r.json()) as { results?: Array<{ url: string; full_content?: string; title?: string }> };
  const out: Record<string, ExtractResult> = {};
  for (const res of j.results ?? []) {
    out[res.url] = { content: res.full_content ?? "", title: res.title ?? "" };
  }
  return out;
}

// Prefer the page H1 (clean display name, e.g. "Jab We Met"); the <title> is inconsistent — sometimes
// "Watch <Name> Movie Online" or "<Name> (1995) - Movie | … BookMyShow". Fall back to a scrubbed title.
function cleanTitle(pageTitle: string, content: string): string {
  const h1 = (content.match(/^#\s+(.+)$/m)?.[1] ?? "").trim();
  if (h1) return h1;
  return pageTitle
    .replace(/^watch\s+/i, "")
    .replace(/\s+movie\s+online\b.*/i, "")
    .replace(/\s*\(\d{4}\).*/, "")
    .replace(/\s*[-–|].*$/, "")
    .trim();
}

function extractYear(pageTitle: string, content: string): string | undefined {
  return (pageTitle.match(/\((\d{4})\)/)?.[1] ?? content.match(/\b(19|20)\d{2}\b/)?.[0]) || undefined;
}

/**
 * Selects the bootstrap or maintenance crawl limit.
 * @param backlogCount Number of sitemap entries whose lastmod is not current.
 * @param requestedLimit Positive integer requested by the caller.
 * @returns At least 250 while the backlog exceeds one requested run; otherwise the requested limit.
 * @example effectiveCrawlLimit(4_900, 25) // 250
 * @remarks This additive helper does not validate inputs; the action validates the requested limit first.
 */
export function effectiveCrawlLimit(backlogCount: number, requestedLimit: number): number {
  return backlogCount > requestedLimit ? Math.max(requestedLimit, BOOTSTRAP_LIMIT) : requestedLimit;
}

/**
 * Splits crawl inputs into sequential fetch waves without changing their order.
 * @param items Inputs to split.
 * @param size Maximum items per wave.
 * @returns New arrays containing every input exactly once, or an empty array for no inputs.
 * @throws `CRAWL_WAVE_SIZE_INVALID` when size is not a positive integer.
 * @example chunkIntoWaves([1, 2, 3], 2) // [[1, 2], [3]]
 * @remarks This additive helper does not mutate its input.
 */
export function chunkIntoWaves<T>(items: T[], size = CRAWL_WAVE_SIZE): T[][] {
  if (!Number.isInteger(size) || size <= 0) {
    throw new Error("CRAWL_WAVE_SIZE_INVALID: size must be a positive integer");
  }
  const waves: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    waves.push(items.slice(i, i + size));
  }
  return waves;
}

export const getMovieSyncState = internalQuery({
  args: {},
  returns: v.array(v.object({ externalId: v.string(), sourceLastmod: v.optional(v.string()) })),
  handler: async (ctx) => {
    const docs = await ctx.db
      .query("catalog_items")
      .withIndex("by_external", (q) => q.eq("externalSource", "bookmyshow"))
      .collect();
    return docs
      .filter((d) => d.kind === "movie" && d.externalId)
      .map((d) => ({ externalId: d.externalId as string, sourceLastmod: d.sourceLastmod }));
  },
});

export const crawlBmsMovies = internalAction({
  // limit caps how many delta movies to hydrate this run (cost + Convex action time control).
  args: { limit: v.optional(v.number()) },
  returns: v.object({
    scanned: v.number(),
    delta: v.number(),
    hydrated: v.number(),
    created: v.number(),
    updated: v.number(),
    // Delta items not hydrated this run (bootstrap visibility, kernel 2427bbc4).
    remaining: v.number(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ scanned: number; delta: number; hydrated: number; created: number; updated: number; remaining: number }> => {
    const limit = args.limit ?? 10;
    if (!Number.isInteger(limit) || limit <= 0) {
      throw new Error("CRAWL_LIMIT_INVALID: limit must be a positive integer");
    }
    // Scheduled crawls no-op when egress is not configured.
    if (!process.env.PARALLEL_API_KEY) {
      return { scanned: 0, delta: 0, hydrated: 0, created: 0, updated: 0, remaining: 0 };
    }
    const sitemap = await parallelExtract([MOVIES_SITEMAP]);
    const entities = parseParallelEntities(sitemap[MOVIES_SITEMAP]?.content ?? "", "movie");

    const state: Array<{ externalId: string; sourceLastmod?: string }> = await ctx.runQuery(
      internal.catalogCrawl.getMovieSyncState,
      {},
    );
    const existing = new Map<string, string | undefined>(state.map((s) => [s.externalId, s.sourceLastmod]));
    const fullDelta = diffByLastmod(entities, existing);

    // Keep bootstrap active until the backlog fits within one maintenance run.
    const effectiveLimit = effectiveCrawlLimit(fullDelta.length, limit);
    const delta = fullDelta.slice(0, effectiveLimit);
    if (delta.length === 0) {
      return { scanned: entities.length, delta: 0, hydrated: 0, created: 0, updated: 0, remaining: 0 };
    }

    // Chunked fetch waves: a mid-run failure preserves prior waves (paid
    // egress is never discarded) and keeps Convex action wall-clock safe.
    let hydrated = 0;
    let created = 0;
    let updated = 0;
    for (const wave of chunkIntoWaves(delta)) {
      const pages = await parallelExtract(wave.map((e) => e.loc));
      const movies = wave.map((e) => {
        const page = pages[e.loc] ?? { content: "", title: "" };
        const title = cleanTitle(page.title, page.content) || e.slug.replace(/-/g, " ");
        const year = extractYear(page.title, page.content);
        return {
          externalId: e.eventCode,
          catalogKey: bmsCatalogKey(e.eventCode),
          title,
          subtitle: year, // metadata-only v1; richer language/genre + posters later
          sourceLastmod: e.lastmod,
        };
      });
      const res: { created: number; updated: number } = await ctx.runMutation(
        internal.catalog.upsertMoviesFromSource,
        { source: "bookmyshow", syncedAt: new Date().toISOString(), movies },
      );
      hydrated += movies.length;
      created += res.created;
      updated += res.updated;
    }

    return {
      scanned: entities.length,
      delta: delta.length,
      hydrated,
      created,
      updated,
      remaining: Math.max(0, fullDelta.length - delta.length),
    };
  },
});
