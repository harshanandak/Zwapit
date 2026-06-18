# U2 — Search tab (v5)

- **Slug:** u2-search
- **Date:** 2026-06-17
- **Status:** planned
- **Branch / worktree:** `feat/u2-search` · `.worktrees/u2-search`
- **Classification:** Standard (new screen + route promotion; no auth/payment/schema)

## Purpose

Build the v5 **Search** screen at `/app/search` (currently a known-forward 404) and promote
it to a real contract route. Search is the universal discovery surface: find a show/listing
across categories, narrow with filters, and — when nothing is on resale — **create a
request** so we can watch and alert. Mock-first and display-led, exactly like U1: the only
wired data is the community resale result from the mock adapter; catalog/text search,
official "Notify me", and real filters are backend (Codex) and out of scope here.

Builds on F1 (design system) + U1 (Home/Listings helpers). UI locked to the v5 preview
screen "02 · Search" (steel accent `#7FA3C4`), design.md §7.

## Success criteria

1. `/app/search` renders the v5 Search screen (steel): `.pbar` "Search" → `.searchbar`
   (sample query) → category `.tabrow` (Movie/Event/Bus/Voucher/Pass) → `.fchips` filter
   chips (Bengaluru/Price/Date/Source/More) → All/Official/Community `.seg` → "Results · N
   found" divider → results (one official sample "Notify me" card + the wired community
   rowcard) → the v5 `.empty` "Create a request instead" state.
2. `/app/search` promoted to a real contract route: removed from `knownForwardRoutes`,
   added to the acceptance `routes` table + `IMPLEMENTATION_CONTRACT.md` + route-coverage +
   buyer smoke, with mustContain assertions. Search tab lights up (steel); Sell FAB shown.
3. Wired community result(s) come from the mock adapter via `isLiveResale` + `discountBadge`
   + `transferModeLabel` (reuse U1 helpers). Discount-integrity holds (no "% off" without a
   verified original price).
4. `resultsLabel(n)` — a small, tested helper renders the grammatically-correct results
   count: 0 → "No matches yet", 1 → "1 found", n → "N found".
5. a11y-correct from the start: category tabs, filter chips, and the All/Official/Community
   toggle are `<button type="button">`, not hrefless `<a>` (the U1/CodeRabbit lesson). The
   empty-state CTA links to `/app/requests`.
6. All gates green: astro check, build, bun test, acceptance, buyer+seller smoke,
   route-coverage, audit.
7. Fidelity to the locked frame; **no new component CSS** — every Search class
   (`.searchbar .fchips .fchip .tabrow .seg.sm .chip.live .empty`) already exists in the F1
   port. Premium tactile feedback already applies globally; add a steel entrance
   choreography scoped to `/app/search`, mirroring Home.

## Out of scope (backend / later waves)
- Real text/catalog search, query parsing, TMDB/event/bus catalog (Codex/Convex).
- Official availability "Notify me" wiring + the official-platform watch.
- Working category tabs / filter chips / All-Official-Community filtering (visual only).
- The Requests screen + the actual create-request flow (U3).
- Sell flow, Profile (U5/U7).

## Approach
Mirror U1 exactly: a self-padded v5 screen under `AppShell routeId="/app/search" hideHeader`
rendering its own `.pbar`, bound to `loadListingFlowView()` for the one wired community
result, with a display-only sample for the official side. Reuse every U1 helper; add only
`resultsLabel`. Promote the route through the same acceptance/contract path U1 used for
`/app/listings`.

## Edge cases (decided)
- **No community match** (mock listing not live/waitlist): show the v5 `.empty` "Nothing on
  resale yet → Create a request instead" card (reuse the U1 empty pattern) below the
  still-counted official result. The "Results · N found" count reflects all displayed
  results (the official sample + community), matching the v5 frame's "Results · 1 found"
  shown above an empty resale section — so an empty community reads "1 found", not "No
  matches yet". (Latent in the mock today — the fixture is `live`, so the count is "2 found".)
- **Results-label grammar:** 0 → "No matches yet"; 1 → "1 found"; n → "N found"; negative/NaN
  → "No matches yet".
- **Discount-integrity:** the wired result shows "Seller price" unless a verified original
  price exists (no mock has one) — pinned by the existing acceptance "% off" guard.
- **a11y:** every non-navigating control is a `<button type="button">`; the only `<a>` are
  real links (community result → /app/listings/:id, empty CTA → /app/requests). The
  searchbar is a display element this slice (no input wiring yet).

## Ambiguity policy
7-dimension rubric per the /dev decision gate. ≥80% confidence → proceed + document; <80% →
stop and ask. The design is locked to the v5 frame, so gates should be rare.

## Technical Research
- **DRY (verified in global.css):** `.searchbar`/`.searchbar.live` (255-256),
  `.fchips`/`.fchip`/`.fchip.on` (300-304), `.tabrow` (used by U1 Listings), `.seg.sm`
  (288), `.chip.live` (228), `.empty`/`.eic` (styled by `.gl`, as in U1) all already exist.
  → reuse, do not recreate. No new component CSS.
- Helpers `isLiveResale`, `discountBadge`, `transferModeLabel`, `formatInr`,
  `formatDateTime` already exist (U1) → reuse.
- **Route-promotion blast radius:** `/app/search` is in `knownForwardRoutes`
  (verify-first-visible-slice.mjs:45) and absent from `IMPLEMENTATION_CONTRACT.md` and the
  acceptance `routes` table → add in all three + route-coverage + buyer smoke.
- **OWASP:** static SSR of mock data + a pure label helper. No auth/payment/input/network
  surface. A03 injection — Astro auto-escapes; the "query" is a static display string, not
  user input this slice. A10 SSRF — the frontend makes no external calls; the empty CTA +
  result link are internal routes. No applicable risks introduced.
- **TDD scenarios:** (1) `resultsLabel(1)` → "1 found"; (2) `resultsLabel(0)` → "No matches
  yet"; (3) `resultsLabel(5)` → "5 found"; (4) negative/NaN → "No matches yet"; (5)
  acceptance: `/app/search` renders Search + section labels (RED before the page exists →
  GREEN after).
