# U6 — Profile tab (v5)

- **Slug:** u6-profile
- **Date:** 2026-06-19
- **Status:** planned
- **Branch / worktree:** `feat/u6-profile` · `.worktrees/u6-profile`
- **Classification:** Standard (new screen + route promotion; no auth/payment/schema; additive — no route removal)

## Purpose

Build the v5 **Profile** screen at `/app/profile` (currently a known-forward 404) and promote it
to a real contract route — the **last remaining bottom-nav tab**, completing the 5-tab shell
(Home · Search · Requests · Listings · Profile) in v5. Profile is the gold account hub: identity +
plan/referrals, a Buying hub, a Selling hub (the entry point §8 references), notification channels,
and footer links. Mock-first/display-led like U1–U3. UI locked to spec §9 (`alerts-requests-screen-spec.md`,
gold accent `#D9A84E`).

`/app/me` **stays** as the account / phone-verification step (the phone gate routes to
`/app/me?next=…`). Profile is additive — it does not replace or remove `/app/me`.

## Success criteria

1. `/app/profile` renders the v5 §9 screen (gold) in order: `.profhead` (avatar + name +
   phone-verified "Verified" `.seller-tick` + edit) → `.tier-card` (`.metal`: "Free plan" +
   "Compare Plus", referral progress bar "Invite 3 verified friends → earlier alerts" + "Invite
   friends") → `.quota` recap ("2 / 3 active requests") → Buying hub (`.divider` "BUYING" +
   `.tiles`: My Requests, Saved, Purchases, Notifications) → Selling hub (`.divider` "SELLING" +
   `.tiles`: My Listings, **Orders**, Payouts, List a ticket) → notification channels (`.chan-row`:
   Email on, Push on, Telegram "Soon", WhatsApp "Soon") → footer `.ghostlink` rows (Help,
   Protected-payment policy, Sign out).
2. `/app/profile` promoted to a real contract route: removed from `knownForwardRoutes`, added to the
   acceptance `routes` table + `routeContentChecks` + `appRoutes` nav check + `IMPLEMENTATION_CONTRACT.md`
   + buyer smoke. Profile tab lights up (gold); no Sell FAB on this screen (Selling hub present).
3. Real links resolve to existing routes only: My Requests → `/app/requests`, Purchases →
   `/app/tickets`, My Listings / Orders / List a ticket → `/app/sell` or `/app/sell/orders`. Every
   not-yet-built destination (Saved, Notifications, Payouts, Compare Plus, Invite friends, Help,
   Protected-payment policy, Sign out, edit) is a **display-only `<button type="button">`** so
   route-coverage stays green without inventing routes.
4. The quota recap reuses `requestQuota(2, 3)` (U3 helper). A small tested `referralProgress(invited,
   target)` helper drives the referral fill percent.
5. **"Sales" guardrail:** the Selling hub uses **"Orders"** (→ `/app/sell/orders`), not the spec's
   "Sales" — the seller-orders surface is "Orders" throughout this product, and the acceptance
   scope-drift sweep forbids the word "Sales" across all routes (same decision as U5's "View orders").
6. a11y from the start: every non-navigating control is `<button type="button">`; channel toggles
   carry `aria-pressed`; the only `<a>` are real, resolving links. Gold entrance choreography on
   `/app/profile`, mirroring Home/Search/Requests/Sell.
7. All gates green: astro check, build, bun test, acceptance, buyer + seller smoke, route-coverage,
   audit. Test names `should…when…`.
8. Fidelity to §9; **minimal new CSS** — `.profhead`, `.tier-card`/`.metal`, `.quota`, `.tiles`/
   `.tile`, `.divider`, `.btn-ghost`/`.btn-gold`, `.avatar`, `.seller-tick` already exist in the F1
   port. Add only `.chan-row` (channel row) and `.ghostlink` (footer link row).

## Out of scope (backend / later waves)
- Real account editing, real sign-out, real notification-channel persistence (display-only toggles;
  Telegram/WhatsApp are "Soon" per the TRAI/DLT + WhatsApp-opt-in compliance note).
- Plans & Referrals screen (§10) — "Compare Plus" / "Invite friends" are display-only here.
- The not-yet-built hub destinations (Saved, Notifications list, Payouts, Help, policy pages) —
  display-only; "Do Not Build Yet" (no full legal policy pages, no wallet).
- `/app/me` changes — it stays as the auth/account step.
- Real referral/tier logic, real KYC.

## Approach
Mirror U3 (a clean Standard slice): a self-padded v5 screen under `AppShell routeId="/app/profile"
hideHeader` rendering its own `.profhead`, driven by display content + two helpers (`requestQuota`
reused, `referralProgress` new). Promote the route through the same acceptance/contract path U2/U3
used for `/app/search` and `/app/requests`.

## Edge cases (decided)
- **Phone-verified badge:** the mock user is verified, so render the "Verified" `.seller-tick`
  statically (no live gate call needed on this display screen).
- **Route-coverage:** only existing routes are linked; all other affordances are `<button>` (no
  new `knownForwardRoutes` entries needed beyond removing `/app/profile` itself).
- **"Sales" → "Orders":** Selling hub tile reads "Orders" → `/app/sell/orders` (guardrail-safe).
- **referralProgress:** clamps percent 0–100; guards non-finite / target≤0 with `Number.isNaN`.

## Ambiguity policy
7-dimension rubric per the /dev decision gate. ≥80% confidence → proceed + document; <80% → stop
and ask. Locked to §9; gates should be rare.

## Technical Research
- **DRY (verified in global.css):** `.profhead` (492-494), `.tier-card`/`.metal` (203-204, 485-491),
  `.quota` (355-360), `.tiles`/`.tile` (377-382), `.divider` (237-239), `.btn-ghost`/`.btn-gold`
  (235-236), `.avatar` (459), `.seller-tick` (340) all exist → reuse. Only `.chan-row` + `.ghostlink`
  are missing → add (additive).
- Helpers: reuse `requestQuota` (`src/lib/ui/requests.ts`); add `referralProgress` (new, tested).
- `navMap.ts` already maps `/app/profile` → profile tab, gold `#D9A84E`, no FAB (resolveNav). No
  navMap change. BottomNav already links the Profile tab to `/app/profile`.
- **Route-promotion blast radius:** `/app/profile` is in `knownForwardRoutes`
  (verify-first-visible-slice.mjs) and absent from `IMPLEMENTATION_CONTRACT.md` + the acceptance
  `routes` table + buyer smoke → add in all. The bottom-nav "Profile" label is already asserted by
  the `appRoutes` nav check (it currently 404s when followed; promotion makes it resolve).
- **OWASP:** static SSR of display content + two pure helpers. No new auth/payment/input/network
  surface (the account/verify step remains `/app/me`). A03 — Astro auto-escapes; no user input.
  A10 — no external calls. No applicable risk introduced.
- **TDD scenarios:** (1) `referralProgress(1,3)` → percent 33; (2) `(0,3)` → 0; (3) `(3,3)` → 100;
  (4) `(5,3)` → 100 clamp; (5) `(-1,0)`/`Number.NaN` → 0; (6) acceptance: `/app/profile` renders
  Free plan, Invite, BUYING/SELLING hubs, channels, Sign out (RED before the page → GREEN after).
