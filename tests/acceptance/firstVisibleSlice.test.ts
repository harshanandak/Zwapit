import { describe, expect, test } from "bun:test";

import {
  verifyAcceptanceCriteria,
  verifyNoScopeDrift,
  verifyRouteCoverage,
} from "../../scripts/verify-first-visible-slice.mjs";

describe("first visible slice acceptance verification", () => {
  test("all contract routes render from the built output", () => {
    const result = verifyRouteCoverage();

    expect(result.ok, result.failures.join("\n")).toBe(true);
  });

  test("first visible slice acceptance criteria pass", async () => {
    const result = await verifyAcceptanceCriteria();

    expect(result.ok, result.failures.join("\n")).toBe(true);
  });

  test("first visible slice has no forbidden scope drift", async () => {
    const result = await verifyNoScopeDrift();

    expect(result.ok, result.failures.join("\n")).toBe(true);
  });
});
