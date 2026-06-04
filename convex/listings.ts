// Public read queries for the buyer-facing listing surfaces (Home, Listing
// detail, Checkout). They return the SAME `MockListing` / `SourceRule` shapes the
// local fixture produces, so the data-access adapter can swap fixture reads for
// Convex reads without any UI change.
//
// Returns validators are intentionally omitted on these composite read shapes;
// tightening them is part of the Codex backend-correctness validation pass.

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { listingDocToMock, sourceRuleDocToMock } from "./model";
import { requirePhoneVerifiedAppUser } from "./identity";
import { calculateCheckoutTotal } from "../src/lib/mock/pricing";
import { evaluateSourceRule } from "../src/lib/rules/evaluateRule";
import { validateSellerListing } from "../src/lib/validation/sellerValidation";
import type { ListingState, MockListing, SourceRule } from "../src/lib/types";

const DEMO_LISTING_KEY = "listing_bms_event_1";

const sellerListingDraft = v.object({
  source: v.union(
    v.literal("bookmyshow"),
    v.literal("district"),
    v.literal("bus_operator"),
    v.literal("other_platform"),
    v.literal("manual_upload"),
  ),
  category: v.union(
    v.literal("event_ticket"),
    v.literal("movie_ticket"),
    v.literal("bus_travel"),
    v.literal("watcher"),
    v.literal("future_category"),
  ),
  title: v.string(),
  venueOrRoute: v.string(),
  eventOrTripStartAt: v.string(),
  quantity: v.number(),
  faceValue: v.number(),
  listingPrice: v.number(),
  transferDeadlineAt: v.string(),
  protectionDeadlineAt: v.string(),
  sellerPromiseAccepted: v.boolean(),
  duplicateFingerprint: v.string(),
});

type SellerListingDraft = {
  source: SourceRule["source"];
  category: SourceRule["category"];
  title: string;
  venueOrRoute: string;
  eventOrTripStartAt: string;
  quantity: number;
  faceValue: number;
  listingPrice: number;
  transferDeadlineAt: string;
  protectionDeadlineAt: string;
  sellerPromiseAccepted: boolean;
  duplicateFingerprint: string;
};

function listingStateForDecision(decision: MockListing["ruleDecision"]): ListingState {
  if (decision === "AUTO_APPROVE") return "live";
  if (decision === "AUTO_BLOCK") return "blocked";
  if (decision === "AUTO_WAITLIST") return "waitlist_only";
  return "under_review";
}

function stableListingKey(sellerId: string, duplicateFingerprint: string): string {
  const normalized = duplicateFingerprint
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 72);
  return `listing_${sellerId}_${normalized || "seller_upload"}`;
}

function buildSubmittedListing(sellerId: string, draft: SellerListingDraft, sourceRule: SourceRule): MockListing {
  const evaluation = evaluateSourceRule({
    source: draft.source,
    category: draft.category,
    listingPrice: draft.listingPrice,
    faceValue: draft.faceValue,
    requiredFieldValues: {
      title: draft.title,
      eventOrTripStartAt: draft.eventOrTripStartAt,
      venueOrRoute: draft.venueOrRoute,
      quantity: draft.quantity,
      transferDeadlineAt: draft.transferDeadlineAt,
      sellerPromiseAccepted: draft.sellerPromiseAccepted,
    },
  });
  const checkoutTotal = calculateCheckoutTotal(draft.listingPrice);

  return {
    id: stableListingKey(sellerId, draft.duplicateFingerprint),
    sellerId,
    sourceRuleId: sourceRule.id,
    sourceRuleVersion: sourceRule.version,
    category: draft.category,
    source: draft.source,
    sourceCategoryKey: sourceRule.sourceCategoryKey,
    title: draft.title,
    venueOrRoute: draft.venueOrRoute,
    eventOrTripStartAt: draft.eventOrTripStartAt,
    quantity: draft.quantity,
    faceValue: draft.faceValue,
    listingPrice: draft.listingPrice,
    platformFee: checkoutTotal.platformFee,
    gstOnFee: checkoutTotal.gstOnPlatformFee,
    totalPayable: checkoutTotal.totalPayable,
    transferMode: sourceRule.transferMode,
    transferDeadlineAt: draft.transferDeadlineAt,
    protectionDeadlineAt: draft.protectionDeadlineAt,
    state: listingStateForDecision(evaluation.decision),
    ruleDecision: evaluation.decision,
    duplicateFingerprint: draft.duplicateFingerprint,
  };
}

