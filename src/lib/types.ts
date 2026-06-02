export type CurrencyCode = "INR";

export type RuleDecision = "AUTO_APPROVE" | "AUTO_BLOCK" | "AUTO_WAITLIST" | "NEEDS_MANUAL_REVIEW";
export type InternalSourceStatus = "ALLOW" | "AMBER" | "DEMAND_ONLY" | "BLOCKED";
export type TransferMode =
  | "OFFICIAL_TRANSFER"
  | "OFFICIAL_REISSUE"
  | "CUSTOMER_MANAGED_HANDOFF"
  | "CODE_REVEAL"
  | "IDENTITY_BOUND";

export type ListingState =
  | "draft"
  | "under_review"
  | "live"
  | "sold"
  | "paused"
  | "expired"
  | "blocked"
  | "waitlist_only";

export type OrderState =
  | "checkout_pending"
  | "payment_captured"
  | "transfer_pending"
  | "fulfilment_in_progress"
  | "transfer_submitted"
  | "buyer_confirmed"
  | "dispute_window_open"
  | "issue_reported"
  | "buyer_rejected"
  | "refund_processing"
  | "refunded"
  | "payout_eligible"
  | "payout_waiting"
  | "payout_released"
  | "payout_sent"
  | "seller_payout_blocked"
  | "completed"
  | "transfer_timeout";

export type TransferTaskState = "transfer_pending" | "transfer_submitted" | "buyer_confirmed" | "transfer_timeout";
export type IssueState = "draft" | "reported" | "accepted" | "rejected";
export type IssueReasonCode =
  | "ticket_not_transferred"
  | "wrong_ticket"
  | "qr_or_code_already_used"
  | "details_do_not_match"
  | "eligibility_problem"
  | "cannot_access_ticket";
export type ActorRole = "buyer" | "seller" | "system";
export type ProtectionLevel = "protected_payment" | "waitlist_only" | "cannot_list";
export type TransferabilityStatus = "transferable" | "not_transferable" | "unknown";

export interface MoneySummary {
  currency: CurrencyCode;
  itemPrice: number;
  platformFee: number;
  gstOnPlatformFee: number;
  totalPayable: number;
  status?: "mock_unpaid" | "mock_paid";
}

export interface MockUser {
  id: string;
  role: "buyer_seller";
  phoneVerified: boolean;
  displayName: string;
}

export interface AuthIdentity {
  appUserId: string;
  provider: "mock_phone" | "clerk";
  providerUserId: string;
}

export interface UserVerification {
  appUserId: string;
  phoneVerified: boolean;
  verificationMode: "mock" | "clerk_phone" | "unverified";
}

export interface MockSellerPaymentAccount {
  sellerId: string;
  status: "mock_ready" | "mock_missing";
  provider: "mock";
}

export interface SourceRule {
  id: string;
  version: number;
  source: "bookmyshow" | "district" | "bus_operator" | "other_platform" | "manual_upload";
  category: "event_ticket" | "movie_ticket" | "bus_travel" | "watcher" | "future_category";
  sourceCategoryKey: string;
  decision: RuleDecision;
  internalStatus: InternalSourceStatus;
  transferMode: TransferMode;
  transferability: TransferabilityStatus;
  protectionLevel: ProtectionLevel;
  requiredFields: string[];
  eligibilityFields: string[];
  priceRule: {
    kind: "face_value_cap" | "manual_review_above_face_value" | "blocked";
    maxMultiplier?: number;
  };
  payoutPolicy: {
    releaseAfter: "buyer_confirmation_and_issue_window";
    mockOnly: true;
  };
  blockedBehavior: "cannot_list" | "waitlist_only" | "manual_review";
  manualReviewReasonCodes: string[];
  effectiveFrom: string;
  lastVerifiedAt: string;
  verificationSourceUrlOrNote: string;
  createdBy: "system";
}

export interface MockListing {
  id: string;
  sellerId: string;
  sourceRuleId: string;
  sourceRuleVersion: number;
  category: SourceRule["category"];
  source: SourceRule["source"];
  sourceCategoryKey: string;
  title: string;
  venueOrRoute: string;
  eventOrTripStartAt: string;
  quantity: number;
  faceValue: number;
  listingPrice: number;
  platformFee: number;
  gstOnFee: number;
  totalPayable: number;
  transferMode: TransferMode;
  transferDeadlineAt: string;
  protectionDeadlineAt: string;
  state: ListingState;
  ruleDecision: RuleDecision;
  duplicateFingerprint: string;
}

export interface MockOrder {
  id: string;
  buyerId: string;
  sellerId: string;
  listingId: string;
  state: OrderState;
  mockPaymentStatus: "mock_unpaid" | "mock_paid";
  mockPaymentSummary: MoneySummary;
  transferTaskId: string;
  issueWindowEndsAt: string;
  createdAt: string;
}

export interface MockTransferTask {
  id: string;
  orderId: string;
  requiredActor: "seller";
  state: TransferTaskState;
  deadlineAt: string;
  submittedAt?: string;
  evidenceSummary?: string;
}

export interface MockIssue {
  id: string;
  orderId: string;
  reasonCode: IssueReasonCode;
  state: IssueState;
  requiredEvidence: string[];
  evidenceItems: string[];
  decision: "pending" | "accepted" | "rejected";
}

export interface AuditEvent {
  id: string;
  actorId: string;
  actorRole: ActorRole;
  action: string;
  entityType: "listing" | "order" | "transfer_task" | "issue";
  entityId: string;
  fromState?: string;
  toState?: string;
  createdAt: string;
}

export interface MockFixture {
  user: MockUser;
  authIdentity: AuthIdentity;
  userVerification: UserVerification;
  sellerPaymentAccount: MockSellerPaymentAccount;
  sourceRule: SourceRule;
  listing: MockListing;
  order: MockOrder;
  transferTask: MockTransferTask;
  issue: MockIssue;
  auditEvents: AuditEvent[];
}
