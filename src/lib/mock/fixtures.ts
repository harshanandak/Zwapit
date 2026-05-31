import type { MockFixture, MoneySummary } from "../types";
import { mockAuthIdentity, mockUserVerification } from "../auth/mockAuth";
import { mockAuditEvents } from "./audit";
import { mockIssue } from "./issues";
import { mockListing, mockSourceRule } from "./listings";
import { mockOrder } from "./orders";
import { calculateCheckoutTotal } from "./pricing";
import { mockTransferTask } from "./transfers";
import { mockSellerPaymentAccount, mockUser } from "./users";

export { calculateCheckoutTotal };

export function createMockFixture(): MockFixture {
  const paymentSummary: MoneySummary = {
    ...calculateCheckoutTotal(mockListing.listingPrice),
    status: mockOrder.mockPaymentStatus,
  };

  return {
    user: mockUser,
    authIdentity: mockAuthIdentity,
    userVerification: mockUserVerification,
    sellerPaymentAccount: mockSellerPaymentAccount,
    sourceRule: mockSourceRule,
    listing: mockListing,
    order: {
      ...mockOrder,
      mockPaymentSummary: paymentSummary,
    },
    transferTask: mockTransferTask,
    issue: mockIssue,
    auditEvents: mockAuditEvents,
  };
}
