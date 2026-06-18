// Pure display helpers for the Requests screen (U3). No Astro/DOM imports, so
// they are unit-testable with `bun test`. Source of truth for the frame:
// docs/work/2026-06-12-ui-revamp/alerts-requests-screen-spec.md §4.

/** The four request lifecycle states surfaced on the Requests landing. */
export type RequestState = "active" | "matched" | "purchased" | "expired";

/**
 * Quota-meter label + track-fill percent for the `.quota` row, e.g.
 * `{ label: "2 / 3 active requests", percent: 67 }`. Defensive: non-finite or
 * negative `used` floors to 0; a non-positive/non-finite `total` yields 0%.
 * percent is rounded and clamped to 0..100 for the `.track i` width.
 */
export function requestQuota(used: number, total: number): { label: string; percent: number } {
  const u = Number.isFinite(used) && used > 0 ? Math.floor(used) : 0;
  const t = Number.isFinite(total) && total > 0 ? Math.floor(total) : 0;
  const percent = t > 0 ? Math.min(100, Math.max(0, Math.round((u / t) * 100))) : 0;
  return { label: `${u} / ${t} active requests`, percent };
}

/**
 * State → user-facing label + `.chip` variant (spec line 104):
 * Active→`req` (bronze), Matched→`live` (gold), Purchased→`protect` (jade),
 * Expired→`mut` (muted). Unknown states fall back to Active styling.
 */
export function requestStateMeta(state: string): { label: string; chip: string } {
  switch (state) {
    case "matched":
      return { label: "Matched", chip: "live" };
    case "purchased":
      return { label: "Purchased", chip: "protect" };
    case "expired":
      return { label: "Expired", chip: "mut" };
    case "active":
    default:
      return { label: "Active", chip: "req" };
  }
}
