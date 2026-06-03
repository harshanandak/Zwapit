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

## Notes For Codex (non-blocking)

- The new gating *logic* is unit-tested (`validateSellerSubmissionAccess`,
  `validateBuyerCheckoutAccess`, mock-OTP transition). The new *client* gate
  (`resolvePhoneGateStatus` / `gateProtectedActionLink`) only activates in
  Clerk-configured builds, which none of the validators here exercise (all run
  mock-verified). The demo/e2e flow is preserved; the server execution gate
  (`requirePhoneVerifiedAppUser`) is pre-existing. So treat buy/sell as
  gate-logic-tested, not runtime-verified-in-a-Clerk-build.
- `src/pages/app/sell/promise.astro` was modified although Task 3's OWNS list
  names only index/upload/confirm/price. It is the actual listing-submission
  (publish) point, so gating it is required to satisfy "submission blocked when
  signed-out or phone-unverified."
- Listing vs checkout asymmetry: `checkout/[listingId].astro` client-upgrades the
  gate, but `listings/[listingId].astro` relies on the frontmatter default
  (`AuthActionGate`) only. In a Clerk build a verified user may see "Sign in to
  continue" on the listing CTA until the `/app/me` hop. Functional; mild UX note.
- Client-gate race: a very fast click on a sell step before
  `resolvePhoneGateStatus()` resolves could navigate on the original href.
  Order-mutation paths are backstopped by the Convex gate; listing "publish" is
  navigation-only, so this is inherent to client-only gating.

## Beads Handoff

The worktree Beads/Dolt runtime would not connect during this session
(`database "zwapit" not found` on the per-project Dolt server; `bd doctor --fix`,
`bd dolt stop/start`, and `bd init --from-jsonl` did not materialize it, and this
`bd 0.62.0` build lacks CGO and did not honor `--non-interactive`). The Beads
comment could therefore not be written via `bd comments add`. The full handoff
comment is recorded in
`docs/work/2026-06-03-phone-verification-gates/beads-handoff-zwapit-12a.md`
(with the exact `bd comments add ... -f` command to apply it once the runtime is
recovered). This `evidence.md` is the durable Task 6 handoff artifact Codex reads
before Task 7.

## Task 7 Validation - Codex

Validation owner: Codex. Implementation for Tasks 1-6 remained Claude-owned.
Codex made one validation-only fix after reproducing the known scanner failure.

### Beads recovery

- Recovered the local worktree Beads runtime by importing the branch export:
  `bd init --reinit-local --prefix zwapit --from-jsonl --skip-agents --skip-hooks --non-interactive`.
- Applied the handoff comment:
  `bd comments add zwapit-12a -f docs/work/2026-06-03-phone-verification-gates/beads-handoff-zwapit-12a.md`.
- Set metadata with `bd update zwapit-12a --set-metadata validation_owner=codex --set-metadata forge_stage=validate --set-metadata implementation_complete=true`.

### Fresh validation results

- `bun run check`: PASS. Exit 0. Result: 0 errors, 0 warnings, 11 existing CommonJS hints.
- `bun test`: initially failed only on `first visible slice has no forbidden scope drift`.
  Exact reproduced failure: `out-of-scope first-slice branch change: .beads/issues.jsonl`.
- `bun scripts/verify-first-visible-slice.mjs`: initially failed only on
  `scope drift: out-of-scope first-slice branch change: .beads/issues.jsonl`.
- `bun run build`: PASS. Exit 0. Result: 0 errors, 0 warnings, 15 pages built.
- `bun scripts/e2e-buyer.mjs`: PASS. `Buyer e2e mock-path passed (Home -> Listing -> Checkout -> timeline -> completed).`
- `bun scripts/e2e-seller.mjs`: PASS. `Seller e2e mock-path passed (validate -> auto-approve -> transfer -> payout waiting -> completed).`

### Validation-only fix

Changed exactly one validator file:

- `scripts/verify-first-visible-slice.mjs`: added `.beads/issues.jsonl` to
  `allowedFirstSlicePaths`.

Reason this is validation-only: the plan commit `a88f063` intentionally added the
Beads issue export `.beads/issues.jsonl`, and the first-slice scanner was still
allowlisting only `.beads/team-map.jsonl`. No product behavior, auth gate logic,
payment logic, UI flow, Convex data model, or Claude-owned implementation file was
changed by Codex.

### Final rerun after fix

- `bun scripts/verify-first-visible-slice.mjs`: PASS. `First visible slice verification passed.`
- `bun test`: PASS. 76 pass, 0 fail, across 12 files.
- `bun run check`: PASS. Exit 0. Result: 0 errors, 0 warnings, 11 existing CommonJS hints.
- `bun run build`: PASS. Exit 0. Result: 15 pages built.
- `bun scripts/e2e-buyer.mjs`: PASS.
- `bun scripts/e2e-seller.mjs`: PASS.

