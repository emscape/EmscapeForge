---
description: Performance rules — auto-attached when editing collection-processing or data-loading code.
# Verify the correct frontmatter field with Augment docs: glob vs globs vs filePattern
glob: "**/services/**,**/repositories/**,**/queries/**,**/data/**,**/store/**,**/reducers/**"
---

# Performance Rules (Data / Services)

You are editing code that processes collections or loads data. These rules apply.

If the best approach is unclear or you are unsure, ask Emily before proceeding.

## The Bar

> "Will this cause a noticeable problem with real data?"

Only flag structural problems — not micro-optimization. P3 findings are suggestions, not blockers.

## Anti-Patterns to Catch

| Pattern | Example | Why It's a Problem |
|---|---|---|
| Nested loops | `items.forEach(i => others.find(...))` | O(n²) — fails at scale |
| Linear search in a loop | `find`/`filter` inside `forEach` | O(n²) |
| Synchronous I/O in async context | `fs.readFileSync` in a request handler | Blocks event loop |
| Unbounded accumulation | `log.push(e)` with no eviction | Memory leak |
| Loading full dataset for partial display | `SELECT *` when paginating | Memory + latency |
| Missing memoization | Expensive calculation in render/tick | Recalculates every call |
| Missing debounce | API call on every keystroke | N requests per keystroke |

## Priority Scale

- **P1**: Ships broken at scale — fix before merging
- **P2**: Degrades under realistic load — fix this sprint
- **P3**: Improvement opportunity — suggest, don't block

Never block a merge on P3 findings alone.
