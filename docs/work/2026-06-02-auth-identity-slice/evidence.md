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
- Fresh review found another unresolved Codex thread:
  - `src/lib/convex/dataAdapter.ts`: Clerk-configured paths called current-user mutations, but the Convex client did not provide a Clerk JWT and no `syncAppUserFromProvider` call existed in `src/`.
- Fix:
  - `src/lib/convex/client.ts` now installs an optional `ConvexClient.setAuth(...)` token fetcher when Clerk auth is configured, using `window.Clerk.session.getToken({ template: "convex" })` when a Clerk runtime is present.
  - Guarded data-adapter mutation paths now call `identity:syncAppUserFromProvider` before current-user checkout/timeline/issue mutations.
- Source checked: Convex docs for Clerk integration and `ConvexClient.setAuth` token behavior.
- Fresh verification after token wiring fix:
  - `bun run check`: 0 errors, 0 warnings, 11 hints.
  - `bun test src/lib/convex/__tests__/dataAdapter.test.ts src/lib/auth/__tests__/authAdapter.test.ts`: 13 pass, 0 fail, 34 assertions.
  - `bunx convex codegen`: generated bindings and ran TypeScript successfully.
  - `bunx tsc --project convex/tsconfig.json --noEmit`: passed.
  - `bun run build`: 15 pages built.
  - `bun test`: 63 pass, 0 fail, 204 assertions.
  - `bun scripts/verify-first-visible-slice.mjs`: passed, checked 15 contract routes.
  - `bun scripts/e2e-buyer.mjs`: passed.
  - `bun scripts/e2e-seller.mjs`: passed.
  - `bun audit`: no vulnerabilities found.
- Fresh CodeRabbit follow-up comments after commit `026b316`:
  - `convex/orders.ts`: `mockCheckoutForCurrentUser` incorrectly patched both `buyerId` and `sellerId` to the authenticated buyer.
  - `convex/orders.ts`: `advanceTimelineForCurrentUser` read and branched on order state before requiring an authenticated app user.
  - `src/lib/convex/dataAdapter.ts`: seller-scoped transfer submission refreshed through the buyer order read.
  - `src/pages/app/me.astro`: `next` checked the raw query value before URL normalization.
- Fix:
  - `mockCheckoutForCurrentUser` now rebinds only `buyerId`, preserving the existing seller boundary.
  - `advanceTimelineForCurrentUser` calls `requireAuthenticatedAppUser(ctx)` before order lookup/state branching.
  - `runAdvanceTimeline` tracks the seller-scoped guarded transfer path and refreshes through `getSellerOrders` for that path.
  - `/app/me` normalizes `next` with the URL API and enforces same-origin `/app/` pathname before assigning the continuation link.
- Focused verification after these fixes:
  - `bunx tsc --project convex/tsconfig.json --noEmit`: passed.
  - `bun test src/lib/convex/__tests__/dataAdapter.test.ts src/lib/auth/__tests__/authAdapter.test.ts convex/__tests__/identity.test.ts`: 16 pass, 0 fail, 46 assertions.
  - `bun run check`: 0 errors, 0 warnings, 11 hints.
- Full verification after these fixes:
  - `bunx convex codegen`: generated bindings and ran TypeScript successfully.
  - `bun run build`: 15 pages built.
  - `bun test`: 63 pass, 0 fail, 204 assertions.
  - `bun scripts/verify-first-visible-slice.mjs`: passed, checked 15 contract routes.
  - `bun scripts/e2e-buyer.mjs`: passed.
  - `bun scripts/e2e-seller.mjs`: passed.
  - `bun audit`: no vulnerabilities found.
- Fresh Codex follow-up comments after commit `92077ba`:
  - `convex/orders.ts`: `mockCheckoutForCurrentUser` required auth but did not enforce `phoneVerified` at the backend boundary.
  - `src/lib/convex/client.ts`: Clerk-configured mode installed a Convex token callback but had no Clerk runtime loader, so `window.Clerk` could remain missing.
- Fix:
  - `convex/identity.ts` now exposes `requirePhoneVerifiedAppUser`, reusing the existing `PHONE_VERIFICATION_REQUIRED` boundary.
  - `mockCheckoutForCurrentUser` now uses `requirePhoneVerifiedAppUser`, so buy checkout is blocked server-side for unverified authenticated users.
  - `src/lib/auth/authAdapter.ts` exposes the configured Clerk publishable key through the auth adapter.
  - `src/lib/convex/client.ts` lazily loads ClerkJS from the configured public key before asking Clerk for the Convex token. No package or lockfile dependency was added.
