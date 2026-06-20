# U9 — Plans & Referrals (v5 §10) · design

**Slug:** u9-plans-referrals · **Date:** 2026-06-20 · **Branch:** feat/u9-plans-referrals
**Status:** in progress · **Classification:** Standard (new screen; compliance-sensitive copy)

## Purpose

Build the v5 §10 **Plans & Referrals** screen — the last v5 surface. It explains the
Free vs Plus value, makes **referrals the active growth lever** (rewards unlock on
verified-friend actions, never installs), and honestly frames alert *waves*
(Standard / Priority / High Priority) so users understand "Priority means earlier,
never guaranteed." Reached from the Profile hub and the Requests referral nudge.

## Success criteria

- New route `/app/profile/plans` renders the §10 frame: topbar (back + "Plans &
  referrals"), "CHOOSE YOUR PLAN" divider, a `.compare` Free-vs-Plus grid, the
  app-store note, "REFERRAL REWARDS" divider, a `.ladder`, the alert-waves
  explainer, "Share my invite link", and the bottom nav (Profile active, gold accent).
- Entry points resolve: Profile "Compare Plus" + Requests "See referrals" → the screen.
- Route promoted: contract + acceptance + buyer smoke + route-coverage (17 → 18). All
  gates green; SonarCloud new-code duplication 0%.

## Out of scope (mock-first / compliance)

- **No in-app tier purchase** (Apple/Google IAP rules; v1 is success-fee only). The
  Plus column is **informational only — no upgrade action** (user decision). A neutral
  note: "Plus is available on the web." Subscriptions sell on web/PWA later.
- No real referral mutation / no real invite-link generation / no real share — "Share
  my invite link" is a mock button. Referral state uses the existing helper.
- §10's "Upgrade to Plus" CTA and "occasional hold tokens" reward are **dropped** — see
  Constraints. No real payments, matching, or notification mutations.

## Approach selected

- **Route:** `src/pages/app/profile/plans.astro` → `/app/profile/plans`. Profile's
  accent is already gold, so the existing `resolveNav` tab loop yields
  `{ tab: "profile", accent: gold, showFab: false }` with **zero navMap edit**.
  Coexists with flat `profile.astro` (proven by `requests.astro` + `requests/new`).
- **No new component CSS** — every §10 class exists in `global.css` (V5-VERBATIM):
  `.compare`/`.col`/`.col.plus`, `.ladder`/`.lstep` (+ `.done`/`.ln`), `.wave-explain`
  (+ `.we-h`/`.we-row`/`.we-note`), `.wave-pill` (+ `.priority`/`.high`), `.note`,
  `.btn`/`.btn-ghost`. Entrance via the U7 `[data-entrance]` hook (add to ENTRANCE_ROUTES).
- **New tested helper** `referralLadder(invited)` in `src/lib/ui/profile.ts` beside
  `referralProgress` — returns structured steps so the ladder is data-driven (CPD-safe)
  and gives `/dev` a real RED→GREEN unit.

## Constraints / decisions (CLAUDE.md overrides spec §10)

- **In-app purchase:** none. Plus is informational; neutral "available on the web" note.
  Drop the spec's "Upgrade to Plus" button and its price-comparative "for the best
  price" wording (anti-steering language app review rejects).
- **Ladder rewards (non-paid, distinct, mapped to the wave model):** 1 friend → "+1
  request"; 3 → "Earlier (Priority) alerts"; 5 → "High Priority alert wave". Replaces
  the spec's "occasional hold tokens" (contradicts "no paid holds in v1 / don't sell
  hold tokens in-app").
- **Entry CTAs:** Profile "Compare Plus" (`profile.astro:48`) and Requests "See
  referrals" (`requests.astro:160`) are display-only `<button>`s with no JS dependency
  (confirmed) → swap to `<a href="/app/profile/plans">`.
- Decided self: back → `/app/profile`; "Share my invite link" is a mock `<button>`.

## Edge cases

- `referralLadder`: non-finite/negative `invited` floors to 0 (all locked/first
  current); invited ≥ top threshold → all done. Mirrors `referralProgress` guards.
- Flat `profile.astro` + `profile/plans.astro` must both build (verify dist emits both).
- No forbidden user-facing terms (queue/demand/hold tokens-as-sale/escrow/…); waves use
  Standard/Priority/High Priority (approved).

## Technical research / OWASP

Static mock screen + one tested pure helper: no input, no auth, no mutations, no
network. Minimal risk surface. The only outward affordance is the "available on the
web" note (no live link in the chosen option) — nothing to harden. A03/A07/A08 N/A.

## TDD scenarios (referralLadder)

1. **Happy:** invited=1 → step1 done, step2 current, step3 locked.
2. **Edge low:** invited=0 → step1 current, rest locked.
3. **Edge high:** invited=5 → all done; invited=10 → all done.
4. **Defensive:** invited=NaN / -2 → treated as 0 (step1 current).
5. **Mid:** invited=3 → steps 1&2 done, step3 current.

## Ambiguity policy

7-dimension rubric; ≥80% confidence → proceed + document; else ask. The one genuine
decision (Plus CTA compliance) is resolved (info-only). Route + ladder reward + hold-
tokens removal decided per CLAUDE.md and the advisor.
