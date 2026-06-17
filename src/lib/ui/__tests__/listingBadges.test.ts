import { describe, expect, test } from "bun:test";

import { discountBadge } from "../listingBadges";

describe("discountBadge (discount-integrity rule, design.md §8.6)", () => {
  test("returns a rounded percent when a verified original price exceeds the listing price", () => {
    expect(
      discountBadge({ listingPrice: 1250, originalPrice: 1500, originalPriceVerified: true }),
    ).toEqual({ percent: 17 });
  });

  test("returns null when there is no verified original price (caller shows 'Seller price')", () => {
    expect(discountBadge({ listingPrice: 1250 })).toBeNull();
    // an unverified original price must not produce a badge
    expect(discountBadge({ listingPrice: 1250, originalPrice: 1500 })).toBeNull();
    // verified flag but no original price
    expect(discountBadge({ listingPrice: 1250, originalPriceVerified: true })).toBeNull();
  });

  test("returns null when the verified original is not strictly greater than the listing price", () => {
    expect(
      discountBadge({ listingPrice: 1500, originalPrice: 1500, originalPriceVerified: true }),
    ).toBeNull();
    expect(
      discountBadge({ listingPrice: 1600, originalPrice: 1500, originalPriceVerified: true }),
    ).toBeNull();
  });
});
