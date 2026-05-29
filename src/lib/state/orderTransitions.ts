import type { AuditEvent, MockIssue, MockOrder, MockTransferTask } from "../types";
import { createAuditEvent } from "./auditEvents";
import { reportIssue } from "./issueTransitions";

export interface OrderTransitionResult {
  order: MockOrder;
  auditEvent: AuditEvent;
}

export interface TransferTransitionResult {
  order: MockOrder;
  transferTask: MockTransferTask;
  auditEvent: AuditEvent;
}

export interface IssueTransitionResult {
  order: MockOrder;
  issue: MockIssue;
  auditEvent: AuditEvent;
}

function requireOrderState(order: MockOrder, expectedState: MockOrder["state"]): void {
  if (order.state !== expectedState) {
    throw new Error("INVALID_ORDER_STATE");
  }
}

export function mockPay(order: MockOrder): OrderTransitionResult {
  requireOrderState(order, "checkout_pending");

  const nextOrder: MockOrder = {
    ...order,
    state: "transfer_pending",
    mockPaymentStatus: "mock_paid",
    mockPaymentSummary: {
      ...order.mockPaymentSummary,
      status: "mock_paid",
    },
  };

  return {
    order: nextOrder,
    auditEvent: createAuditEvent({
      actorId: order.buyerId,
      actorRole: "buyer",
      action: "mock_pay",
      entityType: "order",
      entityId: order.id,
      fromState: order.state,
      toState: nextOrder.state,
    }),
  };
}

export function sellerMarkTransferred(
  order: MockOrder,
  transferTask: MockTransferTask,
  input: { actorId: string; evidenceSummary: string; submittedAt?: string },
): TransferTransitionResult {
  requireOrderState(order, "transfer_pending");

  if (input.actorId !== order.sellerId) {
    throw new Error("INVALID_ACTOR");
  }

  if (transferTask.state !== "transfer_pending") {
    throw new Error("INVALID_TRANSFER_STATE");
  }

  const nextOrder: MockOrder = {
    ...order,
    state: "transfer_submitted",
  };
  const nextTransferTask: MockTransferTask = {
    ...transferTask,
    state: "transfer_submitted",
    submittedAt: input.submittedAt ?? "2026-12-20T17:00:00+05:30",
    evidenceSummary: input.evidenceSummary,
  };

  return {
    order: nextOrder,
    transferTask: nextTransferTask,
    auditEvent: createAuditEvent({
      actorId: input.actorId,
      actorRole: "seller",
      action: "seller_mark_transferred",
      entityType: "transfer_task",
      entityId: transferTask.id,
      fromState: transferTask.state,
      toState: nextTransferTask.state,
    }),
  };
}

export function buyerConfirmReceived(
  order: MockOrder,
  transferTask: MockTransferTask,
  actorId: string,
): TransferTransitionResult {
  requireOrderState(order, "transfer_submitted");

  if (actorId !== order.buyerId) {
    throw new Error("INVALID_ACTOR");
  }

  if (transferTask.state !== "transfer_submitted") {
    throw new Error("INVALID_TRANSFER_STATE");
  }

  const nextOrder: MockOrder = {
    ...order,
    state: "buyer_confirmed",
  };
  const nextTransferTask: MockTransferTask = {
    ...transferTask,
    state: "buyer_confirmed",
  };

  return {
    order: nextOrder,
    transferTask: nextTransferTask,
    auditEvent: createAuditEvent({
      actorId,
      actorRole: "buyer",
      action: "buyer_confirm_received",
      entityType: "order",
      entityId: order.id,
      fromState: order.state,
      toState: nextOrder.state,
    }),
  };
}

export function openProtectionWindow(order: MockOrder): OrderTransitionResult {
  requireOrderState(order, "buyer_confirmed");

  const nextOrder: MockOrder = {
    ...order,
    state: "dispute_window_open",
  };

  return {
    order: nextOrder,
    auditEvent: createAuditEvent({
      actorId: "system",
      actorRole: "system",
      action: "open_protection_window",
      entityType: "order",
      entityId: order.id,
      fromState: order.state,
      toState: nextOrder.state,
    }),
  };
}

export function completeAfterWindow(order: MockOrder, now: string): OrderTransitionResult {
  requireOrderState(order, "dispute_window_open");

  if (Date.parse(now) < Date.parse(order.issueWindowEndsAt)) {
    throw new Error("PROTECTION_WINDOW_OPEN");
  }

  const nextOrder: MockOrder = {
    ...order,
    state: "completed",
  };

  return {
    order: nextOrder,
    auditEvent: createAuditEvent({
      actorId: "system",
      actorRole: "system",
      action: "complete_after_window",
      entityType: "order",
      entityId: order.id,
      fromState: order.state,
      toState: nextOrder.state,
    }),
  };
}

export function transferDeadlineMissed(
  order: MockOrder,
  transferTask: MockTransferTask,
  now: string,
): TransferTransitionResult {
  requireOrderState(order, "transfer_pending");

  if (Date.parse(now) <= Date.parse(transferTask.deadlineAt)) {
    throw new Error("TRANSFER_DEADLINE_ACTIVE");
  }

  const nextOrder: MockOrder = {
    ...order,
    state: "transfer_timeout",
  };
  const nextTransferTask: MockTransferTask = {
    ...transferTask,
    state: "transfer_timeout",
  };

  return {
    order: nextOrder,
    transferTask: nextTransferTask,
    auditEvent: createAuditEvent({
      actorId: "system",
      actorRole: "system",
      action: "transfer_deadline_missed",
      entityType: "transfer_task",
      entityId: transferTask.id,
      fromState: transferTask.state,
      toState: nextTransferTask.state,
    }),
  };
}

export function buyerReportIssue(
  order: MockOrder,
  issue: MockIssue,
  input: { actorId: string; reasonCode: MockIssue["reasonCode"]; evidenceItems: string[] },
): IssueTransitionResult {
  if (input.actorId !== order.buyerId) {
    throw new Error("INVALID_ACTOR");
  }

  if (order.state !== "transfer_pending" && order.state !== "transfer_submitted" && order.state !== "dispute_window_open") {
    throw new Error("INVALID_ORDER_STATE");
  }

  const nextOrder: MockOrder = {
    ...order,
    state: "issue_reported",
  };
  const nextIssue = reportIssue(issue, input.reasonCode, input.evidenceItems);

  return {
    order: nextOrder,
    issue: nextIssue,
    auditEvent: createAuditEvent({
      actorId: input.actorId,
      actorRole: "buyer",
      action: "buyer_report_issue",
      entityType: "issue",
      entityId: issue.id,
      fromState: issue.state,
      toState: nextIssue.state,
    }),
  };
}
