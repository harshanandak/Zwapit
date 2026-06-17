/**
 * Human-friendly results count for the Search screen's "Results · …" divider (U2).
 *
 * Pure + unit-testable (no Astro/DOM). Renders correct grammar for the wired result
 * count and a friendly empty phrase for zero/invalid counts — the v5 frame shows
 * "Results · 1 found".
 */
export function resultsLabel(count: number): string {
  if (!Number.isFinite(count) || count < 1) return "No matches yet";
  return `${Math.floor(count)} found`;
}
