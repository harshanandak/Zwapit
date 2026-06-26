# Events Phase 2 — /dev decisions log

Process note: per the documented environment constraint (`bunx convex codegen` hangs inside
subagents, and subagents have been timing out this session), the per-task TDD is driven in the
**main loop** rather than via implementer/spec/quality subagents. Review rigor is preserved via
RED→GREEN→REFACTOR with shown failing output, the advisor, and the downstream `/validate` +
`/code-review` (CodeRabbit/SonarCloud) gates.

Decision-gate count: (tracked below)

---
