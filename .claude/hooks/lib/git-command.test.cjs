// lib/git-command.test.cjs
// Behavioral tests for the shared command parser used by the git/gh guard
// hooks — run with `node --test claude/hooks/`.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { commandSegments, isGitPush } = require('./git-command.cjs');

function normalized(cmd) {
  return commandSegments(cmd).map((s) => s.normalized);
}

test('commandSegments', async (t) => {
  await t.test('splits on chain operators outside quotes only', () => {
    assert.deepEqual(normalized('git status && git commit -m "a && b"'), ['git status', 'git commit -m "a && b"']);
  });

  await t.test('keeps the raw text of each segment for reporting', () => {
    assert.deepEqual(commandSegments('GIT_TRACE=1 git push origin x').map((s) => s.raw), ['GIT_TRACE=1 git push origin x']);
  });

  await t.test('strips env assignments, env flags, and sudo/command/exec wrappers in any order', () => {
    assert.deepEqual(normalized('sudo GIT_TRACE=1 git push origin x'), ['git push origin x']);
    assert.deepEqual(normalized('env -u FOO command git push origin x'), ['git push origin x']);
    assert.deepEqual(normalized('exec sudo -u bob git push origin x'), ['git push origin x']);
  });

  await t.test('strips a path prefix on git/gh, quoted or not, with optional .exe', () => {
    assert.deepEqual(normalized('/usr/bin/git push origin x'), ['git push origin x']);
    assert.deepEqual(normalized('"C:\\Program Files\\Git\\bin\\git.exe" push origin x'), ['git push origin x']);
    assert.deepEqual(normalized('./bin/gh.exe pr merge 3'), ['gh pr merge 3']);
  });

  await t.test('strips git -C with a double-quoted path containing spaces', () => {
    assert.deepEqual(normalized('git -C "C:\\Work Tree" push origin x'), ['git push origin x']);
  });

  await t.test('strips git -C with a single-quoted path containing spaces', () => {
    assert.deepEqual(normalized("git -C '/path with spaces' push origin x"), ['git push origin x']);
  });

  await t.test('strips git -c with a partially quoted value containing spaces', () => {
    assert.deepEqual(normalized('git -c user.name="A B" push origin x'), ['git push origin x']);
  });

  await t.test('strips --git-dir= / --work-tree= with quoted values containing spaces', () => {
    assert.deepEqual(normalized('git --git-dir="/a b/.git" --work-tree="/a b" push origin x'), ['git push origin x']);
  });

  await t.test('strips gh -R / --repo with quoted values', () => {
    assert.deepEqual(normalized('gh -R "owner/repo" pr merge 3'), ['gh pr merge 3']);
    assert.deepEqual(normalized('gh --repo=owner/repo pr merge 3'), ['gh pr merge 3']);
  });

  await t.test('unwraps bash -c and normalizes the inner command', () => {
    assert.deepEqual(normalized('bash -c "GIT_TRACE=1 git push origin x"'), ['git push origin x']);
  });

  await t.test('unwraps a shell wrapper that is itself behind an env prefix', () => {
    assert.deepEqual(normalized('env bash -c "gh pr merge 27"'), ['gh pr merge 27']);
  });

  await t.test('unwraps a shell wrapper behind sudo, an env assignment, or a path', () => {
    assert.deepEqual(normalized("sudo sh -c 'gh pr merge 27'"), ['gh pr merge 27']);
    assert.deepEqual(normalized('FOO=1 bash -lc "gh pr merge 27"'), ['gh pr merge 27']);
    assert.deepEqual(normalized('/bin/bash -c "gh pr merge 27"'), ['gh pr merge 27']);
  });

  await t.test('unwraps nested wrappers with prefixes at each level', () => {
    assert.deepEqual(normalized('env bash -c "sudo sh -c \\"gh pr merge 27\\""'), ['gh pr merge 27']);
  });

  await t.test('splits the unwrapped inner command on its own chain operators', () => {
    assert.deepEqual(normalized('bash -c "git status && /usr/bin/git push origin x"'), ['git status', 'git push origin x']);
  });

  await t.test('leaves unrelated commands unchanged', () => {
    assert.deepEqual(normalized('npm test'), ['npm test']);
  });
});

test('isGitPush', async (t) => {
  await t.test('plain git push', () => {
    assert.equal(isGitPush('git push'), true);
    assert.equal(isGitPush('git push -u origin feature'), true);
  });

  await t.test('path-qualified git binary', () => {
    assert.equal(isGitPush('/usr/bin/git push origin feature'), true);
    assert.equal(isGitPush('"C:\\Program Files\\Git\\bin\\git.exe" push'), true);
  });

  await t.test('git global options before push, including quoted paths with spaces', () => {
    assert.equal(isGitPush('git -C "/path with spaces" push'), true);
    assert.equal(isGitPush('git -C repo push origin feature'), true);
    assert.equal(isGitPush('git --no-pager -c core.sshCommand="ssh -v" push'), true);
  });

  await t.test('wrapped or prefixed git push', () => {
    assert.equal(isGitPush('sudo git push'), true);
    assert.equal(isGitPush('env bash -c "git push origin feature"'), true);
    assert.equal(isGitPush('npm test && git push'), true);
  });

  await t.test('git push only mentioned inside a quoted argument is not a push', () => {
    assert.equal(isGitPush('echo "git push"'), false);
    assert.equal(isGitPush('git commit -m "then git push origin main"'), false);
  });

  await t.test('commands that merely contain the word push are not a push', () => {
    assert.equal(isGitPush('cat check-git-push-audit.js'), false);
    assert.equal(isGitPush('git stash push'), false);
    assert.equal(isGitPush('git pushx'), false);
  });
});
