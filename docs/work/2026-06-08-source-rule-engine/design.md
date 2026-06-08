# Source Rule Engine Hardening Design

## Feature

- Slug: source-rule-engine
- Date: 2026-06-08
- Beads issue: zwapit-pkm
- Status: planned
- Classification: Standard

## Purpose

Harden the source rule engine before listing marketplace work depends on it. The current code already has bundled rules, persisted Convex rules, seller submission wiring, and tests, but local evaluation and persisted evaluation can drift because key decision logic is duplicated.

## Success Criteria

- Local bundled rule evaluation and persisted Convex rule evaluation use the same decision semantics for required fields, eligibility fields, manual-review reasons, and price-rule outcomes.
- Latest-effective persisted source-rule selection is deterministic and unit-tested outside the mutation happy path.
- Seller listing submission continues to store the source rule id and version used at decision time.
- Checkout and order views continue to bind to the listing's stored `sourceRuleId` instead of silently re-evaluating against a newer rule.
- Existing visible mock flow, seller submission flow, phone gates, and native/web build setup remain green.
- Tests prove auto-approve, auto-block, waitlist-only, manual-review, missing required fields, price review, future-dated rules, and historical rule binding behavior.

## Out Of Scope

- Razorpay or any real payment provider.
- Real payments, callbacks, webhooks, refunds, or payout setup.
- Full KYC.
- Admin rule editor, manual review dashboard, or operator tooling.
- Demand discovery.
- Category expansion beyond currently modeled source/category enum values.
- Listing marketplace expansion, advanced search, or new buyer discovery surfaces.
- Real policy scraping or external source terms verification.

## Approach Selected

Codex will implement first because this is backend correctness and test ownership.

The dev slice should extract the reusable parts of rule evaluation into a shared rules module that both the local evaluator and Convex listing submission can call. Persisted rule selection should be a pure helper with tests, then `convex/listings.ts` should delegate to that helper instead of keeping local private logic.

Claude has no first-pass implementation task in this PR because no mobile-first screen, copy, or UX flow is planned. If implementation later exposes a necessary friendly UI state, Claude must receive a separate serial handoff after Codex finishes backend/test work.

## Constraints

- Do not change `SourceRule` or `MockListing` shapes unless a failing test proves the current shape cannot satisfy the contract.
- Do not modify payment, payout, KYC, admin, demand, or category-expansion areas.
- Preserve internal app user id ownership rules.
- Preserve current user-facing wording and avoid exposing internal statuses such as AMBER.
- Preserve the static/mock fallback used by local builds without Convex.
- Shared files require serial handoff and must not be edited by Codex and Claude at the same time.

## Edge Cases

- No persisted rule for a seller draft: keep `SOURCE_RULE_NOT_FOUND`; do not fallback to a bundled rule at mutation time.
- Future-dated persisted rule: ignore until effective.
- Multiple effective persisted rules: choose deterministically by highest version, with a documented tie policy if needed.
- Missing required or eligibility fields: auto-approve becomes manual review; blocked and waitlist decisions remain blocked/waitlist.
- Price above the configured cap: auto-approve becomes manual review.
- Listing already stored with an older sourceRuleId/version: checkout and order reads should use the stored rule key, not latest source/category lookup.

## Acceptance Gates

- `bun run check`
- `bun test`
- `bun run build`
- `bun scripts/verify-first-visible-slice.mjs`
- `bun scripts/e2e-buyer.mjs`
- `bun scripts/e2e-seller.mjs`
- Scope-drift search for Razorpay, real payments, payout setup, full KYC, admin expansion, demand discovery, and category expansion.
- Provider-id owner search proving provider ids are not used as listing/order/app owner ids.

## Ownership

Codex-owned implementation files:

- `src/lib/rules/evaluateRule.ts`
- `src/lib/rules/sourceRuleSelection.ts` (new, if extraction is used)
- `src/lib/rules/__tests__/evaluateRule.test.ts`
- `src/lib/rules/__tests__/sourceRuleSelection.test.ts` (new, if extraction is used)
- `convex/listings.ts`
- `convex/__tests__/listingSubmission.test.ts`

Claude-owned implementation files:

- None in this PR.

Shared files requiring serial handoff if touched:

- `src/lib/types.ts`
- `convex/schema.ts`
- `convex/seed.ts`
- `package.json`
- routing files
- shared constants used by UI pages

Codex validation files:

- `docs/work/2026-06-08-source-rule-engine/evidence.md`
- `docs/work/2026-06-08-source-rule-engine/evaluator-report.md`
- Any narrow validation-only fix files, only if a gate fails and the fix is not new scope.

## Ambiguity Policy

Use the Forge decision gate rubric during `/dev`. If implementation confidence is at least 80%, proceed and record the decision in `decisions.md`. If confidence is below 80%, stop and ask before expanding scope.

## Hard Stop

After the plan commit, stop. Do not implement source changes until the user explicitly starts `/dev` or asks for implementation.
