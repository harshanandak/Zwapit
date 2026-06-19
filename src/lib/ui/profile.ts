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
