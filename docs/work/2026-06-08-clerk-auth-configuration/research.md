# Clerk Auth Configuration Research

Date: 2026-06-08
Issue: zwapit-ilz
Branch: feat/clerk-auth-configuration

## Context

Zwapit already has an auth identity boundary and phone verification gates. The remaining auth setup gap is provider configuration: the frontend can detect Clerk keys and the Convex browser client can request a Clerk `convex` token, but the repo has no active Convex auth provider config and the env docs do not explain Clerk setup.

## Verified Repo Facts

- `AGENTS.md` and `CLAUDE.md` require Clerk first for v1, behind a replaceable auth adapter/wrapper, with internal app user ids used in app data.
- `src/lib/auth/authAdapter.ts` reads `PUBLIC_CLERK_PUBLISHABLE_KEY` and `VITE_CLERK_PUBLISHABLE_KEY`.
- `src/lib/convex/client.ts` currently contains Clerk runtime loading and calls `window.Clerk.session.getToken({ template: "convex" })`.
- `src/pages/app/me.astro` currently contains separate Clerk runtime loading and sign-in/profile calls.
- `convex/identity.ts` maps authenticated provider identity into `auth_identities.providerUserId` and internal `users.appUserId`.
- `.env.example` documents Convex only.
- No `convex/auth.config.ts` or `convex/auth.config.js` exists.
- Prior auth slice decision: an active Convex auth config was deferred because `CLERK_JWT_ISSUER_DOMAIN` was not available and an unconditional env reference blocked Convex codegen.

## External Sources

- Convex auth overview: https://docs.convex.dev/auth/overview
  - Convex validates authenticated user claims with OpenID Connect JWTs.
  - Authorization should be enforced inside Convex functions.
- Convex Clerk integration: https://docs.convex.dev/auth/clerk
  - Clerk Convex integration provides a Frontend API / issuer URL.
  - Convex auth config should use `domain` and `applicationID: "convex"`.
  - `npx convex dev` or deploy syncs auth config to the backend.
- Clerk JavaScript quickstart: https://clerk.com/docs/js-frontend/getting-started/quickstart
  - ClerkJS can be loaded from script tags and initialized with a publishable key.
- Clerk phone setup: https://clerk.com/docs/guides/development/custom-flows/account-updates/add-phone
  - Phone verification must be enabled in Clerk before using phone verification.

## Constraints

- Keep provider-specific auth code behind a thin wrapper so Clerk can be replaced later.
- Do not use Clerk/provider ids as listing, order, payment, or app data owner ids.
- Do not add real payments, payout setup, full KYC, admin expansion, demand discovery, or category expansion.
- Preserve default no-Clerk demo behavior.
- Avoid adding a React auth provider architecture just because the official examples use React; this app is Astro plus focused browser scripts.

## Open Implementation Risk

`convex/auth.config.ts` should follow the official Convex auth config pattern. Fresh verification found that Convex CLI treats `CLERK_JWT_ISSUER_DOMAIN` as mandatory as soon as the auth config reads it, even when a helper can return no providers in unit tests. That means `bunx convex codegen`, `bunx convex dev`, and deploy need the issuer env configured in Convex before they can pass.
