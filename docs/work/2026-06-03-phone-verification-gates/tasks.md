# Phone Verification And Protected Action Gates Tasks

Issue: `zwapit-12a`
Plan owner: Codex
Implementation owner: Claude first
Validation owner after Claude handoff: Codex

## Hard Stop After Plan Commit

After committing and pushing these plan artifacts, stop. Do not implement any task in this file during `/plan`.

## Ownership Model

Claude implements Tasks 1-6 first. Codex must not implement those tasks.

Codex starts only at Task 7 after Claude handoff. Codex may make validation/fix changes only after Claude has completed implementation and handed off evidence.

Shared files requiring serial handoff:

- `src/lib/types.ts`
- `src/lib/auth/authAdapter.ts`
- `convex/schema.ts`
- `convex/identity.ts`
- `src/lib/convex/dataAdapter.ts`
- `src/components/AuthActionGate.astro`
- `src/pages/app/me.astro`
- `src/pages/app/checkout/[listingId].astro`
- `src/pages/app/listings/[listingId].astro`
- `src/pages/app/sell/index.astro`
- `package.json`

## Task 1 - Claude - Adapter Phone Verification Contract

Design refs: design.md#selected-approach, design.md#tdd-scenarios

OWNS:
- `src/lib/auth/authAdapter.ts`
- `src/lib/auth/mockAuth.ts`
- `src/lib/auth/__tests__/authAdapter.test.ts`
- `src/lib/types.ts` if type changes are required

TDD:
- RED: add tests for signed-out, signed-in unverified, signed-in verified, and mocked OTP-verified action states for buy and sell.
- GREEN: extend the adapter with a provider-abstracted or mocked OTP result shape and verified-phone state transition.
- REFACTOR: keep provider-specific fields out of route components.

Acceptance:
- `PHONE_VERIFICATION_REQUIRED` is produced only when a signed-in user is unverified.
- Mock OTP verification does not introduce real SMS, Razorpay, KYC, payout, or admin behavior.

## Task 2 - Claude - Convex App User Verification State

Design refs: design.md#selected-approach, design.md#owasp-review

OWNS:
- `convex/identity.ts`
- `convex/authModel.ts`
- `convex/schema.ts`
- `convex/__tests__/identity.test.ts`
- `convex/__tests__/authModel.test.ts`

TDD:
- RED: add tests proving mocked/provider verification updates `users.phoneVerified` and `user_verifications.phoneVerified`.
- GREEN: implement provider-abstracted or mock OTP verification functions behind the identity boundary.
- REFACTOR: keep `auth_identities.providerUserId` separate from app user ids.

Acceptance:
- Verified status is stored in app user and verification records.
- Provider ids are never used as listing, order, or app data owner ids.

## Task 3 - Claude - Protected Listing Submission Gate

Design refs: design.md#selected-approach, design.md#tdd-scenarios

OWNS:
- `src/pages/app/sell/index.astro`
- `src/pages/app/sell/upload.astro`
- `src/pages/app/sell/confirm.astro`
- `src/pages/app/sell/price.astro`
- `src/lib/validation/sellerValidation.ts`
- `src/lib/validation/__tests__/sellerValidation.test.ts`
- `src/lib/convex/dataAdapter.ts`

TDD:
- RED: add a test or route assertion that unverified users cannot submit or progress the protected sell action.
- GREEN: require verified-phone state before listing submission/progression.
- REFACTOR: keep upload-first UX and existing sell route order.

Acceptance:
- Sell entry remains delayed-login.
- Protected listing submission is blocked when the user is signed out or phone-unverified.

## Task 4 - Claude - Protected Checkout Gate

Design refs: design.md#selected-approach, design.md#owasp-review

OWNS:
- `src/pages/app/listings/[listingId].astro`
- `src/pages/app/checkout/[listingId].astro`
- `src/lib/validation/checkoutValidation.ts`
- `src/lib/validation/__tests__/checkoutValidation.test.ts`
- `src/lib/convex/dataAdapter.ts`

TDD:
- RED: add a test or route assertion that direct checkout access and mock pay cannot proceed for signed-out or unverified users.
- GREEN: enforce verified-phone state before checkout execution, not only before the listing-detail CTA.
- REFACTOR: preserve full price display before payment and current mock checkout behavior for verified users.

Acceptance:
- Direct `/app/checkout/:listingId` access is protected.
- No real payment provider logic is added.

## Task 5 - Claude - Unverified User UI States

Design refs: design.md#selected-approach, design.md#ambiguity-policy

OWNS:
- `src/components/AuthActionGate.astro`
- `src/pages/app/me.astro`
- `src/pages/app/sell/index.astro`
- `src/pages/app/listings/[listingId].astro`
- `src/pages/app/checkout/[listingId].astro`

TDD:
- RED: add UI or route assertions for signed-out and phone-verification-required states.
- GREEN: show friendly unverified states and preserve `next` intent.
- REFACTOR: keep copy user-facing and avoid internal terms like KYC, merchant, escrow, or settlement.

Acceptance:
- Unverified users understand the next action without a new landing page.
- UI remains mobile-first and action-oriented.

## Task 6 - Claude - Handoff Evidence For Codex

Design refs: design.md#ownership-boundary, design.md#shared-files-requiring-serial-handoff

OWNS:
- `docs/work/2026-06-03-phone-verification-gates/evidence.md`
- Beads comments on `zwapit-12a`

Required handoff:
- List implemented files and commits.
- Record test commands and results.
- Record scope-drift grep results for excluded areas.
- State that implementation was Claude-owned and Codex has not implemented pre-handoff tasks.

## Task 7 - Codex - Post-Handoff Validation And Narrow Fixes Only

Design refs: design.md#ownership-boundary, design.md#hard-stop

OWNS:
- `docs/work/2026-06-03-phone-verification-gates/evidence.md`
- `docs/work/2026-06-03-phone-verification-gates/evaluator-report.md`
- Beads comments or metadata on `zwapit-12a`
- Only the minimum implementation file needed if a validation failure requires a fix after Claude handoff

Run:
- `bun run check`
- `bun test`
- `bun run build`
- `bun scripts/verify-first-visible-slice.mjs`
- `bun scripts/e2e-buyer.mjs`
- `bun scripts/e2e-seller.mjs`
- Scope drift search for Razorpay, real payments, payout setup, full KYC, admin expansion, demand discovery, and category expansion.
- Provider-id search confirming Clerk/provider ids are not used as app data ids.

Acceptance:
- Codex validates only after Claude handoff.
- If fixes are needed, Codex records exact failure, exact file changed, and why the fix was validation-only.
- Evaluator report confirms no Codex implementation ownership was assigned before handoff.
