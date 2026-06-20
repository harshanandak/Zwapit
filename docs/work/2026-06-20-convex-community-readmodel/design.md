# Convex community-listings read-model + seed enrichment · design

**Slug:** convex-community-readmodel · **Date:** 2026-06-20 · **Branch:** feat/convex-community-readmodel
**Status:** in progress · **Classification:** Critical-ish (backend data + routing) — done solo with a convex-reviewer pass (Codex, the backend owner, is rate-limited until 2026-07-18).

## Purpose

First slice of "wire the screens to real Convex data". The Convex connection already
works (dev `savory-cow-440` + CI vars); what was missing is (a) the Home/Listings rails
reading the real **list** read-model instead of the single checkout-view listing, and
(b) enough seeded inventory for that list to show more than one card. This makes the
deployed preview render multiple real community listings end-to-end (rail → detail).

## What changed

- **Backend — `convex/seed.ts`:** added 4 standalone live community listings (Coldplay,
  Martin Garrix, Zakir Khan, IPL RCB) alongside the existing demo listing. Idempotent by
  `listingKey`; all reuse the seeded BookMyShow-event source rule (AUTO_APPROVE,
  OFFICIAL_TRANSFER); none carries a verified original price → all render "Seller price"
  (discount-integrity). The demo listing (`listing_bms_event_1`, 2,400 / 2,411.80) is
  untouched, so its acceptance values are preserved.
- **Frontend — `dataAdapter.ts`:** new `loadCommunityListings()` over the existing
  `getHomeListings` query (mock fallback = the single demo listing). `loadListingFlowView`
  now takes an optional `listingKey` (forwarded to `getCheckoutView`) so any listing's
  detail/checkout view can load.
- **Home + Listings:** the community rails now map `loadCommunityListings()` instead of
  `[loadListingFlowView().listing]`. The hardcoded "sample card" fillers on Listings
  (Sunburn, "More near you") are removed — the real list fills the rail.
- **Listing detail route (`[listingId].astro`):** `getStaticPaths` now derives ids from
  `loadCommunityListings()` (so every live listing prerenders; was hardcoded to the demo
  id), and the page loads by `:listingId` via `loadListingFlowView(listingId)` instead of
  always showing the demo. Client re-check reads the id from `data-listing-id`.

## Dual behaviour (by design)

- **Convex configured** (local with `.env.local`, CI Cloudflare preview/prod via
  `PREVIEW/PRODUCTION_PUBLIC_CONVEX_URL`): rails + detail come from Convex → 5 listings,
  5 prerendered detail pages.
- **No `PUBLIC_CONVEX_URL`** (the regular CI Build/Test/Acceptance/Smoke jobs): every path
  falls back to the single mock listing → 1 card, 1 detail page. Internally consistent
  (no dangling links), so all gates pass unchanged.

## Verification

- Convex path (`.env.local` present): build 0/0 **22 pages**; 5 detail pages prerendered
  (no 404); Home renders Coldplay/Zakir Khan/IPL; **0** "% off"; acceptance + route-
  coverage (18) + buyer smoke (11) + `bun test` (175) all green.
- Mock-fallback path (`.env.local` removed, = CI): build 0/0 **18 pages**; 1 listing; all
  gates green.
- convex tsc: 0. convex-reviewer: ship-ready, no HIGH.
- Dev deployment: pushed enriched functions via `npx convex dev --once` (dev only, NOT
  prod); `getHomeListings` returns the 5 listings.

## Out of scope / known limits

- Checkout remains demo-hardwired for the order flow (clicking Buy on a non-demo listing
  routes to the demo checkout) — pre-existing; the protected order flow is demo-only.
- The listing-detail page keeps its legacy (pre-v5) styling — data-loading only, no redesign.
- search / requests / profile-referrals read-models are separate later slices (each needs
  a new Convex query; referrals is greenfield schema).
- MED (convex-reviewer): `getStaticPaths` does a build-time Convex round-trip. Home/Listings
  and `getStaticPaths` use the SAME `loadCommunityListings` against the SAME deployment in
  the SAME build, so they stay consistent; a transient mid-build partial failure is the only
  (low) 404 risk. Accepted for the dev preview.
