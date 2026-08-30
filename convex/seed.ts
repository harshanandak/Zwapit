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
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { createMockFixture } from "../src/lib/mock/fixtures";
import { buildAlertWantKey, collapseKeyForWant, computeCollapseKey } from "./watcher/parse";
import { monitorTargetByCollapseKey } from "./model";

type FixtureListing = ReturnType<typeof createMockFixture>["listing"];

// Demo breadth for the Home/Listings rails: extra live community listings beyond the
// order-flow fixture. All reuse the seeded BookMyShow event rule (AUTO_APPROVE,
// OFFICIAL_TRANSFER); none carries a verified original price, so each renders as
// "Seller price" (discount-integrity).
const EXTRA_LISTINGS: ReadonlyArray<{
  key: string;
  title: string;
  venueOrRoute: string;
  eventOrTripStartAt: string;
  quantity: number;
  listingPrice: number;
  catalogItemId?: string;
}> = [
  { key: "listing_event_coldplay_1", title: "Coldplay - Music of the Spheres", venueOrRoute: "DY Patil Stadium, Navi Mumbai", eventOrTripStartAt: "2027-01-18T19:30:00+05:30", quantity: 2, listingPrice: 3500, catalogItemId: "catalog_event_coldplay" },
  { key: "listing_event_garrix_1", title: "Sunburn Arena ft. Martin Garrix", venueOrRoute: "Phoenix Marketcity, Bengaluru", eventOrTripStartAt: "2026-12-28T18:00:00+05:30", quantity: 1, listingPrice: 2100 },
  { key: "listing_event_zakir_1", title: "Zakir Khan - Tathastu", venueOrRoute: "Shanmukhananda Hall, Mumbai", eventOrTripStartAt: "2026-12-13T20:00:00+05:30", quantity: 2, listingPrice: 1200 },
  { key: "listing_event_ipl_rcb_1", title: "IPL - RCB vs CSK", venueOrRoute: "M. Chinnaswamy Stadium, Bengaluru", eventOrTripStartAt: "2027-04-05T19:30:00+05:30", quantity: 1, listingPrice: 3400 },
];

// Insert the extra community listings idempotently (by listingKey), reusing the demo
// listing's source rule + seller. Returns true if any were created. Extracted from the
// seed handler to keep its cognitive complexity within bounds.
async function seedExtraListings(ctx: MutationCtx, base: FixtureListing): Promise<boolean> {
  let created = false;
  for (const extra of EXTRA_LISTINGS) {
    const existing = await ctx.db
      .query("listings")
      .withIndex("by_key", (q) => q.eq("listingKey", extra.key))
      .unique();
    if (existing) {
      // Backfill catalogItemId onto a row seeded before this field existed (idempotent),
      // so the want<->listing match stays genuinely catalogItemId-backed on older deployments.
      if (extra.catalogItemId && !existing.catalogItemId) {
        await ctx.db.patch(existing._id, { catalogItemId: extra.catalogItemId });
      }
      continue;
    }
    created = true;
    const startMs = Date.parse(extra.eventOrTripStartAt);
    await ctx.db.insert("listings", {
      listingKey: extra.key,
      ...(extra.catalogItemId ? { catalogItemId: extra.catalogItemId } : {}),
      sellerId: base.sellerId,
      sourceRuleId: base.sourceRuleId,
      sourceRuleVersion: base.sourceRuleVersion,
      category: base.category,
      source: base.source,
      sourceCategoryKey: base.sourceCategoryKey,
      title: extra.title,
      venueOrRoute: extra.venueOrRoute,
      eventOrTripStartAt: extra.eventOrTripStartAt,
      quantity: extra.quantity,
      faceValue: extra.listingPrice,
      listingPrice: extra.listingPrice,
      platformFee: 10,
      gstOnFee: 1.8,
      totalPayable: extra.listingPrice + 10 + 1.8, // listingPrice + platformFee (10) + GST (1.8)
      transferMode: base.transferMode,
      transferDeadlineAt: new Date(startMs - 60 * 60 * 1000).toISOString(),
      protectionDeadlineAt: new Date(startMs + 24 * 60 * 60 * 1000).toISOString(),
      state: "live",
      ruleDecision: base.ruleDecision,
      duplicateFingerprint: `${base.sourceCategoryKey}:${extra.key}`,
    });
  }
  return created;
}

