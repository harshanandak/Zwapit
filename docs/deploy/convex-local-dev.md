# Convex Local Development

Use the existing Zwapit Convex dev deployment for local development.

## Deployment

- Convex team: `dev/harshananda57`
- Deployment name: `savory-cow-440`
- Cloud URL: `https://savory-cow-440.convex.cloud`
- HTTP Actions URL: `https://savory-cow-440.convex.site`

## Local Environment

Create or update the gitignored `.env.local` file:

```ini
PUBLIC_CONVEX_URL=https://savory-cow-440.convex.cloud
CONVEX_DEPLOYMENT=dev:savory-cow-440
```

`PUBLIC_CONVEX_URL` is required for the Astro browser bundle to use Convex. When
it is absent, the app intentionally falls back to the local mock flow.

`CONVEX_DEPLOYMENT` points the listed `convex dev` and `convex run` commands at
the existing dev deployment. Do not use `convex deploy` for this local-dev flow:
`convex deploy` is for production deployment unless separate deploy-key or
preview-deploy configuration is intentionally provided.

Do not commit deploy keys, auth tokens, or other secrets.

## Verification

From the repository root:

```sh
bunx convex dev --once --env-file .env.local
bunx convex run seed:seedDemoFixture --env-file .env.local
bun run check
bunx tsc --project convex/tsconfig.json --noEmit
bun test
bun run build
bun scripts/verify-first-visible-slice.mjs
bun scripts/e2e-buyer.mjs
bun scripts/e2e-seller.mjs
```

For local browser smoke, start Astro with `.env.local` present:

```sh
bun run dev
```

Then open the local app and confirm the existing mock-visible flow still behaves
the same while persisted Convex state survives reload.
