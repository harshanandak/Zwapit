export interface ValidationResult<TBlocker extends string = string> {
  ok: boolean;
  blockers: TBlocker[];
}

export function validationResult<TBlocker extends string>(blockers: TBlocker[]): ValidationResult<TBlocker> {
  return {
    ok: blockers.length === 0,
    blockers,
  };
}
