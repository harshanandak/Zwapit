import { bookmyshowEventRule } from "../rules/sourceRules";
import type { MockListing } from "../types";
import { calculateCheckoutTotal } from "./pricing";

export const mockSourceRule = bookmyshowEventRule;

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
