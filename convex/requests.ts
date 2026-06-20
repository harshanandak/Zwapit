// Buyer requests read model. The Requests screen lists a buyer's wants joined to the
// catalog item they reference, with a real `want_matches` count + the matched listing.
// Read-only — creating/matching wants is an internal-only/audited mutation, not here.

import { query, type QueryCtx } from "./_generated/server";

const DEMO_BUYER_ID = "user_demo_1";
const QUOTA_TOTAL = 3; // free-plan active-request quota
// A match only counts (and only offers a Buy link) while it is live, not after it
// is declined/expired. Terminal want_match states are excluded.
const ACTIVE_MATCH_STATES = new Set(["proposed", "reserved", "accepted"]);

export type BuyerRequestState = "active" | "matched" | "purchased" | "expired";

export interface BuyerRequest {
  /** wantKey — stable public id. */
  id: string;
  state: BuyerRequestState;
  category: string;
  title: string;
  venue: string | null;
  startAt: string | null;
  budget: number;
  matchesThisWeek: number;
  /** Listing to "Buy with Protection" when matched, else null. */
  matchListingId: string | null;
}

// wantState -> the four UI lifecycle states (requests.ts RequestState).
function mapState(wantState: string): BuyerRequestState {
  switch (wantState) {
    case "matched":
    case "reserved":
      return "matched";
    case "fulfilled":
      return "purchased";
    case "expired":
    case "cancelled":
      return "expired";
    default:
      return "active"; // open
  }
}

// The listing for the first active match that is still purchasable (live), else null.
// Guards the "Buy with Protection" link from dead-ending on a sold/expired listing.
async function purchasableMatchListingId(
  ctx: QueryCtx,
  activeMatches: Array<{ listingId: string }>,
): Promise<string | null> {
  for (const m of activeMatches) {
    const listing = await ctx.db
      .query("listings")
      .withIndex("by_key", (q) => q.eq("listingKey", m.listingId))
      .unique();
    if (listing?.state === "live") return listing.listingKey;
  }
  return null;
}

export const getRequestsForBuyer = query({
  // No client-supplied buyerId: a caller must not be able to read another buyer's
  // requests. Pinned to the demo buyer pre-auth; swap to ctx.auth identity when auth lands.
  args: {},
  handler: async (ctx) => {
    const buyerId = DEMO_BUYER_ID;
    const wants = await ctx.db
      .query("wants")
      .withIndex("by_buyer", (q) => q.eq("buyerId", buyerId))
      .collect();

    const requests: BuyerRequest[] = [];
    let activeCount = 0;
    for (const w of wants) {
      const item = await ctx.db
        .query("catalog_items")
        .withIndex("by_key", (q) => q.eq("catalogKey", w.catalogItemId))
        .unique();
      const matches = await ctx.db
        .query("want_matches")
        .withIndex("by_want", (q) => q.eq("wantId", w.wantKey))
        .collect();
      const activeMatches = matches.filter((m) => ACTIVE_MATCH_STATES.has(m.state));
      const state = mapState(w.state);
      if (state === "active") activeCount += 1;
      requests.push({
        id: w.wantKey,
        state,
        category: w.category,
        title: item?.title ?? "Catalog item",
        venue: item?.venueOrDestination ?? null,
        startAt: item?.startAt ?? null,
        budget: w.maxPricePerUnit,
        matchesThisWeek: activeMatches.length,
        matchListingId: await purchasableMatchListingId(ctx, activeMatches),
      });
    }
    return { requests, activeCount, quotaTotal: QUOTA_TOTAL };
  },
});