// Official catalog items for the Search "Official" results (and, later, Want
// references). Idempotent by catalogKey. Sources per CLAUDE.md: TMDB for movies,
// manual for curated events / bus routes.
const SEED_SYNCED_AT = "2026-06-20T00:00:00.000Z";
const CATALOG_ITEMS: ReadonlyArray<{
  key: string;
  kind: "movie" | "live_event" | "bus_route";
  externalSource: "tmdb" | "manual";
  title: string;
  subtitle: string;
  city: string;
  venueOrDestination: string;
  startAt: string;
}> = [
  { key: "catalog_movie_oppenheimer", kind: "movie", externalSource: "tmdb", title: "Oppenheimer - IMAX 70mm", subtitle: "Re-release · English", city: "Bengaluru", venueOrDestination: "PVR Orion", startAt: "2026-12-20T18:30:00+05:30" },
  { key: "catalog_event_alan_walker", kind: "live_event", externalSource: "manual", title: "Alan Walker - World Tour", subtitle: "Electronic", city: "Bengaluru", venueOrDestination: "Manpho Convention Centre", startAt: "2027-02-14T19:00:00+05:30" },
  { key: "catalog_bus_blr_goa", kind: "bus_route", externalSource: "manual", title: "Bengaluru -> Goa", subtitle: "Sleeper · overnight", city: "Bengaluru", venueOrDestination: "Goa", startAt: "2026-12-27T21:00:00+05:30" },
  { key: "catalog_event_coldplay", kind: "live_event", externalSource: "manual", title: "Coldplay - Music of the Spheres", subtitle: "Rock", city: "Navi Mumbai", venueOrDestination: "DY Patil Stadium", startAt: "2027-01-18T19:30:00+05:30" },
  { key: "catalog_movie_dune", kind: "movie", externalSource: "tmdb", title: "Dune: Part Three", subtitle: "IMAX · English", city: "Bengaluru", venueOrDestination: "PVR Orion", startAt: "2026-12-21T21:30:00+05:30" },
];

// Insert the official catalog items idempotently (by catalogKey). Returns nothing —
// called as a bare statement from the handler so it adds no branch (keeps the seed
// handler's cognitive complexity within bounds; see seedExtraListings).
async function seedCatalogItems(ctx: MutationCtx): Promise<void> {
  for (const item of CATALOG_ITEMS) {
    const existing = await ctx.db
      .query("catalog_items")
      .withIndex("by_key", (q) => q.eq("catalogKey", item.key))
      .unique();
    if (existing) continue;
    await ctx.db.insert("catalog_items", {
      catalogKey: item.key,
      kind: item.kind,
      externalSource: item.externalSource,
      title: item.title,
      subtitle: item.subtitle,
      city: item.city,
      venueOrDestination: item.venueOrDestination,
      startAt: item.startAt,
      isActive: true,
      lastSyncedAt: SEED_SYNCED_AT,
    });
  }
}

// Demo buyer requests (wants) for user_demo_1, referencing the seeded catalog items.
// Idempotent by wantKey. wantState -> UI state is mapped in convex/requests.ts.
const DEMO_BUYER_ID = "user_demo_1";
const WANTS: ReadonlyArray<{
  key: string;
  catalogItemId: string;
  category: "event_ticket" | "movie_ticket" | "bus_travel";
  quantity: number;
  maxPricePerUnit: number;
  state: "open" | "matched" | "reserved" | "fulfilled" | "expired" | "cancelled";
  expiresAt: string;
  createdAt: string;
}> = [
  { key: "want_coldplay_1", catalogItemId: "catalog_event_coldplay", category: "event_ticket", quantity: 2, maxPricePerUnit: 4000, state: "matched", expiresAt: "2027-01-17T23:59:00+05:30", createdAt: "2026-06-10T09:00:00+05:30" },
  { key: "want_dune_1", catalogItemId: "catalog_movie_dune", category: "movie_ticket", quantity: 2, maxPricePerUnit: 700, state: "open", expiresAt: "2026-12-20T23:59:00+05:30", createdAt: "2026-06-12T10:00:00+05:30" },
  { key: "want_goa_1", catalogItemId: "catalog_bus_blr_goa", category: "bus_travel", quantity: 1, maxPricePerUnit: 1800, state: "open", expiresAt: "2026-12-26T23:59:00+05:30", createdAt: "2026-06-14T11:00:00+05:30" },
  { key: "want_alan_1", catalogItemId: "catalog_event_alan_walker", category: "event_ticket", quantity: 1, maxPricePerUnit: 1500, state: "expired", expiresAt: "2026-06-01T23:59:00+05:30", createdAt: "2026-05-20T12:00:00+05:30" },
];

