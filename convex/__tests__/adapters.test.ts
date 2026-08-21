import { describe, expect, test } from "bun:test";

import {
  buildBmsUrl,
  buildDistrictUrl,
  defaultParallelFetch,
  extractViaParallel,
  targetSourceUrls,
} from "../watcher/adapters";

// Pure-TS adapter tests (Task 8). No Convex runtime, no convex-test, no codegen.
// The fetcher is injected — tests use a MOCK fetcher returning fixture results, so
// there is NO real network and NO PARALLEL_API_KEY needed. URL builders are asserted
// on exact SHAPE (per the bms/district execution docs), not on live resolution
// (exact slug / byevent region params are a post-merge /verify item — tasks.md).

// A minimal catalogItem shape: only the source-code + identity fields the builders
// read. Matches the optional fields added to catalog_items (schema.ts §catalog_items).
type CatalogItemForTest = {
  title: string;
  city?: string;
  bmsEventCode?: string;
  bmsRegionCode?: string;
  bmsVenueCode?: string;
  districtMvCode?: string;
  districtCdCode?: string;
  districtCitySlug?: string;
  kind?: string;
  districtEventSlug?: string;
};

// A movie alert target: BMS event/region codes + District MV/city-slug (design §39 —
// movie rows carry event+region, NOT venueCode). Both sources present.
const movieBothSources: CatalogItemForTest = {
  title: "Spider-Man: Brand New Day",
  city: "Mumbai",
  bmsEventCode: "ET00491386",
  bmsRegionCode: "MUMBAI",
  districtMvCode: "MV194537",
  districtCitySlug: "mumbai",
};

const DATE = "2026-06-22";

describe("buildBmsUrl", () => {
  test("builds the byvenue URL (with dateCode + cache-bust) when a venueCode is present", () => {
    // A venue-kind row carries bmsVenueCode → byvenue is the proven workhorse (#3).
    const venueItem: CatalogItemForTest = { title: "Some Venue", bmsVenueCode: "CSWO" };
    const url = buildBmsUrl(venueItem, DATE, { cacheBust: 1700000000000 });
    expect(url).toBe(
      "https://in.bookmyshow.com/api/v2/mobile/showtimes/byvenue" +
        "?appCode=MOBAND2&appVersion=9700&venueCode=CSWO&dateCode=20260622&_cb=1700000000000",
    );
  });

  test("builds the byevent URL from eventCode+regionCode when no venueCode (movie row)", () => {
    // Movie rows lack a venueCode → byevent keyed by eventCode (#2). byevent returns
    // a multi-date ShowDatesArray, so there is NO per-date param; cache-bust still applies.
    const url = buildBmsUrl(movieBothSources, DATE, { cacheBust: 1700000000000 });
    expect(url).toBe(
      "https://in.bookmyshow.com/api/movies-data/showtimes-by-event" +
        "?appCode=MOBAND2&appVersion=14304&eventCode=ET00491386&regionCode=MUMBAI" +
        "&subRegion=MUMBAI&bmsId=1&token=1&lat=&lon=&device=ANDROID&_cb=1700000000000",
    );
  });

  test("returns null when the BMS codes are incomplete (eventCode without regionCode)", () => {
    // A03 / routing edge: a half-present code set can't build byevent → source absent.
    const half: CatalogItemForTest = { title: "X", bmsEventCode: "ET00491386" };
    expect(buildBmsUrl(half, DATE)).toBeNull();
  });

  test("returns null when no BMS codes exist at all", () => {
    const none: CatalogItemForTest = { title: "X", districtMvCode: "MV1" };
    expect(buildBmsUrl(none, DATE)).toBeNull();
  });

  test("URL-encodes codes defensively (A03 charset-safety)", () => {
    const dirty: CatalogItemForTest = { title: "X", bmsVenueCode: "A B&C" };
    const url = buildBmsUrl(dirty, DATE, { cacheBust: 1 });
    expect(url).toContain("venueCode=A%20B%26C");
  });
});

