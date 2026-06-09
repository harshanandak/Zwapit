# Cloudflare Workers Deployments

This project deploys the static Astro build to Cloudflare Workers Static Assets.

## Cloudflare Project

- Account: `Harshananda57@gmail.com's Account`
- Account ID: `3216bc4d5cf3736883b6976853d59a4c`
- Worker name: `zwapit`
- workers.dev subdomain: `harshananda57`
- Production URL: `https://zwapit.harshananda57.workers.dev`
- Custom domain: `https://zwapitt.com`
- Custom www domain: `https://www.zwapitt.com`
- PR preview URL format: `https://pr-<number>-zwapit.harshananda57.workers.dev`

## Required GitHub Secret

Add this repository secret before relying on GitHub Actions deployments:

- `CLOUDFLARE_API_TOKEN`

The token needs permission to upload and deploy Workers for the account above.
Production deploys do not create or update Worker Routes. Keep the
`zwapitt.com/*` and `www.zwapitt.com/*` route bindings managed in the
Cloudflare dashboard, pointing at the `zwapit` Worker. This keeps routine
deploys scoped to Worker upload permissions and avoids requiring every deploy
token to have zone route-write access.

## Required Auth Build Env

Astro inlines public browser env during `bun run build`. Clerk browser auth
needs `PUBLIC_CLERK_PUBLISHABLE_KEY` available to the GitHub Actions build, and
Convex-backed flows need `PUBLIC_CONVEX_URL` available to the same build.
Convex auth validation needs `CLERK_JWT_ISSUER_DOMAIN` on the Convex deployment,
not in Cloudflare or the browser bundle. See `docs/deploy/clerk-auth.md`.

Use environment-specific GitHub variables for deployed builds:

- Preview/development builds:
  - `PREVIEW_PUBLIC_CLERK_PUBLISHABLE_KEY`
  - `PREVIEW_PUBLIC_CONVEX_URL`
- Production builds:
  - `PRODUCTION_PUBLIC_CLERK_PUBLISHABLE_KEY`
  - `PRODUCTION_PUBLIC_CONVEX_URL`

The generic `PUBLIC_CLERK_PUBLISHABLE_KEY` and `PUBLIC_CONVEX_URL` names remain
workflow fallbacks only. Do not rely on them for normal preview/production
separation.

## GitHub Actions

- `.github/workflows/cloudflare-worker-preview.yml`
  - Runs on pull requests.
  - Validates the app.
  - Uploads a Worker version with `wrangler versions upload --preview-alias pr-<number>`.
  - Creates a GitHub deployment status.
  - Adds or updates a sticky PR comment with the preview URL.

- `.github/workflows/cloudflare-worker-production.yml`
  - Runs on pushes to `master` and manual dispatch.
  - Validates the app.
  - Deploys the Worker with `wrangler deploy`.
  - Creates a GitHub deployment status.

## Local Commands

```powershell
bun run build
bunx wrangler deploy --dry-run
bunx wrangler versions upload --preview-alias pr-2 --tag pr-2
```

Use `wrangler versions deploy` only when intentionally promoting a version to production traffic.

The custom-domain Worker Routes are intentionally not stored in
`wrangler.jsonc`. If the routes must be recreated, add them in the Cloudflare
dashboard or run a one-off route-management command with a token that has the
required zone route-write permission, then remove route declarations from the
routine deploy config again.

## Source References

- Workers Static Assets: https://developers.cloudflare.com/workers/static-assets/
- Workers Preview URLs: https://developers.cloudflare.com/workers/configuration/previews/
- Workers GitHub integration: https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/
- GitHub Actions with Workers: https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/
