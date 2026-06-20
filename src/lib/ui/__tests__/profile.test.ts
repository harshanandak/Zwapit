import { describe, expect, test } from "bun:test";

import { referralLadder, referralProgress } from "../profile";

describe("referralProgress (Profile referral bar, U6)", () => {
  test("should render the invited-of-target label and clamped fill percent for any input", () => {
    // [invited, target, expected]
    const cases: Array<[number, number, { label: string; percent: number }]> = [
      [1, 3, { label: "1 of 3 friends invited", percent: 33 }],
      [0, 3, { label: "0 of 3 friends invited", percent: 0 }],
      [3, 3, { label: "3 of 3 friends invited", percent: 100 }],
      [5, 3, { label: "5 of 3 friends invited", percent: 100 }],
      [-1, 3, { label: "0 of 3 friends invited", percent: 0 }],
      [Number.NaN, 3, { label: "0 of 3 friends invited", percent: 0 }],
      [1, 0, { label: "1 of 0 friends invited", percent: 0 }],
    ];
    for (const [invited, target, expected] of cases) {
      expect(referralProgress(invited, target)).toEqual(expected);
    }
  });
});

describe("referralLadder (Plans & Referrals rewards ladder, U9)", () => {
  test("should mark each step done/current/locked when the verified-friend count changes", () => {
    const states = (invited: number) => referralLadder(invited).map((s) => s.state);
    // [invited, expected states for the three steps (1 / 3 / 5 friends)]
    const cases: Array<[number, Array<"done" | "current" | "locked">]> = [
      [0, ["current", "locked", "locked"]],
      [0.5, ["current", "locked", "locked"]], // fractional positive floors to 0

      [1, ["done", "current", "locked"]],
      [2, ["done", "current", "locked"]],
      [3, ["done", "done", "current"]],
      [5, ["done", "done", "done"]],
      [10, ["done", "done", "done"]],
      [-2, ["current", "locked", "locked"]],
      [Number.NaN, ["current", "locked", "locked"]],
    ];
    for (const [invited, expected] of cases) {
      expect(states(invited)).toEqual(expected);
    }
  });

  test("should expose the fixed thresholds and non-paid rewards when the ladder is built", () => {
    const ladder = referralLadder(0);
    expect(ladder.map((s) => s.friends)).toEqual([1, 3, 5]);
    expect(ladder.map((s) => s.reward)).toEqual([
      "+1 request",
      "Earlier (Priority) alerts",
      "High Priority alert wave",
    ]);
  });
});
