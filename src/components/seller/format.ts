// Display helpers for the seller UI (Task 5). Reuses the shared buyer
// formatters and adds seller-facing status/result labels. Pure formatting only.
export { formatInr, formatDateTime, transferModeLabel } from "../buyer/format";

import type { OrderState, RuleDecision } from "../../lib/types";

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
