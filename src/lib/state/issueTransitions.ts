import type { MockIssue } from "../types";

export function reportIssue(
  issue: MockIssue,
  reasonCode: MockIssue["reasonCode"],
  evidenceItems: string[],
): MockIssue {
  if (issue.state !== "draft") {
    throw new Error("INVALID_ISSUE_STATE");
  }

  if (evidenceItems.length === 0) {
    throw new Error("MISSING_EVIDENCE");
  }

  return {
    ...issue,
    reasonCode,
    state: "reported",
    evidenceItems,
  };
}
