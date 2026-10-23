#!/usr/bin/env node
// check-git-push-audit.js
// PreToolUse hook — Bash
//
// Before any `git push`, audits the changeset for:
//   • Hardcoded secrets, credentials, API keys
//   • Debug / console statements in production code
//   • Commented-out code blocks
//   • package.json changes without a lockfile update
//   • Source file changes with no corresponding test changes
//
// Algorithm:
//   1. In the repo the push targets (after any `cd`/`git -C`), get the staged
//      diff (git diff --staged). If empty, fall back to every unpushed commit
//      (@{u}..HEAD), then to HEAD~1 when there's no upstream.
//   2. If still empty → block (nothing to push).
//   3. Run all checks against added lines only (lines starting with '+').
//   4. Report findings in the format: File:line | Severity | Issue | Suggested fix
//   5. If any HIGH findings → BLOCK (exit 2). Otherwise → PASS (exit 0).
//
// Exit codes:
//   0  — PASS or not a push command
//   2  — BLOCK: high-severity findings

'use strict';

const { execSync } = require('child_process');
const { isGitPush, pushTargetDir } = require('./lib/git-command.cjs');

// ── Secret patterns ────────────────────────────────────────────────────────────
// Generic (non-vendor-specific) patterns keep a low length floor (8 chars
// for credentials, 4 for passwords): real secrets shorter than 20 chars
// exist, and a higher floor silently lets them through. Short, human-
// readable test fixtures (an `apiKey` set to 'test-api-key') are handled with a
// trailing `// nosecret` comment on that line, honored in test and docs files
// only (see SUPPRESS_MARKER), rather than by weakening the patterns. The vendor-specific patterns below (Google/
// OpenAI/GitHub/Slack/AWS) match exact real-world formats.
const SECRET_PATTERNS = [
  {
    re: /(?:api[_-]?key|api[_-]?secret|access[_-]?token|auth[_-]?token|client[_-]?secret)\s*[:=]\s*['"`][A-Za-z0-9+/\-_]{8,}['"`]/i,
    name: 'hardcoded credential',
  },
  {
    re: /password\s*[:=]\s*['"`][^'"`\s]{4,}['"`]/i,
    name: 'hardcoded password',
  },
  {
    re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    name: 'private key content',
  },
  { re: /AIza[0-9A-Za-z\-_]{35}/, name: 'Google API key' },
  { re: /sk-[a-zA-Z0-9]{48}/, name: 'OpenAI key' },
  { re: /ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{82}/, name: 'GitHub token' },
  { re: /xox[baprs]-[0-9A-Za-z\-]+/, name: 'Slack token' },
  { re: /AKIA[0-9A-Z]{16}/, name: 'AWS access key ID' },
];

// ── Debug statement patterns ───────────────────────────────────────────────────
const DEBUG_PATTERNS = [
  { re: /console\.(log|debug|trace)\s*\(/, name: 'console statement' },
  { re: /\bdebugger\b/, name: 'debugger statement' },
  { re: /\bpprint\s*\(/, name: 'pprint call' },
  { re: /\bdd\s*\(|die\s*\(/, name: 'dd()/die() debug call' },
];

// ── Commented-out code heuristic ───────────────────────────────────────────────
const CODE_COMMENT_RE = /^\s*(?:\/\/|#)\s*(?:const |let |var |function |def |class |import |return |if \(|for \(|while \()/;

// ── Shell helper ───────────────────────────────────────────────────────────────
function run(cmd, cwd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], cwd });
  } catch (e) {
    return e.stdout || '';
  }
}

// Existence check by exit code only — git's "ambiguous argument" error for a
// missing ref (e.g. HEAD~1 on a root commit) writes the ref name itself to
// stdout as part of its usage hint, which would make a truthy-stdout check
// misread failure as success. Exit code is the only reliable signal.
function refExists(ref, cwd) {
  try {
    execSync(`git rev-parse --verify ${ref}`, { stdio: ['pipe', 'ignore', 'ignore'], cwd });
    return true;
  } catch {
    return false;
  }
}

// ── Parse unified diff into added lines ───────────────────────────────────────
function parseAddedLines(diffText) {
  const lines = diffText.split('\n');
  const added = [];
  let currentFile = '';
  let lineNum = 0;

  for (const line of lines) {
    if (line.startsWith('diff --git ')) {
      const m = line.match(/b\/(.+)$/);
      currentFile = m ? m[1] : '';
      lineNum = 0;
    } else if (line.startsWith('@@ ')) {
      const m = line.match(/@@ -\d+(?:,\d+)? \+(\d+)/);
      lineNum = m ? parseInt(m[1], 10) - 1 : lineNum;
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      lineNum++;
      added.push({ file: currentFile, lineNum, content: line.slice(1) });
    } else if (!line.startsWith('-') && !line.startsWith('\\')) {
      lineNum++;
    }
  }
  return added;
}

function isTestFile(path) {
  return (
    // [mc]? covers .mjs/.cjs, not just .js/.ts/.jsx/.tsx — without it this
    // never once matched a vitest-in-ESM *.test.mjs file (this project's
    // actual convention for testing CommonJS Functions code), making the
    // "source changed with no test changes" check fire on every such PR.
    /\.(test|spec)\.[mc]?[jt]sx?$/.test(path) ||
    /__(?:tests?|specs?)__/.test(path) ||
    /(?:^|\/)tests?\//.test(path) ||
    /_test\.[a-z]+$/.test(path)
  );
}

// A trailing `// nosecret` (or `# nosecret`) comment suppresses the secret
// check for that one line — an explicit, auditable, per-line escape hatch
// for genuine false positives (test fixtures, docs examples) that no regex
// can fully anticipate, without weakening the patterns themselves. Honored
// only in test and docs files: anywhere else it would let a real
// credential through with a one-comment edit, and the block message is
// exactly where an assistant would learn that edit.
const SUPPRESS_MARKER = /(?:\/\/|#)\s*nosecret\s*$/;

function isDocsFile(path) {
  return /(?:^|\/)docs?\//.test(path) || /\.(?:md|mdx|rst|txt)$/i.test(path);
}

function allowsSuppressMarker(path) {
  return isTestFile(path) || isDocsFile(path);
}

// Added lines ({ file, lineNum, content }) → one { file, lineNum, name }
// per secret pattern matched.
function findSecrets(addedLines) {
  const found = [];
  for (const { file, lineNum, content } of addedLines) {
    if (SUPPRESS_MARKER.test(content) && allowsSuppressMarker(file)) continue;
    for (const { re, name } of SECRET_PATTERNS) {
      if (re.test(content)) found.push({ file, lineNum, name });
    }
  }
  return found;
}

function secretFix(file) {
  const base = 'Move to environment variable or secrets manager; never commit credentials.';
  return allowsSuppressMarker(file)
    ? `${base} If this is a genuine false positive (e.g. a test fixture), add a trailing \`// nosecret\` comment.`
    : `${base} If you believe this is a false positive, stop and ask the user — do not rewrite the value to evade the pattern.`;
}

module.exports = { findSecrets, secretFix };

// Only run the stdin-driven hook lifecycle when executed directly (how
// Claude Code invokes it) — not when require()'d from the test file.
if (require.main === module) {
  runHook();
}

// ── Main ──────────────────────────────────────────────────────────────────────
function runHook() {
  const chunks = [];
  process.stdin.on('data', (d) => chunks.push(d));
  process.stdin.on('end', () => {
    let input;
    try {
      input = JSON.parse(Buffer.concat(chunks).toString());
    } catch {
      process.exit(0);
    }

    const cmd = (input?.tool_input?.command || '').trim();
    // An actual `git push` (including path-qualified, `git -C <dir>`, and
    // wrapped forms), not a command whose text merely contains "push" — see
    // lib/git-command.cjs.
    if (!isGitPush(cmd)) {
      process.exit(0); // not a push — allow
    }

    // ── Gather diff ─────────────────────────────────────────────────────────────
    // From the repo being pushed, not this hook's own working directory —
    // `cd ../other && git push` or `git -C ../other push` from a session
    // rooted elsewhere would otherwise audit the wrong repository. An
    // unknown or missing target blocks rather than auditing this hook's
    // directory, which would pass secrets in the real target unseen.
    const repoDir = pushTargetDir(cmd);
    if (!repoDir) {
      const report = 'PRE-PUSH AUDIT: Could not determine which repository this push targets (e.g. `cd "$VAR"`, or a `git -C` path that does not exist), so its changes cannot be audited. Push with a literal path instead.';
      process.stderr.write(report + '\n');
      process.stdout.write(JSON.stringify({ continue: false, stopReason: report }));
      process.exit(2);
    }
    let diffText = run('git diff --staged', repoDir);
    let diffSource = 'staged';
    let changedFiles = run('git diff --staged --name-only', repoDir).trim();

    if (!changedFiles && refExists('@{u}', repoDir)) {
      // Every commit the push would send, not just the last one.
      changedFiles = run('git diff @{u} HEAD --name-only', repoDir).trim();
      if (changedFiles) {
        diffText = run('git diff @{u} HEAD', repoDir);
        diffSource = '@{u}..HEAD';
      }
    }

    if (!changedFiles) {
      // HEAD~1 doesn't exist for a repo's root commit (first-ever push, or a
      // force-push establishing new history) — diffing against it errors out
      // and used to be misread as "nothing changed". Fall back to git's
      // empty-tree object so root commits get audited for real instead of
      // being waved through as an empty changeset.
      const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
      const hasParent = refExists('HEAD~1', repoDir);
      const baseRef = hasParent ? 'HEAD~1' : EMPTY_TREE;
      diffText = run(`git diff ${baseRef}`, repoDir);
      diffSource = hasParent ? 'HEAD~1' : 'root commit (vs. empty tree)';
      changedFiles = run(`git diff ${baseRef} --name-only`, repoDir).trim();
    }

    if (!changedFiles) {
      const report = 'PRE-PUSH AUDIT: Changeset is empty — nothing to push.';
      process.stderr.write(report + '\n');
      process.stdout.write(JSON.stringify({ continue: false, stopReason: report }));
      process.exit(2);
    }

    const fileList = changedFiles.split('\n').filter(Boolean);
    const addedLines = parseAddedLines(diffText);
    const findings = [];

    // ── Check 1: Hardcoded secrets ─────────────────────────────────────────────
    for (const { file, lineNum, name } of findSecrets(addedLines)) {
      findings.push({
        file, line: lineNum, severity: 'high',
        issue: `Possible ${name} detected`,
        fix: secretFix(file),
      });
    }

    // ── Check 2: Debug statements in non-test files ────────────────────────────
    for (const { file, lineNum, content } of addedLines) {
      if (isTestFile(file)) continue;
      for (const { re, name } of DEBUG_PATTERNS) {
        if (re.test(content)) {
          findings.push({
            file, line: lineNum, severity: 'medium',
            issue: `${name} left in production code`,
            fix: 'Remove or replace with structured logging before pushing',
          });
        }
      }
    }

    // ── Check 3: Commented-out code blocks (≥3 lines per file) ────────────────
    const commentCounts = {};
    for (const { file, content } of addedLines) {
      if (CODE_COMMENT_RE.test(content)) {
        commentCounts[file] = (commentCounts[file] || 0) + 1;
      }
    }
    for (const [file, count] of Object.entries(commentCounts)) {
      if (count >= 3) {
        findings.push({
          file, line: '-', severity: 'low',
          issue: `${count} commented-out code lines added`,
          fix: 'Remove dead code; use git history instead of commented blocks',
        });
      }
    }

    // ── Check 4: package.json changed without lockfile ─────────────────────────
    const hasPkgChange = fileList.some(
      (f) => f.endsWith('package.json') && !f.endsWith('package-lock.json')
    );
    const hasLockChange = fileList.some(
      (f) => f.endsWith('package-lock.json') || f.endsWith('yarn.lock') || f.endsWith('pnpm-lock.yaml')
    );
    if (hasPkgChange && !hasLockChange) {
      findings.push({
        file: 'package.json', line: '-', severity: 'medium',
        issue: 'package.json changed without a corresponding lockfile update',
        fix: 'Run npm install (or yarn/pnpm install) and stage the updated lockfile',
      });
    }

    // ── Check 5: Source changes without test changes ───────────────────────────
    const srcFiles = fileList.filter(
      (f) => /\.(js|ts|jsx|tsx|py|go|java|cs|rb)$/.test(f) && !isTestFile(f)
    );
    const testFiles = fileList.filter(isTestFile);
    if (srcFiles.length > 0 && testFiles.length === 0) {
      findings.push({
        file: srcFiles.slice(0, 3).join(', ') + (srcFiles.length > 3 ? ` (+${srcFiles.length - 3} more)` : ''),
        line: '-',
        severity: 'medium',
        issue: `${srcFiles.length} source file(s) changed with no test file changes`,
        fix: 'Add or update tests for changed code paths (QS1 — >85% coverage)',
      });
    }

    // ── Format report ──────────────────────────────────────────────────────────
    const highs  = findings.filter((f) => f.severity === 'high');
    const meds   = findings.filter((f) => f.severity === 'medium');
    const lows   = findings.filter((f) => f.severity === 'low');
    const verdict = highs.length > 0 ? 'BLOCK' : 'PASS';

    const rows = findings
      .map((f) => `  ${f.file}:${f.line} | ${f.severity.toUpperCase()} | ${f.issue}\n    Fix: ${f.fix}`)
      .join('\n');

    const report = [
      `PRE-PUSH AUDIT — ${verdict}`,
      `Audited: git diff ${diffSource} in ${repoDir} (${fileList.length} file(s) changed)`,
      '',
      findings.length > 0 ? rows : '  No findings.',
      '',
      `Findings: ${highs.length} high, ${meds.length} medium, ${lows.length} low`,
      verdict === 'BLOCK'
        ? 'Push BLOCKED. Fix high-severity issues above before retrying.'
        : 'Push may proceed.',
    ].join('\n');

    process.stderr.write(report + '\n');

    if (verdict === 'BLOCK') {
      process.stdout.write(JSON.stringify({ continue: false, stopReason: report }));
      process.exit(2);
    }

    process.exit(0);
  });
}
