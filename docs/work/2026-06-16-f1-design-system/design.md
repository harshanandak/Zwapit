# F1 — Design-system + app shell (Wave 0)

- **Slug:** `f1-design-system` · **Branch:** `feat/f1-design-system` · **Date:** 2026-06-16
- **Status:** design approved (Q&A 2026-06-16) — task list pending user confirmation
- **Owner:** Claude (mobile UI / shell) · **Classification:** Standard
- **Reads with:** `docs/work/2026-06-12-ui-revamp/design.md` (§5 screens, §7 visual language),
  `zwapit-ui-revamp-preview.html` (the **LOCKED** v5 UI), `pr-roadmap.md` (Wave 0 / F1 row).

---

## Purpose

The revamp's v5 visual system is approved and locked in the preview, but `src/` still
ships the **old v4/Tailwind-token UI**: Poppins font, `bg-background`/`text-foreground`
flat-token classes, and a 4-tab nav (Home/Sell/My Tickets/Me). F1 lays the **foundation**
every later screen PR (U1–U7) builds on: the v5 token + component CSS in `global.css`, the
icon sprite, and the rebuilt app shell (per-route ambient accent + 5-tab nav + Sell FAB).
No new screens — this is the design system and chrome only.

## Success criteria (measurable)

1. `global.css` contains the **full v5 component system** ported verbatim from the locked
   preview (`<style>` lines 10–392): tokens (`--bg`, `--rose`, `--font-d`…), `.ic`, and the
   complete component vocabulary `.gl .solid .metal .sweep .btn* .chip* .divider .price-d
   .quota .wave-pill .alert-card .notify-btn .disc .reqcard .poster-card .rowcard .trust-*
   .stickybar .dropzone .tier-card .compare .ladder .wave-explain .hub* …` — coexisting
   with the existing Tailwind layer (no Tailwind removal).
2. The icon sprite (`<symbol id="i-…">` defs, preview lines 396–440) renders once app-wide;
   an `Icon.astro` helper emits `<svg class="ic"><use href="#i-…"/></svg>`. Stroke SVG only,
   **no emoji**.
3. `AppShell.astro` sets the correct **per-route ambient accent** (`--acc`) and `BottomNav`
   highlights the correct tab, both derived from `routeId` (Home=violet, Search=steel,
   Requests=bronze, Listings=rose, Profile=gold; flows/details inherit a sensible accent).
4. `BottomNav` renders exactly **5 tabs** (Home · Search · Requests · Listings · Profile)
   plus a **"List a ticket" Sell FAB** (no center Sell tab). FAB shows on the four list
   tabs, hidden inside flows/details/sell.
5. Fonts are **Fraunces + Space Grotesk**, bundled via `@fontsource` (Poppins removed).
6. **All 12 existing routes still render** and `astro check` is **green** (existing pages
   are untouched — props stay backward-compatible).
7. `bun test` is green, including new unit tests for the route→nav resolver.
8. **Fidelity:** rendered chrome matches the locked preview; restraint rules hold — no new
   fonts/accent colors, no emoji in chrome, no flat token cards, `.sweep` only on the Buy CTA.

## Out of scope (F1)

- Any **new screen** (Search, Requests, Create Request, Listing detail, Sell redesign,
  Profile, payoff) — those are U1–U7. F1 ships chrome + CSS only.
- **Redesigning** the 12 existing pages to v5 (they keep their current Tailwind look under
  the new shell; full redesign happens in their respective wave PRs).
- Removing Tailwind / migrating existing screens off token classes.
- `convex/schema.ts` and `src/lib/types.ts` — **Codex-owned (F2), do not edit** (parallel).
- Stub pages for not-yet-built tab targets (would violate "no new screens").

## Approach selected

**A. CSS — full verbatim port, coexisting with Tailwind.** Copy the entire preview
`<style>` component system into `global.css` *after* the existing Tailwind block. The v5
classes (`.gl`, `.btn`, `.chip`…) and tokens (`--bg`, `--rose`…) do **not** collide with
Tailwind utilities or the oklch `--background`/`--primary` tokens, so both layers live
side by side. One verbatim copy = zero drift; later PRs become markup-only. *Adapt, don't
copy* the ambient mechanism (below); *exclude* the preview-harness scaffolding (below).

