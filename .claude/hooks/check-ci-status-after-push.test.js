// check-ci-status-after-push.test.js
// Behavioral tests for the push detection in check-ci-status-after-push.js
// — run with `node --test claude/hooks/`.
//
// The hook only runs its stdin-driven lifecycle when executed directly
// (`require.main === module`), so requiring it here is safe.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { shouldVerify } = require('./check-ci-status-after-push.js');

test('shouldVerify', async (t) => {
  await t.test('plain git push', () => {
    assert.equal(shouldVerify('git push -u origin feature'), true);
  });

  await t.test('path-qualified git binary', () => {
    assert.equal(shouldVerify('/usr/bin/git push origin feature'), true);
  });

  await t.test('git -C with a quoted path containing spaces', () => {
    assert.equal(shouldVerify('git -C "/path with spaces" push'), true);
  });

  await t.test('push inside an env-prefixed shell wrapper', () => {
    assert.equal(shouldVerify('env bash -c "git push"'), true);
  });

  await t.test('push only mentioned in a quoted argument', () => {
    assert.equal(shouldVerify('git commit -m "remember to git push"'), false);
  });

  await t.test('a command whose text merely contains "push"', () => {
    assert.equal(shouldVerify('cat check-git-push-audit.js'), false);
  });
});

// Runs the hook as Claude Code does (stdin JSON), with a project override
// that enables the check — a project that disables ci_status_check in its
// own .claude/hooks.config.json would otherwise exit before the code under
// test.
function runHook(command) {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-status-proj-'));
  try {
    fs.mkdirSync(path.join(projectDir, '.claude'));
    fs.writeFileSync(
      path.join(projectDir, '.claude', 'hooks.config.json'),
      JSON.stringify({ ci_status_check: { enabled: true } })
    );
    const r = spawnSync(process.execPath, [path.join(__dirname, 'check-ci-status-after-push.js')], {
      input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }),
      env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir },
      encoding: 'utf8',
      timeout: 30000,
    });
    return { status: r.status, stderr: r.stderr || '' };
  } finally {
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
}

test('hook lifecycle', async (t) => {
  await t.test('a push whose target repo cannot be determined is skipped, not checked against the hook cwd', () => {
    const r = runHook('cd "$REPO" && git push');
    assert.equal(r.status, 0);
    assert.match(r.stderr, /Could not determine which repository/);
  });
});
