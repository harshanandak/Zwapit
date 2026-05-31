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
  if (listing.quantity < 1) blockers.push("INVALID_QUANTITY");
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
