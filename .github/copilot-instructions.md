# Forge Workflow Framework

This project uses the **Forge 7-Stage TDD Workflow** for development with GitHub Copilot.

## Quick Start

```bash
npm install      # Install dependencies
npm test            # Run tests
npm run build           # Build project
```

## Tech Stack

- **Language**: JavaScript
- **Package Manager**: npm
- **Testing**: TDD-first approach (tests before implementation)
- **Security**: OWASP Top 10 compliance required
- **Version Control**: Git with conventional commits

## Forge 7-Stage TDD Workflow

### Utility: /status
Check current context and active work
- Review git status and recent commits
- Check Beads issues (if installed) for active work
- Identify current workflow stage

### Stage 1: /plan
Create implementation plan
- Research with web search
- Document findings in `docs/plans/<feature-slug>-design.md`
- **Security**: Identify OWASP Top 10 considerations
- Generate plan, create Beads issue, break into TDD cycles

### Stage 2: /dev
**TDD development (RED-GREEN-REFACTOR)**
- **RED**: Write failing test FIRST
- **GREEN**: Implement minimal code to pass
- **REFACTOR**: Clean up and optimize
- Commit after each cycle
- Push regularly to remote

### Stage 3: /validate
Validation and quality gates
- Type checking
- Linting (ESLint - no errors allowed)
- Security scanning (npm audit, OWASP checks)
- Test suite (all tests must pass)
- Code coverage verification (80%+ required)

### Stage 4: /ship
Create pull request
- Generate PR body with context
- Reference Beads issues
- Include test coverage metrics
- Link to research and plan documents

### Stage 5: /review
Address ALL PR feedback
- GitHub Actions failures
- Code review comments
- AI review tools (Greptile, CodeRabbit if configured)
- Security scan results
- **IMPORTANT**: Resolve all comment threads before merge

### Stage 6: /premerge
Merge and cleanup
- Update documentation
- Merge pull request (squash commits only)
- Delete feature branch
- Archive completed work
- Close Beads issues

### Stage 7: /verify
Final documentation cross-check
- Verify all docs updated correctly
- Check for broken links
- Validate code examples
- Ensure consistency across documentation

## Core Principles

### 1. TDD-First Development (MANDATORY)
- Tests written UPFRONT in RED-GREEN-REFACTOR cycles
- **NO implementation without failing test first**
- Commit after each GREEN cycle
- Maintain high code coverage (80%+ minimum)

### 2. Research-First Approach
- All features start with comprehensive research
- Use web search for best practices and security analysis
- Document findings before implementation
- **Include OWASP Top 10 analysis for security-critical features**

### 3. Security Built-In
- **OWASP Top 10** analysis for every new feature:
  - A01: Broken Access Control
  - A02: Cryptographic Failures
  - A03: Injection
  - A04: Insecure Design
  - A05: Security Misconfiguration
  - A06: Vulnerable and Outdated Components
  - A07: Identification and Authentication Failures
  - A08: Software and Data Integrity Failures
  - A09: Security Logging and Monitoring Failures
  - A10: Server-Side Request Forgery (SSRF)
- Security test scenarios identified upfront
- Automated scans + manual review
- Input validation and sanitization

### 4. Documentation Progressive
- Updated at relevant stages (not deferred to end)
- Cross-checked at /verify stage
- Never accumulate documentation debt
- Keep README, docs/, and inline comments synchronized

## Git Workflow

**Branch naming**:
- `feat/<feature-slug>` - New features
- `fix/<bug-slug>` - Bug fixes
- `docs/<doc-slug>` - Documentation updates

**Commit pattern** (conventional commits):
```bash
git commit -m "test: add validation tests"     # RED phase
git commit -m "feat: implement validation"     # GREEN phase
git commit -m "refactor: extract helpers"      # REFACTOR phase
```

**Pre-commit hooks** (automatic via Lefthook):
- TDD enforcement (source files must have tests)
- Interactive prompts (option to unstage, continue, or abort)

**Pre-push hooks** (automatic):
- Branch protection (blocks direct push to main/master)
- ESLint check (blocks on errors)
- Test suite (all tests must pass)

## MCP Servers (Enhanced Capabilities)

Configure these MCP servers in `.mcp.json`:

- **github**: Repository integration (usually built-in)
- **parallel-ai**: Web research and data enrichment
- **context7**: Up-to-date library documentation

## Issue Tracking with Beads

Use **Forge's Beads wrapper** for persistent tracking across sessions:

```bash
forge create "Feature name"                # Create issue
forge claim <id>                           # Claim work
forge update <id> --append-notes "Progress" # Add notes
forge close <id>                           # Complete
forge sync                                 # Sync Beads state
```

Use `bd` directly only for capabilities Forge does not wrap yet, such as
`bd init`, `bd comments`, `bd dep`, and `bd dolt`.

## Code Quality Standards



### Testing
- TDD-first: Write failing test BEFORE implementation
- Use descriptive test names ("it should...")
- Arrange-Act-Assert pattern
- Mock external dependencies
- Test edge cases and error scenarios

### Security
- Validate all user input
- Sanitize output to prevent XSS
- Use parameterized queries (prevent SQL injection)
- Implement proper authentication and authorization
- Never commit secrets or credentials

## Additional Resources

- **Workflow Guide**: `AGENTS.md`
- **Architecture**: `docs/ARCHITECTURE.md`
- **Configuration**: `docs/CONFIGURATION.md`
