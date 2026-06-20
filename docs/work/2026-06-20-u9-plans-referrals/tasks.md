# U9 — Plans & Referrals · tasks

Ordered: tested helper (TDD) → screen → wiring → promotion → verify.

## Task 1 — `referralLadder(invited)` helper (TDD)
OWNS: `src/lib/ui/__tests__/profile.test.ts`, `src/lib/ui/profile.ts`
- RED: add table tests — invited 0 → [current, locked, locked]; 1 → [done, current,
  locked]; 3 → [done, done, current]; 5 & 10 → all done; NaN/-2 → treated as 0.
  Run `bun test src/lib/ui/__tests__/profile.test.ts` → confirm FAIL (helper absent).
- GREEN: add `referralLadder(invited)` returning `ReferralStep[]`
  `{ friends, reward, state: "done"|"current"|"locked" }` over the fixed ladder
  `[{1,"+1 request"},{3,"Earlier (Priority) alerts"},{5,"High Priority alert wave"}]`.
  Defensive `invited` flooring like `referralProgress`. First not-done step = current.
- Run → pass; full `bun test` → 173 + new pass, 0 fail.

## Task 2 — Plans & Referrals screen `/app/profile/plans`
OWNS: `src/pages/app/profile/plans.astro` (new)
- AppShell `routeId="/app/profile/plans"` `title="Plans & referrals"` `hideHeader`.
  Import depth `../../../`; import `referralLadder` + `referralProgress`.
- Sections (§10): `.pbar` (back `<a href="/app/profile">` + "Plans & referrals");
  `.divider` "Choose your plan"; `.compare` grid — Free `.col` vs Plus `.col.plus`
  (`Icon crown`): rows Active requests "3" vs "Unlimited within fair use"; Alert timing
  "Standard" vs "Earlier alerts"; Discount + price-drop "Included" vs "Included +
  sharper thresholds"; Status `.wave-pill` "Standard" vs `.wave-pill.priority`
  "Priority". **No upgrade button** (user decision). `.note` (`.dim`): "Plus is
  available on the web." `.divider` "Referral rewards"; `.ladder` rendered from
  `referralLadder(1)` — each `.lstep` (`.done` when state==="done", `Icon gift` in
  `.ln`): b="{n} verified friend{s} → {reward}", span=state label (Unlocked / Next
  reward / Locked); alert-waves `.wave-explain` panel (`Icon signal`) "How alert waves
  work" + three `.we-row` `.wave-pill`s (Standard / Priority / High Priority) each w/
  a plain line + `.we-note` "Priority means you may hear earlier — never a guaranteed
  ticket."; `.btn-ghost` (`Icon gift`) "Share my invite link" (mock `<button>`).
- No new CSS; no real share/purchase/mutation.
- `bun run build` → 0/0; page emits `data-route-id="/app/profile/plans"` + `data-entrance`.

## Task 3 — Entrance + entry rewiring
OWNS: `src/components/AppShell.astro`, `src/pages/app/profile.astro`, `src/pages/app/requests.astro`
- AppShell: add `"/app/profile/plans"` to `ENTRANCE_ROUTES`.
- profile.astro:48 "Compare Plus" `<button class="up">` → `<a class="up" href="/app/profile/plans">`.
- requests.astro:160 "See referrals" `<button class="btn btn-ghost">` → `<a class="btn btn-ghost" href="/app/profile/plans">`.
- Build → both entry hrefs resolve; alerts/other links unaffected.

## Task 4 — Route promotion
OWNS: `docs/IMPLEMENTATION_CONTRACT.md`, `scripts/verify-first-visible-slice.mjs`, `scripts/ui-smoke-buyer.mjs`
- Contract: add `- /app/profile/plans -> Plans & Referrals: Free vs Plus comparison
  (info-only, no in-app purchase) + referral rewards ladder + alert-waves explainer.`
- verify: add `["/app/profile/plans", "app/profile/plans/index.html"]` to `routes`;
  single-line `routeContentChecks` entry with §10 needles (Plans & referrals, Choose
  your plan, Unlimited within fair use, Plus is available on the web, Referral rewards,
  How alert waves work, Share my invite link).
- smoke: add `["/app/profile/plans", "app/profile/plans", ['data-route-id="/app/profile/plans"',
  "Plans & referrals", "Referral rewards", "Share my invite link"]]`.
- route-coverage picks it up from the contract (17 → 18).

## Task 5 — Full verification (CI parity, via `bun`) + exit review
- `bun run build` (0/0, 18 pages) · `bun test` (all pass) · `bun scripts/ui-smoke-buyer.mjs`
  (11) · `bun scripts/verify-first-visible-slice.mjs` (exit 0, 18) · `bun scripts/route-coverage.mjs` (18).
- Adversarial exit review (spec fidelity, a11y/correctness, route/CTA integrity,
  compliance/copy/dup) before ship.
