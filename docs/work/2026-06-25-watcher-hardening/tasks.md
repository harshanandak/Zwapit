# Watcher hardening (zwapit-46i follow-ups) — tasks

Branch: feat/watcher-hardening (worktree .worktrees/watcher-hardening, off master 2369fd2).
Baseline: 293 tests pass, `tsc --project convex/tsconfig.json` clean.
Validate each item: `bunx tsc --project convex/tsconfig.json --noEmit` + `bun test "<wt>/src" "<wt>/convex"`. Commit per item.
codegen WORKS inline (main loop): `bunx convex codegen` (timeout ~120s) — connects to dev:savory-cow-440. Only hangs inside subagents, so do schema/new-symbol items inline.

## T1 — zwapit-46i.1: window-bound polling (codegen-FREE) + expiry/close (codegen)
- createAlert: on monitor_target CREATE, set `windowEnd` = end of watch date (e.g. `${date}T23:59:59.999Z`). schema already has windowStart/windowEnd.
- dueTargets: add lower bound `(!t.windowStart || t.windowStart <= nowIso)` alongside the existing windowEnd upper bound.
- ⚠️ TEST TRAP: existing poll tests use POLL_NOW="2030-01-01" vs date="2026-06-25". A 2026 windowEnd makes them out-of-window at 2030 → dueTargets empty → detection tests fail. FIX: in each affected test, after createAlert patch the created target's windowEnd to undefined (or ≥ POLL_NOW). Add a NEW test: windowEnd<now ⇒ excluded from dueTargets.
- EXPIRY (codegen): new internalAction `expireWants` that finds wants past expiresAt, calls removeSubscriber (decrement → close on 0); register in crons.ts. Test close-on-zero. (removeSubscriber already exists, just unwired.)

## T2 — zwapit-46i.4 + dispatch-race (CodeRabbit :867) — schema + codegen, batch together
- schema notification_queue: add `attempts: v.optional(v.number())` and extend `status` union with `"sending"`.
- claimNotification internalMutation: pending → 'sending' atomically (re-check status); dispatch only sends if claim won (prevents double-send on overlapping dispatch).
- retry: on send failure increment attempts; requeue to 'pending' while attempts < MAX (e.g. 3), else 'failed'. pendingNotifications stays pending-only (requeue handles retry).
- codegen after schema change. Tests: claim prevents double-send; transient-fail-then-succeed → sent; persistent-fail → failed after MAX (no infinite loop).

## T3 — zwapit-46i.3: cross-source VenueMap dedupe (codegen-free)
- REFRAME first: District shows are NAME-keyed (parseDistrictMovieCity sets no venueCode), and catalog_items has no District-theatre-name field. A venueMap keyed on districtCdCode can't match a District show. So a code-based map only bridges BMS↔BMS, not BMS↔District.
- Decision: either (a) accept name-fallback dedupe (already works) + close .3 with rationale, or (b) build the map from bmsVenueCode only (partial). Lean (a) unless cross-source dupes are observed. Confirm with user / verify against real data before investing.

### DECISION (2026-06-25, confirmed with user): (a) — close as name-fallback sufficient.
Verified against code: `canonicalVenue` (convex/watcher/parse.ts:267) already bridges
sources via a `name:<normalized-name>` fallback (trim/lowercase/collapse-spaces), and
`pollDueTargets` passes an empty venueMap — so cross-source dedupe already works whenever
theatre names normalize identically. A code-keyed venueMap CANNOT bridge BMS↔District
because District shows carry no venue code (parseDistrictMovieCity emits none), so it would
only ever dedupe BMS↔BMS — not what .3 intended. Residual gap: divergent names
(e.g. "PVR Phoenix" vs "PVR: Phoenix Mall, Lower Parel") dedup-miss → theatre listed twice;
a display nicety, not a correctness/safety issue, and unfixable without a name↔code data
source we don't have. **No code change.** Revisit only if real divergent-name dupes are
observed; that would be its own data+ingestion task (option b).

## Ship
- When all done: `bun run build`, push feat/watcher-hardening, open PR, /code-review, close the beads issues.
</content>
