import { describe, expect, test } from "bun:test";

import { referralProgress } from "../profile";

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
