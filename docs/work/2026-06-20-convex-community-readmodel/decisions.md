# Convex community-listings read-model · decisions log

## Classification
Backend data + routing change (Critical-ish). Done **solo with a `convex-reviewer` pass**
because Codex (backend owner) hit its usage limit (resets 2026-07-18) — the advisor's
sanctioned fallback. User chose "I do the backend solo now."

## Key decisions
1. **Seed enrichment as standalone listings** (not via `createMockFixture`): keeps the
   shared fixture + the acceptance order-flow untouched. 4 live event listings, idempotent
   by `listingKey`, reusing the seeded AUTO_APPROVE event rule (so `getListingDetail`/
   `getCheckoutView` resolve a rule). No schema change.
2. **Discount-integrity preserved**: no listing sets `originalPrice`/`originalPriceVerified`
   (not in the schema) → `discountBadge` → null → "Seller price". Verified: 0 "% off" on
   home/listings in the built HTML.
3. **`getHomeListings` reused** (already returns all live listings) — no new query needed;
   `loadCommunityListings()` wraps it with a mock fallback.
4. **`loadListingFlowView(listingKey?)`** parameterised (forwarded to `getCheckoutView`,
   which already accepts an optional `listingKey`) — backward compatible (omitted → demo).
5. **Detail route prerender from Convex**: `getStaticPaths` derives ids from
   `loadCommunityListings()` (mock fallback → demo only). Fixes the previous hardcoded
   single-id `getStaticPaths` that would 404 extra listings; the page now loads by param.
6. **Deploy to dev only** (`npx convex dev --once` → dev `savory-cow-440`); production
   (`adorable-narwhal-643`) untouched. This also synced dev's schema (it was 18 days stale,
   lacking the wants/catalog/want_matches indexes) — additive, no data loss.
7. **`.env.local` is gitignored and absent from worktrees** — copied it in to deploy/test;
   it is never committed. This is why CI (no env) runs the mock-fallback path.
8. **`_generated/*` reverted** — `convex dev` only rewrote line endings (empty content diff).

## convex-reviewer outcome
Ship-ready, no HIGH. LOW: `faceValue == listingPrice` (harmless). MED: build-time Convex
dependency in `getStaticPaths` — mitigated by same-source/same-build consistency; accepted.

## Out of scope
Checkout demo-hardwiring (pre-existing); detail-page v5 redesign; search/requests/referrals
read-models (later slices, Codex backend).
