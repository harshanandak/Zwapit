// Public order queries + the mock-visible flow mutations.
//
// Scope guardrails (first persistence slice):
//   * No real auth. Mutations accept only the visible demo role where needed;
//     actor ids are still derived SERVER-SIDE from stored order buyerId/sellerId.
//   * `mockCheckout` only records the existing mock paid state + fee breakdown.
//   * No payment/refund/payout/admin operations are exposed.
//
// All transitions reuse the same pure state-machine helpers as the local mock
// flow (src/lib/state/*), wrapped in convex/model.ts.

import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import {
  applyBuyerConfirm,
  applyComplete,
  applyMockPay,
  applyOpenProtectionWindow,
  applyReportIssue,
  applySellerSubmit,
  issueDocToMock,
  listingDocToMock,
  orderDocToMock,
  sourceRuleDocToMock,
  transferDocToMock,
} from "./model";
import { validateCheckout } from "../src/lib/validation/checkoutValidation";

const DEMO_ORDER_KEY = "order_demo_1";

const issueReasonCode = v.union(
  v.literal("ticket_not_transferred"),
  v.literal("wrong_ticket"),
  v.literal("qr_or_code_already_used"),
  v.literal("details_do_not_match"),
  v.literal("eligibility_problem"),
  v.literal("cannot_access_ticket"),
);
const actorRole = v.union(v.literal("buyer"), v.literal("seller"));

async function validatePersistedCheckout(
  ctx: MutationCtx,
  args: {
    orderKey: string;
    buyerEligibilityAcknowledged?: boolean;
    totalShownToBuyer?: number;
  },
): Promise<void> {
  const orderDoc = await ctx.db
    .query("orders")
    .withIndex("by_key", (q) => q.eq("orderKey", args.orderKey))
    .unique();
  if (!orderDoc) throw new Error("ORDER_NOT_FOUND");

  const listingDoc = await ctx.db
    .query("listings")
    .withIndex("by_key", (q) => q.eq("listingKey", orderDoc.listingId))
    .unique();
  if (!listingDoc) throw new Error("LISTING_NOT_FOUND");

  const sourceRuleDoc = await ctx.db
    .query("source_rules")
    .withIndex("by_key", (q) => q.eq("sourceRuleKey", listingDoc.sourceRuleId))
    .unique();
  if (!sourceRuleDoc) throw new Error("SOURCE_RULE_NOT_FOUND");

  const sellerPaymentAccount = await ctx.db
    .query("seller_payment_accounts")
    .withIndex("by_seller", (q) => q.eq("sellerId", listingDoc.sellerId))
    .first();
  if (!sellerPaymentAccount) throw new Error("SELLER_PAYOUT_NOT_READY");

  const validation = validateCheckout({
    listing: listingDocToMock(listingDoc),
    sourceRule: sourceRuleDocToMock(sourceRuleDoc),
    sellerPaymentAccount: {
      sellerId: sellerPaymentAccount.sellerId,
      status: sellerPaymentAccount.status,
      provider: sellerPaymentAccount.provider,
    },
    buyerEligibilityAcknowledged: args.buyerEligibilityAcknowledged === true,
    totalShownToBuyer: args.totalShownToBuyer,
    now: new Date().toISOString(),
  });
  if (!validation.ok) throw new Error(`CHECKOUT_BLOCKED:${validation.blockers.join(",")}`);
}

// ---- Queries ----

