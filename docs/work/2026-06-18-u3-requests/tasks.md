# U3 — Requests tab · tasks

Mock-first v5 Requests screen + route promotion. Mirrors U1/U2. RED-GREEN-REFACTOR per task.
Folds in U2 review lessons up front: `should…when…` test names, `Number.NaN`/`Number.isNaN`
guards, all non-nav controls as `<button type="button">`, `.reqcard` list via `.map`.

## Task 1 — request helpers (pure, tested)
- **File(s):** `src/lib/ui/requests.ts` (new), `src/lib/ui/__tests__/requests.test.ts` (new)
- **OWNS:** `src/lib/ui/requests.ts`, `src/lib/ui/__tests__/requests.test.ts`
- **What:**
  - `export function requestQuota(used: number, total: number): { label: string; percent: number }`
    — `label` = `"${u} / ${t} active requests"`; `percent` = `round(used/total*100)` clamped to
    `0..100`. Guards: `Number.isNaN`/non-finite/`total<=0`/`used<0` → percent `0` (label still
    shows the raw numbers, or `0`-floored where the input is non-finite). Never use bare `NaN`.
  - `export function requestStateMeta(state): { label: string; chip: string }` over
    `"active"|"matched"|"purchased"|"expired"` → `{Active,req} {Matched,live} {Purchased,protect}
    {Expired,mut}`; unknown → Active default.
- **TDD (names in `should…when…`):**
  1. Write tests: quota label+percent for (2,3)→67, (0,3)→0, (5,3)→100 clamp, (-1,0)/`Number.NaN`
     → percent 0; stateMeta for each of the 4 states + unknown default.
  2. Run → fails (module missing).
  3. Implement helpers.
  4. Run → passes.
  5. Commit `test(u3): add request quota + state-meta helpers with tests`.
- **Expected:** bun test green; +2 files.

## Task 2 — `/app/requests` v5 screen
- **File(s):** `src/pages/app/requests.astro` (new)
- **OWNS:** `src/pages/app/requests.astro`
- **What:** v5 Requests screen under `AppShell routeId="/app/requests" title="Requests" hideHeader`,
  spec §4 order. Import depth `../../`. Reuse `Icon`, `formatInr`, `formatDateTime`,
  `transferModeLabel`, `discountBadge`, `isLiveResale`, `loadListingFlowView`, and the Task 1
  helpers. Sections:
  1. `.home-top`: `.wordmark` "Your requests" + a display-only `<button type="button" class="city gl">`
     `<Icon name="plus"/>New`.
  2. `.quota gl`: `.qtop` `<b>{requestQuota(2,3).label}</b><span>Free plan</span>`; `.track`
     `<i style={width:${requestQuota(2,3).percent}%}>`; `.qsub` a benefit line (no exclamation).
  3. State filter `.seg gl` (margin-top): `<button type="button" class="on">Active</button>` +
     Matched / Purchased / Expired buttons.
  4. A typed local `requests` array `.map`-ed to `.reqcard` (the Matched one `.reqcard.hot`). Each:
     `.rhead` (`.icbx` Icon + `<h5>` title + `.sub` venue/date + state `<span class={chip ...}>`
     from `requestStateMeta`), `.reqmeta` (`.b` "Up to {formatInr(budget)}" + `.alertglyphs` with
     armed types `.ic.on`), `.matchrow` (`.p` Icon spark + `.d` "N matches this week" + `.wave-pill`
     Standard/Priority/High). For the wired Matched card the `.matchrow` ends in
     `<a class="buy" href={/app/listings/${item.id}}>Buy</a>` from `loadListingFlowView`+`isLiveResale`;
     other cards show no Buy. `.reqactions` (`<button type="button" class="btn btn-ghost">`
     Edit / Pause).
  5. `.nudge`: `.bdg` Icon gift + `<b>` "Invite 3 verified friends → one extra request and earlier
     alerts." + `<button type="button" class="btn btn-ghost">See referrals</button>`.
- **Icons:** verify each name in `Icon.astro`; reuse closest existing sprite; only if a glyph is
  truly absent, add it additively (no API change). Document any addition in decisions.md.
- **TDD:** Task 3 acceptance + buyer-smoke mustContain are the RED→GREEN proof; build must compile.
- **Commit** `feat(u3): add v5 Requests screen wired to one mock match`.
- **Expected:** astro check 0 err; page renders.

## Task 3 — promote `/app/requests` + make buyer-smoke data-driven
- **File(s):** `scripts/verify-first-visible-slice.mjs`, `docs/IMPLEMENTATION_CONTRACT.md`,
  `scripts/ui-smoke-buyer.mjs`
- **OWNS:** `scripts/verify-first-visible-slice.mjs`, `docs/IMPLEMENTATION_CONTRACT.md`,
  `scripts/ui-smoke-buyer.mjs`
- **What:**
  - `verify-first-visible-slice.mjs`: add `["/app/requests", "app/requests/index.html"]` to
    `routes`; remove `"/app/requests"` from `knownForwardRoutes`; add one `routeContentChecks`
    entry for `/app/requests` (Your requests, active requests, Active, Matched, Up to ₹, matches
    this week, Standard, See referrals); extend the `% off` integrity loop to include
    `/app/requests`.
  - `IMPLEMENTATION_CONTRACT.md`: add the `/app/requests` route line.
  - `ui-smoke-buyer.mjs`: **refactor to data-driven** — replace the copy-pasted per-route
    `const x = read(...); must(route, x, [...])` blocks with a `routeChecks` array of
    `[route, distRelPath, needles]` + one loop (mirrors the verify-script fix). Include a
    `/app/requests` entry. Keep the FORBIDDEN/`mustNot` sweep over all routes. Net behaviour
    identical; removes the SonarCloud new-code-duplication surface for U3+.
- **TDD:** assertions RED before Task 2's page builds, GREEN after. route-coverage picks up the
  new contract route (18 routes).
- **Commit** `test(u3): promote /app/requests + make buyer smoke data-driven`.
- **Expected:** acceptance + route-coverage at 18 routes; buyer smoke covers 7 routes.

## Task 4 — premium entrance for `/app/requests` (bronze), consistent with Home/Search
- **File(s):** `src/styles/global.css` (premium block, additive)
- **OWNS:** `src/styles/global.css`
- **What:** extend the staggered rise-in entrance `:is(...)` selector to `/app/requests` (mirror
  Home/Search; bronze `--acc` inherited). Reuse the `zw-rise` keyframe; gated behind
  `prefers-reduced-motion`. No new component CSS — entrance choreography only.
- **TDD:** computed-style probe (`animation-name: zw-rise` on the sections).
- **Commit** `feat(u3): premium entrance on Requests, consistent with Home/Search`.
- **Expected:** build ok; entrance applies on `/app/requests`.

## Task 5 — verify gate + /dev exit review
- **What:** fresh astro check, build, bun test, acceptance, ui-smoke buyer+seller, route-coverage,
  audit — all green. Then the adversarial /dev exit review (lenses) over the U3 diff; fix
  confirmed findings. Computed-style fidelity probe on `/app/requests`. Confirm SonarCloud risk:
  the only new-code duplication surface is the verification scripts, both now data-driven.
- **Expected:** all gates green; ready for `/validate → /ship`.
