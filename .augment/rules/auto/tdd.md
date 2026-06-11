---
description: TDD practices — auto-attached when editing test files.
# Verify the correct frontmatter field with Augment docs: glob vs globs vs filePattern
glob: "**/*.test.*,**/*.spec.*,**/*_test.*,**/*_spec.*,**/tests/**,**/test/**"
---

# TDD Rules (Test Files)

You are editing a test file. These rules apply with full force.

## Before Writing Any Test

If the best approach is unclear or you are unsure, ask Emily before proceeding.

**Theater Test Check** (mandatory):
> "Can the implementation be wrong and this test still pass?"
- YES → rewrite the test; it provides false confidence
- NO → proceed

**Behavioral guidance only**:
- Describe WHAT the code does (behavior, inputs, outputs)
- Never hint HOW the implementation should work (no algorithm hints)
- For deterministic problems: exact values only (`result === 42`, not `result > 0`)

## TDD Cycle

```
RED:    Write failing test → verify it fails
GREEN:  Implement minimal code → verify it passes
COMMIT: git commit (WHY/EXPECTED format) before refactoring
REFACTOR: improve structure → tests must stay green
```

## Test Quality Gates

- [ ] Test fails when implementation is wrong (not a theater test)
- [ ] Exact values for deterministic assertions
- [ ] Edge cases covered (not just happy path)
- [ ] Tests are isolated — no shared mutable state
- [ ] Error messages describe behavior (WHAT), not implementation (HOW)
- [ ] Coverage ≥85% on the module under test

## Anti-Patterns (Reject These)

```
expect(result).toBeDefined()          // existence check — theater
expect(result).toBeGreaterThan(0)     // range for deterministic value — theater
expect(mock).toHaveBeenCalled()       // wiring check without effect — theater
```