describe("buildDistrictUrl", () => {
  test("builds the movie-in-city URL with a title-derived slug + MV code + fromdate", () => {
    const url = buildDistrictUrl(movieBothSources, DATE);
    expect(url).toBe(
      "https://www.district.in/movies/" +
        "spider-man-brand-new-day-movie-tickets-in-mumbai-MV194537?fromdate=2026-06-22",
    );
  });

  test("returns null when no District MV code exists", () => {
    const noMv: CatalogItemForTest = { title: "X", districtCitySlug: "mumbai" };
    expect(buildDistrictUrl(noMv, DATE)).toBeNull();
  });

  test("returns null when no city slug exists", () => {
    const noCity: CatalogItemForTest = { title: "X", districtMvCode: "MV1" };
    expect(buildDistrictUrl(noCity, DATE)).toBeNull();
  });

  test("slugifies messy titles deterministically", () => {
    const messy: CatalogItemForTest = {
      title: "  Mission: Impossible — The Final Reckoning!  ",
      districtMvCode: "MV99",
      districtCitySlug: "delhi-ncr",
    };
    const url = buildDistrictUrl(messy, DATE);
    expect(url).toBe(
      "https://www.district.in/movies/" +
        "mission-impossible-the-final-reckoning-movie-tickets-in-delhi-ncr-MV99?fromdate=2026-06-22",
    );
  });
});

describe("targetSourceUrls — platform routing", () => {
  test("returns BOTH source URLs when both code sets exist", () => {
    const urls = targetSourceUrls(movieBothSources, DATE, { cacheBust: 5 });
    expect(urls).toHaveLength(2);
    expect(urls).toEqual([
      // movieBothSources carries both code sets, so both builders return a string
      // (never null) — assert non-null so this matches SourceUrl.url: string under
      // the strict convex tsconfig CI typechecks with.
      { source: "bms", url: buildBmsUrl(movieBothSources, DATE, { cacheBust: 5 })! },
      { source: "district", url: buildDistrictUrl(movieBothSources, DATE)! },
    ]);
  });

  test("District-only catalog item → only the District URL (no BMS)", () => {
    const districtOnly: CatalogItemForTest = {
      title: "District Only Film",
      districtMvCode: "MV777",
      districtCitySlug: "mumbai",
    };
    const urls = targetSourceUrls(districtOnly, DATE);
    expect(urls).toHaveLength(1);
    expect(urls[0].source).toBe("district");
    expect(urls.some((u) => u.source === "bms")).toBe(false);
  });

  test("BMS-only catalog item → only the BMS URL (no District)", () => {
    const bmsOnly: CatalogItemForTest = {
      title: "BMS Only Film",
      bmsEventCode: "ET123",
      bmsRegionCode: "BANG",
    };
    const urls = targetSourceUrls(bmsOnly, DATE, { cacheBust: 9 });
    expect(urls).toHaveLength(1);
    expect(urls[0].source).toBe("bms");
  });

  test("no usable codes → no URLs", () => {
    const empty: CatalogItemForTest = { title: "Nothing", city: "Mumbai" };
    expect(targetSourceUrls(empty, DATE)).toEqual([]);
  });
});

