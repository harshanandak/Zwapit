import { afterEach, describe, expect, test } from "bun:test";

import { chunkIntoWaves, crawlBmsMovies, effectiveCrawlLimit } from "../catalogCrawl";

type ConvexActionForTest = {
  _handler: (ctx: unknown, args: { limit?: number }) => Promise<unknown>;
};

const originalParallelApiKey = process.env.PARALLEL_API_KEY;

afterEach(() => {
  if (originalParallelApiKey === undefined) {
    delete process.env.PARALLEL_API_KEY;
  } else {
    process.env.PARALLEL_API_KEY = originalParallelApiKey;
  }
});

function handlerOf(fn: unknown): ConvexActionForTest["_handler"] {
  return (fn as ConvexActionForTest)._handler;
}

describe("adaptive crawl limit", () => {
  test("should keep bootstrap active when the backlog exceeds one maintenance run", () => {
    expect(effectiveCrawlLimit(4_900, 25)).toBe(250);
    expect(effectiveCrawlLimit(4_400, 25)).toBe(250);
    expect(effectiveCrawlLimit(26, 25)).toBe(250);
    expect(effectiveCrawlLimit(25, 25)).toBe(25);
  });

  test("should respect an explicit larger limit when bootstrap is active", () => {
    expect(effectiveCrawlLimit(4_900, 400)).toBe(400);
  });
});

describe("chunked waves", () => {
  test("should split into waves of 25 when the delta has a partial tail", () => {
    const delta = Array.from({ length: 60 }, (_, i) => i);
    const waves = chunkIntoWaves(delta);
    expect(waves.length).toBe(3);
    expect(waves[0].length).toBe(25);
    expect(waves[2].length).toBe(10);
    expect(waves.flat().length).toBe(60);
  });

  test("should produce no waves when the delta is empty", () => {
    expect(chunkIntoWaves([])).toEqual([]);
  });

  test("should reject the wave size when it is not a positive integer", () => {
    expect(() => chunkIntoWaves([1], 0)).toThrow("CRAWL_WAVE_SIZE_INVALID");
    expect(() => chunkIntoWaves([1], 1.5)).toThrow("CRAWL_WAVE_SIZE_INVALID");
  });
});

describe("crawl action validation", () => {
  test("should reject an invalid limit when Parallel is not configured", async () => {
    delete process.env.PARALLEL_API_KEY;

    await expect(handlerOf(crawlBmsMovies)({}, { limit: 0 })).rejects.toThrow("CRAWL_LIMIT_INVALID");
    await expect(handlerOf(crawlBmsMovies)({}, { limit: 1.5 })).rejects.toThrow("CRAWL_LIMIT_INVALID");
  });

  test("should no-op safely when Parallel is not configured and the limit is valid", async () => {
    delete process.env.PARALLEL_API_KEY;

    await expect(handlerOf(crawlBmsMovies)({}, { limit: 25 })).resolves.toEqual({
      scanned: 0,
      delta: 0,
      hydrated: 0,
      created: 0,
      updated: 0,
      remaining: 0,
    });
  });
});
