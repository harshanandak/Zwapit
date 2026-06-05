import { describe, expect, test } from "bun:test";

import type { MockListing, RuleDecision, SellerListingSubmissionResult } from "../../../lib/types";
import { createMockFixture } from "../../../lib/mock/fixtures";
import { sellerSubmissionView } from "../format";

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
  test("maps persisted seller listing rule outcomes to friendly UI states", () => {
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

  test("prioritizes auth and phone blockers before listing outcomes", () => {
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

  test("maps retryable persistence failures and no-Convex mock fallback to retry", () => {
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
      kind: "retry",
      proceedToOrders: false,
    });
  });
});
