import type { MockOrder } from "../types";
import { calculateCheckoutTotal } from "./pricing";

export const mockOrder: MockOrder = {
  id: "order_demo_1",
  buyerId: "user_demo_1",
  sellerId: "seller_demo_1",
  listingId: "listing_bms_event_1",
  state: "checkout_pending",
  mockPaymentStatus: "mock_unpaid",
  mockPaymentSummary: calculateCheckoutTotal(2400),
  transferTaskId: "transfer_demo_1",
  issueWindowEndsAt: "2026-12-21T23:59:00+05:30",
  createdAt: "2026-05-29T12:00:00+05:30",
};
