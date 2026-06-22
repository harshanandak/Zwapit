# Tasks — Official-Availability Watcher

TDD-first. Order: foundations → engine → orchestration → notifications → frontend → integration. Each task is RED → GREEN → REFACTOR → commit. Test runner: `bun test`. Convex logic tested with `convex-test`. Parallel + senders are **injected/mocked** — no network, no secrets.

Legend: `OWNS:` = files this task modifies (no two tasks in the same wave share a file).

---

## Wave 0 — Foundations (schema + pure logic)

### Task 1 — Schema migration (extend + new tables)
- **OWNS:** `convex/schema.ts`
- **Implement:** Additively extend `catalog_items` (optional `bmsEventCode, bmsRegionCode, bmsVenueCode, districtMvCode, districtCdCode, districtCitySlug, lat, long`), `wants` (optional `watchCity, watchDate, watchFormat, alertTypes[], channels[], monitorTargetId`), and add `"monitor_target" | "availability_event" | "notification"` to `audit_logs.entityType`. Add tables `monitor_targets`, `availability_events`, `notification_queue`, `source_snapshots` with indexes per design §Approach.
- **TDD:** 1) RED: `convex/__tests__/schema.watcher.test.ts` inserts a `monitor_targets` doc + a `catalog_items` doc with the new fields via `convex-test`; fails (table/fields absent). 2) GREEN: add tables/fields. 3) confirm `bun test` + `bunx convex codegen`/type-check pass. 4) Commit `feat(schema): watcher tables + extend catalog_items/wants/audit_logs`.
- **Expected:** new tables accept docs; existing tables still accept existing docs (additive/optional).

### Task 2 — Pure parse + decode library
- **OWNS:** `convex/watcher/parse.ts`, `convex/__tests__/parse.test.ts`, `convex/__tests__/fixtures/` (bms-byvenue.json, district-movie-city.txt)
- **Implement:** `AVAIL_STATUS_MAP = {0:"sold_out",1:"almost_full",2:"filling_fast",3:"available"}`; `parseBmsByVenue(json)` and `parseBmsByEvent(json)` → `NormalizedShow[]`; `parseDistrictMovieCity(text)` → `NormalizedShow[]` (split `* <theatre>` / `+ HH:MM <format>`); `normalizeToShow()` shared shape `{ source, theatreName, venueCode?, showTime, format, status?, bookingUrl? }`; `snapshotHash(shows)` (stable hash of a narrow field set); `computeCollapseKey({catalogItemId,city,date,format})`.
- **TDD:** RED first with small real-shaped fixtures (captured this session): BMS JSON → decoded statuses; District text → theatres+showtimes; assert exact counts/fields. GREEN minimal impl. Commit `feat(watcher): pure parse + AVAIL_STATUS_MAP`.
- **Expected:** deterministic normalized output from fixtures; no Convex imports (pure, fast).

### Task 3 — Union + dedupe across sources
- **OWNS:** `convex/watcher/parse.ts` (extend), `convex/__tests__/parse.union.test.ts`
- **Implement:** `unionAndDedupe(bmsShows, districtShows, venueMap)` → merged shows; a theatre present on both (matched via `venueMap` canonical id) appears once; `isOpen` = any show present; pick a `bookingUrl` per source.
- **TDD:** RED: same theatre in both inputs → expect 1 merged entry; District-only input → passthrough; empty both → `isOpen:false`. GREEN. Commit `feat(watcher): union + dedupe sources`.

---

## Wave 1 — Engine (Convex internal mutations/queries)

### Task 4 — Alert create + find-or-create monitor target
- **OWNS:** `convex/watcher.ts`, `convex/model.ts`
- **Implement:** `model.monitorTargetByCollapseKey(ctx,key)`; client `createAlert` mutation (auth via existing identity helper) → resolves catalog item, computes collapseKey, find-or-creates `monitor_targets` (sources from catalog codes; status `watching`; `nextCheckAt`=now), creates/updates the `wants` row with `monitorTargetId`+alert prefs, increments `subscriberCount`, audit log.
- **TDD:** RED: two `createAlert` calls for same movie+city+date → expect ONE `monitor_targets` row, `subscriberCount==2`, two `wants` linked. GREEN. Commit `feat(watcher): createAlert + shared monitor target`.

### Task 5 — Record availability (detection → live)
- **OWNS:** `convex/watcher.ts` (+ reuse `appendAuditLog`)
- **Implement:** `recordAvailability` internalMutation: given `{monitorTargetId, normalized, source}` — if `snapshotHash` unchanged vs `source_snapshots`, no-op; else write `availability_events`, upsert `source_snapshots`, advance target `watching → live` (first open), set `lastSnapshotHash`, audit log.
- **TDD:** RED: detection creates one `availability_events` + flips state to `live`; second identical call (same hash) → no new event. GREEN. Commit `feat(watcher): recordAvailability + snapshot dedup`.

### Task 6 — Enqueue notifications (idempotent, fire-once)
- **OWNS:** `convex/watcher.ts`
- **Implement:** `enqueueNotifications` internalMutation: for a live `availability_events`, for each subscribed `wants` × each `channel` × delivered `alertType` (Availability, Last-minute), insert `notification_queue` `pending` with `dedupeKey`; skip if dedupeKey exists. Late-subscriber helper: on `createAlert` to an already-`live` target, enqueue immediately from last event.
- **TDD:** RED: 2 subscribers → 2 pending (×channels) once; rerun → 0 new; late subscriber → 1 enqueued. GREEN. Commit `feat(watcher): idempotent notification enqueue`.

