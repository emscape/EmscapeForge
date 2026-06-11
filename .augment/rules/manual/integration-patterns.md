---
description: Integration architecture patterns — @mention when connecting two independently-developed modules or verifying runtime wiring.
---

# Integration Patterns Reference

**Usage**: @mention this file when wiring two modules together, replacing a stub with a real implementation, or investigating an integration failure.

If the best approach is unclear or you are unsure, ask Emily before proceeding.

## Contract-First Wiring

Before writing any wiring code, define the contract at the boundary:

```
Producer: returns Type | null
Consumer: expects Type

Gap: consumer does not handle null
Fix: add null-handling adapter, or update consumer to accept null
```

## Dependency Direction Rules

- Inner layers must NOT import from outer layers
- If wiring requires an inner → outer dependency: apply dependency inversion
- No circular dependencies — ever

```
Allowed:   UI → Domain → Data
Forbidden: Domain → UI
Fix:       Define an interface in Domain; UI implements it
```

## SEQ Contracts (Integration Obligations)

When two components have a lifecycle dependency, define a SEQ contract:

```
SEQ-1: ComponentA.__init__ MUST call componentB.start()
       Test: construct ComponentA and verify componentB.start was called
             (NOT: call componentB.start() directly)
```

## Integration Test Requirements

Every integration between two modules requires:
1. A test that goes through BOTH modules (not mocked separately)
2. Coverage of the error path (what happens when one side fails)
3. Coverage of the null/missing case if the producer can return null

Missing integration test = blocker before shipping.

## Common Gaps

| Gap | Symptom | Fix |
|---|---|---|
| Type mismatch | Runtime error on field access | Add adapter or update contract |
| Null not handled | NPE/undefined downstream | Null-handling at boundary |
| Error not propagated | Silent failure | Re-throw or handle explicitly |
| Async/sync mismatch | Unresolved promise used as value | Await the producer |
| Event contract mismatch | Consumer doesn't receive events | Align event name/shape |

## Verification Checklist

- [ ] Contract defined (types + postconditions at boundary)
- [ ] Null/error cases handled by consumer
- [ ] No circular dependency introduced
- [ ] Integration test exists (real implementations, not mocks)
- [ ] Dependency direction respects layer hierarchy