// Full demo fixture view assembled from Convex (same shape as createMockFixture()).
export const getCurrentFixtureView = query({
  args: { orderKey: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const orderKey = args.orderKey ?? DEMO_ORDER_KEY;
    const orderDoc = await ctx.db
      .query("orders")
      .withIndex("by_key", (q) => q.eq("orderKey", orderKey))
      .unique();
    if (!orderDoc) return null;

    const listingDoc = await ctx.db
      .query("listings")
      .withIndex("by_key", (q) => q.eq("listingKey", orderDoc.listingId))
      .unique();
    const transferDoc = await ctx.db
      .query("transfer_tasks")
      .withIndex("by_key", (q) => q.eq("transferTaskKey", orderDoc.transferTaskId))
      .unique();
    const issueDoc = await ctx.db
      .query("issues")
      .withIndex("by_order", (q) => q.eq("orderId", orderKey))
      .first();
    const ruleDoc = listingDoc
      ? await ctx.db
          .query("source_rules")
          .withIndex("by_key", (q) => q.eq("sourceRuleKey", listingDoc.sourceRuleId))
          .unique()
      : null;
    const userDoc = await ctx.db
      .query("users")
      .withIndex("by_app_user_id", (q) => q.eq("appUserId", orderDoc.buyerId))
      .unique();
    const identityDoc = await ctx.db
      .query("auth_identities")
      .withIndex("by_app_user_id", (q) => q.eq("appUserId", orderDoc.buyerId))
      .unique();
    const verificationDoc = await ctx.db
      .query("user_verifications")
      .withIndex("by_app_user_id", (q) => q.eq("appUserId", orderDoc.buyerId))
      .unique();
    const paymentDoc = await ctx.db
      .query("seller_payment_accounts")
      .withIndex("by_seller", (q) => q.eq("sellerId", orderDoc.sellerId))
      .unique();

    if (!listingDoc || !transferDoc || !issueDoc || !ruleDoc || !userDoc || !identityDoc || !verificationDoc || !paymentDoc) {
      return null;
    }

    return {
      user: {
        id: userDoc.appUserId,
        role: userDoc.role,
        phoneVerified: userDoc.phoneVerified,
        displayName: userDoc.displayName,
      },
      authIdentity: {
        appUserId: identityDoc.appUserId,
        provider: identityDoc.provider,
        providerUserId: identityDoc.providerUserId,
      },
      userVerification: {
        appUserId: verificationDoc.appUserId,
        phoneVerified: verificationDoc.phoneVerified,
        verificationMode: verificationDoc.verificationMode,
      },
      sellerPaymentAccount: {
        sellerId: paymentDoc.sellerId,
        status: paymentDoc.status,
        provider: paymentDoc.provider,
      },
      sourceRule: sourceRuleDocToMock(ruleDoc),
      listing: listingDocToMock(listingDoc),
      order: orderDocToMock(orderDoc),
      transferTask: transferDocToMock(transferDoc),
      issue: issueDocToMock(issueDoc),
    };
  },
});

export const getBuyerOrder = query({
  args: { orderKey: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const orderKey = args.orderKey ?? DEMO_ORDER_KEY;
    const orderDoc = await ctx.db
      .query("orders")
      .withIndex("by_key", (q) => q.eq("orderKey", orderKey))
      .unique();
    if (!orderDoc) return null;
    const transferDoc = await ctx.db
      .query("transfer_tasks")
      .withIndex("by_key", (q) => q.eq("transferTaskKey", orderDoc.transferTaskId))
      .unique();
    return {
      order: orderDocToMock(orderDoc),
      transferTask: transferDoc ? transferDocToMock(transferDoc) : null,
    };
  },
});

export const getBuyerTickets = query({
  args: { buyerId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const buyerId = args.buyerId ?? "user_demo_1";
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_buyer", (q) => q.eq("buyerId", buyerId))
      .collect();
    const tickets = [];
    for (const orderDoc of orders) {
      const listingDoc = await ctx.db
        .query("listings")
        .withIndex("by_key", (q) => q.eq("listingKey", orderDoc.listingId))
        .unique();
      tickets.push({
        order: orderDocToMock(orderDoc),
        listing: listingDoc ? listingDocToMock(listingDoc) : null,
      });
    }
    return tickets;
  },
});

export const getSellerOrders = query({
  args: { sellerId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const sellerId = args.sellerId ?? "seller_demo_1";
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_seller", (q) => q.eq("sellerId", sellerId))
      .collect();
    const result = [];
    for (const orderDoc of orders) {
      const listingDoc = await ctx.db
        .query("listings")
        .withIndex("by_key", (q) => q.eq("listingKey", orderDoc.listingId))
        .unique();
      const transferDoc = await ctx.db
        .query("transfer_tasks")
        .withIndex("by_key", (q) => q.eq("transferTaskKey", orderDoc.transferTaskId))
        .unique();
      result.push({
        order: orderDocToMock(orderDoc),
        listing: listingDoc ? listingDocToMock(listingDoc) : null,
        transferTask: transferDoc ? transferDocToMock(transferDoc) : null,
      });
    }
    return result;
  },
});

// ---- Mutations (mock-visible flow only) ----

