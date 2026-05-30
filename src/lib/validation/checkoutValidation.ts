import type { MockListing, MockOrder, MockSellerPaymentAccount, SourceRule } from "../types";
import { validationResult, type ValidationResult } from "./types";

export type CheckoutBlocker =
  | "LISTING_NOT_LIVE"
  | "TRANSFER_DEADLINE_EXPIRED"
  | "TOTAL_NOT_SHOWN"
  | "RULE_NOT_PURCHASABLE"
  | "SELLER_PAYOUT_NOT_READY"
  | "SELLER_PAYOUT_ACCOUNT_MISMATCH";

export interface CheckoutValidationInput {
  listing: MockListing;
  sourceRule: SourceRule;
  sellerPaymentAccount: MockSellerPaymentAccount;
  totalShownToBuyer?: number;
  now: string;
}

export type BuyerConfirmationBlocker = "ORDER_NOT_TRANSFER_SUBMITTED";

export function validateCheckout(input: CheckoutValidationInput): ValidationResult<CheckoutBlocker> {
  const blockers: CheckoutBlocker[] = [];

  if (input.listing.state !== "live") blockers.push("LISTING_NOT_LIVE");
  if (Date.parse(input.now) > Date.parse(input.listing.transferDeadlineAt)) {
    blockers.push("TRANSFER_DEADLINE_EXPIRED");
  }
  if (input.totalShownToBuyer !== input.listing.totalPayable) blockers.push("TOTAL_NOT_SHOWN");
  if (input.sourceRule.decision !== "AUTO_APPROVE" || input.listing.ruleDecision !== "AUTO_APPROVE") {
    blockers.push("RULE_NOT_PURCHASABLE");
  }
  if (input.sellerPaymentAccount.sellerId !== input.listing.sellerId) {
    blockers.push("SELLER_PAYOUT_ACCOUNT_MISMATCH");
  }
  if (input.sellerPaymentAccount.status !== "mock_ready") blockers.push("SELLER_PAYOUT_NOT_READY");

  return validationResult(blockers);
}

export function validateBuyerConfirmation(order: MockOrder): ValidationResult<BuyerConfirmationBlocker> {
  return validationResult(order.state === "transfer_submitted" ? [] : ["ORDER_NOT_TRANSFER_SUBMITTED"]);
}