- Focused verification after these fixes:
  - `bunx tsc --project convex/tsconfig.json --noEmit`: passed.
  - `bun test convex/__tests__/identity.test.ts src/lib/auth/__tests__/authAdapter.test.ts src/lib/convex/__tests__/dataAdapter.test.ts`: 16 pass, 0 fail, 46 assertions.
  - `bun run check`: 0 errors, 0 warnings, 11 hints.
- Full verification after these fixes:
  - `bunx convex codegen`: generated bindings and ran TypeScript successfully.
  - `bun run build`: 15 pages built.
  - `bun audit`: no vulnerabilities found.
  - `bun test`: 63 pass, 0 fail, 204 assertions.
  - `bun scripts/verify-first-visible-slice.mjs`: passed, checked 15 contract routes.
  - `bun scripts/e2e-buyer.mjs`: passed.
  - `bun scripts/e2e-seller.mjs`: passed.
- Fresh Codex/CodeRabbit follow-up comments after commit `43956d3`:
  - `src/lib/convex/dataAdapter.ts`: Clerk-configured seller timeline still used a seeded `seller_demo_1` owner, so a signed-in seller could see the demo order but fail `SELLER_ACTOR_REQUIRED`.
  - `src/lib/convex/dataAdapter.ts`: seller refresh used the first seller order row instead of matching the mutated order id.
- Fix:
  - `convex/orders.ts` now exposes `claimDemoSellerOrderForCurrentUser`, gated by `requirePhoneVerifiedAppUser`, to bind only the demo seller order to the current internal app user.
  - `convex/orders.ts` now exposes `getSellerOrdersForCurrentUser` and shares seller-order collection logic with the existing demo read.
  - `src/lib/convex/dataAdapter.ts` claims the demo seller order before current-user seller reads/submissions and refreshes the seller result by matching `state.order.id`.
  - `src/lib/convex/functionRefs.ts` includes the new current-user seller read/claim function references.
- Focused verification after these fixes:
  - `bunx tsc --project convex/tsconfig.json --noEmit`: passed.
  - `bun test src/lib/convex/__tests__/dataAdapter.test.ts convex/__tests__/identity.test.ts src/lib/auth/__tests__/authAdapter.test.ts`: 16 pass, 0 fail, 46 assertions.
  - `bun run check`: 0 errors, 0 warnings, 11 hints.
- Full verification after these fixes:
  - `bunx convex codegen`: generated bindings and ran TypeScript successfully.
  - `bun run build`: 15 pages built.
  - `bun audit`: no vulnerabilities found.
  - `bun test`: 63 pass, 0 fail, 204 assertions.
  - `bun scripts/verify-first-visible-slice.mjs`: passed, checked 15 contract routes.
  - `bun scripts/e2e-buyer.mjs`: passed.
  - `bun scripts/e2e-seller.mjs`: passed.
- Fresh Codex follow-up comment after commit `0a768db`:
  - `src/lib/convex/dataAdapter.ts`: Clerk-configured buyer order hydration still used the public `orders:getBuyerOrder` query after checkout, so another browser could read the claimed demo buyer order.
- Fix:
  - `convex/orders.ts` now exposes `getBuyerOrderForCurrentUser`, requiring an authenticated app user and returning `null` unless the persisted order buyer matches that internal app user.
  - `src/lib/convex/dataAdapter.ts` uses `getBuyerOrderForCurrentUser` for Clerk-configured buyer load, checkout refresh, and buyer timeline refresh.
  - `src/lib/convex/functionRefs.ts` includes the new current-user buyer read reference.
- Focused verification after this fix:
  - `bunx tsc --project convex/tsconfig.json --noEmit`: passed.
  - `bun test src/lib/convex/__tests__/dataAdapter.test.ts convex/__tests__/identity.test.ts src/lib/auth/__tests__/authAdapter.test.ts`: 16 pass, 0 fail, 46 assertions.
  - `bun run check`: 0 errors, 0 warnings, 11 hints.