### Scope and provider-id checks

- Scope search for `Razorpay`, real payments, payout setup, full KYC, admin
  expansion, demand discovery, and category expansion found only negative comments:
  `src/lib/auth/authAdapter.ts:153` and
  `src/pages/app/checkout/[listingId].astro:117,134`.
- Provider-id search confirmed provider subjects stay in `auth_identities.providerUserId`;
  app data ownership uses internal `appUserId`, `buyerId`, or `sellerId`.
- Verified guard references include `convex/identity.ts:128` for
  `requirePhoneVerifiedAppUser`, `convex/orders.ts:335` for guarded checkout, and
  `convex/orders.ts:356` for guarded seller claim.

## Review Follow-up - PR #8

Reviewer: CodeRabbit summary comment on PR #8.

Fixes applied:

- Added cross-reference comments beside duplicated `MOCK_OTP_CODE` constants in
  `src/lib/auth/mockAuth.ts` and `convex/authModel.ts`; the duplication remains
  intentional to preserve the client/Convex boundary.
- Updated `gateProtectedActionLink` in `src/lib/convex/dataAdapter.ts` to fail
  closed when Clerk is configured but Convex phone status resolves to `unknown`.
  Unknown status now routes protected navigation to the account/phone step.
- Replaced direct `element.textContent = label` in `gateProtectedActionLink` with
  a text-node-preserving helper so future child markup is not discarded.
- Narrowed `verifyPhoneWithMockOtp`'s Convex return validator to `mock` or
  `unverified`, matching the mock-only mutation's actual return values.

Validation after review fixes:

- Focused auth/identity tests: PASS. 21 pass, 0 fail.
- `bun run check`: PASS. 0 errors, 0 warnings, 11 existing CommonJS hints.
- `bun run build`: PASS. 15 pages built.
- `bun scripts/verify-first-visible-slice.mjs`: PASS.
- `bun scripts/e2e-buyer.mjs`: PASS.
- `bun scripts/e2e-seller.mjs`: PASS.
- `bun test`: PASS when rerun sequentially. 76 pass, 0 fail.

Note: one earlier `bun test` run failed because `bun run build` was started in
parallel and the acceptance test also invokes the build. The same full test suite
passed when rerun sequentially after the standalone build completed.

## Review Follow-up 2 - PR #8

Reviewer: CodeRabbit second pass on PR #8 after commit `fac9ce2`.

Fixes applied:

- `convex/identity.ts`: preserved an existing `user_verifications.verificationMode`
  on both rejected and accepted mock OTP attempts, so an already verified
  `clerk_phone` user is not relabeled as `mock`.
- `src/lib/auth/authAdapter.ts`: preserved an already verified adapter
  `verification.verificationMode` when mock OTP is accepted.
- `src/pages/app/checkout/[listingId].astro`: made listing unavailability win
  before auth/phone gating, so unavailable listings show the unavailable state
  instead of a sign-in/verify CTA.
- `docs/work/2026-06-03-phone-verification-gates/beads-handoff-zwapit-12a.md`:
  typed the fenced shell command block as `sh`.
- `docs/work/2026-06-03-phone-verification-gates/tasks.md`: added short
  `Design refs` lines under Tasks 1-7 without changing ownership or task text.
- `tests/acceptance/firstVisibleSlice.test.ts`: increased only the acceptance
  harness timeouts. This is validation-only: direct `bun run build` passed, but
  the nested build exceeded Bun's 60s hook timeout after Vite re-optimization,
  and the scope-drift verifier exceeded the 5s default once while the repo was
  dirty from review edits.

Validation after second review fixes:

- Focused auth/identity tests: PASS. 17 pass, 0 fail.
- `git diff --check`: PASS. Whitespace clean; Git reported CRLF conversion
  warnings only.
- `bun run check`: PASS. Exit 0. Result: 0 errors, 0 warnings, 11 existing
  CommonJS hints.
- `bun run build`: PASS. Exit 0. Result: 0 errors, 0 warnings, 15 pages built.
- `bun test`: PASS. 78 pass, 0 fail, across 12 files.
- `bun scripts/verify-first-visible-slice.mjs`: PASS. `First visible slice
  verification passed.`
- `bun scripts/e2e-buyer.mjs`: PASS. `Buyer e2e mock-path passed (Home ->
  Listing -> Checkout -> timeline -> completed).`
- `bun scripts/e2e-seller.mjs`: PASS. `Seller e2e mock-path passed (validate ->
  auto-approve -> transfer -> payout waiting -> completed).`

