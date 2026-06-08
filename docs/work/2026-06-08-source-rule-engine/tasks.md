# Source Rule Engine Hardening Tasks

Issue: zwapit-pkm
Branch: codex/source-rule-engine
Worktree: .worktrees/source-rule-engine
Status: planned

## Task 1: Codex implements shared persisted-rule decision tests first

OWNS:
- `src/lib/rules/__tests__/evaluateRule.test.ts`

File(s):
- `src/lib/rules/__tests__/evaluateRule.test.ts`

What to implement:
Add RED tests that prove a provided `SourceRule` can be evaluated with the same semantics as bundled local evaluation: auto-approve, auto-block, waitlist-only, manual-review, missing required fields, missing eligibility fields, and price above face-value cap.

TDD steps:
1. Write test: add cases for a direct persisted-rule evaluator API that does not depend on `sourceRules`.
2. Run test: confirm it fails because no direct persisted-rule evaluator exists yet.
3. Implement in Task 2.
4. Run test: confirm the new tests pass.
5. Commit: `test(rules): cover persisted source rule decisions`

Expected output:
Rule decision tests fail before implementation and pass after Task 2.

## Task 2: Codex implements shared source-rule evaluation helper

OWNS:
- `src/lib/rules/evaluateRule.ts`

File(s):
- `src/lib/rules/evaluateRule.ts`

What to implement:
Extract a pure helper that evaluates a provided `SourceRule` with listing price, face value, and required field values. Keep `evaluateSourceRule()` as the bundled-rule convenience wrapper that classifies and looks up the bundled rule before delegating.

TDD steps:
1. Use the Task 1 RED tests.
2. Run test: confirm failing API or assertions.
3. Implement: add the shared helper and update `evaluateSourceRule()` to call it.
4. Run test: confirm rule tests pass.
5. Commit: `feat(rules): share source rule decision evaluation`

Expected output:
Local bundled rule behavior remains unchanged while persisted-rule evaluation can use the same helper.

## Task 3: Codex implements deterministic source-rule selection helper

OWNS:
- `src/lib/rules/sourceRuleSelection.ts`
- `src/lib/rules/__tests__/sourceRuleSelection.test.ts`

File(s):
- `src/lib/rules/sourceRuleSelection.ts`
- `src/lib/rules/__tests__/sourceRuleSelection.test.ts`

What to implement:
Create a pure helper for selecting the latest effective source rule from candidate rules. It must ignore future `effectiveFrom` rules, choose the highest version among effective rules, and document deterministic tie behavior.

TDD steps:
1. Write test: no candidates returns null; future-only returns null; older/current/future chooses current; version ordering is deterministic.
2. Run test: confirm it fails because the helper does not exist.
3. Implement: add `selectLatestEffectiveSourceRule()` or equivalent.
4. Run test: confirm helper tests pass.
5. Commit: `feat(rules): select latest effective source rule`

Expected output:
Persisted rule selection is testable without invoking Convex mutations.

## Task 4: Codex wires Convex listing submission to shared rule helpers

OWNS:
- `convex/listings.ts`
- `convex/__tests__/listingSubmission.test.ts`

File(s):
- `convex/listings.ts`
- `convex/__tests__/listingSubmission.test.ts`

What to implement:
Replace duplicated private decision/selection logic in `convex/listings.ts` with the shared helpers. Preserve `SOURCE_RULE_NOT_FOUND`, seller phone gate, seller payout publication gate, duplicate listing behavior, stored sourceRuleId/sourceRuleVersion, and listing state mapping.

TDD steps:
1. Write or extend tests: persisted missing required field, missing eligibility field, price over cap, future-dated rule ignored, and historical stored rule id/version remains on the listing.
2. Run test: confirm at least one test fails against current duplicated semantics or missing helper wiring.
3. Implement: update `convex/listings.ts` to call shared helpers.
4. Run test: confirm Convex listing submission tests pass.
5. Commit: `feat(convex): use shared source rule evaluation`

Expected output:
Convex persisted-rule decisions match local evaluator semantics without duplicate decision logic.

## Task 5: Codex validates scope, owner boundaries, and full gates

OWNS:
- `docs/work/2026-06-08-source-rule-engine/evidence.md`
- `docs/work/2026-06-08-source-rule-engine/evaluator-report.md`

File(s):
- `docs/work/2026-06-08-source-rule-engine/evidence.md`
- `docs/work/2026-06-08-source-rule-engine/evaluator-report.md`

What to implement:
Record fresh validation output and an evaluator review. Confirm no Claude implementation ownership was assigned for this backend-only PR, and confirm no excluded scope entered the branch.

TDD steps:
1. Run `bun run check`.
2. Run `bun test`.
3. Run `bun run build`.
4. Run `bun scripts/verify-first-visible-slice.mjs`.
5. Run `bun scripts/e2e-buyer.mjs`.
6. Run `bun scripts/e2e-seller.mjs`.
7. Run scope-drift and provider-id owner searches.
8. Commit: `docs: record source rule engine validation`

Expected output:
All gates pass or any pre-existing failure is documented with exact output and owner.

## Serial Handoff Rules

- Codex implements Tasks 1-5 first.
- Claude has no implementation task in this PR.
- If UI copy or flow work becomes necessary, stop and request a new Claude handoff after Codex finishes backend/test work.
- Shared files (`src/lib/types.ts`, `convex/schema.ts`, `convex/seed.ts`, `package.json`, routing, shared constants) require explicit serial approval before edits.

## Hard Stop

Stop after the plan commit. Do not start Task 1 until the user explicitly asks for implementation.
