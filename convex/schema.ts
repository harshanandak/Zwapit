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
// Scope: persistence for the accepted first visible mock flow, plus the
// demand-first wants groundwork (catalog_items, wants, want_matches — decision
// 2026-06-12). No real auth, payment, payout, refund, admin, or
// category-expansion tables.

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

// ---- Demand-first wants groundwork (CLAUDE.md "Demand-First Wants") ----

const catalogKind = v.union(
  v.literal("movie"),
  v.literal("live_event"),
  v.literal("bus_route"),
);

const catalogSource = v.union(
  v.literal("tmdb"),
  v.literal("manual"),
  v.literal("google_places"),
  v.literal("user_submission"),
  v.literal("bookmyshow"),
  v.literal("district"),
);

const wantState = v.union(
  v.literal("open"),
  v.literal("matched"),
  v.literal("reserved"),
  v.literal("fulfilled"),
  v.literal("expired"),
  v.literal("cancelled"),
);

const wantMatchState = v.union(
  v.literal("proposed"),
  v.literal("reserved"),
  v.literal("accepted"),
  v.literal("declined"),
  v.literal("expired"),
);

// ---- Official-availability watcher (design 2026-06-22) ----
// Internal table/value names ("monitor_target", source "bms"/"district") never
// surface to users; user-facing copy uses approved terms ("Tickets are live").

// "curated" = admin/manually-marked availability (events with no pollable source);
// such targets carry sources: [] and are never touched by pollDueTargets.
const watcherSource = v.union(
  v.literal("bms"),
  v.literal("district"),
  v.literal("curated"),
);

const monitorTargetStatus = v.union(
  v.literal("watching"),
  v.literal("live"),
  v.literal("closed"),
  v.literal("degraded"),
);

// Alert types are captured now; only "availability" + "last_minute" are
// delivered in this slice (design §Out of scope).
const alertType = v.union(
  v.literal("availability"),
  v.literal("discount"),
  v.literal("price_drop"),
  v.literal("last_minute"),
);

// Email + Web Push only this slice; WhatsApp/Telegram deferred (DLT compliance).
const channel = v.union(v.literal("email"), v.literal("web_push"));

