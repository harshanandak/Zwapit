# Community listing routes resolve end-to-end · design

## Goal
Make the community-listing buy flow resolve for EVERY community listing (not just the demo
fixture), in BOTH the Convex build and the no-Convex (mock) build.

## Two findings (one shared fix)
1. **Production checkout 404 (higher impact, confirmed via dist):** community listings
   (Coldplay/Garrix/Zakir/IPL on Home since #27, + Requests/Alerts matches) render their
   `/app/listings/<id>` detail page, but the detail's "Buy with Protection" → `/app/checkout/<id>`
   **404s in every build incl. production** — `checkout/[listingId].astro` `getStaticPaths` was
   hardcoded to `listing_bms_event_1` and the page called `loadListingFlowView()` with no arg.
   Evidence: a Convex-path build had `dist/app/listings/listing_event_coldplay_1` but NO
   `dist/app/checkout/listing_event_coldplay_1`.
2. **No-env mock build (CI-artifact):** `loadCommunityListings()`/`loadListingFlowView()` mock
   fallbacks only knew the fixture, so `/app/listings/<community id>` wasn't prerendered (or showed
   fixture content) → the Requests (#29) / Alerts (#31) match Buy links 404'd in the no-env build.

Both are the same "community listing routes don't resolve" problem and share the
`loadListingFlowView`-resolve-by-key change. User chose to fix both in one slice.

## Approach
Frontend/routing only — NO schema, query, or backend change.
- **`dataAdapter.ts`**: `MOCK_COMMUNITY_EXTRAS` mirrors the seed's `EXTRA_LISTINGS`
  (coldplay/garrix/zakir/ipl); `mockExtraListing` builds each from the fixture template using
  `seedExtraListings`' exact field math (faceValue=price, fee 10, gst 1.8, total price+11.8,
  deadlines from start); `mockCommunityListings()` = fixture + extras. `loadCommunityListings`
  fallback returns all of them. `loadListingFlowView(key)` resolves the key against
  `mockCommunityListings` in the no-Convex path (recompute evaluation, reuse the fixture's
  checkout/purchasable — all demo listings share the rule + are AUTO_APPROVE). The no-arg / fixture
  / unknown-key paths return the fixture flow unchanged (byte-for-byte; the no-arg adapter test
  stays green).
- **`checkout/[listingId].astro`**: `getStaticPaths` now sources from `loadCommunityListings`
  (prerenders every community checkout — the prod fix); frontmatter loads by
  `Astro.params.listingId`; the client re-check uses the listing id from the path, not the fixture.

## Out of scope
- No change to the source rule, pricing, identity/phone gate, or the mock-pay mutation. The
  checkout purchasable + phone-verify gates are unchanged; full price still shown before pay.
- This branch is off master (pre-#31), so the **Requests** match Buy link is verifiable here;
  **Alerts** inherits the same `loadCommunityListings`/`loadListingFlowView` infra automatically
  once #31 merges.

## Verification
- `bun test` dataAdapter: resolve-by-key returns Coldplay (id/title/price/total/purchasable);
  unknown key + no-arg fall back to the fixture flow.
- Convex build: 26 pages; all 4 community listings have BOTH `dist/app/listings/<id>` AND
  `dist/app/checkout/<id>` (prod 404 fixed).
- Mock build: 26 pages (was 18); same prerender set, and the coldplay detail+checkout pages render
  "Coldplay - Music of the Spheres" + ₹3,500 (per-listing content, not the fixture).
- Both build paths pass `verify-first-visible-slice`.

## Security analysis (OWASP)
Frontend/routing only, no new data surface:
- **A01 Access control** — checkout's purchasable gate + phone-verify gate + the mock-pay mutation's
  own rejection are unchanged; prerendering more static checkout pages doesn't bypass any gate.
- **A03 Injection/XSS** — listing fields come from the same Convex/mock sources already rendered on
  Home/Listings; Astro escaping unchanged; the client reads the listing id from its own URL path.
- **A02 Sensitive data exposure** — only public listing display fields; no new PII; no payment logic.
