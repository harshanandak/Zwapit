import { describe, expect, test } from "bun:test";

import {
  applyPriceRule,
  classifySourceCategory,
  evaluateSourceRule,
  getBlockedBehavior,
  getSourceRule,
} from "../evaluateRule";

describe("local source rule engine", () => {
  test("auto-approves the first BookMyShow event rule", () => {
    const result = evaluateSourceRule({
      source: "bookmyshow",
      category: "event_ticket",
      listingPrice: 2400,
      faceValue: 2400,
      requiredFieldValues: {
        title: "Arijit Singh Live - Silver Pass",
        eventOrTripStartAt: "2026-12-20T19:00:00+05:30",
        venueOrRoute: "Bengaluru Arena",
        quantity: 1,
        transferDeadlineAt: "2026-12-20T18:00:00+05:30",
        sellerPromiseAccepted: true,
      },
    });

    expect(result.decision).toBe("AUTO_APPROVE");
    expect(result.internalStatus).toBe("ALLOW");
    expect(result.transferMode).toBe("OFFICIAL_TRANSFER");
    expect(result.sourceRuleId).toBe("source_rule_bookmyshow_event_v1");
    expect(result.sourceRuleVersion).toBe(1);
    expect(result.manualReviewReasonCodes).toEqual([]);
  });

  test("blocks blocked categories without manual review", () => {
    const result = evaluateSourceRule({
      source: "manual_upload",
      category: "watcher",
      listingPrice: 12000,
      faceValue: 12000,
      requiredFieldValues: {
        title: "Premium watcher pass",
      },
    });

    expect(result.decision).toBe("AUTO_BLOCK");
    expect(result.internalStatus).toBe("BLOCKED");
    expect(getBlockedBehavior(result.rule)).toBe("cannot_list");
  });

  test("returns waitlist-only demand rules", () => {
    const result = evaluateSourceRule({
      source: "district",
      category: "movie_ticket",
      listingPrice: 500,
      faceValue: 500,
      requiredFieldValues: {
        title: "District movie ticket",
      },
    });

    expect(result.decision).toBe("AUTO_WAITLIST");
    expect(result.internalStatus).toBe("DEMAND_ONLY");
    expect(result.rule.blockedBehavior).toBe("waitlist_only");
  });

  test("uses manual review only as an exception", () => {
    const result = evaluateSourceRule({
      source: "other_platform",
      category: "event_ticket",
      listingPrice: 3600,
      faceValue: 2400,
      requiredFieldValues: {
        title: "Other platform event ticket",
      },
    });

    expect(result.decision).toBe("NEEDS_MANUAL_REVIEW");
    expect(result.internalStatus).toBe("AMBER");
    expect(result.manualReviewReasonCodes).toContain("UNVERIFIED_SOURCE");
  });

  test("classifies source categories and applies price rules", () => {
    expect(classifySourceCategory("bookmyshow", "event_ticket")).toBe("bookmyshow_event");
    expect(applyPriceRule(getSourceRule("bookmyshow_event"), 2400, 2400).passed).toBe(true);
    expect(applyPriceRule(getSourceRule("bookmyshow_event"), 2500, 2400).passed).toBe(false);
  });

  test("requires eligibility fields before auto-approving", () => {
    const result = evaluateSourceRule({
      source: "bookmyshow",
      category: "event_ticket",
      listingPrice: 2400,
      faceValue: 2400,
      requiredFieldValues: {
        title: "Arijit Singh Live - Silver Pass",
        eventOrTripStartAt: "2026-12-20T19:00:00+05:30",
        venueOrRoute: "Bengaluru Arena",
        quantity: 1,
      },
    });

    expect(result.decision).toBe("NEEDS_MANUAL_REVIEW");
    expect(result.internalStatus).toBe("AMBER");
    expect(result.manualReviewReasonCodes).toContain("MISSING_REQUIRED_FIELDS");
  });

  test("rules include required metadata and policy fields", () => {
    const rule = getSourceRule("bookmyshow_event");

    expect(rule.id).toBeTruthy();
    expect(rule.version).toBeGreaterThan(0);
    expect(rule.transferability).toBe("transferable");
    expect(rule.protectionLevel).toBe("protected_payment");
    expect(rule.eligibilityFields).toContain("sellerPromiseAccepted");
    expect(rule.priceRule.kind).toBe("face_value_cap");
    expect(rule.payoutPolicy.mockOnly).toBe(true);
    expect(rule.effectiveFrom).toBeTruthy();
    expect(rule.lastVerifiedAt).toBeTruthy();
    expect(rule.verificationSourceUrlOrNote).toBeTruthy();
  });
});
