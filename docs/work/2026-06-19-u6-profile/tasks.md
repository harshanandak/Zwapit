# U6 — Profile tab · tasks

Mock-first v5 Profile screen (§9, gold) + route promotion. Standard slice, mirrors U2/U3.
Folds in review lessons: `should…when…` tests, `Number.NaN` guards, `<button type="button">` for
non-nav controls, single-line new verify entry, data-driven checks.

## Task 1 — `referralProgress` helper (pure, tested)
- **File(s):** `src/lib/ui/profile.ts` (new), `src/lib/ui/__tests__/profile.test.ts` (new)
- **OWNS:** those 2 files
- **What:** `export function referralProgress(invited: number, target: number): { label: string; percent: number }`
  — `label` = `"${i} of ${t} friends invited"`; `percent` = `round(invited/target*100)` clamped 0–100;
  guards negative/non-finite/`target<=0` → percent 0 (use `Number.isNaN`/`Number.isFinite`, never bare `NaN`).
- **TDD (names `should…when…`, table-driven):** (1,3)→33, (0,3)→0, (3,3)→100, (5,3)→100 clamp,
  (-1,3)→0, (Number.NaN,3)→0, (1,0)→0. RED → implement → GREEN.
- **Commit** `test(u6): add referralProgress helper with tests`.

## Task 2 — `/app/profile` v5 screen
- **File(s):** `src/pages/app/profile.astro` (new)
- **OWNS:** `src/pages/app/profile.astro`
- **What:** v5 §9 screen under `AppShell routeId="/app/profile" title="Profile" hideHeader`. Import
  depth `../../`. Reuse `Icon`, `requestQuota` + the new `referralProgress`. Sections in spec order:
  1. `.profhead`: `.avatar` "Z" + `.pn` (name "You" + `.seller-tick` Verified) + `.ed` edit
     `<button type="button">`.
  2. `.tier-card metal`: `.tt` ("Free plan" `.pl`) + `.up` "Compare Plus" (display-only button,
     `i-crown`); `.rp` "Invite 3 verified friends → earlier alerts" + count from `referralProgress(1,3)`;
     `.track`/`<i style=width:${percent}%>`; `.inv` "Invite friends" `<button class="btn btn-ghost">`.
  3. `.quota gl`: `.qtop` `<b>{requestQuota(2,3).label}</b>` + `.track`/`<i>` + `.qsub`.
  4. Buying hub: `.divider` "Buying"; `.tiles` — My Requests (`<a href="/app/requests">`, bell),
     Saved (button, star), Purchases (`<a href="/app/tickets">`, ticket), Notifications (button, bell).
  5. Selling hub: `.divider` "Selling"; `.tiles` — My Listings (`<a href="/app/sell">`, tag),
     **Orders** (`<a href="/app/sell/orders">`, trend), Payouts (button, shield, "Paid after the buyer
     confirms"), List a ticket (`<a href="/app/sell">`, plus). NO "Sales" anywhere.
  6. Notification channels: `.chan-row` list — Email (on), Push (on), Telegram ("Soon", disabled),
     WhatsApp ("Soon", disabled). Toggles `<button type="button" aria-pressed>`; disabled rows show a
     muted "Soon".
  7. Footer `.ghostlink` rows: Help, Protected-payment policy, Sign out — all `<button type="button">`.
- **Icons:** verify names in IconSprite (user/edit/crown/gift/bell/star/ticket/tag/trend/shield/mail/plus);
  reuse closest existing.
- **TDD:** Task 3 acceptance + buyer-smoke mustContain is the RED→GREEN proof; build must compile.
- **Commit** `feat(u6): add v5 Profile screen (gold) with Buying + Selling hubs`.

## Task 3 — new §9 CSS + promote `/app/profile`
- **File(s):** `src/styles/global.css`, `scripts/verify-first-visible-slice.mjs`,
  `docs/IMPLEMENTATION_CONTRACT.md`, `scripts/ui-smoke-buyer.mjs`
- **OWNS:** those 4 files
- **What:**
  - `global.css` (additive): add `.chan-row` (channel row: icon + label/sub + trailing toggle/Soon)
    and `.ghostlink` (footer link row). Extend the `zw-rise` entrance `:is(...)` to `/app/profile`.
  - `verify-first-visible-slice.mjs`: add `["/app/profile", "app/profile/index.html"]` to `routes`;
    remove `/app/profile` from `knownForwardRoutes`; add ONE single-line `/app/profile`
    `routeContentChecks` entry (Free plan, Invite, Buying, Selling, My Requests, My Listings, Orders,
    Email, Sign out); add `/app/profile` to the `appRoutes` nav check; extend the `% off` integrity
    loop is N/A (no listings rendered here).
  - `IMPLEMENTATION_CONTRACT.md`: add the `/app/profile` route line; update the bottom-nav list to the
    5 v5 tabs (Home/Search/Requests/Listings/Profile; Sell is a FAB).
  - `ui-smoke-buyer.mjs`: add a light `/app/profile` entry (data-route-id + 2–3 distinctive needles)
    to the data-driven `routeChecks`.
- **Commit** `test(u6): promote /app/profile + chan-row/ghostlink CSS + entrance`.

## Task 4 — verify gate + /dev exit review
- **What:** fresh astro check, build, bun test, acceptance, buyer (8) + seller smoke, route-coverage
  (+1 route), audit — all green. Then the adversarial /dev exit review (spec-fidelity, a11y/CodeRabbit,
  duplication, copy-discipline incl. the "Sales" sweep, route-integrity); fix confirmed findings.
- **Expected:** all gates green; ready for `/validate → /ship`.
