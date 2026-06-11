---
description: Design by Contract reference — @mention when writing behavioral contracts (PRE/POST/INV/SEQ).
---

# Design by Contract Reference

**Usage**: @mention this file when writing or reviewing behavioral contracts for public methods.

If the best approach is unclear or you are unsure, ask Emily before proceeding.

## Core Principle

Type signatures are NOT contracts. A type says what shape a value has. A contract says what *properties* it has.

```python
# Type hint (structural):
def get_user(user_id: str) -> dict: ...

# Contract (behavioral):
def get_user(user_id: str) -> dict:
    """
    PRE:  user_id is non-empty UUID v4 string
    POST: Returns dict with keys ["id", "name", "email"] where id == user_id
    INV:  Database connection remains open
    ERRORS: Raises UserNotFoundError if user_id not in database
    """
```

## Contract Clauses

**PRE** — What MUST be true BEFORE calling:
```
PRE: user_id is non-empty string
PRE: amount > 0
PRE: caller has write permission
```

**POST** — What MUST be true AFTER calling:
```
POST: Returns list of exactly N items where N == input length
POST: Database record with id == returned_id exists
POST: Event published to queue
```

**INV** — What MUST remain unchanged THROUGHOUT:
```
INV: Total balance unchanged (transfer operation)
INV: List remains sorted
INV: Connection pool size unchanged
```

**ERRORS** — What exceptions and when:
```
ERRORS: Raises ValueError if amount <= 0
ERRORS: Returns None (does not raise) if not found
```

**SEQ** — Integration sequencing obligations (who calls whom, when):
```
SEQ-1: __init__ MUST call timeout_manager.start_monitoring()
       Source: REQ-2026-005
SEQ-2: on_close() MUST call pool.release() for ALL references
```

SEQ is for integration contracts. The calling sequence IS the behavior — it cannot be faked by mocks.

## Theater Contract Check

For each POST clause: "Can the implementation return the wrong value and this clause still hold?"
- YES → too vague, tighten it
- `POST: returns dict` → theater (any dict passes)
- `POST: returns dict with keys ["id", "name"] where id == input_id` → genuine

## Test Traceability

Every test must cite the clause it enforces:
```python
def test_get_user_has_required_fields():
    """Enforces: POST-1 (returns dict with id, name, email)"""
    result = get_user(valid_id)
    assert result["id"] == valid_id  # POST-1
    assert "name" in result          # POST-1
```

## Contract Tiers

| Tier | Scope | When to Write |
|---|---|---|
| 1 — Behavioral | Observable state changes at module boundaries | User-facing requirements |
| 1.5 — Integration (SEQ) | Sequencing between components | Integration points |
| 2 — Structural | Data formats at external trust boundaries | External provider changes |
| 3 — Implementation | Low-level details (trace back to Tier 1) | Discovered during implementation |
