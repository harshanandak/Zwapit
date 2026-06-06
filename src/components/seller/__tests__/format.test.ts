import { describe, expect, test } from "bun:test";

import type { MockListing, RuleDecision, SellerListingSubmissionResult } from "../../../lib/types";
import { createMockFixture } from "../../../lib/mock/fixtures";
import { buildSellerDraftFromListing, sellerDraftJsonScriptContent, sellerSubmissionView } from "../format";

function listingWithRuleDecision(ruleDecision: RuleDecision): MockListing {
  const base = createMockFixture().listing;

  return {
    ...base,
    ruleDecision,
    state:
      ruleDecision === "AUTO_APPROVE"
        ? "live"
        : ruleDecision === "AUTO_WAITLIST"
          ? "waitlist_only"
          : ruleDecision === "AUTO_BLOCK"
            ? "blocked"
            : "under_review",
  };
}

function submissionResult(
  overrides: Partial<SellerListingSubmissionResult> & { ruleDecision?: RuleDecision },
): SellerListingSubmissionResult {
  const ruleDecision = overrides.ruleDecision ?? "AUTO_APPROVE";

  return {
    ok: overrides.ok ?? true,
    blockers: overrides.blockers ?? [],
    listing: overrides.listing ?? listingWithRuleDecision(ruleDecision),
    status: overrides.status ?? "created",
  };
}

describe("sellerSubmissionView", () => {
  test("it should map persisted seller listing rule outcomes to friendly UI states when rule decisions vary", () => {
    expect(sellerSubmissionView(submissionResult({ ruleDecision: "AUTO_APPROVE" }))).toMatchObject({
      kind: "submitted",
      tone: "success",
      proceedToOrders: true,
    });

    expect(sellerSubmissionView(submissionResult({ ruleDecision: "AUTO_WAITLIST" }))).toMatchObject({
      kind: "waitlist_only",
      tone: "info",
      proceedToOrders: true,
    });

    expect(sellerSubmissionView(submissionResult({ ruleDecision: "NEEDS_MANUAL_REVIEW" }))).toMatchObject({
      kind: "under_review",
      tone: "info",
      proceedToOrders: true,
    });

    expect(sellerSubmissionView(submissionResult({ ruleDecision: "AUTO_BLOCK" }))).toMatchObject({
      kind: "cannot_list",
      tone: "warning",
      proceedToOrders: false,
    });
  });

  test("it should prioritize auth and phone blockers before listing outcomes when gate blockers are present", () => {
    expect(
      sellerSubmissionView(
        submissionResult({
          ok: false,
          blockers: ["AUTH_REQUIRED"],
          ruleDecision: "AUTO_APPROVE",
          status: "blocked",
        }),
      ),
    ).toMatchObject({
      kind: "signed_out",
      proceedToOrders: false,
    });

    expect(
      sellerSubmissionView(
        submissionResult({
          ok: false,
          blockers: ["PHONE_VERIFICATION_REQUIRED"],
          ruleDecision: "AUTO_APPROVE",
          status: "blocked",
        }),
      ),
    ).toMatchObject({
      kind: "phone_required",
      proceedToOrders: false,
    });
  });

  test("it should map retryable persistence failures to retry when persistence writes fail", () => {
    expect(
      sellerSubmissionView(
        submissionResult({
          ok: false,
          blockers: ["PERSISTENCE_WRITE_FAILED"],
          ruleDecision: "AUTO_APPROVE",
          status: "blocked",
        }),
      ),
    ).toMatchObject({
      kind: "retry",
      tone: "error",
      proceedToOrders: false,
    });

  });

  test("it should keep the local demo flow moving when submission uses the mock fallback", () => {
    expect(
      sellerSubmissionView(
        submissionResult({
          ok: true,
          blockers: [],
          ruleDecision: "AUTO_APPROVE",
          status: "mock",
        }),
      ),
    ).toMatchObject({
      kind: "submitted",
      proceedToOrders: true,
    });
  });
});

describe("seller draft formatting", () => {
  test("it should build collision-safe duplicate fingerprints when listing fields contain separators", () => {
    const base = createMockFixture().listing;
    const first = buildSellerDraftFromListing({
      ...base,
      source: "bookmyshow",
      category: "event_ticket",
      title: "A|B",
      eventOrTripStartAt: "C",
      venueOrRoute: "D",
    });
    const second = buildSellerDraftFromListing({
      ...base,
      source: "bookmyshow",
      category: "event_ticket",
      title: "A",
      eventOrTripStartAt: "B|C",
      venueOrRoute: "D",
    });

    expect(first.duplicateFingerprint).not.toBe(second.duplicateFingerprint);
    expect(JSON.parse(first.duplicateFingerprint)).toEqual(["bookmyshow", "event_ticket", "A|B", "C", "D"]);
  });

  test("it should escape script-breaking characters when serializing seller drafts for inline JSON", () => {
    const draft = buildSellerDraftFromListing({
      ...createMockFixture().listing,
      title: "</script><img src=x onerror=alert(1)>",
      venueOrRoute: "A & B",
    });
    const scriptContent = sellerDraftJsonScriptContent(draft);

    expect(scriptContent).not.toContain("</script>");
    expect(scriptContent).toContain("\\u003c/script\\u003e");
    expect(scriptContent).toContain("\\u0026");
    expect(JSON.parse(scriptContent)).toEqual(draft);
  });
});
