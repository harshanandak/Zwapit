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
    await client.mutation(functionRefs.seedDemoFixture, {});
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
    await client.mutation(functionRefs.seedDemoFixture, {});
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
