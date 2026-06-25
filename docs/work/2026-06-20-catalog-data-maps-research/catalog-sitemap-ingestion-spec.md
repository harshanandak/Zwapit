# National catalog ingestion via sitemaps — spec + live test evidence

**Goal:** ingest the movie/event catalog (titles, posters, codes) from BookMyShow (+ District)
**public sitemaps**, nationally (no per-region crawl, no auth), **incrementally** via `<lastmod>`, with
**idempotent upsert** by stable code. Frontend never calls BMS/District — this is a server-side job.

## Live test evidence (2026-06-22, from sandbox/datacenter IP)
- `in.bookmyshow.com/sitemap/index.xml` → **200**, **29 child sitemaps**.
- **`sitemap/movies-synopsis.xml` → 200, urlset, 4,883 movie entities**, 850 KB. Every `<url>` is
  `/movies/<city>/<slug>/ET<code>` **with a `<lastmod>`** (e.g. `2026-05-22`). = canonical national
  movie catalog; ET code is in the URL (no hydration needed just to get the key/identity).
- `sitemap/movies.xml` (15,193) and `sitemap/events.xml` (52,230) are **per-city BROWSE pages**
  (`/explore/movies-<city>`), NOT entities → **skip them**. Use the `*-synopsis.xml` sitemaps.
- **`sitemap/events-synopsis.xml` → 403** from datacenter (exists per robots.txt + index; blocked/
  rate-limited on this egress).
- **Hydration `GET /api/movies/v1/synopsis/init?eventcode=ET00000652` → 403** (text/html block) from
  datacenter. (Confirmed working from a residential IP in the earlier OSS probe — resolved a title.)

**→ Operative constraint (the main test finding): BMS serves static sitemaps to datacenter IPs but
403-blocks the dynamic API (and some sitemap leaves). The production crawler MUST egress via a
residential / proxied IP (or the Parallel.ai fetch service the prior research used) for hydration +
`events-synopsis`. Don't build it assuming a raw datacenter worker will reach the API.**

## Source scoping (per data type) — DECIDED
- **Movies → BMS ONLY.** Movies are national and duplicated across both platforms, so one source
  suffices; BMS is the easier one (clean public `movies-synopsis.xml` with ET codes, lastmod, bmscdn
  posters — TESTED). **Skip District for movies** (its movie data needs SSR/`__NEXT_DATA__` parsing +
  the `/gw/` HMAC gate = more work for zero added coverage).
- **Events → BMS + District (BOTH), union + dedup.** Event lineups genuinely differ per platform
  (District carries ex-Insider events BMS lacks, and vice-versa), so both are required for coverage.

## Sources (use the synopsis sitemaps)
- **BMS movies:** `sitemap/movies-synopsis.xml` (entities + ET codes + lastmod). TESTED ✅ — sole movie source.
- **BMS events/plays/sports/activities:** `events-synopsis.xml` (+ `plays.xml`, `sports.xml`,
  `activities.xml`). Same shape as movies-synopsis; confirm leaf shape from residential egress.
- **District events:** public `www.district.in` sitemaps (`sitemap-movies.xml` + nested:
  `movie-detail-generic.xml`, `sitemap-movies-city.xml`, `sitemap-cinema-detail-pages.xml`) → MV/CD
  codes across 526 cities (per `district-internal-api.md`). `/gw/` stays HMAC-gated → seed from
  sitemaps + SSR `__NEXT_DATA__`, never the raw API. (District = events coverage only; not movies.)
- **Skip:** `movies.xml`, `events.xml` (city browse pages, not entities); District movies entirely.

## Event cross-source dedup (the tricky part — movies need none of this)
**Events test evidence (2026-06-22, live):**
- BMS `events-synopsis.xml` → **3,863** entities, `/events/<slug>/ET<code>` (ET code = stable key). 200
  when not rate-limited.
- District `events/search-sitemap/sitemap-events.xml` → **[INDEX]** → `event-detail-pages.xml` →
  **5,121** entities, `/events/<slug>-buy-tickets` — **NO code in the URL.** District event identity =
  the **slug** (its internal code needs page/`__NEXT_DATA__` hydration). District also exposes
  `dining`, `activities`, `play`, `stores` sitemaps.
