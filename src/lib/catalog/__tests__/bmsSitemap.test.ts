import { describe, expect, test } from "bun:test";

import {
  bmsCatalogKey,
  bmsPosterUrl,
  diffByLastmod,
  parseMoviesSitemap,
  type MovieSitemapEntry,
} from "../bmsSitemap";

// Mirrors the real movies-synopsis.xml shape (incl. a browse-page row that must be skipped,
// and an entity with no <lastmod>).
const FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://in.bookmyshow.com/movies/mumbai/dilwale-dulhania-le-jayenge/ET00000652</loc><lastmod>2026-05-22</lastmod></url>
  <url><loc>https://in.bookmyshow.com/movies/surat/jab-we-met/ET00000182</loc><lastmod>2026-06-01</lastmod></url>
  <url><loc>https://in.bookmyshow.com/explore/movies-mumbai</loc><lastmod>2026-06-22</lastmod></url>
  <url><loc>https://in.bookmyshow.com/movies/delhi/upcoming-no-date/ET00009999</loc></url>
</urlset>`;

describe("parseMoviesSitemap", () => {
  test("extracts movie entities and skips non-entity (browse) rows", () => {
    const rows = parseMoviesSitemap(FIXTURE);
    expect(rows.map((r) => r.eventCode)).toEqual(["ET00000652", "ET00000182", "ET00009999"]);
  });

  test("parses eventCode, slug, loc, lastmod for an entity", () => {
    const ddlj = parseMoviesSitemap(FIXTURE).find((r) => r.eventCode === "ET00000652") as MovieSitemapEntry;
    expect(ddlj.slug).toBe("dilwale-dulhania-le-jayenge");
    expect(ddlj.loc).toBe("https://in.bookmyshow.com/movies/mumbai/dilwale-dulhania-le-jayenge/ET00000652");
    expect(ddlj.lastmod).toBe("2026-05-22");
  });

  test("missing <lastmod> yields empty string, not a crash", () => {
    const noDate = parseMoviesSitemap(FIXTURE).find((r) => r.eventCode === "ET00009999") as MovieSitemapEntry;
    expect(noDate.lastmod).toBe("");
  });

  test("empty / non-string input returns []", () => {
    expect(parseMoviesSitemap("")).toEqual([]);
    expect(parseMoviesSitemap(undefined as unknown as string)).toEqual([]);
  });
});

describe("diffByLastmod (incremental)", () => {
  const parsed = parseMoviesSitemap(FIXTURE);

  test("returns new codes and codes whose lastmod advanced; skips unchanged", () => {
    const existing = new Map<string, string | undefined>([
      ["ET00000652", "2026-05-22"], // unchanged -> skip
      ["ET00000182", "2026-05-01"], // advanced (06-01 > 05-01) -> include
    ]);
    expect(diffByLastmod(parsed, existing).map((r) => r.eventCode)).toEqual(["ET00000182", "ET00009999"]);
  });

  test("first run (empty store) returns everything", () => {
    expect(diffByLastmod(parsed, new Map()).map((r) => r.eventCode)).toEqual([
      "ET00000652",
      "ET00000182",
      "ET00009999",
    ]);
  });

  test("a no-lastmod entity already stored is not re-hydrated (no change detectable)", () => {
    const existing = new Map<string, string | undefined>([["ET00009999", ""]]);
    expect(diffByLastmod(parsed, existing).some((r) => r.eventCode === "ET00009999")).toBe(false);
  });
});

describe("key + poster helpers", () => {
  test("bmsCatalogKey normalizes to bms_<ETCODE>", () => {
    expect(bmsCatalogKey("et00000652")).toBe("bms_ET00000652");
  });
  test("bmsPosterUrl builds the bmscdn thumbnail URL", () => {
    expect(bmsPosterUrl("kalasipalya-poster")).toBe(
      "https://in.bmscdn.com/iedb/movies/images/mobile/thumbnail/xlarge/kalasipalya-poster.jpg",
    );
  });
});
