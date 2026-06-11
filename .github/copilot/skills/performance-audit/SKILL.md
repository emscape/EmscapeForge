---
name: performance-audit
description: "Use when: reviewing code for structural performance problems before shipping, investigating user-reported slowness, or checking that a new data-processing feature won't degrade at scale."
argument-hint: "Optional: file path or feature name to audit"
user-invocable: true
---

# Performance Audit Skill

## What This Skill Does

Identifies structural performance problems in code before they ship. Focuses on patterns that cause noticeable degradation with real data — not theoretical micro-optimization.

**Bar**: "Will this cause a noticeable problem with real data?" — not "could this theoretically be faster?"

## When to Use

- Before shipping a feature that processes collections, files, or unbounded data
- When users report the app is slow or unresponsive
- After implementing a new data-loading or rendering path
- When a function is called on every render, tick, or event
- As part of release-readiness for data-intensive features

## Procedure

### Step 1: Identify Hot Paths

Hot paths are code that executes frequently:
- Every render / every tick / every keystroke
- Inside loops over user data
- On every request (server) or every frame (UI)
- On startup with large datasets

Cold paths (one-time operations, rare events) do not need performance optimization.

### Step 2: Check Anti-Patterns in Hot Paths

| Anti-Pattern | Example | Impact |
|---|---|---|
| Nested loops | `items.forEach(i => others.find(j => ...))` | O(n²) — fails at scale |
| Linear search inside a loop | `forEach` + `find`/`filter` | O(n²) |
| DOM queries in loops | `querySelector` inside `forEach` | Causes reflow per item |
| Synchronous I/O in async context | `fs.readFileSync` in request handler | Blocks event loop |
| Recreating large objects on every call | `new Map(largeArray)` in render | GC pressure |
| Loading full dataset for partial display | `SELECT *` when paginating | Memory + latency |
| Missing debounce on high-frequency events | `onKeyUp → API call` | N requests per keypress |
| Unbounded accumulation | `log.push(entry)` with no eviction | Memory leak |
| Missing memoization | Expensive computation in render | Recalculates every render |

### Step 3: Estimate Worst Case

For each anti-pattern found:
- What is the current data volume?
- What is 10x? 1000x?
- At what point does this become noticeable (>100ms) or catastrophic (>1s)?

### Step 4: Classify by Priority

- **P1**: Ships broken at scale — will fail with expected production data
- **P2**: Degrades under load — noticeable with realistic growth
- **P3**: Improvement opportunity — currently fine, could be better

### Step 5: Emit Audit Report

For each finding:
```
**Location**: file + line
**Pattern**: nested loop / missing memoization / etc.
**Worst case**: With 1000 items: ~X operations, ~Xms
**Fix**: Use Map for O(1) lookup / memoize with useMemo / paginate query
**Priority**: P1 | P2 | P3
```

Final verdict:
- **SHIP**: No P1 or P2 findings
- **REVIEW P1s**: P1 findings must be addressed before shipping
- **BLOCKED**: Critical structural issue requires redesign

## Scope Options

- **Full audit** (default) — all files in scope
- **`hot-paths`** — only code called on every render/tick/event
- **`collections`** — only code processing arrays, lists, or database results
- **`async`** — only async/IO code paths

## Output

Audit report with findings by priority, worst-case estimates, and a verdict.

## Next Steps After the Audit

- Fix P1 findings before shipping
- Add performance regression tests for P1 fixes
- Use `release-readiness` skill to run the full pre-ship checklist
