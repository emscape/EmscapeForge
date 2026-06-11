---
name: integration-guard
description: "Use when: connecting two modules for the first time, replacing a stub with a real implementation, or verifying that two independently-developed pieces are compatible."
argument-hint: "Optional: producer module path, consumer module path"
user-invocable: true
---

# Integration Guard Skill

## What This Skill Does

Checks runtime wiring compatibility between two modules before they are connected or before a stub is replaced with a real implementation.

Inputs: producer module, consumer module, contract definition  
Output: Interface Audit, Assumption Gaps, Missing Tests, Verdict

## When to Use

- Before connecting two independently-developed modules
- When replacing a mock or stub with a real implementation
- When integration tests are failing and the cause is unclear
- After two separate work streams merge
- As part of release-readiness for features that cross module boundaries

## Procedure

### Step 1: Read Both Interfaces

1. Read the producer's public interface: return types, error types, signatures
2. Read the consumer's expectations: what it assumes about the producer's output
3. Note the environment each was tested in (mocked? real? in-memory?)

### Step 2: Interface Audit

Check for mismatches:

| Check | Producer | Consumer | Match? |
|-------|----------|----------|--------|
| Return type | `User \| null` | `User` | ❌ null not handled |
| Error type | throws `AuthError` | catches `Error` | ⚠️ partial match |
| Async vs sync | Promise | awaited | ✓ |
| Required fields | `{ id, name, role }` | uses `id, name` | ✓ |

### Step 3: Assumption Gap Analysis

For each mismatch:
- What does the consumer assume that the producer doesn't guarantee?
- What error paths exist in the producer that the consumer doesn't handle?
- What state changes does the producer make that the consumer depends on?

### Step 4: Integration Test Check

For each connected interface:
- Does an integration test exist that goes through both modules together?
- Does the test use the real (not mocked) implementation of both?
- Does the test cover the error paths and edge cases from Step 3?

Missing integration tests = blockers.

### Step 5: Emit Verdict

- **READY**: All interfaces match, all gaps handled, integration tests exist
- **GAPS FOUND**: Interface mismatches or missing tests — list each with fix
- **BLOCKED**: Critical incompatibility — requires design change before wiring

## Output

```
## Integration Guard Report: <producer> ↔ <consumer>

### Interface Audit
- [MATCH/MISMATCH] <field>: producer returns X, consumer expects Y

### Assumption Gaps
- Consumer assumes X, but producer does not guarantee it

### Missing Tests
- No test covers the case where producer returns null

### Verdict
READY | GAPS FOUND | BLOCKED
```

## Next Steps After the Guard

- Fix gaps and re-run the guard
- Use the `integration-architect` agent to design an adapter if a gap requires structural change
- Use `release-readiness` as the final gate before shipping
