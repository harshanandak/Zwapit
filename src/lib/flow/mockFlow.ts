// Task 9 integration layer.
// Wires the buyer/seller UI to the local fixtures, rule evaluation, validation,
// and state-transition helpers. Pure, mock-local only: no auth, no payment, no
// Convex, no server. The Codex-owned lib modules are used as-is (not modified);
// this module is the integration "touchpoint" that the UI calls.
import type { MockIssue, MockOrder, MockTransferTask } from "../types";
import { createMockFixture } from "../mock/fixtures";
import { evaluateSourceRule, type SourceRuleEvaluationResult } from "../rules/evaluateRule";
import {
  buyerConfirmReceived,
  buyerReportIssue,
  completeAfterWindow,
  mockPay,
  openProtectionWindow,
  sellerMarkTransferred,
} from "../state/orderTransitions";
import { validateCheckout, type CheckoutBlocker } from "../validation/checkoutValidation";
import { validateSellerListing, type SellerListingBlocker } from "../validation/sellerValidation";
import type { ValidationResult } from "../validation/types";

// Mock clocks. Today is 2026-05-29; the fixture deadlines are in Dec 2026.
// Checkout uses a "now" before the transfer deadline; completion uses a "now"
// after the protection window so the happy path can reach `completed`.
export const NOW_BEFORE_DEADLINE = "2026-05-29T12:00:00+05:30";
export const NOW_AFTER_PROTECTION_WINDOW = "2026-12-22T12:00:00+05:30";

const SELLER_EVIDENCE = "Transferred via the official platform (demo)";

export interface ListingFlowView {
  listing: ReturnType<typeof createMockFixture>["listing"];
  sourceRule: ReturnType<typeof createMockFixture>["sourceRule"];
  evaluation: SourceRuleEvaluationResult;
  checkout: ValidationResult<CheckoutBlocker>;
  purchasable: boolean;
}

// connectMockListingFlow: evaluate the listing's source rule and checkout
// readiness from the local fixtures (Home + Listing detail).
export function connectMockListingFlow(): ListingFlowView {
  const { listing, sourceRule, sellerPaymentAccount } = createMockFixture();

  const evaluation = evaluateSourceRule({
    source: listing.source,
    category: listing.category,
    listingPrice: listing.listingPrice,
    faceValue: listing.faceValue,
    requiredFieldValues: {
      title: listing.title,
      eventOrTripStartAt: listing.eventOrTripStartAt,
      venueOrRoute: listing.venueOrRoute,
      quantity: listing.quantity,
      transferDeadlineAt: listing.transferDeadlineAt,
      sellerPromiseAccepted: true,
    },
  });

  const checkout = validateCheckout({
    listing,
    sourceRule,
    sellerPaymentAccount,
    buyerEligibilityAcknowledged: true,
    totalShownToBuyer: listing.totalPayable,
    now: NOW_BEFORE_DEADLINE,
  });

  return {
    listing,
    sourceRule,
    evaluation,
    checkout,
    purchasable: checkout.ok && evaluation.decision === "AUTO_APPROVE",
  };
}

export interface CheckoutFlowResult {
  ok: boolean;
  blockers: CheckoutBlocker[];
  order: MockOrder;
}

export interface CheckoutFlowOptions {
  buyerEligibilityAcknowledged?: boolean;
  now?: string;
}

// connectMockCheckoutFlow: validate checkout then mock_pay the order
// (checkout_pending -> transfer_pending). Mock-local only.
export function connectMockCheckoutFlow(order: MockOrder, options: CheckoutFlowOptions = {}): CheckoutFlowResult {
  const { listing, sourceRule, sellerPaymentAccount } = createMockFixture();

  const validation = validateCheckout({
    listing,
    sourceRule,
    sellerPaymentAccount,
    buyerEligibilityAcknowledged: options.buyerEligibilityAcknowledged === true,
    totalShownToBuyer: listing.totalPayable,
    now: options.now ?? new Date().toISOString(),
  });

  if (!validation.ok) {
    return { ok: false, blockers: validation.blockers, order };
  }

  const result = mockPay(order);
  return { ok: true, blockers: [], order: result.order };
}

export interface SellerOrderFlowView {
  listing: ReturnType<typeof createMockFixture>["listing"];
  order: MockOrder;
  transferTask: MockTransferTask;
  sellerPaymentAccount: ReturnType<typeof createMockFixture>["sellerPaymentAccount"];
  listingValidation: ValidationResult<SellerListingBlocker>;
}

// connectSellerOrderFlow: validate the seller listing and surface the received
// order + transfer task + mock payout account for Sell > Orders.
export function connectSellerOrderFlow(): SellerOrderFlowView {
  const { listing, order, transferTask, sourceRule, sellerPaymentAccount } = createMockFixture();

  return {
    listing,
    order,
    transferTask,
    sellerPaymentAccount,
    listingValidation: validateSellerListing(listing, sourceRule),
  };
}

export interface TimelineActionResult {
  order: MockOrder;
  transferTask: MockTransferTask;
  action: string;
  terminal: boolean;
}

export interface TimelineActionOptions {
  submittedAt?: string;
}

