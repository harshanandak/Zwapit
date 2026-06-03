import { describe, expect, test } from "bun:test";

import {
  createClerkAuthState,
  createMockAuthState,
  createSignedOutAuthState,
  getAuthActionState,
} from "../../auth/authAdapter";
import { createMockFixture } from "../../mock/fixtures";
import { blockedWatcherRule } from "../../rules/sourceRules";
import { validateSellerListing, validateSellerSubmissionAccess } from "../sellerValidation";

const SELL_HREF = "/app/sell/promise";
function sellAction(state: Parameters<typeof getAuthActionState>[2]) {
  return getAuthActionState("sell", SELL_HREF, state, { requirePhoneVerified: true });
}

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

describe("seller submission access gate", () => {
  test("allows a signed-in, phone-verified seller to submit the listing", () => {
    expect(validateSellerSubmissionAccess(sellAction(createMockAuthState()))).toEqual({ ok: true, blockers: [] });
  });

  test("blocks listing submission for a signed-out user", () => {
    const result = validateSellerSubmissionAccess(sellAction(createSignedOutAuthState()));

    expect(result.ok).toBe(false);
    expect(result.blockers).toEqual(["AUTH_REQUIRED"]);
  });

  test("blocks listing submission for a signed-in, phone-unverified user", () => {
    const unverified = createClerkAuthState({
      appUserId: "user_seller_internal_1",
      providerUserId: "user_2seller_unverified",
      displayName: "Unverified Seller",
      phoneVerified: false,
    });
    const result = validateSellerSubmissionAccess(sellAction(unverified));

    expect(result.ok).toBe(false);
    expect(result.blockers).toEqual(["PHONE_VERIFICATION_REQUIRED"]);
  });
});
