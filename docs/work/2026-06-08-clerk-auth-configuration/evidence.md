# Clerk Auth Configuration Evidence

Issue: zwapit-ilz
Branch: feat/clerk-auth-configuration

## Plan Evidence

- Worktree: `.worktrees/clerk-auth-configuration`
- Branch: `feat/clerk-auth-configuration`
- Beads issue: `zwapit-ilz`
- `forge team verify`: failed before planning with `grep: -P supports only unibyte and UTF-8 locales`. This is a local Forge/team-check issue; planning continued with the failure recorded.

## Dev Evidence

### RED

- `bun test src/lib/auth/__tests__/clerkRuntime.test.ts convex/__tests__/authConfig.test.ts`
  - Result: failed as expected before implementation.
  - Failure: missing `../clerkRuntime` and `../auth.config` modules.

### GREEN / Refactor

- Added provider runtime wrapper at `src/lib/auth/providerRuntime.ts`.
- Updated `src/lib/convex/client.ts` to request Clerk Convex tokens through the provider wrapper.
- Updated `src/pages/app/me.astro` to open sign-in/profile through the provider wrapper.
- Added `convex/auth.config.ts` using the official Convex Clerk issuer env.
- Added env and deploy docs for Clerk, Convex, GitHub Actions, and Cloudflare.
- Added GitHub Actions build-time env passthrough for `PUBLIC_CLERK_PUBLISHABLE_KEY` and `PUBLIC_CONVEX_URL`.

### Focused Tests

- `bun test src/lib/auth/__tests__/clerkRuntime.test.ts convex/__tests__/authConfig.test.ts src/lib/auth/__tests__/authAdapter.test.ts src/lib/convex/__tests__/dataAdapter.test.ts convex/__tests__/identity.test.ts`
  - Result: 33 pass, 0 fail, 106 assertions.
- After provider-neutral rename:
  - `bun test convex/__tests__/authConfig.test.ts src/lib/auth/__tests__/providerRuntime.test.ts`
  - Result: 4 pass, 0 fail, 6 assertions.

### Convex Codegen Check

- `bunx convex codegen` without local deployment env:
  - Result: failed before auth config validation with `No CONVEX_DEPLOYMENT set`.
- `bunx convex codegen` with root `.env.local` Convex env loaded and no Clerk issuer:
  - Result: failed with `Environment variable CLERK_JWT_ISSUER_DOMAIN is used in auth config file but its value was not set.`
  - Interpretation: once `convex/auth.config.ts` exists, Convex CLI requires the Clerk issuer env to be configured in the Convex deployment before `convex dev`, `convex codegen`, or deploy. This is documented in `docs/deploy/clerk-auth.md`.

### Full Validation

- `bun run check`
  - Result: pass. Astro reported 0 errors, 0 warnings, 11 existing CommonJS hints in dep-guard scripts.
- Initial `bun test` after `/validate` rebase:
  - Result: failed only `first visible slice has no forbidden scope drift`.
  - Failure: `out-of-scope first-slice branch change: docs/deploy/clerk-auth.md`.
  - Fix: added `docs/deploy/clerk-auth.md` to `scripts/verify-first-visible-slice.mjs` allowlist because this slice legitimately introduces the Clerk deployment setup doc.
- `bun run build`
  - Result: pass. Built 15 pages.
- `bun scripts/verify-first-visible-slice.mjs`
  - Result: pass. Checked 15 contract routes.
- `bun scripts/e2e-buyer.mjs`
  - Result: pass. Buyer mock path completed.
- `bun scripts/e2e-seller.mjs`
  - Result: pass. Seller mock path completed.

### Final Validation After Allowlist Fix

- `bun run check`
  - Result: pass. Astro reported 0 errors, 0 warnings, 11 existing CommonJS hints in dep-guard scripts.
- `bun test`
  - Result: 128 pass, 0 fail, 420 assertions.
- `bun run build`
  - Result: pass. Built 15 pages.
- `bun audit`
  - Result: pass. No vulnerabilities found.
- `bun scripts/verify-first-visible-slice.mjs`
  - Result: pass. Checked 15 contract routes.
