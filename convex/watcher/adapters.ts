// Source-URL builders + Parallel Extract adapter + platform routing (Task 8).
//
// PURE TS — NO Convex-runtime imports. The Convex action in watcher.ts imports
// and calls these; keeping this file runtime-free lets it unit-test without codegen.
//
// What this module does:
//  - buildBmsUrl / buildDistrictUrl — turn a catalog row's source codes into the
//    exact official API/SSR URL to hand to Parallel (deep-link-OUT host templates).
//  - targetSourceUrls — platform routing: emit a URL ONLY for sources whose codes
//    exist on the catalog row (a District-only row never builds a BMS URL).
//  - extractViaParallel(urls, fetcher) — the ONLY network surface. `fetcher` is
//    INJECTABLE; the default POSTs api.parallel.ai/v1beta/extract with the env key.
//    Tests inject a mock fetcher returning fixtures → no real network, no secret.
//
// URL shapes are lifted verbatim from the validated execution docs:
//  - docs/work/2026-06-20-catalog-data-maps-research/bms-oss-reuse-execution.md §2
//    (byvenue appVersion=9700 + dateCode; byevent appVersion=14304 + region params)
//  - docs/work/2026-06-20-catalog-data-maps-research/district-reuse-execution.md §2
//    (movie-in-city `…-movie-tickets-in-<city>-MV<id>?fromdate=YYYY-MM-DD`)
//
// SECURITY (design §A03/A10): codes are encodeURIComponent'd into FIXED host
// templates — never raw-concatenated, never user-host. The only fetch target is
// api.parallel.ai; Parallel performs the outbound BMS/District fetch (no SSRF surface
// here). PARALLEL_API_KEY is read lazily INSIDE defaultParallelFetch, never at import.

import type { ShowSource } from "./types";

// ---- Fixed host templates (never user-supplied) -------------------------------

const BMS_BYVENUE_BASE = "https://in.bookmyshow.com/api/v2/mobile/showtimes/byvenue";
const BMS_BYEVENT_BASE = "https://in.bookmyshow.com/api/movies-data/showtimes-by-event";
const DISTRICT_BASE = "https://www.district.in/movies";

/** Catalog-row fields the builders read. Mirrors the optional code fields added to
 * `catalog_items` (schema.ts). Kept structural so this stays Convex-runtime-free. */
export interface CatalogItemCodes {
  title: string;
  city?: string;
  bmsEventCode?: string;
  bmsRegionCode?: string;
  bmsVenueCode?: string;
  districtMvCode?: string;
  districtCdCode?: string;
  districtCitySlug?: string;
}

export interface BuildOptions {
  /** Cache-bust timestamp. Injectable for deterministic tests; BMS needs `&_cb=`
   * each poll for freshness (bms doc §3); District is `no-cache` so it ignores this. */
  cacheBust?: number;
}

/** One routed URL plus which source it targets (so the parser knows how to read it). */
export interface SourceUrl {
  source: ShowSource;
  url: string;
}

// ---- helpers ------------------------------------------------------------------

function enc(value: string): string {
  // A03: charset-safe interpolation of source codes into fixed templates.
  return encodeURIComponent(value);
}

/** "2026-06-22" → "20260622" for BMS byvenue `dateCode`. Non-ISO input passes through
 * (Parallel still gets a usable URL; live validation is a /verify concern). */
function toDateCode(isoDate: string): string {
  return isoDate.replace(/-/g, "");
}

/** Title → District movie slug: lowercase, strip punctuation, collapse to hyphens.
 * "Spider-Man: Brand New Day" → "spider-man-brand-new-day". Whether District's
 * canonical slug matches exactly is a live-Parallel /verify item (tasks.md) — tests
 * assert shape only. */
function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cacheBustOf(opts?: BuildOptions): number {
  return opts?.cacheBust ?? Date.now();
}

// ---- URL builders -------------------------------------------------------------

/**
 * Build the BMS availability URL for a catalog row, or `null` if it has no usable
 * BMS codes (platform routing — the row simply isn't on BMS).
 *
 * Routing: a venue-kind row (has `bmsVenueCode`) → **byvenue** (the proven
 * workhorse, keyed by venue+dateCode). A movie row (eventCode+regionCode, no
 * venueCode — design §39) → **byevent**, keyed by eventCode. byevent returns a
 * multi-date `ShowDatesArray`, so there is NO per-date URL param; only byvenue
 * carries `dateCode`.
 *
 * NOTE (await live verify — tasks.md line 111): byevent's region params
 * (regionCode/subRegion) are not yet live-confirmed; byvenue is the validated
 * fallback. Both shapes are built + tested here; correctness is a /verify step.
 */
