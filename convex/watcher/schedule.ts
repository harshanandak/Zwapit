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

/** Wake this long AFTER a parsed sale-open instant (clock-skew margin). */
export const SALE_BUFFER_MS = 2 * 60_000;

function endOfDayMs(targetDate: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(targetDate ?? "");
  if (!m) return Number.NaN;
  return Date.parse(`${m[1]}-${m[2]}-${m[3]}T23:59:59.999Z`);
}

/**
 * Next `nextCheckAt` when we hold a parsed District sale-open instant:
 * wake just after the window opens (buffered), but never sooner than the
 * 5-minute floor and never later than the distance-based tier would poll
 * anyway. A saleOpensAt beyond the watched date's end-of-day is garbage
 * (yearless-label oversleep) and falls back to pure tiers; so does an
 * unparseable instant. Fail-open philosophy: parse regressions degrade to
 * exactly today's behavior.
 */
export function nextCheckWithSaleWindow(
  nowMs: number,
  saleOpensAtIso: string | undefined | null,
  targetDate: string,
): string {
  const tiered = Date.parse(nextCheckWithBackoff(nowMs, targetDate));
  const floor = nowMs + 5 * 60_000;

  const open = saleOpensAtIso ? Date.parse(saleOpensAtIso) : Number.NaN;
  // Past instants are stale data (the poll that saw them should have fired);
  // beyond-end-of-day instants are yearless-label garbage. Both fall back.
  const eod = endOfDayMs(targetDate);
  if (!Number.isFinite(open) || open <= nowMs || (Number.isFinite(eod) && open > eod)) {
    return new Date(Math.max(tiered, floor)).toISOString();
  }

  const wakeAt = open + SALE_BUFFER_MS;
  return new Date(Math.max(Math.min(wakeAt, tiered), floor)).toISOString();
}

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
