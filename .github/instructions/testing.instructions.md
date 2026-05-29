---
applyTo: "**/*.test.ts"
---

# Testing Guidelines

When writing tests in this project:

## TDD-First Approach
- **Write failing test BEFORE implementation** (RED phase)
- Run test to confirm it fails for the right reason
- Implement minimal code to make test pass (GREEN phase)
- Refactor while keeping tests green (REFACTOR phase)

## Test Structure
- Use descriptive test names: "it should [expected behavior] when [condition]"
- Follow Arrange-Act-Assert pattern:
  - **Arrange**: Set up test data and preconditions
  - **Act**: Execute the code under test
  - **Assert**: Verify the expected outcome

## Best Practices
- One assertion per test (or closely related assertions)
- Test edge cases and error scenarios
- Mock external dependencies (APIs, databases, file system)
- Use fixtures for complex test data
- Keep tests fast and independent

## Coverage
- Aim for 80%+ code coverage
- Focus on testing behavior, not implementation details
- Test public interfaces, not private methods
- Include integration tests for critical paths

## Security Testing
- Test input validation and sanitization
- Verify authentication and authorization
- Test error messages don't leak sensitive data
- Include security-specific test cases for OWASP Top 10
