import { describe, expect, test } from "bun:test";

import { createMockFixture } from "../../mock/fixtures";
import { mockPay } from "../../state/orderTransitions";
import { validateTransferSubmission } from "../transferValidation";

describe("transfer submission validation blockers", () => {
  test("accepts seller evidence while transfer is pending", () => {
    const fixture = createMockFixture();
    const paid = mockPay(fixture.order);

    expect(
      validateTransferSubmission({
        order: paid.order,
        transferTask: fixture.transferTask,
        actorId: fixture.order.sellerId,
        evidenceSummary: "Official transfer submitted",
      }),
    ).toEqual({ ok: true, blockers: [] });
  });

  test("blocks wrong state, wrong actor, and missing evidence", () => {
    const fixture = createMockFixture();
    const result = validateTransferSubmission({
      order: fixture.order,
      transferTask: {
        ...fixture.transferTask,
        state: "transfer_submitted",
      },
      actorId: fixture.order.buyerId,
      evidenceSummary: "",
    });

    expect(result.ok).toBe(false);
    expect(result.blockers).toContain("ORDER_NOT_TRANSFER_PENDING");
    expect(result.blockers).toContain("TRANSFER_TASK_NOT_PENDING");
    expect(result.blockers).toContain("INVALID_ACTOR");
    expect(result.blockers).toContain("MISSING_TRANSFER_EVIDENCE");
  });
});
