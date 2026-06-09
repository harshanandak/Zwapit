# Clerk Auth Configuration Design

Feature: clerk-auth-configuration
Date: 2026-06-08
Status: planned
Issue: zwapit-ilz

## Purpose

Complete Zwapit's Clerk/Convex auth setup without locking business logic to Clerk. The slice should make production auth configurable while preserving the current demo flow and keeping all provider-specific details behind a thin wrapper.

## Success Criteria

- `convex/auth.config.ts` exists and can validate Clerk-issued Convex tokens when `CLERK_JWT_ISSUER_DOMAIN` is configured.
- Default app checks still pass with no Clerk browser env.
- Clerk runtime loading and token/profile/sign-in operations are centralized in a thin provider wrapper instead of duplicated across app code.
- `.env.example` and deploy docs tell a developer exactly which Clerk and Convex env vars to configure.
- Provider IDs remain separate from app user IDs.
- Validation evidence includes check, test, build, scope-drift search, and provider-id owner search.

## Out Of Scope

- Razorpay or real payments.
- Payout setup.
- Full KYC.
- Admin expansion.
- Demand discovery.
- Category expansion.
- A full React auth-provider rewrite.
- A custom SMS provider.

## Approach Selected

Add a small `src/lib/auth/providerRuntime.ts` wrapper for browser-only provider operations. `src/lib/convex/client.ts` and `/app/me` can ask this wrapper for a Convex token or account UI action, but should not directly reach into `window.Clerk`.

Add `convex/auth.config.ts` with a testable `buildAuthConfig(...)` helper. Convex CLI bundling requires `CLERK_JWT_ISSUER_DOMAIN` once the active auth config exists, so setup docs must make that env a hard prerequisite for `convex dev`, `convex codegen`, and deploy.

Document local, Convex, and Cloudflare env setup, including the need to activate Clerk's Convex integration and enable phone verification in Clerk.

## Constraints

- Keep the existing auth adapter surface as the app-facing boundary.
- Keep Clerk-specific script loading, token template details, and profile/sign-in calls in the provider wrapper.
- Preserve existing mock/demo behavior when no Clerk publishable key is configured.
- Do not introduce Clerk secret keys into frontend code.

## Edge Cases

- Missing Clerk publishable key: app remains in demo/no-Clerk mode.
- Missing Clerk issuer env: default app checks still pass, but Convex CLI codegen/dev/deploy fails until the env is set in Convex.
- Clerk runtime script fails to load: token/account helpers return null or no-op safely, preserving existing fail-closed protected gates.
- Clerk token claim is stale after phone changes: existing `refreshConvexAuthTokenOnNextRequest()` path remains available.
- Provider swap later: only the wrapper/identity boundary should need replacement.

## Ambiguity Policy

Use the Forge 7-dimension rubric during dev. If a gap scores 0-3, proceed and document the decision. If it scores 4-7, route through spec review. If it scores 8+ or touches security/data exposure beyond this design, stop for user input.
