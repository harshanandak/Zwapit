# U9 — Plans & Referrals · decisions log

## Classification
**Standard** — new screen + tested helper + entry rewiring; compliance-sensitive copy
(monetization/IAP), but no real payment logic. No auth/schema/route-removal.
Workflow: plan → dev → validate → ship → review → premerge.

## Pre-committed decisions (from /plan + advisor)
1. **Route:** `/app/profile/plans` (decided, not asked). Profile's accent is gold, so
   the existing tab loop yields profile-active + gold + no-FAB with ZERO navMap edit.
   Top-level `/app/plans` would need a special-case for no gain.
2. **Plus CTA (user decision): informational only, no in-app upgrade action.** Neutral
   note "Plus is available on the web." Referrals are the active v1 lever. No IAP API.
   Dropped the spec's "Upgrade to Plus" button and the "for the best price" wording
   (anti-steering language app review rejects). Rationale: v1 = success-fee only;
   subscriptions sell on web/PWA later (CLAUDE.md).
3. **Ladder rewards** (non-paid, distinct, mapped to the wave model): 1 → "+1 request",
   3 → "Earlier (Priority) alerts", 5 → "High Priority alert wave". Replaces the spec's
   "occasional hold tokens" (contradicts "no paid holds in v1 / don't sell hold tokens
   in-app").
4. **No new component CSS** — all §10 classes exist (V5-VERBATIM). Entrance via the U7
   `[data-entrance]` hook.
5. **Tested helper** `referralLadder(invited)` in `profile.ts` (beside `referralProgress`)
   — data-driven ladder (CPD-safe) + the slice's TDD anchor.
6. **Entry CTAs** are display-only `<button>`s with no JS dependency (requests.astro
   script only touches `req-buy-link`) → safe to swap to `<a>`.
7. Decided self: back → `/app/profile`; "Share my invite link" is a mock button.

## Decisions (filled during /dev)

- **Decision gates fired: 0** (plan quality: excellent — all §10 CSS pre-existed, the
  one compliance decision resolved up front, route decided per advisor).
- **TDD:** `referralLadder` landed RED→GREEN (test imported the missing export → fail;
  post-impl profile tests 3/0, full suite 175/0).
- **Markup source:** adapted the locked v5 preview's §10 block verbatim, then applied the
  three compliance changes (drop Upgrade button, neutral note, ladder reward) + added the
  spec's status wave-pills to each `.compare` column (preview omitted them).
- **Self-decided:** Free column shows `pl="Current plan"` (no actionable button); status
  wave-pills wrapped in a `margin-top` div; ladder icon = check when done else gift.

### Exit-review (4 parallel lenses) — outcome
- **Spec fidelity:** FAITHFUL — every §10 element present, microcopy verbatim (incl. the
  "never a guaranteed ticket" line), ladder rendered from `referralLadder`. The 3
  compliance deviations are correctly applied, not omissions.
- **a11y/correctness:** ZERO ISSUES — `.compare`/`.ladder`(`.lstep` wraps b+span)/`.wave-explain`
  match the CSS contract; all icons in the sprite; rewired entry CTAs are valid anchors;
  requests.astro script (req-buy-link) intact.
- **Route/CTA integrity:** ZERO ISSUES — navMap NOT edited (auto-resolves profile+gold via
  the tab loop); flat profile.astro + profile/plans.astro both build; entry CTAs rewired;
  promotion complete (contract/verify×2/smoke); ENTRANCE_ROUTES updated; back link resolves.
- **Compliance/copy/dup:** CLEAN — no in-app purchase, neutral "available on the web" note,
  no "hold token"/"best price"/forbidden terms, zero exclamations, helper pure+defensive+
  table-tested, script entries single-line, the two compare columns are content-distinct.
