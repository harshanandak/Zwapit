import { describe, expect, test } from "bun:test";

import { resultsLabel } from "../searchResults";

describe("resultsLabel (Search results count, U2)", () => {
  test("should render found count when matches are one or more", () => {
    expect(resultsLabel(1)).toBe("1 found");
    expect(resultsLabel(5)).toBe("5 found");
  });

  test("should render empty-state phrase when matches are zero", () => {
    expect(resultsLabel(0)).toBe("No matches yet");
  });

  test("should render empty-state phrase when count is negative or non-finite", () => {
    expect(resultsLabel(-1)).toBe("No matches yet");
    expect(resultsLabel(Number.NaN)).toBe("No matches yet");
  });

  test("should truncate count when input is non-integer", () => {
    expect(resultsLabel(1.7)).toBe("1 found");
  });
});
