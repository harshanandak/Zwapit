import { describe, expect, test } from "bun:test";

import {
  createClerkAuthState,
  createMockAuthState,
  createSignedOutAuthState,
  getAuthActionState,
} from "../../auth/authAdapter";
import { createMockFixture } from "../../mock/fixtures";
import { validateBuyerCheckoutAccess, validateBuyerConfirmation, validateCheckout } from "../checkoutValidation";

const CHECKOUT_HREF = "/app/checkout/listing_bms_event_1";
function buyAction(state: Parameters<typeof getAuthActionState>[2]) {
  return getAuthActionState("buy", CHECKOUT_HREF, state, { requirePhoneVerified: true });
}

describe("checkout validation blockers", () => {
  test("accepts live listing with visible totals and ready mock payout", () => {
    const fixture = createMockFixture();
    const result = validateCheckout({
      listing: fixture.listing,
      sourceRule: fixture.sourceRule,
      sellerPaymentAccount: fixture.sellerPaymentAccount,
      buyerEligibilityAcknowledged: true,
      totalShownToBuyer: fixture.listing.totalPayable,
      now: "2026-12-20T12:00:00+05:30",
    });

    expect(result).toEqual({ ok: true, blockers: [] });
  });

  test("blocks non-live, expired, hidden total, blocked/waitlist rules, and missing payout account", () => {
    const fixture = createMockFixture();
    const result = validateCheckout({
      listing: {
        ...fixture.listing,
        state: "waitlist_only",
        transferDeadlineAt: "2026-12-20T10:00:00+05:30",
        ruleDecision: "AUTO_WAITLIST",
      },
      sourceRule: {
        ...fixture.sourceRule,
        decision: "AUTO_WAITLIST",
      },
      sellerPaymentAccount: {
        ...fixture.sellerPaymentAccount,
        status: "mock_missing",
      },
      buyerEligibilityAcknowledged: false,
      totalShownToBuyer: undefined,
      now: "2026-12-20T12:00:00+05:30",
    });

    expect(result.ok).toBe(false);
    expect(result.blockers).toContain("LISTING_NOT_LIVE");
    expect(result.blockers).toContain("TRANSFER_DEADLINE_EXPIRED");
    expect(result.blockers).toContain("BUYER_ELIGIBILITY_NOT_ACKNOWLEDGED");
    expect(result.blockers).toContain("TOTAL_NOT_SHOWN");
    expect(result.blockers).toContain("RULE_NOT_PURCHASABLE");
    expect(result.blockers).toContain("SELLER_PAYOUT_NOT_READY");
  });

  test("blocks payout accounts that belong to a different seller", () => {
    const fixture = createMockFixture();
    const result = validateCheckout({
      listing: fixture.listing,
      sourceRule: fixture.sourceRule,
      sellerPaymentAccount: {
        ...fixture.sellerPaymentAccount,
        sellerId: "seller_other_1",
      },
      buyerEligibilityAcknowledged: true,
      totalShownToBuyer: fixture.listing.totalPayable,
      now: "2026-12-20T12:00:00+05:30",
    });

    expect(result.ok).toBe(false);
    expect(result.blockers).toContain("SELLER_PAYOUT_ACCOUNT_MISMATCH");
  });

  test("should block checkout when transfer timestamps are invalid", () => {
    const fixture = createMockFixture();
    const invalidNow = validateCheckout({
      listing: fixture.listing,
      sourceRule: fixture.sourceRule,
      sellerPaymentAccount: fixture.sellerPaymentAccount,
      buyerEligibilityAcknowledged: true,
      totalShownToBuyer: fixture.listing.totalPayable,
      now: "not-a-date",
    });
    const invalidDeadline = validateCheckout({
      listing: {
        ...fixture.listing,
        transferDeadlineAt: "not-a-date",
      },
      sourceRule: fixture.sourceRule,
      sellerPaymentAccount: fixture.sellerPaymentAccount,
      buyerEligibilityAcknowledged: true,
      totalShownToBuyer: fixture.listing.totalPayable,
      now: "2026-12-20T12:00:00+05:30",
    });

    expect(invalidNow.ok).toBe(false);
    expect(invalidNow.blockers).toContain("TRANSFER_DEADLINE_EXPIRED");
    expect(invalidDeadline.ok).toBe(false);
    expect(invalidDeadline.blockers).toContain("TRANSFER_DEADLINE_EXPIRED");
  });

  test("buyer checkout access allows a signed-in, phone-verified buyer", () => {
    expect(validateBuyerCheckoutAccess(buyAction(createMockAuthState()))).toEqual({ ok: true, blockers: [] });
  });

  test("buyer checkout access blocks signed-out and phone-unverified buyers", () => {
    expect(validateBuyerCheckoutAccess(buyAction(createSignedOutAuthState()))).toEqual({
      ok: false,
      blockers: ["AUTH_REQUIRED"],
    });

    const unverified = createClerkAuthState({
      appUserId: "user_buyer_internal_1",
      providerUserId: "user_2buyer_unverified",
      displayName: "Unverified Buyer",
      phoneVerified: false,
    });
    expect(validateBuyerCheckoutAccess(buyAction(unverified))).toEqual({
      ok: false,
      blockers: ["PHONE_VERIFICATION_REQUIRED"],
    });
  });

  test("buyer confirmation blocks wrong order state", () => {
    const fixture = createMockFixture();

    expect(validateBuyerConfirmation(fixture.order).ok).toBe(false);
    expect(validateBuyerConfirmation({ ...fixture.order, state: "transfer_submitted" })).toEqual({
      ok: true,
      blockers: [],
    });
  });
});
