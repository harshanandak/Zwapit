import type { AuthActionState } from "../auth/authAdapter";
import type { MockListing, MockOrder, MockSellerPaymentAccount, SourceRule } from "../types";
import { validationResult, type ValidationResult } from "./types";

export type CheckoutBlocker =
  | "LISTING_NOT_LIVE"
  | "TRANSFER_DEADLINE_EXPIRED"
  | "BUYER_ELIGIBILITY_NOT_ACKNOWLEDGED"
  | "TOTAL_NOT_SHOWN"
  | "RULE_NOT_PURCHASABLE"
  | "SELLER_PAYOUT_NOT_READY"
  | "SELLER_PAYOUT_ACCOUNT_MISMATCH"
  | "PERSISTENCE_WRITE_FAILED";

export interface CheckoutValidationInput {
  listing: MockListing;
  sourceRule: SourceRule;
  sellerPaymentAccount: MockSellerPaymentAccount;
  buyerEligibilityAcknowledged?: boolean;
  totalShownToBuyer?: number;
  now: string;
}

export type BuyerConfirmationBlocker = "ORDER_NOT_TRANSFER_SUBMITTED";

export function validateCheckout(input: CheckoutValidationInput): ValidationResult<CheckoutBlocker> {
  const blockers: CheckoutBlocker[] = [];
  const nowMs = Date.parse(input.now);
  const transferDeadlineMs = Date.parse(input.listing.transferDeadlineAt);

  if (input.listing.state !== "live") blockers.push("LISTING_NOT_LIVE");
  if (Number.isNaN(nowMs) || Number.isNaN(transferDeadlineMs) || nowMs > transferDeadlineMs) {
    blockers.push("TRANSFER_DEADLINE_EXPIRED");
  }
  if (input.buyerEligibilityAcknowledged !== true) blockers.push("BUYER_ELIGIBILITY_NOT_ACKNOWLEDGED");
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

// Access gate for protected checkout execution. Derived from the auth adapter's
// action-gate contract so a signed-out or phone-unverified buyer is blocked
// before checkout execution (mock pay), not only at the listing-detail CTA.
export type CheckoutAccessBlocker = "AUTH_REQUIRED" | "PHONE_VERIFICATION_REQUIRED";

export function validateBuyerCheckoutAccess(action: AuthActionState): ValidationResult<CheckoutAccessBlocker> {
  if (action.status === "sign_in_required") return validationResult(["AUTH_REQUIRED"]);
  if (action.status === "phone_verification_required") return validationResult(["PHONE_VERIFICATION_REQUIRED"]);
  return validationResult([]);
}
