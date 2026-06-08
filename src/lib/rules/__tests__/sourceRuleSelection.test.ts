import { describe, expect, test } from "bun:test";

import { selectLatestEffectiveSourceRule } from "../sourceRuleSelection";

interface CandidateRule {
  id: string;
  version: number;
  effectiveFrom: string;
}

describe("source rule selection", () => {
  const now = Date.parse("2026-06-08T12:00:00+05:30");

  test("returns null when no source rule candidates are available", () => {
    expect(selectLatestEffectiveSourceRule([], now)).toBeNull();
  });

  test("returns null when every candidate is future-dated or invalid", () => {
    const rules: CandidateRule[] = [
      { id: "future", version: 2, effectiveFrom: "2099-01-01T00:00:00+05:30" },
      { id: "invalid-date", version: 3, effectiveFrom: "not-a-date" },
    ];

    expect(selectLatestEffectiveSourceRule(rules, now)).toBeNull();
  });

  test("selects the highest-version effective rule and ignores future versions", () => {
    const rules: CandidateRule[] = [
      { id: "older", version: 1, effectiveFrom: "2026-05-01T00:00:00+05:30" },
      { id: "current", version: 2, effectiveFrom: "2026-06-01T00:00:00+05:30" },
      { id: "future", version: 3, effectiveFrom: "2099-01-01T00:00:00+05:30" },
    ];

    expect(selectLatestEffectiveSourceRule(rules, now)?.id).toBe("current");
  });

  test("uses effective date and id as deterministic tie-breakers for same-version rules", () => {
    const rules: CandidateRule[] = [
      { id: "rule_b", version: 2, effectiveFrom: "2026-06-01T00:00:00+05:30" },
      { id: "rule_a", version: 2, effectiveFrom: "2026-06-01T00:00:00+05:30" },
      { id: "newer-same-version", version: 2, effectiveFrom: "2026-06-02T00:00:00+05:30" },
    ];

    expect(selectLatestEffectiveSourceRule(rules, now)?.id).toBe("newer-same-version");
    expect(selectLatestEffectiveSourceRule(rules.slice(0, 2), now)?.id).toBe("rule_a");
  });
});
