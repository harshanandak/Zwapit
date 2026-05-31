import type { MockOrder, MockTransferTask } from "../types";
import { validationResult, type ValidationResult } from "./types";

export type TransferSubmissionBlocker =
  | "ORDER_NOT_TRANSFER_PENDING"
  | "TRANSFER_TASK_NOT_PENDING"
  | "TRANSFER_DEADLINE_EXPIRED"
  | "INVALID_ACTOR"
  | "INVALID_TRANSFER_TASK"
  | "MISSING_TRANSFER_EVIDENCE";

export interface TransferSubmissionValidationInput {
  order: MockOrder;
  transferTask: MockTransferTask;
  actorId: string;
  evidenceSummary: string;
  now: string;
}

export function validateTransferSubmission(
  input: TransferSubmissionValidationInput,
): ValidationResult<TransferSubmissionBlocker> {
  const blockers: TransferSubmissionBlocker[] = [];
  const nowMs = Date.parse(input.now);
  const deadlineMs = Date.parse(input.transferTask.deadlineAt);

  if (input.order.state !== "transfer_pending") blockers.push("ORDER_NOT_TRANSFER_PENDING");
  if (input.transferTask.state !== "transfer_pending") blockers.push("TRANSFER_TASK_NOT_PENDING");
  if (input.transferTask.orderId !== input.order.id) blockers.push("INVALID_TRANSFER_TASK");
  if (Number.isNaN(nowMs) || Number.isNaN(deadlineMs) || nowMs > deadlineMs) {
    blockers.push("TRANSFER_DEADLINE_EXPIRED");
  }
  if (input.actorId !== input.order.sellerId) blockers.push("INVALID_ACTOR");
  if (!input.evidenceSummary.trim()) blockers.push("MISSING_TRANSFER_EVIDENCE");

  return validationResult(blockers);
}
