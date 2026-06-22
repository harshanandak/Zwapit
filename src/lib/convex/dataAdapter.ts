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
  MockListing,
  MockOrder,
  SellerListingDraft,
  SellerListingSubmissionResult,
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
  type DemoState,
  type ListingFlowView,
  type SellerOrderFlowView,
  type TimelineActionOptions,
  type TimelineActionResult,
} from "../flow/mockFlow";
import { isClerkAuthConfigured } from "../auth/authAdapter";
import { createMockFixture } from "../mock/fixtures";
import { calculateCheckoutTotal } from "../mock/pricing";
import { evaluateSourceRule } from "../rules/evaluateRule";
import { validateCheckout } from "../validation/checkoutValidation";
import { getConvexClient, refreshConvexAuthTokenOnNextRequest } from "./client";
import { functionRefs } from "./functionRefs";

// Client-side phone-verification gate status used by protected buy/sell screens.
// Mirrors the me.astro check: the Convex client carries the Clerk session token,
// so the verified-phone state comes from the identity boundary, never from a
// client-supplied id. When Clerk auth is not configured (local demo), the mock
// user is verified, so protected actions stay open and the mock flow is intact.
export type PhoneGateStatus = "verified" | "required" | "signed_out" | "unknown";

export function accountStepUrl(next: string): string {
  return `/app/me?next=${encodeURIComponent(next)}`;
}

function readSmokePhoneGateStatus(): PhoneGateStatus | null {
  if (typeof window !== "undefined") {
    const smokeWindow = window as typeof window & { __ZWAPIT_UI_SMOKE_PHONE_GATE_STATUS?: PhoneGateStatus };
    if (window.location.hostname === "localhost" && smokeWindow.__ZWAPIT_UI_SMOKE_PHONE_GATE_STATUS === "verified") {
      return "verified";
    }
  }
  return null;
}

export async function resolvePhoneGateStatus(): Promise<PhoneGateStatus> {
  const smokeStatus = readSmokePhoneGateStatus();
  if (smokeStatus) return smokeStatus;
  if (!isClerkAuthConfigured()) return "verified";
  const client = await getConvexClient();
  if (!client) return "unknown";
  try {
    refreshConvexAuthTokenOnNextRequest();
    await client.mutation(functionRefs.syncAppUserFromProvider, {});
    const requirement = (await client.query(functionRefs.getPhoneVerificationRequirement, {})) as
      | { status?: "verified" | "required" }
      | null;
    return requirement?.status === "verified" ? "verified" : "required";
  } catch (error) {
    return error instanceof Error && error.message.includes("AUTH_REQUIRED") ? "signed_out" : "unknown";
  }
}

function replaceVisibleText(element: HTMLElement, label: string): void {
  const textNode = Array.from(element.childNodes).find((node) => node.nodeType === Node.TEXT_NODE);
  if (textNode) {
    textNode.textContent = label;
    return;
  }
  element.textContent = label;
}

// Client helper: when the current user is signed-out or phone-unverified, rewrite
// the matched protected-action link(s) to the account/verify step (preserving the
// `next` intent) and relabel them. Returns the resolved gate status so callers can
// suppress their own protected handlers. A no-op for verified/demo users, so the
// mobile-first flow and mock demo are unchanged. Browser-only.
export async function gateProtectedActionLink(selector: string, next?: string): Promise<PhoneGateStatus> {
  if (typeof document === "undefined") return "unknown";
  const status = await resolvePhoneGateStatus();
  if (status === "verified") return status;
  // Clerk-configured builds fail closed when Convex verification status is
  // unavailable. This keeps navigation-only sell progression behind the same
  // phone-verification step as mutation-backed checkout paths.
  const effectiveStatus: Exclude<PhoneGateStatus, "verified" | "unknown"> = status === "unknown" ? "required" : status;
  const intent = next ?? `${window.location.pathname}${window.location.search}`;
  const label = effectiveStatus === "signed_out" ? "Sign in to continue" : "Verify phone to continue";
  const authState = effectiveStatus === "signed_out" ? "sign_in_required" : "phone_verification_required";
  document.querySelectorAll<HTMLElement>(selector).forEach((element) => {
    if (element instanceof HTMLAnchorElement) element.href = accountStepUrl(intent);
    element.dataset.authState = authState;
    replaceVisibleText(element, label);
  });
  return effectiveStatus;
}

