// Buyer end-to-end mock-path smoke (Task 9).
// Drives the buyer journey through the integration layer (src/lib/flow/mockFlow.ts)
// using the local fixtures, rule evaluation, validation, and state helpers only.
// No browser, no server: this verifies the integration logic the UI is wired to.
// Run: bun scripts/e2e-buyer.mjs
import { createMockFixture } from "../src/lib/mock/fixtures.ts";
import {
  connectMockListingFlow,
  connectMockCheckoutFlow,
  connectTimelineActions,
  reportBuyerIssue,
} from "../src/lib/flow/mockFlow.ts";
import { buyerConfirmReceived } from "../src/lib/state/orderTransitions.ts";
import { validateCheckout } from "../src/lib/validation/checkoutValidation.ts";

const failures = [];
const ok = (cond, msg) => {
  if (!cond) failures.push(msg);
};
const throws = (fn, code, msg) => {
  try {
    fn();
    failures.push(`${msg} (expected throw, none happened)`);
  } catch (error) {
    if (code && !String(error.message).includes(code)) {
      failures.push(`${msg} (wrong error: ${error.message})`);
    }
  }
};

// 1. Home -> Listing: local rule evaluation marks the BookMyShow event purchasable.
const view = connectMockListingFlow();
ok(view.evaluation.decision === "AUTO_APPROVE", "listing rule should AUTO_APPROVE");
ok(view.checkout.ok === true, "checkout validation should pass for the live fixture");
ok(view.purchasable === true, "listing should be purchasable");

// 2. Checkout: order starts checkout_pending, mock_pay -> transfer_pending.
const { order, transferTask, issue } = createMockFixture();
ok(order.state === "checkout_pending", "fixture order starts checkout_pending");
const paid = connectMockCheckoutFlow(order);
ok(paid.ok === true, `checkout should succeed (blockers: ${paid.blockers.join(",")})`);
ok(paid.order.state === "transfer_pending", "after mock pay order is transfer_pending");
ok(paid.order.mockPaymentStatus === "mock_paid", "after mock pay status is mock_paid");

// 3. Timeline advances through mock local state to completed.
let stateNow = { order: paid.order, transferTask };
const seq = [stateNow.order.state];
for (let i = 0; i < 6 && stateNow.order.state !== "completed"; i++) {
  const next = connectTimelineActions(stateNow.order, stateNow.transferTask);
  stateNow = { order: next.order, transferTask: next.transferTask };
  seq.push(stateNow.order.state);
}
const expected = [
  "transfer_pending",
  "transfer_submitted",
  "buyer_confirmed",
  "dispute_window_open",
  "completed",
];
ok(
  JSON.stringify(seq) === JSON.stringify(expected),
  `timeline happy path should match, got: ${seq.join(" -> ")}`,
);

// 4. Invalid transition rejected: buyer can't confirm before the seller submits.
throws(
  () => buyerConfirmReceived(paid.order, transferTask, paid.order.buyerId),
  "INVALID_ORDER_STATE",
  "buyer confirm on transfer_pending should be rejected",
);

// 5. Report issue from an active order captures a reason code + evidence.
const reported = reportBuyerIssue(paid.order, issue, "ticket_not_transferred", "Seller has not transferred yet");
ok(reported.order.state === "issue_reported", "report issue moves order to issue_reported");
ok(reported.issue.state === "reported", "issue moves to reported");
ok(reported.issue.reasonCode === "ticket_not_transferred", "issue keeps the reason code");
throws(
  () => reportBuyerIssue(paid.order, issue, "ticket_not_transferred", ""),
  "MISSING_EVIDENCE",
  "report issue with no evidence should be rejected",
);

// 6. Checkout blocked when the listing is not live.
const blocked = validateCheckout({
  listing: { ...view.listing, state: "paused" },
  sourceRule: view.sourceRule,
  sellerPaymentAccount: { sellerId: "seller_demo_1", status: "mock_ready", provider: "mock" },
  totalShownToBuyer: view.listing.totalPayable,
  now: order.createdAt,
});
ok(blocked.blockers.includes("LISTING_NOT_LIVE"), "paused listing should block checkout");

if (failures.length > 0) {
  console.error("Buyer e2e mock-path FAILED:\n" + failures.map((f) => `  - ${f}`).join("\n"));
  process.exit(1);
}
console.log("Buyer e2e mock-path passed (Home -> Listing -> Checkout -> timeline -> completed).");
