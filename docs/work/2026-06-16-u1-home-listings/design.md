# U1 — Home (two zones) + Listings tab

- **Slug:** `u1-home-listings` · **Branch:** `feat/u1-home-listings` (off master `c103e71`)
- **Date:** 2026-06-16 · **Owner:** Claude (mobile UI) · **Classification:** Standard
- **Design is LOCKED** — this executes the documented plan, not a fresh design:
  - `docs/work/2026-06-12-ui-revamp/design.md` §5 (screens) + §7 (visual language)
  - `zwapit-ui-revamp-preview.html` frames **01 Home** (L469) + **06 Listings** (L774)
  - `pr-roadmap.md` Wave-1 **U1** row
  - The v5 Home draft already built on `feat/v5-screens` (`home.astro` @ add3944) — reuse it.

## Purpose
F1 shipped the design-system foundation; the actual screens still render the old
transitional UI. U1 delivers the first two v5 **screens** so the landing + browse
experience matches the reference: the two-zone **Home** and the **Listings**
marketplace tab (which currently 404s as a forward nav link).

## Success criteria
1. `/app/home` renders the v5 two-zone Home (own `home-top`, hero, "Set an alert" CTA,
   protected-payment trust band, Official/Community segment + genre chips, Official
   Notify-me rail [demo until catalog backend], Community rail wired to real mock
   listings → each links to the listing detail). No generic `.pbar` header (`hideHeader`).
2. `/app/listings` is a **real route** (no longer a forward-404): v5 marketplace —
   `home-top` ("Community listings"), section `tabrow` (Latest · Trending · Discounted ·
   Ending Soon · Near Me), poster-card carousel + `rowcard` list, wired to mock listings.
   Listings nav tab lights up (rose); Sell FAB shown.
3. **Discount integrity** (design.md §8.6): a `.disc` "% off" badge renders **only** when
   the listing has a verified original price; otherwise show plain "Seller price".
4. All gates green: `astro check`, `bun run build`, `bun test`, acceptance, smoke,
   route-coverage. Acceptance harness + route contract updated for the v5 Home content
   and the now-real `/app/listings` route.
5. Fidelity to the locked frames; reuse F1's CSS/sprite/shell verbatim — **no new CSS**.

## Out of scope
- Search, Requests, Listing detail redesign, Sell redesign, Profile (U2–U7).
- Real catalog / Notify-me wiring (backend, Codex) — Official rail uses demo content.
- Real discount/verified-original-price data (B3, Codex) — the integrity helper reads
  whatever the mock provides; with no verified original it shows "Seller price".
- Any backend, schema, or `src/lib/types.ts` change.

## Approach selected
Markup + mock-data wiring only, on top of F1's locked design system:
- **Home:** reuse the `feat/v5-screens` `home.astro` draft (port preview frame 01),
  community rail wired to `loadListingFlowView()` mock listing(s) → `/app/listings/:id`.
- **Listings:** new `src/pages/app/listings/index.astro` (port preview frame 06),
  `AppShell routeId="/app/listings"`, sections rendered from mock listings.
- **Discount integrity:** new pure helper `src/lib/ui/listingBadges.ts` —
  `discountBadge(listing) → { percent } | null` (null unless a verified original price
  exists and is higher than the listing price). Unit-tested. Reused by Home + Listings.
- **Routing contract:** `/app/listings` moves from `knownForwardRoutes` to a real built
  route in `scripts/verify-first-visible-slice.mjs` + `docs/IMPLEMENTATION_CONTRACT.md`;
  update the `/app/home` acceptance assertions to the v5 content (drop "Buy with
  Protection" — a detail-page button; add the v5 Home strings).

## Constraints
- UI LOCKED to v5 (design.md §7): reuse the ported classes; no new fonts/accent
  colors/emoji/flat cards; `.sweep` stays on the Buy CTA only (not used here).
- Mock-first: build against `src/lib/convex/dataAdapter`; no backend calls.
- Don't touch `convex/schema.ts` or `src/lib/types.ts` (Codex). `package.json` untouched.
- Existing routes keep rendering; `astro check` green.

## Edge cases (decided)
- **No listings in mock** → Home community rail + Listings list render an empty state
  (reuse a simple "nothing yet" row); page still renders with `data-route-id`.
- **Listing has no verified original price** → no `.disc`; show "Seller price" (integrity).
- **`/app/listings/:id` (detail)** stays the existing transitional page (U4 redesigns it);
  Listings rows link to it — flow stays live.
- **Official rail** items are demo/static (no catalog yet); Notify-me buttons are inert
  visual state (no backend) — labelled honestly, not faking functionality.

## Ambiguity policy
7-dimension rubric (per /dev decision gate): ≥80% confidence → proceed + document;
<80% → stop and ask. Fidelity to the locked frames is the tie-breaker.

## Technical Research
- **DRY (executed):** the v5 CSS (`.tabrow .poster-card .rowcard .carousel .home-top
  .seg .gchips .req-cta .trust-band .disc .notify-btn`…) is already in `global.css`
  (F1, verbatim); the icon sprite + `AppShell`/`BottomNav`/`Icon` exist; `navMap.resolveNav`
  already maps `/app/listings`→listings tab and `/app/listings/:id`→detail (no nav change).
  Home markup exists on `feat/v5-screens`. → **Reuse, don't recreate.** No new CSS.
- **Blast-radius (real-route promotion):** `/app/listings` is in `knownForwardRoutes`
  (`verify-first-visible-slice.mjs:43`) + linked by `BottomNav`/Home. Promote it to a
  built contract route (add to `routes`, drop from `knownForwardRoutes`; add to
  `docs/IMPLEMENTATION_CONTRACT.md`). Home rewrite changes `/app/home` acceptance strings.
- **OWASP:** presentational + mock data. A03 (XSS): Astro auto-escapes; no `set:html`,
  no user input rendered. A05/A10: no new external/network calls (Official rail is
  static). Others N/A. No secrets/auth/data surface.
- **TDD scenarios:**
  1. **Happy:** `discountBadge({listingPrice:1250, originalPriceVerified:true, originalPrice:1500})`
     → `{percent:17}`.
  2. **Error/none:** `discountBadge({listingPrice:1250})` (no verified original) → `null`
     (renders "Seller price").
  3. **Edge:** verified original ≤ listing price → `null` (never a 0%/negative badge).
  4. **Render gate:** `/app/listings` builds with `data-route-id="/app/listings"` + section
     tabs; `/app/home` renders the v5 content; `resolveNav('/app/listings')` → listings tab
     (existing navMap test extended); acceptance + route-coverage green.