// "sending" is the in-flight claim state: a dispatch wave flips pending → sending
// atomically before calling the sender, so overlapping waves can't double-send.
const notificationStatus = v.union(
  v.literal("pending"),
  v.literal("sending"),
  v.literal("sent"),
  v.literal("failed"),
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
    // Canonical catalog reference. Optional for existing manual-upload listings;
    // required by the matching engine — a listing without it never matches a Want.
    catalogItemId: v.optional(v.string()),
  })
    .index("by_key", ["listingKey"])
    .index("by_state", ["state"])
    .index("by_seller", ["sellerId"])
    .index("by_catalog_item", ["catalogItemId", "state"]),

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

  // Canonical catalog of things people can want or list: movies (TMDB), live
  // events (curated/manual), bus routes (curated, Google Places-assisted).
  // Wants and listings both point here so matching is exact, never free-text.
  catalog_items: defineTable({
    catalogKey: v.string(),
    kind: catalogKind,
    externalSource: catalogSource,
    externalId: v.optional(v.string()),
    title: v.string(),
    // movie: language/format · event: artist or organiser · bus: operator
    subtitle: v.optional(v.string()),
    city: v.optional(v.string()),
    // event venue, or bus destination; origin lives in `city` for bus routes
    venueOrDestination: v.optional(v.string()),
    startAt: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    isActive: v.boolean(),
    lastSyncedAt: v.string(),
    // Official-availability watcher source codes (additive, optional — design
    // 2026-06-22 §Approach). A movie row carries its BMS event/region + District
    // MV/city-slug; a venue-kind row carries bmsVenueCode/districtCdCode. Some
    // rows carry both sources' codes, some one (platform-routing / D5 union).
    bmsEventCode: v.optional(v.string()),
    bmsRegionCode: v.optional(v.string()),
    bmsVenueCode: v.optional(v.string()),
    districtMvCode: v.optional(v.string()),
    districtCdCode: v.optional(v.string()),
    districtCitySlug: v.optional(v.string()),
    // District EVENT detail-page slug (probed 2026-08-21 — events-phase2
    // decisions.md). Event slugs embed date/id suffixes and are not derivable
    // from the title, so the row stores the exact slug for the events URL.
    districtEventSlug: v.optional(v.string()),
    lat: v.optional(v.number()),
    long: v.optional(v.number()),
    // Source sitemap <lastmod> for incremental crawl diffs (skip unchanged entities next run, from #34).
    sourceLastmod: v.optional(v.string()),
  })
    .index("by_key", ["catalogKey"])
    .index("by_kind_active", ["kind", "isActive"])
    .index("by_external", ["externalSource", "externalId"]),

  // Buyer demand posted before (or independent of) supply. Matching engine
  // pairs open wants with live listings on the same catalog item, FIFO by
  // creation time, within quantity and max-price fit.
  wants: defineTable({
    wantKey: v.string(),
    buyerId: v.string(),
    catalogItemId: v.string(),
    // Catalog-backed categories only. Every Want has a mandatory catalogItemId,
    // and catalog_items.kind covers movie/live_event/bus_route — so watcher /
    // future_category (which have no catalog kind) are not valid Want categories.
    category: v.union(
      v.literal("event_ticket"),
      v.literal("movie_ticket"),
      v.literal("bus_travel"),
    ),
    // quantity must be a positive integer and maxPricePerUnit non-negative;
    // createdAt/expiresAt must be ISO-8601. Convex validators have no numeric or
    // string-format bounds, so these are enforced at mutation time (F2/B2).
    quantity: v.number(),
    maxPricePerUnit: v.number(),
    state: wantState,
    expiresAt: v.string(),
    createdAt: v.string(),
    // Official-availability watcher alert prefs (additive, optional — design
    // 2026-06-22 §Approach). `wants` IS the request/alert object; we add the
    // watch dimensions + alert prefs without renaming the table. Only
    // "availability" + "last_minute" are delivered in this slice; "discount" /
    // "price_drop" are captured now, delivered later.
    watchCity: v.optional(v.string()),
    watchDate: v.optional(v.string()),
    watchFormat: v.optional(v.string()),
    alertTypes: v.optional(v.array(alertType)),
    channels: v.optional(v.array(channel)),
    // Internal app id of the shared monitor_targets row this alert subscribes to.
    monitorTargetId: v.optional(v.string()),
    // Exact collapse key (kernel 47f4dfb8): the sanitized wantKey is lossy
    // (-/_ collide), so the raw key disambiguates resubscribe lookups.
    collapseKey: v.optional(v.string()),
  })
    .index("by_key", ["wantKey"])
    .index("by_buyer", ["buyerId"])
    .index("by_catalog_state", ["catalogItemId", "state"])
    .index("by_state_created", ["state", "createdAt"])
    // Expiry sweep: open wants ordered by expiresAt so the expiry cron scans only
    // past-due rows (soonest-expiring first), never a creation-ordered prefix that
    // could starve later-created expired alerts.
    .index("by_state_expires", ["state", "expiresAt"])
    .index("by_monitor_target", ["monitorTargetId"]),

  // One proposed pairing of a want and a listing. `reservedUntil` bounds the
  // matched buyer's exclusive window before the listing reopens to everyone.
  want_matches: defineTable({
    matchKey: v.string(),
    wantId: v.string(),
    listingId: v.string(),
    state: wantMatchState,
    allocationRank: v.number(),
    reservedUntil: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index("by_key", ["matchKey"])
    .index("by_want", ["wantId"])
    .index("by_listing", ["listingId"])
    // Pairwise lookup for idempotent match creation/dedup under concurrent workers.
    .index("by_want_listing", ["wantId", "listingId"])
    .index("by_state", ["state"]),

  // Friend referrals. Rewards (the alert-wave ladder) unlock only on VERIFIED
  // friends, never on installs/invites (CLAUDE.md) — so state distinguishes an
  // invited friend from one who completed a verified action. Read-only in v1;
  // invite/verify are not client mutations.
  referrals: defineTable({
    referralKey: v.string(),
    referrerId: v.string(),
    state: v.union(v.literal("invited"), v.literal("verified")),
    invitedAt: v.string(),
    verifiedAt: v.optional(v.string()),
  })
    .index("by_key", ["referralKey"])
    .index("by_referrer", ["referrerId"]),

  // ---- Official-availability watcher engine (design 2026-06-22) ----

  // One shared watcher per exact show (movie + city + date [+ format]). Many
  // requests on the same show collapse to ONE row via collapseKey, so the cron
  // polls once and notifies every subscriber. Internal-only; never client-set.
  // collapseKey = catalogItemId|city|date|format.
  monitor_targets: defineTable({
    collapseKey: v.string(),
    catalogItemId: v.string(),
    city: v.string(),
    date: v.string(),
    format: v.optional(v.string()),
    // Only the sources whose catalog codes exist (platform-routing).
    sources: v.array(watcherSource),
    status: monitorTargetStatus,
    // Narrow normalized-field hash of the last poll, to suppress false fires.
    lastSnapshotHash: v.optional(v.string()),
    subscriberCount: v.number(),
    // Consecutive empty/blocked polls; K in a row → degraded.
    failCount: v.optional(v.number()),
    windowStart: v.optional(v.string()),
    windowEnd: v.optional(v.string()),
    lastCheckedAt: v.optional(v.string()),
    nextCheckAt: v.optional(v.string()),
    // Earliest ticket-sale-open instant parsed from a District sales timeline
    // (kernel 9b317bb9). Read only in the watching clean-reschedule branch —
    // live/closed/degraded targets never consult it, so no invalidation paths.
    saleOpensAt: v.optional(v.string()),
  })
    .index("by_collapse_key", ["collapseKey"])
    .index("by_status_next_check", ["status", "nextCheckAt"]),

  // One row per detected booking-open snapshot for a target. theatresJson holds
  // the normalized theatre/showtime list; bookingUrl is the official deep-link
  // OUT (Zwapit never books or holds inventory).
  availability_events: defineTable({
    monitorTargetId: v.string(),
    source: watcherSource,
    detectedAt: v.string(),
    theatresJson: v.string(),
    bookingUrl: v.string(),
    snapshotHash: v.string(),
  }).index("by_target", ["monitorTargetId"]),

  // Fire-once notification outbox. Idempotent on dedupeKey =
  // userId|monitorTargetId|availabilityEventId|alertType|channel.
  notification_queue: defineTable({
    userId: v.string(),
    monitorTargetId: v.string(),
    availabilityEventId: v.string(),
    alertType,
    channel,
    status: notificationStatus,
    dedupeKey: v.string(),
    createdAt: v.string(),
    sentAt: v.optional(v.string()),
    // Delivery attempts so far; a failed send requeues to "pending" until this
    // reaches the cap, then parks as "failed" (no infinite retry).
    attempts: v.optional(v.number()),
    // When the current "sending" claim was taken. A dispatch wave reclaims a
    // "sending" row whose claim is older than the lease (the prior wave died
    // before mark/fail), so a crash can't strand a notification forever.
    claimedAt: v.optional(v.string()),
  })
    .index("by_dedupe", ["dedupeKey"])
    .index("by_status", ["status"]),

  // Adapter read cache: last snapshot hash per (target, source) so an unchanged
  // poll is a no-op (no duplicate availability_events / notifications).
  source_snapshots: defineTable({
    monitorTargetId: v.string(),
    source: watcherSource,
    snapshotHash: v.string(),
    fetchedAt: v.string(),
  }).index("by_target_source", ["monitorTargetId", "source"]),

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
      v.literal("want"),
      v.literal("want_match"),
      // Official-availability watcher (design 2026-06-22).
      v.literal("monitor_target"),
      v.literal("availability_event"),
      v.literal("notification"),
    ),
    entityId: v.string(),
    fromState: v.optional(v.string()),
    toState: v.optional(v.string()),
    seq: v.number(),
    createdAt: v.string(),
  })
    .index("by_entity", ["entityType", "entityId"])
    .index("by_entity_action", ["entityType", "entityId", "action"])
    .index("by_seq", ["seq"]),
});
