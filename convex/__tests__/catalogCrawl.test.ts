import { describe, expect, test } from "bun:test";

// Pure-logic tests for the adaptive bootstrap limit + chunked-wave planning
// used by crawlBmsMovies (kernel 2427bbc4). The Convex action itself is
// exercised against the live Parallel pipeline; here we pin the decision math.

const BOOTSTRAP_THRESHOLD = 500;
const BOOTSTRAP_LIMIT = 250;
const WAVE_SIZE = 25;

function effectiveLimit(storedCount: number, requestedLimit?: number): number {
  if (storedCount < BOOTSTRAP_THRESHOLD) {
    return Math.max(requestedLimit ?? 0, BOOTSTRAP_LIMIT);
  }
  return requestedLimit ?? 10;
}

function chunk<T>(items: T[], size = WAVE_SIZE): T[][] {
  const waves: T[][] = [];
  for (let i = 0; i < items.length; i += size) waves.push(items.slice(i, i + size));
  return waves;
}

describe("adaptive crawl limit", () => {
  test("should use the bootstrap limit when the stored catalog is cold", () => {
    expect(effectiveLimit(0)).toBe(250);
    expect(effectiveLimit(12, 25)).toBe(250); // cron's 25 is overridden during bootstrap
  });

  test("should keep the requested limit once the catalog is warm", () => {
    expect(effectiveLimit(4900, 25)).toBe(25);
    expect(effectiveLimit(499, 25)).toBe(250);
    expect(effectiveLimit(500, 25)).toBe(25);
  });

  test("should respect an explicit larger limit during bootstrap", () => {
    expect(effectiveLimit(100, 400)).toBe(400);
  });
});

describe("chunked waves", () => {
  test("should split the delta into waves of 25 with a partial tail", () => {
    const delta = Array.from({ length: 60 }, (_, i) => i);
    const waves = chunk(delta);
    expect(waves.length).toBe(3);
    expect(waves[0].length).toBe(25);
    expect(waves[2].length).toBe(10);
    expect(waves.flat().length).toBe(60);
  });

  test("should produce no waves for an empty delta", () => {
    expect(chunk([])).toEqual([]);
  });
});
