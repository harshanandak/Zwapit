import { describe, expect, test } from "bun:test";

import { buildAuthConfig } from "../auth.config";

describe("Convex auth config", () => {
  test("stays inert when the Clerk issuer env is missing", () => {
    expect(buildAuthConfig({}).providers).toEqual([]);
  });

  test("enables Clerk when the issuer env is configured", () => {
    expect(
      buildAuthConfig({
        issuerDomain: "https://swift-raven-00.clerk.accounts.dev",
      }).providers,
    ).toEqual([
      {
        applicationID: "convex",
        domain: "https://swift-raven-00.clerk.accounts.dev",
      },
    ]);
  });
});
