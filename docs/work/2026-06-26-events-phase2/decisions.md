# Events Phase 2 — /dev decisions log

Process note: per the documented environment constraint (`bunx convex codegen` hangs inside
subagents, and subagents have been timing out this session), the per-task TDD is driven in the
**main loop** rather than via implementer/spec/quality subagents. Review rigor is preserved via
RED→GREEN→REFACTOR with shown failing output, the advisor, and the downstream `/validate` +
`/code-review` (CodeRabbit/SonarCloud) gates.

Decision-gate count: 3 (Good — minor gaps; gate 3 was caught by the advisor final review)

---

## Decision 1
**Date**: 2026-06-26
**Task**: Task 2 — Generalize createAlert for curated events
**Gap**: The design said a curated event target (`sources: []`) is "never polled," but didn't
specify the mechanism. A `watching` target with `nextCheckAt <= now` would otherwise be returned by
`dueTargets` and churned by `pollDueTargets` (fetching nothing, rescheduling forever).
**Score**: 2/14 (same-file change to `dueTargets`; no signature/schema/auth/data change; reversible)
**Route**: PROCEED
**Choice made**: `dueTargets` now filters out empty-source targets (`t.sources.length > 0`), so
curated targets are never polled. Movie targets always carry ≥1 source, so they are unaffected
(verified — no movie-watcher regression). Aligns with the efficiency/egress constraint (no pointless
poll churn).
**Status**: RESOLVED

## Decision 2
**Date**: 2026-06-26
**Task**: Task 4 — Seed curated live_event occurrences
**Gap**: The task said "add 1–2 curated live_event rows," but `seed.ts` ALREADY seeds them
(`catalog_event_alan_walker`, `catalog_event_coldplay` — kind `live_event`, per-occurrence with
city + `startAt`, no source codes). Adding more would duplicate (DRY) and waste effort.
**Score**: 1/14 (test-only; no source/schema/auth/data change; reversible)
**Route**: PROCEED (DRY)
**Choice made**: Do NOT duplicate rows. Add a contract test that locks the curated event rows as
alert-ready (no BMS/District source codes → createAlert yields a curated `sources: []` target), so a
later edit can't silently break the curated path. **Deferred**: an end-to-end event-watcher demo
fixture (parallel to the movie WATCHER_DEMO — target + want + availability) belongs with the events
UI follow-up, since seeded demo data is only valuable once a screen displays it.
**Status**: RESOLVED

## Decision 3
**Date**: 2026-06-26
**Task**: Task 2 follow-up (advisor final review) — curated target scheduling vs the poll budget
**Gap**: `createAlert` set `nextCheckAt: nowIso` for ALL new targets including curated ones, so a
curated target ENTERED the `dueTargets` `by_status_next_check` index range and consumed the
`.take(limit)` budget BEFORE the `sources.length > 0` post-filter dropped it. Curated targets sort
first (ascending `nextCheckAt`) → they preferentially crowd real pollable (movie) targets out of a
poll wave. This is the SAME `.take`-then-filter starvation pattern fixed in Phase B's
`expiredAlertWants` (zwapit-46i.1), reintroduced — wasted poll budget (egress).
**Score**: 3/14 (same-file; touches polling selection; no schema/auth/data change; reversible)
**Route**: PROCEED
**Choice made**: Curated targets get a far-future `nextCheckAt` sentinel (`NEVER_POLL_AT`) so the
index range `nextCheckAt <= now` can NEVER select them — excluded from the budget, not merely
post-`.take` filtered. Kept `sources.length > 0` in `dueTargets` as defense-in-depth. Regression
test: N curated + 1 pollable target, `dueTargets({limit:1})` returns the pollable one (RED before the
sentinel — `due` was empty).
**Status**: RESOLVED

**Reusable lesson** (written into design.md §Constraints): index-range queries must exclude
non-eligible rows IN the range (sentinel/bound), never via a post-`.take()` filter.

---

## Event-source spike (T5) — BMS/District EVENT availability: go/no-go

**Box:** desk analysis only. The curated v1 ships regardless of the result, and the movie research
already established that BMS/District are bot-protected (they require **Parallel Extract**, not raw
fetch). A speculative crawl now would spend egress on an adapter that is explicitly NOT in this slice —
against the efficiency/egress constraint. So the empirical endpoint probe is deferred to the adapter
slice (below), and this entry records what is known + a leaning + the precise test to run.

**Known (proven — movies)** — `docs/work/2026-06-20-catalog-data-maps-research/*`:
- BMS: clean JSON via `…/showtimes/byvenue?venueCode=&dateCode=` and `…/showtimes-by-event?eventCode=ET…&regionCode=`; per-show `AvailStatus` 0–3 → sold_out/almost_full/filling_fast/available.
- District: SSR HTML with a `__NEXT_DATA__` embed; movie URL `/movies/<slug>-…-MV<id>`, `-CD<id>` venues; sitemaps enumerate MV/CD/city.
- Both unioned through Parallel Extract (bypasses bot protection).

**Unknown (events):**
- Does BMS expose an event-availability analog? (does `showtimes-by-event` accept a non-movie `eventType`, or is there a distinct `/events` API; event-code format?)
- Does District list events under a city-discovery URL with a `__NEXT_DATA__` availability signal, or route events to a different surface? No event URL pattern was ever enumerated.
- Granularity: events sell by **section/tier** (concert GA/VIP; sports stands), not theatre. The normalized shape carries this in `theatreName`/`format`, but the source PAYLOAD shape is unknown.

