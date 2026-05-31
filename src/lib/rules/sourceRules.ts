import type { SourceRule } from "../types";

export const bookmyshowEventRule: SourceRule = {
  id: "source_rule_bookmyshow_event_v1",
  version: 1,
  source: "bookmyshow",
  category: "event_ticket",
  sourceCategoryKey: "bookmyshow_event",
  decision: "AUTO_APPROVE",
  internalStatus: "ALLOW",
  transferMode: "OFFICIAL_TRANSFER",
  transferability: "transferable",
  protectionLevel: "protected_payment",
  requiredFields: ["title", "eventOrTripStartAt", "venueOrRoute", "quantity", "faceValue", "listingPrice"],
  eligibilityFields: ["sellerPromiseAccepted", "transferDeadlineAt"],
  priceRule: {
    kind: "face_value_cap",
    maxMultiplier: 1,
  },
  payoutPolicy: {
    releaseAfter: "buyer_confirmation_and_issue_window",
    mockOnly: true,
  },
  blockedBehavior: "cannot_list",
  manualReviewReasonCodes: [],
  effectiveFrom: "2026-05-29T00:00:00+05:30",
  lastVerifiedAt: "2026-05-29T00:00:00+05:30",
  verificationSourceUrlOrNote: "Mock BookMyShow event rule for first visible slice.",
  createdBy: "system",
};

export const blockedWatcherRule: SourceRule = {
  id: "source_rule_manual_watcher_blocked_v1",
  version: 1,
  source: "manual_upload",
  category: "watcher",
  sourceCategoryKey: "manual_watcher",
  decision: "AUTO_BLOCK",
  internalStatus: "BLOCKED",
  transferMode: "IDENTITY_BOUND",
  transferability: "not_transferable",
  protectionLevel: "cannot_list",
  requiredFields: ["title"],
  eligibilityFields: [],
  priceRule: {
    kind: "blocked",
  },
  payoutPolicy: {
    releaseAfter: "buyer_confirmation_and_issue_window",
    mockOnly: true,
  },
  blockedBehavior: "cannot_list",
  manualReviewReasonCodes: [],
  effectiveFrom: "2026-05-29T00:00:00+05:30",
  lastVerifiedAt: "2026-05-29T00:00:00+05:30",
  verificationSourceUrlOrNote: "Blocked first-slice watcher marketplace rule.",
  createdBy: "system",
};

export const districtMovieWaitlistRule: SourceRule = {
  id: "source_rule_district_movie_waitlist_v1",
  version: 1,
  source: "district",
  category: "movie_ticket",
  sourceCategoryKey: "district_movie",
  decision: "AUTO_WAITLIST",
  internalStatus: "DEMAND_ONLY",
  transferMode: "CODE_REVEAL",
  transferability: "unknown",
  protectionLevel: "waitlist_only",
  requiredFields: ["title"],
  eligibilityFields: [],
  priceRule: {
    kind: "manual_review_above_face_value",
    maxMultiplier: 1,
  },
  payoutPolicy: {
    releaseAfter: "buyer_confirmation_and_issue_window",
    mockOnly: true,
  },
  blockedBehavior: "waitlist_only",
  manualReviewReasonCodes: [],
  effectiveFrom: "2026-05-29T00:00:00+05:30",
  lastVerifiedAt: "2026-05-29T00:00:00+05:30",
  verificationSourceUrlOrNote: "Demand-only movie rule for first visible slice.",
  createdBy: "system",
};

export const otherPlatformEventReviewRule: SourceRule = {
  id: "source_rule_other_platform_event_review_v1",
  version: 1,
  source: "other_platform",
  category: "event_ticket",
  sourceCategoryKey: "other_platform_event",
  decision: "NEEDS_MANUAL_REVIEW",
  internalStatus: "AMBER",
  transferMode: "CUSTOMER_MANAGED_HANDOFF",
  transferability: "unknown",
  protectionLevel: "protected_payment",
  requiredFields: ["title"],
  eligibilityFields: ["sellerPromiseAccepted"],
  priceRule: {
    kind: "manual_review_above_face_value",
    maxMultiplier: 1,
  },
  payoutPolicy: {
    releaseAfter: "buyer_confirmation_and_issue_window",
    mockOnly: true,
  },
  blockedBehavior: "manual_review",
  manualReviewReasonCodes: ["UNVERIFIED_SOURCE"],
  effectiveFrom: "2026-05-29T00:00:00+05:30",
  lastVerifiedAt: "2026-05-29T00:00:00+05:30",
  verificationSourceUrlOrNote: "Exception-only manual review rule for unverified event sources.",
  createdBy: "system",
};

export const sourceRules: SourceRule[] = [
  bookmyshowEventRule,
  blockedWatcherRule,
  districtMovieWaitlistRule,
  otherPlatformEventReviewRule,
];