// Bare-called from the handler (no branch -> no S3776 regrowth).
async function seedWants(ctx: MutationCtx): Promise<void> {
  for (const w of WANTS) {
    const existing = await ctx.db.query("wants").withIndex("by_key", (q) => q.eq("wantKey", w.key)).unique();
    if (existing) continue;
    await ctx.db.insert("wants", {
      wantKey: w.key,
      buyerId: DEMO_BUYER_ID,
      catalogItemId: w.catalogItemId,
      category: w.category,
      quantity: w.quantity,
      maxPricePerUnit: w.maxPricePerUnit,
      state: w.state,
      expiresAt: w.expiresAt,
      createdAt: w.createdAt,
    });
  }
}

// One catalogItemId-backed match: the Coldplay want <-> the Coldplay community listing
// (both on catalog_event_coldplay). Idempotent by matchKey.
const WANT_MATCHES: ReadonlyArray<{ key: string; wantId: string; listingId: string }> = [
  { key: "want_match_coldplay_1", wantId: "want_coldplay_1", listingId: "listing_event_coldplay_1" },
];

async function seedWantMatches(ctx: MutationCtx): Promise<void> {
  for (const m of WANT_MATCHES) {
    const existing = await ctx.db.query("want_matches").withIndex("by_key", (q) => q.eq("matchKey", m.key)).unique();
    if (existing) continue;
    await ctx.db.insert("want_matches", {
      matchKey: m.key,
      wantId: m.wantId,
      listingId: m.listingId,
      state: "proposed",
      allocationRank: 1,
      createdAt: SEED_SYNCED_AT,
    });
  }
}

// Demo referrals for user_demo_1: 1 verified + 2 invited -> verifiedCount 1 (keeps the
// reward ladder render identical to the prior hardcoded value) while exercising the
// invited<->verified distinction. Rewards unlock on verified only (CLAUDE.md). Idempotent
// by referralKey. Bare-called from the handler (no branch -> no S3776 regrowth).
const REFERRALS: ReadonlyArray<{
  key: string;
  state: "invited" | "verified";
  invitedAt: string;
  verifiedAt?: string;
}> = [
  { key: "referral_demo_1", state: "verified", invitedAt: "2026-06-05T10:00:00+05:30", verifiedAt: "2026-06-07T18:30:00+05:30" },
  { key: "referral_demo_2", state: "invited", invitedAt: "2026-06-12T09:00:00+05:30" },
  { key: "referral_demo_3", state: "invited", invitedAt: "2026-06-18T20:00:00+05:30" },
];

async function seedReferrals(ctx: MutationCtx): Promise<void> {
  for (const r of REFERRALS) {
    const existing = await ctx.db.query("referrals").withIndex("by_key", (q) => q.eq("referralKey", r.key)).unique();
    if (existing) continue;
    await ctx.db.insert("referrals", {
      referralKey: r.key,
      referrerId: DEMO_BUYER_ID,
      state: r.state,
      invitedAt: r.invitedAt,
      ...(r.verifiedAt ? { verifiedAt: r.verifiedAt } : {}),
    });
  }
}

// ---- Official-availability watcher demo fixture (design 2026-06-22) ----
//
// Seeds ONE end-to-end watcher slice the demo can read: a movie catalog row that
// carries BOTH BMS codes (event/region/venue) AND District codes (MV/CD/city
// slug), the shared monitor_targets row that an alert collapses onto, and ONE
// linked alert (a `wants` row). createAlert is a CLIENT mutation and a mutation
// cannot call another mutation, so this replicates its internals via the model
// helpers + direct inserts. Idempotent at every step (catalogKey / collapseKey /
// wantKey), and subscriberCount is incremented ONLY on the first want insert.
const WATCHER_DEMO = {
  catalogKey: "catalog_movie_watcher_demo",
  title: "Avatar: Fire and Ash",
  city: "mumbai",
  date: "2026-12-19",
  format: "IMAX 3D",
  // BMS codes (event+region drive byevent; venue drives byvenue — both present).
  bmsEventCode: "ET00377019",
  bmsRegionCode: "MUMBAI",
  bmsVenueCode: "BMSV-DEMO",
  // District codes (MV + CD + city slug).
  districtMvCode: "MV99001",
  districtCdCode: "CD4501",
  districtCitySlug: "mumbai",
  buyerId: DEMO_BUYER_ID,
} as const;

