import type { MoneySummary } from "../types";

export const platformFeeInr = 10;
export const mockGstRate = 0.18;

export function calculateCheckoutTotal(itemPrice: number): MoneySummary {
  const gstOnPlatformFee = Number((platformFeeInr * mockGstRate).toFixed(2));

  return {
    currency: "INR",
    itemPrice,
    platformFee: platformFeeInr,
    gstOnPlatformFee,
    totalPayable: Number((itemPrice + platformFeeInr + gstOnPlatformFee).toFixed(2)),
    status: "mock_unpaid",
  };
}
