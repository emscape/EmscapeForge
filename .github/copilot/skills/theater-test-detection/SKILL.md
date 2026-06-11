---
name: theater-test-detection
description: "Use when: reviewing test quality, auditing test-writer output, or investigating whether a test suite provides real protection or just the illusion of it."
argument-hint: "Optional: file path or test name to focus on"
user-invocable: true
---

# Theater Test Detection Skill

## What This Skill Does

Identifies "theater tests" — tests that appear to validate behavior but pass regardless of whether the implementation is correct.

**Core question**: "Can the implementation be wrong and this test still pass?"

- YES → Theater test → REJECT
- NO → Genuine test → APPROVE

## When to Use

- Reviewing test-writer output before approving implementation work
- Auditing an existing test suite for false confidence
- When a test passes but the feature is broken
- Before a release to verify tests are actually protective

## Procedure

### Step 1: Identify Test Type

Classify each test:
- **Deterministic**: Same input always produces same output (math, algorithms, transformations) → require exact value assertions
- **Non-deterministic**: Output varies (timestamps, randomness, external APIs) → ranges acceptable

### Step 2: Apply Core Question

For each test assertion:
1. Read what the assertion checks
2. Imagine a broken implementation that returns a wrong value
3. Ask: would this test still pass?
4. If YES → theater test

### Step 3: Check for Anti-Patterns

| Anti-Pattern | Example | Why It's Theater |
|---|---|---|
| Range check for deterministic value | `expect(result).toBeGreaterThan(0)` | Any positive value passes |
| Existence check | `expect(result).toBeDefined()` | `null` and wrong values pass |
| Type check only | `expect(typeof result).toBe('number')` | Wrong number passes |
| Mock verification without effect check | `expect(mock).toHaveBeenCalled()` | Doesn't verify what happened |
| Post-construction dependency replacement | `obj.dep = mockDep; expect(obj.dep.method())` | Tests the mock, not wiring |

### Step 4: Verify Error Messages Are Behavioral

When a test fails, its error message must answer:
1. What failed (test name)
2. Why (requirement violated)
3. Expected behavior (spec)
4. Actual behavior (what happened)
5. Guidance (how to fix — behavior, NOT implementation hints)

If Point #5 says "implement X using algorithm Y" → it's an implementation hint → reject.

### Step 5: Emit Verdict

For each test:
- APPROVED: "Can impl be wrong and pass?" = NO, exact values, behavioral error messages
- REJECTED: reason (anti-pattern found), suggested fix

## Output

```
## Theater Test Audit: <scope>

### Results
- APPROVED: <test name> — genuine assertion on exact value
- REJECTED: <test name> — range check for deterministic value; fix: use exact value `42`

### Summary
- Total audited: N
- Approved: N
- Rejected: N (blockers — fix before proceeding)

### Verdict
CLEAN — all tests are genuine
or
THEATER TESTS FOUND — fix before proceeding
```

## Next Steps After the Audit

- Fix rejected tests and re-run the audit
- Use the `tdd-cycle` skill to write new tests with theater detection built in
- Use the `qa-reviewer` agent for full pre-merge review
