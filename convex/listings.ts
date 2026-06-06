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
import type { ListingState, MockListing, RuleDecision, SellerListingDraft, SourceRule } from "../src/lib/types";

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

function listingStateForDecision(decision: MockListing["ruleDecision"]): ListingState {
  if (decision === "AUTO_APPROVE") return "live";
  if (decision === "AUTO_BLOCK") return "blocked";
  if (decision === "AUTO_WAITLIST") return "waitlist_only";
  return "under_review";
}

function hasRequiredValue(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) && value > 0;
  return true;
}

function priceRuleRequiresReview(sourceRule: SourceRule, draft: SellerListingDraft): boolean {
  if (sourceRule.priceRule.kind !== "manual_review_above_face_value") return false;
  const maxMultiplier = sourceRule.priceRule.maxMultiplier ?? 1;
  return draft.listingPrice > draft.faceValue * maxMultiplier;
}

function decisionForPersistedRule(sourceRule: SourceRule, draft: SellerListingDraft): RuleDecision {
  if (sourceRule.decision === "AUTO_BLOCK" || sourceRule.decision === "AUTO_WAITLIST") {
    return sourceRule.decision;
  }

  if (sourceRule.decision === "NEEDS_MANUAL_REVIEW") return "NEEDS_MANUAL_REVIEW";

  const explicitRequiredValues: Record<string, unknown> = {
    faceValue: draft.faceValue,
    listingPrice: draft.listingPrice,
  };
  const draftRequiredValues: Record<string, unknown> = {
    title: draft.title,
    eventOrTripStartAt: draft.eventOrTripStartAt,
    venueOrRoute: draft.venueOrRoute,
    quantity: draft.quantity,
    transferDeadlineAt: draft.transferDeadlineAt,
    sellerPromiseAccepted: draft.sellerPromiseAccepted,
  };
  const requiredFields = [...new Set([...sourceRule.requiredFields, ...sourceRule.eligibilityFields])];
  const hasMissingFields = requiredFields.some(
    (field) => !hasRequiredValue(draftRequiredValues[field] ?? explicitRequiredValues[field]),
  );

  return hasMissingFields || sourceRule.manualReviewReasonCodes.length > 0 || priceRuleRequiresReview(sourceRule, draft)
    ? "NEEDS_MANUAL_REVIEW"
    : sourceRule.decision;
}

function normalizeFingerprint(duplicateFingerprint: string): string {
  let normalized = "";
  let previousWasSeparator = false;

  for (const char of duplicateFingerprint.trim().toLowerCase()) {
    const isAlphanumeric = (char >= "a" && char <= "z") || (char >= "0" && char <= "9");
    if (isAlphanumeric) {
      normalized += char;
      previousWasSeparator = false;
    } else if (!previousWasSeparator && normalized.length > 0) {
      normalized += "_";
      previousWasSeparator = true;
    }
  }

  const trimmed = previousWasSeparator ? normalized.slice(0, -1) : normalized;
  return trimmed.slice(0, 72) || "seller_upload";
}

function stableListingKey(sellerId: string, duplicateFingerprint: string): string {
  return `listing_${sellerId}_${normalizeFingerprint(duplicateFingerprint)}`;
}

function isTerminalListingState(state: ListingState): boolean {
  return state === "sold" || state === "expired";
}

function uniqueListingKey(baseKey: string, sellerListings: Array<{ listingKey?: string }>): string {
  const existingKeys = new Set(sellerListings.map((listing) => listing.listingKey));
  if (!existingKeys.has(baseKey)) return baseKey;

  let sequence = 2;
  let candidate = `${baseKey}_${sequence}`;
  while (existingKeys.has(candidate)) {
    sequence += 1;
    candidate = `${baseKey}_${sequence}`;
  }
  return candidate;
}

function buildSubmittedListing(
  sellerId: string,
  draft: SellerListingDraft,
  sourceRule: SourceRule,
  listingKey = stableListingKey(sellerId, draft.duplicateFingerprint),
): MockListing {
  const normalizedFingerprint = normalizeFingerprint(draft.duplicateFingerprint);
  const ruleDecision = decisionForPersistedRule(sourceRule, draft);
  const checkoutTotal = calculateCheckoutTotal(draft.listingPrice);

  return {
    id: listingKey,
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
    state: listingStateForDecision(ruleDecision),
    ruleDecision,
    duplicateFingerprint: normalizedFingerprint,
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
    const localEvaluation = evaluateSourceRule({
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
      .withIndex("by_key", (q) => q.eq("sourceRuleKey", localEvaluation.sourceRuleId))
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
    const duplicate = sellerListings.find((candidate) => {
      return normalizeFingerprint(String(candidate.duplicateFingerprint)) === listing.duplicateFingerprint;
    });
    if (duplicate && !isTerminalListingState(duplicate.state as ListingState)) {
      await ctx.db.patch(duplicate._id, listingPatch(listing));
      return { listing, status: "updated" as const };
    }

    const createdListing = duplicate
      ? buildSubmittedListing(
          seller.appUserId,
          args.draft,
          sourceRule,
          uniqueListingKey(listing.id, sellerListings),
        )
      : listing;
    await ctx.db.insert("listings", { listingKey: createdListing.id, ...listingPatch(createdListing) });
    return { listing: createdListing, status: "created" as const };
  },
});
