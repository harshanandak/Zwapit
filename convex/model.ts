// Internal Convex helpers (NOT public functions).
//
// These map Convex documents to the existing local `Mock*` shapes, run the
// SAME pure state-transition helpers that the local mock flow uses
// (src/lib/state/*), persist the result, and append an audit-log entry. Reusing
// the existing pure helpers keeps the Convex order/transfer/issue state machine
// identical to the local one — no transition logic is re-implemented here.

import type { MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import type {
  AuditEvent,
  MockIssue,
  MockListing,
  MockOrder,
  MockTransferTask,
  SourceRule,
} from "../src/lib/types";
import {
  buyerConfirmReceived,
  buyerReportIssue as buyerReportIssueTransition,
  completeAfterWindow,
  mockPay,
  openProtectionWindow,
  sellerMarkTransferred,
} from "../src/lib/state/orderTransitions";
import { markListingSold } from "../src/lib/state/listingTransitions";

// Mock clocks — kept identical to src/lib/flow/mockFlow.ts so the persisted
// Convex flow reaches the same visible states as the local demo. Today is in
// 2026 and the fixture deadlines are in Dec 2026, so a submit time before the
// transfer deadline and a completion time after the protection window let the
// happy path reach `completed` deterministically (no wall-clock dependency).
export const NOW_BEFORE_DEADLINE = "2026-05-29T12:00:00+05:30";
export const NOW_AFTER_PROTECTION_WINDOW = "2026-12-22T12:00:00+05:30";
const SELLER_EVIDENCE = "Transferred via the official platform (demo)";

// ---- Document <-> Mock shape mappers ----

export function orderDocToMock(doc: Doc<"orders">): MockOrder {
  return {
    id: doc.orderKey,
    buyerId: doc.buyerId,
    sellerId: doc.sellerId,
    listingId: doc.listingId,
    state: doc.state,
    mockPaymentStatus: doc.mockPaymentStatus,
    mockPaymentSummary: doc.mockPaymentSummary,
    transferTaskId: doc.transferTaskId,
    issueWindowEndsAt: doc.issueWindowEndsAt,
    createdAt: doc.createdAt,
  };
}

export function transferDocToMock(doc: Doc<"transfer_tasks">): MockTransferTask {
  return {
    id: doc.transferTaskKey,
    orderId: doc.orderId,
    requiredActor: doc.requiredActor,
    state: doc.state,
    deadlineAt: doc.deadlineAt,
    submittedAt: doc.submittedAt,
    evidenceSummary: doc.evidenceSummary,
  };
}

export function listingDocToMock(doc: Doc<"listings">): MockListing {
  return {
    id: doc.listingKey,
    sellerId: doc.sellerId,
    sourceRuleId: doc.sourceRuleId,
    sourceRuleVersion: doc.sourceRuleVersion,
    category: doc.category,
    source: doc.source,
    sourceCategoryKey: doc.sourceCategoryKey,
    title: doc.title,
    venueOrRoute: doc.venueOrRoute,
    eventOrTripStartAt: doc.eventOrTripStartAt,
    quantity: doc.quantity,
    faceValue: doc.faceValue,
    listingPrice: doc.listingPrice,
    platformFee: doc.platformFee,
    gstOnFee: doc.gstOnFee,
    totalPayable: doc.totalPayable,
    transferMode: doc.transferMode,
    transferDeadlineAt: doc.transferDeadlineAt,
    protectionDeadlineAt: doc.protectionDeadlineAt,
    state: doc.state,
    ruleDecision: doc.ruleDecision,
    duplicateFingerprint: doc.duplicateFingerprint,
  };
}

export function sourceRuleDocToMock(doc: Doc<"source_rules">): SourceRule {
  return {
    id: doc.sourceRuleKey,
    version: doc.version,
    source: doc.source,
    category: doc.category,
    sourceCategoryKey: doc.sourceCategoryKey,
    decision: doc.decision,
    internalStatus: doc.internalStatus,
    transferMode: doc.transferMode,
    transferability: doc.transferability,
    protectionLevel: doc.protectionLevel,
    requiredFields: doc.requiredFields,
    eligibilityFields: doc.eligibilityFields,
    priceRule: doc.priceRule,
    payoutPolicy: doc.payoutPolicy,
    blockedBehavior: doc.blockedBehavior,
    manualReviewReasonCodes: doc.manualReviewReasonCodes,
    effectiveFrom: doc.effectiveFrom,
    lastVerifiedAt: doc.lastVerifiedAt,
    verificationSourceUrlOrNote: doc.verificationSourceUrlOrNote,
    createdBy: doc.createdBy,
  };
}

export function issueDocToMock(doc: Doc<"issues">): MockIssue {
  return {
    id: doc.issueKey,
    orderId: doc.orderId,
    reasonCode: doc.reasonCode,
    state: doc.state,
    requiredEvidence: doc.requiredEvidence,
    evidenceItems: doc.evidenceItems,
    decision: doc.decision,
  };
}

// ---- Lookups by public demo key ----

export async function orderByKey(ctx: MutationCtx, orderKey: string): Promise<Doc<"orders">> {
  const doc = await ctx.db
    .query("orders")
    .withIndex("by_key", (q) => q.eq("orderKey", orderKey))
    .unique();
  if (!doc) throw new Error("ORDER_NOT_FOUND");
  return doc;
}

export async function transferByKey(
  ctx: MutationCtx,
  transferTaskKey: string,
): Promise<Doc<"transfer_tasks">> {
  const doc = await ctx.db
    .query("transfer_tasks")
    .withIndex("by_key", (q) => q.eq("transferTaskKey", transferTaskKey))
    .unique();
  if (!doc) throw new Error("TRANSFER_TASK_NOT_FOUND");
  return doc;
}

export async function issueByKey(ctx: MutationCtx, issueKey: string): Promise<Doc<"issues">> {
  const doc = await ctx.db
    .query("issues")
    .withIndex("by_key", (q) => q.eq("issueKey", issueKey))
    .unique();
  if (!doc) throw new Error("ISSUE_NOT_FOUND");
  return doc;
}

// ---- Append-only audit log ----

export async function appendAuditLog(ctx: MutationCtx, event: AuditEvent): Promise<void> {
  const last = await ctx.db.query("audit_logs").withIndex("by_seq").order("desc").first();
  const seq = (last?.seq ?? 0) + 1;
  await ctx.db.insert("audit_logs", {
    actorId: event.actorId,
    actorRole: event.actorRole,
    action: event.action,
    entityType: event.entityType,
    entityId: event.entityId,
    fromState: event.fromState,
    toState: event.toState,
    seq,
    createdAt: event.createdAt,
  });
}

// ---- Official-availability watcher helpers (design 2026-06-22) -------------
//
// These EXTEND model.ts (no existing export is altered). The shared
// `AuditEvent` type in src/lib/types.ts (a shared, ownership-gated type) does
// NOT yet include the watcher entity types, so the watcher logs through its own
// strongly-typed helper below instead of widening that shared union. The
// audit_logs SCHEMA union already accepts these entity types (schema.ts).

// Entity types the watcher audits. Mirrors the additive schema union; kept
// narrow so a typo can't write a non-watcher entityType through this path.
export type WatcherAuditEntityType =
  | "monitor_target"
  | "availability_event"
  | "notification";

export interface WatcherAuditEvent {
  actorId: string;
  action: string;
  entityType: WatcherAuditEntityType;
  entityId: string;
  fromState?: string;
  toState?: string;
  createdAt: string;
}

/**
 * Append a watcher audit row. All watcher transitions are system-driven, so the
 * actorRole is always "system". Reuses the same monotonic seq as appendAuditLog
 * (single audit_logs.by_seq sequence) so the watcher's events interleave with
 * order/listing events in one ordered, append-only log (design §A09).
 */
export async function appendWatcherAuditLog(
  ctx: MutationCtx,
  event: WatcherAuditEvent,
): Promise<void> {
  const last = await ctx.db.query("audit_logs").withIndex("by_seq").order("desc").first();
  const seq = (last?.seq ?? 0) + 1;
  await ctx.db.insert("audit_logs", {
    actorId: event.actorId,
    actorRole: "system",
    action: event.action,
    entityType: event.entityType,
    entityId: event.entityId,
    fromState: event.fromState,
    toState: event.toState,
    seq,
    createdAt: event.createdAt,
  });
}

/**
 * Find the single shared monitor_targets row for a collapseKey, or null. The
 * collapse key (catalogItemId|city|date|format) is the find-or-create idempotency
 * anchor: many alerts on the same show collapse to ONE watcher (design §2). Uses
 * `.first()` (not `.unique()`) so a rare concurrent double-insert degrades to
 * "reuse the earliest" rather than throwing.
 */
export async function monitorTargetByCollapseKey(
  ctx: MutationCtx,
  collapseKey: string,
): Promise<Doc<"monitor_targets"> | null> {
  return await ctx.db
    .query("monitor_targets")
    .withIndex("by_collapse_key", (q) => q.eq("collapseKey", collapseKey))
    .first();
}

/** A want (alert/request) by its public wantKey, or null. Mirrors catalogItemByKey. */
export async function wantByKey(
  ctx: MutationCtx,
  wantKey: string,
): Promise<Doc<"wants"> | null> {
  return await ctx.db
    .query("wants")
    .withIndex("by_key", (q) => q.eq("wantKey", wantKey))
    .unique();
}

/** The catalog row backing a want/alert, by its public catalogKey. Null if absent. */
export async function catalogItemByKey(
  ctx: MutationCtx,
  catalogKey: string,
): Promise<Doc<"catalog_items"> | null> {
  return await ctx.db
    .query("catalog_items")
    .withIndex("by_key", (q) => q.eq("catalogKey", catalogKey))
    .unique();
}

/** Last cached snapshot hash for a (target, source), or null if never fetched. */
export async function sourceSnapshotFor(
  ctx: MutationCtx,
  monitorTargetId: string,
  source: "bms" | "district",
): Promise<Doc<"source_snapshots"> | null> {
  return await ctx.db
    .query("source_snapshots")
    .withIndex("by_target_source", (q) =>
      q.eq("monitorTargetId", monitorTargetId).eq("source", source),
    )
    .unique();
}

/** Upsert the per-(target, source) snapshot cache used to suppress unchanged polls. */
export async function upsertSourceSnapshot(
  ctx: MutationCtx,
  args: {
    monitorTargetId: string;
    source: "bms" | "district";
    snapshotHash: string;
    fetchedAt: string;
  },
): Promise<void> {
  const existing = await sourceSnapshotFor(ctx, args.monitorTargetId, args.source);
  if (existing) {
    await ctx.db.patch(existing._id, {
      snapshotHash: args.snapshotHash,
      fetchedAt: args.fetchedAt,
    });
    return;
  }
  await ctx.db.insert("source_snapshots", args);
}

/** The most recent availability_event for a target (the one a late subscriber fires from). */
export async function latestAvailabilityEvent(
  ctx: MutationCtx,
  monitorTargetId: string,
): Promise<Doc<"availability_events"> | null> {
  return await ctx.db
    .query("availability_events")
    .withIndex("by_target", (q) => q.eq("monitorTargetId", monitorTargetId))
    .order("desc")
    .first();
}

/** Subscribed wants (alerts) pointing at a monitor target. */
export async function subscribersForTarget(
  ctx: MutationCtx,
  monitorTargetId: string,
): Promise<Array<Doc<"wants">>> {
  return await ctx.db
    .query("wants")
    .withIndex("by_monitor_target", (q) => q.eq("monitorTargetId", monitorTargetId))
    .collect();
}

// ---- Transition helpers (load -> pure transition -> persist -> audit) ----

export async function applyMockPay(ctx: MutationCtx, orderKey: string): Promise<MockOrder> {
  const orderDoc = await orderByKey(ctx, orderKey);
  const listingDoc = await ctx.db
    .query("listings")
    .withIndex("by_key", (q) => q.eq("listingKey", orderDoc.listingId))
    .unique();
  if (!listingDoc) throw new Error("LISTING_NOT_FOUND");

  const { order, auditEvent } = mockPay(orderDocToMock(orderDoc));
  const soldListing = markListingSold(listingDocToMock(listingDoc));
  await ctx.db.patch(orderDoc._id, {
    state: order.state,
    mockPaymentStatus: order.mockPaymentStatus,
    mockPaymentSummary: order.mockPaymentSummary,
  });
  await ctx.db.patch(listingDoc._id, { state: soldListing.listing.state });
  await appendAuditLog(ctx, auditEvent);
  await appendAuditLog(ctx, soldListing.auditEvent);
  return order;
}

export async function applySellerSubmit(
  ctx: MutationCtx,
  orderKey: string,
  options: { submittedAt?: string } = {},
): Promise<MockOrder> {
  const orderDoc = await orderByKey(ctx, orderKey);
  const transferDoc = await transferByKey(ctx, orderDoc.transferTaskId);
  const result = sellerMarkTransferred(orderDocToMock(orderDoc), transferDocToMock(transferDoc), {
    actorId: orderDoc.sellerId,
    evidenceSummary: SELLER_EVIDENCE,
    submittedAt: options.submittedAt ?? NOW_BEFORE_DEADLINE,
  });
  await ctx.db.patch(orderDoc._id, { state: result.order.state });
  await ctx.db.patch(transferDoc._id, {
    state: result.transferTask.state,
    submittedAt: result.transferTask.submittedAt,
    evidenceSummary: result.transferTask.evidenceSummary,
  });
  await appendAuditLog(ctx, result.auditEvent);
  return result.order;
}

export async function applyBuyerConfirm(ctx: MutationCtx, orderKey: string): Promise<MockOrder> {
  const orderDoc = await orderByKey(ctx, orderKey);
  const transferDoc = await transferByKey(ctx, orderDoc.transferTaskId);
  const result = buyerConfirmReceived(
    orderDocToMock(orderDoc),
    transferDocToMock(transferDoc),
    orderDoc.buyerId,
  );
  await ctx.db.patch(orderDoc._id, { state: result.order.state });
  await ctx.db.patch(transferDoc._id, { state: result.transferTask.state });
  await appendAuditLog(ctx, result.auditEvent);
  return result.order;
}

export async function applyOpenProtectionWindow(
  ctx: MutationCtx,
  orderKey: string,
): Promise<MockOrder> {
  const orderDoc = await orderByKey(ctx, orderKey);
  const { order, auditEvent } = openProtectionWindow(orderDocToMock(orderDoc));
  await ctx.db.patch(orderDoc._id, { state: order.state });
  await appendAuditLog(ctx, auditEvent);
  return order;
}

export async function applyComplete(
  ctx: MutationCtx,
  orderKey: string,
  now: string = NOW_AFTER_PROTECTION_WINDOW,
): Promise<MockOrder> {
  const orderDoc = await orderByKey(ctx, orderKey);
  const { order, auditEvent } = completeAfterWindow(orderDocToMock(orderDoc), now);
  await ctx.db.patch(orderDoc._id, { state: order.state });
  await appendAuditLog(ctx, auditEvent);
  return order;
}

export async function applyReportIssue(
  ctx: MutationCtx,
  orderKey: string,
  reasonCode: MockIssue["reasonCode"],
  evidenceItems: string[],
): Promise<{ order: MockOrder; issue: MockIssue }> {
  const orderDoc = await orderByKey(ctx, orderKey);
  const issueDoc = await ctx.db
    .query("issues")
    .withIndex("by_order", (q) => q.eq("orderId", orderKey))
    .first();
  if (!issueDoc) throw new Error("ISSUE_NOT_FOUND");
  const result = buyerReportIssueTransition(orderDocToMock(orderDoc), issueDocToMock(issueDoc), {
    actorId: orderDoc.buyerId,
    reasonCode,
    evidenceItems,
  });
  await ctx.db.patch(orderDoc._id, { state: result.order.state });
  await ctx.db.patch(issueDoc._id, {
    reasonCode: result.issue.reasonCode,
    state: result.issue.state,
    evidenceItems: result.issue.evidenceItems,
  });
  await appendAuditLog(ctx, result.auditEvent);
  return { order: result.order, issue: result.issue };
}
