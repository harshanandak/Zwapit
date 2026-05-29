---
applyTo: "**/*.ts"
---

# TypeScript Guidelines

When working with TypeScript files in this project:

## Type Safety
- **strict mode is enabled** - No shortcuts with types
- Avoid `any` type - Use `unknown` and type guards instead
- Prefer interfaces over type aliases for object shapes
- Use const assertions for literal types

## Code Style
- Use explicit return types for public functions
- Leverage type inference for local variables
- Use utility types (`Partial`, `Pick`, `Omit`, etc.) appropriately
- Document complex types with JSDoc comments

## Common Patterns
- Use discriminated unions for state management
- Prefer `readonly` for immutable data
- Use `unknown` instead of `any` for truly unknown types
- Leverage template literal types for string validation

## Error Handling
- Create custom error types for domain-specific errors
- Use type guards to narrow error types
- Always type catch clauses (`catch (error: unknown)`)