- Full verification after this fix:
  - `bunx convex codegen`: generated bindings and ran TypeScript successfully.
  - `bun run build`: 15 pages built.
  - `bun audit`: no vulnerabilities found.
  - `bun test`: 63 pass, 0 fail, 204 assertions.
  - `bun scripts/verify-first-visible-slice.mjs`: passed, checked 15 contract routes.
  - `bun scripts/e2e-buyer.mjs`: passed.
  - `bun scripts/e2e-seller.mjs`: passed.
- Fresh Codex follow-up comments after commit `d0b290e`:
  - `src/pages/app/me.astro`: Clerk-configured gated CTAs still resumed directly without opening a sign-in step.
  - `src/lib/convex/dataAdapter.ts`: Clerk-denied current-user buyer reads fell back to stale local paid demo state.
  - `convex/orders.ts`: any phone-verified user could claim seller ownership after the order was paid.
- Fix:
  - `/app/me` now loads ClerkJS and opens Clerk sign-in before resuming the requested `/app/` target when a Clerk key is configured.
  - `loadBuyerOrderState` now returns a baseline unpaid demo state for Clerk-configured denied/error current-user reads instead of stale local paid state.
  - `claimDemoSellerOrderForCurrentUser` now only patches seller ownership while the demo order is still `checkout_pending` and `mock_unpaid`, unless the current user already owns the seller side.
- Focused verification after these fixes:
  - `bunx tsc --project convex/tsconfig.json --noEmit`: passed.
  - `bun test src/lib/convex/__tests__/dataAdapter.test.ts convex/__tests__/identity.test.ts src/lib/auth/__tests__/authAdapter.test.ts`: 16 pass, 0 fail, 46 assertions.
  - `bun run check`: 0 errors, 0 warnings, 11 hints.
- Full verification after these fixes:
  - `bunx convex codegen`: generated bindings and ran TypeScript successfully.
  - `bun run build`: 15 pages built.
  - `bun audit`: no vulnerabilities found.
  - `bun test`: 63 pass, 0 fail, 204 assertions.
  - `bun scripts/verify-first-visible-slice.mjs`: passed, checked 15 contract routes.
  - `bun scripts/e2e-buyer.mjs`: passed.
  - `bun scripts/e2e-seller.mjs`: passed.

## `/review` Follow-Up Evidence

- Fresh review found two unresolved Codex threads:
  - `src/components/AuthActionGate.astro`: gated CTAs routed to `/app/me?next=...`, but `/app/me` was only a placeholder.
  - `src/lib/convex/dataAdapter.ts`: Clerk-configured current-user mutations could reject the seeded demo order because owner ids remained mock fixture ids.
- Older CodeRabbit review body still had actionable planning/API-contract comments:
  - `docs/work/2026-06-02-auth-identity-slice/design.md`: missing alternatives considered and OWASP security analysis.
  - `convex/identity.ts`: missing return validators on identity functions.
- Fixes:
  - `/app/me` now preserves and resumes the `next` intent as an auth-step handoff surface without adding real Clerk UI.
  - `orders:mockCheckoutForCurrentUser` validates checkout, claims the demo order to the current internal app user, and then applies the mock pay transition.
  - `src/lib/convex/dataAdapter.ts` uses `mockCheckoutForCurrentUser` in Clerk-configured mode.
  - `identity:*` functions now declare return validators.
  - `design.md` now documents alternatives considered and OWASP A01/A04/A07 analysis.
- Fresh verification after follow-up review fixes:
  - `bunx convex codegen`: generated bindings and ran TypeScript successfully.
  - `bunx tsc --project convex/tsconfig.json --noEmit`: passed.
  - `bun test convex/__tests__/identity.test.ts src/lib/auth/__tests__/authAdapter.test.ts`: 8 pass, 0 fail, 34 assertions.
  - `bun run check`: 0 errors, 0 warnings, 11 hints.
  - `bun run build`: 15 pages built.
  - `bun test`: 63 pass, 0 fail, 204 assertions.
  - `bun scripts/verify-first-visible-slice.mjs`: passed, checked 15 contract routes.
  - `bun scripts/e2e-buyer.mjs`: passed.
  - `bun scripts/e2e-seller.mjs`: passed.
  - `bun audit`: no vulnerabilities found.
