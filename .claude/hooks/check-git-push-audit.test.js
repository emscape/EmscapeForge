// check-git-push-audit.test.js
// Behavioral tests for the secret detection in check-git-push-audit.js —
// run with `node --test claude/hooks/`.
//
// The hook only runs its stdin-driven lifecycle when executed directly
// (`require.main === module`), so requiring it here is safe.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { findSecrets } = require('./check-git-push-audit.js');

function names(content) {
  return findSecrets([{ file: 'src/app.js', lineNum: 1, content }]).map((f) => f.name);
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

  await t.test('a trailing // nosecret marker suppresses a short fixture', () => {
    assert.deepEqual(names("apiKey: 'test-api-key' // nosecret"), []); // nosecret
  });

  await t.test('a trailing # nosecret marker suppresses a short fixture', () => {
    assert.deepEqual(names("password = 'hunter22' # nosecret"), []); // nosecret
  });

  await t.test('each finding reports its file and line', () => {
    const [finding] = findSecrets([{ file: 'cfg.js', lineNum: 7, content: "client_secret='s3cr3tvalue'" }]); // nosecret
    assert.equal(finding.file, 'cfg.js');
    assert.equal(finding.lineNum, 7);
  });
});
