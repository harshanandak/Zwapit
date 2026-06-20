// Pure display helpers for the Profile screen (U6). No Astro/DOM imports, so they
// are unit-testable with `bun test`. Source of truth for the frame:
// docs/work/2026-06-12-ui-revamp/alerts-requests-screen-spec.md §9.

/**
 * Referral progress for the tier-card bar, e.g.
 * `{ label: "1 of 3 friends invited", percent: 33 }`. Defensive: non-finite or
 * negative `invited` floors to 0; a non-positive/non-finite `target` yields 0%.
 * percent is rounded and clamped to 0..100 for the `.track i` width.
 */
export function referralProgress(invited: number, target: number): { label: string; percent: number } {
  const i = Number.isFinite(invited) && invited > 0 ? Math.floor(invited) : 0;
  const t = Number.isFinite(target) && target > 0 ? Math.floor(target) : 0;
  const percent = t > 0 ? Math.min(100, Math.max(0, Math.round((i / t) * 100))) : 0;
  return { label: `${i} of ${t} friends invited`, percent };
}

/** A rung of the Plans & Referrals rewards ladder (§10). */
export interface ReferralStep {
  /** Verified-friend threshold that unlocks this reward. */
  friends: number;
  /** User-facing, non-paid reward (mapped to the alert-wave model — never a paid hold). */
  reward: string;
  /** done = unlocked; current = the next reward to chase; locked = beyond that. */
  state: "done" | "current" | "locked";
}

/**
 * Fixed referral ladder for §10. Rewards are non-paid and map to the alert-wave
 * model (Standard → Priority → High Priority). No "hold tokens" — paid holds are
 * out of v1 (CLAUDE.md). The order is the source of truth for the rendered steps.
 */
const REFERRAL_LADDER: ReadonlyArray<{ friends: number; reward: string }> = [
  { friends: 1, reward: "+1 request" },
  { friends: 3, reward: "Earlier (Priority) alerts" },
  { friends: 5, reward: "High Priority alert wave" },
];

/**
 * Resolve the ladder against a verified-friend count: each rung is `done` once
 * reached, the first unreached rung is `current`, the rest are `locked`. Defensive:
 * non-finite or negative `invited` floors to 0 (mirrors {@link referralProgress}).
 */
export function referralLadder(invited: number): ReferralStep[] {
  const i = Number.isFinite(invited) && invited > 0 ? Math.floor(invited) : 0;
  let currentAssigned = false;
  return REFERRAL_LADDER.map(({ friends, reward }) => {
    if (i >= friends) return { friends, reward, state: "done" };
    if (!currentAssigned) {
      currentAssigned = true;
      return { friends, reward, state: "current" };
    }
    return { friends, reward, state: "locked" };
  });
}
