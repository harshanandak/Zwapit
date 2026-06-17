/**
 * Discount-integrity badge for resale listings (design.md §8.6).
 *
 * A "% off" badge may render ONLY when the listing carries a verified original price
 * that is strictly higher than the current listing price. Otherwise the UI shows a
 * plain "Seller price" — we never display an unverified or fabricated discount.
 *
 * Pure module (no Astro/DOM imports) so it is unit-testable and reusable by Home +
 * Listings. Reads fields defensively: the v1 mock has no verified-original-price yet
 * (that lands with the listings backend), so today this returns null for real listings.
 */

export interface DiscountInput {
  /** Current asking price per ticket. */
  listingPrice: number;
  /** Seller-claimed original/face price, if present. */
  originalPrice?: number;
  /** True only when the original price has been verified (integrity gate). */
  originalPriceVerified?: boolean;
}

export interface DiscountBadge {
  /** Whole-number percent off, e.g. 17. */
  percent: number;
}

/**
 * Returns the discount badge for a listing, or `null` when no verified discount
 * applies (caller shows "Seller price"). Never returns a zero/negative percent.
 */
export function discountBadge(listing: DiscountInput): DiscountBadge | null {
  const { listingPrice, originalPrice, originalPriceVerified } = listing;
  if (!originalPriceVerified || originalPrice == null) return null;
  if (originalPrice <= listingPrice) return null;
  return { percent: Math.round((1 - listingPrice / originalPrice) * 100) };
}
