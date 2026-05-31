import { describe, expect, test } from "bun:test";

import { createMockFixture } from "../../mock/fixtures";
import { blockedWatcherRule } from "../../rules/sourceRules";
import { validateSellerListing } from "../sellerValidation";

describe("seller listing validation blockers", () => {
  test("accepts the first visible slice listing fixture", () => {
    const fixture = createMockFixture();

    expect(validateSellerListing(fixture.listing, fixture.sourceRule)).toEqual({
      ok: true,
      blockers: [],
    });
  });

  test("blocks missing required listing fields with explicit reason codes", () => {
    const fixture = createMockFixture();
    const result = validateSellerListing(
      {
        ...fixture.listing,
        title: "",
        venueOrRoute: "",
        quantity: 0,
      },
      fixture.sourceRule,
    );

    expect(result.ok).toBe(false);
    expect(result.blockers).toContain("MISSING_TITLE");
    expect(result.blockers).toContain("MISSING_VENUE_OR_ROUTE");
    expect(result.blockers).toContain("INVALID_QUANTITY");
  });

  test("should block seller listing when the source rule is auto block", () => {
    const fixture = createMockFixture();
    const result = validateSellerListing(
      {
        ...fixture.listing,
        sourceRuleId: blockedWatcherRule.id,
        sourceRuleVersion: blockedWatcherRule.version,
        ruleDecision: "AUTO_BLOCK",
      },
      blockedWatcherRule,
    );

    expect(result.ok).toBe(false);
    expect(result.blockers).toContain("RULE_BLOCKED");
  });
});
