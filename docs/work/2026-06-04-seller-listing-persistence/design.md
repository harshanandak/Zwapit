# Persisted Upload-First Seller Listing Submission Design

## Feature

- Slug: seller-listing-persistence
- Date: 2026-06-04
- Beads issue: zwapit-noq
- Status: planned
- Classification: Standard

## Purpose

Make the existing upload-first seller flow produce a persisted Convex listing owned by the current internal app user id, instead of ending in a static mock fixture. This keeps the v1 proof moving through build-order step 6 without expanding into payments, admin, demand discovery, or category expansion.

## Success Criteria

- A signed-in, phone-verified seller can submit the existing upload-first mock listing path and create or update a persisted listing in Convex.
- The persisted listing uses an internal `appUserId` as `sellerId`; provider ids stay only in `auth_identities`.
- Seller submission is blocked for signed-out or phone-unverified users at the mutation boundary.
- Source-rule outcome, price cap behavior, required fields, listing state, transfer mode, payout policy, and deadlines are derived through existing contracts.
- Local no-Convex/default builds keep the current visible mock flow working.
- Home/listing/checkout reads can show persisted eligible listings without breaking the seeded demo listing.
- Tests prove owner id boundaries, submission gates, rule outcomes, duplicate/update behavior, and fallback behavior.

## Out Of Scope

- Razorpay or any real payment provider.
- Real payments, callbacks, webhooks, refunds, or payout setup.
- Full KYC.
- Admin expansion or manual review dashboard.
- Demand discovery.
- Category expansion beyond the existing source-rule categories.
- Real file upload storage, OCR, or AI ticket parsing.
- High-value watcher marketplace or offline handoff workflows.

## Approach Selected

Use a Convex-owned seller listing submission contract with a mocked upload payload.

Codex first adds the backend mutation and tests:

- `submitSellerListingForCurrentUser` derives the seller from `requirePhoneVerifiedAppUser`.
- The mutation accepts a narrow first-slice listing draft payload, evaluates it against the existing source-rule contract, computes mock pricing/deadlines, validates seller listing requirements, and inserts or updates a listing record.
- The mutation returns the persisted listing view in the existing `MockListing` shape so the adapter and UI can evolve without broad type churn.

Claude then connects the existing mobile seller steps to that contract:

- Keep upload-first UX and mock file signal.
- Carry detected details, price, and seller promise through the current step sequence.
- Submit at the promise step and route to seller orders or the created listing state with friendly UI states.

## Constraints

- No provider id can be written as `listings.sellerId`.
- No real file, payment, payout, KYC, admin, demand, or category work.
- Keep the current static/mock fallback for builds without `PUBLIC_CONVEX_URL`.
- Preserve delayed-login UX: auth starts only when the seller takes the protected action.
- Use existing Zwapit user-facing language; avoid banned payment/admin/legal terms in UI.
- Shared files require serial handoff. Do not let Codex and Claude edit them in parallel.

## Edge Cases

- Signed-out user: mutation throws `AUTH_REQUIRED`; UI routes to account/verify step.
- Signed-in but phone-unverified user: mutation throws `PHONE_VERIFICATION_REQUIRED`; UI shows friendly verify state.
- Missing required listing fields: mutation returns or throws explicit validation codes; UI can show a friendly correction state.
- Rule `AUTO_BLOCK`: listing cannot become live; use blocked state and friendly Cannot List wording.
- Rule `AUTO_WAITLIST`: listing persists as waitlist-only, not purchasable.
- Rule `NEEDS_MANUAL_REVIEW`: persist `under_review`; do not build admin review.
- Duplicate same seller/mock upload: update the current draft or return existing listing deterministically, rather than creating unbounded duplicates.
- Convex unavailable in local default: adapter keeps the existing mock flow.

## Acceptance Gates

- `bun run check`
- `bun test`
- `bun run build`
- `bun scripts/verify-first-visible-slice.mjs`
- `bun scripts/e2e-buyer.mjs`
- `bun scripts/e2e-seller.mjs`
- Scope-drift search for payments, payout setup, full KYC, admin expansion, demand discovery, and category expansion.
- Provider-id search proving provider ids are not used as listing owner ids.

## Ambiguity Policy

Use the Forge decision gate rubric during `/dev`. If implementation confidence is at least 80%, proceed and record the decision in `decisions.md`. If confidence is below 80%, stop and ask the user before expanding scope.
