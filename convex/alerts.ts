// Alerts inbox read model. Only the community resale MATCH card is backed by real data —
// the buyer's matched want -> active want_match -> live listing (the same join the requests
// read model computes). The official-availability card and the "Earlier" feed are illustrative
// until the internal watcher/notification system lands (notifications/monitor/availability are
// internal-only, audited, deferred per CLAUDE.md), so they are not produced here.
// Read-only: matching is an internal-only/audited mutation, never exposed to clients.

import { query, type QueryCtx } from "./_generated/server";

const DEMO_BUYER_ID = "user_demo_1";
// A match only pays off while it is live, not after it is declined/expired.
const ACTIVE_MATCH_STATES = new Set(["proposed", "reserved", "accepted"]);

export interface AlertMatch {
  /** Listing title (the thing being sold). */
  title: string;
  /** Listing venue or route. */
  venue: string;
  /** Listing to "Buy with Protection" — links to the listing detail (protection-first) flow. */
  listingKey: string;
  /** Current asking price per ticket. */
  price: number;
  /** Raw transfer-mode enum; the frontend maps it via transferModeLabel(). */
  transferMode: string;
}

// The first active match whose listing is still live (purchasable), for one matched want.
async function liveMatchListing(
  ctx: QueryCtx,
  wantKey: string,
): Promise<AlertMatch | null> {
  const matches = await ctx.db
    .query("want_matches")
    .withIndex("by_want", (q) => q.eq("wantId", wantKey))
    .collect();
  for (const m of matches) {
    if (!ACTIVE_MATCH_STATES.has(m.state)) continue;
    const listing = await ctx.db
      .query("listings")
      .withIndex("by_key", (q) => q.eq("listingKey", m.listingId))
      .unique();
    if (listing?.state !== "live") continue;
    return {
      title: listing.title,
      venue: listing.venueOrRoute,
      listingKey: listing.listingKey,
      price: listing.listingPrice,
      transferMode: listing.transferMode,
    };
  }
  return null;
}

export const getAlertsForBuyer = query({
  // No client-supplied id: a caller must not read another buyer's matches.
  // Pinned to the demo buyer pre-auth; swap to ctx.auth identity when auth lands.
  args: {},
  handler: async (ctx): Promise<{ matches: AlertMatch[] }> => {
    const wants = await ctx.db
      .query("wants")
      .withIndex("by_buyer", (q) => q.eq("buyerId", DEMO_BUYER_ID))
      .collect();
    const matches: AlertMatch[] = [];
    for (const w of wants) {
      const match = await liveMatchListing(ctx, w.wantKey);
      if (match) matches.push(match);
    }
    return { matches };
  },
});