- **Overlap % NOT measured** — BMS hard-403'd this datacenter egress (3rd block; it throttles datacenter
  bursts aggressively). District stayed 200. Measure overlap at build via the residential/Parallel egress.

**Method (content-based, because the two use different code systems AND District has no URL code):**
- **Merge key** = `normalize(title) + city + event date` (+ venue when available). Normalize = lowercase,
  strip city/date/stopwords, token-sort.
- On a confident match → **one `catalog_item` carrying both source refs** (`bmsEventCode` +
  `districtSlug`/code), source-tagged (mirrors the `availability-watcher` "source-tagged codes" model).
- On no confident match → keep separate (accept rare dupes in v1; improve the matcher later).
- Expect **partial** overlap: marquee concerts/tours appear on both (must dedup); long-tail local events
  (BMS "clay-sculpting"/"pizza-making-workshop" vs District "farm day-out") are platform-specific.
- Movies need none of this (BMS-only source; ET code / canonical national title is unique).

**Egress (confirmed constraint):** BMS rate-limits/403s datacenter IPs after a few requests — the
events crawl + hydration + the overlap measurement all require a **residential/proxied egress (or
Parallel.ai)**. District tolerated datacenter, but treat both as residential-egress for production.

## Stable keys / dedupe
- BMS `ET<code>` (parsed from the sitemap URL); District `MV<code>`. Upsert key = `(source, externalId)`,
  e.g. `catalogKey = "bms_ET00000652"`. One entity per movie (national) — the city in the URL is just
  the canonical slug, dedupe by ET code.

## Incremental algorithm (lastmod-diff — matches the "shrinking daily churn" model)
1. Persist per entity: `externalId`, `sourceLastmod`; persist `lastRunAt`.
2. Fetch the synopsis sitemap(s); parse each `<url>` → `{ code, loc, lastmod }`.
3. For each: **hydrate only if** `code` is new **or** `lastmod > stored sourceLastmod`; otherwise skip.
4. Hydrate the delta only (residential egress): `synopsis/init?eventcode=ET<code>` → `eventName` (title),
   `imageCode` → `posterUrl = in.bmscdn.com/iedb/movies/images/mobile/thumbnail/xlarge/<imageCode>.jpg`,
   language/format/genre, slug.
5. **Idempotent upsert** into `catalog_items` by `(source, externalId)`; set `isActive=true`,
   `lastSyncedAt`, `sourceLastmod`. Unchanged rows are never rewritten.
6. Disappearance: codes absent from the sitemap for ≥N consecutive runs → `isActive=false` (never delete).
- **Day 1:** hydrate all ~4,883 movies. **Day 2+:** only changed `lastmod` → tiny delta. Churn shrinks daily.

## `catalog_items` mapping
`catalogKey`, `kind` (movie | live_event | …), `externalSource` ("bookmyshow" | "district"),
`externalId` (ET/MV), `title`, `subtitle` (language/format), `city`/`venueOrDestination` (events only;
movies are national), `imageUrl` (bmscdn poster), `isActive`, `lastSyncedAt`, `sourceLastmod`.

## Operational
- **Server-side scheduled job, daily** (Convex action/cron or external worker). NOT the frontend.
- **Egress: residential/proxied** (required for hydration + events-synopsis; datacenter 403s). Throttle
  (sequential + delay) and cache sitemaps by `lastmod`/ETag — the 403s in-test were partly a fast-burst
  rate-limit. Be a polite crawler.
- Volume is small: movies ~5k entities; events larger but incremental → daily work is just deltas.

## To confirm at build (from residential egress)
1. `events-synopsis.xml` leaf shape + entity-code pattern (403 this run).
2. Exact `synopsis/init` JSON key for the poster image code (parse live).
3. District SSR/`__NEXT_DATA__` hydration for MV/CD (per `district-internal-api.md`).
4. Pick the egress: residential proxy vs Parallel.ai fetch (prior research used Parallel).