**B. Ambient + nav derived from `routeId` (the one piece of real logic).** New pure module
`src/lib/ui/navMap.ts` exports `resolveNav(routeId) → { tab, accent, showFab }`. `AppShell`
calls it to (i) set `style="--acc:<accent>"` on the shell root, (ii) pass the active `tab`
to `BottomNav`, (iii) toggle the FAB. This centralizes per-route identity in one tested map
and lets the 12 existing pages stay **untouched** — `activeTab` becomes an optional,
backward-compatible override; the shell prefers the `routeId`-derived value.

**C. Ambient glow adapted to the app root.** In the preview the `--acc` glow lives on the
`.stage::before` / `.phone` border / `.screen` radial-gradient (a fake device frame). The
app has no bezel, so port only the **glow**: the shell root gets the `.screen` charcoal +
radial-`--acc` background; the metallic phone-frame border and `.statusbar` are **excluded**
(the real status bar is the OS/Capacitor safe area).

**D. Fonts via `@fontsource`.** Add `@fontsource/fraunces` + `@fontsource/space-grotesk`,
import the needed weights in `AppLayout.astro`, drop the Poppins imports. Offline-safe in
the Capacitor WebView, no FOUT, no runtime CDN. `--font-d`/`--font-b` already map to these
families in the ported tokens.

**E. Icon sprite once + helper.** `IconSprite.astro` holds the `<symbol>` defs (verbatim,
lines 397–439) and is rendered once inside `AppLayout`; `Icon.astro` is the `<use>` wrapper.

**F. Rebuild AppShell + BottomNav in place** (per the F1 instruction) — same file paths,
new internals, backward-compatible props.

### Excluded preview-harness selectors (must NOT be ported)

`.page-head .flow .frames .frame-col .frame-label .frame-notes .stage .phone .screen
.statusbar` — these style the 10-phone documentation showcase, not the app. (The glow rules
*inside* `.stage::before`/`.phone`/`.screen` are reworked onto the shell root per **C**.)

## Constraints (hard limits)

- **UI is LOCKED to v5** (design.md §7): build on the preview, never degrade it — no new
  fonts, no extra accent colors beyond the token set, no emoji in chrome, no flat token
  cards, no candy bevels/neon; `.sweep` stays on the Buy CTA only.
- Existing routes must keep rendering and `astro check` must stay green (no churn to the 12
  existing pages; props backward-compatible).
- Tailwind layer stays; v5 is additive.
- Do not touch `convex/schema.ts` or `src/lib/types.ts` (F2 parallel). `package.json` is a
  shared file — F1's only change there is **adding the two `@fontsource` deps + removing
  Poppins** (flagged; no other shared-file edits).

## Edge cases (decided)

- **Unknown route** → `resolveNav` returns `{ tab: null, accent: violet (home default),
  showFab: false }`; shell renders with the default accent and no tab highlighted.
- **Dynamic / detail routes** (`/app/listings/:id`) → highlight the parent tab (Listings,
  rose) but `showFab:false` (you're below a list).
- **Buy flow** (`/app/checkout/:id`) → no tab, accent rose (money moment), `showFab:false`.
- **Sell flow** (`/app/sell`, `/app/sell/*`) → no active tab (Sell is the FAB), accent
  steel, `showFab:false` (already selling).
- **Legacy routes** → `/app/me` and `/app/tickets` and `/app/orders/:id` map to the Profile
  tab (gold); they keep rendering until U7 supersedes them.
- **Forward-pointing tab links:** Search/Requests/Listings-index/Profile targets are built
  in later waves; until then those tabs link to canonical routes that 404 by design (the
  nav is the skeleton Wave 1+ fills). Home + the 12 existing pages render today. Documented,
  not a bug; no stubs (scope).
- **Safe areas:** fixed `.bnav` + `.fab` respect `env(safe-area-inset-bottom)` (notch);
  `AppLayout` already sets `viewport-fit=cover`.

## Ambiguity policy

Use the 7-dimension rubric (per `/dev` decision gate). ≥ 80% confidence → proceed and
document the call in `decisions.md`. < 80% → stop and ask. Fidelity to the locked preview
is the tie-breaker: when unsure, match the preview exactly.

---

## Technical Research

### Fidelity rules (the LOCK, made operational)
- Port the preview's **actual** class set verbatim; §7's prose names (`.chan-row`,
  `.demand-band`, `.drop-sched`) are descriptive — the preview's real classes (`.optrow`,
  `.sw`, `.buyerwait`, `.order-metal`…) are the source of truth.
