# Clerk Auth Setup

Zwapit uses Clerk for v1 auth speed, but app code must stay behind the thin auth wrapper so the provider can be replaced later.

## Provider Boundary

- Frontend provider runtime: `src/lib/auth/providerRuntime.ts`
- App-facing auth adapter: `src/lib/auth/authAdapter.ts`
- Convex browser token boundary: `src/lib/convex/client.ts`
- Convex identity sync: `convex/identity.ts`
- Convex provider config: `convex/auth.config.ts`

Do not add direct provider SDK calls outside the provider runtime wrapper. Do not use Clerk/provider ids as listing, order, payment, or app owner ids. Provider ids belong in `auth_identities.providerUserId`; app data uses internal `appUserId`.

## Clerk Dashboard

1. Create a Clerk application for Zwapit.
2. Enable phone number auth/verification in Clerk.
3. Activate Clerk's Convex integration.
4. In the Convex JWT template named `convex`, include the phone claims that Convex maps to `identity.phoneNumber` and `identity.phoneNumberVerified`:

   ```json
   {
     "phone_number": "{{user.primary_phone_address}}",
     "phone_number_verified": "{{user.phone_number_verified}}"
   }
   ```

   Zwapit's protected buy/sell gates only accept Clerk phone verification when Convex receives `identity.phoneNumberVerified === true`.
5. Copy the publishable key.
6. Copy the Clerk issuer / Frontend API domain used by the Convex integration.
7. Add local and production origins:
   - `http://localhost:4321`
   - `https://zwapitt.com`
   - `https://www.zwapitt.com`
   - the current Workers preview origin when testing preview builds

## Local Frontend Env

Copy `.env.example` to `.env.local` and set:

```env
PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_<your-clerk-publishable-key>
PUBLIC_CONVEX_URL=https://<your-convex-deployment>.convex.cloud
CONVEX_DEPLOYMENT=dev:<your-convex-deployment>
```

`VITE_CLERK_PUBLISHABLE_KEY` remains supported as a compatibility fallback. Prefer `PUBLIC_CLERK_PUBLISHABLE_KEY`.

## Convex Backend Env

Set the issuer domain in the Convex deployment:

```powershell
bunx convex env set CLERK_JWT_ISSUER_DOMAIN https://<your-clerk-issuer-domain>
bunx convex dev
```

Once `convex/auth.config.ts` exists, Convex CLI commands that bundle or deploy functions require `CLERK_JWT_ISSUER_DOMAIN` in the Convex deployment. Set this before running `bunx convex dev` or `bunx convex codegen`.

## Cloudflare And GitHub Actions Env

Astro inlines `PUBLIC_` variables at build time. For GitHub Actions deploys, set these as repository or environment variables/secrets available to the Cloudflare preview and production workflows:

- `PUBLIC_CLERK_PUBLISHABLE_KEY`
- `PUBLIC_CONVEX_URL`

For local manual deploys, export the same values before running `bun run cf:deploy` or `bun run cf:preview`.

The Clerk issuer env belongs to Convex, not Cloudflare or the browser build:

```powershell
bunx convex env set CLERK_JWT_ISSUER_DOMAIN https://<your-clerk-issuer-domain>
```

## Validation

After configuring Clerk and Convex:

1. Start the local app with Clerk env present.
2. Click a protected buy or sell action while signed out; it should route to `/app/me`.
3. Sign in through Clerk.
4. Use an unverified phone account and confirm the protected action stays gated.
5. Verify the phone in Clerk and retry the saved action.
6. Confirm Convex receives `identity.phoneNumberVerified === true` after Clerk phone verification.
7. Confirm Convex `users.appUserId` is internal and `auth_identities.providerUserId` holds the Clerk subject.

Run:

```powershell
bun run check
bun test
bun run build
bun scripts/verify-first-visible-slice.mjs
```

## Source References

- Convex auth overview: https://docs.convex.dev/auth/overview
- Convex Clerk integration: https://docs.convex.dev/auth/clerk
- Clerk JavaScript quickstart: https://clerk.com/docs/js-frontend/getting-started/quickstart
- Clerk phone setup: https://clerk.com/docs/guides/development/custom-flows/account-updates/add-phone
