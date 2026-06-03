# Beads Handoff — zwapit-12a (Claude → Codex)

> The worktree Beads/Dolt runtime would not connect during this session
> (`database "zwapit" not found` on the per-project Dolt server; this `bd 0.62.0`
> build lacks CGO and `bd doctor --fix`, server restart, and `bd init --from-jsonl`
> did not materialize the DB; `--non-interactive` was not honored). The handoff
> below is therefore recorded here and in `evidence.md` (the defined Task 6
> handoff artifact). Apply it as a Beads comment once the runtime is recovered:
>
> ```sh
> bd comments add zwapit-12a -f docs/work/2026-06-03-phone-verification-gates/beads-handoff-zwapit-12a.md
> ```
> Then set stage metadata, e.g. `forge_stage=dev`/`implementation_complete=true`,
> and leave `validation_owner=codex`.

## Comment

Claude implemented Tasks 1-6 of the phone-verification gates slice. Codex has NOT
implemented any pre-handoff task; Codex begins at Task 7 (validation + validation-only
narrow fixes) now.

Commits on `feat/phone-verification-gates`:
- `aeae767` feat(auth): mock OTP verified-phone transition for buy/sell gates (Tasks 1-2)
- `1b0d4c4` feat(gates): block listing submission and checkout execution for unverified users (Tasks 3-5)
- `3dc2b22` docs(evidence): record Claude implementation handoff for Tasks 1-6 (Task 6)
- (plan commit, pre-existing: `a88f063`)

What changed:
- Task 1: `evaluateMockOtp` + `verifyPhoneWithMockOtp` (verified-phone transition) in
  `src/lib/auth/authAdapter.ts`; `MOCK_OTP_CODE` in `mockAuth.ts`. Mock-only, no SMS.
- Task 2: `verifyPhoneWithMockOtp` Convex mutation in `convex/identity.ts` + pure
  `evaluateMockOtp` in `convex/authModel.ts`; writes `users.phoneVerified` and
  `user_verifications.phoneVerified` (mode "mock"); never touches `auth_identities`.
  No schema change.
- Tasks 3-4: additive `validateSellerSubmissionAccess` / `validateBuyerCheckoutAccess`;
  client-side phone gate on sell step pages and checkout pay (mirrors `me.astro`);
  `runMockCheckout` maps the Convex identity-gate rejection to
  PHONE_VERIFICATION_REQUIRED/AUTH_REQUIRED. Existing validator signatures unchanged.
- Task 5: friendly signed-out / verify states on `sell/index` and `checkout`, `next`
  intent preserved, no internal terms, no new landing page.

Enforcement note: default builds carry no Clerk key, so `.astro` frontmatter is a
build-time fail-closed default. Real per-user enforcement = the existing Convex
`requirePhoneVerifiedAppUser` gate on `*ForCurrentUser` mutations
(`convex/orders.ts`, NOT modified) + the client scripts added here.
`verifyPhoneWithMockOtp` is the mocked arm of the provider-abstracted contract
(tested, not wired to a screen; live UI uses the Clerk provider claim).

Validation results (Claude):
- `bun run check`: 0 errors. `bun test src convex`: 73 pass / 0 fail.
- `bun test` (full): 75 pass / 1 fail. `bun run build`: 15 pages.
- `bun scripts/verify-first-visible-slice.mjs`: route coverage + acceptance PASS.
- e2e-buyer/seller PASS; ui-smoke buyer/seller PASS.

KNOWN pre-existing failure (NOT from Tasks 1-6): the scope-drift acceptance test
fails only on `out-of-scope first-slice branch change: .beads/issues.jsonl`, which the
plan commit `a88f063` committed and the scanner's allowlist (only `.beads/team-map.jsonl`)
rejects. Matches the `research.md` baseline. The scanner lives in `scripts/`
(first-slice/Task-7 territory), so resolving the allowance is outside Tasks 1-6.

Scope-drift / provider-id checks: no Razorpay/real-payment/payout-setup/KYC/admin/
demand/category code or deps added (only negative "out of scope" comments). Provider
ids remain separate from app user ids.
