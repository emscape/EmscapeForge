---
name: design-by-contract
description: "Use when: writing behavioral contracts for public methods, specifying integration obligations between components, or ensuring tests enforce observable contracts rather than implementation details."
argument-hint: "Optional: method name or module path to write contracts for"
user-invocable: true
---

# Design by Contract Skill

## What This Skill Does

Generates behavioral contracts (PRE/POST/INV/SEQ) for public methods and integration points. Contracts specify WHAT the code guarantees — not HOW it works.

**Key principle**: Type signatures are not contracts. A type says what type a return value is. A contract says what *properties* the return value has.

## When to Use

- Before writing tests for a public method or module boundary
- When specifying integration obligations between two components
- When reviewing whether a test suite enforces real behavior or just types
- Before implementing a new feature (specify the contract first, then test, then implement)

## Procedure

### Step 1: Identify the Contract Type

**Tier 1 — Behavioral Contracts**: Observable state changes at module boundaries
```
POST: Returns dict with keys ["id", "name", "email"] where id == input_id
```

**Tier 1.5 — Integration Contracts (SEQ)**: Calling sequence obligations between components
```
SEQ-1: __init__ MUST call timeout_manager.start_monitoring()
```

**Tier 2 — Structural Contracts**: Data formats at trust boundaries (external APIs)
```
"Response conforms to RFC 7519 JWT structure"
```

**Tier 3 — Implementation Tests**: Low-level details discovered during implementation (trace back to a Tier 1 contract)

### Step 2: Write the Contract

For each public method, write:

```
PRE:  [What must be true BEFORE calling this method]
POST: [What must be true AFTER calling this method]
INV:  [What must remain unchanged THROUGHOUT execution]
SEQ:  [WHO must call WHOM, WHEN — for integration points]
ERRORS: [What exceptions may be raised and when]
```

**Theater Contract Check** — for each POST clause: "Can the implementation return the wrong value and this clause still be satisfied?" YES = too vague, tighten it.

### Step 3: Write Tests That Enforce the Contracts

Each test must cite the clause it enforces:

```javascript
test('POST-1: returns user with required fields', () => {
  // Enforces: POST-1 (returns object with id, name, email)
  const user = getUser(validId);
  expect(user.id).toBe(validId);
  expect(user.name).toBeDefined();
  expect(user.email).toMatch(/^.+@.+\..+$/);
});
```

For SEQ contracts: tests MUST use the actual construction/lifecycle path, not direct method calls.

```python
# WRONG (theater — tests the mock, not the wiring):
pool = Pool()
pool.timeout_manager = mock  # Bypasses __init__

# CORRECT (tests through actual construction):
pool = Pool(timeout_manager=mock)
assert pool.timeout_manager.is_monitoring()  # Verifies __init__ calls start_monitoring()
```

### Step 4: Emit Contracts

```
## Contracts: <MethodName>

PRE-1: <constraint>
POST-1: <guarantee>
POST-2: <guarantee>
INV-1: <invariant>
SEQ-1: <sequencing obligation> — Source: <req ID>
ERRORS: <exception and trigger>
```

## Output

A contract document for each specified method or module boundary, ready to use as the basis for test specifications.

## Next Steps After Contracts

- Use the `tdd-cycle` skill to write tests that enforce the contracts
- Use the `theater-test-detection` skill to verify the tests are genuine
- Use the `integration-guard` skill to verify SEQ contracts are satisfied at runtime
