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
import { isClerkAuthConfigured } from "../auth/authAdapter";
import { createMockFixture } from "../mock/fixtures";
import { evaluateSourceRule } from "../rules/evaluateRule";
import { validateCheckout } from "../validation/checkoutValidation";
import { getConvexClient } from "./client";
import { functionRefs } from "./functionRefs";

async function syncCurrentUserForGuardedPath(client: Awaited<ReturnType<typeof getConvexClient>>): Promise<void> {
  if (!client || !isClerkAuthConfigured()) return;
  await client.mutation(functionRefs.syncAppUserFromProvider, {});
}

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
  const state = loadDemoState();
  const base = { ...connectSellerOrderFlow(), order: state.order, transferTask: state.transferTask };
  const client = await getConvexClient();
  if (!client) return base;
  try {
    await client.mutation(functionRefs.seedDemoFixture, {});
    const rows = await client.query(functionRefs.getSellerOrders, {});
    const first = Array.isArray(rows) ? rows[0] : null;
    if (first?.order && first?.transferTask) {
      return {
        ...base,
        listing: first.listing ?? base.listing,
        order: first.order,
        transferTask: first.transferTask,
      };
    }
    return connectSellerOrderFlow();
  } catch {
    return base;
  }
}

// Listing display + checkout readiness (same shape as connectMockListingFlow()).
export async function loadListingFlowView(): Promise<ListingFlowView> {
  const local = connectMockListingFlow();
  const client = await getConvexClient();
  if (!client) return local;
  try {
    await client.mutation(functionRefs.seedDemoFixture, {});
    const res = await client.query(functionRefs.getCheckoutView, {});
    if (!res?.listing || !res?.sourceRule || !res?.sellerPaymentAccount) return local;
    const listing = res.listing;
    const sourceRule = res.sourceRule;
    const sellerPaymentAccount = res.sellerPaymentAccount;
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
      now: new Date().toISOString(),
    });

    return {
      listing,
      sourceRule,
      evaluation,
      checkout,
      purchasable: checkout.ok && evaluation.decision === "AUTO_APPROVE",
    };
  } catch {
    return local;
  }
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
    const useGuardedMutations = isClerkAuthConfigured();
    await syncCurrentUserForGuardedPath(client);
    const advanced = useGuardedMutations
      ? state.order.state === "transfer_pending"
        ? await client.mutation(functionRefs.sellerSubmitTransferForCurrentUser, {
            submittedAt: options.submittedAt,
          })
        : await client.mutation(functionRefs.advanceTimelineForCurrentUser, {})
      : options.actorRole === "seller" && state.order.state === "transfer_pending"
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
    const checkoutArgs = {
      buyerEligibilityAcknowledged: options.buyerEligibilityAcknowledged === true,
      totalShownToBuyer: order.mockPaymentSummary.totalPayable,
    };
    if (isClerkAuthConfigured()) {
      await syncCurrentUserForGuardedPath(client);
      await client.mutation(functionRefs.mockCheckoutForCurrentUser, checkoutArgs);
    } else {
      await client.mutation(functionRefs.mockCheckout, checkoutArgs);
    }
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
  try {
    await client.mutation(functionRefs.seedDemoFixture, {});
    if (isClerkAuthConfigured()) {
      await syncCurrentUserForGuardedPath(client);
      await client.mutation(functionRefs.buyerReportIssueForCurrentUser, { reasonCode, evidenceText });
    } else {
      await client.mutation(functionRefs.buyerReportIssue, { reasonCode, evidenceText, actorRole: "buyer" });
    }
  } catch {
    return local;
  }
  return local;
}
