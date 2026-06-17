# U1 — Task list (TDD-first, run by `/dev`)

Single track, sequential. Reuse F1's locked v5 CSS/sprite/shell verbatim — **no new CSS**.
Markup source of truth: `zwapit-ui-revamp-preview.html` frame **01 Home** (L469-548) +
frame **06 Listings** (L774-815). Home may reuse the `feat/v5-screens` draft
(`git show feat/v5-screens:src/pages/app/home.astro`). `astro check` + `bun test` green per task.

Ordering: shared helper → screens → contract/harness → verify.

---

## T1 — Discount-integrity helper + tests (TDD core)
- **OWNS:** `src/lib/ui/listingBadges.ts`, `src/lib/ui/__tests__/listingBadges.test.ts`
- **What:** pure `discountBadge(listing) → { percent: number } | null`. Returns a percent
  **only** when the listing has a verified original price strictly greater than the
  listing price (design.md §8.6 integrity rule); otherwise `null` (caller shows "Seller
  price"). Read fields defensively (mock has no verified-original yet → returns null).
  `percent = Math.round((1 - listingPrice/originalPrice) * 100)`.
- **TDD:**
  1. RED: write `listingBadges.test.ts` — verified original 1500 vs 1250 → `{percent:17}`;
     no verified original → `null`; verified original ≤ price → `null`. Run → fails (module missing).
  2. GREEN: implement the pure function (no Astro/DOM imports).
  3. `bun test src/lib/ui` green.
  4. Commit: `feat(u1): add discount-integrity badge helper with tests`
- **Expected:** importable from `.astro`; current mock listing → `null` (→ "Seller price").

## T2 — Home → v5 two-zone screen
- **OWNS:** `src/pages/app/home.astro`
- **What:** rewrite to the v5 Home (port frame 01 / reuse the `feat/v5-screens` draft):
  `AppShell routeId="/app/home" hideHeader`; `home-top` (city + alerts bell), hero-copy,
  `req-cta` → `/app/requests`, `trust-band`, Official/Community `seg`, `gchips`
  (Movies/Events/Bus), Official Notify-me `carousel` (demo content — catalog backend
  pending), `divider` "Community listings", Community `rowcard`s wired to
  `loadListingFlowView()` mock listing(s) → `/app/listings/:id`, using `discountBadge`
  (T1) for the `.disc` vs "Seller price". Empty mock → simple empty row.
- **TDD:**
  1. RED: grep built/dev `/app/home` for `home-top` + "We'll notify you when it's
     available." → absent (old transitional home).
  2. GREEN: implement; `astro check` green.
  3. Verify in preview: `home-top` present, no `.pbar`, community row → `/app/listings/:id`.
  4. Commit: `feat(u1): rebuild Home as the v5 two-zone screen`
- **Expected:** `/app/home` matches frame 01; real listing in the community rail.

## T3 — Listings tab (new marketplace screen)
- **OWNS:** `src/pages/app/listings/index.astro`
- **What:** new page (port frame 06): `AppShell routeId="/app/listings"` (listings tab
  rose, Sell FAB); `home-top` "Community listings" + search icon; section `tabrow`
  (Latest · Trending · Discounted · Ending Soon · Near Me — first active, others visual);
  poster-card `carousel` + `rowcard` list wired to mock listings via `loadListingFlowView`
  + `discountBadge` (T1). Sparse mock is fine; any static sample entries must be clearly
  sample data (no faked interactivity), consistent with the Home official rail. Rows link
  to `/app/listings/:id`.
- **TDD:**
  1. RED: build → `/app/listings/index.html` does not exist yet (404 forward route).
  2. GREEN: create the page; `astro check` + `bun run build` produce `app/listings/index.html`
     containing `data-route-id="/app/listings"` + the 5 section labels.
  3. Verify in preview: Listings tab active (rose); FAB shown; rows link to detail.
  4. Commit: `feat(u1): add v5 Listings marketplace tab`
- **Expected:** `/app/listings` renders (no longer 404); nav Listings tab works.

## T4 — Promote `/app/listings` to a real contract route + acceptance updates
- **OWNS:** `scripts/verify-first-visible-slice.mjs`, `docs/IMPLEMENTATION_CONTRACT.md`
  (and `scripts/route-coverage.mjs` only if it hard-codes the route set)
- **What:**
  - `verify-first-visible-slice.mjs`: add `["/app/listings", "app/listings/index.html"]`
    to `routes`; **remove** `/app/listings` from `knownForwardRoutes`; add a
    `routeHrefToBuiltFile` mapping for the bare `/app/listings` (distinct from the
    `/app/listings/` detail prefix); add a `/app/listings` `mustContain` (the 5 section
    labels); update the `/app/home` `mustContain` to the v5 content (drop "Buy with
    Protection" — detail-only; add "We'll notify you when it's available.", "Set an alert",
    "Community listings").
  - `docs/IMPLEMENTATION_CONTRACT.md`: add the `/app/listings` route line so
    `route-coverage.mjs` checks it renders + has its `data-route-id`.
- **TDD:**
  1. RED: `bun scripts/verify-first-visible-slice.mjs` fails on the new home content /
     `/app/listings` until the screens (T2/T3) + this update land.
  2. GREEN: apply the updates; `bun scripts/verify-first-visible-slice.mjs` +
     `bun run check:routes` pass.
  3. Commit: `test(u1): promote /app/listings to a real route + v5 Home acceptance`
- **Expected:** acceptance + route-coverage green with `/app/listings` as a built route.

## T5 — Verify gate
- **OWNS:** none (verification only)
- **What/TDD:** fresh output for each — `bunx astro check` (0 errors), `bun run build`
  (incl. `/app/listings`), `bun test` (incl. listingBadges + existing navMap `/app/listings`
  assertion), `bun scripts/verify-first-visible-slice.mjs`, `bun scripts/ui-smoke-buyer.mjs`
  + `ui-smoke-seller.mjs`, `bun run check:routes`, `bun audit`. Fidelity pass: Home + Listings
  match frames 01/06; no new fonts/colors/emoji; `.sweep` not introduced here.
- **Expected:** all gates green; ready for `/validate` → `/ship`.

---

### Notes
- **No new CSS/icons** — reuse F1's `global.css` + sprite. navMap already maps
  `/app/listings`→listings tab and `/app/listings/:id`→detail (no nav change).
- **YAGNI:** T1→criteria #3, T2→#1, T3→#2, T4→#4, T5→#4. No unanchored tasks.
- **Do not edit** `convex/schema.ts`, `src/lib/types.ts`, `package.json`.
- The harness/contract edits (T4) are Codex-owned test territory; updated here because
  Codex is unavailable and the route promotion is intrinsic to shipping the screen.
