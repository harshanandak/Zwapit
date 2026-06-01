import { describe, expect, test } from "bun:test";

import { createMockFixture } from "../../mock/fixtures";
import {
  connectMockListingFlow,
  connectSellerOrderFlow,
  loadDemoState,
} from "../../flow/mockFlow";
import { isConvexConfigured } from "../env";
import {
  loadBuyerOrderState,
  loadFixtureView,
  loadListingFlowView,
  loadSellerOrderView,
  runAdvanceTimeline,
  runMockCheckout,
} from "../dataAdapter";

const NOW_BEFORE_DEADLINE = "2026-05-29T12:00:00+05:30";

// These tests run with Convex NOT configured (no VITE_CONVEX_URL), so the
// adapter exercises its fallback path. They prove the adapter returns the SAME
// effective shapes the local mock flow produces — the contract that lets routes
// switch from direct fixture reads to adapter reads with no UI/state regression.
describe("convex data adapter — fallback shape parity", () => {
  test("Convex is not configured in the test environment", () => {
    expect(isConvexConfigured()).toBe(false);
  });

  test("loadFixtureView() equals createMockFixture()", async () => {
    expect(await loadFixtureView()).toEqual(createMockFixture());
  });

  test("loadBuyerOrderState() equals the local demo order + transfer task", async () => {
    expect(await loadBuyerOrderState()).toEqual(loadDemoState());
  });

  test("loadListingFlowView() equals connectMockListingFlow()", async () => {
    expect(await loadListingFlowView()).toEqual(connectMockListingFlow());
  });

  test("loadSellerOrderView() equals connectSellerOrderFlow()", async () => {
    expect(await loadSellerOrderView()).toEqual(connectSellerOrderFlow());
  });
});

describe("convex data adapter — mutation wrappers preserve flow semantics", () => {
  test("runMockCheckout() pays the order into transfer_pending", async () => {
    const { order } = createMockFixture();
    const result = await runMockCheckout(order, { buyerEligibilityAcknowledged: true });
    expect(result.ok).toBe(true);
    expect(result.blockers).toEqual([]);
    expect(result.order.state).toBe("transfer_pending");
    expect(result.order.mockPaymentStatus).toBe("mock_paid");
  });

  test("runMockCheckout() surfaces blockers without paying when eligibility is missing", async () => {
    const { order } = createMockFixture();
    const result = await runMockCheckout(order, { buyerEligibilityAcknowledged: false });
    expect(result.ok).toBe(false);
    expect(result.order.state).toBe("checkout_pending");
  });

  test("runAdvanceTimeline() walks the happy path to completed", async () => {
    const fixture = createMockFixture();
    const paid = await runMockCheckout(fixture.order, { buyerEligibilityAcknowledged: true });
    let state = { order: paid.order, transferTask: fixture.transferTask };
    const sequence: string[] = [state.order.state];
    for (let i = 0; i < 6 && state.order.state !== "completed"; i += 1) {
      const next = await runAdvanceTimeline(state, { submittedAt: NOW_BEFORE_DEADLINE });
      state = { order: next.order, transferTask: next.transferTask };
      sequence.push(state.order.state);
    }
    expect(sequence).toEqual([
      "transfer_pending",
      "transfer_submitted",
      "buyer_confirmed",
      "dispute_window_open",
      "completed",
    ]);
  });
});
