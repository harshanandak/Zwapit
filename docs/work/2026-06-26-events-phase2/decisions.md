# Events Phase 2 — /dev decisions log

Process note: per the documented environment constraint (`bunx convex codegen` hangs inside
subagents, and subagents have been timing out this session), the per-task TDD is driven in the
**main loop** rather than via implementer/spec/quality subagents. Review rigor is preserved via
RED→GREEN→REFACTOR with shown failing output, the advisor, and the downstream `/validate` +
`/code-review` (CodeRabbit/SonarCloud) gates.

Decision-gate count: 2 (Good — minor gaps)

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
