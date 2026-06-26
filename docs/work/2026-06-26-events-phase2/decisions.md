# Events Phase 2 — /dev decisions log

Process note: per the documented environment constraint (`bunx convex codegen` hangs inside
subagents, and subagents have been timing out this session), the per-task TDD is driven in the
**main loop** rather than via implementer/spec/quality subagents. Review rigor is preserved via
RED→GREEN→REFACTOR with shown failing output, the advisor, and the downstream `/validate` +
`/code-review` (CodeRabbit/SonarCloud) gates.

Decision-gate count: 1 (Good — minor gap)

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
