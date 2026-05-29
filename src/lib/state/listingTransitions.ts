import type { AuditEvent, MockListing } from "../types";
import { createAuditEvent } from "./auditEvents";

export interface ListingTransitionResult {
  listing: MockListing;
  auditEvent: AuditEvent;
}

function requireListingState(listing: MockListing, expectedState: MockListing["state"]): void {
  if (listing.state !== expectedState) {
    throw new Error("INVALID_LISTING_STATE");
  }
}

function transitionListing(listing: MockListing, toState: MockListing["state"], action: string): ListingTransitionResult {
  const nextListing: MockListing = {
    ...listing,
    state: toState,
  };

  return {
    listing: nextListing,
    auditEvent: createAuditEvent({
      actorId: "system",
      actorRole: "system",
      action,
      entityType: "listing",
      entityId: listing.id,
      fromState: listing.state,
      toState,
    }),
  };
}

export function submitForRuleCheck(listing: MockListing): ListingTransitionResult {
  requireListingState(listing, "draft");
  return transitionListing(listing, "under_review", "submit_for_rule_check");
}

export function autoApproveListing(listing: MockListing): ListingTransitionResult {
  requireListingState(listing, "under_review");
  return transitionListing({ ...listing, ruleDecision: "AUTO_APPROVE" }, "live", "auto_approve_listing");
}

export function autoWaitlistListing(listing: MockListing): ListingTransitionResult {
  requireListingState(listing, "under_review");
  return transitionListing({ ...listing, ruleDecision: "AUTO_WAITLIST" }, "waitlist_only", "auto_waitlist_listing");
}

export function autoBlockListing(listing: MockListing): ListingTransitionResult {
  requireListingState(listing, "under_review");
  return transitionListing({ ...listing, ruleDecision: "AUTO_BLOCK" }, "blocked", "auto_block_listing");
}