## Review Follow-up 5 - PR #8

Trigger: GitHub CI `Type check` failed on commit `9373250`.

Failure:

- `bunx tsc --project convex/tsconfig.json --noEmit` failed with
  `convex/__tests__/identity.test.ts(156,12): error TS18046: 'synced' is of type 'unknown'`
  and the same error on line 157.

Fix applied:

- `convex/__tests__/identity.test.ts`: cast the local `syncAppUserFromProvider`
  test result to the expected app-user/verification shape before property access.
  This is validation-only test typing, not product implementation.

Validation after CI typecheck fix:

- `bunx tsc --project convex/tsconfig.json --noEmit`: PASS. Exit 0.
- Focused auth/identity tests: PASS. 23 pass, 0 fail.
- `bun test`: PASS. 78 pass, 0 fail, across 12 files.

## Review Follow-up 4 - PR #8

Reviewer: new unresolved GitHub review thread on `src/pages/app/sell/upload.astro`
plus local validation harness behavior.

Additional fixes applied:

- `src/pages/app/sell/upload.astro`, `src/pages/app/sell/price.astro`, and
  `src/pages/app/sell/confirm.astro`: added a shared loading-window guard pattern
  so protected sell-step links prevent navigation until `gateProtectedActionLink`
  has resolved and rewritten the link when needed.
- `tests/acceptance/firstVisibleSlice.test.ts`: changed the nested build
  `spawnSync` call to `stdio: "ignore"` and kept the extended timeout. This is
  validation-only: the build itself was passing, but capturing the full
  PowerShell/Astro output made the nested build crawl and hit the hook timeout
  locally.

Validation after fourth review fixes:

- Focused auth/identity tests: PASS. 23 pass, 0 fail.
- `git diff --check`: PASS. Whitespace clean; Git reported CRLF conversion
  warnings only.
- `bun test`: PASS. 78 pass, 0 fail, across 12 files.
- `bun run check`: PASS. Exit 0. Result: 0 errors, 0 warnings, 11 existing
  CommonJS hints.
- `bun run build`: PASS. Exit 0. Result: 0 errors, 0 warnings, 15 pages built.
- `bun scripts/verify-first-visible-slice.mjs`: PASS. `First visible slice
  verification passed.`
- `bun scripts/e2e-buyer.mjs`: PASS. `Buyer e2e mock-path passed (Home ->
  Listing -> Checkout -> timeline -> completed).`
- `bun scripts/e2e-seller.mjs`: PASS. `Seller e2e mock-path passed (validate ->
  auto-approve -> transfer -> payout waiting -> completed).`

Environment note: during review validation, one direct `bun run build` failed
before code evaluation because Windows reported `There is not enough space on the
disk` while Vite was writing `node_modules/.vite/deps_temp_*`. Generated Vite,
Astro, and `dist` caches inside this repo/worktree were removed, after which the
same build command passed.

## Review Follow-up 3 - PR #8

Reviewer: unresolved GitHub review threads from CodeRabbit and automated Codex
review.

Additional fixes applied:

- `convex/identity.ts`: removed caller-supplied `expectedCode` from the Convex
  `verifyPhoneWithMockOtp` mutation args. The server-side mutation now evaluates
  only against the module-owned mock OTP constant.
- `convex/authModel.ts` and `convex/identity.ts`: allowed sync records to carry
  the persisted verification mode so provider sync does not downgrade a
  mock-verified app user back to unverified or relabel the source.
- `src/pages/app/sell/promise.astro`: made the protected seller publish handler
  fail closed while the async phone gate is still resolving.
- `src/pages/app/checkout/[listingId].astro`: treated `unknown` phone gate status
  as phone-verification-required for checkout UI gating.
- `convex/__tests__/identity.test.ts`: added regressions for ignored forged
  `expectedCode` fields and preserving mock verification across provider sync.

Validation after third review fixes:

- Focused auth/identity tests: PASS. 23 pass, 0 fail.
- `bun run check`: PASS. Exit 0. Result: 0 errors, 0 warnings, 11 existing
  CommonJS hints.
- `bun test`: PASS. 78 pass, 0 fail, across 12 files.
- `bun run build`: PASS. Exit 0. Result: 0 errors, 0 warnings, 15 pages built.
- `bun scripts/verify-first-visible-slice.mjs`: PASS. `First visible slice
  verification passed.`
- `bun scripts/e2e-buyer.mjs`: PASS. `Buyer e2e mock-path passed (Home ->
  Listing -> Checkout -> timeline -> completed).`
- `bun scripts/e2e-seller.mjs`: PASS. `Seller e2e mock-path passed (validate ->
  auto-approve -> transfer -> payout waiting -> completed).`
