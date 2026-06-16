# F1 — Task list (TDD-first, run by `/dev`)

Single track (F1 is one PR; tasks run sequentially). Source of truth for all CSS/markup =
`docs/work/2026-06-12-ui-revamp/zwapit-ui-revamp-preview.html` (LOCKED). Copy byte-for-byte
where noted. `astro check` + `bun test` must be green at the end of each task.

Ordering: foundation (deps, tokens, CSS, logic) → chrome (layout, nav, shell) → verify.

---

## T1 — Bundle fonts via @fontsource, drop Poppins
- **OWNS:** `package.json`, `bun.lock`  ⚠️ **shared file** (fonts only — flagged in design.md)
- **What:** add `@fontsource/fraunces` + `@fontsource/space-grotesk` (caret-pinned like the
  existing `@fontsource/poppins`); remove `@fontsource/poppins`. Run `bun install`.
- **TDD:**
  1. RED: `bun install` then `bun pm ls` — assert poppins absent, fraunces + space-grotesk
     present (or grep `package.json`). Fails before the edit.
  2. GREEN: edit deps, `bun install`.
  3. Confirm `bun install` exits 0 and lockfile updates.
  4. Commit: `chore(f1): bundle Fraunces + Space Grotesk, drop Poppins`
- **Expected:** both font families resolvable from `node_modules/@fontsource/*`.

## T2 — Port the full v5 token + component CSS into global.css
- **OWNS:** `src/styles/global.css`
- **What:** append, **after** the existing Tailwind block, the v5 `:root` tokens (preview
  lines 12–17) and the full component CSS (lines 74–391) **verbatim**. **Exclude** harness
  selectors (`.page-head .flow .frames .frame-col .frame-label .frame-notes .stage .phone
  .screen .statusbar`). Do **not** remove or alter the Tailwind layer. Add the adapted
  shell-root rule (see design.md §C): an `.app-root` (or shell) class with v5 `--bg`
  charcoal + the `.screen` radial-`--acc` glow, and fixed `.bnav`/`.fab` honoring
  `env(safe-area-inset-bottom)`.
