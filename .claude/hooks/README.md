# Claude Code Hooks — Portable Base Template

A repo-agnostic set of Claude Code hooks that enforce architecture rules, guard dependency installs, block .env reads, require terminal-command descriptions, validate commit-message format, unconditionally block PR/protected-branch merges, audit pushes for secrets, block deleting a branch a stacked PR still bases off, verify CI status after a push, validate content files, and print a project orientation banner at session start.

All behavior is controlled by **`config.json`** — no project logic is hardcoded in the hook scripts.

---

## Files

| File | Purpose |
|---|---|
| `config.json` | All project-specific configuration lives here |
| `check-arch-boundary.js` | PreToolUse: block file writes that violate package rules |
| `check-dep-guard.js` | PreToolUse: warn on dependency installs |
| `check-script-exists.js` | PreToolUse: warn/block when an npm run script doesn't exist; detect no-op commands |
| `check-env-guard.js` | PreToolUse: block reads of `.env` files |
| `check-bash-description.js` | PreToolUse: block Bash calls without a description |
| `check-commit-message.js` | PreToolUse: block `git commit` commands that do not include WHY/EXPECTED |
| `check-merge-guard.js` | PreToolUse: unconditionally block `gh pr merge`, a merge-REST `PUT`, a local `git merge` on master/main, or a push that lands commits directly on master/main |
| `check-git-push-audit.js` | PreToolUse: audit a `git push` diff for secrets (blocks), debug statements, commented-out code, lockfile drift, missing tests |
| `check-branch-delete-guard.js` | PreToolUse: block `git push --delete`/`:branch` when an open PR still bases off that branch |
| `check-search-command.js` | PreToolUse: nudge (or block) raw shell `grep`/`find`/`cat`/`head`/`tail` in favor of dedicated search/read tools |
| `validate-content.js` | PostToolUse: run validation after watched files change |
| `check-empty-tests.js` | PostToolUse: fail when test files have empty blocks or no assertions |
| `check-todo-format.js` | PostToolUse: warn/block on non-conforming TODO comment format |
| `check-ci-status-after-push.js` | PostToolUse: after a push, block until the matching GitHub Actions run completes and report the real result |
| `session-start.sh` | UserPromptSubmit: thin wrapper that invokes session-start.cjs |
| `session-start.cjs` | Reads config.json (via `__dirname`, not a shell-resolved path) and prints the project orientation banner |
| `hooks.json` | Human-readable reference copy of the settings.json hooks block |
| `check-branch-delete-guard.test.js`, `check-merge-guard.test.js` | Behavioral tests for the pure detection/extraction logic each guard exports — run with `node --test .claude/hooks/` |

The actual hook registration lives in **`.claude/settings.json`**, not `hooks.json`.

---

## Quick Start

### 1. Copy the hooks directory

```
cp -r .claude/hooks/ <your-project>/.claude/hooks/
```

### 2. Edit config.json

Open `.claude/hooks/config.json` and update:

- `project_name` — shown in the session banner
- `arch_rules` — set `enabled: true` and define your package boundary rules
- `content_watch` — set `enabled: true` and point to your content path + validation command
- `dep_guard` — enabled by default, extend `warn_patterns` if needed
- `empty_test_guard` — enabled by default, catches theater tests
- `todo_format` — set `enabled: true` to enforce TODO comment format
- `script_guard` — set `enabled: true` to validate npm run scripts before they run
- `bash_description_guard` — set `enabled: true` to require terminal command explanations
- `env_guard` — set `enabled: true` to block `.env` reads
- `commit_guard` — set `enabled: true` to require WHY/EXPECTED in git commit messages
- `merge_guard` — enabled by default, unconditionally blocks any command that merges a PR or lands commits on master/main
- `push_audit` — enabled by default, blocks pushes whose diff contains hardcoded secrets
- `branch_delete_guard` — enabled by default, blocks deleting a branch a stacked PR still bases off (requires `gh`)
- `ci_status_check` — enabled by default, blocks after a push until the matching CI run completes (requires `gh`)
- `search_guard` — enabled by default in warn mode, nudges away from raw shell `grep`/`find`/`cat`/`head`/`tail`
- `commands` — document your lint/test/typecheck commands (reference only)

### 3. Register hooks in settings.json

