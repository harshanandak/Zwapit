import { describe, expect, test } from "bun:test";

import { createMockFixture } from "../../mock/fixtures";
import { validateBuyerConfirmation, validateCheckout } from "../checkoutValidation";

describe("checkout validation blockers", () => {
  test("accepts live listing with visible totals and ready mock payout", () => {
    const fixture = createMockFixture();
    const result = validateCheckout({
      listing: fixture.listing,
      sourceRule: fixture.sourceRule,
      sellerPaymentAccount: fixture.sellerPaymentAccount,
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
      totalShownToBuyer: undefined,
      now: "2026-12-20T12:00:00+05:30",
    });

    expect(result.ok).toBe(false);
    expect(result.blockers).toContain("LISTING_NOT_LIVE");
    expect(result.blockers).toContain("TRANSFER_DEADLINE_EXPIRED");
    expect(result.blockers).toContain("TOTAL_NOT_SHOWN");
    expect(result.blockers).toContain("RULE_NOT_PURCHASABLE");
    expect(result.blockers).toContain("SELLER_PAYOUT_NOT_READY");
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
