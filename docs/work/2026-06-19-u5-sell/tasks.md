# U5 — Sell flow consolidation · tasks

Consolidate the 5-route Sell wizard into ONE v5 §8 upload-first screen at `/app/sell`.
Critical change. Reuse every seller helper; preserve the Publish click-path behavior.
Folds in review lessons: `should…when…` tests, `Number.NaN` guards, `<button type="button">`
for non-nav controls, data-driven checks, single-line new verify entries.

## Task 1 — new §8 CSS + steel entrance (additive)
- **File(s):** `src/styles/global.css` (additive premium block)
- **OWNS:** `src/styles/global.css`
- **What:** add `.sell-steps`/`.sstep` (step progress indicator) and `.drop-sched` (auto
  price-drop block), styled to the v5 system (steel `--acc`, `.gl`). Extend the `zw-rise`
  entrance `:is(...)` to include `/app/sell`. No other component CSS (everything else exists).
- **Commit** `feat(u5): add sell-steps + drop-sched CSS and steel entrance`.

## Task 2 — consolidated `/app/sell` v5 screen
- **File(s):** `src/pages/app/sell/index.astro` (rewrite)
- **OWNS:** `src/pages/app/sell/index.astro`
- **What:** rewrite as the v5 §8 upload-first screen under `AppShell routeId="/app/sell"
  hideHeader`. Sections in spec order: topbar "List a ticket" + `.sell-steps` (Upload → Details
  → Price → Review); `.dropzone` ("Upload your ticket" / "Drop a screenshot or PDF — we'll read
  the details." + `.fmt`/`.formats` PDF·PNG·JPG); demand band (reuse `.buyerwait`, bronze: "52
  people looking · High interest" + "We never share buyer details or budgets."); `.catres`
  detected item summary (from the seeded mock draft); price `.formrow`s ("Your price" `.stepper`,
  "Original price (optional)" + "Verify to show a discount badge.", read-only "Discount %") +
  "Mark as urgent" toggle; optional `.drop-sched` ("Auto price-drop" toggle + static preview note,
  display-only); eligibility `.tiles`/`.tile` ("Can list" jade ✓ / "Can't list" muted ✕); "Your
  orders" `.order-metal` with "View sales" → `/app/sell/orders`; `.stickybar` with the inline
  **seller-promise** checkbox + "Publish listing" button.
- **Client `<script>` (port from promise.astro):** read carried draft + in-page price; on Publish
  click `preventDefault`; if the promise checkbox is unchecked → show warning "Accept the seller
  promise to continue.", no nav; if checked → `submitSellerListingDraft(draft)`, on success
  persist `SELLER_PUBLISHED_STORAGE_KEY` and navigate to `/app/sell/orders`. Phone gate the Publish
  via the existing `gateProtectedActionLink`/AuthActionGate pattern (unverified → `/app/me?next=/app/sell`).
- **TDD:** Task 4 acceptance + seller-smoke (rewritten) is the RED→GREEN proof; build must compile.
- **Commit** `feat(u5): consolidated v5 upload-first Sell screen with inline publish`.

## Task 3 — retire the 4 wizard sub-routes
- **File(s):** delete `src/pages/app/sell/upload.astro`, `confirm.astro`, `price.astro`, `promise.astro`
- **OWNS:** those 4 files
- **What:** `git rm` the four sub-route pages. Confirm no remaining inbound links reference them
  (the only links were intra-wizard; the FAB + contract target `/app/sell`).
- **Commit** `feat(u5): retire /app/sell/{upload,confirm,price,promise} (folded into /app/sell)`.

## Task 4 — rewrite contract + acceptance + seller smoke
- **File(s):** `docs/IMPLEMENTATION_CONTRACT.md`, `scripts/verify-first-visible-slice.mjs`,
  `scripts/ui-smoke-seller.mjs`
- **OWNS:** those 3 files
- **What:**
  - Contract: drop the `/upload /confirm /price /promise` lines; update the `/app/sell` line to
    "Sell — one upload-first screen (upload → details → price → publish)". Keep `/app/sell/orders`.
  - `verify-first-visible-slice.mjs`: remove the 4 sub-routes from `routes[]`; remove their 4
    `routeContentChecks` entries; add ONE single-line `/app/sell` content entry (List a ticket,
    Upload your ticket, people looking, Your price, Can list, Publish listing); keep `/app/sell` in
    the `appRoutes` nav check and `/app/sell/orders` as-is. Extend the `% off` integrity loop to
    `/app/sell` (no fabricated discount).
  - `ui-smoke-seller.mjs`: rewrite so the single `/app/sell` screen is smoke-checked, and **move
    the Promise click-path test onto the consolidated screen** (location.pathname `/app/sell`, load
    the index module script, simulate unchecked → preventDefault + warning + no nav; checked →
    submit + navigate to `/app/sell/orders` + persisted published banner). Keep the `/app/sell/orders`
    checks.
- **Commit** `test(u5): rewrite contract + acceptance + seller smoke for the single Sell screen`.

## Task 5 — verify gate + /dev exit review
- **What:** fresh astro check, build (route count −4), bun test, acceptance, buyer (7) + seller
  smoke (rewritten), route-coverage, audit — all green. Then the adversarial /dev exit review
  (spec-fidelity, a11y/CodeRabbit, duplication, copy-discipline, route-integrity); fix confirmed
  findings. Confirm no dangling references to the removed routes anywhere.
- **Expected:** all gates green; ready for `/validate → /ship`.
