# Evidence - Phone Verification And Protected Action Gates Plan

Issue: `zwapit-12a`
Branch: `feat/phone-verification-gates`
Worktree: `.worktrees/phone-verification-gates`

## Commands And Results

- `git branch --show-current`: `master` before planning worktree creation.
- `bd worktree create .worktrees/phone-verification-gates --branch feat/phone-verification-gates`: created isolated worktree.
- `bd create ...`: created epic `zwapit-12a`.
- `bd update zwapit-12a --status in_progress ...`: set plan stage metadata and ownership metadata.
- `bash scripts/beads-context.sh stage-transition zwapit-12a none plan`: failed because CRLF line endings made `bash` see `pipefail\r`.
- `bd init --reinit-local --prefix zwapit --from-jsonl --skip-agents --skip-hooks --non-interactive`: recovered the worktree Beads database from `.beads/issues.jsonl`.
- `bun run check`: passed with existing CommonJS hints in dep-guard scripts.
- `bun test`: failed only on first-slice scope drift because Beads metadata changed in the planning worktree.

## Verified File References

- `src/lib/auth/authAdapter.ts:136`: action gate helper exists.
- `src/lib/auth/authAdapter.ts:146`: phone-verification-required state exists.
- `convex/schema.ts:121`: app users table exists.
- `convex/schema.ts:138`: user verification table exists.
- `convex/identity.ts:19`: buy and sell are phone-required actions.
- `src/pages/app/listings/[listingId].astro:19`: listing buy CTA requests phone verification.
- `src/pages/app/sell/index.astro:7`: sell upload CTA requests phone verification.
- `src/pages/app/checkout/[listingId].astro:75`: direct checkout mock pay path still needs protected execution gating.

## Beads State

- Issue `zwapit-12a`: `in_progress`.
- Metadata set: `forge_stage=plan`, `workflow_type=standard`, `implementation_owner=claude`, `validation_owner=codex`.

## Plan Commit Stop

After committing and pushing the plan artifacts, stop. No implementation is authorized in this turn.

---

# Implementation Handoff (Claude, Tasks 1-6)

Implementation owner: Claude. Validation owner after handoff: Codex.
This section was written by Claude after implementing Tasks 1-6. Codex has not
implemented any pre-handoff task and must begin only at Task 7 validation.

## Commits (branch `feat/phone-verification-gates`, worktree `.worktrees/phone-verification-gates`)

- `aeae767` `feat(auth): mock OTP verified-phone transition for buy/sell gates` (Tasks 1-2)
- `1b0d4c4` `feat(gates): block listing submission and checkout execution for unverified users` (Tasks 3-5)
- Plan commit (pre-existing, Codex/plan): `a88f063` `docs: plan phone verification gates`

Both implementation commits passed the lefthook `pre-commit` typecheck hook.

## Implemented Files

Task 1 - Adapter phone verification contract:
- `src/lib/auth/authAdapter.ts`: added `MockOtpVerificationResult`, pure
  `evaluateMockOtp(...)`, and `verifyPhoneWithMockOtp(state, code)` which flips a
  signed-in unverified state to verified (`verificationMode: "mock"`); signed-out
  rejected before verification; rejected OTP leaves state unchanged.
- `src/lib/auth/mockAuth.ts`: added `MOCK_OTP_CODE` (mock-only, no SMS).
- `src/lib/auth/__tests__/authAdapter.test.ts`: signed-out / signed-in-unverified /
  verified / mock-OTP-verified states for buy and sell.

Task 2 - Convex app user verification state:
- `convex/authModel.ts`: added `MOCK_OTP_CODE`, `MockOtpVerificationResult`,
  `evaluateMockOtp(...)` (pure, provider-abstracted; Clerk claim stays the live
  source of truth).
- `convex/identity.ts`: added `verifyPhoneWithMockOtp` mutation behind the identity
  boundary; on accept it patches `users.phoneVerified` and upserts
  `user_verifications.phoneVerified` with `verificationMode: "mock"`. It never
  writes `auth_identities`, so provider ids stay separate from app user ids.
- `convex/__tests__/authModel.test.ts`, `convex/__tests__/identity.test.ts`:
  mocked verification updates both records; wrong OTP stays unverified and gated.
- `convex/schema.ts`: NOT changed (`verificationMode: "mock"` already exists).

Task 3 - Protected listing submission gate:
- `src/lib/validation/sellerValidation.ts`: added `validateSellerSubmissionAccess`
  (new, additive; `validateSellerListing` signature unchanged).
- `src/lib/validation/__tests__/sellerValidation.test.ts`: allowed / signed-out /
  phone-unverified submission access.
- `src/pages/app/sell/{upload,confirm,price,promise}.astro`: gate progression /
  submission client-side via `gateProtectedActionLink`; promise (publish) keeps the
  seller-promise gate for verified users. Upload-first UX and route order preserved.
- `src/lib/convex/dataAdapter.ts`: added `resolvePhoneGateStatus`, `accountStepUrl`,
  `gateProtectedActionLink` (shared client gate, mirrors `me.astro`).

Task 4 - Protected checkout gate:
- `src/lib/validation/checkoutValidation.ts`: added `validateBuyerCheckoutAccess`
  (new, additive; `validateCheckout` signature unchanged).
- `src/lib/validation/__tests__/checkoutValidation.test.ts`: allowed / signed-out /
  phone-unverified checkout access.
- `src/pages/app/checkout/[listingId].astro`: pay button gated on verified-phone
  (fail-closed frontmatter default + client refine), friendly verify state, full
  price still shown before payment.