async function syncCurrentUserForGuardedPath(client: Awaited<ReturnType<typeof getConvexClient>>): Promise<void> {
  if (!client || !isClerkAuthConfigured()) return;
  await client.mutation(functionRefs.syncAppUserFromProvider, {});
}

// Seed the demo fixture at most once per process. Many screens call several loaders, and each
// loader used to fire its own (idempotent) seed mutation — /app/profile alone fired two
// (loadRequests + loadReferralSummary). Memoizing the in-flight promise collapses those to a
// single write without changing ordering: every caller still awaits the seed before its query.
// On failure the cache resets so a later loader can retry while the current one falls to mock.
let seedDemoFixturePromise: Promise<unknown> | null = null;
function seedDemoFixtureOnce(client: NonNullable<Awaited<ReturnType<typeof getConvexClient>>>): Promise<unknown> {
  if (!seedDemoFixturePromise) {
    seedDemoFixturePromise = client.mutation(functionRefs.seedDemoFixture, {}).catch((err) => {
      seedDemoFixturePromise = null;
      throw err;
    });
  }
  return seedDemoFixturePromise;
}

async function claimCurrentUserSellerOrder(client: Awaited<ReturnType<typeof getConvexClient>>): Promise<void> {
  if (!client || !isClerkAuthConfigured()) return;
  await syncCurrentUserForGuardedPath(client);
  await client.mutation(functionRefs.claimDemoSellerOrderForCurrentUser, {});
}

function createBaselineDemoState(): DemoState {
  const fixture = createMockFixture();
  return { order: fixture.order, transferTask: fixture.transferTask };
}

function listingStateForDecision(decision: MockListing["ruleDecision"]): MockListing["state"] {
  if (decision === "AUTO_APPROVE") return "live";
  if (decision === "AUTO_BLOCK") return "blocked";
  if (decision === "AUTO_WAITLIST") return "waitlist_only";
  return "under_review";
}

function localSubmittedListingFromDraft(draft: SellerListingDraft): MockListing {
  const fixture = createMockFixture();
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
  const total = calculateCheckoutTotal(draft.listingPrice);

  return {
    ...fixture.listing,
    id: `listing_${fixture.user.id}_${draft.duplicateFingerprint.replace(/[^a-zA-Z0-9]+/g, "_")}`,
    sellerId: fixture.user.id,
    sourceRuleId: evaluation.sourceRuleId,
    sourceRuleVersion: evaluation.sourceRuleVersion,
    category: draft.category,
    source: draft.source,
    sourceCategoryKey: evaluation.rule.sourceCategoryKey,
    title: draft.title,
    venueOrRoute: draft.venueOrRoute,
    eventOrTripStartAt: draft.eventOrTripStartAt,
    quantity: draft.quantity,
    faceValue: draft.faceValue,
    listingPrice: draft.listingPrice,
    platformFee: total.platformFee,
    gstOnFee: total.gstOnPlatformFee,
    totalPayable: total.totalPayable,
    transferMode: evaluation.transferMode,
    transferDeadlineAt: draft.transferDeadlineAt,
    protectionDeadlineAt: draft.protectionDeadlineAt,
    state: listingStateForDecision(evaluation.decision),
    ruleDecision: evaluation.decision,
    duplicateFingerprint: draft.duplicateFingerprint,
  };
}

// ---- Reads ----

// Full demo fixture (same shape as createMockFixture()).
export async function loadFixtureView(): Promise<MockFixture> {
  const local = createMockFixture();
  const client = await getConvexClient();
  if (!client) return local;
  try {
    await seedDemoFixtureOnce(client);
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
    await seedDemoFixtureOnce(client);
    if (isClerkAuthConfigured()) await syncCurrentUserForGuardedPath(client);
    const res = await client.query(
      isClerkAuthConfigured() ? functionRefs.getBuyerOrderForCurrentUser : functionRefs.getBuyerOrder,
      {},
    );
    if (res?.order && res?.transferTask) {
      return { order: res.order, transferTask: res.transferTask };
    }
    if (isClerkAuthConfigured()) return createBaselineDemoState();
    return local;
  } catch {
    if (isClerkAuthConfigured()) return createBaselineDemoState();
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
    await seedDemoFixtureOnce(client);
    if (isClerkAuthConfigured()) await claimCurrentUserSellerOrder(client);
    const rows = await client.query(
      isClerkAuthConfigured() ? functionRefs.getSellerOrdersForCurrentUser : functionRefs.getSellerOrders,
      {},
    );
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
    if (isClerkAuthConfigured()) return connectSellerOrderFlow();
    return base;
  }
}