### Task 7 — Degrade / close lifecycle
- **OWNS:** `convex/watcher.ts`
- **Implement:** fail-counter on empty/blocked poll; after K (=3) consecutive → `degraded`; subscriber removal (expired want) decrements count; 0 subscribers → `closed`. Audit each transition.
- **TDD:** RED: 3 empty polls → `degraded`, no notifications. GREEN. Commit `feat(watcher): degrade + close lifecycle`.

---

## Wave 2 — Orchestration (actions + cron; Parallel injected)

### Task 8 — Parallel adapter + URL builders + platform routing
- **OWNS:** `convex/watcher/adapters.ts`, `convex/__tests__/adapters.test.ts`
- **Implement:** `buildBmsUrl(catalogItem,date)` (byvenue/byevent + cache-bust), `buildDistrictUrl(catalogItem,date)`; `targetSourceUrls(target,catalogItem)` returns only URLs for sources whose codes exist (platform routing); `extractViaParallel(urls, fetcher=defaultParallelFetch)` — injectable fetcher; default reads `PARALLEL_API_KEY` from env and POSTs `…/v1beta/extract`.
- **TDD:** RED: builds expected URLs; District-only catalog item → only District URL; mock fetcher returns `results[]` fixtures. GREEN (no real network in tests). Commit `feat(watcher): parallel adapter + platform routing`.

### Task 9 — pollDueTargets internalAction (the loop)
- **OWNS:** `convex/watcher.ts`
- **Implement:** `dueTargets` internalQuery (status `watching`, `nextCheckAt<=now`, in-window); `pollDueTargets` internalAction — for each due target: batch `extractViaParallel(urls)` → parse per source → `unionAndDedupe` → if open `recordAvailability`+`enqueueNotifications` else increment fail-counter → set `nextCheckAt` (windowed cadence) / stop on `live`.
- **TDD:** RED: seed a due target + mock fetcher returning an open fixture → after run, target `live` + notifications enqueued; a closed fixture → stays `watching`, nextCheckAt advanced. GREEN. Commit `feat(watcher): pollDueTargets loop`.

### Task 10 — Cron registration
- **OWNS:** `convex/crons.ts`
- **Implement:** `crons.interval("poll-availability", {minutes:N}, internal.watcher.pollDueTargets)`.
- **TDD:** RED: import `convex/crons` + assert the job is registered (smoke). GREEN. Commit `feat(watcher): schedule poll cron`.

---

## Wave 3 — Notifications (senders injected)

### Task 11 — dispatchNotifications internalAction
- **OWNS:** `convex/watcher.ts`, `convex/watcher/senders.ts`, `convex/__tests__/senders.test.ts`
- **Implement:** `senders = { email, webpush }` injectable; default email→Resend, webpush→VAPID, **no-op + log when env unset**; `dispatchNotifications` internalAction drains `pending` → send → mark `sent`/`failed`; copy: title "Tickets are live", body "<movie> · <theatre> · <time> — book now", action deep-link OUT. (Add cron tick or chain from poll.)
- **TDD:** RED: pending → `sent` with mock sender; sender throws → `failed`, retryable. GREEN. Commit `feat(watcher): dispatch notifications (email + web push)`.

---

## Wave 4 — Frontend (alert create + payoff)

### Task 12 — Alert-create wiring
- **OWNS:** `src/` create-request screen + its component test (exact path confirmed at task start by reading the route)
- **Implement:** wire the existing "Set an alert" form to `createAlert` (catalog pick + city + date + format + alert toggles + channels); show confirmation; reuse v5 styles, approved copy only.
- **TDD:** RED: submitting the form calls the mutation with the right args / shows confirmation. GREEN. Commit `feat(ui): wire alert-create to createAlert`.

### Task 13 — "Tickets are live" payoff card
- **OWNS:** `src/` alerts/payoff screen + component test
- **Implement:** `getAlertPayoff` query (live state + theatres + bookingUrl); render the v5 `.alert-card` (gold rail, "Tickets are live") with the **deep-link OUT** button; non-live → "We'll notify you" waiting state.
- **TDD:** RED: live payoff → card with correct `href`; pending → waiting copy. GREEN. Commit `feat(ui): tickets-are-live payoff card + deep-link`.

---

## Wave 5 — Integration + seed

### Task 14 — Seed extension (smoke fixture)
- **OWNS:** `convex/seed.ts`
- **Implement:** seed one movie `catalog_items` with BMS (`ET…`,region,venue) + District (`MV…`,city-slug) codes, and a demo alert, so the flow is demoable without real data.
- **TDD:** RED: seed runs, target+alert present. GREEN. Commit `feat(seed): watcher demo fixture`.

### Task 15 — End-to-end integration test
- **OWNS:** `convex/__tests__/watcher.e2e.test.ts`
- **Implement:** create alert → run `pollDueTargets` with mock fetcher (open) → assert target `live`, `availability_events`=1, `notification_queue` enqueued, `getAlertPayoff` returns live + correct deep-link. Plus the degrade path (mock empty ×3 → degraded).
- **TDD:** the test IS the deliverable. Commit `test(watcher): end-to-end availability path`.

---

## Notes / deferred
- BMS by-event region params need a live validation pass (by-venue is the proven fallback) — flagged in Task 8/9.
- Real Resend/VAPID keys + a live Parallel smoke are a post-merge `/verify` step, not in unit tests.
- Discount/Price-drop alert delivery, WhatsApp/Telegram, Google Maps, community-resale matching = out of scope (separate features).
