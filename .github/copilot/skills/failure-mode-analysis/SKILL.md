---
name: failure-mode-analysis
description: "Use when: auditing error handling before shipping, investigating a silent failure, or reviewing async/IO code for unhandled rejection paths."
argument-hint: "Optional: file path or module name to focus on"
user-invocable: true
---

# Failure Mode Analysis Skill

## What This Skill Does

Systematically maps how code can fail and whether those failures are handled, propagated, or silently swallowed.

This skill produces a failure map. It does not implement fixes.

## When to Use

- Before shipping a feature that handles external data, user input, or async operations
- When a bug report describes silent behavior ("it just didn't work")
- When reviewing code that wraps I/O, API calls, or file reads
- As part of release-readiness checks

## Procedure

### Step 1: Identify Failure Surfaces

Scan the code for:
- All `async` / `await` operations and Promise chains
- All I/O operations (file reads/writes, DB queries, network calls)
- All external API calls
- All user input consumption points
- All try/catch blocks

### Step 2: For Each Failure Surface

| Question | Acceptable | Not Acceptable |
|---|---|---|
| Is there error handling? | try/catch with logging and recovery | bare `catch (e) {}` |
| Is the error propagated? | re-throws or returns error type | swallowed silently |
| Is the user notified? | error state shown or logged | fails silently |
| Is partial state possible? | atomic or rolled back | half-written state |

### Step 3: Classify by Severity

- **Critical**: Data loss, crash, or security breach
- **High**: Wrong result returned, feature completely broken
- **Medium**: Degraded UX, partial functionality
- **Low**: Edge case, cosmetic, non-blocking

### Step 4: Check for Silent Failure Patterns

Flag all instances of:
- `catch (e) {}` — error swallowed with no action
- `catch (e) { return null; }` — error converted to null without logging
- Unhandled Promise rejection (no `.catch()`, no `try/await`)
- Optional chaining that hides errors (`obj?.method?.()` without null check downstream)
- Watermarks or state updated before confirming write success

### Step 5: List Missing Tests

For each failure mode found: is there a test that verifies the error path behaves correctly?

Missing tests for Critical/High failures = blocker.

## Output

```
## Failure Mode Report: <scope>

### Failure Inventory
- **Location**: file + function + line
- **Trigger**: what causes this failure
- **Current behavior**: crash | silent skip | wrong result | partial state
- **Expected behavior**: what should happen
- **Severity**: Critical | High | Medium | Low

### Silent Failure Risks
[list of swallowed exceptions or unhandled rejections]

### Missing Tests for Failure Cases
[list of failure modes with no corresponding test]

### Summary
- Critical: N | High: N | Medium: N | Low: N
- Verdict: SHIP | FIX BEFORE SHIP | REDESIGN
```

## Next Steps After the Analysis

- Fix Critical and High findings before shipping
- Write tests for each identified failure path (use `tdd-cycle` skill)
- Use `release-readiness` for final gate before shipping
