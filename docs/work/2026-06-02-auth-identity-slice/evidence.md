# Auth And Identity Slice Evidence

Issue: `zwapit-skf`

## Plan Creation Evidence

- Branch: `codex/zwapit-auth-identity-plan`
- Work folder: `docs/work/2026-06-02-auth-identity-slice`
- Beads issue: `zwapit-skf`
- Source files read:
  - `AGENTS.md`
  - `CLAUDE.md`
  - `src/lib/auth/authAdapter.ts`
  - `src/lib/auth/mockAuth.ts`
  - `convex/schema.ts`
  - `convex/orders.ts`
  - `src/pages/app/listings/[listingId].astro`
  - `docs/work/2026-06-01-convex-persistence-slice/*`

## Verified Existing Code Anchors

- Adapter functions exist in `src/lib/auth/authAdapter.ts`.
- Mock user id is `user_demo_1` in `src/lib/auth/mockAuth.ts`.
- Convex tables already include `users`, `auth_identities`, and `user_verifications`.
- Persisted order data already uses `buyerId` and `sellerId` app-id shaped fields.
- Current buy action links from listing detail to checkout.

## Evaluator Review

- Evaluator report written at `docs/work/2026-06-02-auth-identity-slice/evaluator-report.md`.
- Planning gaps fixed in `design.md` and `tasks.md`.

## Forge Context And Baseline Gates

- `bash scripts/beads-context.sh set-design zwapit-skf ...`: passed.
- `bash scripts/beads-context.sh set-acceptance zwapit-skf ...`: passed.
- `bash scripts/dep-guard.sh store-contracts zwapit-skf ...`: passed.
- `bash scripts/beads-context.sh stage-transition zwapit-skf plan dev ...`: passed.
- `bash scripts/beads-context.sh validate zwapit-skf`: all context fields present.
- `bash scripts/dep-guard.sh check-ripple zwapit-skf`: no conflicts detected.
- `bun run check`: 0 errors, 0 warnings, 11 hints.
- `bun test`: 50 pass, 0 fail, 153 assertions.
- `bun scripts/verify-first-visible-slice.mjs`: passed; checked 15 contract routes.
- Plan term check confirmed ownership, handoff, identity, phone verification, and hard exclusion coverage in the docs/work artifacts.

## Pending For `/dev`

- Run TDD implementation from `tasks.md`.
- Codex completes Tasks 1-4 and writes Task 6 handoff evidence.
- Claude starts Task 5 only after Task 6 evidence exists.
- Codex runs Task 7 validation before ship.

## Task 6 Backend Contract Handoff

Codex backend contract is ready for UI auth states.

Adapter shape:

- `createMockAuthState()` preserves the local demo user.
- `createSignedOutAuthState()` returns the signed-out gate state.
- `createClerkAuthState(...)` normalizes Clerk provider subject into a separate `authIdentity.providerUserId`.
- `getAuthActionState(action, href, state, options)` returns `allowed`, `sign_in_required`, or `phone_verification_required`.
- `requireUser(...)` throws `AUTH_REQUIRED`.
- `requirePhoneVerified(...)` throws `PHONE_VERIFICATION_REQUIRED`.

Convex functions:

- Clerk provider configuration proof boundary: no active `convex/auth.config.ts` is committed because no Clerk issuer domain exists in the local Convex dev deployment yet; adding that file before the Clerk app exists blocks `convex codegen` by requiring `CLERK_JWT_ISSUER_DOMAIN`.
- `identity:syncAppUserFromProvider` syncs Clerk identity into `users`, `auth_identities`, and `user_verifications`.
- `identity:getCurrentAppUser` returns the mapped app user or `null`.
- `identity:getPhoneVerificationRequirement` returns the shape-only phone requirement.
- `identity:requirePhoneVerifiedForAction` validates phone requirement without OTP/KYC.
- `orders:sellerSubmitTransferForCurrentUser`, `orders:buyerConfirmTransferForCurrentUser`, and `orders:buyerReportIssueForCurrentUser` guard actor identity before using the existing state machine.

Allowed UI handoff:

- Buy and sell action gates may render the default allowed link from `getAuthActionState`.
- Signed-out state should point users toward `/app/me?next=<target>`.
- Phone-verification-required state should point users toward `/app/me?next=<target>`.
- No checkout/payment/payout/KYC/admin/demand/category surfaces may be added.

