import type { MockOrder, MockTransferTask } from "../types";
import { validationResult, type ValidationResult } from "./types";

export type TransferSubmissionBlocker =
  | "ORDER_NOT_TRANSFER_PENDING"
  | "TRANSFER_TASK_NOT_PENDING"
  | "TRANSFER_DEADLINE_EXPIRED"
  | "INVALID_ACTOR"
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

  if (input.order.state !== "transfer_pending") blockers.push("ORDER_NOT_TRANSFER_PENDING");
  if (input.transferTask.state !== "transfer_pending") blockers.push("TRANSFER_TASK_NOT_PENDING");
  if (Date.parse(input.now) > Date.parse(input.transferTask.deadlineAt)) blockers.push("TRANSFER_DEADLINE_EXPIRED");
  if (input.actorId !== input.order.sellerId) blockers.push("INVALID_ACTOR");
  if (!input.evidenceSummary.trim()) blockers.push("MISSING_TRANSFER_EVIDENCE");

  return validationResult(blockers);
}