- Second review thread found in `src/pages/app/listings/[listingId].astro`: buy/sell UI gates did not pass the phone-verification-required option.
- Fix: every page-level `getAuthActionState("buy" | "sell", ...)` call now passes `{ requirePhoneVerified: true }`.
- Regression: `src/lib/auth/__tests__/authAdapter.test.ts` covers the phone-required buy state as well as sell.
- Fresh verification after second review fix:
  - `bun test src/lib/auth/__tests__/authAdapter.test.ts`: 4 pass, 0 fail, 17 assertions.
  - `rg -n "getAuthActionState\\(" src/pages`: all four page-level buy/sell gates include `{ requirePhoneVerified: true }`.
  - `bunx convex codegen`: generated bindings and ran TypeScript successfully.
  - `bunx tsc --project convex/tsconfig.json --noEmit`: passed.
  - `bun run check`: 0 errors, 0 warnings, 11 hints.
  - `bun run build`: 15 pages built.
  - `bun scripts/verify-first-visible-slice.mjs`: passed, checked 15 contract routes.
  - `bun test`: 59 pass, 0 fail, 187 assertions.
  - `bun scripts/e2e-buyer.mjs`: passed.
  - `bun scripts/e2e-seller.mjs`: passed.
  - `bun audit`: no vulnerabilities found.
- Third review thread found in `convex/identity.ts`: Convex identity endpoint auth gates lacked direct tests.
- Fix: added `convex/__tests__/identity.test.ts` with mocked Convex auth/db context coverage for unauthenticated gates, identity sync, current-user resolution, phone requirement status, unverified rejection, and verified action success.
- Fresh verification after third review fix:
  - `bun test convex/__tests__/identity.test.ts`: 3 pass, 0 fail, 12 assertions.
  - `bunx convex codegen`: generated bindings and ran TypeScript successfully.
  - `bunx tsc --project convex/tsconfig.json --noEmit`: passed.
  - `bun run check`: 0 errors, 0 warnings, 11 hints.
  - `bun test`: 62 pass, 0 fail, 199 assertions.
  - `bun run build`: 15 pages built.
  - `bun scripts/verify-first-visible-slice.mjs`: passed, checked 15 contract routes.
  - `bun scripts/e2e-buyer.mjs`: passed.
  - `bun scripts/e2e-seller.mjs`: passed.
  - `bun audit`: no vulnerabilities found.
- Fourth review thread found in `src/pages/app/listings/[listingId].astro`: page-level auth gates still passed `undefined`, which relied on the adapter's demo mock default.
- Fix: added `createCurrentAuthState()` and `isClerkAuthConfigured()`; pages now pass explicit auth state. No-Clerk local/demo mode remains mock-authenticated, while Clerk-configured mode defaults to signed-out until a real Clerk runtime supplies a user.
- Fifth review thread found in `src/lib/convex/functionRefs.ts`: visible Convex adapter writes could still use legacy role-based mutations.
- Fix: added `orders:advanceTimelineForCurrentUser`; `src/lib/convex/dataAdapter.ts` uses current-user guarded mutations when Clerk auth is configured and keeps legacy role-based mutations only for explicit no-Clerk demo compatibility.
- Fresh verification after fourth/fifth review fixes:
  - `bun test src/lib/auth/__tests__/authAdapter.test.ts convex/__tests__/identity.test.ts`: 8 pass, 0 fail, 34 assertions.
  - `rg -n "getAuthActionState\\(" src/pages`: all page-level buy/sell gates pass explicit `authState` plus `{ requirePhoneVerified: true }`.
  - `rg -n "sellerSubmitTransfer\\b|buyerReportIssue\\b|advanceTimeline\\b|ForCurrentUser" src/lib/convex/dataAdapter.ts src/lib/convex/functionRefs.ts`: guarded current-user mutations are used in Clerk-configured mode; legacy refs remain in demo fallback only.
  - `bunx convex codegen`: generated bindings and ran TypeScript successfully.
  - `bunx tsc --project convex/tsconfig.json --noEmit`: passed.
  - `bun run check`: 0 errors, 0 warnings, 11 hints.
  - `bun run build`: 15 pages built.
  - `bun test`: 63 pass, 0 fail, 204 assertions.
  - `bun scripts/verify-first-visible-slice.mjs`: passed, checked 15 contract routes.
  - `bun scripts/e2e-buyer.mjs`: passed.
  - `bun scripts/e2e-seller.mjs`: passed.
  - `bun audit`: no vulnerabilities found.
