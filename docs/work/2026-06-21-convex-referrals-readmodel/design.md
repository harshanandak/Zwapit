# Convex Referrals read-model · design

## Goal
Wire the Profile (`/app/profile`) and Plans & Referrals (`/app/profile/plans`) screens to
real Convex data, replacing the hardcoded referral count (`referralProgress(1,3)` /
`referralLadder(1)`) and the hardcoded request quota (`requestQuota(2,3)`).

## Scope
- NEW `referrals` table (greenfield; additive — no change to existing tables).
- NEW read-only query `referrals:getReferralSummary` → `{ invitedCount, verifiedCount }` for the
  demo buyer. No client-supplied id (pinned to `DEMO_BUYER_ID` pre-auth), read-only, no mutation.
- Seed a realistic referral set for `user_demo_1`.
- `dataAdapter.loadReferralSummary()` — Convex when configured, mock fallback otherwise.
- `profile.astro`: referral bar from real `verifiedCount`; quota from the real `loadRequests()`.
- `plans.astro`: ladder from real `verifiedCount`; drop the `TODO(real-data)`.

## Out of scope (advisor)
- No invite/share/verify mutations — "Invite friends" / "Share my invite link" stay display-only.
- No identity/name wiring (no auth yet). Referrals + quota are the only real-data-able parts pre-auth.
- Ladder rungs (+1 request / Priority / High Priority) stay fixed product config in `profile.ts`.

## Rewards unlock on VERIFIED friends (CLAUDE.md)
"Referral rewards unlock only on verified-friend actions, not installs." So the ladder + progress
bar are driven by `verifiedCount`, never `invitedCount`.

## The one fork — progress-bar label (Path A, advisor-recommended)
`referralProgress(i,t)` currently labels `"i of t friends invited"`. Feeding it `verifiedCount`
with an "invited" label is silently wrong. Path A: relabel to **"i of t verified friends"** and
feed `verifiedCount` — the only option where the bar measures what the reward unlocks on, and it
matches the card headline ("Invite 3 verified friends → earlier alerts").
- Touches the shared helper `profile.ts` + its pinned test `profile.test.ts` (update same commit).
- Re-read `/app/profile` + `/app/profile/plans` needles before changing any rendered word/number.

## Data model
`referrals`:
- `referralKey: string` (stable public id) — index `by_key`
- `referrerId: string` (inviter appUserId) — index `by_referrer`
- `state: "invited" | "verified"`
- `invitedAt: string`, `verifiedAt?: string`

`getReferralSummary` (read-only, `args: {}`): rows `by_referrer` for `DEMO_BUYER_ID`;
`verifiedCount` = state==="verified" count; `invitedCount` = total rows.

## Seed (minimal ladder churn)
`referralLadder(1)` and `(2)` render identical done/current/locked — only the bar number differs.
Seed `verifiedCount = 1` so the ladder render is unchanged: **1 verified + 2 invited** for
`user_demo_1` → verified=1 / invited=3. Exercises the invited↔verified distinction; bar reads
"1 of 3 verified friends" (33%).

## Dual behaviour (re-apply the 3 requests CodeRabbit lessons)
1. `args: {}`, pinned to `DEMO_BUYER_ID` — no cross-user read.
2. `MOCK_REFERRAL_SUMMARY = { invitedCount: 3, verifiedCount: 1 }` mirrors the seed exactly.
3. Empty/zero is VALID (a buyer with no verified friends) — guard validates types
   (`invitedCount`/`verifiedCount` are numbers), never emptiness.

Counts come from the backend; tier/wave/progress/ladder stay derived in the one frontend place.

## Verification
Dev-only deploy (`npx convex dev --once`) → seed → probe. Both build paths green: Convex build
+ mock-fallback build through `verify-first-visible-slice`. `bun test` for the profile helper.
