// Display helpers for the seller UI (Task 5). Reuses the shared buyer
// formatters and adds seller-facing status/result labels. Pure helpers only —
// no DOM/sessionStorage access lives here (page scripts own that), so this stays
// safe to import from both Astro frontmatter (SSR) and client scripts.
export { formatInr, formatDateTime, transferModeLabel } from "../buyer/format";

import type {
  MockListing,
  OrderState,
  RuleDecision,
  SellerListingDraft,
  SellerListingSubmissionResult,
} from "../../lib/types";

// sessionStorage keys shared across the seller step pages so the detected draft,
// chosen price, and just-published result carry through upload -> ... -> orders.
// The actual read/write stays inline in each page script.
export const SELLER_DRAFT_STORAGE_KEY = "zwapit:seller-draft";
export const SELLER_PUBLISHED_STORAGE_KEY = "zwapit:seller-published";

// Seller-facing status for any order state. Total map so a raw enum value is
// never shown (e.g. dispute_window_open / payout_waiting -> "Payout waiting").
export function sellerStatusLabel(state: OrderState): string {
  switch (state) {
    case "checkout_pending":
      return "Awaiting payment";
    case "payment_captured":
    case "transfer_pending":
    case "fulfilment_in_progress":
      return "Transfer needed";
    case "transfer_submitted":
      return "Waiting for buyer";
    case "buyer_confirmed":
    case "dispute_window_open":
    case "payout_eligible":
    case "payout_waiting":
      return "Payout waiting";
    case "completed":
    case "payout_released":
    case "payout_sent":
      return "Completed";
    case "issue_reported":
      return "Issue reported";
    case "buyer_rejected":
    case "refund_processing":
    case "refunded":
      return "Refunded";
    case "seller_payout_blocked":
      return "On hold";
    case "transfer_timeout":
      return "Transfer missed";
    default:
      return "In progress";
  }
}

// Friendly result of the system-first rule decision shown after the promise step.
export function ruleDecisionResult(decision: RuleDecision): {
  title: string;
  detail: string;
} {
  switch (decision) {
    case "AUTO_APPROVE":
      return {
        title: "Approved — your listing is now live",
        detail: "Buyers can find and buy it with protected payment.",
      };
    case "AUTO_WAITLIST":
      return {
        title: "Added as Waitlist Only",
        detail: "Buyers can join the waitlist while we confirm demand.",
      };
    case "AUTO_BLOCK":
      return {
        title: "Cannot List",
        detail: "This item can't be listed right now.",
      };
    case "NEEDS_MANUAL_REVIEW":
      return {
        title: "Under review",
        detail: "We're taking a quick look before it goes live.",
      };
    default:
      return {
        title: "Under review",
        detail: "We're taking a quick look before it goes live.",
      };
  }
}

// Deterministic fingerprint for the mock upload so re-submitting the same detected
// item updates the seller's existing listing instead of creating duplicates.
// Excludes price/quantity so editing the price still maps to the same listing.
function sellerDuplicateFingerprint(listing: MockListing): string {
  return [listing.source, listing.category, listing.title, listing.eventOrTripStartAt, listing.venueOrRoute].join("|");
}

// Build the first-slice submission payload from the detected (mock) listing.
// Pure: the chosen price and accepted promise are passed in by the step pages.
export function buildSellerDraftFromListing(
  listing: MockListing,
  overrides: { listingPrice?: number; sellerPromiseAccepted?: boolean } = {},
): SellerListingDraft {
  return {
    source: listing.source,
    category: listing.category,
    title: listing.title,
    venueOrRoute: listing.venueOrRoute,
    eventOrTripStartAt: listing.eventOrTripStartAt,
    quantity: listing.quantity,
    faceValue: listing.faceValue,
    listingPrice: overrides.listingPrice ?? listing.listingPrice,
    transferDeadlineAt: listing.transferDeadlineAt,
    protectionDeadlineAt: listing.protectionDeadlineAt,
    sellerPromiseAccepted: overrides.sellerPromiseAccepted ?? false,
    duplicateFingerprint: sellerDuplicateFingerprint(listing),
  };
}

