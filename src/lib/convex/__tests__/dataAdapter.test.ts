import { afterEach, beforeEach, describe, expect, test } from "bun:test";

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
  submitSellerListingDraft,
} from "../dataAdapter";
import { functionRefs } from "../functionRefs";

const NOW_BEFORE_DEADLINE = "2026-05-29T12:00:00+05:30";
const ORIGINAL_PUBLIC_CONVEX_URL = process.env.PUBLIC_CONVEX_URL;
const ORIGINAL_VITE_CONVEX_URL = process.env.VITE_CONVEX_URL;

function restoreEnv(name: "PUBLIC_CONVEX_URL" | "VITE_CONVEX_URL", value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}

beforeEach(() => {
  delete process.env.PUBLIC_CONVEX_URL;
  delete process.env.VITE_CONVEX_URL;
});

afterEach(() => {
  restoreEnv("PUBLIC_CONVEX_URL", ORIGINAL_PUBLIC_CONVEX_URL);
  restoreEnv("VITE_CONVEX_URL", ORIGINAL_VITE_CONVEX_URL);
});

// These tests run with Convex NOT configured (no PUBLIC_CONVEX_URL or
// VITE_CONVEX_URL fallback), so the
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

describe("convex data adapter - seller listing submission handoff", () => {
  test("exposes a generated-API-free function reference for seller listing submission", () => {
    expect(functionRefs.submitSellerListingForCurrentUser).toBeDefined();
  });

  test("submitSellerListingDraft() preserves a local fallback result when Convex is not configured", async () => {
    const result = await submitSellerListingDraft({
      source: "bookmyshow",
      category: "event_ticket",
      title: "Arijit Singh Live - Silver Pass",
      venueOrRoute: "Bengaluru Palace Grounds",
      eventOrTripStartAt: "2026-12-20T19:00:00+05:30",
      quantity: 1,
      faceValue: 2400,
      listingPrice: 2400,
      transferDeadlineAt: "2026-12-19T19:00:00+05:30",
      protectionDeadlineAt: "2026-12-21T19:00:00+05:30",
      sellerPromiseAccepted: true,
      duplicateFingerprint: "seller-upload:arijit-singh-silver-pass",
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe("mock");
    expect(result.listing.sellerId).toBe(createMockFixture().user.id);
    expect(result.listing.ruleDecision).toBe("AUTO_APPROVE");
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
