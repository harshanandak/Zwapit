# Availability Watcher — Build-Ready Implementation Spec

*One-read spec to build the official-availability watcher: detect "tickets are live" for a movie+city+date across **BookMyShow ∪ District**, notify subscribers, deep-link OUT. Consolidates everything validated 2026-06-20…22 (see `bms-oss-reuse-execution.md`, `district-reuse-execution.md`, `availability-watcher-crawlers.md`, `decisions.md`).*

> **Ownership:** the backend (schema, state machine, adapters, Convex actions) is **Codex's lane**; `convex/schema.ts` is a shared file needing explicit user approval. This doc is the design/handoff; Claude wires the frontend after the schema lands.

---

## 1. Architecture — Convex-native, no n8n

`Convex cron (every N min)` → query active `monitor_targets` in their poll-window → `Convex action` → **Parallel Extract (batched URLs)** → parse per-source → diff vs last snapshot → on open-transition: mutation flips state + enqueues notifications → fan-out (email + web push) → deep-link OUT.

- **Parallel does the fetch**, so Convex's IP never touches BMS/District (no IP-block). Convex only calls `api.parallel.ai`.
- All availability/matching mutations are **internal-only + audited**. No client-exposed matching mutations.
- Watcher is **non-load-bearing**: degrade to community-resale + admin "mark live" + deep-link if a source changes shape or blocks.

## 2. Data model (concept — Codex finalizes `schema.ts`)

- **catalog_movies**: `{ canonicalId, title, tmdbId, posterUrl, bmsEventCode ("ET…"), districtMvCode ("MV…"), districtSlug }`
- **catalog_venues**: `{ canonicalId, name, city, lat, long, bmsVenueCode, districtCdCode }` — **source-tagged; some carry both codes, some one** (this mapping is what makes the union + dedup work — D5).
- **catalog_regions**: `{ city, bmsRegionCode, districtCitySlug, lat, long }`
- **monitor_targets**: `{ collapseKey, movieCanonicalId, city, date, format?, sources:["bms"?,"district"?], status:"watching"|"live"|"closed"|"degraded", lastSnapshotHash, subscriberCount, windowStart, windowEnd, lastCheckedAt, nextCheckAt }`
  - `collapseKey = movieCanonicalId + city + date (+ format)`
- **alert_requests**: `{ userId, movieCanonicalId, city, date, venueCanonicalId?, format?, alertTypes[], channels[], monitorTargetId }`
- **notification_queue**: `{ userId, monitorTargetId, eventId, alertType, status:"pending"|"sent"|"failed" }` — idempotent per `(userId, targetId, eventId, alertType)`.

## 3. Source adapters

### 3a. BookMyShow — clean JSON (validated)
- **Per movie+region (all theatres):** `GET in.bookmyshow.com/api/movies-data/showtimes-by-event?appCode=MOBAND2&appVersion=14304&eventCode=ET…&regionCode=<R>&subRegion=<R>&bmsId=<any>&token=<any>&device=ANDROID` — fake bmsId/token accepted. *(Validate region/subRegion params — returned empty for one test region.)*
- **Per theatre (alt):** `GET in.bookmyshow.com/api/v2/mobile/showtimes/byvenue?appCode=MOBAND2&appVersion=9700&venueCode=<VC>&dateCode=YYYYMMDD` — **no headers/token needed** (validated: returns full `ShowDetails`).
- **Parse:** `ShowDetails[].Event[].EventTitle`; `ShowTimes[].{ShowTime, Availability, AvailStatus, MinPrice, Categories[].{PercentAvail, SeatsAvail, MaxSeats}}`.
- **Freshness:** append cache-bust query (`?_cb=<ts>`) — default is ~1-day stale.
- **Seed:** `/api/explore/v1/discover/regions` (regionCode+lat/long), `/api/v2/mobile/venues?regionCode=<R>&eventType=MT` (venueCode+name+address). Both validated via Parallel.

