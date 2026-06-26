# Events Phase 2 — task list

Branch: feat/events-phase2 (worktree `.worktrees/events-phase2`, off master `4da67c6`).
Baseline: 303 tests pass, `tsc --project convex/tsconfig.json` clean.
Validate each item: `bunx tsc --project convex/tsconfig.json --noEmit` + `bun test "<wt>/src" "<wt>/convex"`. Commit per task.
codegen WORKS inline (main loop): `bunx convex codegen` (~120s, connects to dev `savory-cow-440`). Schema/new-symbol tasks → run codegen inline. `_generated` is generic (added symbols/fields = EOL churn only → `git checkout -- convex/_generated/`).

Scope: curated-availability-first events watcher. Reuse the movie engine; do NOT build resale, automated event-source polling/parsers, or third-party sources (see design.md "Out of scope"). Zero egress on the curated path.

---

## T1 — Schema: allow curated (non-polled) availability  [schema → codegen]
**File(s):** `convex/schema.ts`, `convex/__tests__/schema.watcher.test.ts`
**OWNS:** `convex/schema.ts`, `convex/__tests__/schema.watcher.test.ts`
**What to implement:** Extend the `watcherSource` union with `"curated"`. The value is reserved for
`availability_events.source` (the admin/curated availability write); `monitor_targets.sources` stays
unambiguously **`sources: []`** for curated targets (never `["curated"]`), so `pollDueTargets` — which
routes only bms/district URLs — never polls them. No new tables.
**TDD steps:**
1. Write test (`schema.watcher.test.ts`): insert a `monitor_targets` row with `sources: []` and an
   `availability_events` row with `source: "curated"` → both validate.
2. Run test → fails (validator rejects `"curated"`).
3. Implement: add `v.literal("curated")` to `watcherSource`; run `bunx convex codegen`.
4. Run test → passes. Re-run full suite (no movie regression).
5. Commit: `feat(schema): add "curated" watcher source for non-polled event availability`.
**Expected output:** schema validates curated targets/events; 303 baseline still green.

## T2 — Generalize `createAlert` for catalog kind (category + curated source)  [watcher.ts]
**File(s):** `convex/watcher.ts`, `convex/__tests__/watcher.test.ts`
**OWNS:** `convex/watcher.ts`, `convex/__tests__/watcher.test.ts`
**What to implement:** In `createAlert` (a) derive the want `category` from `catalog_items.kind`
(`movie`→`movie_ticket`, `live_event`→`event_ticket`) instead of the hardcoded `"movie_ticket"`
(`:316`); (b) for a `live_event` catalog row, allow a **curated target with `sources: []`** rather than
throwing `NO_WATCHABLE_SOURCE` (`:253–257`) — that error must STILL fire for a `movie` with no codes.
Keep movie behavior byte-identical.
**TDD steps:**
1. Write tests: (a) a `live_event` alert creates a `watching` target with `sources: []`, want
   `category: "event_ticket"`, no throw; (b) a `movie` row with no bms/district codes STILL throws
   `NO_WATCHABLE_SOURCE`; (c) two buyers on the same event occurrence collapse to ONE target
   (subscriberCount 2).
2. Run → the live_event cases fail (current code throws NO_WATCHABLE_SOURCE / sets movie_ticket).
3. Implement the kind-aware category + curated-source branch.
4. Run → passes; full suite green (movie tests unchanged).
5. Commit: `feat(watcher): kind-aware createAlert — curated event alerts (no pollable source)`.
**Expected output:** one client `createAlert` serves movies AND curated events; movie path unchanged.

## T3 — Internal `markEventAvailable` mutation + event payoff  [watcher.ts]
**File(s):** `convex/watcher.ts`, `convex/__tests__/watcher.test.ts`
**OWNS:** `convex/watcher.ts`, `convex/__tests__/watcher.test.ts`
**What to implement:** Add `internalMutation markEventAvailable({ collapseKey | monitorTargetId,
bookingUrl, shows[], detectedAt })` — the curated/admin analog of `pollDueTargets`→`recordAvailability`.
It MUST reuse `recordAvailability` (source `"curated"`, allowlisting `bookingUrl` via
`officialBookingUrl`) + `enqueueForEvent`, so it inherits snapshot-hash dedup, watching→live advance,
audit, and idempotent fan-out. Never client-callable. Confirm `getAlertPayoff` returns the live event
payoff (title/venue/date + deep-link OUT) — generalize labels only if needed (the existing
theatres/showtimes fields already carry venue/section).
**TDD steps:**
1. Write E2E test: seed event + 2 subscriber alerts (T2) → `markEventAvailable` (official URL) → target
   `live`, exactly one `availability_event`, one pending notification per subscriber × channel each with
   the deep-link OUT; `getAlertPayoff` returns `live` + bookingUrl for the OWNER only (A01 — another
   user gets `null`); a non-official `bookingUrl` is sanitised to `""`; idempotent re-call (same hash)
   adds no new event.
2. Run → fails (no `markEventAvailable`).
3. Implement (reusing `recordAvailability` + `enqueueForEvent`).
4. Run → passes; full suite green.
5. Commit: `feat(watcher): internal markEventAvailable (curated availability → notify, deep-link OUT)`.
**Expected output:** an admin can mark a curated event live → subscribers notified, payoff live, audited.

## T4 — Lock curated live_event rows as alert-ready (contract test only)  [seed.test.ts]
**File(s):** `convex/__tests__/seed.test.ts`
**OWNS:** `convex/__tests__/seed.test.ts`
**What to implement:** DRY — `seed.ts` ALREADY seeds curated `live_event` rows
(`catalog_event_alan_walker`, `catalog_event_coldplay`; see decisions.md Decision 2). Do NOT add or
duplicate rows. Add a **contract test only** asserting the existing curated rows stay alert-ready
(kind `live_event`, city + `startAt` set, NO BMS/District source codes → `createAlert` yields a curated
`sources: []` target). `convex/seed.ts` stays unchanged.
**TDD steps:**
1. Add a contract/characterization test in `seed.test.ts` over the existing seeded `live_event` rows.
2. Run → passes (rows already present); it locks the contract against a later edit adding source codes.
3. Commit: `test(seed): lock curated live_event rows as alert-ready (DRY)`.
**Expected output:** demo curated events present; idempotent across re-seeds.

## T5 — (LAST, research-only — does NOT gate the slice) Event-source spike → decisions.md
**File(s):** `docs/work/2026-06-26-events-phase2/decisions.md`
**OWNS:** `docs/work/2026-06-26-events-phase2/decisions.md`
**What to implement:** Time-boxed probe (≤ the box; no production code): inspect a BMS event page's
embedded JSON + a District event page's `__NEXT_DATA__` for an availability signal; record URL/payload
shape OR conclude "no clean event API". Write a **go/no-go** for a future automated event-adapter slice
(+ a data map if go). Egress: reuse shared-collapse + snapshot caching + conditional requests if built.
**TDD steps:** N/A (research). Output is `decisions.md`. Deferrable — if blocked/inconclusive, record
that and ship the curated slice regardless.
**Expected output:** `decisions.md` with a go/no-go; the curated v1 ships independent of the result.

---

## Notes
- Ordering: T1 (schema foundation) → T2 (alert) → T3 (availability+payoff) → T4 (seed) → T5 (spike, last/deferrable).
- T2/T3 both touch `convex/watcher.ts` → sequential (different waves); fine for a sequential /dev.
- No removal/rename → no blast-radius cleanup tasks.
- Frontend surfacing of events in the alerts/requests UI is a FOLLOW-UP (this slice is backend + seed); the existing alerts screens light up once event catalog items exist.
