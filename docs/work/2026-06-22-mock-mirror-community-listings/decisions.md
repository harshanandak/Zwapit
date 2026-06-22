# Community listing routes resolve end-to-end · decisions log

## Classification
Frontend/routing fix (no schema/query/backend change). Standard. Combines a production
checkout-404 fix with the queued no-env mock-mirror cleanup (user-approved combined scope).

## Key decisions (incl. advisor)
1. **Combine both fixes** (user choice): the prod checkout 404 and the no-env detail-link 404 are
   the same "community routes don't resolve" problem and share the `loadListingFlowView`
   resolve-by-key change. One slice, no duplicated routing work.
2. **Prod finding verified before claiming it** (advisor): a Convex-path dist had the community
   listing detail page but NOT its checkout page → the buy flow 404s in production. Confirmed, not
   assumed.
3. **Mock mirrors the seed exactly** (advisor): `MOCK_COMMUNITY_EXTRAS` + `mockExtraListing` use
   `seedExtraListings`' field math so the no-env listings == the seeded Convex rows.
4. **Reuse fixture checkout, recompute evaluation, swap listing** (advisor): the detail/checkout
   page renders `listing` + `purchasable`; all demo listings share the source rule and are
   AUTO_APPROVE, so reusing the fixture's `checkout` object is correct; `evaluation` is recomputed
   per listing. sellerPaymentAccount complexity avoided.
5. **Fixture/no-arg path preserved byte-for-byte** (advisor): the no-arg adapter test
   (`loadListingFlowView() === connectMockListingFlow()`) stays green; only the keyed mock branch is
   new. Unknown key also falls back to the fixture flow.
6. **Real pass/fail is the dist check, not needles** (advisor): needles grep existing pages, so
   they can't catch a missing/wrong checkout page. Added explicit dist existence + content checks
   for every community listing's detail AND checkout in both builds.
7. **Scope held**: no change to source rule, pricing, identity/phone gate, or mock-pay. Alerts
   inherits the fix once #31 merges (this branch is pre-#31); Requests is verifiable here.

## convex-reviewer outcome
CLEAN, no blocking issues. Confirmed: field math mirrors `seedExtraListings` exactly (all 4
keys/titles/venues/prices/quantities byte-identical; faceValue=price, fee 10, gst 1.8,
total price+11.8, deadlines start∓, fingerprint); no-key/fixture-key/unknown-key return the
fixture flow unchanged (no-arg adapter test stays green); Convex paths byte-unchanged (only the
`!client` branches reroute); checkout route's pay-button/auth-gate/unavailable expressions +
mock-pay handler byte-unchanged → no gate weakened; tests correct.

One LOW (future-proofing) — FIXED: `mockListingFlowView` originally reused the fixture's
`checkout`, so `purchasable` didn't re-validate the extra's own checkout blockers (a future extra
with a past deadline / non-live state would wrongly show purchasable). Now runs a fresh
`validateCheckout` against the extra (sourceRule + sellerPaymentAccount from the fixture, the
listing's own deadline/state/total), exactly mirroring the Convex path. Re-verified: 13/13 tests,
26 pages both builds, checkout/coldplay prerendered, both verify paths green.
