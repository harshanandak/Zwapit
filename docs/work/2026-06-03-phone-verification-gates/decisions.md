# Decisions - Phone Verification And Protected Action Gates

Issue: `zwapit-12a`

## D1 - Claude Implements First

Decision: Claude owns implementation for this slice. Codex plans only, then validates after Claude handoff.

Reason: The user explicitly set the ownership boundary for this slice.

## D2 - Extend Existing Auth Boundary

Decision: Extend `src/lib/auth/authAdapter.ts` and `convex/identity.ts` instead of adding a new auth or OTP model.

Reason: The merged auth identity boundary already separates app user ids, provider ids, and user verification state.

## D3 - Mocked Or Provider-Abstracted OTP Only

Decision: OTP verification remains mocked/provider-abstracted.

Reason: Real SMS, KYC, payments, and payout setup are explicitly excluded from this slice.

## D4 - Gate Execution, Not Only Navigation

Decision: Protected checkout and listing submission must be gated at execution points, not only CTA links.

Reason: Direct route access can bypass a listing-detail or sell-entry CTA.
