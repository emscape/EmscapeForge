# Claude Code Hooks — Portable Base Template

A repo-agnostic set of Claude Code hooks that enforce architecture rules, guard dependency installs, block .env reads, require terminal-command descriptions, validate commit-message format, validate content files, and print a project orientation banner at session start.

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
| `validate-content.js` | PostToolUse: run validation after watched files change |
| `check-empty-tests.js` | PostToolUse: fail when test files have empty blocks or no assertions |
| `check-todo-format.js` | PostToolUse: warn/block on non-conforming TODO comment format |
| `session-start.sh` | UserPromptSubmit: print project orientation banner |
| `hooks.json` | Human-readable reference copy of the settings.json hooks block |

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
          { "type": "command", "command": "node .claude/hooks/check-env-guard.js" },
          { "type": "command", "command": "node .claude/hooks/check-bash-description.js" },
          { "type": "command", "command": "node .claude/hooks/check-dep-guard.js" },
          { "type": "command", "command": "node .claude/hooks/check-script-exists.js" },
          { "type": "command", "command": "node .claude/hooks/check-commit-message.js" }
        ]
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

**session-start.sh errors on Windows**
- Requires bash (Git Bash, WSL, or similar)
- The `.js` hooks work natively on Windows via Node.js

---

## Requirements

- **Node.js** (ESM support, v14.18+) — required for all `.js` hooks
- **bash** — required for `session-start.sh`
- No specific package manager assumed; any install-detecting pattern can be added to `dep_guard.warn_patterns`

---

## Known Limitations

- `check-arch-boundary.js` checks imports in the **content being written**, not the full file on disk. It won't catch pre-existing violations.
- `forbidden_content_pattern` is a simple regex heuristic — it can produce false positives in test files or comments.
- `session-start.sh` uses `node -e require(...)` (CJS syntax) to read config.json. If your Node version requires `--input-type=module`, switch the inline snippets to `JSON.parse(readFileSync(...))` with a dynamic import.
- Hooks run in the **project root** working directory. Relative paths in `validate_command` are resolved from there.

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
