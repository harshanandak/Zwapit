# U2 — Search tab · tasks

Mock-first v5 Search screen + route promotion. Mirrors U1. RED-GREEN-REFACTOR per task.

## Task 1 — `resultsLabel` helper (pure, tested)
- **File(s):** `src/lib/ui/searchResults.ts` (new), `src/lib/ui/__tests__/searchResults.test.ts` (new)
- **OWNS:** `src/lib/ui/searchResults.ts`, `src/lib/ui/__tests__/searchResults.test.ts`
- **What:** `export function resultsLabel(count: number): string` — `0`/negative/NaN → `"No matches yet"`; `1` → `"1 found"`; `n>1` → `"${n} found"`.
- **TDD:**
  1. Write test: `resultsLabel(1)==="1 found"`, `(0)==="No matches yet"`, `(5)==="5 found"`, `(-1)`/`NaN` → `"No matches yet"`.
  2. Run → fails (module missing).
  3. Implement helper.
  4. Run → passes.
  5. Commit `test(u2): add resultsLabel helper with tests`.
- **Expected:** bun test green; +1 file, +~4 expects.

## Task 2 — `/app/search` v5 screen
- **File(s):** `src/pages/app/search.astro` (new)
- **OWNS:** `src/pages/app/search.astro`
- **What:** v5 Search screen under `AppShell routeId="/app/search" title="Search" hideHeader`, rendering its own `.pbar` "Search". Sections in order: `.searchbar gl live` (sample query), category `.tabrow` (Movie active / Event / Bus / Voucher / Pass) as `<button type="button">`, `.fchips` (Bengaluru on / Price / Date / Source / More) as `<button type="button">`, `.seg gl sm` (All on / Official / Community) `<button type="button">`, `<div class="divider">Results · {resultsLabel(n)}</div>`, one display-only official sample rowcard ("Oppenheimer — IMAX 70mm" · `.chip.live` Official · "Notify me"), the wired community result(s) from `loadListingFlowView()`→`isLiveResale` as linked `.rowcard solid` (→ `/app/listings/:id`) with `discountBadge` (disc OR "Seller price") + `transferModeLabel` mode chip + `formatInr` price, and the v5 `.empty gl` "Nothing on resale yet / Create a request instead" (→ `/app/requests`) when no community result. Reuse `Icon`. Import depth `../../`.
- **TDD:** Task 3 acceptance mustContain is the RED→GREEN proof; build must compile.
- **Commit** `feat(u2): add v5 Search screen wired to mock community result`.
- **Expected:** astro check 0 err; page renders.

## Task 3 — promote `/app/search` to a real contract route
- **File(s):** `scripts/verify-first-visible-slice.mjs`, `docs/IMPLEMENTATION_CONTRACT.md`, `scripts/ui-smoke-buyer.mjs`
- **OWNS:** `scripts/verify-first-visible-slice.mjs`, `docs/IMPLEMENTATION_CONTRACT.md`, `scripts/ui-smoke-buyer.mjs`
- **What:** add `["/app/search", "app/search/index.html"]` to acceptance `routes`; remove `"/app/search"` from `knownForwardRoutes`; add `/app/search` mustContain (Search, Movie, Event, Bus, Results, Seller price, Create a request); add the `/app/search` line to the `IMPLEMENTATION_CONTRACT.md` route list + bottom-nav note; add `/app/search` to buyer smoke `must()`.
- **TDD:** assertions RED before Task 2's page builds, GREEN after. route-coverage picks up the new contract route.
- **Commit** `test(u2): promote /app/search to a real route + acceptance`.
- **Expected:** acceptance + route-coverage at 17 routes.

## Task 4 — premium entrance for `/app/search` (steel), consistent with Home
- **File(s):** `src/styles/global.css` (premium block, additive)
- **OWNS:** `src/styles/global.css`
- **What:** extend the staggered rise-in entrance to `/app/search` (mirror the Home rule; steel `--acc` inherited). Reuse the `zw-rise` keyframe; gate behind `prefers-reduced-motion`.
- **TDD:** computed-style probe (`animation-name: zw-rise` on the sections).
- **Commit** `feat(u2): premium entrance on Search, consistent with Home`.
- **Expected:** build ok; entrance applies on `/app/search`.

## Task 5 — verify gate + /dev exit review
- **What:** fresh astro check, build, bun test, acceptance, ui-smoke buyer+seller, route-coverage, audit — all green. Then the adversarial /dev exit review (lenses) over the U2 diff; fix confirmed findings. Computed-style fidelity probe on `/app/search`.
- **Expected:** all gates green; ready for `/validate → /ship`.
