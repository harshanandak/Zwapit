// Referral summary read model for the Profile + Plans screens. Returns the demo
// buyer's invited/verified friend counts. Rewards (the alert-wave ladder) unlock on
// VERIFIED friends only (CLAUDE.md) — the frontend feeds `verifiedCount` to the ladder
// and progress bar. Read-only: inviting/verifying friends are not client mutations.

import { query } from "./_generated/server";

const DEMO_BUYER_ID = "user_demo_1";

export interface ReferralSummary {
  /** Total referrals (invited + verified). */
  invitedCount: number;
  /** Referrals in state "verified" — the count rewards unlock on. */
  verifiedCount: number;
}

export const getReferralSummary = query({
  // No client-supplied id: a caller must not read another buyer's referrals.
  // Pinned to the demo buyer pre-auth; swap to ctx.auth identity when auth lands.
  args: {},
  handler: async (ctx): Promise<ReferralSummary> => {
    const rows = await ctx.db
      .query("referrals")
      .withIndex("by_referrer", (q) => q.eq("referrerId", DEMO_BUYER_ID))
      .collect();
    const verifiedCount = rows.filter((r) => r.state === "verified").length;
    return { invitedCount: rows.length, verifiedCount };
  },
});
