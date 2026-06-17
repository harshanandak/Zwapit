/**
 * Visibility predicate for the community resale rails (Home + Listings).
 *
 * A resale listing is shown to buyers only while it is `live` or `waitlist_only`;
 * every other state (draft, under_review, sold, paused, expired, blocked) is hidden.
 * Centralised here so Home and Listings share ONE definition of "shown on resale" —
 * the rowcard map and the empty-state guard on both pages key off the same predicate
 * and cannot drift apart.
 */
export function isLiveResale(listing: { state: string }): boolean {
  return listing.state === "live" || listing.state === "waitlist_only";
}
