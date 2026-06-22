// Pure BookMyShow movie-catalog sitemap helpers — no I/O, no network, so they are unit-testable
// and shared by the external crawler. The crawler fetches the XML (residential/Parallel egress,
// since BMS 403s datacenter) and feeds it here; the diff drives incremental hydration.
//
// Source: in.bookmyshow.com/sitemap/movies-synopsis.xml — a <urlset> of canonical movie entities,
// each <url> being /movies/<city>/<slug>/ET<code> + <lastmod>. (Use movies-synopsis.xml, NOT
// movies.xml, which is per-city browse pages.)

/** One canonical movie entity parsed from the synopsis sitemap. */
export interface MovieSitemapEntry {
  /** BMS event code, e.g. "ET00000652" — the stable cross-run dedup/upsert key. */
  eventCode: string;
  /** URL slug, e.g. "dilwale-dulhania-le-jayenge" (fallback title source pre-hydration). */
  slug: string;
  /** Full canonical URL. */
  loc: string;
  /** Sitemap <lastmod> (ISO-8601 / YYYY-MM-DD). Empty string when absent. */
  lastmod: string;
}

const URL_BLOCK = /<url\b[^>]*>([\s\S]*?)<\/url>/gi;
const LOC = /<loc>\s*([^<]+?)\s*<\/loc>/i;
const LASTMOD = /<lastmod>\s*([^<]+?)\s*<\/lastmod>/i;
const EVENT_CODE = /\/(ET\d+)(?:[/?#]|$)/i;

/**
 * Parse a movies-synopsis `<urlset>` into canonical movie entities. Defensive: any `<url>` without a
 * valid ET event code (malformed rows, browse pages) is skipped, never throws. Slug is the path
 * segment immediately before the ET code.
 */
export function parseMoviesSitemap(xml: string): MovieSitemapEntry[] {
  if (typeof xml !== "string" || xml.length === 0) return [];
  const out: MovieSitemapEntry[] = [];
  for (const block of xml.matchAll(URL_BLOCK)) {
    const body = block[1];
    const loc = (LOC.exec(body)?.[1] ?? "").trim();
    if (!loc) continue;
    const code = EVENT_CODE.exec(loc)?.[1];
    if (!code) continue; // not a movie entity (e.g. browse page) — skip
    const eventCode = code.toUpperCase();
    const segments = loc.split("?")[0].split("/").filter(Boolean);
    const codeIdx = segments.findIndex((s) => s.toUpperCase() === eventCode);
    const slug = codeIdx > 0 ? segments[codeIdx - 1] : "";
    out.push({ eventCode, slug, loc, lastmod: (LASTMOD.exec(body)?.[1] ?? "").trim() });
  }
  return out;
}

/**
 * Incremental diff: return only entries that are NEW (unknown event code) or CHANGED
 * (`lastmod` strictly greater than the stored value). `existing` maps eventCode -> last stored
 * lastmod (undefined/"" if never stored). ISO/`YYYY-MM-DD` strings compare correctly lexicographically.
 * Entries with no lastmod are hydrated only when the code is new (can't detect change without it).
 */
export function diffByLastmod(
  parsed: MovieSitemapEntry[],
  existing: Map<string, string | undefined>,
): MovieSitemapEntry[] {
  return parsed.filter((e) => {
    if (!existing.has(e.eventCode)) return true; // new
    const prev = existing.get(e.eventCode) ?? "";
    return e.lastmod !== "" && e.lastmod > prev; // changed
  });
}

/** Stable catalog key for a BMS movie. */
export function bmsCatalogKey(eventCode: string): string {
  return `bms_${eventCode.toUpperCase()}`;
}

/** Build the bmscdn poster URL from a BMS image code (jaydp17 pattern). */
export function bmsPosterUrl(imageCode: string): string {
  return `https://in.bmscdn.com/iedb/movies/images/mobile/thumbnail/xlarge/${imageCode}.jpg`;
}