// The community listings the no-Convex (mock) build must also prerender + resolve, mirroring
// the seed's EXTRA_LISTINGS so /app/listings/<id> and /app/checkout/<id> exist for EVERY
// community listing, not just the demo fixture. Keep in sync with EXTRA_LISTINGS in
// convex/seed.ts.
const MOCK_COMMUNITY_EXTRAS: ReadonlyArray<{
  key: string;
  title: string;
  venueOrRoute: string;
  eventOrTripStartAt: string;
  quantity: number;
  listingPrice: number;
}> = [
  { key: "listing_event_coldplay_1", title: "Coldplay - Music of the Spheres", venueOrRoute: "DY Patil Stadium, Navi Mumbai", eventOrTripStartAt: "2027-01-18T19:30:00+05:30", quantity: 2, listingPrice: 3500 },
  { key: "listing_event_garrix_1", title: "Sunburn Arena ft. Martin Garrix", venueOrRoute: "Phoenix Marketcity, Bengaluru", eventOrTripStartAt: "2026-12-28T18:00:00+05:30", quantity: 1, listingPrice: 2100 },
  { key: "listing_event_zakir_1", title: "Zakir Khan - Tathastu", venueOrRoute: "Shanmukhananda Hall, Mumbai", eventOrTripStartAt: "2026-12-13T20:00:00+05:30", quantity: 2, listingPrice: 1200 },
  { key: "listing_event_ipl_rcb_1", title: "IPL - RCB vs CSK", venueOrRoute: "M. Chinnaswamy Stadium, Bengaluru", eventOrTripStartAt: "2027-04-05T19:30:00+05:30", quantity: 1, listingPrice: 3400 },
];

// Build a mock community listing from the fixture template, mirroring seedExtraListings' field
// math (faceValue = price, platformFee 10, gstOnFee 1.8, totalPayable = price + 11.8, deadlines
// from the start time) so the mock listing matches the seeded Convex row.
function mockExtraListing(fixture: MockListing, extra: (typeof MOCK_COMMUNITY_EXTRAS)[number]): MockListing {
  const startMs = Date.parse(extra.eventOrTripStartAt);
  return {
    ...fixture,
    id: extra.key,
    title: extra.title,
    venueOrRoute: extra.venueOrRoute,
    eventOrTripStartAt: extra.eventOrTripStartAt,
    quantity: extra.quantity,
    faceValue: extra.listingPrice,
    listingPrice: extra.listingPrice,
    platformFee: 10,
    gstOnFee: 1.8,
    totalPayable: extra.listingPrice + 11.8,
    transferDeadlineAt: new Date(startMs - 60 * 60 * 1000).toISOString(),
    protectionDeadlineAt: new Date(startMs + 24 * 60 * 60 * 1000).toISOString(),
    duplicateFingerprint: `${fixture.sourceCategoryKey}:${extra.key}`,
  };
}

// The fixture + the mirrored extras — the single source the no-env community rail and the
// listing-detail/checkout getStaticPaths all draw from.
function mockCommunityListings(): MockListing[] {
  const fixture = connectMockListingFlow().listing;
  return [fixture, ...MOCK_COMMUNITY_EXTRAS.map((extra) => mockExtraListing(fixture, extra))];
}

// No-Convex listing flow for a specific listing: the fixture flow with the requested community
// listing swapped in (evaluation recomputed; checkout/purchasable reused — all demo listings
// share the source rule and are AUTO_APPROVE). No key, the fixture's own key, or an unknown key
// -> the fixture flow unchanged, so the demo/checkout no-arg path stays byte-for-byte identical.
function mockListingFlowView(fixtureFlow: ListingFlowView, listingKey?: string): ListingFlowView {
  if (!listingKey || listingKey === fixtureFlow.listing.id) return fixtureFlow;
  const listing = mockCommunityListings().find((l) => l.id === listingKey);
  if (!listing) return fixtureFlow;
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
  // Re-validate checkout against THIS listing's own fields (deadline/state/total), mirroring the
  // Convex path — not the fixture's — so a future extra with a past deadline or non-live state
  // is correctly non-purchasable rather than inheriting the fixture's ok=true.
  const { sellerPaymentAccount } = createMockFixture();
  const checkout = validateCheckout({
    listing,
    sourceRule: fixtureFlow.sourceRule,
    sellerPaymentAccount,
    buyerEligibilityAcknowledged: true,
    totalShownToBuyer: listing.totalPayable,
    now: new Date().toISOString(),
  });
  return {
    ...fixtureFlow,
    listing,
    evaluation,
    checkout,
    purchasable: checkout.ok && evaluation.decision === "AUTO_APPROVE",
  };
}

