# Evidence

Date: 2026-06-04
Issue: zwapit-noq
Branch: feat/seller-listing-persistence

## Status Evidence

- `gh run list --branch master --limit 6`: latest `docs: close stale beads issues` CI and Cloudflare Worker Production runs completed successfully.
- `bd status`: 9 total issues, 0 open, 0 in progress, 9 closed.
- `bd list --json`: `[]`.
- `git branch --show-current`: `master` before planning worktree creation.
- `forge worktree create seller-listing-persistence --branch feat/seller-listing-persistence`: created isolated worktree.
- `git worktree list`: confirmed `.worktrees/seller-listing-persistence` on `feat/seller-listing-persistence` at `75f5f30`.
- `forge create --title="Plan persisted upload-first seller listing submission" --type=epic`: created `zwapit-noq`.
- `forge update zwapit-noq --status=in_progress`: reported success.
- `bd show zwapit-noq --json`: confirmed status `in_progress`.

## Source Evidence

- `AGENTS.md:62`: build order places Upload-first seller flow before source rule engine, listing marketplace, buyer checkout, order timeline, payments, admin, demand discovery, and category expansion.
- `src/pages/app/sell/upload.astro:30`: current upload step links to confirm instead of creating persisted data.
- `src/pages/app/sell/upload.astro:38`: current upload step documents mock upload and says real file reading is later.
- `src/pages/app/sell/confirm.astro:5`: current confirm step imports `createMockFixture`.
- `src/pages/app/sell/confirm.astro:7`: current confirm step derives listing from the mock fixture.
- `src/pages/app/sell/promise.astro:52`: current promise action links to seller orders.
- `src/pages/app/sell/promise.astro:60`: current promise action says agreeing publishes instantly in mock flow.
- `convex/listings.ts:15`: current listing API starts with read query `getHomeListings`.
- `convex/listings.ts:75`: current listing API has no seller submission mutation after the read queries.
- `convex/schema.ts:201`: existing listings table has the fields needed for first persisted listing submission.
- `convex/identity.ts:131`: `requirePhoneVerifiedAppUser` exists for protected seller mutation ownership.
- `src/lib/convex/dataAdapter.ts:1`: adapter pattern supports Convex when configured and local fallback otherwise.
- `src/lib/convex/functionRefs.ts:1`: frontend avoids generated Convex API imports.

## Commands Noted

- `forge team verify` timed out in this environment.
- `bash scripts/beads-context.sh stage-transition zwapit-noq none plan` timed out in this environment.
- Beads issue state was verified with `bd show zwapit-noq --json` after the timeout.

## Plan Artifacts

- `docs/work/2026-06-04-seller-listing-persistence/research.md`
- `docs/work/2026-06-04-seller-listing-persistence/design.md`
- `docs/work/2026-06-04-seller-listing-persistence/tasks.md`
- `docs/work/2026-06-04-seller-listing-persistence/decisions.md`
- `docs/work/2026-06-04-seller-listing-persistence/evaluator-report.md`
- `docs/work/2026-06-04-seller-listing-persistence/evidence.md`

## Hard Stop

Plan stage only. Do not begin implementation until the user explicitly asks for `/dev` or equivalent.
