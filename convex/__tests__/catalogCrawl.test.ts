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
  test("should keep bootstrap active until the backlog fits in one maintenance run", () => {
    expect(effectiveCrawlLimit(4_900, 25)).toBe(250);
    expect(effectiveCrawlLimit(4_400, 25)).toBe(250);
    expect(effectiveCrawlLimit(26, 25)).toBe(250);
    expect(effectiveCrawlLimit(25, 25)).toBe(25);
  });

  test("should respect an explicit larger limit", () => {
    expect(effectiveCrawlLimit(4_900, 400)).toBe(400);
  });
});

describe("chunked waves", () => {
  test("should split the delta into waves of 25 with a partial tail", () => {
    const delta = Array.from({ length: 60 }, (_, i) => i);
    const waves = chunkIntoWaves(delta);
    expect(waves.length).toBe(3);
    expect(waves[0].length).toBe(25);
    expect(waves[2].length).toBe(10);
    expect(waves.flat().length).toBe(60);
  });

  test("should produce no waves for an empty delta", () => {
    expect(chunkIntoWaves([])).toEqual([]);
  });
});

describe("crawl action validation", () => {
  test("should reject an invalid limit even when Parallel is not configured", async () => {
    delete process.env.PARALLEL_API_KEY;

    await expect(handlerOf(crawlBmsMovies)({}, { limit: 0 })).rejects.toThrow("CRAWL_LIMIT_INVALID");
    await expect(handlerOf(crawlBmsMovies)({}, { limit: 1.5 })).rejects.toThrow("CRAWL_LIMIT_INVALID");
  });

  test("should no-op safely without a Parallel key when the limit is valid", async () => {
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
