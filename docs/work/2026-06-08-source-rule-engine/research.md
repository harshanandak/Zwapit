# Source Rule Engine Research

Date: 2026-06-08
Issue: zwapit-pkm
Branch: codex/source-rule-engine
Worktree: .worktrees/source-rule-engine
Status: plan research

## Scope Anchor

- `AGENTS.md` and `CLAUDE.md` put the next build-order item at step 7, Source rule engine, after upload-first seller flow and before listing marketplace, buyer checkout, order timeline, payments, admin, demand discovery, and category expansion.
- This slice must not add Razorpay, real payments, payout setup, full KYC, admin expansion, demand discovery, or category expansion.
- Codex owns backend correctness, state machines, schema validation, edge cases, tests, refactoring, and code review.
- Claude owns mobile-first UI and friendly wording. This slice has no planned UI implementation, so Claude has no first-pass implementation ownership.

## Current Implementation Findings

- `src/lib/types.ts:89` defines `SourceRule` with source/category keys, decision, internal status, transfer mode, required fields, eligibility fields, price rule, payout policy, blocked behavior, rule versioning, and verification metadata.
- `src/lib/types.ts:118` defines `MockListing`, and each listing stores `sourceRuleId`, `sourceRuleVersion`, `sourceCategoryKey`, `state`, and `ruleDecision`.
- `src/lib/rules/sourceRules.ts:3` through `src/lib/rules/sourceRules.ts:123` defines four bundled first-slice source rules: BookMyShow event, manual watcher block, District movie waitlist, and other-platform event manual review.
- `src/lib/rules/evaluateRule.ts:36` classifies source/category pairs, `src/lib/rules/evaluateRule.ts:55` selects a bundled rule by sourceCategoryKey, and `src/lib/rules/evaluateRule.ts:84` evaluates a local rule decision.
- `convex/schema.ts:150` defines the persisted `source_rules` table with source/category/version, rule decision, status, transfer mode, transferability, protection, required fields, eligibility fields, and price rules.
- `convex/listings.ts:66` duplicates persisted rule decision logic instead of using the local evaluator path.
- `convex/listings.ts:135` selects the latest persisted source rule by version while ignoring future `effectiveFrom` values.
- `convex/listings.ts:281` uses persisted `source_rules` during seller listing submission and throws `SOURCE_RULE_NOT_FOUND` if no rule exists.
- `convex/orders.ts:85` and `convex/orders.ts:164` load the listing's stored `sourceRuleId` by key for checkout and order timeline views.
- `docs/RULE_ENGINE.md:6` defines the source rule contract and `docs/RULE_ENGINE.md:31` lists system decision outputs.
- `docs/SOURCE_RULES.md:172` says each source rule must store rule id, source enum, category enum, version, status, effective-from, last-verified-at, verification source/note, and creator.

## Existing Test Coverage

- `src/lib/rules/__tests__/evaluateRule.test.ts` covers local bundled rule outcomes, price rules, required fields, blank text, invalid numeric fields, and metadata.
- `convex/__tests__/listingSubmission.test.ts:413` proves persisted source rule decisions override bundled local decisions.
- `convex/__tests__/listingSubmission.test.ts:442` proves latest effective persisted source-category rule selection ignores a future-dated rule.
- `convex/__tests__/listingSubmission.test.ts:502` proves persisted face-value cap overage moves submission under review.
- Baseline validation from this worktree:
  - `bun run check`: pass, 0 errors, 11 CommonJS hints.
  - `bun test`: pass, 111 tests.

## Gaps For This PR

- Local source-rule evaluation and Convex persisted-rule evaluation share concepts but not one implementation path. The duplicated decision logic can drift in missing-field, manual-review, and price-rule behavior.
- Persisted source-rule selection is private to `convex/listings.ts`, which makes it harder to test independently and reuse consistently.
- Checkout/order reads load the listing's stored rule key, but this plan should preserve that historical rule binding rather than re-evaluating against latest rules.
- The slice should harden the contract and tests before listing marketplace work depends on it.

## OWASP Notes

- A01 Broken Access Control: applies indirectly because source rules decide whether a listing can become purchasable. Mitigation: keep listing submission behind existing `requirePhoneVerifiedAppUser`, preserve server-side validation, and test blocked/waitlist/manual-review outcomes.
- A04 Insecure Design: applies because rule drift can allow unsupported listings to become live. Mitigation: remove duplicated decision paths and add parity tests for local and persisted rules.
- A08 Software/Data Integrity Failures: applies because persisted source rules are data-driven policy. Mitigation: deterministic latest-effective selection, historical listing rule binding, and metadata validation tests.
- A03 Injection: low direct risk in this slice because no dynamic SQL or user-authored rule expressions are added.

## Baseline Gate

Baseline is green enough for `/dev`:

- `bun run check` passed with 0 errors.
- `bun test` passed with 111 tests.

`bun run build`, first-visible verifier, and e2e scripts are planned validation gates after implementation.
