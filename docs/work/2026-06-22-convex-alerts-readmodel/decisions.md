# Convex Alerts read-model · decisions log

## Classification
Backend read-model, NO schema change. Solo + convex-reviewer (Codex rate-limited until
2026-07-18, user-sanctioned solo backend). Free-stack aligned ($0 — reuses existing
wants/want_matches/listings; no external API).

## Key decisions (incl. advisor)
1. **No `alert_events` table** (advisor, strong): notifications/monitor/availability/matching are
   internal-only, audited, deferred, Codex-owned (CLAUDE.md). A seeded feed table would fabricate
   the output log of a non-existent system inside a frontend slice — scope creep + ownership
   crossing + fake-feed smell. Only wire what is genuinely backable.
2. **Only the match card is real**: `getAlertsForBuyer` resolves matched want → active want_match →
   live listing (same logic as the requests slice) and returns the listing's display fields. The
   official-availability card + "Earlier" feed stay static illustrative (already commented as
   placeholders); PR/handoff notes they remain illustrative until the internal watcher/notification
   system lands.
3. **Match anchor = real Coldplay**, not Arijit: no want references the fixture listing, so an
   Arijit "match for your request" card is unbacked. The real want_match is
   `want_coldplay_1` → `listing_event_coldplay_1` (live).
4. **Discount-integrity**: `discountBadge` returns null for real listings (no verified original
   price field yet) → the card shows **"Seller price"**, dropping the fabricated "13% off · was
   ₹450". Fully consistent with the integrity gate now.
5. **Buy → listing detail, not checkout**: `/app/checkout/[listingId]` prerenders only the fixture
   and ignores the param (would 404 / show the wrong listing for Coldplay). `/app/listings/{key}`
   is param-driven, prerenders all community listings (PR #27), and is the correct protection-first
   flow — matching the requests Buy link. Fixing checkout to be param-driven is a separate slice.
6. **Conventions**: `args: {}` demo-pinned; guard types-not-emptiness (empty matches valid);
   `MOCK_ALERTS` mirrors the seed; reuse `transferModeLabel`/`formatInr`/`discountBadge`;
   `seedDemoFixtureOnce`.
7. Deploy to **dev only**. No new seed data needed — the want_match + listing already exist from
   the requests slice (#29). (Add nothing to the seed.)

## convex-reviewer outcome
Backend clean: schema untouched (no new table); `getAlertsForBuyer` read-only, `args:{}` demo-pinned
(no cross-user read, no exposed mutation); live-gate + active-match-state filter correct; null-join
safe; join keys correct; `.collect()` fine at v1 scale. `loadAlerts` guards types-not-emptiness;
`MOCK_ALERTS` mirrors the seed; reuses `seedDemoFixtureOnce`/`transferModeLabel`/`formatInr`/
`discountBadge` (→ "Seller price", no fabricated discount); Buy → param-driven listing-detail route.

**One MED — acknowledged, deferred, production-safe (NOT clean):** in the **no-env (mock) build**,
the alerts match Buy link → `/app/listings/listing_event_coldplay_1`, but `loadCommunityListings`'s
mock fallback only yields `listing_bms_event_1`, so that detail path isn't prerendered → 404 if
followed. Reconciled with the advisor:
- Reviewer's fix (a) — point `MOCK_ALERTS` at the fixture `listing_bms_event_1` — is **declined on
  honesty grounds**: no want references the fixture listing, so it would manufacture an unbacked
  "Arijit match for your request" (the exact unbacked-match smell we avoid). Mock stays the real
  Coldplay match; the needle keeps asserting "Coldplay - Music of the Spheres".
- **Production-safe**: all deploys set `PUBLIC_CONVEX_URL`, so the served build prerenders coldplay's
  detail page (the 22-vs-18 page delta is exactly those community-listing detail pages). The 404
  exists only in the no-env CI artifact, which is never served.
- **Pre-existing**: #29's requests match Buy link has the identical latent 404 — this slice surfaces
  a mock-fallback limitation, it doesn't introduce one.
- **Full fix = its own slice**: making the no-env build correct needs the mock to mirror the seed
  across BOTH `loadCommunityListings` (getStaticPaths) AND `loadListingFlowView` (detail content) —
  a cross-cutting mock-infra refactor across home/listings/requests/alerts. Tracked as a follow-up;
  offered to the user as the next slice. Not smuggled into this one.

## CodeRabbit cycle (PR #31)
2 actionable comments on `loadAlerts`, both fixed:
1. **Don't show fabricated alerts on a Convex-side failure (Major)** — `MOCK_ALERTS` is now ONLY
   for the no-Convex build (`!client`); a failed/shape-drifted query with a client present returns
   `{ matches: [] }` (no match card) instead of a fabricated match. Also makes verify honest — a
   broken real query now fails the needle instead of silently passing on mock.
2. **Validate the full match shape (Minor)** — the guard now checks title/venue/listingKey are
   strings, price is a number, and transferMode is a string (transferModeLabel safely defaults on
   an unknown mode), not just `listingKey`.
Both build paths re-verified green (Convex 22 / mock 18). The no-env MED above is unchanged
(tracked follow-up).