- Copy CSS byte-for-byte from lines 74–391 (+ tokens 12–17); adapt only the ambient glow
  (approach C); exclude the harness selectors above.
- Copy the sprite (`<symbol>` defs, lines 397–439) byte-for-byte.

### DRY check (executed)
`grep` over `src/lib`, `src/components` for `ambient|--acc|accent|resolveNav|navMap` →
**no existing implementation**. Only `activeTab` exists, in the AppShell/BottomNav being
rebuilt. No route registry in `src/lib`. New module `src/lib/ui/navMap.ts` does not
duplicate anything. **Gate cleared.**

### Blast-radius (rebuild/replace AppShell + BottomNav — executed)
- `BottomNav` is imported only by `AppShell` (1 site).
- `AppShell` is imported by **12 pages**, each passing `routeId` + `title` + `activeTab`
  (`home`×3, `sell`×6, `tickets`×2, `me`×1).
- Mitigation: keep `routeId` + `title`, derive tab/accent from `routeId`, keep `activeTab`
  optional with a back-compat-wide type → **zero edits to the 12 pages**, `astro check`
  stays green. (Verified call sites: home, search-n/a, checkout, listings/[id], me, orders,
  sell, sell/{confirm,index,orders,price,promise,upload}, tickets.)

### OWASP Top 10 (presentational foundation PR — minimal surface)
- **A05 Security Misconfiguration / CSP:** choosing **bundled `@fontsource`** over the
  Google Fonts CDN keeps `style-src`/`font-src` self-only — no third-party origin needed,
  CSP-friendly. *Applies → mitigated by the font decision.*
- **A06 Vulnerable & Outdated Components:** two new deps (`@fontsource/fraunces`,
  `@fontsource/space-grotesk`). *Mitigation:* pin caret ranges like existing fontsource;
  they ship static font files (no runtime code).
- **A03 Injection / XSS:** sprite + components are static authored markup, no user input,
  no `set:html`. *N/A.*
- **A01/A02/A04/A07/A08/A09/A10:** no authz, secrets, data, auth, deserialization, logging,
  or SSRF surface in chrome/CSS. *N/A — documented for completeness.*

### TDD scenarios (target = `src/lib/ui/navMap.ts`, the only logic in F1)
1. **Happy path:** `resolveNav('/app/home')` → `{ tab:'home', accent:'#8E7BC9', showFab:true }`;
   `resolveNav('/app/listings')` → `{ tab:'listings', accent:'#F23D7F', showFab:true }`.
2. **Error/unknown path:** `resolveNav('/app/does-not-exist')` →
   `{ tab:null, accent:'#8E7BC9', showFab:false }` (graceful default, no throw).
3. **Edge — dynamic/flow routes:** `resolveNav('/app/listings/abc')` →
   `{ tab:'listings', accent:'#F23D7F', showFab:false }`; `resolveNav('/app/checkout/abc')`
   → `{ tab:null, accent:'#F23D7F', showFab:false }`; `resolveNav('/app/sell/price')` →
   `{ tab:null, accent:'#7FA3C4', showFab:false }`; legacy `/app/me` → `tab:'profile'`.
- **Render smoke (component-level):** `BottomNav` output contains 5 tab `<a>` + 1 FAB and
  marks exactly one tab `.on`; AppShell smoke that every existing `routeId` resolves without
  throwing (table-driven over the 12 routes).
- **Regression gate:** `astro check` + `bun test` green; existing route render check
  (`bun scripts/route-coverage.mjs` / ui-smoke) unaffected.
