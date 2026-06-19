# U7 — Create Request / Set an alert · tasks

Mock-first v5 §3 screen at /app/requests/new + route promotion + rewire entry CTAs.
Standard slice, mirrors U5/U6. Review lessons folded in: `<button type="button">` for non-nav
controls, `Number`-safe steppers, single-line new verify entry, no new CSS.

## Task 1 — `/app/requests/new` v5 screen
- **File(s):** `src/pages/app/requests/new.astro` (new)
- **OWNS:** `src/pages/app/requests/new.astro`
- **What:** v5 §3 screen under `AppShell routeId="/app/requests/new" title="Set an alert" hideHeader`.
  Import depth `../../../`. Reuse `Icon`, `formatInr`. Sections (spec §3 order):
  1. `.pbar`: back `<a href="/app/requests">` (i-back) + h1 "Set an alert".
  2. Step strip `.steps`: Category → Item → Budget → Alerts (`.step`/`.step-ln`, first `.on`/done).
  3. Category `.tiles`: Movie(film)/Event(music)/Bus(bus)/Voucher(voucher)/Pass(pass); Movie `.sel`
     default; each `<button type="button" class="tile gl">`.
  4. Catalog: `.searchbar gl` (sample query, display), then `.catres` rows (2-3 mock canonical items);
     one `.catres.sel` with the detail line "Dune · PVR Orion · Sat 21 Jun · 9:30 PM · English · IMAX 3D".
     Rows are `<button type="button">`.
  5. Social proof `.buyerwait`: i-people "You + 124 others waiting for this show" + "One alert, shared
     by everyone watching this show."
  6. Budget card (`.gl`): `.formrow` "Max price per ticket" + `.stepper` (₹); `.formrow` "Tickets" +
     `.stepper`; `.formrow` "Alert me until" + a display value (e.g. "20 Jun 2026").
  7. Alerts `.chan-row` list: Availability(bell)/Discount(tag)/Price-drop(drop)/Last-minute(zap),
     each with a one-line benefit sub + a `.toggle` (`aria-pressed`); Availability+Discount on default.
  8. `.note`: "We'll alert you when this becomes available — booking is never guaranteed."
  9. Submit block: `<a class="btn btn-primary" href="/app/requests">Create request & alert me</a>`
     (mock — navigates to the list; no real mutation). No `.sweep`.
- **Client `<script>` (light, null-guarded, mock):** category-tile select toggles `.sel`; alert
  `.toggle`s flip `.on` + aria-pressed; budget/qty steppers adjust a `Number`-safe value + display.
  No persistence, no submit logic (the CTA is a plain link).
- **TDD:** Task 2 acceptance + buyer-smoke mustContain is the RED→GREEN proof; build must compile.
- **Commit** `feat(u7): add v5 Set-an-alert (create request) screen`.

## Task 2 — promote route + rewire entry CTAs + bronze entrance
- **File(s):** `scripts/verify-first-visible-slice.mjs`, `docs/IMPLEMENTATION_CONTRACT.md`,
  `scripts/ui-smoke-buyer.mjs`, `src/styles/global.css`, `src/pages/app/home.astro`,
  `src/pages/app/search.astro`, `src/pages/app/requests.astro`
- **OWNS:** those files
- **What:**
  - `verify-first-visible-slice.mjs`: add `["/app/requests/new", "app/requests/new/index.html"]` to
    `routes`; add ONE single-line `/app/requests/new` `routeContentChecks` entry ("Set an alert",
    "Category", "Movie", "Max price per ticket", "Availability", "Create request & alert me").
  - `IMPLEMENTATION_CONTRACT.md`: add the `/app/requests/new` route line.
  - `ui-smoke-buyer.mjs`: add a light `/app/requests/new` entry (data-route-id + 2-3 needles).
  - `global.css`: extend the `zw-rise` entrance `:is(...)` to `/app/requests/new` (bronze inherited).
  - Rewire CTAs → `/app/requests/new`: home.astro req-cta "Create a request" + home empty-state
    "Create a request"; search.astro empty-state "Create a request instead"; requests.astro "New"
    button → `<a href="/app/requests/new" class="city gl">…New</a>`. Keep home bell-nav on `/app/requests`.
- **TDD:** acceptance RED before Task 1 builds, GREEN after; route-coverage picks up the new route
  (16 routes) and the rewired CTAs resolve.
- **Commit** `test(u7): promote /app/requests/new + rewire create-request CTAs + entrance`.

## Task 3 — verify gate + /dev exit review
- **What:** fresh astro check, build (+1 route), bun test, acceptance, buyer + seller smoke,
  route-coverage, audit — all green. Then the adversarial /dev exit review (spec-fidelity,
  a11y/CodeRabbit, route-integrity, duplication, copy-discipline); fix confirmed findings. Confirm
  the flat `requests.astro` + `requests/new.astro` coexistence builds cleanly and no rewired CTA dangles.
- **Expected:** all gates green; ready for `/validate → /ship`.
