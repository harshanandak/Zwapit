# Source Rule Engine Evidence

Issue: zwapit-pkm
Branch: codex/source-rule-engine
Worktree: .worktrees/source-rule-engine

## Plan Evidence

- Read `AGENTS.md` and `CLAUDE.md`.
- Created isolated worktree: `.worktrees/source-rule-engine`.
- Branch: `codex/source-rule-engine`.
- Base commit: `4033123 test(sell): cover promise submit click path (#11)`.
- Recovered worktree Beads runtime:
  - `bd doctor` initially failed because database `zwapit` was not found on the Dolt server.
  - `bd bootstrap` found existing metadata and did not rebuild.
  - `bd doctor --fix --yes` fixed permissions but could not create the missing database.
  - Created the missing Dolt database and imported `.beads/issues.jsonl`.
  - `bd doctor --fix --yes` then reported 0 errors.
- Created Beads issue: `zwapit-pkm`.
- Marked `zwapit-pkm` as `in_progress` with `workflow_type=standard`, `current_stage=plan`, `branch=codex/source-rule-engine`, and `worktree=.worktrees/source-rule-engine`.
- Attached the design and acceptance criteria to `zwapit-pkm` with `bd update`.
- Added a Beads comment with the plan artifact paths and hard-stop note.
- Exported Beads initially, but the recovered database lacked historical comment rows and changed old `comment_count` values. Reverted that noisy export and kept only the new `zwapit-pkm` issue record in `.beads/issues.jsonl`.
- Attempted Forge helper context calls:
  - `bash scripts/beads-context.sh set-design zwapit-pkm 5 docs/work/2026-06-08-source-rule-engine/tasks.md`
  - `bash scripts/beads-context.sh set-acceptance zwapit-pkm "..."`
  - Both timed out after 60 seconds. The issue still has design and acceptance criteria attached through `bd update`; helper-specific context was not confirmed.

## Baseline Validation

Command: `bun run check`

Result: pass. Astro check reported 0 errors and 11 CommonJS hints in dep-guard scripts.

Command: `bun test`

Result: pass. 111 tests passed, 0 failed.

## Implementation Status

Product source implementation is complete for Tasks 1-4.

### Task 1-2 Evidence

RED command:

- `bun test src/lib/rules/__tests__/evaluateRule.test.ts`

RED result:

- Failed with `Export named 'evaluateProvidedSourceRule' not found in module ... src/lib/rules/evaluateRule.ts`.

GREEN command:

- `bun test src/lib/rules/__tests__/evaluateRule.test.ts`

GREEN result:

- Passed: 13 tests, 0 failed, 55 expectations.

Commit:

- `3ff4d4e feat(rules): share source rule decision evaluation`

### Task 3 Evidence

RED command:

- `bun test src/lib/rules/__tests__/sourceRuleSelection.test.ts`

RED result:

- Failed with `Cannot find module '../sourceRuleSelection'`.

GREEN command:

- `bun test src/lib/rules/__tests__/sourceRuleSelection.test.ts`

GREEN result:

- Passed: 4 tests, 0 failed, 5 expectations.

Commit:

- `557c35f feat(rules): select latest effective source rule`

### Task 4 Evidence

RED command:

- `bun test convex/__tests__/listingSubmission.test.ts`

RED result:

- Failed deterministic same-version persisted rule selection:
  - Expected `source_rule_bookmyshow_event_a`
  - Received `source_rule_bookmyshow_event_b`

GREEN command:

- `bun test convex/__tests__/listingSubmission.test.ts`

GREEN result:

- Passed: 22 tests, 0 failed, 95 expectations.

Affected-test command:

- `bun test src/lib/rules/__tests__/evaluateRule.test.ts src/lib/rules/__tests__/sourceRuleSelection.test.ts convex/__tests__/listingSubmission.test.ts`

Affected-test result:

- Passed: 39 tests, 0 failed, 155 expectations.

Commit:

- `d1140b1 feat(convex): use shared source rule evaluation`

## Planned Validation Gates

- `bun run check`: pass, 0 errors, 11 CommonJS hints in dep-guard scripts.
- `bun test`: pass, 122 tests, 0 failed, 410 expectations.
- `bun run build`: pass, 15 pages built.
- `bun scripts/verify-first-visible-slice.mjs`: pass, checked 15 contract routes.
- `bun scripts/e2e-buyer.mjs`: pass, buyer mock path reached completed.
- `bun scripts/e2e-seller.mjs`: pass, seller mock path reached completed.

## Scope And Owner Searches

Changed source/test scope-drift command:

- `rg -n -i "Razorpay|real payments|payout setup|full KYC|admin expansion|demand discovery|category expansion" convex/listings.ts convex/__tests__/listingSubmission.test.ts src/lib/rules/evaluateRule.ts src/lib/rules/sourceRuleSelection.ts src/lib/rules/__tests__/evaluateRule.test.ts src/lib/rules/__tests__/sourceRuleSelection.test.ts`

Result:

- No matches in changed source/test files.

Broad search note:

- Broad search over product/test/config paths found pre-existing guard/comment/UI strings in `src/lib/auth/authAdapter.ts`, `src/pages/app/sell/orders.astro`, `scripts/ui-smoke-seller.mjs`, and `scripts/verify-first-visible-slice.mjs`; this slice did not modify those files.

Provider-id owner search:

- `rg -n "sellerId|buyerId|appUserId|providerUserId" convex/listings.ts convex/__tests__/listingSubmission.test.ts src/lib/rules/evaluateRule.ts src/lib/rules/sourceRuleSelection.ts`

Result:

- `convex/listings.ts` builds listing ownership from `seller.appUserId`.
- `convex/__tests__/listingSubmission.test.ts` asserts persisted `sellerId` equals `VERIFIED_APP_USER_ID` and does not equal `VERIFIED_PROVIDER_ID`.

## Beads Progress

- `scripts/beads-context.sh update-progress ...` timed out after 30 seconds for Task 1-2 progress.
- Direct `bd update` progress notes succeeded for Tasks 1-4.

## Ship Evidence

- Branch freshness check: `git rev-list --count HEAD..origin/master` returned `0`.
- `scripts/pr-coordinator.sh merge-sim "codex/source-rule-engine"` timed out after 60 seconds.
- `scripts/pr-coordinator.sh merge-order` timed out after 60 seconds.
- Branch push succeeded: `codex/source-rule-engine` now tracks `origin/codex/source-rule-engine`; pre-push typecheck passed.
- PR created: https://github.com/harshanandak/Zwapit/pull/12
- `scripts/pr-coordinator.sh auto-label zwapit-pkm` timed out after 30 seconds.
- Initial PR status: open, `mergeStateStatus=UNSTABLE` while GitHub checks were still in progress.
- Initial completed checks: Dependency audit success, CodeRabbit success.
- Initial pending checks: Type check, Build, Route coverage, Tests, Acceptance verification, Smoke tests, Cloudflare Preview, Android debug APK, and iOS simulator app.

## Next Stage

Review PR #12 after GitHub checks and review comments settle.
