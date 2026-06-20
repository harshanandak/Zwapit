# Convex Referrals read-model · decisions log

## Classification
Backend data + read-model with an additive schema change (new `referrals` table). Solo +
convex-reviewer (Codex rate-limited until 2026-07-18, user-sanctioned solo backend). Free-stack
aligned ($0 — seeded referrals, no external API).

## Key decisions (incl. advisor)
1. **Rewards driven by `verifiedCount`, not invited** (CLAUDE.md: unlock on verified-friend
   actions, not installs). Read-model returns both counts; ladder + progress use verified.
2. **Path A for the progress bar** (advisor): relabel `referralProgress` to "i of t verified
   friends" and feed `verifiedCount`. The "verified number + invited label" middle option is
   silently wrong; the "invited number to the bar" option lets the bar hit 100% while the reward
   is still locked — both rejected. Update `profile.test.ts` (pins the label) in the same commit.
3. **Fold in the quota card** (advisor): `profile.astro` hardcoded `requestQuota(2,3)` sitting next
   to the now-real `/app/requests`. Reuse `loadRequests()` → `requestQuota(activeCount, quotaTotal)`
   so the two screens can't contradict. Makes profile fully wired.
4. **Read-only, no mutations** (advisor): seed referral rows directly; leave "Invite friends" /
   "Share my invite link" as the display-only buttons they already are. No identity/name wiring.
5. **Seed `verifiedCount = 1`** (1 verified + 2 invited): keeps the ladder render identical to today
   while exercising the invited↔verified distinction (invited=3).
6. **Additive schema only**: new `referrals` table + 2 indexes; no change to existing tables → no
   migration risk. Bare-call `seedReferrals` (no handler branch → S3776 stays flat).
7. **Re-apply requests CodeRabbit lessons**: `args: {}` pinned to demo id; `MOCK_REFERRAL_SUMMARY`
   mirrors the seed; empty/zero is valid (validate types, not emptiness).
8. **No Workflow** (advisor + ultracode judgment): a single-table sequential slice is orchestration
   overhead, not added correctness. Solo + advisor + convex-reviewer is the right adversarial fit.
9. Deploy to **dev only**.

## convex-reviewer outcome
CLEAN — no HIGH/MED. Confirmed: schema additive (new `referrals` table only, no migration risk),
validators correct, indexes match the access path; `getReferralSummary` is read-only with `args: {}`
pinned to `DEMO_BUYER_ID` (no cross-user read, mirrors the requests-slice ownership fix), no exposed
mutation; seed idempotent + deterministic, verifiedCount=1/invitedCount=3 matches the mock;
`loadReferralSummary` validates types not emptiness (genuine zero passes through); `referralProgress`
only changed label + param name; screens reuse `loadRequests()` for quota and don't touch the order
fixture. Two LOW (optional):
1. `.collect()` in `getReferralSummary` is unbounded in principle — fine at v1 scale and consistent
   with `requests.ts`; scale-up path is a `by_referrer_and_state` index or a counter. Left as-is.
2. `referralLadder` param was still named `invited` with stale JSDoc though it takes the verified
   count — FIXED (renamed `invited`→`verified` + JSDoc) for parity with `referralProgress`.
