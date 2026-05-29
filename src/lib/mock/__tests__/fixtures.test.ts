import { describe, expect, test } from "bun:test";

import { requirePhoneVerified, requireUser, syncUserToConvex } from "../../auth/authAdapter";
import { mockCurrentUserId } from "../../auth/mockAuth";
import { calculateCheckoutTotal, createMockFixture } from "../fixtures";

describe("local mock fixture contract", () => {
  test("uses the first-slice ids and protected transfer contract", () => {
    const fixture = createMockFixture();

    expect(mockCurrentUserId).toBe("user_demo_1");
    expect(fixture.user.id).toBe("user_demo_1");
    expect(fixture.listing.id).toBe("listing_bms_event_1");
    expect(fixture.order.id).toBe("order_demo_1");
    expect(fixture.transferTask.id).toBe("transfer_demo_1");
    expect(fixture.issue.id).toBe("issue_demo_1");
    expect(fixture.sourceRule.sourceCategoryKey).toBe("bookmyshow_event");
    expect(fixture.sourceRule.decision).toBe("AUTO_APPROVE");
    expect(fixture.sourceRule.transferMode).toBe("OFFICIAL_TRANSFER");
    expect(fixture.listing.transferMode).toBe("OFFICIAL_TRANSFER");
  });

  test("calculates INR 10 plus GST on top of item price", () => {
    const total = calculateCheckoutTotal(2400);

    expect(total.currency).toBe("INR");
    expect(total.itemPrice).toBe(2400);
    expect(total.platformFee).toBe(10);
    expect(total.gstOnPlatformFee).toBe(1.8);
    expect(total.totalPayable).toBe(2411.8);
  });

  test("keeps internal app user id separate from provider identity", () => {
    const user = requireUser();
    const verifiedUser = requirePhoneVerified();
    const syncResult = syncUserToConvex();

    expect(user.id).toBe("user_demo_1");
    expect(verifiedUser.phoneVerified).toBe(true);
    expect(syncResult.appUser.id).toBe("user_demo_1");
    expect(syncResult.authIdentity.provider).toBe("mock_phone");
    expect(syncResult.authIdentity.providerUserId).toBe("mock_phone_user_demo_1");
    expect(syncResult.authIdentity.providerUserId).not.toBe(syncResult.appUser.id);
  });

  test("sets order, transfer, and deadline fields from the implementation contract", () => {
    const fixture = createMockFixture();

    expect(fixture.order.buyerId).toBe("user_demo_1");
    expect(fixture.order.sellerId).toBe("seller_demo_1");
    expect(fixture.order.state).toBe("checkout_pending");
    expect(fixture.transferTask.orderId).toBe("order_demo_1");
    expect(fixture.transferTask.requiredActor).toBe("seller");
    expect(fixture.transferTask.deadlineAt).toBe(fixture.listing.transferDeadlineAt);
    expect(Date.parse(fixture.listing.transferDeadlineAt)).toBeLessThan(
      Date.parse(fixture.listing.eventOrTripStartAt),
    );
  });
});
