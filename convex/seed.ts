// Deterministic demo seed for the first persistence slice.
//
// Seeds the SAME data produced by the local `createMockFixture()` into Convex so
// the existing visible flow (Home -> Listing -> Checkout -> My Tickets / Sell
// Orders) can read/write through Convex without changing what the user sees.
//
// Idempotent by public demo keys: re-running `seedDemoFixture` never creates a
// duplicate user/listing/order/transfer task/issue/source rule. Audit logs are
// intentionally NOT seeded — they are append-only from the transition mutations.

import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { createMockFixture } from "../src/lib/mock/fixtures";

export const seedDemoFixture = mutation({
  args: {},
  returns: v.object({
    created: v.boolean(),
    listingKey: v.string(),
    orderKey: v.string(),
    transferTaskKey: v.string(),
  }),
  handler: async (ctx) => {
    const fixture = createMockFixture();
    let created = false;

    // users
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_app_user_id", (q) => q.eq("appUserId", fixture.user.id))
      .unique();
    if (!existingUser) {
      created = true;
      await ctx.db.insert("users", {
        appUserId: fixture.user.id,
        role: fixture.user.role,
        phoneVerified: fixture.user.phoneVerified,
        displayName: fixture.user.displayName,
      });
    }

    // auth_identities
    const existingIdentity = await ctx.db
      .query("auth_identities")
      .withIndex("by_provider_subject", (q) =>
        q.eq("provider", fixture.authIdentity.provider).eq("providerUserId", fixture.authIdentity.providerUserId),
      )
      .unique();
    if (!existingIdentity) {
      created = true;
      await ctx.db.insert("auth_identities", {
        appUserId: fixture.authIdentity.appUserId,
        provider: fixture.authIdentity.provider,
        providerUserId: fixture.authIdentity.providerUserId,
      });
    }

    // user_verifications
    const existingVerification = await ctx.db
      .query("user_verifications")
      .withIndex("by_app_user_id", (q) => q.eq("appUserId", fixture.userVerification.appUserId))
      .unique();
    if (!existingVerification) {
      created = true;
      await ctx.db.insert("user_verifications", {
        appUserId: fixture.userVerification.appUserId,
        phoneVerified: fixture.userVerification.phoneVerified,
        verificationMode: fixture.userVerification.verificationMode,
      });
    }

    // seller_payment_accounts (mocked readiness only)
    const existingPayment = await ctx.db
      .query("seller_payment_accounts")
      .withIndex("by_seller", (q) => q.eq("sellerId", fixture.sellerPaymentAccount.sellerId))
      .unique();
    if (!existingPayment) {
      created = true;
      await ctx.db.insert("seller_payment_accounts", {
        sellerId: fixture.sellerPaymentAccount.sellerId,
        status: fixture.sellerPaymentAccount.status,
        provider: fixture.sellerPaymentAccount.provider,
      });
    }

    // source_rules
    const rule = fixture.sourceRule;
    const existingRule = await ctx.db
      .query("source_rules")
      .withIndex("by_key", (q) => q.eq("sourceRuleKey", rule.id))
      .unique();
    if (!existingRule) {
      created = true;
      await ctx.db.insert("source_rules", {
        sourceRuleKey: rule.id,
        version: rule.version,
        source: rule.source,
        category: rule.category,
        sourceCategoryKey: rule.sourceCategoryKey,
        decision: rule.decision,
        internalStatus: rule.internalStatus,
        transferMode: rule.transferMode,
        transferability: rule.transferability,
        protectionLevel: rule.protectionLevel,
        requiredFields: rule.requiredFields,
        eligibilityFields: rule.eligibilityFields,
        priceRule: rule.priceRule,
        payoutPolicy: rule.payoutPolicy,
        blockedBehavior: rule.blockedBehavior,
        manualReviewReasonCodes: rule.manualReviewReasonCodes,
        effectiveFrom: rule.effectiveFrom,
        lastVerifiedAt: rule.lastVerifiedAt,
        verificationSourceUrlOrNote: rule.verificationSourceUrlOrNote,
        createdBy: rule.createdBy,
      });
    }

    // listings
    const listing = fixture.listing;
    const existingListing = await ctx.db
      .query("listings")
      .withIndex("by_key", (q) => q.eq("listingKey", listing.id))
      .unique();
    if (!existingListing) {
      created = true;
      await ctx.db.insert("listings", {
        listingKey: listing.id,
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
      });
    }

    // orders
    const order = fixture.order;
    const existingOrder = await ctx.db
      .query("orders")
      .withIndex("by_key", (q) => q.eq("orderKey", order.id))
      .unique();
    if (!existingOrder) {
      created = true;
      await ctx.db.insert("orders", {
        orderKey: order.id,
        buyerId: order.buyerId,
        sellerId: order.sellerId,
        listingId: order.listingId,
        state: order.state,
        mockPaymentStatus: order.mockPaymentStatus,
        mockPaymentSummary: order.mockPaymentSummary,
        transferTaskId: order.transferTaskId,
        issueWindowEndsAt: order.issueWindowEndsAt,
        createdAt: order.createdAt,
      });
    }

    // transfer_tasks
    const transferTask = fixture.transferTask;
    const existingTransfer = await ctx.db
      .query("transfer_tasks")
      .withIndex("by_key", (q) => q.eq("transferTaskKey", transferTask.id))
      .unique();
    if (!existingTransfer) {
      created = true;
      await ctx.db.insert("transfer_tasks", {
        transferTaskKey: transferTask.id,
        orderId: transferTask.orderId,
        requiredActor: transferTask.requiredActor,
        state: transferTask.state,
        deadlineAt: transferTask.deadlineAt,
        ...(transferTask.submittedAt !== undefined ? { submittedAt: transferTask.submittedAt } : {}),
        ...(transferTask.evidenceSummary !== undefined
          ? { evidenceSummary: transferTask.evidenceSummary }
          : {}),
      });
    }

    // issues (draft)
    const issue = fixture.issue;
    const existingIssue = await ctx.db
      .query("issues")
      .withIndex("by_key", (q) => q.eq("issueKey", issue.id))
      .unique();
    if (!existingIssue) {
      created = true;
      await ctx.db.insert("issues", {
        issueKey: issue.id,
        orderId: issue.orderId,
        reasonCode: issue.reasonCode,
        state: issue.state,
        requiredEvidence: issue.requiredEvidence,
        evidenceItems: issue.evidenceItems,
        decision: issue.decision,
      });
    }

    return {
      created,
      listingKey: listing.id,
      orderKey: order.id,
      transferTaskKey: transferTask.id,
    };
  },
});
