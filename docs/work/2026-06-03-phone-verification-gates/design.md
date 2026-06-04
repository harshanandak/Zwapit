# Phone Verification And Protected Action Gates Design

Issue: `zwapit-12a`
Date: 2026-06-03
Status: plan committed for Claude implementation

## Purpose

Plan the next Forge slice after the merged auth identity boundary. This slice turns the existing phone-verification shape into protected buy/sell action gates while keeping login delayed until the user starts a protected action.

## Success Criteria

- Buy and sell CTAs require sign-in and verified phone status before reaching protected actions.
- Listing submission and checkout paths reject unverified users through the auth adapter and Convex app user state.
- UI shows clear signed-out and phone-verification-required states without adding a landing page or redesigning the current mobile flow.
- OTP remains provider-abstracted or mocked only; no real SMS provider is introduced.
- Claude implements the slice first. Codex only validates after Claude handoff and may make validation/fix changes only after that handoff.

## Out Of Scope

- Razorpay or any real payment provider.
- Real payments, payment capture, refunds, payout setup, or payout release.
- Full KYC, admin expansion, demand discovery, category expansion, wallet, chat, or advanced search.
- Replacing Clerk or adding provider-specific OTP business logic outside an adapter/mocked boundary.

## Verified Current Context

- `AGENTS.md:3` and `CLAUDE.md:3` require scope discipline.
- `AGENTS.md:11` and `CLAUDE.md:11` require verified facts.
- `AGENTS.md:86` defines the sequence as mock user -> Convex data flow -> phone auth -> seller payout setup -> payments.
- `AGENTS.md:88` says phone verification is required later for buy/sell actions, and full KYC is not first-slice scope.
- `AGENTS.md:253` says Claude owns mobile-first UI, friendly wording, screen flow, component structure, form simplification, UX refinement, and frontend connection to Convex after schema exists.
- `AGENTS.md:255` says Codex owns backend correctness and validation surfaces, but this slice's user instruction overrides implementation ownership: Codex plans only, then validates after Claude implementation.
- `src/lib/auth/authAdapter.ts:136` already exposes `getAuthActionState(...)`.
- `src/lib/auth/authAdapter.ts:146` already reports `PHONE_VERIFICATION_REQUIRED` when phone verification is required and missing.
- `convex/schema.ts:121` stores app users, and `convex/schema.ts:138` stores user verification data.
- `convex/identity.ts:19` defines phone-required actions as buy and sell.
- `src/pages/app/listings/[listingId].astro:19` gates the buy CTA with `requirePhoneVerified: true`.
- `src/pages/app/sell/index.astro:7` gates the sell upload CTA with `requirePhoneVerified: true`.
- `src/pages/app/checkout/[listingId].astro:75` still exposes the mock pay button destination, so checkout itself needs a protected action gate, not only the listing-detail CTA.

## Selected Approach

Claude extends the existing adapter and Convex identity boundary rather than adding a parallel auth path.

The implementation should:

- Keep `src/lib/auth/authAdapter.ts` as the UI-facing action-gate contract.
- Keep `convex/identity.ts` as the provider-to-app-user and phone-verification boundary.
- Add a mocked/provider-abstracted OTP verification path that updates app user verification state without sending real SMS.
- Gate both navigation CTAs and protected action execution, especially checkout and listing submission.
- Preserve the existing mobile route structure and wording style.

## Ownership Boundary

Claude implements first. Claude-owned implementation files are listed in `tasks.md`.

Codex validation starts only after Claude handoff. Codex validation files are:

- `docs/work/2026-06-03-phone-verification-gates/evidence.md`
- `docs/work/2026-06-03-phone-verification-gates/evaluator-report.md`
- Beads comments or metadata for `zwapit-12a`

If validation fails after Claude handoff, Codex may create narrow validation/fix changes only for the failing gate and must record the fix in evidence.

## Shared Files Requiring Serial Handoff

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

These files must not be edited by Claude and Codex in parallel. Claude completes implementation first, then Codex validates.

## OWASP Review

- A01 Broken Access Control: protected checkout and listing submission must derive access from the current app user and phone verification state, not client-supplied ids.
- A04 Insecure Design: UI gates alone are insufficient; protected action execution must also reject unverified users.
- A07 Identification And Authentication Failures: phone number presence must not equal verification. Only explicit verified status from the adapter or mock OTP boundary can satisfy the gate.
- A09 Security Logging And Monitoring Failures: validation evidence must record which protected paths were checked and whether any bypass was found.

## TDD Scenarios

- Happy path: signed-in, phone-verified user can continue to sell upload/listing submission and checkout.
- Failure path: signed-out user is redirected to `/app/me?next=...` and protected actions do not execute.
- Failure path: signed-in but phone-unverified user sees the phone verification state and checkout/listing submission remains blocked.
- Edge case: mocked OTP verification updates `user_verifications.phoneVerified` and keeps provider ids out of app data ids.
- Scope guard: no Razorpay, real payments, payout setup, full KYC, admin, demand discovery, or category expansion code is introduced.

## Ambiguity Policy

Use the Forge decision gate rubric. If confidence is 80% or higher, Claude may proceed and document the decision in `decisions.md`. Below 80%, stop and ask before implementation.

## Hard Stop

After this plan commit is pushed, stop. Do not implement. Do not start Claude tasks. Do not run `/dev`.
