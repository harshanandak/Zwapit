import { describe, expect, test } from "bun:test";

import { CLERK_JS_SCRIPT_URL, getBrowserClerk, loadClerkRuntime } from "../providerRuntime";

describe("Clerk runtime wrapper", () => {
  test("pins ClerkJS instead of loading the drifting latest build", () => {
    expect(CLERK_JS_SCRIPT_URL).toContain("@clerk/clerk-js@6/");
    expect(CLERK_JS_SCRIPT_URL).not.toContain("@latest");
  });

  test("returns null outside the browser/runtime boundary", async () => {
    expect(getBrowserClerk()).toBeNull();
    expect(await loadClerkRuntime(undefined)).toBeNull();
  });
});