Handoff verification:

- `bun test src/lib/auth/__tests__/authAdapter.test.ts convex/__tests__/authModel.test.ts`: 8 pass, 0 fail.
- `bunx tsc --project convex/tsconfig.json --noEmit`: passed.

## `/dev` Implementation Evidence

Implemented:

- Adapter states for mock, signed-out, Clerk-shaped authenticated, and phone-verification-required auth.
- Convex identity model helpers that keep provider subjects separate from internal app ids.
- Schema support for `clerk`, `clerk_phone`, and `unverified` identity/verification records.
- `identity:*` Convex functions for app user sync, current app user lookup, and phone requirement shape.
- Guarded current-user order mutations for seller transfer submission, buyer confirmation, and buyer issue reporting.
- UI action gate component around existing buy/sell links while preserving default mock-visible behavior.

Fresh verification:

- RED evidence: `bun test src/lib/auth/__tests__/authAdapter.test.ts convex/__tests__/authModel.test.ts` failed before implementation with missing `createClerkAuthState` and missing `convex/authModel`.
- GREEN evidence: `bun test src/lib/auth/__tests__/authAdapter.test.ts convex/__tests__/authModel.test.ts`: 8 pass, 0 fail, 30 assertions.
- `bunx convex codegen`: passed after removing active `auth.config.ts` proof-boundary config.
- `bunx tsc --project convex/tsconfig.json --noEmit`: passed.
- `bun run check`: 0 errors, 0 warnings, 11 hints.
- `bun run build`: 15 pages built.
- `bun test`: 58 pass, 0 fail, 183 assertions.
- `bun scripts/verify-first-visible-slice.mjs`: passed, checked 15 contract routes.
- `bun scripts/e2e-buyer.mjs`: passed.
- `bun scripts/e2e-seller.mjs`: passed.

## `/validate` Evidence

- Branch freshness: `HEAD..origin/master` = 0.
- `bun run check`: 0 errors, 0 warnings, 11 hints.
- `bunx convex codegen`: generated bindings and ran TypeScript successfully.
- `bunx tsc --project convex/tsconfig.json --noEmit`: passed.
- `bun test`: 58 pass, 0 fail, 183 assertions.
- `bun run build`: 15 pages built.
- `bun scripts/verify-first-visible-slice.mjs`: passed, checked 15 contract routes.
- `bun scripts/e2e-buyer.mjs`: passed.
- `bun scripts/e2e-seller.mjs`: passed.
- `bun audit`: no vulnerabilities found.
- Scope grep reviewed: Clerk/provider identity references are in auth boundary code/tests/docs; excluded Razorpay/payment/payout/KYC/admin/demand/category references are only hard-exclusion docs or existing guard text.

## `/ship` Evidence

- Branch pushed: `codex/zwapit-auth-identity-plan`.
- Pull request created: `https://github.com/harshanandak/Zwapit/pull/7`.
- PR title: `feat: add auth identity boundary`.
- Beads issue: `zwapit-skf`.

## `/review` Evidence

- GitHub checks were fetched with `gh pr checks 7 --repo harshanandak/Zwapit`.
- Review thread found in `convex/identity.ts`: phone verification incorrectly treated a non-empty phone number as verified.
- Fix: `identity:syncAppUserFromProvider` now marks phone verified only when Convex auth identity includes `phoneNumberVerified === true`.
- Regression: `convex/__tests__/authModel.test.ts` covers unverified phone-number claims.
- Fresh verification after review fix:
  - `bun test convex/__tests__/authModel.test.ts`: 5 pass, 0 fail, 17 assertions.
  - `bunx convex codegen`: generated bindings and ran TypeScript successfully.
  - `bunx tsc --project convex/tsconfig.json --noEmit`: passed.
  - `bun run check`: 0 errors, 0 warnings, 11 hints.
  - `bun test`: 59 pass, 0 fail, 186 assertions.
  - `bun run build`: 15 pages built.
  - `bun scripts/verify-first-visible-slice.mjs`: passed, checked 15 contract routes.
  - `bun scripts/e2e-buyer.mjs`: passed.
  - `bun scripts/e2e-seller.mjs`: passed.
  - `bun audit`: no vulnerabilities found.
