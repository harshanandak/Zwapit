import type { InternalSourceStatus, RuleDecision, SourceRule } from "../types";
import { sourceRules } from "./sourceRules";

export interface SourceRuleEvaluationInput {
  source: SourceRule["source"];
  category: SourceRule["category"];
  listingPrice: number;
  faceValue: number;
  requiredFieldValues: Record<string, unknown>;
}

export interface PriceRuleResult {
  passed: boolean;
  reasonCode?: "PRICE_ABOVE_FACE_VALUE" | "BLOCKED_PRICE_RULE";
}

export interface SourceRuleEvaluationResult {
  rule: SourceRule;
  sourceRuleId: string;
  sourceRuleVersion: number;
  decision: RuleDecision;
  internalStatus: InternalSourceStatus;
  transferMode: SourceRule["transferMode"];
  missingRequiredFields: string[];
  manualReviewReasonCodes: string[];
}

function hasRequiredValue(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) && value > 0;
  return true;
}

export function classifySourceCategory(
  source: SourceRule["source"],
  category: SourceRule["category"],
): string {
  if (source === "bookmyshow" && category === "event_ticket") {
    return "bookmyshow_event";
  }

  if (source === "district" && category === "movie_ticket") {
    return "district_movie";
  }

  if (source === "manual_upload" && category === "watcher") {
    return "manual_watcher";
  }

  return `${source}_${category.replace("_ticket", "")}`;
}

export function getSourceRule(sourceCategoryKey: string): SourceRule {
  const rule = sourceRules.find((candidate) => candidate.sourceCategoryKey === sourceCategoryKey);

  if (!rule) {
    return sourceRules.find((candidate) => candidate.sourceCategoryKey === "other_platform_event")!;
  }

  return rule;
}

export function applyPriceRule(rule: SourceRule, listingPrice: number, faceValue: number): PriceRuleResult {
  if (rule.priceRule.kind === "blocked") {
    return { passed: false, reasonCode: "BLOCKED_PRICE_RULE" };
  }

  const maxMultiplier = rule.priceRule.maxMultiplier ?? 1;
  const maxPrice = faceValue * maxMultiplier;

  if (listingPrice > maxPrice) {
    return { passed: false, reasonCode: "PRICE_ABOVE_FACE_VALUE" };
  }

  return { passed: true };
}

export function getBlockedBehavior(rule: SourceRule): SourceRule["blockedBehavior"] {
  return rule.blockedBehavior;
}

export function evaluateSourceRule(input: SourceRuleEvaluationInput): SourceRuleEvaluationResult {
  const sourceCategoryKey = classifySourceCategory(input.source, input.category);
  const rule = getSourceRule(sourceCategoryKey);
  const explicitRequiredValues: Record<string, unknown> = {
    faceValue: input.faceValue,
    listingPrice: input.listingPrice,
  };
  const requiredFields = [...new Set([...rule.requiredFields, ...rule.eligibilityFields])];
  const missingRequiredFields = requiredFields.filter(
    (field) => !hasRequiredValue(input.requiredFieldValues[field] ?? explicitRequiredValues[field]),
  );
  const priceResult = applyPriceRule(rule, input.listingPrice, input.faceValue);
  const manualReviewReasonCodes = [...rule.manualReviewReasonCodes];

  if (missingRequiredFields.length > 0 && rule.decision !== "AUTO_BLOCK" && rule.decision !== "AUTO_WAITLIST") {
    manualReviewReasonCodes.push("MISSING_REQUIRED_FIELDS");
  }

  if (!priceResult.passed && priceResult.reasonCode === "PRICE_ABOVE_FACE_VALUE" && rule.decision === "AUTO_APPROVE") {
    manualReviewReasonCodes.push(priceResult.reasonCode);
  }

  const shouldManualReview =
    rule.decision === "NEEDS_MANUAL_REVIEW" ||
    (rule.decision === "AUTO_APPROVE" && manualReviewReasonCodes.length > 0);

  return {
    rule,
    sourceRuleId: rule.id,
    sourceRuleVersion: rule.version,
    decision: shouldManualReview ? "NEEDS_MANUAL_REVIEW" : rule.decision,
    internalStatus: shouldManualReview ? "AMBER" : rule.internalStatus,
    transferMode: rule.transferMode,
    missingRequiredFields,
    manualReviewReasonCodes,
  };
}
