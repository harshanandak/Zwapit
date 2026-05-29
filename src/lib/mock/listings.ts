import type { MockListing, SourceRule } from "../types";
import { calculateCheckoutTotal } from "./pricing";

export const mockSourceRule: SourceRule = {
  id: "source_rule_bookmyshow_event_v1",
  version: 1,
  source: "bookmyshow",
  category: "event_ticket",
  sourceCategoryKey: "bookmyshow_event",
  decision: "AUTO_APPROVE",
  internalStatus: "ALLOW",
  transferMode: "OFFICIAL_TRANSFER",
  transferability: "transferable",
  protectionLevel: "protected_payment",
  requiredFields: ["title", "eventOrTripStartAt", "venueOrRoute", "quantity", "faceValue", "listingPrice"],
  eligibilityFields: ["sellerPromiseAccepted", "transferDeadlineAt"],
  priceRule: {
    kind: "face_value_cap",
    maxMultiplier: 1,
  },
  payoutPolicy: {
    releaseAfter: "buyer_confirmation_and_issue_window",
    mockOnly: true,
  },
  blockedBehavior: "cannot_list",
  manualReviewReasonCodes: [],
  effectiveFrom: "2026-05-29T00:00:00+05:30",
  lastVerifiedAt: "2026-05-29T00:00:00+05:30",
  verificationSourceUrlOrNote: "Mock BookMyShow event rule for first visible slice.",
  createdBy: "system",
};

const checkoutTotal = calculateCheckoutTotal(2400);

export const mockListing: MockListing = {
  id: "listing_bms_event_1",
  sellerId: "seller_demo_1",
  sourceRuleId: mockSourceRule.id,
  sourceRuleVersion: mockSourceRule.version,
  category: "event_ticket",
  source: "bookmyshow",
  sourceCategoryKey: "bookmyshow_event",
  title: "Arijit Singh Live - Silver Pass",
  venueOrRoute: "Bengaluru Arena",
  eventOrTripStartAt: "2026-12-20T19:00:00+05:30",
  quantity: 1,
  faceValue: 2400,
  listingPrice: 2400,
  platformFee: checkoutTotal.platformFee,
  gstOnFee: checkoutTotal.gstOnPlatformFee,
  totalPayable: checkoutTotal.totalPayable,
  transferMode: "OFFICIAL_TRANSFER",
  transferDeadlineAt: "2026-12-20T18:00:00+05:30",
  protectionDeadlineAt: "2026-12-21T23:59:00+05:30",
  state: "live",
  ruleDecision: "AUTO_APPROVE",
  duplicateFingerprint: "bookmyshow_event:arijit-singh-live-silver-pass:2026-12-20",
};