**Preliminary go/no-go (NOT empirically validated):**
- BMS — **lean GO-with-caution**: events plausibly share the `showtimes-by-event` infra with a different `eventType`/code.
- District — **lean UNKNOWN**: no event URL pattern known; may be search-only.

**Empirical probe = first task of the future automated-event-adapter slice (NOT this slice):**
1. Via Parallel Extract, pull a known BMS event page + its network JSON; look for an availability field + a stable event/venue code and a URL template.
2. Pull a District event page; inspect `__NEXT_DATA__` for an availability signal + an event/CD code + a city-discovery URL.
3. Decode the event availability-status mapping (reuse `AVAIL_STATUS_MAP` for BMS; map District `seatStatus`).
4. Output a data map (URL templates + parse fields) → build `parseBmsEvent` / `parseDistrictEvent` behind the existing `pollDueTargets` routing, reusing shared-collapse + snapshot caching + conditional requests (egress).

**Decision:** curated-first v1 ships now; automated event polling is a **separate slice gated on the probe**. If the probe is negative, curated-only remains the product — the "we'll notify you" promise is still met. **Status**: RESOLVED (spike documented; empirical validation deferred).

---

## Event-source spike (T5) — EMPIRICAL PROBE EXECUTED (2026-08-21): GO for both sources

The deferred empirical probe was run 2026-08-21 via Parallel Extract against live BMS and District
surfaces. Raw evidence excerpts were pulled fresh; findings below are from those responses.

### BMS — GO, via event DETAIL PAGE (not the showtimes API)

- **Sitemap exists**: `in.bookmyshow.com/sitemap/events-synopsis.xml` → **5,575 event URLs**,
  pattern `https://in.bookmyshow.com/events/<slug>/ET<code>` — same ET-code family as movies, so
  `catalog_items.externalId` needs no new id scheme.
- **`showtimes-by-event` does NOT carry events.** Probed ET00505033 (Kochi), ET00454493 (Mumbai),
  ET00500437 (Delhi) across regionCode MUMBAI + DELHI: every response is the movie-shaped shell
  (`ShowDetails: []`, `ShowDatesArray` with all days `isDisabled: true`, no `AvailStatus`/`VenueName`
  /`ShowTime`). The endpoint is movie-only; do NOT build an event adapter on it.
- **Availability lives on the detail page as rendered text** (verified on
  `/events/kumar-sanu-live-in-concert/ET00500437`): `Filling Fast`, `Book Now`, `₹11999 onwards`,
  date+time (`Sat 16 Jan 2027, 7:30 PM`), venue (`Yashobhoomi Convention Center: Delhi`),
  demand signal (`291 are interested`). Parse target = markdown text markers, same cost/check as
  movies (~$0.001 via Parallel).
- **Adapter implication**: `buildBmsUrl` for events should emit the DETAIL PAGE URL
  (`/events/<slug>/<ETcode>`), not the byevent API. Status vocabulary to enumerate in the adapter
  slice: at minimum `Filling Fast` / `Book Now` (on sale); `Sold Out` / `Coming Soon` / `Notify Me`
  states seen on site but not yet captured in a probe — first adapter task is to lock the full map.
- Region gotcha: the page header shows the READER's city, not the event's — venue line carries the
  real city (`...: Delhi`). Parse venue, not header.

### District — GO, strongest signal of the two

- **Dedicated events sitemap chain**: `robots.txt` → `/events/search-sitemap/sitemap-events.xml`
  (index) → `event-detail-pages.xml` (**3,121 event URLs**, pattern
  `district.in/events/<slug>`), plus artist/venue-guide sitemaps.
- **Event pages carry an explicit sales timeline with live state** (verified on Gorillaz Bengaluru
  2027 page): `General Sale is live now`, price `₹15,000 onwards`, `Book tickets` CTA, and a
  structured **Sales timeline** block — `Mastercard Pre-Sale Mon 13 Apr, 1 PM - Sat 18 Apr, 1 PM` /
  `General Sale Sat 18 Apr, 2026, 2 PM - Sat 23 Jan, 2027, 7 PM` + state marker `Live`. That
  timeline is exactly Zwapit's alert surface: pre-sale start, general-sale start, sale end.
- Second sample (Akhil Sachdeva Mumbai) confirms the minimal shape: `Book tickets` + `₹1999
  onwards` + date + `Venue to be announced` (venue can be null — schema already allows).
- Multi-city tours cross-link (`Touring In [Mumbai ...](...)`) — useful for per-city targets later.

### Verdict

**GO for both sources.** Automated event polling is buildable behind the existing
`pollDueTargets` routing: BMS via detail-page scrape (new URL builder + text-marker parser),
District via detail-page scrape (sales-timeline parser). Both reuse shared-collapse, snapshot-hash
caching, and stop-on-detect; egress stays ~$0.001/check. The movie JSON-API path does not extend to
events — that asymmetry is the one design change vs the original leaning ("BMS lean GO via
showtimes-by-event" was wrong; it's GO via page instead).

**Next slice (gated on this GO):** `parseBmsEventPage` / `parseDistrictEventPage` +
`buildBmsEventPageUrl` / `buildDistrictEventUrl` in `convex/watcher/adapters.ts` + `parse.ts`,
fixtures from these probes, full status-vocabulary enumeration, then wire into `targetSourceUrls`.
Curated path stays as fallback for events with no source codes. **Status**: RESOLVED — probe
executed, GO recorded.
