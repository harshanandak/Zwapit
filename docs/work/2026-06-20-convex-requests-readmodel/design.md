# Convex Requests read-model (wants) · design

**Slug:** convex-requests-readmodel · **Date:** 2026-06-20 · **Branch:** feat/convex-requests-readmodel
**Status:** in progress · **Classification:** backend data + read-model (solo + convex-reviewer; Codex rate-limited until 2026-07-18). Free-stack aligned ($0; see catalog-data-maps-research/free-stack-decision.md).

## Purpose

Third real-data slice. Wire the **Requests** screen to the real `wants` table (now possible —
the catalog is seeded). Each request card's **identity + quota + matched payoff** come from
Convex; engagement metadata not in the schema (armed alerts, alert wave) stays display-derived.

## Approach — Path A (honest matched payoff)

The matching engine pairs a want and a listing on the **same `catalogItemId`**, so a `want_match`
must be catalogItemId-backed (seeding an unbacked match = a fabricated match, same smell as a fake
discount). So:

- **`catalog_items` += Coldplay** (live_event) and **Dune: Part Three** (movie).
- **Link** the existing Coldplay community listing (`listing_event_coldplay_1`, seeded in #27) to the
  Coldplay catalog item via `catalogItemId` (additive optional field; demo fixture untouched).
- **Seed `wants`** for buyer `user_demo_1`: Coldplay → `matched`; Dune (movie) + Bengaluru→Goa (bus)
  → `open` (active); Alan Walker → `expired`.
- **Seed one `want_match`** linking the Coldplay want ↔ the Coldplay listing (same catalogItemId) —
  honest.
- **`getRequestsForBuyer`** (defaults `user_demo_1` like `getCheckoutView`): reads wants by buyer,
  joins `catalog_items` for title/venue/date/category, counts `want_matches` per want, returns
  `{ id, state(mapped), category, title, sub, budget, matchesThisWeek, matchListingId }` + the
  active(open) count for the quota.

State map: open→active, matched/reserved→matched, fulfilled→purchased, expired/cancelled→expired.

## What stays display-derived (not in the `wants` schema — no schema change)

- **Armed alerts** (availability/discount/price-drop/last-minute glyphs) — default set, computed in
  ONE frontend place.
- **Alert wave** — free tier = **Standard** for all (Priority/High are Plus, explained on Plans).
- Icon from category. These render identically for real + mock rows.

`matchesThisWeek` is **real** (`want_matches` count) — never also display-faked.

## Frontend

- `dataAdapter.loadRequests()` → Convex `getRequestsForBuyer` (+ quota) with mock fallback = the
  current 3 mock requests + `requestQuota(2,3)`. Shape-guarded (string `id`/`title`).
- `requests.astro`: map the real requests; quota from the real active count; one helper derives
  icon/alerts/wave; matched card's Buy link → `matchListingId` (the Coldplay listing detail, which
  already prerenders). `requestStateMeta`/`requestQuota` reused.

## Dual behaviour

- Convex: real wants (Coldplay matched + Dune/Goa active + Alan Walker expired), real quota, real
  match count.
- No `PUBLIC_CONVEX_URL` (CI): mock fallback → the current 3 requests. Both gate-green.

## Needle rework (per advisor)

- Drop `"Arijit Singh Live - Silver Pass"` (a listing, not a seeded want) → assert real want titles
  (Coldplay / Dune / Bengaluru→Goa).
- Keep `"Matched"` (static seg button) + `"Standard"`; **drop `"Priority"`** (not modeled; free tier).
- Keep `"matches this week"` (Path A, real). Count-stable (no fixed quota number that differs Convex
  vs mock — assert "active requests" not "2 / 3").

## Out of scope / notes

- Alerts-armed + wave modeling (future schema), real matching mutation (internal-only), prod seed.
- New catalog rows also appear in Search's official rail (additive; "found" count grows).
- Deploy to **dev only**.