export function buildBmsUrl(
  item: CatalogItemCodes,
  date: string,
  opts?: BuildOptions,
): string | null {
  const cb = cacheBustOf(opts);

  // Prefer byvenue when a venue code exists (validated clean-JSON workhorse #3).
  if (item.bmsVenueCode) {
    return (
      `${BMS_BYVENUE_BASE}` +
      `?appCode=MOBAND2&appVersion=9700` +
      `&venueCode=${enc(item.bmsVenueCode)}` +
      `&dateCode=${toDateCode(date)}` +
      `&_cb=${cb}`
    );
  }

  // Else byevent — needs BOTH eventCode and regionCode. A half-present set can't
  // build a valid byevent call → treat the source as absent (routing edge / A03).
  if (item.bmsEventCode && item.bmsRegionCode) {
    const region = enc(item.bmsRegionCode);
    return (
      `${BMS_BYEVENT_BASE}` +
      `?appCode=MOBAND2&appVersion=14304` +
      `&eventCode=${enc(item.bmsEventCode)}` +
      `&regionCode=${region}` +
      `&subRegion=${region}` +
      // Fake bmsId/token are accepted (bms doc §2); empty lat/lon; android device.
      `&bmsId=1&token=1&lat=&lon=&device=ANDROID` +
      `&_cb=${cb}`
    );
  }

  return null;
}

/**
 * Build the District movie-in-city URL for a catalog row, or `null` if it has no
 * usable District codes. Needs an MV code AND a city slug (the city is embedded in
 * the slug, not a path segment — district doc §2). District SSR is `no-cache`, so
 * no cache-bust param is needed/used.
 */
export function buildDistrictUrl(item: CatalogItemCodes, date: string): string | null {
  if (!item.districtMvCode || !item.districtCitySlug) return null;

  const slug = slugifyTitle(item.title);
  const city = enc(item.districtCitySlug);
  const mv = enc(item.districtMvCode);

  return (
    `${DISTRICT_BASE}/` +
    `${slug}-movie-tickets-in-${city}-${mv}` +
    `?fromdate=${enc(date)}`
  );
}

/**
 * Platform routing: return one entry per source whose codes the catalog row has —
 * and ONLY those. A District-only row yields just the District URL; a BMS-only row
 * just BMS; a row with both yields both (BMS first). No codes → []. This is the
 * cost lever that keeps a single-source show to one Parallel URL.
 */
export function targetSourceUrls(
  item: CatalogItemCodes,
  date: string,
  opts?: BuildOptions,
): SourceUrl[] {
  const urls: SourceUrl[] = [];

  const bms = buildBmsUrl(item, date, opts);
  if (bms) urls.push({ source: "bms", url: bms });

  const district = buildDistrictUrl(item, date);
  if (district) urls.push({ source: "district", url: district });

  return urls;
}

// ---- Parallel Extract adapter (the only network surface) ----------------------

/** One Parallel Extract result row. `content` is raw JSON (BMS API) or cleaned
 * text (District HTML); the source parsers in parse.ts read it. */
export interface ParallelResult {
  url: string;
  content?: string;
  [key: string]: unknown;
}

/** Shape Parallel's `/v1beta/extract` returns. */
export interface ParallelExtractResponse {
  results: ParallelResult[];
}

/** Injectable fetcher: takes the (already non-null) URL list, returns `{results}`.
 * The default hits Parallel; tests inject a mock returning fixtures. */
export type ParallelFetcher = (urls: string[]) => Promise<ParallelExtractResponse>;

/**
 * Default fetcher — POSTs the official Parallel Extract endpoint with `full_content`.
 * Reads `PARALLEL_API_KEY` LAZILY (here, not at import) so importing this module
 * never requires the secret. Never invoked in unit tests (a mock is injected).
 */
export const defaultParallelFetch: ParallelFetcher = async (urls) => {
  const apiKey = process.env.PARALLEL_API_KEY;
  if (!apiKey) {
    throw new Error("PARALLEL_API_KEY is not set");
  }

  const response = await fetch("https://api.parallel.ai/v1beta/extract", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({ urls, full_content: true }),
  });

  if (!response.ok) {
    throw new Error(`Parallel extract failed: HTTP ${response.status}`);
  }

  const data = (await response.json()) as ParallelExtractResponse;
  return Array.isArray(data.results) ? data : { results: [] };
};

/**
 * Batch-extract a set of source URLs via Parallel (one call covers BMS+District for
 * a target — the batching cost lever). Null entries (sources a target lacks) are
 * dropped; an empty list short-circuits without calling the fetcher. Returns the
 * `results[]` array for the parsers to consume.
 */
export async function extractViaParallel(
  urls: Array<string | null | undefined>,
  fetcher: ParallelFetcher = defaultParallelFetch,
): Promise<ParallelResult[]> {
  const usable = urls.filter((u): u is string => typeof u === "string" && u.length > 0);
  if (usable.length === 0) return [];

  const { results } = await fetcher(usable);
  return results;
}