Merge the `hooks` block from `hooks.json` into your project's `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [{ "type": "command", "command": "node .claude/hooks/check-arch-boundary.js" }]
      },
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": "node .claude/hooks/check-bash-description.js" },
          { "type": "command", "command": "node .claude/hooks/check-dep-guard.js" },
          { "type": "command", "command": "node .claude/hooks/check-script-exists.js" },
          { "type": "command", "command": "node .claude/hooks/check-commit-message.js" },
          { "type": "command", "command": "node .claude/hooks/check-merge-guard.js" },
          { "type": "command", "command": "node .claude/hooks/check-git-push-audit.js" },
          { "type": "command", "command": "node .claude/hooks/check-branch-delete-guard.js" },
          { "type": "command", "command": "node .claude/hooks/check-search-command.js" }
        ]
      },
      {
        "matcher": "Read",
        "hooks": [{ "type": "command", "command": "node .claude/hooks/check-env-guard.js" }]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [
          { "type": "command", "command": "node .claude/hooks/validate-content.js" },
          { "type": "command", "command": "node .claude/hooks/check-empty-tests.js" },
          { "type": "command", "command": "node .claude/hooks/check-todo-format.js" }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [{ "type": "command", "command": "node .claude/hooks/check-ci-status-after-push.js" }]
      }
    ],
    "UserPromptSubmit": [
      {
        "matcher": "",
        "hooks": [{ "type": "command", "command": "bash .claude/hooks/session-start.sh" }]
      }
    ]
  }
}
```

### 4. Verify

Run the session banner manually to confirm config loads correctly:

```bash
bash .claude/hooks/session-start.sh
```

---

## Configuration Reference

### `arch_rules`

Enforce import restrictions across packages. Set `enabled: true` and define rules:

```json
"arch_rules": {
  "enabled": true,
  "rules": [
    {
      "package_path": "packages/core",
      "forbidden_imports": ["apps/ui", "apps/server"],
      "forbidden_frameworks": ["react", "vue"],
      "forbidden_content_pattern": null
    }
  ]
}
```

- `package_path` — substring matched against the file path being written
- `forbidden_imports` — import path substrings that must not appear in this package
- `forbidden_frameworks` — framework names matched as exact `from 'x'` imports
- `forbidden_content_pattern` — optional regex; triggers a violation if matched in file content

When a rule is violated, the hook exits 2 (block) and Claude Code sees the error and self-corrects.

---

### `content_watch`

Run a validation command after specific files are written:

```json
"content_watch": {
  "enabled": true,
  "path_pattern": "packages/content",
  "file_extensions": [".json", ".yaml"],
  "validate_command": "pnpm --filter content run validate"
}
```

- `path_pattern` — substring matched against the written file path
- `file_extensions` — only these extensions trigger validation (empty = all files in path)
- `validate_command` — shell command to run; must exit 0 on success

---

### `dep_guard`

Warn when a dependency install is detected:

```json
"dep_guard": {
  "enabled": true,
  "warn_patterns": ["npm install", "yarn add", "pnpm add", "pip install"],
  "custom_message": ""
}
```

- `warn_patterns` — case-insensitive substring list; any match triggers the warning
- `custom_message` — override the default warning text (optional)

This hook always exits 0 (non-blocking). It warns to stderr; Claude Code shows it to the model.

---

### `bash_description_guard`

Require a non-empty `description` on every Bash call:

```json
"bash_description_guard": {
  "enabled": true
}
```

No fields beyond `enabled`. Blocks (exit 2) any Bash call whose `tool_input.description` is
missing or empty — enforces the WHY/WHAT terminal-command discipline before a command runs.

---

### `env_guard`

Block reads of `.env` files:

```json
"env_guard": {
  "enabled": true
}
```

No fields beyond `enabled`. Blocks (exit 2) any `Read` call whose file path matches `.env` or
`.env.*`. Environment files carry secrets and must never be read into context.

---

### `search_guard`

Nudge (or block) raw shell search/read commands in favor of the assistant's own dedicated
search/read tools (Grep, Glob, Read or their equivalents), which return structured,
token-bounded results instead of dumping raw stdout into context:

```json
"search_guard": {
  "enabled": true,
  "commands": ["grep", "egrep", "fgrep", "rg", "find", "cat", "head", "tail"],
  "on_violation": "warn",
  "allow_patterns": []
}
```

- `commands` — binary names (matched as the leading word of a pipeline segment, not a substring)
  that trigger the check
- `on_violation` — `"warn"` prints to stderr (exit 0) | `"block"` exits 2 and rejects the tool call
- `allow_patterns` — substrings that, if present anywhere in the command, skip the check entirely
  (e.g. a known-legitimate build/CI command that happens to invoke `grep`/`cat` internally)

This is a nudge by default, not a hard rule — a model can talk itself past prose-only guidance, so
this makes the same guidance visible and, if you flip `on_violation` to `"block"`, enforceable.
Start with `"warn"`; only switch to `"block"` once you've confirmed it isn't firing on legitimate
shell usage (e.g. `grep` inside a script `validate_command`, `cat` used to build a file in a
pipeline) — `allow_patterns` is the escape hatch for those.

---

### `merge_guard`

Unconditionally block anything that would merge a PR or land commits on a protected branch:

```json
"merge_guard": {
  "enabled": true
}
```

No fields beyond `enabled` — deliberately not configurable with a per-command bypass flag, since
anything checkable from inside a Bash call is something the session itself could set, which would
defeat the point. Blocks (exit 2), every time, with no exceptions:

- `gh pr merge`
- a `gh api` `PUT` to a PR's `/merge` REST endpoint (a `GET` to the same path — checking merge
  state/method — is not blocked)
- a local `git merge` performed while on, or checking out to, `master`/`main`
- a `git push` (refspec or plain branch name) that lands commits directly on `master`/`main`,
  bypassing PR + merge entirely

This hook doesn't try to tell whether permission to merge was already given earlier in the
conversation — it can't read the chat, and it exists specifically because "no objections raised"
was once treated as implicit go-ahead to merge. The fix is procedural, not something a flag on the
command can satisfy: get an explicit yes in the conversation, then perform the merge somewhere
this hook can't intercept it — the GitHub PR page (or a terminal outside this session). The only
real bypass is flipping `merge_guard.enabled` to `false` in `config.json` — a separate, deliberate
file edit.

---

### `push_audit`

Audit a `git push`'s diff before it goes out:

```json
"push_audit": {
  "enabled": true
}
```

No fields beyond `enabled` (extend `check-git-push-audit.js` directly for different patterns).
Runs on every `git push`, auditing the diff (staged changes, or `HEAD~1`, or the empty tree for a
root commit) for:

| Check | Severity | Trigger |
|---|---|---|
| `secrets` | HIGH — blocks the push | API keys, passwords, tokens, private keys in added lines |
| `debug_statements` | MEDIUM (reported only) | `console.log`, `debugger`, `pprint` in non-test files |
| `commented_code` | LOW (reported only) | 3+ commented-out code lines added in a single file |
| `lockfile_drift` | MEDIUM (reported only) | `package.json` changed without a lockfile update |
| `missing_tests` | MEDIUM (reported only) | source files changed with zero test file changes |

Only the `secrets` check actually blocks (exit 2); everything else is reported to stderr but
non-blocking.

---

### `branch_delete_guard`

Block deleting a branch a stacked PR still bases off:

```json
"branch_delete_guard": {
  "enabled": true
}
```

No fields beyond `enabled`. Fires on `git push <remote> --delete <branch>` and the `:branch`
shorthand — local `git branch -D` is intentionally out of scope, since that alone can't break a
GitHub PR's base. Deleting a branch that's still an open PR's base doesn't merge that PR; GitHub
auto-closes it instead (its commits usually aren't in the new target yet), and a closed PR's base
can't be retargeted — the only recovery is opening a brand-new PR from the same commits. Requires
the `gh` CLI, authenticated — fails open (allows, with a warning) if `gh` is unavailable, so a
stale check never blocks otherwise-normal work.

---

### `ci_status_check`

Block until the pushed commit's CI run actually finishes:

```json
"ci_status_check": {
  "enabled": true,
  "poll_interval_seconds": 5,
  "new_run_timeout_seconds": 60,
  "completion_timeout_seconds": 180
}
```

- `poll_interval_seconds` — how often to poll `gh run list` while waiting for a run to appear
- `new_run_timeout_seconds` — how long to wait for a run matching the just-pushed commit SHA to
  appear at all
- `completion_timeout_seconds` — currently unenforced; the hook waits via `gh run watch`, which
  blocks until the run finishes with no timeout flag of its own. Documented intent for a future
  implementer, not a working setting today.

Runs as a PostToolUse hook after a real `git push` and requires the `gh` CLI, authenticated. A
local test pass is not proof of a green remote run — this makes the wait for CI real instead of
implicit. If the repo has no GitHub Actions workflow, it harmlessly reports "no run found" once
per push and exits 1 informationally. Adds real wall-clock wait time to every push, roughly
however long CI takes to run.

---

### `empty_test_guard`

Prevent theater testing — test files with no assertions:

```json
"empty_test_guard": {
  "enabled": true,
  "test_file_patterns": ["*.test.*", "*.spec.*"],
  "block_empty_describe": true,
  "block_empty_it": true,
  "block_todo_tests": false
}
```

- `test_file_patterns` — filenames matching these patterns are inspected (glob-style, `*` matches anything except `/`)
- `block_empty_describe/it` — fail when empty describe/it blocks are found
- `block_todo_tests` — set to `true` in strict mode to reject `it.todo()` placeholders

---

### `todo_format`

Enforce a consistent TODO comment format:

```json
"todo_format": {
  "enabled": true,
  "required_pattern": "TODO\\([^)]+\\):",
  "on_violation": "warn"
}
```

- `required_pattern` — regex that every TODO line must match (default: `TODO(owner): description`)
- `on_violation` — `"warn"` prints to stderr and exits 0; `"block"` exits 1

---

### `script_guard`

Validate npm run scripts before they execute:

```json
"script_guard": {
  "enabled": true,
  "package_json_paths": ["package.json", "packages/api/package.json"],
  "on_missing": "warn"
}
```

- `package_json_paths` — list of package.json files to check for script names (extend for monorepos)
- `on_missing` — `"warn"` prints to stderr and exits 0; `"block"` exits 1 and stops the command
- Also detects trivial no-op commands (`true`, `exit 0`, empty echo) regardless of `enabled`

---

### `commit_guard`

Require WHY/EXPECTED sections in every commit message:

```json
"commit_guard": {
  "enabled": false,
  "required_markers": ["WHY:", "EXPECTED:"],
  "on_violation": "warn"
}
```

- `required_markers` — every listed string must appear somewhere in the commit message
- `on_violation` — `"warn"` prints to stderr (exit 0) | `"block"` exits 2 and rejects the tool call

---

### `commands`

Reference documentation for common commands (not auto-run):

```json
"commands": {
  "lint": "npm run lint",
  "test": "npm test",
  "typecheck": "npx tsc --noEmit"
}
```

These appear in the session banner when populated. To auto-run a command on file write, use `content_watch.validate_command` instead.

---

### `session_start`

Control the orientation banner:

```json
"session_start": {
  "custom_notes": [
    "Domain logic must not import from UI packages",
    "All API calls go through the service layer"
  ]
}
```

---

## How Hooks Work

Claude Code invokes each registered command when the matching tool is used.

- **Input**: the tool call JSON is delivered on **stdin** as:
  ```json
  { "tool_name": "Write", "tool_input": { "file_path": "...", "content": "..." } }
  ```
- **Exit codes**:
  - `0` — allow / pass
  - `1` — validation failed (PostToolUse: Claude Code is informed but not blocked)
  - `2` — block action (PreToolUse: Claude Code rejects the tool call, shows stderr)
- **Stderr** is shown to the model. Use it for actionable messages.

---

## Debugging

**Hook doesn't run at all**
- Check that `settings.json` has the hook registered
- Verify the matcher string matches the tool name exactly (e.g. `Write|Edit|MultiEdit`)

**"config.json not found" warning**
- The scripts locate config.json relative to the script path (`__dirname/config.json`)
- Ensure `config.json` is in the same directory as the `.js` scripts

**Arch check runs but never blocks**
- Confirm `arch_rules.enabled` is `true` in config.json
- Confirm at least one rule has a `package_path` that matches your file paths

**Content validation never runs**
- Confirm `content_watch.enabled` is `true`
- Confirm `path_pattern` is a substring of the files you're writing
- Confirm `validate_command` is set and non-empty

**Empty test check always passes**
- Confirm `empty_test_guard.enabled` is `true`
- Confirm the test filename matches one of `test_file_patterns`
- Note: the check requires `it`/`test` blocks with `expect`/`assert` calls — files with only `beforeEach` and no test blocks will not trigger it

**TODO format check never fires**
- Confirm `todo_format.enabled` is `true`
- The check looks for the word `TODO` (case-insensitive) — if your convention spells it differently, adjust `required_pattern`

**Script guard not detecting missing script**
- Confirm `script_guard.enabled` is `true`
- Confirm `package_json_paths` includes the correct package.json for the workspace being used
- The check only matches `npm run X`, `pnpm run X`, `yarn run X` — not shorthand or `npx`

**`merge_guard` blocks a merge even though it was already agreed to in conversation**
- This is by design, not a bug — the hook can't read the conversation, so it doesn't try to; it
  blocks every matching command unconditionally rather than trusting a "confirmed" flag the same
  session could set on its own
- There is no per-command bypass. Perform the merge from the GitHub PR page (or a terminal outside
  this session) instead, or set `merge_guard.enabled: false` in `config.json` if the guard itself
  should be off for this project

**`branch_delete_guard` / `ci_status_check` never seem to fire, or always allow silently**
- Both require the `gh` CLI installed and authenticated (`gh auth status`) — both fail open (warn
  and allow) rather than block when `gh` is unavailable, so a missing/unauthenticated `gh` looks
  like "nothing happened" rather than an error
- `branch_delete_guard` only matches `git push <remote> --delete <branch>` or the `:branch`
  shorthand — a local `git branch -D` is intentionally not covered
- `ci_status_check` only fires after a real `git push` (PostToolUse) and only reports a result if
  a GitHub Actions run exists for that repo

**session-start.sh prints a blank banner (no project name, no notes)**
- This was a real bug in an earlier version that embedded a shell-resolved `pwd` path (Git Bash's
  POSIX-style `/c/...` form) inside a `node -e "..."` string. A native Windows Node install
  doesn't resolve that path form, and the failure was silent (empty stdout, exit 0) rather than
  an error. Fixed by moving the logic into `session-start.cjs`, which resolves its own config
  path via `__dirname` instead of a shell string — `session-start.sh` just invokes it. If you see
  this again, confirm you're on the current two-file version, not a copy of the old single-file
  inline-`node -e` version.
- Requires bash (Git Bash, WSL, or similar) for the wrapper; the `.cjs`/`.js` hooks work natively
  on Windows via Node.js

---

## Requirements

- **Node.js** (ESM support, v14.18+) — required for all `.js` hooks
- **bash** — required for `session-start.sh`
- No specific package manager assumed; any install-detecting pattern can be added to `dep_guard.warn_patterns`

---

## Known Limitations

- `check-arch-boundary.js` checks imports in the **content being written**, not the full file on disk. It won't catch pre-existing violations.
- `forbidden_content_pattern` is a simple regex heuristic — it can produce false positives in test files or comments.
- `session-start.cjs` uses CJS `require(...)` to read config.json. If your Node version requires `--input-type=module` for `.cjs` (unusual), switch it to `JSON.parse(readFileSync(...))`.
- Hooks run in the **project root** working directory. Relative paths in `validate_command` are resolved from there.
- **Mixed module system**: `check-branch-delete-guard.js`, `check-ci-status-after-push.js`, `check-env-guard.js`, `check-git-push-audit.js`, and `check-merge-guard.js` are CommonJS (`require`); `check-dep-guard.js` and `check-search-command.js` were converted to CommonJS too (see changelog below). `check-arch-boundary.js`, `check-empty-tests.js`, `check-script-exists.js`, `check-todo-format.js`, and `validate-content.js` still use ESM `import` and will throw `Cannot use import statement outside a module` in a consuming project that has no `package.json` at all, or one without `"type": "module"` — which is the plain-scripts/non-npm case this template is otherwise meant to support out of the box. Either add a `package.json` with `"type": "module"` next to `.claude/hooks/`, or convert the file to `require(...)` the same way `check-dep-guard.js` was.

---

## What Was Removed from the Original

| Item | Reason |
|---|---|
| `check-arch-boundary.sh` | Duplicate of the JS hook; used nonexistent env vars (`$CLAUDE_TOOL_INPUT_FILE_PATH`) instead of stdin |
| `validate-content.sh` | Replaced by `validate-content.js`; hardcoded `pnpm` and `packages/content` |
| Inline dep-guard bash in hooks.json | Extracted to `check-dep-guard.js`; hardcoded `npm/yarn/pnpm` only |
| Hardcoded project references | All paths, commands, and names moved to `config.json` |
| CL1/CL4/QS5 internal rule codes | Replaced with generic, readable messages |
| `_notes.evolution` placeholder | Removed — not actionable in a generic template |

## Changelog

- `check-dep-guard.js` and `check-search-command.js` converted from ESM (`import`) to CommonJS (`require`). Found while adapting these hooks for a project with no `package.json` at all (a scripts/Docker-Compose repo, not an npm project) — the ESM versions threw `Cannot use import statement outside a module` there. Five other hook files have the same latent issue and are documented under Known Limitations rather than converted, since nothing in this change touched them.
