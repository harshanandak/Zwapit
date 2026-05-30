import { describe, expect, it } from "bun:test";

import { createMockFixture } from "../../mock/fixtures";
import { mockPay } from "../../state/orderTransitions";
import { validateTransferSubmission } from "../transferValidation";

describe("transfer submission validation blockers", () => {
  it("should accept seller evidence when transfer is pending", () => {
    const fixture = createMockFixture();
    const paid = mockPay(fixture.order);

    expect(
      validateTransferSubmission({
        order: paid.order,
        transferTask: fixture.transferTask,
        actorId: fixture.order.sellerId,
        evidenceSummary: "Official transfer submitted",
        now: "2026-12-20T17:00:00+05:30",
      }),
    ).toEqual({ ok: true, blockers: [] });
  });

  it("should block submission when state actor or evidence is invalid", () => {
    const fixture = createMockFixture();
    const result = validateTransferSubmission({
      order: fixture.order,
      transferTask: {
        ...fixture.transferTask,
        state: "transfer_submitted",
      },
      actorId: fixture.order.buyerId,
      evidenceSummary: "",
      now: "2026-12-20T17:00:00+05:30",
    });

    expect(result.ok).toBe(false);
    expect(result.blockers).toContain("ORDER_NOT_TRANSFER_PENDING");
    expect(result.blockers).toContain("TRANSFER_TASK_NOT_PENDING");
    expect(result.blockers).toContain("INVALID_ACTOR");
    expect(result.blockers).toContain("MISSING_TRANSFER_EVIDENCE");
  });

  it("should block transfer submission when the transfer deadline has passed", () => {
    const fixture = createMockFixture();
    const paid = mockPay(fixture.order);
    const result = validateTransferSubmission({
      order: paid.order,
      transferTask: fixture.transferTask,
      actorId: fixture.order.sellerId,
      evidenceSummary: "Official transfer submitted",
      now: "2026-12-20T18:30:00+05:30",
    });

    expect(result.ok).toBe(false);
    expect(result.blockers).toContain("TRANSFER_DEADLINE_EXPIRED");
  });

  it("should block transfer submission when timestamps are invalid", () => {
    const fixture = createMockFixture();
    const paid = mockPay(fixture.order);

    const invalidNow = validateTransferSubmission({
      order: paid.order,
      transferTask: fixture.transferTask,
      actorId: fixture.order.sellerId,
      evidenceSummary: "Official transfer submitted",
      now: "not-a-date",
    });
    const invalidDeadline = validateTransferSubmission({
      order: paid.order,
      transferTask: {
        ...fixture.transferTask,
        deadlineAt: "not-a-date",
      },
      actorId: fixture.order.sellerId,
      evidenceSummary: "Official transfer submitted",
      now: "2026-12-20T17:00:00+05:30",
    });

    expect(invalidNow.ok).toBe(false);
    expect(invalidNow.blockers).toContain("TRANSFER_DEADLINE_EXPIRED");
    expect(invalidDeadline.ok).toBe(false);
    expect(invalidDeadline.blockers).toContain("TRANSFER_DEADLINE_EXPIRED");
  });
});
