---
description: Theater test detection reference — @mention when auditing test quality or reviewing adversarial TDD output.
---

# Theater Test Detection Reference

**Usage**: @mention this file when reviewing test quality or running a test audit.

If the best approach is unclear or you are unsure, ask Emily before proceeding.

## Core Question

> "Can the implementation be wrong and this test still pass?"
- **YES** → Theater test → REJECT
- **NO** → Genuine test → APPROVE

## Theater Test Patterns

### Range check for deterministic value
```typescript
// THEATER — any positive number passes:
expect(result).toBeGreaterThan(0)

// GENUINE — only correct value passes:
expect(result).toBe(42)
```

### Existence check
```python
# THEATER — undefined, null, and wrong values all pass:
assert result is not None

# GENUINE:
assert result == expected_value
```

### Type check only
```typescript
// THEATER — wrong number passes:
expect(typeof result).toBe('number')

// GENUINE:
expect(result).toBe(42)
```

### Mock verification without effect check
```python
# THEATER — verifies wiring, not behavior:
expect(mock).toHaveBeenCalled()

# GENUINE — verifies the downstream effect:
expect(database.find(id)).toEqual(expectedRecord)
```

### Post-construction dependency replacement (Integration theater)
```python
# THEATER — replaces dependency AFTER construction, bypasses __init__ wiring:
pool = Pool()
pool.timeout_manager = mock_timeout_manager
assert pool.timeout_manager.is_monitoring()  # tests the mock, not the wiring

# GENUINE — tests through actual construction path:
pool = Pool(timeout_manager=mock_timeout_manager)
assert pool.timeout_manager.is_monitoring()  # verifies __init__ calls start_monitoring()
```

## Detection Steps

1. Identify whether the problem is deterministic (same input → same output)
2. For each assertion: imagine a broken implementation returning a wrong value
3. Ask: would this assertion still pass? YES → theater
4. Check that error messages describe behavior (WHAT), not implementation (HOW)

## Error Message Quality (5-point standard)

When a test fails, its message must answer:
1. What failed (test name)
2. Why (requirement violated)
3. Expected behavior
4. Actual behavior
5. Guidance (behavioral — never implementation hints)

If Point 5 says "use algorithm X" → remove it (implementation hint).

## Verdict Format

```
APPROVED: <test> — genuine assertion, exact value, behavioral error message
REJECTED: <test> — <reason>; fix: <specific suggestion>
```