function listingPatch(listing: MockListing) {
  return {
    sellerId: listing.sellerId,
    sourceRuleId: listing.sourceRuleId,
    sourceRuleVersion: listing.sourceRuleVersion,
    category: listing.category,
    source: listing.source,
    sourceCategoryKey: listing.sourceCategoryKey,
    title: listing.title,
    venueOrRoute: listing.venueOrRoute,
    eventOrTripStartAt: listing.eventOrTripStartAt,
    quantity: listing.quantity,
    faceValue: listing.faceValue,
    listingPrice: listing.listingPrice,
    platformFee: listing.platformFee,
    gstOnFee: listing.gstOnFee,
    totalPayable: listing.totalPayable,
    transferMode: listing.transferMode,
    transferDeadlineAt: listing.transferDeadlineAt,
    protectionDeadlineAt: listing.protectionDeadlineAt,
    state: listing.state,
    ruleDecision: listing.ruleDecision,
    duplicateFingerprint: listing.duplicateFingerprint,
  };
}

function blockingValidationCodes(listing: MockListing, sourceRule: SourceRule): string[] {
  const validation = validateSellerListing(listing, sourceRule);
  return validation.blockers.filter((blocker) => blocker !== "RULE_BLOCKED");
}

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

export const submitSellerListingForCurrentUser = mutation({
  args: { draft: sellerListingDraft },
  handler: async (ctx, args) => {
    const seller = await requirePhoneVerifiedAppUser(ctx);
    const evaluation = evaluateSourceRule({
      source: args.draft.source,
      category: args.draft.category,
      listingPrice: args.draft.listingPrice,
      faceValue: args.draft.faceValue,
      requiredFieldValues: {
        title: args.draft.title,
        eventOrTripStartAt: args.draft.eventOrTripStartAt,
        venueOrRoute: args.draft.venueOrRoute,
        quantity: args.draft.quantity,
        transferDeadlineAt: args.draft.transferDeadlineAt,
        sellerPromiseAccepted: args.draft.sellerPromiseAccepted,
      },
    });
    const sourceRuleDoc = await ctx.db
      .query("source_rules")
      .withIndex("by_key", (q) => q.eq("sourceRuleKey", evaluation.sourceRuleId))
      .unique();
    if (!sourceRuleDoc) throw new Error("SOURCE_RULE_NOT_FOUND");

    const sourceRule = sourceRuleDocToMock(sourceRuleDoc);
    const listing = buildSubmittedListing(seller.appUserId, args.draft, sourceRule);
    const blockers = blockingValidationCodes(listing, sourceRule);
    if (blockers.length > 0) {
      throw new Error(`SELLER_LISTING_INVALID:${blockers.join(",")}`);
    }

    const sellerListings = await ctx.db
      .query("listings")
      .withIndex("by_seller", (q) => q.eq("sellerId", seller.appUserId))
      .collect();
    const duplicate = sellerListings.find(
      (candidate) => candidate.duplicateFingerprint === listing.duplicateFingerprint,
    );
    if (duplicate) {
      await ctx.db.patch(duplicate._id, listingPatch(listing));
      return { listing, status: "updated" as const };
    }

    await ctx.db.insert("listings", { listingKey: listing.id, ...listingPatch(listing) });
    return { listing, status: "created" as const };
  },
});
