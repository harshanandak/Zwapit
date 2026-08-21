// Poll-cadence backoff for monitor targets (efficiency/egress constraint —
// events-phase2 design §Constraints).
//
// PURE TS — NO Convex-runtime imports, unit-testable without codegen.
//
// Problem: alerts are set DAYS before movies open but MONTHS before events go
// on sale (District sales timelines publish pre-sale dates months out). A flat
// 5-minute cadence burns ~43k Parallel checks (~$43) per far-future target
// while adding nothing — the sale cannot open early.
//
// Tiers trade detection lag for egress: far-out targets poll slowly and tighten
// as the date approaches. Worst-case detection lag by distance:
//   >= 14 days out -> 24h   |  >= 7 days -> 6h  |  >= 2 days -> 1h  |  < 2 days -> 5min
// A 150-day event alert drops from ~43k checks to ~900 (~98%); near-term
// responsiveness inside 48h is unchanged.

/** Backoff tiers, most-distant first. `minDaysOut` is inclusive. */
export const POLL_BACKOFF_TIERS: ReadonlyArray<{ minDaysOut: number; minutes: number }> = [
  { minDaysOut: 14, minutes: 24 * 60 },
  { minDaysOut: 7, minutes: 6 * 60 },
  { minDaysOut: 2, minutes: 60 },
  { minDaysOut: Number.NEGATIVE_INFINITY, minutes: 5 },
];

/**
 * Next `nextCheckAt` for a still-watching target, backed off by how far the
 * watched date is. Unparseable dates fall back to the base 5-minute cadence
 * (fail open toward responsiveness, never toward silence).
 */
export function nextCheckWithBackoff(nowMs: number, targetDate: string): string {
  const targetMs = Date.parse(targetDate);
  if (!Number.isFinite(targetMs)) {
    return new Date(nowMs + 5 * 60_000).toISOString();
  }
  const daysOut = (targetMs - nowMs) / 86_400_000;
  for (const tier of POLL_BACKOFF_TIERS) {
    if (daysOut >= tier.minDaysOut) {
      return new Date(nowMs + tier.minutes * 60_000).toISOString();
    }
  }
  return new Date(nowMs + 5 * 60_000).toISOString();
}
