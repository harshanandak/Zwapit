# Persisted Upload-First Seller Listing Submission Tasks

Date: 2026-06-04
Issue: zwapit-noq
Branch: feat/seller-listing-persistence

## Ownership

Claude does not start until Codex completes the backend contract and handoff notes. Codex must not implement Claude-owned UI except for narrow validation fixes after Claude handoff.

Codex-owned first:

- `convex/listings.ts`
- `convex/model.ts`
- `convex/schema.ts` only if a schema addition is required
- `convex/__tests__/listingSubmission.test.ts`
- `convex/__tests__/identity.test.ts` only for owner-boundary coverage gaps
- `src/lib/validation/sellerValidation.ts`
- `src/lib/validation/__tests__/sellerValidation.test.ts`
- `src/lib/rules/evaluateRule.ts` only if existing rule behavior has a proven gap
- `src/lib/rules/__tests__/evaluateRule.test.ts` only if rule behavior changes

Claude-owned after Codex handoff:

- `src/pages/app/sell/upload.astro`
- `src/pages/app/sell/confirm.astro`
- `src/pages/app/sell/price.astro`
- `src/pages/app/sell/promise.astro`
- `src/pages/app/sell/orders.astro`
- `src/components/seller/StepNav.astro`
- `src/components/seller/format.ts`

Shared serial handoff files:

- `src/lib/types.ts`
- `src/lib/convex/functionRefs.ts`
- `src/lib/convex/dataAdapter.ts`
- `src/lib/flow/mockFlow.ts`
- Any route contract or schema-related frontend type
- `package.json` only if a new script is explicitly justified

Codex validation-only after Claude handoff:

- `docs/work/2026-06-04-seller-listing-persistence/evidence.md`
- `docs/work/2026-06-04-seller-listing-persistence/evaluator-report.md`
- Narrow fixes in files touched by Claude only when a validation failure requires it
- Narrow fixes in Codex-owned backend files only when validation proves a backend defect

## Task 1 - Codex Implements Backend Submission Contract First

Files:

- `convex/listings.ts`
- `convex/model.ts`
- `convex/__tests__/listingSubmission.test.ts`
- `src/lib/validation/sellerValidation.ts`
- `src/lib/validation/__tests__/sellerValidation.test.ts`

RED:

- Add tests proving signed-out and phone-unverified seller submission fails.
- Add tests proving a verified seller creates a listing whose `sellerId` is the internal app user id.
- Add tests proving provider subject/id never becomes `listing.sellerId`.

GREEN:

- Add `submitSellerListingForCurrentUser` mutation.
- Derive seller from `requirePhoneVerifiedAppUser`.
- Validate required listing fields and source-rule compatibility.
- Insert/update the listing using existing listing state and rule decision contracts.

REFACTOR:

- Keep mapping helpers small and close to current Convex model patterns.
- Avoid broad schema churn unless a test proves it is required.

Acceptance:

- Verified seller can persist the first mock upload listing.
- Signed-out and unverified sellers cannot persist listings.
- Owner ids are internal app ids only.

## Task 2 - Codex Implements Rule, State, And Duplicate Behavior

Files:

- `convex/listings.ts`
- `convex/model.ts`
- `src/lib/validation/sellerValidation.ts`
- Relevant tests under `convex/__tests__` and `src/lib/validation/__tests__`

RED:

- Add tests for `AUTO_APPROVE`, `AUTO_BLOCK`, `AUTO_WAITLIST`, and `NEEDS_MANUAL_REVIEW` submission outcomes.
- Add a duplicate same-seller/same-fingerprint test.

GREEN:

- Apply existing source-rule evaluation to decide listing state.
- Persist `live`, `blocked`, `waitlist_only`, or `under_review` as appropriate.
- Use deterministic duplicate/update behavior for the first mock upload flow.

REFACTOR:

- Keep marketplace expansion out of this task. This only creates the submitted listing and makes it available to existing reads when eligible.

Acceptance:

- Rule outcomes map to listing states.
- Duplicate mock submissions do not create unbounded duplicate listings.

## Task 3 - Codex Hands Off Frontend Contract To Claude

Files:

- `src/lib/types.ts`
- `src/lib/convex/functionRefs.ts`
- `src/lib/convex/dataAdapter.ts`
- `docs/work/2026-06-04-seller-listing-persistence/evidence.md`

RED:

- Add adapter tests or type checks showing the UI can call the new submission contract without importing generated Convex API.

GREEN:

- Add function reference for the new mutation.
- Add a client adapter helper that submits the first-slice seller listing payload and falls back to the existing mock flow when Convex is absent.
- Document exact payload and response shape for Claude.

REFACTOR:

- Keep all shared file edits complete before Claude starts.

Acceptance:

- Claude has a stable helper to call.
- No route-level UI implementation is owned by Codex in this task.

## Task 4 - Claude Implements Seller UI Wiring After Codex Handoff

Files:

- `src/pages/app/sell/upload.astro`
- `src/pages/app/sell/confirm.astro`
- `src/pages/app/sell/price.astro`
- `src/pages/app/sell/promise.astro`
- `src/pages/app/sell/orders.astro`
- `src/components/seller/StepNav.astro`
- `src/components/seller/format.ts`

RED:

- Add or update seller e2e/smoke coverage showing the upload-first path reaches the protected submit action and handles success/failure UI states.

GREEN:

- Keep the current upload-first flow, using a mock upload signal rather than real file reading.
- Carry detected details and price through the step flow.
- Submit through the Codex-provided adapter helper at the seller promise step.
- Show friendly states for submitted, cannot list, waitlist only, needs review, signed-out, phone verification required, and unavailable Convex fallback.

REFACTOR:

- Keep UI copy friendly and mobile-first.
- Do not add admin review, payment, payout, KYC, demand, or category expansion UI.

Acceptance:

- Verified/demo seller path still works end-to-end.
- Blocked/unverified states are visible and friendly.
- Existing buyer e2e remains green.

## Task 5 - Codex Validation After Claude Handoff

Files:

- `docs/work/2026-06-04-seller-listing-persistence/evidence.md`
- `docs/work/2026-06-04-seller-listing-persistence/evaluator-report.md`
- Narrow source fixes only if validation proves they are required

Run and record:

- `bun run check`
- `bun test`
- `bun run build`
- `bun scripts/verify-first-visible-slice.mjs`
- `bun scripts/e2e-buyer.mjs`
- `bun scripts/e2e-seller.mjs`
- Scope-drift search for Razorpay, real payments, payout setup, full KYC, admin expansion, demand discovery, category expansion.
- Provider-id owner search proving provider ids are not listing/order/app data owner ids.

Acceptance:

- Validation evidence is fresh.
- Evaluator confirms Codex did not take Claude UI implementation ownership before Claude handoff.
- Any Codex fix is narrow, evidence-backed, and documented as validation-only.

## Hard Stop

After this plan commit is pushed, stop. Do not begin `/dev` until the user explicitly asks for the next stage.
