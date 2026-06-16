# F1 — Decisions

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| D1 | **Port the full v5 stylesheet** into `global.css` in one pass (tokens + all component CSS), not just primitives | Single source of truth, zero drift, later screen PRs become markup-only | User Q&A 2026-06-16 |
| D2 | **Bundle fonts via `@fontsource`** (Fraunces + Space Grotesk), drop Poppins | Offline-safe in Capacitor WebView, no FOUT, no runtime CDN, CSP-friendly (self-only `font-src`) | User Q&A 2026-06-16 |
| D3 | **Coexist with Tailwind** — v5 is additive; do not remove the Tailwind layer | F1 gate "all existing routes render + astro check green"; v5 classes/tokens don't collide with Tailwind utilities/oklch tokens | design.md constraints |
| D4 | **Derive ambient accent + active tab from `routeId`** via new pure `src/lib/ui/navMap.ts`; keep `activeTab` an optional back-compat override | Centralizes per-route identity in one tested map; lets the 12 existing pages stay untouched so astro check stays green | blast-radius search |
| D5 | **Exclude preview-harness selectors**; adapt only the ambient glow onto the app shell root | `.phone`/`.screen`/`.stage`/`.statusbar` style a fake device showcase, not the app; the app has no bezel | preview inspection |
| D6 | **Tab definitions (`TABS`) live in `navMap.ts`**, imported by BottomNav | Makes the "5 tabs + FAB" structure unit-testable with `bun test` (Astro components aren't trivially unit-rendered) | TDD design |
| D7 | **No stub pages** for not-yet-built tab targets; tab links point at canonical routes that 404 until U1–U7 | Roadmap F1 = "no new screens"; nav is the skeleton later waves fill | pr-roadmap.md |
| D8 | **Rebuild AppShell + BottomNav in place** (same paths) | Explicit F1 instruction; keeps importers stable | F1 brief |

## Open follow-ups (not F1)
- Existing 12 pages render *transitionally* (Tailwind content on the v5 charcoal shell)
  until their wave PR (U1/U4/U5/U6/U7) redesigns them to v5 — expected, not a regression.
- `package.json` font deps are F1's only shared-file edit; coordinate if F2/Codex also
  needs to touch `package.json` (unlikely for schema work). **Confirmed 2026-06-16: Codex is
  not active on this — no coordination needed.**

---

## /dev session (2026-06-16)

### Decision 1
- **Task:** T1 — bundle fonts
- **Gap:** tasks.md says T1 both adds the new fonts and removes `@fontsource/poppins`. But
  `AppLayout.astro` still imports Poppins until T5, so removing it in T1 would break
  `astro check`/build between T1 and T5.
- **Score:** 1/14 (only dim 1 — touches T5 too; reversible, no schema/security/API).
- **Route:** PROCEED.
- **Choice:** T1 only **adds** Fraunces + Space Grotesk. The Poppins removal moves to **T5**,
  atomic with the import swap, so every intermediate commit stays green.
- **Status:** RESOLVED.

### Decision 2 (BLOCKED — pending developer input)
- **Task:** T8 — regression gate
- **Gap:** The pre-revamp "first visible slice" acceptance harness
  (`tests/acceptance/firstVisibleSlice.test.ts` →
  `scripts/verify-first-visible-slice.mjs`, plus `scripts/route-coverage.mjs`)
  asserts the OLD product: old nav labels (Home/**Sell**/**My Tickets**/**Me**),
  the old route set (no `/app/search|requests|listings|profile`), and a frozen
  file allowlist that excludes `src/lib/ui/`. F1's approved v5 nav trips all three:
  - `verifyRouteCoverage`: new tab links "not part of the first-slice route contract".
  - `verifyAcceptanceCriteria`: pages no longer contain "Sell/My Tickets/Me" labels.
  - `verifyNoScopeDrift`: `src/lib/ui/navMap.ts` is outside `allowedFirstSlicePaths` (L77).
- **Score:** ~6/14 (files beyond task=2, project-wide shared gate=2, contract doc=1,
  behavior-in-design-but-contract-change-not=1). No mandatory override. → SPEC-REVIEWER/BLOCKED.
- **Route:** BLOCKED — surface to developer. The harness is Codex-owned and encodes the
  whole pre-revamp product; rewriting it to the Alerts+Requests model is a cross-cutting
  Codex task, not F1 UI scope. F1 itself is green (astro check 0 errors, astro build all
  15 routes, 27 navMap tests, byte-identical ports).
- **Status:** RESOLVED 2026-06-16 — user authorized continuing (Codex unavailable).
  - **Resolution:** (a) Restore a suppressible v5 title header in AppShell — T7 went
    header-less, which silently dropped every existing page's heading (those pages relied
    on AppShell's `<h1>{title}</h1>`). Real regression, now fixed; `hideHeader` lets v5
    screens opt out. (b) Update the obsolete harness to the approved v5 nav contract:
    new nav labels, allow the 4 known-forward tab routes (built in U1-U7), add `src/lib/ui`
    to `allowedFirstSlicePaths`. No deep old-content/mock-flow assertions were weakened.
  - **Flag for Codex:** the first-slice acceptance harness still encodes the pre-revamp
    product and should be rewritten to the Alerts+Requests model in a dedicated pass.

### Decision gate count: 2 (1 PROCEED, 1 BLOCKED). Plan-quality note: the BLOCKED gate is
the design.md D7 forward-links decision colliding with a pre-existing first-slice guard that
planning didn't reconcile — worth catching earlier next time.

---

## /validate (2026-06-16)

All CI gates reproduced locally + green: type-check, convex tsc, build (15 routes),
route-coverage, 159 tests, acceptance, buyer/seller smoke, `bun audit` (no vulnerabilities).

Adversarial multi-lens review (6 lenses × verify, 16 agents) → 7 confirmed real, 4
F1-actionable (all minor, all fixed in the adaptation block / AppShell — LOCK untouched):
1. `.app-shell` `100dvh` → added `100vh` fallback (iOS <15.4 / Chromium <108 self-heal).
2. Keyboard a11y → added `:focus-visible` accent ring on `.app-shell a` (nav tabs + FAB).
3. Edge-to-edge regression → restored a content gutter via `.app-content` (transitional
   pages only; v5 screens with `hideHeader` self-pad).
4. `.spacer-nav` vs notch → `height:calc(124px + env(safe-area-inset-bottom))` so the
   clearance tracks the fixed nav's safe-area padding.

Deferred (not F1-actionable): `--faint` contrast on `--bg` (inside the LOCKED verbatim
palette), `color-mix` two-layer-shorthand robustness (moot — the locked design already
depends on color-mix/oklch broadly), and a docs-only focus-state nit.
