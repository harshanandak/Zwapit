import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// First Convex persistence slice schema.
//
// This schema mirrors the existing local contracts in `src/lib/types.ts`
// (MockUser, AuthIdentity, SourceRule, MockListing, MockOrder, ...). It does NOT
// rename any state, transfer mode, or rule value. Convex assigns its own `_id`
// to every document; the existing demo ids ("user_demo_1", "order_demo_1", ...)
// are preserved as stable public-key fields (appUserId, listingKey, orderKey,
// transferTaskKey, sourceRuleKey, issueKey) so current UI routes and tests can
// keep mapping by the same ids.
//
// Scope: persistence for the accepted first visible mock flow only. No real
// auth, payment, payout, refund, admin, demand, or category-expansion tables.

// ---- Reusable enum validators (kept identical to src/lib/types.ts) ----

const ruleDecision = v.union(
  v.literal("AUTO_APPROVE"),
  v.literal("AUTO_BLOCK"),
  v.literal("AUTO_WAITLIST"),
  v.literal("NEEDS_MANUAL_REVIEW"),
);

const internalSourceStatus = v.union(
  v.literal("ALLOW"),
  v.literal("AMBER"),
  v.literal("DEMAND_ONLY"),
  v.literal("BLOCKED"),
);

const transferMode = v.union(
  v.literal("OFFICIAL_TRANSFER"),
  v.literal("OFFICIAL_REISSUE"),
  v.literal("CUSTOMER_MANAGED_HANDOFF"),
  v.literal("CODE_REVEAL"),
  v.literal("IDENTITY_BOUND"),
);

const listingState = v.union(
  v.literal("draft"),
  v.literal("under_review"),
  v.literal("live"),
  v.literal("sold"),
  v.literal("paused"),
  v.literal("expired"),
  v.literal("blocked"),
  v.literal("waitlist_only"),
);

const orderState = v.union(
  v.literal("checkout_pending"),
  v.literal("payment_captured"),
  v.literal("transfer_pending"),
  v.literal("fulfilment_in_progress"),
  v.literal("transfer_submitted"),
  v.literal("buyer_confirmed"),
  v.literal("dispute_window_open"),
  v.literal("issue_reported"),
  v.literal("buyer_rejected"),
  v.literal("refund_processing"),
  v.literal("refunded"),
  v.literal("payout_eligible"),
  v.literal("payout_waiting"),
  v.literal("payout_released"),
  v.literal("payout_sent"),
  v.literal("seller_payout_blocked"),
  v.literal("completed"),
  v.literal("transfer_timeout"),
);

const transferTaskState = v.union(
  v.literal("transfer_pending"),
  v.literal("transfer_submitted"),
  v.literal("buyer_confirmed"),
  v.literal("transfer_timeout"),
);

const issueState = v.union(
  v.literal("draft"),
  v.literal("reported"),
  v.literal("accepted"),
  v.literal("rejected"),
);

const issueReasonCode = v.union(
  v.literal("ticket_not_transferred"),
  v.literal("wrong_ticket"),
  v.literal("qr_or_code_already_used"),
  v.literal("details_do_not_match"),
  v.literal("eligibility_problem"),
  v.literal("cannot_access_ticket"),
);

const actorRole = v.union(v.literal("buyer"), v.literal("seller"), v.literal("system"));
const protectionLevel = v.union(
  v.literal("protected_payment"),
  v.literal("waitlist_only"),
  v.literal("cannot_list"),
);
const transferability = v.union(
  v.literal("transferable"),
  v.literal("not_transferable"),
  v.literal("unknown"),
);

// MoneySummary (src/lib/types.ts) — the mock fee breakdown shown at checkout.
const moneySummary = v.object({
  currency: v.literal("INR"),
  itemPrice: v.number(),
  platformFee: v.number(),
  gstOnPlatformFee: v.number(),
  totalPayable: v.number(),
  status: v.optional(v.union(v.literal("mock_unpaid"), v.literal("mock_paid"))),
});