// Listing display + checkout readiness (same shape as connectMockListingFlow()).
// `listingKey` selects a specific listing (the detail route passes the :listingId);
// omitted -> the demo listing. Falls back to the mock demo flow when Convex is not
// configured or the listing is missing.
export async function loadListingFlowView(listingKey?: string): Promise<ListingFlowView> {
  const local = connectMockListingFlow();
  const client = await getConvexClient();
  if (!client) return mockListingFlowView(local, listingKey);
  try {
    await seedDemoFixtureOnce(client);
    const res = await client.query(functionRefs.getCheckoutView, listingKey ? { listingKey } : {});
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

// Community resale rail (Home + Listings): the full list of live listings, not
// just the single checkout-flow listing. Convex `getHomeListings` returns every
// `state:"live"` listing; falls back to the single mock listing when Convex is
// not configured or returns nothing. `isLiveResale` filtering stays on the page.
export async function loadCommunityListings(): Promise<MockListing[]> {
  const fallback = mockCommunityListings();
  const client = await getConvexClient();
  if (!client) return fallback;
  try {
    await seedDemoFixtureOnce(client);
    const docs = (await client.query(functionRefs.getHomeListings, {})) as MockListing[] | null;
    // Shape guard: each row must carry a string `id` (the detail-route param). If the
    // query shape ever drifts, fall back rather than emit `undefined` detail links.
    if (!Array.isArray(docs) || docs.length === 0 || typeof docs[0]?.id !== "string") return fallback;
    return docs;
  } catch {
    return fallback;
  }
}

// Official catalog items for the Search "Official" rail. Convex `getOfficialCatalog`
// returns active catalog items; falls back to a single Oppenheimer sample when Convex
// is not configured, the query is empty, or rows lack a string `title` (shape drift).
// Keep this shape in sync with the identical OfficialCatalogItem in convex/catalog.ts
// (the client can't import Convex types across the boundary). Update both together.
export interface OfficialCatalogItem {
  id: string;
  kind: string;
  title: string;
  subtitle: string | null;
  city: string | null;
  venueOrDestination: string | null;
  startAt: string | null;
}

const OPPENHEIMER_FALLBACK: OfficialCatalogItem = {
  id: "catalog_movie_oppenheimer",
  kind: "movie",
  title: "Oppenheimer - IMAX 70mm",
  subtitle: "Re-release · English",
  city: "Bengaluru",
  venueOrDestination: "PVR Orion",
  startAt: null,
};

export async function loadOfficialCatalog(): Promise<OfficialCatalogItem[]> {
  const fallback = [OPPENHEIMER_FALLBACK];
  const client = await getConvexClient();
  if (!client) return fallback;
  try {
    const docs = (await client.query(functionRefs.getOfficialCatalog, {})) as OfficialCatalogItem[] | null;
    if (!Array.isArray(docs) || docs.length === 0 || typeof docs[0]?.title !== "string") return fallback;
    return docs;
  } catch {
    return fallback;
  }
}

// Buyer requests for the Requests screen. Convex `getRequestsForBuyer` returns the
// buyer's wants joined to their catalog item + a real `want_matches` count; falls back
// to the mock request set when Convex is not configured / empty / shape-drifted.
// Keep this shape in sync with `BuyerRequest` in convex/requests.ts.
export interface BuyerRequestView {
  id: string;
  state: "active" | "matched" | "purchased" | "expired";
  category: string;
  title: string;
  venue: string | null;
  startAt: string | null;
  budget: number;
  matchesThisWeek: number;
  matchListingId: string | null;
}

export interface RequestsView {
  requests: BuyerRequestView[];
  activeCount: number;
  quotaTotal: number;
}

const MOCK_REQUESTS: RequestsView = {
  requests: [
    { id: "want_coldplay_1", state: "matched", category: "event_ticket", title: "Coldplay - Music of the Spheres", venue: "DY Patil Stadium", startAt: "2027-01-18T19:30:00+05:30", budget: 4000, matchesThisWeek: 1, matchListingId: "listing_event_coldplay_1" },
    { id: "want_dune_1", state: "active", category: "movie_ticket", title: "Dune: Part Three", venue: "PVR Orion", startAt: "2026-12-21T21:30:00+05:30", budget: 700, matchesThisWeek: 0, matchListingId: null },
    { id: "want_goa_1", state: "active", category: "bus_travel", title: "Bengaluru -> Goa", venue: "Goa", startAt: "2026-12-27T21:00:00+05:30", budget: 1800, matchesThisWeek: 0, matchListingId: null },
    { id: "want_alan_1", state: "expired", category: "event_ticket", title: "Alan Walker - World Tour", venue: "Manpho Convention Centre", startAt: "2027-02-14T19:00:00+05:30", budget: 1500, matchesThisWeek: 0, matchListingId: null },
  ],
  activeCount: 2,
  quotaTotal: 3,
};

export async function loadRequests(): Promise<RequestsView> {
  const client = await getConvexClient();
  if (!client) return MOCK_REQUESTS;
  try {
    await seedDemoFixtureOnce(client);
    const res = (await client.query(functionRefs.getRequestsForBuyer, {})) as RequestsView | null;
    // An empty `requests` array is a valid answer (a buyer with no requests) — only fall
    // back on a missing/shape-drifted response, never on a genuine empty result.
    if (
      !res ||
      !Array.isArray(res.requests) ||
      typeof res.activeCount !== "number" ||
      typeof res.quotaTotal !== "number" ||
      res.requests.some((r) => typeof r?.id !== "string")
    ) {
      return MOCK_REQUESTS;
    }
    return res;
  } catch {
    return MOCK_REQUESTS;
  }
}

// Referral summary for the Profile + Plans screens. Convex `getReferralSummary` returns
// the buyer's invited/verified friend counts; the screens derive the progress bar + reward
// ladder from `verifiedCount`. Keep this shape in sync with `ReferralSummary` in
// convex/referrals.ts. Mirrors the seed so CI (no env) and Convex builds match.
export interface ReferralSummaryView {
  invitedCount: number;
  verifiedCount: number;
}

const MOCK_REFERRAL_SUMMARY: ReferralSummaryView = { invitedCount: 3, verifiedCount: 1 };

export async function loadReferralSummary(): Promise<ReferralSummaryView> {
  const client = await getConvexClient();
  if (!client) return MOCK_REFERRAL_SUMMARY;
  try {
    await seedDemoFixtureOnce(client);
    const res = (await client.query(functionRefs.getReferralSummary, {})) as ReferralSummaryView | null;
    // Zero verified friends is a VALID result (a buyer who hasn't referred anyone) — only
    // fall back on a missing/shape-drifted response, never on a genuine zero/empty count.
    if (!res || typeof res.invitedCount !== "number" || typeof res.verifiedCount !== "number") {
      return MOCK_REFERRAL_SUMMARY;
    }
    return res;
  } catch {
    return MOCK_REFERRAL_SUMMARY;
  }
}

// ---- Mutations (mock-visible flow only) ----

export async function submitSellerListingDraft(
  draft: SellerListingDraft,
): Promise<SellerListingSubmissionResult> {
  const localListing = localSubmittedListingFromDraft(draft);
  if (readSmokePhoneGateStatus() === "verified") {
    return { ok: true, blockers: [], listing: localListing, status: "mock" };
  }
  if (!isClerkAuthConfigured()) return { ok: true, blockers: [], listing: localListing, status: "mock" };

  const client = await getConvexClient();
  if (!client) return { ok: true, blockers: [], listing: localListing, status: "mock" };

  try {
    await seedDemoFixtureOnce(client);
    await syncCurrentUserForGuardedPath(client);
    const result = (await client.mutation(functionRefs.submitSellerListingForCurrentUser, { draft })) as {
      listing: MockListing;
      status: "created" | "updated";
    };
    return { ok: true, blockers: [], listing: result.listing, status: result.status };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("PHONE_VERIFICATION_REQUIRED")) {
      return { ok: false, blockers: ["PHONE_VERIFICATION_REQUIRED"], listing: localListing, status: "blocked" };
    }
    if (message.includes("AUTH_REQUIRED")) {
      return { ok: false, blockers: ["AUTH_REQUIRED"], listing: localListing, status: "blocked" };
    }
    if (message.includes("SELLER_LISTING_INVALID:")) {
      const [, codes = "SELLER_LISTING_INVALID"] = message.split("SELLER_LISTING_INVALID:");
      return {
        ok: false,
        blockers: codes.split(",").filter(Boolean),
        listing: localListing,
        status: "blocked",
      };
    }
    return { ok: false, blockers: ["PERSISTENCE_WRITE_FAILED"], listing: localListing, status: "blocked" };
  }
}

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
    const usedSellerScopedMutation =
      useGuardedMutations && options.actorRole === "seller" && state.order.state === "transfer_pending";
    await syncCurrentUserForGuardedPath(client);
    let advanced;
    if (usedSellerScopedMutation) {
      await claimCurrentUserSellerOrder(client);
      advanced = await client.mutation(functionRefs.sellerSubmitTransferForCurrentUser, {
        submittedAt: options.submittedAt,
      });
    } else if (useGuardedMutations) {
      advanced = await client.mutation(functionRefs.advanceTimelineForCurrentUser, {});
    } else if (options.actorRole === "seller" && state.order.state === "transfer_pending") {
      advanced = await client.mutation(functionRefs.sellerSubmitTransfer, {
        submittedAt: options.submittedAt,
        actorRole: options.actorRole,
      });
    } else {
      advanced = await client.mutation(functionRefs.advanceTimeline, {
        submittedAt: options.submittedAt,
        actorRole: options.actorRole,
      });
    }
    const sellerRows = usedSellerScopedMutation ? await client.query(functionRefs.getSellerOrdersForCurrentUser, {}) : null;
    const sellerRes = Array.isArray(sellerRows)
      ? sellerRows.find((row) => row.order.id === state.order.id) ?? null
      : null;
    const buyerRes = usedSellerScopedMutation
      ? null
      : await client.query(
          useGuardedMutations ? functionRefs.getBuyerOrderForCurrentUser : functionRefs.getBuyerOrder,
          {},
        );
    const result = {
      order: ((sellerRes?.order ?? buyerRes?.order) ?? state.order) as MockOrder,
      transferTask: (sellerRes?.transferTask ?? buyerRes?.transferTask) ?? state.transferTask,
      action: advanced?.action ?? "none",
      terminal: (advanced?.action ?? "none") === "none",
    };
    saveDemoState({ order: result.order, transferTask: result.transferTask });
    return result;
  } catch (error) {
    throw error instanceof Error ? error : new Error("Convex timeline advance failed");
  }
}

