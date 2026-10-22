// lib/git-command.test.cjs
// Behavioral tests for the shared command parser used by the git/gh guard
// hooks — run with `node --test claude/hooks/`.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const { commandSegments, isGitPush, pushTargetDir } = require('./git-command.cjs');

const BASE = path.resolve(os.tmpdir(), 'base');

function dirs(cmd) {
  return commandSegments(cmd, BASE).map((s) => s.cwd);
}

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

  await t.test('strips control-flow words, a { group, and a ( subshell before the command', () => {
    assert.deepEqual(normalized('if true; then gh pr merge 7; fi'), ['true', 'gh pr merge 7', 'fi']);
    assert.deepEqual(normalized('{ gh pr merge 7; }'), ['gh pr merge 7', '}']);
    assert.deepEqual(normalized('(git push origin main)'), ['git push origin main']);
    assert.deepEqual(normalized('then sudo GIT_TRACE=1 git push origin x'), ['git push origin x']);
  });

  await t.test('leaves unrelated commands unchanged', () => {
    assert.deepEqual(normalized('npm test'), ['npm test']);
  });
});

test('commandSegments cwd', async (t) => {
  await t.test('defaults to the starting directory', () => {
    assert.deepEqual(dirs('git push'), [BASE]);
  });

  await t.test('a cd carries into later segments, relative to the current one', () => {
    assert.deepEqual(dirs('cd sub && git push'), [path.join(BASE, 'sub'), path.join(BASE, 'sub')]);
    assert.deepEqual(dirs('cd a; cd ../b; git push').slice(-1), [path.join(BASE, 'b')]);
  });

  await t.test('pushd behaves like cd', () => {
    assert.deepEqual(dirs('pushd sub && git push').slice(-1), [path.join(BASE, 'sub')]);
  });

  await t.test('git -C applies on top of the current directory, cumulatively', () => {
    assert.deepEqual(dirs('cd sub && git -C ../other push').slice(-1), [path.join(BASE, 'other')]);
    assert.deepEqual(dirs('git -C a -C b push'), [path.join(BASE, 'a', 'b')]);
  });

  await t.test('a quoted -C or cd path with spaces is one argument', () => {
    assert.deepEqual(dirs('git -C "work tree" push'), [path.join(BASE, 'work tree')]);
    assert.deepEqual(dirs("cd 'work tree' && git push").slice(-1), [path.join(BASE, 'work tree')]);
  });

  await t.test('a cd inside a shell wrapper does not carry out of it', () => {
    assert.deepEqual(dirs('bash -c "cd a && git push" && git push'), [path.join(BASE, 'a'), path.join(BASE, 'a'), BASE]);
  });

  await t.test('a target that cannot be known statically is null', () => {
    assert.deepEqual(dirs('cd "$REPO" && git push').slice(-1), [null]);
    assert.deepEqual(dirs('cd a; cd -; git push').slice(-1), [null]);
    assert.deepEqual(dirs('cd $(git rev-parse --show-toplevel) && git push').slice(-1), [null]);
  });

  await t.test('cd with no argument or ~ goes home', () => {
    assert.deepEqual(dirs('cd && git push').slice(-1), [os.homedir()]);
    assert.deepEqual(dirs('cd ~/x && git push').slice(-1), [path.join(os.homedir(), 'x')]);
  });

  if (process.platform === 'win32') {
    await t.test('a Git Bash drive path resolves to the Windows drive', () => {
      assert.deepEqual(dirs('cd /c/repos/x && git push').slice(-1), ['C:\\repos\\x']);
    });
  }
});

test('pushTargetDir', async (t) => {
  await t.test('the directory of the push segment when it exists', () => {
    assert.equal(pushTargetDir(`cd "${__dirname}" && git push`, BASE), __dirname);
    assert.equal(pushTargetDir(`git -C "${__dirname}" push`, BASE), __dirname);
  });

  await t.test('null for a missing directory, an unknown one, or no push', () => {
    assert.equal(pushTargetDir('cd does-not-exist && git push', BASE), null);
    assert.equal(pushTargetDir('cd "$REPO" && git push', BASE), null);
    assert.equal(pushTargetDir(`cd "${__dirname}" && git status`, BASE), null);
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

  await t.test('git push in a shell control-flow command position', () => {
    assert.equal(isGitPush('if true; then git push origin feature; fi'), true);
    assert.equal(isGitPush('{ git push origin feature; }'), true);
    assert.equal(isGitPush('if git push origin feature; then echo ok; fi'), true);
    assert.equal(isGitPush('for r in a b; do git push "$r" feature; done'), true);
    assert.equal(isGitPush('while false; do :; done; until git push; do sleep 1; done'), true);
    assert.equal(isGitPush('if false; then :; else git push; fi'), true);
    assert.equal(isGitPush('! git push origin feature'), true);
    assert.equal(isGitPush('(git push origin feature)'), true);
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