- `src/lib/convex/dataAdapter.ts`: `runMockCheckout` now maps the Convex identity-gate
  rejection to `PHONE_VERIFICATION_REQUIRED` / `AUTH_REQUIRED` blockers instead of an
  opaque `PERSISTENCE_WRITE_FAILED`.

Task 5 - Unverified user UI states:
- `src/pages/app/sell/index.astro`: phone-vs-sign-in aware copy, preserves `next`.
- `src/pages/app/checkout/[listingId].astro`: friendly auth/verify gate panel.
- `src/components/AuthActionGate.astro`, `src/pages/app/me.astro`,
  `src/pages/app/listings/[listingId].astro`: NOT changed — they already render the
  signed-out / phone-verification-required states and preserve the `next` intent
  (verified during this slice). No new landing page; no internal terms added.

## Where Enforcement Actually Lives (important for validation)

All default builds (CI, acceptance, prod) run with no `PUBLIC_CLERK_PUBLISHABLE_KEY`
(`.env.example`, CI workflows, `wrangler.jsonc` carry none) and Astro default static
output, so `.astro` frontmatter `createCurrentAuthState()` resolves to the mock
verified user. Frontmatter gating is therefore a build-time fail-closed default, not
per-user enforcement. Real per-user enforcement lives in:
1. Convex identity boundary — `requirePhoneVerifiedAppUser` already gates the
   `*ForCurrentUser` mutations (`convex/orders.ts:335,356`, etc.). This is the
   server-side execution gate; Tasks 1-6 did not modify `convex/orders.ts`/`listings.ts`.
2. Client scripts (the `me.astro` pattern) added in Tasks 3-5, which query the
   identity boundary (`getPhoneVerificationRequirement`) via the Clerk-authenticated
   Convex client and gate the pay/submission actions.

`verifyPhoneWithMockOtp` (adapter + Convex mutation) is the mocked arm of the
provider-abstracted verification contract, exercised by tests. The live UI verifies
through the Clerk provider claim (`syncAppUserFromProvider`); the mock mutation is
intentionally not wired to a screen (documented here so it is not flagged as dead code).

## Commands And Results

- `bun run check`: 0 errors, 0 warnings, 12 hints (pre-existing CommonJS hints in
  `scripts/dep-guard-*.js`). PASS.
- `bun test src convex` (unit/integration): 73 pass, 0 fail (baseline was 60).
- `bun test` (full, incl. acceptance build): 75 pass, 1 fail. The only failure is
  `first visible slice has no forbidden scope drift`.
- `bun run build`: 15 pages built. PASS.
- `bun scripts/verify-first-visible-slice.mjs`: route coverage PASS, acceptance
  criteria PASS; scope-drift FAILS only on `out-of-scope first-slice branch change:
  .beads/issues.jsonl`.
- `bun scripts/e2e-buyer.mjs`: PASS. `bun scripts/e2e-seller.mjs`: PASS.
- `bun scripts/ui-smoke-buyer.mjs`: PASS (5 routes). `bun scripts/ui-smoke-seller.mjs`: PASS (6 routes).

### Pre-existing scope-drift failure (not introduced by Tasks 1-6)

`verifyNoScopeDrift` allows only `.beads/team-map.jsonl` under `.beads/`. The plan
commit `a88f063` committed `.beads/issues.jsonl`, which appears in
`git diff master...HEAD`, so the scope-drift acceptance test fails on that file
regardless of Tasks 1-6. This matches the baseline recorded in `research.md`
("62 passed, 1 failed ... caused by plan-worktree Beads metadata changes"). All
Tasks 1-6 source/test changes are within allowed first-slice paths
(`src/lib/(auth|convex|validation)`, `src/pages/app`, `src/components`, `convex/`,
`docs/work/`). Resolving the `.beads/issues.jsonl` allowance is outside the scope of
Tasks 1-6 (the scanner lives in `scripts/`, owned by the first-slice task / Task 7).

## Scope-Drift Checks (excluded areas)

`grep -rInE "razorpay|stripe|payout setup|\bKYC\b|demand discovery|category expansion|real payment" src convex` (excluding tests):
- Only negative/explanatory comments found: `authAdapter.ts:153` ("Real SMS,
  Razorpay, KYC, payout ... out of scope"), `checkout/[listingId].astro:117,134`
  ("No real payment ... Mock checkout"), `schema.ts:143` (pre-existing: "No real
  payout/KYC fields"). No real-integration code, imports, or dependencies added.
- HTML scope-drift scan (forbidden user-facing terms + real-integration deps/imports)
  passed inside `verifyNoScopeDrift` — the sole failure was the git `.beads` check above.
- New user-facing copy ("Verify your phone to buy with protection", "Verify phone to
  continue", "Sign in to continue") contains no forbidden user-facing terms.

## Provider-id Check

- `verifyPhoneWithMockOtp` writes only `users`/`user_verifications` keyed by the
  internal `appUserId`; it never reads/writes `auth_identities` or uses
  `providerUserId`/`subject` as an owner id.
- Existing separation preserved: `convex/identity.ts:96,103` store `providerUserId`
  in `auth_identities` while `appUserId` is the separate internal id.
- Acceptance assertion `authSync.appUser.id !== authSync.authIdentity.providerUserId`
  (verify script) passed.

## Ownership Statement

Implementation for Tasks 1-6 is Claude-owned. Codex has not implemented any
pre-handoff task. Shared files were edited only by Claude in this slice. Codex may
begin Task 7 validation (and validation-only narrow fixes) after this handoff.
