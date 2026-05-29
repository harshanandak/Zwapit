import type { MockIssue } from "../types";

export const mockIssue: MockIssue = {
  id: "issue_demo_1",
  orderId: "order_demo_1",
  reasonCode: "ticket_not_transferred",
  state: "draft",
  requiredEvidence: ["transfer status screenshot"],
  evidenceItems: [],
  decision: "pending",
};
