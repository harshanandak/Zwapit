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

## Dev Evidence

Task 1 - Backend submission contract:

- RED: `bun test convex/__tests__/listingSubmission.test.ts` failed because
  `submitSellerListingForCurrentUser` was not exported from `convex/listings.ts`.
- GREEN: `97e0490 feat(listings): add verified seller submission mutation`.
- Verification:
  - `bun test convex/__tests__/listingSubmission.test.ts`: 3 pass / 0 fail.
  - `bun test src/lib/validation/__tests__/sellerValidation.test.ts`: 6 pass / 0 fail.
  - `bun run check`: 0 errors, 0 warnings, 11 existing CommonJS hints.

Task 2 - Rule, state, and duplicate behavior:

- RED: focused listing submission tests failed because `AUTO_BLOCK` raised
  `SELLER_LISTING_INVALID:RULE_BLOCKED` and duplicate same-seller submissions
  returned `created` instead of `updated`.
- GREEN: `162c585 feat(listings): persist seller rule outcomes deterministically`.
- Verification:
  - `bun test convex/__tests__/listingSubmission.test.ts`: 8 pass / 0 fail.
  - `bun test src/lib/validation/__tests__/sellerValidation.test.ts`: 6 pass / 0 fail.
  - `bun run check`: 0 errors, 0 warnings, 11 existing CommonJS hints.

Task 3 - Claude frontend handoff contract:

- RED: `bun test src/lib/convex/__tests__/dataAdapter.test.ts` failed because
  `submitSellerListingDraft` was not exported from `src/lib/convex/dataAdapter.ts`.
- GREEN: `2000446 feat(listings): add seller submission adapter handoff`.
- Verification:
  - `bun test src/lib/convex/__tests__/dataAdapter.test.ts`: 10 pass / 0 fail.
  - `bun test convex/__tests__/listingSubmission.test.ts`: 8 pass / 0 fail.
  - `bun run check`: 0 errors, 0 warnings, 11 existing CommonJS hints.

### Claude Contract

Claude-owned seller UI should import `submitSellerListingDraft` from
`src/lib/convex/dataAdapter.ts`; do not import `convex/_generated/api`.

Payload type: `SellerListingDraft` from `src/lib/types.ts`.

```ts
{
  source: "bookmyshow" | "district" | "bus_operator" | "other_platform" | "manual_upload";
  category: "event_ticket" | "movie_ticket" | "bus_travel" | "watcher" | "future_category";
  title: string;
  venueOrRoute: string;
  eventOrTripStartAt: string;
  quantity: number;
  faceValue: number;
  listingPrice: number;
  transferDeadlineAt: string;
  protectionDeadlineAt: string;
  sellerPromiseAccepted: boolean;
  duplicateFingerprint: string;
}
```

Result type: `SellerListingSubmissionResult` from `src/lib/types.ts`.

```ts
{
  ok: boolean;
  blockers: string[];
  listing: MockListing;
  status: "created" | "updated" | "mock" | "blocked";
}
```

Blockers surfaced to UI:

- `AUTH_REQUIRED`
- `PHONE_VERIFICATION_REQUIRED`
- seller validation reason codes from `SELLER_LISTING_INVALID:*`
- `PERSISTENCE_WRITE_FAILED`

No-Convex/default fallback returns `{ ok: true, blockers: [], status: "mock" }`
with a local listing built from the draft.

## Codex Handoff Validation

Fresh commands after Codex-owned Tasks 1-3:

- `bun test`: 89 pass / 0 fail / 299 expects.
- `bun run check`: 0 errors, 0 warnings, 11 existing CommonJS hints.
- `bun run build`: passed; 15 pages built.
- `bun scripts/verify-first-visible-slice.mjs`: passed; 15 contract routes checked.
- `bun scripts/e2e-buyer.mjs`: passed.
- `bun scripts/e2e-seller.mjs`: passed.

Scope-drift search:

- Command: `rg -n "Razorpay|real payments|payout setup|full KYC|admin expansion|demand discovery|category expansion|providerUserId|clerk_" convex src docs/work/2026-06-04-seller-listing-persistence -g "*.ts" -g "*.tsx" -g "*.astro" -g "*.md"`
- Result: out-of-scope matches were limited to docs and pre-existing auth comments/tests; provider id matches were limited to auth identity boundary code/tests and explicit separation assertions.

Provider-owner search:

- Command: `rg -n "sellerId:.*provider|buyerId:.*provider|actorId:.*provider|listingKey:.*provider|providerUserId.*sellerId|providerUserId.*buyerId|providerUserId.*actorId|identity\.subject.*sellerId|identity\.subject.*buyerId|identity\.subject.*actorId" convex src -g "*.ts" -g "*.astro"`
- Result: no matches.

## Notes For Claude

Claude should start with Task 4 in `tasks.md`. Codex has completed the backend
mutation, rule/state handling, duplicate behavior, shared payload/result types,
function reference, adapter helper, tests, and handoff evidence. Claude should
not change the backend contract unless a UI integration defect is proven and
handed back.

## Hard Stop

Codex-owned `/dev` Tasks 1-3 are complete. Stop before Claude-owned Task 4 UI
implementation unless the user explicitly asks to proceed differently.
