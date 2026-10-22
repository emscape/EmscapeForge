// check-git-push-audit.test.js
// Behavioral tests for the secret detection in check-git-push-audit.js —
// run with `node --test claude/hooks/`.
//
// The hook only runs its stdin-driven lifecycle when executed directly
// (`require.main === module`), so requiring it here is safe.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { findSecrets, secretFix } = require('./check-git-push-audit.js');

function namesIn(file, content) {
  return findSecrets([{ file, lineNum: 1, content }]).map((f) => f.name);
}

function names(content) {
  return namesIn('src/app.js', content);
}

test('findSecrets', async (t) => {
  await t.test('an 8-character generic credential is flagged', () => {
    assert.deepEqual(names("api_key = 'a1b2c3d4'"), ['hardcoded credential']); // nosecret
  });

  await t.test('a 16-character access token is flagged', () => {
    // Fixture split so external secret scanners don't flag the literal.
    assert.deepEqual(names('access' + 'Token: "Zx9Qw3Er' + '7Ty1Ui5O"'), ['hardcoded credential']); // nosecret
  });

  await t.test('a 7-character generic credential value is not flagged', () => {
    assert.deepEqual(names("api_key = 'a1b2c3d'"), []);
  });

  await t.test('a 4-character password is flagged', () => {
    // Fixture split so external secret scanners don't flag the literal.
    assert.deepEqual(names('pass' + "word: 'pa55'"), ['hardcoded password']); // nosecret
  });

  await t.test('a 3-character password is not flagged', () => {
    assert.deepEqual(names("password: 'abc'"), []);
  });

  await t.test('a trailing // nosecret marker suppresses a short fixture in a test file', () => {
    assert.deepEqual(namesIn('src/app.test.js', "apiKey: 'test-api-key' // nosecret"), []); // nosecret
  });

  await t.test('a trailing # nosecret marker suppresses a short fixture in a test file', () => {
    assert.deepEqual(namesIn('tests/test_app.py', "password = 'hunter22' # nosecret"), []); // nosecret
  });

  await t.test('a nosecret marker suppresses a docs example', () => {
    assert.deepEqual(namesIn('docs/setup.md', "apiKey: 'test-api-key' // nosecret"), []); // nosecret
    assert.deepEqual(namesIn('README.md', "apiKey: 'test-api-key' // nosecret"), []); // nosecret
  });

  await t.test('a nosecret marker is ignored in production source', () => {
    assert.deepEqual(names("apiKey: 'test-api-key' // nosecret"), ['hardcoded credential']); // nosecret
    assert.deepEqual(namesIn('config/settings.py', "password = 'hunter22' # nosecret"), ['hardcoded password']); // nosecret
  });

  await t.test('each finding reports its file and line', () => {
    const [finding] = findSecrets([{ file: 'cfg.js', lineNum: 7, content: "client_secret='s3cr3tvalue'" }]); // nosecret
    assert.equal(finding.file, 'cfg.js');
    assert.equal(finding.lineNum, 7);
  });
});

test('secretFix', async (t) => {
  await t.test('offers the nosecret marker only where it is honored', () => {
    assert.match(secretFix('src/app.test.js'), /nosecret/);
    assert.match(secretFix('docs/setup.md'), /nosecret/);
    assert.doesNotMatch(secretFix('src/app.js'), /nosecret/);
    assert.match(secretFix('src/app.js'), /ask the user/);
  });
});

// Runs the hook as Claude Code does, from a directory that is not the repo
// being pushed. The fake credential is assembled at runtime so this file
// itself never contains it.
test('hook lifecycle', async (t) => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'push-audit-repo-'));
  const elsewhere = fs.mkdtempSync(path.join(os.tmpdir(), 'push-audit-cwd-'));
  const git = (...args) => execFileSync('git', args, { cwd: repo, stdio: 'pipe' });
  try {
    git('init', '-q');
    git('config', 'user.email', 'test@example.com');
    git('config', 'user.name', 'Test');
    fs.writeFileSync(path.join(repo, 'a.txt'), 'first\n');
    git('add', '.');
    git('commit', '-q', '-m', 'first');
    fs.writeFileSync(path.join(repo, 'app.js'), `const apiKey = '${'Zx9Qw3Er' + '7Ty1Ui5O'}';\n`);
    git('add', '.');
    git('commit', '-q', '-m', 'second');

    const run = (command) => spawnSync(process.execPath, [path.join(__dirname, 'check-git-push-audit.js')], {
      input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }),
      cwd: elsewhere,
      encoding: 'utf8',
      timeout: 30000,
    });

    await t.test('git -C <repo> push audits that repo, not the hook cwd', () => {
      const r = run(`git -C "${repo}" push origin main`);
      assert.equal(r.status, 2);
      assert.match(r.stderr, /hardcoded credential/);
      assert.ok(r.stderr.includes(`in ${repo}`), r.stderr);
    });

    await t.test('cd <repo> && git push audits that repo, not the hook cwd', () => {
      const r = run(`cd "${repo}" && git push origin main`);
      assert.equal(r.status, 2);
      assert.match(r.stderr, /hardcoded credential/);
    });
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
    fs.rmSync(elsewhere, { recursive: true, force: true });
  }
});
