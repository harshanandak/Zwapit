// Seller end-to-end mock-path smoke (Task 9).
// Drives the seller journey through the integration layer (src/lib/flow/mockFlow.ts)
// using local fixtures, rule evaluation, validation, and state helpers only.
// Run: bun scripts/e2e-seller.mjs
import { createMockFixture } from "../src/lib/mock/fixtures.ts";
import {
  connectMockListingFlow,
  connectSellerOrderFlow,
  connectTimelineActions,
} from "../src/lib/flow/mockFlow.ts";
import { sellerMarkTransferred } from "../src/lib/state/orderTransitions.ts";

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

// 1. Sell -> ... -> live: seller listing validation passes; payout account ready (mock).
const seller = connectSellerOrderFlow();
ok(seller.listingValidation.ok === true, `seller listing validation should pass (blockers: ${seller.listingValidation.blockers.join(",")})`);
ok(seller.sellerPaymentAccount.status === "mock_ready", "mock payout account should be ready");

// 2. Promise step: local rule evaluation auto-approves the listing.
ok(connectMockListingFlow().evaluation.decision === "AUTO_APPROVE", "rule should auto-approve");

// 3. Orders: seller advances the transfer through mock local state.
let { order, transferTask } = createMockFixture();
let step = connectTimelineActions(order, transferTask); // checkout_pending -> transfer_pending
order = step.order;
transferTask = step.transferTask;
ok(order.state === "transfer_pending", "order should be transfer_pending before seller acts");

step = connectTimelineActions(order, transferTask); // seller_mark_transferred -> transfer_submitted
order = step.order;
transferTask = step.transferTask;
ok(order.state === "transfer_submitted", "seller mark transferred -> transfer_submitted");
ok(transferTask.state === "transfer_submitted", "transfer task should be submitted");

// 4. Invalid actor: a buyer cannot perform the seller transfer.
const fresh = createMockFixture();
const freshPaid = connectTimelineActions(fresh.order, fresh.transferTask); // -> transfer_pending
throws(
  () =>
    sellerMarkTransferred(freshPaid.order, freshPaid.transferTask, {
      actorId: "user_demo_1",
      evidenceSummary: "x",
      submittedAt: new Date().toISOString(),
    }),
  "INVALID_ACTOR",
  "buyer acting as seller should be rejected",
);

// 5. Seller-side timeline reaches payout-waiting then completed through mock state.
let guard = 0;
while (order.state !== "completed" && guard < 6) {
  const next = connectTimelineActions(order, transferTask);
  order = next.order;
  transferTask = next.transferTask;
  guard += 1;
}
ok(order.state === "completed", `seller timeline should reach completed, got ${order.state}`);

if (failures.length > 0) {
  console.error("Seller e2e mock-path FAILED:\n" + failures.map((f) => `  - ${f}`).join("\n"));
  process.exit(1);
}
console.log("Seller e2e mock-path passed (validate -> auto-approve -> transfer -> payout waiting -> completed).");
