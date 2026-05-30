import { describe, expect, test } from "bun:test";

import { createMockFixture } from "../../mock/fixtures";
import {
  buyerConfirmReceived,
  buyerReportIssue,
  completeAfterWindow,
  mockPay,
  openProtectionWindow,
  sellerMarkTransferred,
  transferDeadlineMissed,
} from "../orderTransitions";

describe("order state transitions", () => {
  test("moves the first vertical slice through the happy path", () => {
    const fixture = createMockFixture();

    const paid = mockPay(fixture.order);
    expect(paid.order.state).toBe("transfer_pending");
    expect(paid.order.mockPaymentStatus).toBe("mock_paid");
    expect(paid.auditEvent.action).toBe("mock_pay");

    const submitted = sellerMarkTransferred(paid.order, fixture.transferTask, {
      actorId: fixture.order.sellerId,
      evidenceSummary: "Official transfer submitted",
      submittedAt: "2026-12-20T17:00:00+05:30",
    });
    expect(submitted.order.state).toBe("transfer_submitted");
    expect(submitted.transferTask.state).toBe("transfer_submitted");

    const confirmed = buyerConfirmReceived(submitted.order, submitted.transferTask, fixture.order.buyerId);
    expect(confirmed.order.state).toBe("buyer_confirmed");
    expect(confirmed.transferTask.state).toBe("buyer_confirmed");

    const windowOpen = openProtectionWindow(confirmed.order);
    expect(windowOpen.order.state).toBe("dispute_window_open");

    const completed = completeAfterWindow(windowOpen.order, "2026-12-22T00:00:00+05:30");
    expect(completed.order.state).toBe("completed");
  });

  test("rejects invalid actor and invalid state transitions", () => {
    const fixture = createMockFixture();
    const paid = mockPay(fixture.order);

    expect(() =>
      sellerMarkTransferred(paid.order, fixture.transferTask, {
        actorId: fixture.order.buyerId,
        evidenceSummary: "buyer cannot submit",
      }),
    ).toThrow("INVALID_ACTOR");

    expect(() => buyerConfirmReceived(fixture.order, fixture.transferTask, fixture.order.buyerId)).toThrow(
      "INVALID_ORDER_STATE",
    );
  });

  test("rejects mismatched or expired transfer submissions", () => {
    const fixture = createMockFixture();
    const paid = mockPay(fixture.order);

    expect(() =>
      sellerMarkTransferred(
        paid.order,
        {
          ...fixture.transferTask,
          orderId: "order_other_1",
        },
        {
          actorId: fixture.order.sellerId,
          evidenceSummary: "Wrong order transfer",
          submittedAt: "2026-12-20T17:00:00+05:30",
        },
      ),
    ).toThrow("INVALID_TRANSFER_TASK");

    expect(() =>
      sellerMarkTransferred(paid.order, fixture.transferTask, {
        actorId: fixture.order.sellerId,
        evidenceSummary: "Late transfer",
        submittedAt: "2026-12-20T19:00:00+05:30",
      }),
    ).toThrow("TRANSFER_DEADLINE_EXPIRED");
  });

  test("moves missed transfer deadlines to timeout", () => {
    const fixture = createMockFixture();
    const paid = mockPay(fixture.order);
    const timedOut = transferDeadlineMissed(paid.order, fixture.transferTask, "2026-12-20T18:30:00+05:30");

    expect(timedOut.order.state).toBe("transfer_timeout");
    expect(timedOut.transferTask.state).toBe("transfer_timeout");
  });

  test("captures buyer issue path with structured reason and evidence", () => {
    const fixture = createMockFixture();
    const paid = mockPay(fixture.order);
    const issue = buyerReportIssue(paid.order, fixture.issue, {
      actorId: fixture.order.buyerId,
      reasonCode: "ticket_not_transferred",
      evidenceItems: ["screenshot uploaded"],
    });

    expect(issue.order.state).toBe("issue_reported");
    expect(issue.issue.state).toBe("reported");
    expect(issue.issue.evidenceItems).toEqual(["screenshot uploaded"]);
    expect(issue.auditEvent.action).toBe("buyer_report_issue");
  });

  test("rejects buyer issues for a different order", () => {
    const fixture = createMockFixture();
    const paid = mockPay(fixture.order);

    expect(() =>
      buyerReportIssue(
        paid.order,
        {
          ...fixture.issue,
          orderId: "order_other_1",
        },
        {
          actorId: fixture.order.buyerId,
          reasonCode: "ticket_not_transferred",
          evidenceItems: ["wrong order issue"],
        },
      ),
    ).toThrow("INVALID_ISSUE_ORDER");
  });
});
