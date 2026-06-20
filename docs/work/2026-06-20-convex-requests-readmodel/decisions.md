# Convex Requests read-model · decisions log

## Classification
Backend data + read-model. Solo + convex-reviewer (Codex rate-limited until 2026-07-18).
Free-stack aligned ($0 — curated wants/catalog, no paid API).

## Key decisions (incl. advisor)
1. **Path A (honest matched payoff)** over Path B (open/expired only): the matched card +
   Buy link + match count are the screen's point, so make them real. A `want_match` must be
   `catalogItemId`-backed — seeding an unbacked match would be a fabricated match (same smell
   as a fake discount).
2. **Coldplay is the match anchor:** add a Coldplay `catalog_items` row, set the existing
   Coldplay community listing's `catalogItemId` to it (additive), seed a `matched` want on the
   same id + one `want_match`. Demo fixture (`listing_bms_event_1`) untouched → acceptance-safe.
3. **Engagement fields stay display-derived** (alerts, wave) — genuinely not in the `wants`
   schema; no schema change. Computed in ONE frontend place so real + mock rows render the same.
   `matchesThisWeek` is **real** (`want_matches` count), never also faked.
4. **Wave = Standard (free tier) for all**; Priority/High are Plus (Plans screen). Drop the
   `"Priority"` needle.
5. **Needles reworked** to the real seeded state: drop `"Arijit…"` (a listing, not a want),
   assert real want titles; keep `"Matched"`/`"Standard"`/`"matches this week"`; count-stable.
6. Bare-call `seedWants`/`seedWantMatches` (order catalog→wants→want_matches) to avoid S3776.
   `getRequestsForBuyer` defaults `user_demo_1`. State map: open→active, matched/reserved→matched,
   fulfilled→purchased, expired/cancelled→expired. Quota used = open-want count.
7. Deploy to **dev only**.

## convex-reviewer outcome
Mechanics clean: schema fields/states/indexes line up; seeds idempotent by `wantKey`/`matchKey`;
Coldplay want + listing both land on `catalog_event_coldplay` (backfill guarded by
`!existing.catalogItemId`); demo fixture untouched (acceptance 2,400 / 2,411.80 safe). No HIGH.
Three in-scope MED items raised — all fixed:
1. **Mock didn't mirror the seed** — Convex returned 4 cards (incl. expired Alan Walker), mock had 3.
   Fixed: added the expired `want_alan_1` (Alan Walker - World Tour) to `MOCK_REQUESTS`; both paths
   now render the same 4 (activeCount stays 2). Verify needle gained `"Alan Walker - World Tour"`.
2. **`want_matches` not filtered by state** — count/`matchListingId` could include a
   declined/expired match. Fixed: `ACTIVE_MATCH_STATES = {proposed,reserved,accepted}` filter
   before counting and link selection.
3. **Buy link no longer re-validated the listing** (regression from dropping the client re-check) —
   Fixed server-side: `purchasableMatchListingId()` only emits a listing whose `state === "live"`,
   extracted as a helper so the handler's S3776 complexity stays flat.
LOW (now closed interim): `getRequestsForBuyer` originally took a client-supplied `buyerId`.
CodeRabbit flagged the cross-user read; since the only caller passes `{}`, the arg was removed and
the query is pinned to the demo buyer (`args: {}`). Full `ctx.auth.getUserIdentity()` ownership
enforcement still lands with the auth slice — but the cross-user read hole is gone now.

## CodeRabbit cycle (PR #29)
3 actionable comments, all valid, all fixed:
1. **buyerId ownership (Major)** — removed `args.buyerId`; pinned to `DEMO_BUYER_ID` (see above).
2. **dataAdapter empty-result fallback (Major)** — dropped `requests.length === 0` from the
   shape guard; a genuine empty result now passes through (validate `activeCount`/`quotaTotal`
   numbers + every `id` is a string instead). Stops a real no-requests user seeing demo cards.
3. **design.md mock count (Minor)** — synced 3→4 (Alan Walker).
Re-probed dev after fixes: Coldplay matched → Buy `listing_event_coldplay_1` (live), matchesThisWeek 1;
Dune/Goa active; Alan Walker expired. Both build paths verify green (Convex 22 pages, mock 18).
