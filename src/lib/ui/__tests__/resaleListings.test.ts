import { describe, expect, test } from "bun:test";

import { isLiveResale } from "../resaleListings";

describe("isLiveResale (community resale visibility predicate)", () => {
  test("includes live and waitlist_only listings", () => {
    expect(isLiveResale({ state: "live" })).toBe(true);
    expect(isLiveResale({ state: "waitlist_only" })).toBe(true);
  });

  test("excludes every other listing state", () => {
    for (const state of [
      "draft",
      "under_review",
      "sold",
      "paused",
      "expired",
      "blocked",
    ]) {
      expect(isLiveResale({ state })).toBe(false);
    }
  });
});
