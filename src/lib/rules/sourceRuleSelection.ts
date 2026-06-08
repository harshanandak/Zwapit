export interface EffectiveSourceRuleCandidate {
  id?: string;
  version: number;
  effectiveFrom: string;
}

function effectiveTime(rule: EffectiveSourceRuleCandidate): number | null {
  const timestamp = Date.parse(rule.effectiveFrom);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function compareCandidates(a: EffectiveSourceRuleCandidate, b: EffectiveSourceRuleCandidate): number {
  if (a.version !== b.version) return a.version - b.version;

  const aEffective = effectiveTime(a) ?? Number.NEGATIVE_INFINITY;
  const bEffective = effectiveTime(b) ?? Number.NEGATIVE_INFINITY;
  if (aEffective !== bEffective) return aEffective - bEffective;

  return String(b.id ?? "").localeCompare(String(a.id ?? ""));
}

export function selectLatestEffectiveSourceRule<T extends EffectiveSourceRuleCandidate>(
  rules: T[],
  now = Date.now(),
): T | null {
  return rules.reduce<T | null>((latest, rule) => {
    const timestamp = effectiveTime(rule);
    if (timestamp == null || timestamp > now) return latest;
    if (!latest || compareCandidates(latest, rule) < 0) return rule;
    return latest;
  }, null);
}