// Result of the guarded checkout execution. Widens CheckoutFlowResult's blockers
// to also carry the phone-verification/auth gate reasons surfaced by the Convex
// identity boundary, so the UI can show a clear message instead of an opaque
// persistence failure.
export interface GuardedCheckoutResult {
  ok: boolean;
  blockers: string[];
  order: MockOrder;
}

// Validate + mock-pay checkout (same shape as connectMockCheckoutFlow()).
export async function runMockCheckout(
  order: MockOrder,
  options: CheckoutFlowOptions = {},
): Promise<GuardedCheckoutResult> {
  // Validation stays local (pure); it produces the same blockers as today.
  const local = connectMockCheckoutFlow(order, options);
  const client = await getConvexClient();
  if (!client || !local.ok) return local;
  try {
    await seedDemoFixtureOnce(client);
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
    const res = await client.query(
      isClerkAuthConfigured() ? functionRefs.getBuyerOrderForCurrentUser : functionRefs.getBuyerOrder,
      {},
    );
    return { ok: true, blockers: [], order: (res?.order ?? local.order) as MockOrder };
  } catch (error) {
    // The guarded mutation rejects unverified/signed-out buyers at the identity
    // boundary. Surface that as a clear gate blocker rather than an opaque write
    // failure so the UI can route the buyer to phone verification.
    const message = error instanceof Error ? error.message : "";
    if (message.includes("PHONE_VERIFICATION_REQUIRED")) {
      return { ok: false, blockers: ["PHONE_VERIFICATION_REQUIRED"], order };
    }
    if (message.includes("AUTH_REQUIRED")) {
      return { ok: false, blockers: ["AUTH_REQUIRED"], order };
    }
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
    await seedDemoFixtureOnce(client);
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
