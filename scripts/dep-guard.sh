#!/usr/bin/env bash
# dep-guard.sh — dependency-guard helper (post-Beads migration).
#
# Inline sanitize helper (extracted from scripts/lib/sanitize.sh so this
# script stays self-contained).
sanitize() {
  printf '%s' "$1" | tr -d '`$;|&><'
}
#
# Pure-local subcommands only: find-consumers and extract-contracts.
# Beads-backed subcommands (check-ripple / apply-decision / store-contracts)
# were excised with the bd backend — kernel 965c6d76.

cmd_find_consumers() {
  if [[ $# -lt 1 || -z "$1" ]]; then
    echo "Usage: dep-guard.sh find-consumers <function-or-pattern>" >&2
    exit 1
  fi

  local pattern
  pattern="$(sanitize "$1")"

  # Build list of directories that actually exist
  local dirs=()
  for d in lib/ scripts/ bin/ .claude/commands/ .forge/hooks/; do
    [[ -d "$d" ]] && dirs+=("$d")
  done

  if [[ ${#dirs[@]} -eq 0 ]]; then
    echo "No consumers found"
    return 0
  fi

  # Grep across key directories, excluding noise
  local results
  results="$(grep -rn -e "$pattern" \
    --include='*.js' --include='*.sh' --include='*.md' --include='*.ts' --include='*.json' \
    --exclude-dir=node_modules --exclude-dir=.worktrees --exclude-dir=test --exclude-dir=test-env \
    --exclude='dep-guard.sh' \
    "${dirs[@]}" 2>/dev/null || true)"

  if [[ -z "$results" ]]; then
    echo "No consumers found"
    return 0
  fi

  echo "$results"
  return 0
}

cmd_extract_contracts() {
  if [[ $# -lt 1 ]]; then
    echo "Usage: dep-guard.sh extract-contracts <file-path>" >&2
    exit 1
  fi

  local task_file="$1"

  # Validate file exists
  if [[ ! -f "$task_file" ]]; then
    die "File does not exist: ${task_file}"
  fi

  # Check that file contains at least one ## Task header
  if ! grep -q '^## Task' "$task_file"; then
    die "No tasks found in ${task_file}"
  fi

  # Parse task blocks using line-by-line bash processing.
  # For each task: collect File(s) paths and function names from "What to implement".
  local current_files=""
  local current_what=""
  local in_what=0
  local all_contracts=""

  while IFS= read -r line || [[ -n "$line" ]]; do
    # New task block -- flush previous
    if [[ "$line" =~ ^##\ Task ]]; then
      local _emitted
      _emitted="$(emit_contracts "$current_files" "$current_what")"
      [[ -n "$_emitted" ]] && all_contracts="${all_contracts}${_emitted}"$'\n'
      current_files=""
      current_what=""
      in_what=0
      continue
    fi

    # File(s): line
    if [[ "$line" =~ ^File\(s\): ]]; then
      current_files="${line#File(s):}"
      current_files="$(printf '%s' "$current_files" | sed 's/^[[:space:]]*//')"
      in_what=0
      continue
    fi

    # What to implement: line
    if [[ "$line" =~ ^What\ to\ implement: ]]; then
      current_what="${line#What to implement:}"
      current_what="$(printf '%s' "$current_what" | sed 's/^[[:space:]]*//')"
      in_what=1
      continue
    fi

    # Continue what section (stop at section boundaries)
    if [[ $in_what -eq 1 ]]; then
      if [[ "$line" =~ ^(##\ Task|File\(s\):|What\ to\ implement:|TDD\ |Expected\ output|---) ]]; then
        in_what=0
        continue
      fi
      current_what="${current_what} ${line}"
      continue
    fi
  done < "$task_file"

  # Flush the last task block
  local _emitted
  _emitted="$(emit_contracts "$current_files" "$current_what")"
  [[ -n "$_emitted" ]] && all_contracts="${all_contracts}${_emitted}"$'\n'

  # Deduplicate and sort
  local contracts
  contracts="$(printf '%s' "$all_contracts" | grep -v '^$' | sort -u)"

  if [[ -z "$contracts" ]]; then
    echo "No contracts found" >&2
    exit 1
  fi

  printf '%s\n' "$contracts"
}

subcommand="$1"; shift || true;
case "$subcommand" in
  find-consumers)     cmd_find_consumers "$@" ;;
  extract-contracts)  cmd_extract_contracts "$@" ;;
  *) echo "Unknown subcommand: $subcommand (available: find-consumers, extract-contracts)" >&2; exit 64 ;;
esac
