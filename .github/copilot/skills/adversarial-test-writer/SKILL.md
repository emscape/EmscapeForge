---
name: adversarial-test-writer
description: "Use when: writing tests for a new feature using adversarial separation — where the test author has no knowledge of how the implementation will work, only what behavior it must exhibit."
argument-hint: "Optional: requirements document or feature description"
user-invocable: true
---

# Adversarial Test Writer Skill

## What This Skill Does

Guides writing tests under adversarial TDD conditions: the test author is **blind to the implementation** and works only from behavioral specifications (WHAT, not HOW).

This separation forces tests to describe behavior, not verify implementation details — which produces genuine tests that fail when the implementation is wrong.

## When to Use

- Writing tests for a new feature before implementation begins
- Writing tests for a specification document or contract
- When you want maximum confidence that tests are genuine (not theater)
- When a separate person or agent will implement the code

## Core Constraint

**The test writer knows ONLY**:
- What the function/module is supposed to DO (observable behavior)
- What inputs it accepts
- What outputs or effects it must produce
- What error conditions it must handle

**The test writer does NOT know**:
- How the function will be implemented
- Which algorithms will be used
- What internal data structures will be chosen
- How modules will be organized internally

This blindness is intentional and protective — it prevents tests from being written to match the implementation.

## Procedure

### Step 1: Read the Behavioral Specification

Read only the behavioral specification (requirements, contracts, acceptance criteria). Do NOT read any existing implementation.

For each behavior, extract:
- Input: what the function/method receives
- Expected output: what it must return (exact values for deterministic problems)
- Expected effects: what side effects must occur
- Error conditions: what must happen when inputs are invalid or operations fail

### Step 2: Write Tests from Behavior Only

For each behavior:
1. Write the test description as a sentence: "When X is called with Y, it returns Z"
2. Provide exact expected values (not ranges) for deterministic problems
3. Write a self-documenting error message that explains:
   - What failed (test name)
   - Why (which requirement was violated)
   - Expected behavior (the spec)
   - Actual behavior (what happened)
   - Guidance (how to fix — behavior description only, no algorithm hints)

### Step 3: Apply Theater Test Check

Before finalizing each test:
- "Can the implementation be wrong and this test still pass?" — YES = rewrite
- Is the expected value exact or a range? If range for deterministic problem = rewrite
- Does the error message say HOW to implement? = remove the implementation hint

### Step 4: Emit Test Specification

For each test:
- Test name (describes behavior)
- Setup (inputs and initial state)
- Assertion (exact expected value or effect)
- Error message (5-point standard: what, why, expected, actual, guidance)

## Quality Gates

- [ ] Every assertion uses exact values for deterministic behaviors
- [ ] No implementation hints in guidance (WHAT, never HOW)
- [ ] Theater test check passed for every test: "Can impl be wrong and test pass?" = NO
- [ ] Error messages contain all 5 points
- [ ] Tests are isolated (no shared mutable state between tests)
- [ ] All error conditions covered (not just happy path)

## Output

A test specification with:
- Test file (failing tests only — no implementation)
- Coverage map (which requirements are tested by which test)
- Theater test audit summary

## Next Steps After Tests Are Written

- Hand off to an implementer who reads ONLY the test error messages, not the test source
- Use `theater-test-detection` skill to audit the tests independently
- Use `tdd-cycle` skill to track the RED → GREEN → COMMIT → REFACTOR cycle