### 3b. District — rendered-text parse (validated)
- **Per movie+city (all theatres):** `GET www.district.in/movies/<slug>-movie-tickets-in-<city>-MV<id>?fromdate=YYYY-MM-DD` via Parallel `full_content`. Parse the regular text:
  - Theatre = line `* <Name, Area>`; its showtimes = following `+ HH:MM AM/PM <format>` lines; `Allows cancellation` / `Non-cancellable` per theatre.
  - **Booking open ⇔ theatres present.** (Validated: 47 theatres / 38 showtimes / formats parsed from one call.)
  - **Per-show fill-status is NOT available** (colour-coded → stripped). Booking-open + theatre + showtime + format ARE.
- **Freshness:** District is `no-cache` per request — **no cache-bust needed**.
- **Seed:** `www.district.in/movies/<city>-movie-tickets` → all bookable movies as ready `…-MV<id>` URLs; sitemaps (`sitemap-movies.xml` → MV/CD/city) for full catalog.
- **Not usable:** the `/gw/...` guest-token gateway returns **empty via Parallel**; `api.edition.in/gw` is HMAC-gated. Text-parse is the path.

### Shared availability decode
`AVAIL_STATUS_MAP`: **0 = Sold Out, 1 = Almost Full, 2 = Filling Fast, 3 = Available** (BMS numeric / District `statusColor` G-Y-R-D). District text → booking-open only; BMS JSON → full status for the Filling-Fast/Last-minute tiers.

## 4. Detection + union
- A `monitor_target` flips to **live** when **either** adapter reports its movie present with ≥1 bookable showtime for the date (fuzzy title match ≥ 0.75; format match for format-specific Wants).
- **Union** the theatre lists from both sources; **dedupe** a theatre on both via its `catalog_venues.canonicalId`.
- **Snapshot-hash a NARROW region** (the showtime/booking-state set), not the whole page, to avoid false fires.
- **Fire-once:** on live, notify subscribers, auto-disable the watch; stop the target when no subscribers remain.

## 5. Cost optimization (the real levers)
1. **Shared `monitor_targets` dedup** — one watch per movie+city+date for all subscribers (biggest lever).
2. **Windowed polling** — idle until the expected open window (predict from TMDB release date / advance-booking announcement); tighten to every few minutes in-window; **stop on first detect**.
3. **One call per movie+city covers all theatres** — never pay per theatre.
4. **Platform-routing** — only fetch the platform(s) the request's target venue is on; a single-platform request = **1 URL**, not 2.
5. **Batch** BMS+District (and multi-city) URLs in one Parallel Extract call — bills **per-URL (no discount)** but saves round-trips + latency (server-side concurrency).
- **Cost:** ~$0.001/URL; union of one movie+city = 2 URLs = ~$0.002. **30–40 movies → ~$2–12/month.** Parallel startup credits may cover the MVP.

## 6. Notifications
- **Email (Resend free tier) + Web Push (VAPID)** first; **WhatsApp later** (Business API + opt-in/DLT).
- Fan-out from `notification_queue`, idempotent.
- Copy: *"Tickets are live — <movie> · <theatre> · <time> — book now"* → **deep-link OUT** to the BMS/District booking page (never resell official inventory).

## 7. Phased build checklist
0. **Verify Parallel's max URLs-per-call cap** (for batching).
1. **Seed** catalog: BMS regions+venues + District city-listing/sitemaps → `catalog_movies` / `catalog_venues` with **both** source codes.
2. **`monitor_targets`** schema + collapse/dedup + lifecycle (watching→live→closed/degraded). *(Codex; schema.ts approval.)*
3. **BMS JSON adapter** + parser + `AVAIL_STATUS_MAP`.
4. **District text adapter** + parser.
5. **Convex cron + action** (batched Parallel call) + state-diff + windowing/stop-on-detect.
6. **Notification fan-out** (email + web push).
7. **Validate** BMS by-event region params; graceful degrade on shape change/block.
8. **Frontend** (Claude): alert-create → request, "tickets live" payoff card + deep-link, request list/states.

## 8. Open items / caveats
- BMS **by-event region/subRegion params** need validation (empty in one test) — by-venue is the proven fallback.
- District **per-show fill-status** unavailable via text (booking-open is) — only the Filling-Fast/Last-minute alert tier is affected in v1.
- **Parallel batch cap** unverified.
- **Rotate the test API key** (used across many tests, present in chat history).
- **ToS/legal** deprioritized per founder; keep the watcher non-load-bearing, real-user-triggered, internal-only + audited, deep-link-OUT.
