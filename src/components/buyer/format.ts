// Display helpers for the buyer UI (Task 4). Pure formatting only — no state.
import type { OrderState, ProtectionLevel, TransferMode } from "../../lib/types";

// Indian-rupee amount. Whole numbers show no decimals; fractional amounts show 2.
// e.g. 2400 -> "₹2,400", 10 -> "₹10", 1.8 -> "₹1.80", 2411.8 -> "₹2,411.80".
export function formatInr(amount: number): string {
  const hasFraction = Math.round(amount * 100) % 100 !== 0;
  return (
    "₹" +
    new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: hasFraction ? 2 : 0,
      maximumFractionDigits: 2,
    }).format(amount)
  );
}

// Deterministic IST date/time, e.g. "20 Dec 2026, 6:00 PM".
export function formatDateTime(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const ap = get("dayPeriod") ? get("dayPeriod").toUpperCase() : "";
  return `${get("day")} ${get("month")} ${get("year")}, ${get("hour")}:${get("minute")} ${ap}`.trim();
}

// Friendly transfer-mode label (AGENTS.md user-facing language).
export function transferModeLabel(mode: TransferMode): string {
  switch (mode) {
    case "OFFICIAL_TRANSFER":
      return "Official Transfer";
    case "OFFICIAL_REISSUE":
      return "Official Reissue";
    case "CUSTOMER_MANAGED_HANDOFF":
      return "Protected Handoff";
    case "CODE_REVEAL":
      return "Verify & Redeem";
    case "IDENTITY_BOUND":
      return "Identity-Verified Entry";
    default:
      return "Official Transfer";
  }
}

// Friendly protection-level label.
export function protectionLabel(level: ProtectionLevel): string {
  switch (level) {
    case "protected_payment":
      return "Protected payment";
    case "waitlist_only":
      return "Waitlist Only";
    case "cannot_list":
      return "Cannot List";
    default:
      return "Protected payment";
  }
}

// Buyer-facing status for any order state. Total map so a raw enum value
// (e.g. dispute_window_open, fulfilment_in_progress) is never shown to a buyer.
export function buyerStatusLabel(state: OrderState): string {
  switch (state) {
    case "checkout_pending":
      return "Payment pending";
    case "payment_captured":
      return "Payment confirmed";
    case "transfer_pending":
      return "Transfer needed";
    case "fulfilment_in_progress":
      return "Transfer in progress";
    case "transfer_submitted":
      return "Confirm receipt";
    case "buyer_confirmed":
      return "Receipt confirmed";
    case "dispute_window_open":
    case "payout_eligible":
    case "payout_waiting":
      return "Protection active";
    case "issue_reported":
      return "Issue reported";
    case "buyer_rejected":
      return "Refund requested";
    case "refund_processing":
      return "Refund in progress";
    case "refunded":
      return "Refunded";
    case "payout_released":
    case "payout_sent":
    case "completed":
      return "Completed";
    case "seller_payout_blocked":
      return "On hold";
    case "transfer_timeout":
      return "Transfer missed";
    default:
      return "In progress";
  }
}
