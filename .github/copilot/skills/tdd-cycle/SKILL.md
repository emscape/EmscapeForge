---
name: tdd-cycle
description: "Use when: starting any new feature, fixing a bug, or implementing a behavioral change. Enforces RED → GREEN → COMMIT → REFACTOR with quality gates."
argument-hint: "Optional: feature description or test file path to focus on"
user-invocable: true
---

# TDD Cycle Skill

## What This Skill Does

Guides a complete Test-Driven Development cycle with constitutional quality gates:

1. **RED** — Write a failing test that describes the behavior
2. **GREEN** — Implement minimal code to pass the test
3. **COMMIT** — Commit with WHY/EXPECTED format before refactoring
4. **REFACTOR** — Improve structure while keeping tests green

## When to Use

- Starting any new feature or behavior
- Fixing a bug (write the failing test first, then fix)
- Adding behavior to an existing function
- Anytime the constitutional TDD mandate (CL6) applies — which is always

## Procedure

### Step 1: RED — Write the Failing Test

1. Describe the behavior in plain language: "When X happens, Y should result"
2. Write the test before any implementation
3. Run the test — it MUST fail (if it passes, you're not testing new behavior)
4. Apply the **Theater Test Check** before proceeding:
   - "Can the implementation be wrong and this test still pass?"
   - YES → rewrite the test; NO → proceed
   - Deterministic problems: exact values only (`result === 42`, not `result > 0`)

### Step 2: GREEN — Implement Minimal Code

1. Write the simplest code that makes the test pass
2. No premature optimization, no features not covered by the current test
3. Prefer clarity over cleverness
4. Run the test — it MUST pass

### Step 3: COMMIT — Commit the Green State

Commit before refactoring, using this format:

```
feat({{scope}}): <description>

WHY:
- Rationale for the change

EXPECTED:
- <test name> passes
- Observable behavior satisfied
```

### Step 4: REFACTOR — Improve While Green

1. Apply DRY, Separation of Concerns, remove duplication
2. Run tests after every change — they must stay green
3. If a refactor requires a behavior change: write a new test first (back to RED)
4. Commit the refactored state

## Quality Gates (Required Before Done)

- [ ] Test written before implementation
- [ ] Test initially failed (RED confirmed)
- [ ] Theater test check passed: "Can impl be wrong and test pass?" = NO
- [ ] Exact values used for deterministic assertions
- [ ] Minimal implementation only (YAGNI)
- [ ] Committed in GREEN state
- [ ] Refactor complete, tests still green
- [ ] Coverage ≥85%
- [ ] All edge cases covered

## Output

Per feature unit:
- Test file (with self-documenting error messages)
- Implementation file(s)
- Git commit with WHY/EXPECTED body
- Coverage report

## Language-Specific Test Commands

| Language | Run Tests | Coverage |
|----------|-----------|----------|
| Python | `pytest path/to/test.py -v` | `pytest --cov=module --cov-report=term-missing` |
| TypeScript/JS | `jest path/to/test.ts` | `jest --coverage` |
| Rust | `cargo test --lib module` | `cargo tarpaulin` |
| Go | `go test ./...` | `go test -cover ./...` |
| Java | `mvn test` | `mvn jacoco:report` |

## Next Steps After the Cycle

- Use the `theater-test-detection` skill to audit a batch of tests
- Use the `qa-reviewer` agent to verify coverage before a merge
- Use the `release-readiness` skill for final gate checks before shipping
