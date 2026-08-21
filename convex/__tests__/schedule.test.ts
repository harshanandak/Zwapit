import { describe, expect, test } from "bun:test";

import {
  POLL_BACKOFF_TIERS,
  nextCheckWithBackoff,
  nextCheckWithSaleWindow,
} from "../watcher/schedule";

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

describe("nextCheckWithSaleWindow", () => {
  const NOW = Date.parse("2026-08-21T12:00:00.000Z");
  const WATCH_DATE = "2027-01-18"; // far out: distance tier = 24h
  const iso = (ms: number) => new Date(ms).toISOString();

  test("should wake at the sale open instead of sleeping a tier", () => {
    const opensAt = NOW + 3 * 3600_000;
    expect(nextCheckWithSaleWindow(NOW, iso(opensAt), WATCH_DATE)).toBe(iso(opensAt + 2 * 60_000));
  });

  test("should keep the 5-minute floor when the window is imminent", () => {
    const opensAt = NOW + 60_000; // buffer would land before floor
    expect(nextCheckWithSaleWindow(NOW, iso(opensAt), WATCH_DATE)).toBe(iso(NOW + 5 * 60_000));
  });

  test("should never poll later than the distance tier when the window is far", () => {
    const opensAt = NOW + 20 * 86_400_000; // beyond the 14d tier
    expect(nextCheckWithSaleWindow(NOW, iso(opensAt), WATCH_DATE)).toBe(
      iso(NOW + 24 * 3600_000),
    );
  });

  test("should poll at floor cadence when the held window already opened (propagation lag)", () => {
    const opened = NOW - 10 * 60_000; // opened 10 min ago, page still not live
    expect(nextCheckWithSaleWindow(NOW, iso(opened), WATCH_DATE)).toBe(iso(NOW + 5 * 60_000));
  });

  test("should fall back to pure tiers on unparseable instants", () => {
    expect(nextCheckWithSaleWindow(NOW, undefined, WATCH_DATE)).toBe(iso(NOW + 24 * 3600_000));
    expect(nextCheckWithSaleWindow(NOW, "garbage", WATCH_DATE)).toBe(iso(NOW + 24 * 3600_000));
  });

  test("should fall back when the instant lands after the watched day ends", () => {
    // Yearless-label oversleep guard: sale-open after event end-of-day = garbage.
    const afterEod = Date.parse("2027-01-19T12:00:00.000Z");
    expect(nextCheckWithSaleWindow(NOW, iso(afterEod), WATCH_DATE)).toBe(
      iso(NOW + 24 * 3600_000),
    );
  });
});
