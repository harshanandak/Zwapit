# Clerk Auth Configuration Tasks

Issue: zwapit-ilz
Branch: feat/clerk-auth-configuration

## Task 1 - Centralize Clerk Runtime Behind Wrapper

Owner: Codex

Files:
- `src/lib/auth/providerRuntime.ts`
- `src/lib/convex/client.ts`
- `src/pages/app/me.astro`
- `src/lib/auth/__tests__/providerRuntime.test.ts`

RED:
- Add tests proving the wrapper exposes a pinned ClerkJS URL and returns `null` without browser/key runtime.

GREEN:
- Move Clerk script loading, `window.Clerk` lookup, Convex token request, sign-in open, and user-profile open into the wrapper.
- Update Convex client and `/app/me` to use wrapper calls.

REFACTOR:
- Remove duplicated Clerk runtime types/script loader from `client.ts` and `me.astro`.

Acceptance:
- Provider-specific browser calls are isolated to the wrapper.
- Existing no-Clerk demo path remains unchanged.

## Task 2 - Add Environment-Gated Convex Auth Config

Owner: Codex

Files:
- `convex/auth.config.ts`
- `convex/__tests__/authConfig.test.ts`

RED:
- Add tests proving the config helper yields no providers without an issuer and a present issuer yields one provider with `applicationID: "convex"`.

GREEN:
- Implement `buildAuthConfig(...)` and default export.

REFACTOR:
- Keep the config small and documented enough to avoid accidental hard-fail local setups.

Acceptance:
- Default app validation stays green.
- Convex CLI codegen/dev/deploy documents `CLERK_JWT_ISSUER_DOMAIN` as required once the active config exists.
- Clerk issuer env activates the Convex provider.

## Task 3 - Document Clerk/Convex/Cloudflare Setup

Owner: Codex

Files:
- `.env.example`
- `docs/deploy/clerk-auth.md`
- `docs/deploy/cloudflare-workers.md` if needed for cross-link only
- `.github/workflows/cloudflare-worker-preview.yml`
- `.github/workflows/cloudflare-worker-production.yml`
- `docs/work/2026-06-08-clerk-auth-configuration/evidence.md`

RED:
- Check that `.env.example` currently lacks Clerk env docs.

GREEN:
- Add env examples for `PUBLIC_CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY` compatibility, and `CLERK_JWT_ISSUER_DOMAIN`.
- Document dashboard setup: Clerk app, phone verification, Convex integration, Convex env, Cloudflare env.
- Pass optional GitHub Actions build-time env values into Cloudflare preview and production builds without hardcoding credentials.

REFACTOR:
- Keep deployment docs as setup instructions, not product scope expansion.

Acceptance:
- A developer can configure Clerk without reading prior work docs.

## Task 4 - Validate Slice And Record Evidence

Owner: Codex

Files:
- `docs/work/2026-06-08-clerk-auth-configuration/evidence.md`
- `docs/work/2026-06-08-clerk-auth-configuration/evaluator-report.md`

Run fresh:
- `bun run check`
- `bun test`
- `bun run build`
- `bun scripts/verify-first-visible-slice.mjs`
- Scope-drift search for Razorpay, real payments, payout setup, full KYC, admin expansion, demand discovery, category expansion.
- Provider-id owner search confirming provider ids are not used as listing/order/app owner ids.

Acceptance:
- All validation results are recorded.
- Evaluator confirms the wrapper boundary and no out-of-scope expansion.
