---
applyTo: "**"
---

# Code Review Instructions

When reviewing code, apply these standards consistently.

If the best approach is unclear or you are unsure, ask Emily before proceeding.

## Review Order

Always review in this priority order:

1. **Correctness** — Does the code do what the requirements say?
2. **Tests** — Are tests present, meaningful, and not theater tests?
3. **Security** — OWASP Top 10 vulnerabilities
4. **Design** — DRY, SoC, no premature abstraction
5. **Performance** — Structural issues only (not micro-optimization)
6. **Style / Formatting** — Last, never first

## Theater Test Check (Required)

Before approving any test:

> "Can the implementation be wrong and the test still pass?"

If YES → theater test → request changes. A test that always passes regardless of implementation provides false confidence and is worse than no test.

Valid tests:
- Use exact expected values for deterministic logic (not `result > 0` but `result === 42`)
- Fail when the implementation is wrong
- Assert behavior, not implementation details

## Feedback Format

```markdown
**Issue**: [One-line description]
**Location**: [file.ts:42]
**Severity**: P0 | P1 | P2 | P3
**Explanation**: [Why this matters — the consequence, not just the rule]
**Suggestion**: [Specific recommendation, with example if useful]
```

Severity scale:
- **P0**: Blocker — security vulnerability, data loss risk, test that masks a bug
- **P1**: High — incorrect logic, missing error handling, missing tests for critical path
- **P2**: Medium — DRY violation, premature abstraction, file too long
- **P3**: Low — style, naming, documentation gap

## Security Checklist (OWASP Top 10)

Flag any of:
- [ ] SQL / NoSQL injection (unparameterized queries)
- [ ] XSS (unescaped user input in HTML/JS)
- [ ] Insecure deserialization
- [ ] Hardcoded secrets or credentials
- [ ] Missing authentication or authorization check
- [ ] Sensitive data in logs or error messages
- [ ] Missing input validation on external data

## Design Standards

Flag any of:
- [ ] Duplicated logic that should be extracted (DRY)
- [ ] A function doing more than one thing (SoC)
- [ ] Abstraction added before there are two concrete uses (YAGNI)
- [ ] `any` type without a comment explaining why (typed languages)
- [ ] File exceeding 500 lines
- [ ] Silent failure: `catch (e) {}` with no logging or re-throw

## Performance (Flag, Don't Micro-Optimize)

Only flag structural issues:
- O(n²) or worse in a hot path (linear search inside a loop)
- Synchronous I/O in an async context
- Unbounded memory growth (accumulating without eviction)
- Expensive computation on every render/tick without memoization

## Testing Requirements

- New features: >85% branch coverage
- All edge cases documented in tests
- Integration tests for critical paths
- No tests that only check "variable exists" or trivially pass

## Positive Feedback

Always note what is done well. A review that only criticizes is demoralizing and incomplete. Acknowledge good patterns, clean design, and clear tests.

## Do Not

- Approve a PR with a P0 finding unresolved
- Block a PR on P3 findings alone — suggest, don't require
- Re-implement the solution in the review comment — suggest direction, not a rewrite
- Assume intent — ask a clarifying question instead
