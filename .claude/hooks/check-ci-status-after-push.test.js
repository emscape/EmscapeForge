// check-ci-status-after-push.test.js
// Behavioral tests for the push detection in check-ci-status-after-push.js
// — run with `node --test claude/hooks/`.
//
// The hook only runs its stdin-driven lifecycle when executed directly
// (`require.main === module`), so requiring it here is safe.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
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
