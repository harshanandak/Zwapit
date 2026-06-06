import type { AuthActionState } from "../auth/authAdapter";
import type { MockListing, SourceRule } from "../types";
import { validationResult, type ValidationResult } from "./types";

export type SellerListingBlocker =
  | "MISSING_TITLE"
  | "MISSING_VENUE_OR_ROUTE"
  | "MISSING_EVENT_OR_TRIP_START"
  | "INVALID_QUANTITY"
  | "INVALID_FACE_VALUE"
  | "INVALID_LISTING_PRICE"
  | "MISSING_TRANSFER_DEADLINE"
  | "MISSING_PROTECTION_DEADLINE"
  | "MISSING_SOURCE_RULE"
  | "RULE_BLOCKED";

export function validateSellerListing(
  listing: MockListing,
  sourceRule: SourceRule,
): ValidationResult<SellerListingBlocker> {
  const blockers: SellerListingBlocker[] = [];

  if (!listing.title.trim()) blockers.push("MISSING_TITLE");
  if (!listing.venueOrRoute.trim()) blockers.push("MISSING_VENUE_OR_ROUTE");
  if (!listing.eventOrTripStartAt) blockers.push("MISSING_EVENT_OR_TRIP_START");
  if (!Number.isSafeInteger(listing.quantity) || listing.quantity < 1) blockers.push("INVALID_QUANTITY");
  if (listing.faceValue <= 0) blockers.push("INVALID_FACE_VALUE");
  if (listing.listingPrice <= 0) blockers.push("INVALID_LISTING_PRICE");
  if (!listing.transferDeadlineAt) blockers.push("MISSING_TRANSFER_DEADLINE");
  if (!listing.protectionDeadlineAt) blockers.push("MISSING_PROTECTION_DEADLINE");
  if (listing.sourceRuleId !== sourceRule.id || listing.sourceRuleVersion !== sourceRule.version) {
    blockers.push("MISSING_SOURCE_RULE");
  }
  if (listing.ruleDecision === "AUTO_BLOCK" || sourceRule.decision === "AUTO_BLOCK") {
    blockers.push("RULE_BLOCKED");
  }

  return validationResult(blockers);
}

// Access gate for the protected listing-submission action. Derived from the auth
// adapter's action-gate contract so a signed-out or phone-unverified seller is
// blocked before submission/progression — not only at the navigation CTA.
export type SellerSubmissionAccessBlocker = "AUTH_REQUIRED" | "PHONE_VERIFICATION_REQUIRED";

export function validateSellerSubmissionAccess(
  action: AuthActionState,
): ValidationResult<SellerSubmissionAccessBlocker> {
  if (action.status === "sign_in_required") return validationResult(["AUTH_REQUIRED"]);
  if (action.status === "phone_verification_required") return validationResult(["PHONE_VERIFICATION_REQUIRED"]);
  return validationResult([]);
}