// Bare-called from the handler (no branch -> no S3776 regrowth). Replicates the
// createAlert internals: catalog row -> shared monitor target (find-or-create on
// collapseKey) -> linked alert want (find-or-create on wantKey).
async function seedWatcherDemo(ctx: MutationCtx): Promise<boolean> {
  let inserted = false;
  // 1. Catalog movie carrying BOTH sources' codes. Idempotent by catalogKey.
  const existingCatalog = await ctx.db
    .query("catalog_items")
    .withIndex("by_key", (q) => q.eq("catalogKey", WATCHER_DEMO.catalogKey))
    .unique();
  if (!existingCatalog) {
    inserted = true;
    await ctx.db.insert("catalog_items", {
      catalogKey: WATCHER_DEMO.catalogKey,
      kind: "movie",
      externalSource: "tmdb",
      title: WATCHER_DEMO.title,
      isActive: true,
      lastSyncedAt: SEED_SYNCED_AT,
      bmsEventCode: WATCHER_DEMO.bmsEventCode,
      bmsRegionCode: WATCHER_DEMO.bmsRegionCode,
      bmsVenueCode: WATCHER_DEMO.bmsVenueCode,
      districtMvCode: WATCHER_DEMO.districtMvCode,
      districtCdCode: WATCHER_DEMO.districtCdCode,
      districtCitySlug: WATCHER_DEMO.districtCitySlug,
    });
  }

  // 2. Shared monitor target, find-or-create on the exact collapseKey.
  const collapseKey = computeCollapseKey({
    catalogItemId: WATCHER_DEMO.catalogKey,
    city: WATCHER_DEMO.city,
    date: WATCHER_DEMO.date,
    format: WATCHER_DEMO.format,
  });
  let target = await monitorTargetByCollapseKey(ctx, collapseKey);
  if (!target) {
    const targetId = await ctx.db.insert("monitor_targets", {
      collapseKey,
      catalogItemId: WATCHER_DEMO.catalogKey,
      city: WATCHER_DEMO.city,
      date: WATCHER_DEMO.date,
      format: WATCHER_DEMO.format,
      sources: ["bms", "district"],
      status: "watching",
      subscriberCount: 0,
      failCount: 0,
      nextCheckAt: SEED_SYNCED_AT,
    });
    target = (await ctx.db.get(targetId))!;
  }

  // 3. One linked alert (`wants` row). Exact occurrence fallback preserves
  // idempotency for demo rows created under older public-key formats.
  const wantKey = buildAlertWantKey(WATCHER_DEMO.buyerId, collapseKey);
  let existingWant = await ctx.db
    .query("wants")
    .withIndex("by_key", (q) => q.eq("wantKey", wantKey))
    .first();
  if (!existingWant) {
    const buyerWants = await ctx.db
      .query("wants")
      .withIndex("by_buyer", (q) => q.eq("buyerId", WATCHER_DEMO.buyerId))
      .order("asc")
      .collect();
    // Detached matches still count as existing: this public loader seed must
    // never rearm a request or re-deliver an alert on the buyer's behalf.
    existingWant = buyerWants.find((want) => collapseKeyForWant(want) === collapseKey) ?? null;
  }
  if (!existingWant) {
    inserted = true;
    await ctx.db.insert("wants", {
      wantKey,
      buyerId: WATCHER_DEMO.buyerId,
      catalogItemId: WATCHER_DEMO.catalogKey,
      category: "movie_ticket",
      quantity: 1,
      maxPricePerUnit: 0,
      state: "open",
      expiresAt: WATCHER_DEMO.date,
      createdAt: SEED_SYNCED_AT,
      watchCity: WATCHER_DEMO.city,
      watchDate: WATCHER_DEMO.date,
      watchFormat: WATCHER_DEMO.format,
      alertTypes: ["availability"],
      channels: ["email"],
      monitorTargetId: target._id,
      collapseKey,
    });
    await ctx.db.patch(target._id, { subscriberCount: target.subscriberCount + 1 });
  }
  return inserted;
}

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

    // Additional live community listings (demo breadth for the Home/Listings rails).
    if (await seedExtraListings(ctx, listing)) created = true;

    // Official catalog items for Search (bare call — an extra `if` branch would re-trip S3776).
    await seedCatalogItems(ctx);
    await seedWants(ctx);
    await seedWantMatches(ctx);
    await seedReferrals(ctx);
    created = (await seedWatcherDemo(ctx)) || created;

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
