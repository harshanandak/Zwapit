// Public read queries for the buyer-facing listing surfaces (Home, Listing
// detail, Checkout). They return the SAME `MockListing` / `SourceRule` shapes the
// local fixture produces, so the data-access adapter can swap fixture reads for
// Convex reads without any UI change.
//
// Returns validators are intentionally omitted on these composite read shapes;
// tightening them is part of the Codex backend-correctness validation pass.

import { query } from "./_generated/server";
import { v } from "convex/values";
import { listingDocToMock, sourceRuleDocToMock } from "./model";

const DEMO_LISTING_KEY = "listing_bms_event_1";

export const getHomeListings = query({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db
      .query("listings")
      .withIndex("by_state", (q) => q.eq("state", "live"))
      .collect();
    return docs.map(listingDocToMock);
  },
});

export const getListingDetail = query({
  args: { listingKey: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const key = args.listingKey ?? DEMO_LISTING_KEY;
    const doc = await ctx.db
      .query("listings")
      .withIndex("by_key", (q) => q.eq("listingKey", key))
      .unique();
    if (!doc) return null;
    const rule = await ctx.db
      .query("source_rules")
      .withIndex("by_key", (q) => q.eq("sourceRuleKey", doc.sourceRuleId))
      .unique();
    return {
      listing: listingDocToMock(doc),
      sourceRule: rule ? sourceRuleDocToMock(rule) : null,
    };
  },
});

export const getCheckoutView = query({
  args: { listingKey: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const key = args.listingKey ?? DEMO_LISTING_KEY;
    const doc = await ctx.db
      .query("listings")
      .withIndex("by_key", (q) => q.eq("listingKey", key))
      .unique();
    if (!doc) return null;
    const rule = await ctx.db
      .query("source_rules")
      .withIndex("by_key", (q) => q.eq("sourceRuleKey", doc.sourceRuleId))
      .unique();
    const sellerPayment = await ctx.db
      .query("seller_payment_accounts")
      .withIndex("by_seller", (q) => q.eq("sellerId", doc.sellerId))
      .unique();
    return {
      listing: listingDocToMock(doc),
      sourceRule: rule ? sourceRuleDocToMock(rule) : null,
      sellerPaymentAccount: sellerPayment
        ? {
            sellerId: sellerPayment.sellerId,
            status: sellerPayment.status,
            provider: sellerPayment.provider,
          }
        : null,
    };
  },
});
