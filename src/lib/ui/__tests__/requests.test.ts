import { describe, expect, test } from "bun:test";

import { requestQuota, requestStateMeta } from "../requests";

describe("requestQuota (Requests quota meter, U3)", () => {
  test("should render the count label and clamped fill percent for any used/total", () => {
    // [used, total, expected] — covers valid, zero, clamp, negative/non-finite, zero-total.
    const cases: Array<[number, number, { label: string; percent: number }]> = [
      [2, 3, { label: "2 / 3 active requests", percent: 67 }],
      [1, 2, { label: "1 / 2 active requests", percent: 50 }],
      [0, 3, { label: "0 / 3 active requests", percent: 0 }],
      [5, 3, { label: "5 / 3 active requests", percent: 100 }],
      [-1, 3, { label: "0 / 3 active requests", percent: 0 }],
      [Number.NaN, 3, { label: "0 / 3 active requests", percent: 0 }],
      [2, 0, { label: "2 / 0 active requests", percent: 0 }],
    ];
    for (const [used, total, expected] of cases) {
      expect(requestQuota(used, total)).toEqual(expected);
    }
  });
});

describe("requestStateMeta (Requests state chip, U3)", () => {
  test("should map each request state to its label and chip variant, defaulting to active", () => {
    const cases: Array<[string, { label: string; chip: string }]> = [
      ["active", { label: "Active", chip: "req" }],
      ["matched", { label: "Matched", chip: "live" }],
      ["purchased", { label: "Purchased", chip: "protect" }],
      ["expired", { label: "Expired", chip: "mut" }],
      ["nonsense", { label: "Active", chip: "req" }],
    ];
    for (const [state, expected] of cases) {
      expect(requestStateMeta(state)).toEqual(expected);
    }
  });
});
