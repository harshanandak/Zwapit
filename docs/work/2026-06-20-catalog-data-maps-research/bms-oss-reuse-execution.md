# BookMyShow OSS Reuse — Execution Doc

*What Zwapit reuses from the open-source BMS/District notifier ecosystem, and exactly how — via Parallel Extract, never direct server fetch.*

Date: 2026-06-22. Sources: GitHub repo audit + live probes from sandbox (India Cloudflare edge, cf-ray -MAA) + adversarial re-verification.

> **Hard architectural constraint (unchanged, now better-justified):** Zwapit does **not** fetch BMS from its own Convex/datacenter server. The `abinpaul1` README is primary-source proof that *sustained single-IP polling gets the server IP banned*. All availability reads go through **Parallel Extract** (residential/rotating IP, ~$0.001/URL). Zwapit then deep-links the user **out** to the official BMS page to book — Zwapit never resells official inventory.

---

## 0. Live test results (2026-06-22) — both §6 blockers RESOLVED ✅

Ran Parallel Extract directly against the BMS endpoints with the live key:

- **#3 `/api/v2/mobile/showtimes/byvenue` → WORKS.** Parallel returned clean JSON (~103 KB) with `ShowDetails / EventTitle / ShowTime / Availability / AvailStatus / Categories` — real data (e.g. "He-Man and The Masters of The Universe" at venue `CSWO`, 2026-06-22). **No custom UA/headers needed — default Parallel settings reached it.** This is the clean-JSON upgrade, confirmed.
- **#5 `/api/explore/v1/discover/regions` → WORKS** (~707 KB JSON; `RegionCode` + `RegionName` + lat/long for all cities). **#6 `/api/v2/mobile/venues?regionCode=MUMBAI&eventType=MT` → WORKS** (~117 KB; `VenueCode` + `VenueName` + full `VenueAddress`). One-call catalog/venue seeding via Parallel is real — and the addresses feed Google Maps directly.
- **#2 `/api/movies-data/showtimes-by-event` → endpoint works** (valid `ShowDatesArray` returned) but gave **empty `ShowDetails`** for the test query (ET00491386 / `regionCode=MUMBAI` / today, `isDisabled:true`) — needs the correct `regionCode`/`subRegion` (or a currently-running event). Per-venue **#3 is the proven workhorse** until #2's params are tuned.
- **[BLOCKER 1] Parallel UA/header control → RESOLVED:** the `user_agent`, `headers`, and `render_js` params are all **accepted** (HTTP 200, no 422). Moot anyway — #3 worked on defaults.
- **[BLOCKER 2] buytickets HTML grid (#1) → reconfirmed:** cache-busted Extract returned the showtime grid (41 showtimes), consistent with §8.0.

**Net: the clean-JSON path is proven end-to-end via Parallel.** Recommended primary = **#3 `byvenue`** (or **#2 by-event** once region params are tuned — the natural per-movie poll) → structured `Availability / AvailStatus / Categories / MinPrice` straight from JSON, **no HTML render variance**. Cost unchanged (~$0.001–0.002/call, 1–2 SKU units). The §6 blockers below are retained for history; both are now cleared.

---

## 1. TL;DR — the most reusable findings

1. **Detection rule = "movie title present in the showtimes payload."** Every working notifier (`abinpaul1`, `deCodeIt`, `vibhorjain27`) uses the same marker: tickets are live when the target movie's `EventTitle` appears in `ShowDetails[0].Event[]` for that (venue/event, date). **How Zwapit uses it:** parse whatever Parallel returns from the buytickets URL, walk `ShowDetails`, and flip the `monitor_target` to "tickets are live" on a fuzzy title match (>0.75 to tolerate catalog drift). This is the single most portable piece of logic.

2. **The data carries far more than "open/closed" — the OSS bots throw it away.** The showtimes payload includes per-show `Availability`, `AvailStatus`, `MinPrice`/`MaxPrice`, and `Categories[].PercentAvail/SeatsAvail/MaxSeats`. **How Zwapit uses it:** these fields power the four alert types in the design (Availability, Discount, Price-drop, Last-minute) and the "filling fast" badge — for free, from the same extract. No notifier in the set does this; it's Zwapit's upgrade.

3. **Status decode is a stable, copyable constant.** `aviiciii/bms-ticket-notifier`'s `AVAIL_STATUS_MAP` decodes the modern web API: **`0 = SOLD OUT, 1 = ALMOST FULL, 2 = FILLING FAST, 3 = AVAILABLE`**. **How Zwapit uses it:** adopt this map as the availability-decode constant. It is more durable than the card-nesting path (which BMS reshapes), so depend on the codes, not the JSON shape.

4. **Catalog/region seeding has clean(ish) endpoints.** `/api/explore/v1/discover/regions` (and `/api/explore/de/regions`) returns all cities with `RegionCode` + lat/long; `/api/v2/mobile/venues?regionCode=<RC>&eventType=MT` returns the venue list with codes (the older `/pwa/api/de/venues` is **dead — HTTP 400 `0xa`**). **How Zwapit uses it:** one-time/periodic seeding of canonical city → `regionCode` → venue-code rows (+ lat/long for Google Maps) via Parallel, *if* Parallel can reach them (verify — they 403 from datacenter IP).

5. **Lifecycle/dedup pattern: collapse + one-shot fire.** Collapse key `eventCode + venueCode + dateCode` = one watcher for many subscribers (maps directly to `monitor_targets`); on fire, auto-disable the watch and stop the watcher when no subscribers remain (`albinpk` pattern); cadence is **minutes, jittered** — never the browser extensions' 5s (that only works from a residential tab). **How Zwapit uses it:** this is the `monitor_targets` collapse-and-fire spec, almost verbatim.

---

## 2. Endpoint catalogue — what to point Parallel at

> Liveness legend: **HTML-verified** = page returns the grid via Parallel-style extraction; **JSON live (residential)** = returned 200 JSON from the India-edge sandbox; **403 datacenter** = Cloudflare-blocks a plain datacenter GET (Parallel reachability *unverified*); **dead** = 400/404/redirect/host-gone.

| # | Endpoint | JSON/HTML | Params / headers | Returns | Works 2026? | Reuse verdict |
|---|----------|-----------|------------------|---------|-------------|---------------|
| 1 | `in.bookmyshow.com/movies/<city>/<slug>/buytickets/<eventCode>/<YYYYMMDD>` **(+ cache-bust query param)** | **HTML** (client-hydrated) | Mobile/Android UA; cache-bust e.g. `?_cb=<ts>` for freshness | The showtimes grid for one movie+city+date — theatres + showtimes + status, once rendered | **Primary path.** URL pattern current; old `/buytickets/<slug>/movie-<city>-ET..-MT/<date>` **301-redirects** here | **REUSE — point Parallel here** |
| 2 | `in.bookmyshow.com/api/movies-data/showtimes-by-event` | **JSON (clean)** | `appCode=MOBAND2&appVersion=14304&eventCode=ET<code>&regionCode=<R>&subRegion=<R>&bmsId=<any>&token=<any>&lat=&lon=&device=ANDROID` — **mobile UA is the only real gate; fake bmsId/token accepted, appCode optional** | `ShowDetails` + `ShowDatesArray` (per-date `DateCode`/`isDisabled`) — **same model `deCodeIt` used to scrape, now as clean JSON** | **JSON live (residential, datacenter unverified).** Sibling `vibhorjain27/BMS-Notification`, last push 2026-03 | **REUSE IF Parallel can send a mobile UA** — the clean-JSON upgrade |
| 3 | `in.bookmyshow.com/api/v2/mobile/showtimes/byvenue` | **JSON (clean)** | `appCode=MOBAND2&appVersion=9700&venueCode=<VC>&dateCode=<YYYYMMDD>` (+`&_cb=` cache-bust); **returns 200 with NO custom headers, NO token** | `ShowDetails[0].Event[].EventTitle` + `ChildEvents[].{EventDimension,EventLanguage,EventCode}` + `ShowTimes[].{ShowTime,Availability,AvailStatus,MinPrice,MaxPrice,SessionId,Categories[].{PercentAvail,SeatsAvail,MaxSeats}}` | **JSON live (residential)** — 23 real events at venue IMMO/BANG on 2026-06-22 | **REFERENCE / alt-JSON** — by *venue* not event; great for field semantics |
| 4 | `in.bookmyshow.com/api/movies-data/v4/showtimes-by-event/primary-dynamic` | **JSON (v4 card)** | `eventCode,dateCode,regionCode,lat,lon,isDesktop=true` + headers `x-app-code:WEB, x-region-code/slug, x-geohash, x-latitude/longitude, Referer:/movies/<slug>/buytickets/<event>/`; **no x-bms-id/token** | `groups[]→cards[] venue-card → venueCode/venueName + categories[].availStatus` | **Was live to datacenter IPs until ~mid-Mar 2026, now 403 datacenter.** Needs geohash + region headers Parallel-by-URL can't send | **REFERENCE (spec only)** — source of `AVAIL_STATUS_MAP` |
| 5 | `in.bookmyshow.com/api/explore/v1/discover/regions` *(and `/api/explore/de/regions`)* | **JSON** | plain UA | `{BookMyShow:{TopCities,OtherCities}}` each `RegionCode/RegionName/Alias/Lat/Long` | **JSON live (residential); 403 datacenter** | **REUSE for seeding** (verify Parallel reach) |
| 6 | `in.bookmyshow.com/api/v2/mobile/venues?regionCode=<RC>&eventType=MT` | **JSON** | mobile UA | `arrVenue[]` / `venues[]` → `VenueCode`, `VenueName` (129 venues for BANG) | **JSON live (residential)** | **REUSE for venue seeding** |
| 7 | `in.bookmyshow.com/api/movies/v1/synopsis/init?eventcode=ET<code>&channel=mobile` | **JSON** | mobile UA | `meta.event.eventName` (resolved "Spider-Man: No Way Home") | **JSON live (residential)** | **REUSE** — ET-code → title resolver |
| 8 | `in.bookmyshow.com/api/movies/v1/cinema/showcase?vc=<VC>` | **JSON** | mobile UA | `data.venueName` | **JSON live (residential)** | REFERENCE — venue-code → name |
| 9 | `in.bookmyshow.com/serv/getData?cmd=GETREGIONS` / `cmd=QUICKBOOK&type=MT` (Cookie `Rgn=|Code=<RC>|`) | **JS-blob / JSON** | legacy; QUICKBOOK needs `Rgn` cookie | `var regionlst` city map; `moviesData` now-showing | **Partly live (legacy 2018 path); GETREGIONS is JS-wrapped, not pure JSON** | REFERENCE only |
| 10 | `in.bookmyshow.com/pwa/api/de/venues?regionCode=<RC>&eventType=MT` | JSON | — | (was venue list) | **DEAD — HTTP 400 `0xa`** | **IGNORE** (use #6) |
| 11 | `api.insider.in/...` / `api.district.in/...` (District/Insider) | — | — | — | **DEAD — NXDOMAIN / host gone; Insider sunsetting into District** | **IGNORE** — District has no OSS JSON; see §6 |

**The upgrade call-out:** endpoints **#2** and **#3** are *clean JSON for showtimes/availability* vs the heavy hydrated HTML of **#1**. If Parallel Extract can be told to send a **mobile User-Agent**, point it at **#2** (`/api/movies-data/showtimes-by-event`) — it's keyed by `eventCode` (what Zwapit already stores), needs no real credentials, and returns the exact `ShowDetails` model. **If Parallel cannot control the UA / inject headers, the validated fallback is #1** (the buytickets HTML page with a cache-bust param). Decide this with one test (see §6).

---

## 3. Reusable logic → mapped to `monitor_targets`

**"Tickets open" marker.** Target movie `EventTitle` (or `eventCode`) present in `ShowDetails[0].Event[]` for the requested date ⇒ flip to *Tickets are live*. (`abinpaul1` + `deCodeIt` + `vibhorjain27` all agree.) Add fuzzy title match >0.75. For format-specific Wants (2D/3D/IMAX), additionally require the format in `ChildEvents[].EventDimension` (`deCodeIt` pattern).

**Status decode (the upgrade).** Map per-show availability for richer alerts:
- Numeric web API (`aviiciii`): `0=SOLD OUT, 1=ALMOST FULL, 2=FILLING FAST, 3=AVAILABLE`.
- Mobile API (`abinpaul1`): `ShowTimes[].Availability` + `Categories[].PercentAvail/SeatsAvail` → derive *filling fast / last-minute*; `MinPrice` deltas → *price-drop*.

**Collapse / dedup key.** `eventCode + venueCode + dateCode` → one watcher, many subscribers. This is the `monitor_targets` collapse key. (Many OSS bots re-check the same show per-user; Zwapit collapses it.)

**Fire-once lifecycle.** On availability, set the watch fired and **auto-disable** it (`albinpk`: `trackingEnabled = !available`); stop the watcher entirely when no subscribers remain. = `monitor_target` states open → fired → auto-stop, one-shot per subscriber.

**State persistence for change-detection.** `aviiciii` keeps a `bms_state.json` and diffs `NOT_OPEN→BOOKABLE` and `sold-out→back`. Zwapit stores last-seen availability per target so it only notifies on *transitions*, not every poll.

**Cadence + block avoidance.** Server cadence = **minutes, jittered, per collapsed target** (`abinpaul1` notifier loop / `aviiciii` `*/30` cron). **Never** the 5s of the browser extensions — that only works because they ride the user's *residential* IP and authenticated session. The IP-ban lesson (`abinpaul1` README) is *why* Zwapit routes through Parallel (residential/rotating) and never polls from Convex. The regenerating `bmsId`/`&_cb=` timestamp doubles as a **cache-bust for freshness**.

**What to NOT copy.** "URL returns 200" as a liveness test (`tonystalker`) — a buytickets URL can 200 *before* booking opens. Bare DOM/string match like `body.contains('Book tickets')` (`albinpk`, the removed Chrome extension) — too coarse, movie-level only, no venue/showtime/price granularity. Use the `ShowDetails` parse instead.

---

## 4. Code-map — ET-code / region / venue resolution

How the repos resolve identifiers, and what Zwapit caches on catalog rows:

- **City → `regionCode`.** `/api/explore/v1/discover/regions` → `TopCities`/`OtherCities` each `{RegionCode, RegionName, Alias, Lat, Long}`. (Codes seen: MUMBAI, NCR, BANG, HYD, AHD, CHD, PUNE, CHEN, KOLK, KOCH.) `aviiciii` even hardcodes a `REGION_MAP` of 8 metros (code+slug+lat+lon+geohash) so you can skip the call for top cities. **Cache on catalog/city rows:** `regionCode`, `regionSlug`, lat/long, geohash.
- **Movie → `eventCode` (ET-code).** Format `ET<digits>`. Resolve a user-pasted BMS link with the regex `^https://in\.bookmyshow\.com/\w+/movies/\w+/ET\d+/?$` (`albinpk`), or get the title back from a code via `/api/movies/v1/synopsis/init?eventcode=ET<code>` → `meta.event.eventName`. **Cache on catalog rows:** `eventCode`, slug, `EventGroup`, image code → `in.bmscdn.com/iedb/movies/images/mobile/thumbnail/xlarge/<code>.jpg` (`jaydp17` pattern).
- **Venue → `venueCode`.** `/api/v2/mobile/venues?regionCode=<RC>&eventType=MT` → `arrVenue[] {VenueCode, VenueName}`. Geo/address come from showtimes payloads (`jaydp17`/`captn3m0`): `VenueLatitude/Longitude, VenueAddress, VenueSubRegionCode`. **Cache on venue rows:** `venueCode`, name, lat/long (for Google Maps), `subRegionCode`. **Critical:** venue codes must be **seeded live** from #6 — `byvenue` returns 200 with *empty* `ShowDetails` for stale/guessed codes, so never hardcode them.
- **URL templates (confirmed across `Nikhil-Wagh`, `gobms`, `deCodeIt`):** buytickets = `/movies/<city>/<slug>/buytickets/<eventCode>/<YYYYMMDD>` (current); legacy `/buytickets/<slug>/movie-<city>-ET..-MT/<date>` redirects to it; movie detail = `/<city>/movies/<slug>/ET<code>`.

**Schema reference (don't trust 2019 enums):** `captn3m0`'s 2019 gist confirms the taxonomy (`EventCode ET`, `EventGroup`, `VenueCode`, `RegionCode`, `ShowDateCode`, `EventURLTitle` slug) but its `EventSoldOut Y/N` / `EventStatus NS` fields are **not** the modern per-show `Availability`/`AvailStatus` — use the §3 decode, re-confirmed against a live sold-out show.

---

## 5. Execution recommendation + build checklist

**Decision:**
- **Fetch layer = Parallel Extract.** Non-negotiable; datacenter polling gets IP-banned (`abinpaul1`).
- **Primary target = the buytickets HTML URL (#1) + cache-bust param** — the already-validated path. Note the grid is now client-hydrated, so confirm Parallel actually recovers showtimes from the rendered page (the old `var UAPI` regex scrape is **dead** — verify, don't assume §8.0 still holds).
- **Upgrade target (if it verifies) = the clean JSON `/api/movies-data/showtimes-by-event` (#2)** with a mobile UA — same `ShowDetails` model, cheaper/more reliable for Parallel than rendered HTML. Gate this on the §6 UA test.
- **Reuse logic:** detection rule (title in `ShowDetails`), `AVAIL_STATUS_MAP` (0/1/2/3), collapse key `eventCode+venueCode+dateCode`, fire-once + state-diff, minutes-jittered cadence, cache-bust freshness.
- **Seed catalog** from `/discover/regions` (#5) + `/api/v2/mobile/venues` (#6) + `/synopsis/init` (#7), via Parallel.
- **Ignore:** `pwa/api/de/venues` (dead #10), all District/Insider hosts (NXDOMAIN #11), the v4 endpoint as a fetch path (#4 — spec only), every HTML-only-2019/2020 scraper (`Nikhil-Wagh`, `sudheendrachari`) except for URL patterns, and the "URL-200 = open" / "DOM string match" detection styles.
- **Do NOT build the app-impersonation path** (forged `MOBAND2` + fake `x-bms-id`/device headers). Worse IT-Act s43/s66 posture than reading public HTML, and unreachable via Parallel anyway.

**Build checklist:**
1. **Verify Parallel header/UA control** (§6 blocker) — can Parallel send a mobile UA / custom headers? This decides #2 vs #1.
2. **Re-verify the §8.0 premise:** point Parallel at one live buytickets URL (#1) + cache-bust, confirm it returns the showtime grid + theatres now that the page is hydrated.
3. Seed `regions` + `venues` + ET-code/title via Parallel into Convex catalog rows (cache `regionCode`, `venueCode`, lat/long, slug, image code).
4. Implement the `monitor_targets` collapse key and fire-once + state-diff lifecycle.
5. Implement availability decode (`AVAIL_STATUS_MAP` + `PercentAvail`) → the 4 alert types + "filling fast" badge.
6. Keep the watcher **non-load-bearing**: degrade to community-resale signal + admin + deep-link-out if BMS changes shape or blocks. Watch for sudden 401/403 → app-version/token rotation.

---

## 6. Open questions / verify-before-build

1. **[BLOCKER] Can Parallel Extract send a custom User-Agent / headers?** Endpoints #2/#3/#5/#6 need a **mobile UA** (and #4 needs region+geohash headers). If Parallel sends only a default UA, the clean-JSON upgrade (#2) is unreachable and **#1 (buytickets HTML) stays primary**. *Test before committing to JSON.*
2. **[BLOCKER] Does Parallel still recover the showtime grid from #1?** The buytickets page is now **client-hydrated** — the old `var UAPI` JSON blob is gone. Prior research §8.0 ("Parallel extracts the buytickets page") was taken as given and **needs re-checking** against today's page.
3. **Datacenter vs residential is unproven for sustained polling.** All "JSON live" results were **single** requests from an **India Cloudflare edge** IP (cf-ray `-MAA`) — not a generic US/EU datacenter, and not sustained. `/discover/regions` and the v4 endpoint **403 from datacenter IPs**. One 200 ≠ durability. *Why we route via Parallel:* the `abinpaul1` ban was a sustained-polling/volume effect, exactly what a server origin would trigger.
4. **Availability enum not fully mapped on the mobile API.** Live, every show was `Availability=A`, `AvailStatus` blank — **sold-out / filling-fast values were not observed**. Re-confirm the `A`-style mobile enum against a live sold-out show; depend on `aviiciii`'s 0/1/2/3 numeric map (more stable) where the web API is used.
5. **Hardcoded creds rot.** `token=67x1xa33b4...`, `appVersion=9700/14304` are 2022-era literals — they still work but BMS may rotate; fakes are accepted today on #2/#3, so don't depend on real ones.
6. **District/Paytm Insider = no usable OSS.** `api.insider.in`/`api.district.in` are **NXDOMAIN**; Insider is sunsetting into District (Zomato, 12-month migration); the one documented Insider JSON API (`only-much-louder/insider-api-doc`) is **API-KEY-gated and archived Sep 2025**. Realistic path = Parallel Extract on rendered `www.district.in` show-page **HTML** (same as #1), never a clean JSON API. Discovering internal District XHR/GraphQL needs real-browser DevTools capture and would likely carry app-version/token headers Parallel-by-URL can't supply. **Separate pass.**
7. **Freshness rides on the undocumented cache-bust trick** (regenerating `bmsId`/`&_cb=` timestamp). No documented Parallel freshness param confirmed; the trick could change.
