import { beforeAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";

import {
  verifyAcceptanceCriteria,
  verifyNoScopeDrift,
  verifyRouteCoverage,
} from "../../scripts/verify-first-visible-slice.mjs";

describe("first visible slice acceptance verification", () => {
  beforeAll(() => {
    const build = spawnSync("bun", ["run", "build"], {
      encoding: "utf8",
      shell: process.platform === "win32",
    });

    expect(build.status, `${build.stdout}\n${build.stderr}`).toBe(0);
  }, 180000);

  test("all contract routes render from the built output", () => {
    const result = verifyRouteCoverage();

    expect(result.ok, result.failures.join("\n")).toBe(true);
  }, 30000);

  test("first visible slice acceptance criteria pass", async () => {
    const result = await verifyAcceptanceCriteria();

    expect(result.ok, result.failures.join("\n")).toBe(true);
  }, 30000);

  test("first visible slice has no forbidden scope drift", async () => {
    const result = await verifyNoScopeDrift();

    expect(result.ok, result.failures.join("\n")).toBe(true);
  }, 30000);
});
