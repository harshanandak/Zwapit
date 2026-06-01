// Convex data-access adapter.
//
// Returns the SAME effective shapes the local mock flow already produces
// (createMockFixture(), connectMock* and the DemoState/TimelineActionResult used
// by the timeline island). When Convex is configured (PUBLIC_CONVEX_URL, or the
// legacy VITE_CONVEX_URL fallback), reads
// and the mock-visible flow transitions go through Convex (so demo state
// persists and survives reload); otherwise every function falls back to the
// existing local behavior with no UI change.
//
// This module is intentionally additive: it does not modify the existing
// connectMock* exports, it composes them.

import type {
  MockFixture,
  MockIssue,
  MockOrder,
} from "../types";
import {
  connectMockCheckoutFlow,
  connectMockListingFlow,
  connectSellerOrderFlow,
  connectTimelineActions,
  loadDemoState,
  reportBuyerIssue,
  saveDemoState,
  type CheckoutFlowOptions,
  type CheckoutFlowResult,
  type DemoState,
  type ListingFlowView,
  type SellerOrderFlowView,
  type TimelineActionOptions,
  type TimelineActionResult,
} from "../flow/mockFlow";
import { createMockFixture } from "../mock/fixtures";
import { getConvexClient } from "./client";
import { functionRefs } from "./functionRefs";

// ---- Reads ----

// Full demo fixture (same shape as createMockFixture()).
export async function loadFixtureView(): Promise<MockFixture> {
  const local = createMockFixture();
  const client = await getConvexClient();
  if (!client) return local;
  try {
    await client.mutation(functionRefs.seedDemoFixture, {});
    const view = await client.query(functionRefs.getCurrentFixtureView, {});
    if (!view) return local;
    return { ...(view as Omit<MockFixture, "auditEvents">), auditEvents: local.auditEvents };
  } catch {
    return local;
  }
}

// Current buyer order + transfer task (same shape as loadDemoState()).
export async function loadBuyerOrderState(): Promise<DemoState> {
  const local = loadDemoState();
  const client = await getConvexClient();
  if (!client) return local;
  try {
    await client.mutation(functionRefs.seedDemoFixture, {});
    const res = await client.query(functionRefs.getBuyerOrder, {});
    if (res?.order && res?.transferTask) {
      return { order: res.order, transferTask: res.transferTask };
    }
    return local;
  } catch {
    return local;
  }
}

// Seller Orders view (same shape as connectSellerOrderFlow()), with the order +
// transfer task overlaid from Convex when configured.
export async function loadSellerOrderView(): Promise<SellerOrderFlowView> {
  const base = connectSellerOrderFlow();
  const client = await getConvexClient();
  if (!client) return base;
  try {
    await client.mutation(functionRefs.seedDemoFixture, {});
    const res = await client.query(functionRefs.getBuyerOrder, {});
    if (res?.order && res?.transferTask) {
      return { ...base, order: res.order, transferTask: res.transferTask };
    }
    return base;
  } catch {
    return base;
  }
}

// Listing display + checkout readiness (same shape as connectMockListingFlow()).
// Listing data is read-only here and identical whether sourced from the fixture
// or from Convex (Convex is seeded from the same fixture), so this returns the
// local computation directly.
export async function loadListingFlowView(): Promise<ListingFlowView> {
  return connectMockListingFlow();
}

// ---- Mutations (mock-visible flow only) ----

// Advance the order's next valid transition (same shape as connectTimelineActions()).
export async function runAdvanceTimeline(
  state: DemoState,
  options: TimelineActionOptions = {},
): Promise<TimelineActionResult> {
  const client = await getConvexClient();
  if (!client) {
    const result = connectTimelineActions(state.order, state.transferTask, options);
    saveDemoState({ order: result.order, transferTask: result.transferTask });
    return result;
  }
  try {
    const advanced =
      options.actorRole === "seller" && state.order.state === "transfer_pending"
        ? await client.mutation(functionRefs.sellerSubmitTransfer, {
            submittedAt: options.submittedAt,
            actorRole: options.actorRole,
          })
        : await client.mutation(functionRefs.advanceTimeline, {
            submittedAt: options.submittedAt,
            actorRole: options.actorRole,
          });
    const res = await client.query(functionRefs.getBuyerOrder, {});
    const result = {
      order: (res?.order ?? state.order) as MockOrder,
      transferTask: res?.transferTask ?? state.transferTask,
      action: advanced?.action ?? "none",
      terminal: (advanced?.action ?? "none") === "none",
    };
    saveDemoState({ order: result.order, transferTask: result.transferTask });
    return result;
  } catch (error) {
    throw error instanceof Error ? error : new Error("Convex timeline advance failed");
  }
}

// Validate + mock-pay checkout (same shape as connectMockCheckoutFlow()).
export async function runMockCheckout(
  order: MockOrder,
  options: CheckoutFlowOptions = {},
): Promise<CheckoutFlowResult> {
  // Validation stays local (pure); it produces the same blockers as today.
  const local = connectMockCheckoutFlow(order, options);
  const client = await getConvexClient();
  if (!client || !local.ok) return local;
  try {
    await client.mutation(functionRefs.seedDemoFixture, {});
    await client.mutation(functionRefs.mockCheckout, {
      buyerEligibilityAcknowledged: options.buyerEligibilityAcknowledged === true,
      totalShownToBuyer: order.mockPaymentSummary.totalPayable,
    });
    const res = await client.query(functionRefs.getBuyerOrder, {});
    return { ok: true, blockers: [], order: (res?.order ?? local.order) as MockOrder };
  } catch {
    return { ok: false, blockers: ["PERSISTENCE_WRITE_FAILED"], order };
  }
}

// Capture a buyer issue (same shape as reportBuyerIssue()).
export async function runReportBuyerIssue(
  order: MockOrder,
  issue: MockIssue,
  reasonCode: MockIssue["reasonCode"],
  evidenceText: string,
): Promise<ReturnType<typeof reportBuyerIssue>> {
  // The local pure helper validates evidence/state and returns the canonical
  // shape; Convex persistence is performed alongside when configured.
  const local = reportBuyerIssue(order, issue, reasonCode, evidenceText);
  const client = await getConvexClient();
  if (!client) return local;
  await client.mutation(functionRefs.seedDemoFixture, {});
  await client.mutation(functionRefs.buyerReportIssue, { reasonCode, evidenceText });
  return local;
}
