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
