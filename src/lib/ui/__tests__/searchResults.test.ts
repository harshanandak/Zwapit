import { describe, expect, test } from "bun:test";

import { resultsLabel } from "../searchResults";

describe("resultsLabel (Search results count, U2)", () => {
  test("renders a singular/plural count for one or more matches", () => {
    expect(resultsLabel(1)).toBe("1 found");
    expect(resultsLabel(5)).toBe("5 found");
  });

  test("renders an empty-state phrase for zero matches", () => {
    expect(resultsLabel(0)).toBe("No matches yet");
  });

  test("guards negative and non-finite counts", () => {
    expect(resultsLabel(-1)).toBe("No matches yet");
    expect(resultsLabel(NaN)).toBe("No matches yet");
  });

  test("truncates non-integer counts via Math.floor", () => {
    expect(resultsLabel(1.7)).toBe("1 found");
  });
});