export default defineSchema({
  // Internal app users. `appUserId` is the internal id used everywhere in app
  // data (never a provider id).
  users: defineTable({
    appUserId: v.string(),
    role: v.literal("buyer_seller"),
    phoneVerified: v.boolean(),
    displayName: v.string(),
  }).index("by_app_user_id", ["appUserId"]),

  // Provider identity stored separately from the internal app user id.
  auth_identities: defineTable({
    appUserId: v.string(),
    provider: v.union(v.literal("mock_phone"), v.literal("clerk")),
    providerUserId: v.string(),
  })
    .index("by_app_user_id", ["appUserId"])
    .index("by_provider_subject", ["provider", "providerUserId"]),

  user_verifications: defineTable({
    appUserId: v.string(),
    phoneVerified: v.boolean(),
    verificationMode: v.union(v.literal("mock"), v.literal("clerk_phone"), v.literal("unverified")),
  }).index("by_app_user_id", ["appUserId"]),

  // Mocked seller payout readiness only. No real payout/KYC fields.
  seller_payment_accounts: defineTable({
    sellerId: v.string(),
    status: v.union(v.literal("mock_ready"), v.literal("mock_missing")),
    provider: v.literal("mock"),
  }).index("by_seller", ["sellerId"]),

  source_rules: defineTable({
    sourceRuleKey: v.string(),
    version: v.number(),
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
    sourceCategoryKey: v.string(),
    decision: ruleDecision,
    internalStatus: internalSourceStatus,
    transferMode,
    transferability,
    protectionLevel,
    requiredFields: v.array(v.string()),
    eligibilityFields: v.array(v.string()),
    priceRule: v.object({
      kind: v.union(
        v.literal("face_value_cap"),
        v.literal("manual_review_above_face_value"),
        v.literal("blocked"),
      ),
      maxMultiplier: v.optional(v.number()),
    }),
    payoutPolicy: v.object({
      releaseAfter: v.literal("buyer_confirmation_and_issue_window"),
      mockOnly: v.literal(true),
    }),
    blockedBehavior: v.union(
      v.literal("cannot_list"),
      v.literal("waitlist_only"),
      v.literal("manual_review"),
    ),
    manualReviewReasonCodes: v.array(v.string()),
    effectiveFrom: v.string(),
    lastVerifiedAt: v.string(),
    verificationSourceUrlOrNote: v.string(),
    createdBy: v.literal("system"),
  })
    .index("by_key", ["sourceRuleKey"])
    .index("by_source_category_version", ["source", "category", "version"]),

  listings: defineTable({
    listingKey: v.string(),
    sellerId: v.string(),
    sourceRuleId: v.string(),
    sourceRuleVersion: v.number(),
    category: v.union(
      v.literal("event_ticket"),
      v.literal("movie_ticket"),
      v.literal("bus_travel"),
      v.literal("watcher"),
      v.literal("future_category"),
    ),
    source: v.union(
      v.literal("bookmyshow"),
      v.literal("district"),
      v.literal("bus_operator"),
      v.literal("other_platform"),
      v.literal("manual_upload"),
    ),
    sourceCategoryKey: v.string(),
    title: v.string(),
    venueOrRoute: v.string(),
    eventOrTripStartAt: v.string(),
    quantity: v.number(),
    faceValue: v.number(),
    listingPrice: v.number(),
    platformFee: v.number(),
    gstOnFee: v.number(),
    totalPayable: v.number(),
    transferMode,
    transferDeadlineAt: v.string(),
    protectionDeadlineAt: v.string(),
    state: listingState,
    ruleDecision,
    duplicateFingerprint: v.string(),
  })
    .index("by_key", ["listingKey"])
    .index("by_state", ["state"])
    .index("by_seller", ["sellerId"]),

  orders: defineTable({
    orderKey: v.string(),
    buyerId: v.string(),
    sellerId: v.string(),
    listingId: v.string(),
    state: orderState,
    mockPaymentStatus: v.union(v.literal("mock_unpaid"), v.literal("mock_paid")),
    mockPaymentSummary: moneySummary,
    transferTaskId: v.string(),
    issueWindowEndsAt: v.string(),
    createdAt: v.string(),
  })
    .index("by_key", ["orderKey"])
    .index("by_buyer", ["buyerId"])
    .index("by_seller", ["sellerId"])
    .index("by_listing", ["listingId"]),

  transfer_tasks: defineTable({
    transferTaskKey: v.string(),
    orderId: v.string(),
    requiredActor: v.literal("seller"),
    state: transferTaskState,
    deadlineAt: v.string(),
    submittedAt: v.optional(v.string()),
    evidenceSummary: v.optional(v.string()),
  })
    .index("by_key", ["transferTaskKey"])
    .index("by_order", ["orderId"]),

  issues: defineTable({
    issueKey: v.string(),
    orderId: v.string(),
    reasonCode: issueReasonCode,
    state: issueState,
    requiredEvidence: v.array(v.string()),
    evidenceItems: v.array(v.string()),
    decision: v.union(v.literal("pending"), v.literal("accepted"), v.literal("rejected")),
  })
    .index("by_key", ["issueKey"])
    .index("by_order", ["orderId"]),

  // Append-only audit log for visible state transitions.
  audit_logs: defineTable({
    actorId: v.string(),
    actorRole,
    action: v.string(),
    entityType: v.union(
      v.literal("listing"),
      v.literal("order"),
      v.literal("transfer_task"),
      v.literal("issue"),
    ),
    entityId: v.string(),
    fromState: v.optional(v.string()),
    toState: v.optional(v.string()),
    seq: v.number(),
    createdAt: v.string(),
  })
    .index("by_entity", ["entityType", "entityId"])
    .index("by_seq", ["seq"]),
});