describe("extractViaParallel — injected fetcher", () => {
  test("POSTs the urls to the injected fetcher and returns its results[]", async () => {
    const urls = ["https://in.bookmyshow.com/x", "https://www.district.in/y"];
    const calls: Array<{ urls: string[] }> = [];
    const mockFetcher = async (payloadUrls: string[]) => {
      calls.push({ urls: payloadUrls });
      return {
        results: [
          { url: payloadUrls[0], content: '{"ShowDetails":[]}' },
          { url: payloadUrls[1], content: "* PVR Mumbai\n+ 09:00 AM PXL 3D" },
        ],
      };
    };

    const results = await extractViaParallel(urls, mockFetcher);

    expect(calls).toHaveLength(1);
    expect(calls[0].urls).toEqual(urls);
    expect(results).toHaveLength(2);
    expect(results[0].url).toBe(urls[0]);
    expect(results[1].content).toContain("PVR Mumbai");
  });

  test("filters out null URLs before calling the fetcher", async () => {
    let seen: string[] = [];
    const mockFetcher = async (payloadUrls: string[]) => {
      seen = payloadUrls;
      return { results: payloadUrls.map((u) => ({ url: u, content: "" })) };
    };
    await extractViaParallel(["https://a", null, "https://b"], mockFetcher);
    expect(seen).toEqual(["https://a", "https://b"]);
  });

  test("returns [] without calling the fetcher when there are no urls", async () => {
    let called = false;
    const mockFetcher = async () => {
      called = true;
      return { results: [] };
    };
    const results = await extractViaParallel([], mockFetcher);
    expect(called).toBe(false);
    expect(results).toEqual([]);
  });

  test("defaultParallelFetch is exported (the real fetcher) but never invoked here", () => {
    // No key, no network in tests — only assert it's a function so importing the
    // module needs no PARALLEL_API_KEY (read lazily inside the default fetcher).
    expect(typeof defaultParallelFetch).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// EVENT routing (probe 2026-08-21 � events-phase2 decisions.md)
// ---------------------------------------------------------------------------

const liveEventBms: CatalogItemForTest = {
  title: "Kumar Sanu Live In Concert",
  kind: "live_event",
  bmsEventCode: "ET00500437",
};

const liveEventDistrict: CatalogItemForTest = {
  title: "Gorillaz The Mountain Tour 2027 | Bengaluru",
  kind: "live_event",
  districtEventSlug: "gorillaz-the-mountain-tour-bengaluru-2027-buy-tickets",
};

describe("event URL builders", () => {
  test("live_event + bmsEventCode routes to the DETAIL PAGE, not the byevent API", () => {
    // Probe finding: showtimes-by-event never populates ShowDetails for events.
    const url = buildBmsUrl(liveEventBms, DATE);
    expect(url).toBe("https://in.bookmyshow.com/events/kumar-sanu-live-in-concert/ET00500437");
  });

  test("live_event without an ET code builds no BMS URL (curated fallback)", () => {
    expect(buildBmsUrl({ title: "Local Gig", kind: "live_event" }, DATE)).toBeNull();
  });

  test("districtEventSlug routes to the events surface", () => {
    const url = buildDistrictUrl(liveEventDistrict, DATE);
    expect(url).toBe(
      "https://www.district.in/events/gorillaz-the-mountain-tour-bengaluru-2027-buy-tickets",
    );
  });

  test("movie rows are UNCHANGED by event routing (regression)", () => {
    // Same assertions as the movie tests above � the kind-aware branch must not
    // disturb the validated movie shapes.
    expect(buildBmsUrl(movieBothSources, DATE, { cacheBust: 1700000000000 })).toBe(
      "https://in.bookmyshow.com/api/movies-data/showtimes-by-event" +
        "?appCode=MOBAND2&appVersion=14304&eventCode=ET00491386&regionCode=MUMBAI" +
        "&subRegion=MUMBAI&bmsId=1&token=1&lat=&lon=&device=ANDROID&_cb=1700000000000",
    );
    expect(buildDistrictUrl(movieBothSources, DATE)).toContain("-movie-tickets-in-mumbai-MV194537");
  });

  test("targetSourceUrls unions both event sources for a dual-coded row", () => {
    const urls = targetSourceUrls(
      { ...liveEventBms, districtEventSlug: liveEventDistrict.districtEventSlug },
      DATE,
    );
    expect(urls.map((u) => u.source)).toEqual(["bms", "district"]);
    expect(urls[0].url).toContain("/events/kumar-sanu-live-in-concert/");
    expect(urls[1].url).toContain("district.in/events/gorillaz");
  });
});
