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
  needs to touch `package.json` (unlikely for schema work).
