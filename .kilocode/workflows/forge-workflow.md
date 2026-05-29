---
description: "Forge workflow for Kilo Code"
---

# Forge Workflow Framework - Kilo Code

This project uses the **Forge 7-Stage TDD Workflow** with Kilo Code native workflows.

## Quick Start

```bash
npm install      # Install dependencies
npm test            # Run tests
npm run build           # Build project
```

## Native Kilo Surface

Kilo Code uses native workflows, rules, and skills. Forge generates:
- `.kilocode/workflows/forge-workflow.md`
- `.kilocode/rules/workflow.md`
- `.kilocode/skills/forge-workflow/SKILL.md`

These complement the Forge workflow stages below.

## Forge 7-Stage TDD Workflow

### Utility: /status
Check current context and active work
- Review git status and recent commits
- Check Beads issues (if installed)

### Stage 1: /plan
Create implementation plan
- Research with web search
- Document findings in `docs/work/YYYY-MM-DD-<feature-slug>/design.md`
- Security: OWASP Top 10 analysis
- Generate plan, create Beads issue, break into TDD cycles

### Stage 2: /dev
**TDD development (RED-GREEN-REFACTOR)**
- **RED**: Write failing test FIRST
- **GREEN**: Implement minimal code to pass
- **REFACTOR**: Clean up and optimize
- Commit after each cycle

### Stage 3: /validate
Validation (type/lint/tests/security)
- Type checking
- Linting (ESLint)
- Security scanning
- Test suite (all tests must pass)
- Code coverage (80%+ required)

### Stage 4: /ship
Create pull request
- Generate PR body with context
- Reference Beads issues
- Include test coverage metrics

### Stage 5: /review
Address ALL PR feedback
- GitHub Actions failures
- Code review comments
- AI review tools
- Resolve all comment threads

### Stage 6: /premerge
Merge and cleanup
- Update documentation
- Merge PR (squash commits)
- Delete feature branch
- Close Beads issues

### Stage 7: /verify
Final documentation verification
- Verify all docs updated
- Check for broken links
- Validate code examples
