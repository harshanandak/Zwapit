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
Because `wrangler.jsonc` declares Worker Routes for `zwapitt.com/*` and
`www.zwapitt.com/*`, the token also needs zone-scoped `Workers Routes Write`
permission so production deploys can create or update those route bindings.

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

`wrangler.jsonc` also declares Worker Routes for `zwapitt.com/*` and
`www.zwapitt.com/*`. Routes are used instead of Worker Custom Domains because
the hostnames already have DNS records in Cloudflare.

## Source References

- Workers Static Assets: https://developers.cloudflare.com/workers/static-assets/
- Workers Preview URLs: https://developers.cloudflare.com/workers/configuration/previews/
- Workers GitHub integration: https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/
- GitHub Actions with Workers: https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/