// connectTimelineActions: apply the next valid transition for the current order
// state using the local state helpers (each rejects invalid actor/state).
export function connectTimelineActions(
  order: MockOrder,
  transferTask: MockTransferTask,
  options: TimelineActionOptions = {},
): TimelineActionResult {
  switch (order.state) {
    case "checkout_pending": {
      const result = mockPay(order);
      return { order: result.order, transferTask, action: "mock_pay", terminal: false };
    }
    case "transfer_pending": {
      const result = sellerMarkTransferred(order, transferTask, {
        actorId: order.sellerId,
        evidenceSummary: SELLER_EVIDENCE,
        submittedAt: options.submittedAt ?? NOW_BEFORE_DEADLINE,
      });
      return {
        order: result.order,
        transferTask: result.transferTask,
        action: "seller_mark_transferred",
        terminal: false,
      };
    }
    case "transfer_submitted": {
      const result = buyerConfirmReceived(order, transferTask, order.buyerId);
      return {
        order: result.order,
        transferTask: result.transferTask,
        action: "buyer_confirm_received",
        terminal: false,
      };
    }
    case "buyer_confirmed": {
      const result = openProtectionWindow(order);
      return { order: result.order, transferTask, action: "open_protection_window", terminal: false };
    }
    case "dispute_window_open": {
      const result = completeAfterWindow(order, NOW_AFTER_PROTECTION_WINDOW);
      return { order: result.order, transferTask, action: "complete_after_window", terminal: false };
    }
    default:
      return { order, transferTask, action: "none", terminal: true };
  }
}

// Friendly label for the next action available from a given order state.
export function nextActionLabel(state: MockOrder["state"]): string | null {
  switch (state) {
    case "checkout_pending":
      return "Pay with Protection (mock)";
    case "transfer_pending":
      return "Mark transferred (seller demo)";
    case "transfer_submitted":
      return "Confirm receipt";
    case "buyer_confirmed":
      return "Open protection window";
    case "dispute_window_open":
      return "Complete order";
    default:
      return null;
  }
}

// reportBuyerIssue: capture a reason code + evidence from an active order.
export function reportBuyerIssue(
  order: MockOrder,
  issue: MockIssue,
  reasonCode: MockIssue["reasonCode"],
  evidenceText: string,
) {
  const evidenceItems = evidenceText && evidenceText.trim() ? [evidenceText.trim()] : [];
  return buyerReportIssue(order, issue, { actorId: order.buyerId, reasonCode, evidenceItems });
}

// Live-stepper stage models for the interactive timeline panels.
export const buyerStages = [
  "Payment confirmed",
  "Transfer needed",
  "Confirm receipt",
  "Protection active",
  "Completed",
] as const;

export function buyerStageIndex(state: MockOrder["state"]): number {
  switch (state) {
    case "checkout_pending":
    case "payment_captured":
      return 0;
    case "transfer_pending":
    case "fulfilment_in_progress":
    case "transfer_timeout":
      return 1;
    case "transfer_submitted":
    case "issue_reported":
    case "buyer_rejected":
    case "refund_processing":
    case "refunded":
      return 2;
    case "buyer_confirmed":
    case "dispute_window_open":
    case "payout_eligible":
    case "payout_waiting":
      return 3;
    case "completed":
    case "payout_released":
    case "payout_sent":
      return 4;
    default:
      return 0;
  }
}

export const sellerStages = [
  "Transfer needed",
  "Waiting for buyer",
  "Payout waiting",
  "Completed",
] as const;

export function sellerStageIndex(state: MockOrder["state"]): number {
  switch (state) {
    case "payment_captured":
    case "transfer_pending":
    case "fulfilment_in_progress":
    case "transfer_timeout":
      return 0;
    case "transfer_submitted":
      return 1;
    case "buyer_confirmed":
    case "dispute_window_open":
    case "payout_eligible":
    case "payout_waiting":
      return 2;
    case "completed":
    case "payout_released":
    case "payout_sent":
      return 3;
    default:
      return 0;
  }
}

// ---- Browser-only demo persistence (mock-local; guarded for SSR) ----
const ORDER_KEY = "zwapit_demo_order";
const TRANSFER_KEY = "zwapit_demo_transfer";

export interface DemoState {
  order: MockOrder;
  transferTask: MockTransferTask;
}

export function loadDemoState(): DemoState {
  const { order, transferTask } = createMockFixture();
  if (typeof localStorage === "undefined") {
    return { order, transferTask };
  }
  try {
    const storedOrder = localStorage.getItem(ORDER_KEY);
    const storedTransfer = localStorage.getItem(TRANSFER_KEY);
    return {
      order: storedOrder ? (JSON.parse(storedOrder) as MockOrder) : order,
      transferTask: storedTransfer ? (JSON.parse(storedTransfer) as MockTransferTask) : transferTask,
    };
  } catch {
    return { order, transferTask };
  }
}

export function saveDemoState(state: DemoState): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(ORDER_KEY, JSON.stringify(state.order));
  localStorage.setItem(TRANSFER_KEY, JSON.stringify(state.transferTask));
}

export function resetDemoState(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(ORDER_KEY);
  localStorage.removeItem(TRANSFER_KEY);
}
