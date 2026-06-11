---
name: release-readiness
description: "Use when: about to tag a release, cut a branch, or ship a distributable. Runs all required gates and emits a PASS/FAIL checklist."
argument-hint: "Optional: release type (alpha | beta | stable)"
user-invocable: true
---

# Release Readiness Skill

## What This Skill Does

Validates that the project is in a shippable state by running through all required gates before a release is tagged or a build is distributed.

Produces a PASS/FAIL checklist per gate with a final verdict.

## When to Use

- Before tagging a release version (`git tag vX.Y.Z`)
- Before building a distributable or publishing a package
- After completing a milestone or sprint
- When asked "is this ready to ship?"

## Procedure

### Step 1: Determine Release Type

- **alpha**: Must pass Gates 1–4
- **beta**: Must pass Gates 1–4, Gate 5 is advisory
- **stable**: ALL gates must pass

### Step 2: Run Each Gate

#### Gate 1: Test Suite
- [ ] All tests pass (`{{TEST_COMMAND}}`)
- [ ] No skipped tests without documented reason
- [ ] Coverage ≥85% on changed files

#### Gate 2: Type Safety / Static Analysis
- [ ] Type checker exits 0 (`{{TYPECHECK_COMMAND}}`)
- [ ] No `any` types introduced without comment (typed languages)
- [ ] No linting errors in production build

#### Gate 3: Security
- [ ] No hardcoded secrets or credentials
- [ ] No unvalidated user input reaching sensitive operations
- [ ] Dependency audit clean (`{{AUDIT_COMMAND}}`)
- [ ] No new OWASP Top 10 vulnerabilities introduced

#### Gate 4: Architecture
- [ ] No boundary violations (inner layer importing from outer)
- [ ] No business logic in UI layer
- [ ] No circular dependencies

#### Gate 5: Build
- [ ] Build exits 0 (`{{BUILD_COMMAND}}`)
- [ ] No console errors in production build
- [ ] Build artifacts present and correct size

#### Gate 6: Completeness
- [ ] All acceptance criteria from the feature plan are met
- [ ] No stubs, TODOs, or `FIXME`s in production code
- [ ] No silent failures (`catch (e) {}`) introduced

### Step 3: Emit Verdict

```
## Release Readiness: {{release_type}}

| Gate | Status | Notes |
|------|--------|-------|
| 1. Test Suite | ✓ PASS / ✗ FAIL | |
| 2. Type Safety | ✓ PASS / ✗ FAIL | |
| 3. Security | ✓ PASS / ✗ FAIL | |
| 4. Architecture | ✓ PASS / ✗ FAIL | |
| 5. Build | ✓ PASS / ✗ FAIL | |
| 6. Completeness | ✓ PASS / ✗ FAIL | |

Verdict: READY TO SHIP | BLOCKED (list issues)
```

## Scope Options

- **Full scan** (default) — all gates
- **`quick`** — Gates 1 and 2 only (fast check during development)
- **`security`** — Gate 3 only
- **`pre-merge`** — Gates 1, 2, 4 only (before PR merge)

## Output

A markdown checklist with PASS/FAIL per gate, list of blocking issues, and final verdict.

## Next Steps After the Report

- Fix blocking issues and re-run the skill
- Use `integration-guard` to verify module boundaries (Gate 4)
- Use `theater-test-detection` to verify test quality (Gate 1)
- Tag the release once all required gates pass