export const mockCheckout = mutation({
  args: {
    orderKey: v.optional(v.string()),
    buyerEligibilityAcknowledged: v.optional(v.boolean()),
    totalShownToBuyer: v.optional(v.number()),
  },
  returns: v.object({ state: v.string() }),
  handler: async (ctx, args) => {
    const orderKey = args.orderKey ?? DEMO_ORDER_KEY;
    await validatePersistedCheckout(ctx, {
      orderKey,
      buyerEligibilityAcknowledged: args.buyerEligibilityAcknowledged,
      totalShownToBuyer: args.totalShownToBuyer,
    });
    const order = await applyMockPay(ctx, orderKey);
    return { state: order.state };
  },
});

export const sellerSubmitTransfer = mutation({
  args: {
    orderKey: v.optional(v.string()),
    submittedAt: v.optional(v.string()),
    actorRole: v.optional(actorRole),
  },
  returns: v.object({ state: v.string() }),
  handler: async (ctx, args) => {
    if (args.actorRole !== "seller") throw new Error("SELLER_ACTOR_REQUIRED");
    const order = await applySellerSubmit(ctx, args.orderKey ?? DEMO_ORDER_KEY, {
      submittedAt: args.submittedAt,
    });
    return { state: order.state };
  },
});

export const buyerConfirmTransfer = mutation({
  args: { orderKey: v.optional(v.string()), actorRole: v.optional(actorRole) },
  returns: v.object({ state: v.string() }),
  handler: async (ctx, args) => {
    if (args.actorRole !== "buyer") throw new Error("BUYER_ACTOR_REQUIRED");
    const order = await applyBuyerConfirm(ctx, args.orderKey ?? DEMO_ORDER_KEY);
    return { state: order.state };
  },
});

export const buyerReportIssue = mutation({
  args: {
    orderKey: v.optional(v.string()),
    reasonCode: issueReasonCode,
    evidenceText: v.optional(v.string()),
    actorRole: v.optional(actorRole),
  },
  returns: v.object({ orderState: v.string(), issueState: v.string() }),
  handler: async (ctx, args) => {
    if (args.actorRole !== "buyer") throw new Error("BUYER_ACTOR_REQUIRED");
    const text = args.evidenceText?.trim();
    const evidenceItems = text ? [text] : [];
    const { order, issue } = await applyReportIssue(
      ctx,
      args.orderKey ?? DEMO_ORDER_KEY,
      args.reasonCode,
      evidenceItems,
    );
    return { orderState: order.state, issueState: issue.state };
  },
});

// advanceTimeline mirrors the local connectTimelineActions(): it applies the next
// valid transition for the order's current state. This preserves the existing
// "Advance (demo)" island behavior, now persisted in Convex.
export const advanceTimeline = mutation({
  args: {
    orderKey: v.optional(v.string()),
    submittedAt: v.optional(v.string()),
    actorRole: v.optional(actorRole),
  },
  returns: v.object({ state: v.string(), action: v.string() }),
  handler: async (ctx, args) => {
    const orderKey = args.orderKey ?? DEMO_ORDER_KEY;
    const orderDoc = await ctx.db
      .query("orders")
      .withIndex("by_key", (q) => q.eq("orderKey", orderKey))
      .unique();
    if (!orderDoc) throw new Error("ORDER_NOT_FOUND");

    switch (orderDoc.state) {
      case "checkout_pending": {
        throw new Error("USE_MOCK_CHECKOUT");
      }
      case "transfer_pending": {
        throw new Error("SELLER_TRANSFER_MUTATION_REQUIRED");
      }
      case "transfer_submitted": {
        if (args.actorRole !== "buyer") throw new Error("BUYER_ACTOR_REQUIRED");
        const order = await applyBuyerConfirm(ctx, orderKey);
        return { state: order.state, action: "buyer_confirm_received" };
      }
      case "buyer_confirmed": {
        if (args.actorRole !== "buyer") throw new Error("BUYER_ACTOR_REQUIRED");
        const order = await applyOpenProtectionWindow(ctx, orderKey);
        return { state: order.state, action: "open_protection_window" };
      }
      case "dispute_window_open": {
        if (args.actorRole !== "buyer") throw new Error("BUYER_ACTOR_REQUIRED");
        const order = await applyComplete(ctx, orderKey);
        return { state: order.state, action: "complete_after_window" };
      }
      default:
        return { state: orderDoc.state, action: "none" };
    }
  },
});