// Friendly UI state for a seller submission result. Keyed on BOTH the adapter
// status and the persisted rule decision: a successfully persisted AUTO_BLOCK
// listing comes back ok:true/status:"created" with a blocked state, so the
// "Cannot List" outcome must be read from listing.ruleDecision, not just status.
export interface SellerSubmissionView {
  kind:
    | "submitted"
    | "waitlist_only"
    | "under_review"
    | "cannot_list"
    | "signed_out"
    | "phone_required"
    | "retry";
  tone: "success" | "info" | "warning" | "error";
  title: string;
  detail: string;
  ctaLabel: string;
  // Whether the seller should be moved on to Orders after this outcome.
  proceedToOrders: boolean;
}

export function sellerSubmissionView(result: SellerListingSubmissionResult): SellerSubmissionView {
  const blockers = result.blockers ?? [];

  // Auth/phone gates take priority — route the seller to the account/verify step.
  if (blockers.includes("AUTH_REQUIRED")) {
    return {
      kind: "signed_out",
      tone: "warning",
      title: "Sign in to publish",
      detail: "Sign in to publish your listing — your details are saved.",
      ctaLabel: "Sign in to continue",
      proceedToOrders: false,
    };
  }
  if (blockers.includes("PHONE_VERIFICATION_REQUIRED")) {
    return {
      kind: "phone_required",
      tone: "warning",
      title: "Verify your phone",
      detail: "Verify your phone number to publish your listing.",
      ctaLabel: "Verify phone to continue",
      proceedToOrders: false,
    };
  }

  // No Convex/default fallback means the listing was not actually persisted.
  if (result.status === "mock") {
    return {
      kind: "retry",
      tone: "error",
      title: "Couldn't publish yet",
      detail: "We couldn't save your listing just now. Please try again.",
      ctaLabel: "Try again",
      proceedToOrders: false,
    };
  }

  // Persisted created/updated success: outcome follows the rule.
  if (result.ok) {
    switch (result.listing.ruleDecision) {
      case "AUTO_APPROVE":
        return {
          kind: "submitted",
          tone: "success",
          title: "Your listing is live",
          detail: "Buyers can find and buy it with protected payment.",
          ctaLabel: "Go to Orders",
          proceedToOrders: true,
        };
      case "AUTO_WAITLIST":
        return {
          kind: "waitlist_only",
          tone: "info",
          title: "Added as Waitlist Only",
          detail: "Buyers can join the waitlist while we confirm demand.",
          ctaLabel: "Go to Orders",
          proceedToOrders: true,
        };
      case "NEEDS_MANUAL_REVIEW":
        return {
          kind: "under_review",
          tone: "info",
          title: "Under review",
          detail: "We're taking a quick look before it goes live.",
          ctaLabel: "Go to Orders",
          proceedToOrders: true,
        };
      case "AUTO_BLOCK":
      default:
        return {
          kind: "cannot_list",
          tone: "warning",
          title: "Cannot List",
          detail: "This item can't be listed right now.",
          ctaLabel: "Back to upload",
          proceedToOrders: false,
        };
    }
  }

  // Persistence failed but Convex was reachable — safe to retry.
  if (blockers.includes("PERSISTENCE_WRITE_FAILED")) {
    return {
      kind: "retry",
      tone: "error",
      title: "Couldn't publish yet",
      detail: "We couldn't save your listing just now. Please try again.",
      ctaLabel: "Try again",
      proceedToOrders: false,
    };
  }

  // Remaining blockers are seller-listing validation reason codes.
  return {
    kind: "cannot_list",
    tone: "warning",
    title: "Cannot List",
    detail: "Please check your ticket details and try again.",
    ctaLabel: "Back to upload",
    proceedToOrders: false,
  };
}
