import { describe, expect, test } from "bun:test";

import type { MockListing } from "../../types";
import {
  autoApproveListing,
  autoBlockListing,
  autoWaitlistListing,
  submitForRuleCheck,
} from "../listingTransitions";

const draftListing: MockListing = {
  id: "listing_bms_event_1",
  sellerId: "seller_demo_1",
  sourceRuleId: "source_rule_bookmyshow_event_v1",
  sourceRuleVersion: 1,
  category: "event_ticket",
  source: "bookmyshow",
  sourceCategoryKey: "bookmyshow_event",
  title: "Arijit Singh Live - Silver Pass",
  venueOrRoute: "Bengaluru Arena",
  eventOrTripStartAt: "2026-12-20T19:00:00+05:30",
  quantity: 1,
  faceValue: 2400,
  listingPrice: 2400,
  platformFee: 10,
  gstOnFee: 1.8,
  totalPayable: 2411.8,
  transferMode: "OFFICIAL_TRANSFER",
  transferDeadlineAt: "2026-12-20T18:00:00+05:30",
  protectionDeadlineAt: "2026-12-21T23:59:00+05:30",
  state: "draft",
  ruleDecision: "AUTO_APPROVE",
  duplicateFingerprint: "bookmyshow_event:arijit-singh-live-silver-pass:2026-12-20",
};

describe("listing state transitions", () => {
  test("submits draft listings and applies system-first rule outcomes", () => {
    const underReview = submitForRuleCheck(draftListing);
    expect(underReview.listing.state).toBe("under_review");

    expect(autoApproveListing(underReview.listing).listing.state).toBe("live");
    expect(autoWaitlistListing(underReview.listing).listing.state).toBe("waitlist_only");
    expect(autoBlockListing(underReview.listing).listing.state).toBe("blocked");
  });

  test("rejects invalid listing states", () => {
    expect(() => submitForRuleCheck({ ...draftListing, state: "live" })).toThrow("INVALID_LISTING_STATE");
    expect(() => autoApproveListing(draftListing)).toThrow("INVALID_LISTING_STATE");
  });
});
