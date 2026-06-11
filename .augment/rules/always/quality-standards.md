---
description: Quality standards and workflow macros — always applied to every prompt.
always_apply: true
---

# Quality Standards (QS1–QS6)

## QS1 — TDD / BDD
- RED → GREEN → COMMIT → REFACTOR
- >85% test coverage required
- Edge cases are required, not optional
- **Theater Test Detection**: Ask "Can the implementation be wrong and the test still pass?" YES = reject.
- Deterministic problems: exact values, not ranges (`result === 42`, not `result > 0`)

## QS2 — DESIGN
- **DRY**: Don't Repeat Yourself
- **Separation of Concerns**: Each module has one reason to change
- **Functional**: Pure functions, immutable data, explicit errors, type safety
- **YAGNI**: Implement only what is required now

## QS3 — PATTERNS
Use established patterns (GoF, PoEAA). Flag reinventing the wheel. Prefer proven solutions.

## QS4 — FILES
≤500 lines per file. No shadowing. Clean imports. No production build warnings. Extract helpers early.

## QS5 — DATA ISOLATION
**Tests MUST NOT touch production data.**
- Tests use ephemeral stores only (in-memory, fixtures, temp DBs)
- Always use migrations for schema changes
- Enforce CI/CD gates before production deployment

## QS6 — CONSISTENCY
Once an approach is approved, do not change it mid-implementation. Flag divergence to the user first.

---

# Workflow Macros (M1–M5)

## M1 — ORIENT
Before touching any code: read README and guidelines, understand project structure, identify key files, ask clarifying questions. **Do not code yet.**

If the best approach is unclear or you are unsure, ask Emily before proceeding.

## M2 — DISCOVER CONTEXT
Explore relevant files, understand existing patterns and conventions, check existing tests, identify dependencies. Validate: "Here's what I found — does this match your mental model?"

## M3 — PLAN ONLY
Propose a concrete implementation plan, list files to create or modify, list tests to write (behavior, not implementation), flag risks. **Wait for user approval before proceeding.**

## M4 — TDD CYCLE
Execute only after M3 plan is approved:
1. Write failing tests (RED) — behavior-only guidance
2. Implement minimal code to pass (GREEN)
3. Commit: `WHY: ... EXPECTED: ...`
4. Refactor while tests stay green (REFACTOR)

## M5 — FINAL VALIDATION
All tests pass → coverage ≥85% → no linting warnings → all plan items completed → no stubs/TODOs in production → ask user for acceptance confirmation.