- **TDD:**
  1. RED: grep `global.css` for `.gl{` and `--rose:` → absent.
  2. GREEN: paste the verbatim CSS + adapted shell-root rule.
  3. Confirm grep finds tokens + a sample of each primitive (`.gl .btn-primary .chip
     .alert-card .quota .wave-pill .notify-btn .disc .sweep`); confirm harness selectors
     absent (`.frame-col`, `.phone`, `.statusbar`).
  4. `astro check` green (CSS doesn't break the build).
  5. Commit: `feat(f1): port locked v5 token + component CSS (coexist with Tailwind)`
- **Expected:** v5 classes available globally; existing Tailwind utilities still work.

## T3 — Route→nav resolver + tab table (the only logic; full TDD)
- **OWNS:** `src/lib/ui/navMap.ts`, `src/lib/ui/__tests__/navMap.test.ts`
- **What:** export `TABS` (the 5 bottom-nav items: `{ key, label, href, icon }` for
  Home/Search/Requests/Listings/Profile) and `resolveNav(routeId) → { tab, accent, showFab }`
  per design.md §5 + edge-case table. Accent hexes: home `#8E7BC9`, search `#7FA3C4`,
  requests `#C98B5F`, listings `#F23D7F`, profile `#D9A84E`.
- **TDD (write tests first):**
  1. RED: add `navMap.test.ts` with the 3 scenarios from design.md (happy, unknown-default,
     dynamic/flow/legacy) + assert `TABS.length === 4`? **No — `TABS.length === 5`**. Run →
     fails (module missing).
  2. GREEN: implement `TABS` + `resolveNav` (prefix-match dynamic routes; explicit legacy
     map for `/app/me`,`/app/tickets`,`/app/orders`; default for unknown).
  3. REFACTOR: extract the route→accent table to a const map; keep pure (no Astro imports).
  4. `bun test src/lib/ui` green.
  5. Commit: `feat(f1): add routeId→nav/accent resolver with tests`
- **Expected:** all scenarios pass; function is pure and importable from `.astro`.

## T4 — Icon sprite + Icon helper
- **OWNS:** `src/components/IconSprite.astro`, `src/components/Icon.astro`
- **What:** `IconSprite.astro` = the hidden `<svg width="0" height="0" …><defs>` + all
  `<symbol>` defs **verbatim** (preview lines 396–440). `Icon.astro` props `{ name, size? }`
  → `<svg class:list={["ic", size]}><use href={`#i-${name}`}/></svg>`.
- **TDD:**
  1. RED: render `Icon name="home"` in a scratch page / assert sprite file contains
     `id="i-home"` and `id="i-out"` (grep). Absent first.
  2. GREEN: create both files.
  3. Confirm grep finds the full symbol set; `astro check` green.
  4. Commit: `feat(f1): add SVG icon sprite + Icon helper`
- **Expected:** `<use href="#i-…">` resolves once the sprite is mounted (T5).

## T5 — AppLayout: swap fonts, mount sprite once, charcoal base
- **OWNS:** `src/layouts/AppLayout.astro`
- **What:** replace the 4 Poppins imports with the needed Fraunces + Space Grotesk weights
  (`@fontsource/fraunces/...`, `@fontsource/space-grotesk/...`); render `<IconSprite />`
  once inside `<body>` (before `<slot/>`) so `<use>` works app-wide; keep `class="dark"`,
  `viewport-fit=cover`. (Body base bg stays Tailwind; the v5 charcoal+glow lives on the
  shell root from T2/T7.)
- **TDD:**
  1. RED: grep `AppLayout.astro` for `space-grotesk` → absent; for `poppins` → present.
  2. GREEN: swap imports, add `<IconSprite />`.
  3. `astro check` green; an existing route (e.g. `/app/home`) still builds.
  4. Commit: `feat(f1): load v5 fonts + mount icon sprite in AppLayout`
- **Expected:** fonts bundled; sprite present in every page's DOM.

## T6 — BottomNav: 5 tabs + Sell FAB
- **OWNS:** `src/components/BottomNav.astro`
- **What:** rebuild using the locked `.bnav` markup + the `.fab` ("List a ticket"). Props:
  `{ tab?: TabKey|null, showFab?: boolean }`. Render `TABS` (from navMap) with `Icon`;
  mark the active tab `.on`. FAB links to `/app/sell`, shown only when `showFab`. Keep an
  optional legacy `activeTab` prop accepted but ignored (back-compat; AppShell drives `tab`).
- **TDD:**
  1. RED: `navMap.test.ts` already asserts `TABS.length === 5` and that exactly one tab
     resolves `.on` for `/app/home`. (Astro markup is covered by the data test + astro
     check; no separate render runner needed.)
  2. GREEN: implement the component against `TABS`.
  3. `astro check` green.
  4. Commit: `feat(f1): rebuild BottomNav (5 tabs + Sell FAB)`
- **Expected:** 5 tabs + FAB render; active tab uses `--acc` stroke per locked CSS.

## T7 — AppShell: per-route ambient + glow root, back-compat props
- **OWNS:** `src/components/AppShell.astro`
- **What:** call `resolveNav(routeId)`; set `style={`--acc:${accent}`}` + the shell-root
  class (charcoal + radial glow from T2) on the outer wrapper; pass `tab`/`showFab` to
  `BottomNav`. Keep props `{ routeId, title, activeTab? }` — `activeTab` optional &
  back-compat-wide so the **12 existing pages compile unchanged**. `routeId`-derived value
  wins; `activeTab` is only a fallback override.
- **TDD:**
  1. RED: table-driven smoke — for each of the 12 existing `routeId`s, `resolveNav` returns
     without throwing and yields a hex accent (assert in `navMap.test.ts`).
  2. GREEN: wire AppShell to navMap; render glow root + BottomNav + FAB.
  3. `astro check` green with **no edits** to the 12 pages; build a legacy route
     (`/app/sell/price`, `/app/me`) — renders.
  4. Commit: `feat(f1): rebuild AppShell with per-route ambient accent`
- **Expected:** every route gets its ambient accent; existing pages untouched & rendering.

## T8 — Regression + fidelity verification (gate)
- **OWNS:** none (verification only)
- **What / TDD:**
  1. `astro check` — paste fresh green output.
  2. `bun test` — paste fresh green output (incl. `navMap` tests).
  3. `bun scripts/route-coverage.mjs` (and/or ui-smoke) — all existing routes render.
  4. Fidelity pass: visually diff shell + a sample of primitives against the locked preview
     (no new fonts/colors, no emoji, `.sweep` only on Buy CTA, harness selectors absent).
  5. Commit (if any fixes): `test(f1): verify routes render + design-system gates green`
- **Expected:** all gates green; ready for `/validate` → `/ship`.

---

### Notes
- **Forward-pointing tabs:** Search/Requests/Listings-index/Profile targets land in U1–U7;
  until then those tab links 404 by design. No stubs (scope). Home + the 12 existing pages
  render today.
- **YAGNI:** every task maps to a success criterion in design.md (T1→#5, T2→#1, T3→#3, T4→#2,
  T5→#2/#5, T6→#4, T7→#3/#6, T8→#6/#7/#8). No unanchored tasks.
- **Do not edit** `convex/schema.ts`, `src/lib/types.ts` (F2 parallel).
