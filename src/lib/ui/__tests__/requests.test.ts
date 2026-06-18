import { describe, expect, test } from "bun:test";

import { requestQuota, requestStateMeta } from "../requests";

describe("requestQuota (Requests quota meter, U3)", () => {
  test("should render the count label and rounded fill percent when used and total are valid", () => {
    expect(requestQuota(2, 3)).toEqual({ label: "2 / 3 active requests", percent: 67 });
    expect(requestQuota(1, 2)).toEqual({ label: "1 / 2 active requests", percent: 50 });
  });

  test("should report zero percent when no requests are used", () => {
    expect(requestQuota(0, 3)).toEqual({ label: "0 / 3 active requests", percent: 0 });
  });

  test("should clamp percent to 100 when used exceeds total", () => {
    expect(requestQuota(5, 3)).toEqual({ label: "5 / 3 active requests", percent: 100 });
  });

  test("should floor used to zero when used is negative or non-finite", () => {
    expect(requestQuota(-1, 3)).toEqual({ label: "0 / 3 active requests", percent: 0 });
    expect(requestQuota(Number.NaN, 3)).toEqual({ label: "0 / 3 active requests", percent: 0 });
  });

  test("should report zero percent when total is zero or non-positive", () => {
    expect(requestQuota(2, 0)).toEqual({ label: "2 / 0 active requests", percent: 0 });
  });
});

describe("requestStateMeta (Requests state chip, U3)", () => {
  test("should map active to the bronze request chip", () => {
    expect(requestStateMeta("active")).toEqual({ label: "Active", chip: "req" });
  });

  test("should map matched to the gold live chip", () => {
    expect(requestStateMeta("matched")).toEqual({ label: "Matched", chip: "live" });
  });

  test("should map purchased to the jade protect chip", () => {
    expect(requestStateMeta("purchased")).toEqual({ label: "Purchased", chip: "protect" });
  });

  test("should map expired to the muted chip", () => {
    expect(requestStateMeta("expired")).toEqual({ label: "Expired", chip: "mut" });
  });

  test("should fall back to the active chip when the state is unknown", () => {
    expect(requestStateMeta("nonsense")).toEqual({ label: "Active", chip: "req" });
  });
});
