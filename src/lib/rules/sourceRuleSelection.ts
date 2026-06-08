type EffectiveSourceRuleCandidateKey = { id: string; sourceRuleKey?: string } | { id?: string; sourceRuleKey: string };

export type EffectiveSourceRuleCandidate = EffectiveSourceRuleCandidateKey & {
  version: number;
  effectiveFrom: string;
};

function effectiveTime(rule: EffectiveSourceRuleCandidate): number | null {
  const timestamp = Date.parse(rule.effectiveFrom);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function candidateIdentifier(rule: EffectiveSourceRuleCandidate): string {
  const identifier = rule.sourceRuleKey ?? rule.id;
  if (!identifier) throw new Error("SOURCE_RULE_IDENTIFIER_REQUIRED");
  return identifier;
}

function compareCandidates(a: EffectiveSourceRuleCandidate, b: EffectiveSourceRuleCandidate): number {
  if (a.version !== b.version) return a.version - b.version;

  const aEffective = effectiveTime(a) ?? Number.NEGATIVE_INFINITY;
  const bEffective = effectiveTime(b) ?? Number.NEGATIVE_INFINITY;
  if (aEffective !== bEffective) return aEffective - bEffective;

  // Prefer the lexically smallest canonical rule key for stable same-version ties.
  return candidateIdentifier(b).localeCompare(candidateIdentifier(a));
}

export function selectLatestEffectiveSourceRule<T extends EffectiveSourceRuleCandidate>(
  rules: T[],
  now = Date.now(),
): T | null {
  return rules.reduce<T | null>((latest, rule) => {
    const timestamp = effectiveTime(rule);
    if (timestamp == null || timestamp > now) return latest;
    candidateIdentifier(rule);
    if (!latest || compareCandidates(latest, rule) < 0) return rule;
    return latest;
  }, null);
}