- `bun scripts/e2e-buyer.mjs`
  - Result: pass. Buyer mock path completed.
- `bun scripts/e2e-seller.mjs`
  - Result: pass. Seller mock path completed.

### Scope Drift

- Command: `rg -n "Razorpay|real payments|payout setup|full KYC|admin expansion|demand discovery|category expansion" src convex .github .env.example docs/deploy docs/work/2026-06-08-clerk-auth-configuration package.json -g "*.ts" -g "*.astro" -g "*.md" -g "*.yml" -g "*.json" -g ".env.example"`
- Result: matches are only explicit out-of-scope docs/comments and the existing auth adapter comment excluding real SMS/Razorpay/KYC/payout behavior. No real payment, payout, KYC, admin, demand, or category implementation was added.

### Provider-Id Owner Search

- Command: `rg -n "sellerId:.*provider|buyerId:.*provider|actorId:.*provider|listingKey:.*provider|providerUserId.*sellerId|providerUserId.*buyerId|providerUserId.*actorId|identity\.subject.*sellerId|identity\.subject.*buyerId|identity\.subject.*actorId|providerUserId.*appUserId" convex src -g "*.ts" -g "*.astro"`
- Result: no matches. Provider ids are not used as listing/order/app owner ids.

## Review Evidence

- SonarCloud initially failed on provider runtime issues.
  - Fix: `src/lib/auth/providerRuntime.ts` now uses `globalThis.window` and an explicit `clerkPromise !== null` check.
  - Fix: `src/lib/auth/__tests__/providerRuntime.test.ts` no longer passes redundant `undefined`.
- CodeRabbit review found `clerkPromise` could cache a `null` result after script/load failure.
  - Fix: `src/lib/auth/providerRuntime.ts` resets `clerkPromise` on script error and `clerk.load()` failure.
  - Coverage: `providerRuntime.test.ts` asserts retry after script error.
- Codex review found dynamic `import.meta.env[name]` would not be statically replaced by Vite.
  - Fix: `src/lib/auth/authAdapter.ts` reads `import.meta.env.PUBLIC_CLERK_PUBLISHABLE_KEY` and `import.meta.env.VITE_CLERK_PUBLISHABLE_KEY` through static property references.
- Codex review found Clerk phone verification setup docs did not mention the Convex JWT phone claim.
  - Fix: `docs/deploy/clerk-auth.md` documents the `phone_number` and `phone_number_verified` JWT template claims required for Convex `identity.phoneNumberVerified`.
- CodeRabbit noted a minor `clerk?.user` abstraction leak and a local Windows worktree path in evidence.
  - Fix: `src/pages/app/me.astro` now uses `isClerkSignedIn()` from the provider wrapper.
  - Fix: this evidence file now records the worktree as `.worktrees/clerk-auth-configuration`.
- CodeRabbit noted `.env.example` could mislead developers into setting the Clerk issuer in `.env.local`.
  - Fix: `.env.example` no longer includes a `CLERK_JWT_ISSUER_DOMAIN=` assignment and explicitly says to set it only through Convex.

### Review Validation

- `bun test src/lib/auth/__tests__/providerRuntime.test.ts src/lib/auth/__tests__/authAdapter.test.ts`
  - Result: 15 pass, 0 fail, 51 assertions.
- `bun run check`
  - Result: pass. Astro reported 0 errors, 0 warnings, 11 existing CommonJS hints in dep-guard scripts.
- `bun run build`
  - Result: pass. Built 15 pages.
- `bun scripts/verify-first-visible-slice.mjs`
  - Result: pass. Checked 15 contract routes.
- Parallel `bun test` with `bun run build`
  - Result: failed the acceptance test because it spawned its own build while another build was running. This is the known local build/test concurrency race, not a product failure.
- `bun test`
  - Result: 130 pass, 0 fail, 424 assertions.
- `bun audit`
  - Result: pass. No vulnerabilities found.
- `bun scripts/e2e-buyer.mjs`
  - Result: pass. Buyer mock path completed.
- `bun scripts/e2e-seller.mjs`
  - Result: pass. Seller mock path completed.
