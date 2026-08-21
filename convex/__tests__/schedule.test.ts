import { describe, expect, test } from "bun:test";

import { POLL_BACKOFF_TIERS, nextCheckWithBackoff } from "../watcher/schedule";

// Pure unit tests — schedule.ts has no Convex imports, no codegen needed.

const NOW = Date.parse("2026-08-21T12:00:00.000Z");
const MIN = 60_000;

function daysFromNow(days: number): string {
  return new Date(NOW + days * 86_400_000).toISOString();
}

describe("nextCheckWithBackoff", () => {
  test("far-future targets back off to 24h", () => {
    const next = nextCheckWithBackoff(NOW, daysFromNow(150));
    expect(Date.parse(next) - NOW).toBe(24 * 60 * MIN);
  });

  test("a week out polls every 6h", () => {
    expect(Date.parse(nextCheckWithBackoff(NOW, daysFromNow(8))) - NOW).toBe(6 * 60 * MIN);
  });

  test("two days out polls hourly", () => {
    expect(Date.parse(nextCheckWithBackoff(NOW, daysFromNow(3))) - NOW).toBe(60 * MIN);
  });

  test("inside 48h keeps the base 5-minute cadence", () => {
    expect(Date.parse(nextCheckWithBackoff(NOW, daysFromNow(1))) - NOW).toBe(5 * MIN);
    expect(Date.parse(nextCheckWithBackoff(NOW, daysFromNow(0))) - NOW).toBe(5 * MIN);
  });

  test("past dates (expiry race) keep the base cadence", () => {
    expect(Date.parse(nextCheckWithBackoff(NOW, daysFromNow(-1))) - NOW).toBe(5 * MIN);
  });

  test("unparseable date fails open to the base cadence", () => {
    expect(Date.parse(nextCheckWithBackoff(NOW, "not-a-date")) - NOW).toBe(5 * MIN);
  });

  test("tier boundaries are inclusive and ordered most-distant first", () => {
    expect(Date.parse(nextCheckWithBackoff(NOW, daysFromNow(14))) - NOW).toBe(24 * 60 * MIN);
    expect(Date.parse(nextCheckWithBackoff(NOW, daysFromNow(7))) - NOW).toBe(6 * 60 * MIN);
    expect(Date.parse(nextCheckWithBackoff(NOW, daysFromNow(2))) - NOW).toBe(60 * MIN);
    const mins = POLL_BACKOFF_TIERS.map((t) => t.minDaysOut);
    for (let i = 1; i < mins.length; i += 1) expect(mins[i - 1]).toBeGreaterThan(mins[i]);
  });
});
