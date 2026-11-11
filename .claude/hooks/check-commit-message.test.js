// check-commit-message.test.js
// Behavioral tests for the commit-message guard's detection logic — run
// with `node --test *.test.js *.test.cjs lib/*.test.cjs` from the hooks directory.
//
// check-commit-message.js only runs its stdin-driven hook lifecycle when
// executed directly (`require.main === module`), so requiring it here is
// safe.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { findUnmarkedCommit, commitVerdict } = require('./check-commit-message.js');

const GOOD = 'git commit -m "Fix thing\n\nWHY:\n- reason\n\nEXPECTED:\n- outcome"';

test('findUnmarkedCommit', async (t) => {
  await t.test('allows a commit whose message has WHY and EXPECTED', () => {
    assert.equal(findUnmarkedCommit(GOOD), null);
  });

  await t.test('blocks a bare commit missing both markers', () => {
    assert.equal(findUnmarkedCommit('git commit -m "missing sections"'), 'git commit -m "missing sections"');
  });

  await t.test('blocks a commit missing only EXPECTED', () => {
    assert.notEqual(findUnmarkedCommit('git commit -m "x\n\nWHY:\n- y"'), null);
  });

  await t.test('blocks a commit chained after another command with &&', () => {
    assert.equal(
      findUnmarkedCommit('echo ok && git commit -m "missing sections"'),
      'git commit -m "missing sections"'
    );
  });

  await t.test('blocks a commit chained after cd with ;', () => {
    assert.notEqual(findUnmarkedCommit('cd /repo; git commit -m "nope"'), null);
  });

  await t.test('blocks a commit on a later line of a multi-line command', () => {
    assert.notEqual(findUnmarkedCommit('git add .\ngit commit -m "nope"'), null);
  });

  await t.test('allows a well-formed commit chained after git add', () => {
    assert.equal(findUnmarkedCommit(`git add . && ${GOOD}`), null);
  });

  await t.test('does not let markers in another segment satisfy the commit', () => {
    assert.notEqual(findUnmarkedCommit('echo "WHY: EXPECTED:" && git commit -m "nope"'), null);
  });

  await t.test('blocks a commit run with git -C <dir>', () => {
    assert.notEqual(findUnmarkedCommit('git -C /repo commit -m "nope"'), null);
  });

  await t.test('blocks a commit run with other git global options', () => {
    assert.notEqual(findUnmarkedCommit('git --git-dir=/repo/.git -c user.name=x commit -m "nope"'), null);
  });

  await t.test('blocks a commit run through an absolute path to git', () => {
    assert.notEqual(findUnmarkedCommit('/usr/bin/git commit -m "nope"'), null);
  });

  await t.test('blocks a commit wrapped in bash -c', () => {
    assert.notEqual(findUnmarkedCommit('bash -c "git commit -m nope"'), null);
  });

  await t.test('allows a well-formed commit run with git -C <dir>', () => {
    assert.equal(findUnmarkedCommit(GOOD.replace('git commit', 'git -C /repo commit')), null);
  });

  await t.test('allows a commit whose message is fed through a heredoc on stdin', () => {
    const cmd = "git add -A && git commit -q -F - <<'EOF'\nFix thing\n\nWHY:\n- it's broken\n\nEXPECTED:\n- works\nEOF\ngit log --oneline -1";
    assert.equal(findUnmarkedCommit(cmd), null);
  });

  await t.test('allows a commit whose -m uses $(cat <<EOF) with an apostrophe in the body', () => {
    const cmd = 'git commit -m "$(cat <<\'EOF\'\nFix thing\n\nWHY:\n- don\'t break\n\nEXPECTED:\n- works\nEOF\n)"';
    assert.equal(findUnmarkedCommit(cmd), null);
  });

  await t.test('blocks a heredoc-fed commit whose body lacks the markers', () => {
    assert.notEqual(findUnmarkedCommit("git commit -F - <<'EOF'\nJust a summary\nEOF"), null);
  });

  await t.test('does not let a heredoc fed to another command satisfy the commit', () => {
    const cmd = "cat > notes.txt <<'EOF'\nWHY:\nEXPECTED:\nEOF\ngit commit -m \"nope\"";
    assert.notEqual(findUnmarkedCommit(cmd), null);
  });

  await t.test('ignores commands that only mention git commit inside a quoted string', () => {
    assert.equal(findUnmarkedCommit('echo "run git commit later"'), null);
  });

  await t.test('ignores non-commit git commands', () => {
    assert.equal(findUnmarkedCommit('git status && git log -1'), null);
  });

  await t.test('uses the configured markers instead of the defaults', () => {
    assert.equal(findUnmarkedCommit('git commit -m "x\n\nRefs: #1"', ['Refs:']), null);
    assert.notEqual(findUnmarkedCommit(GOOD, ['Refs:']), null);
  });
});

test('only the commit message counts', async (t) => {
  const BODY = 'Fix thing\n\nWHY:\n- reason\n\nEXPECTED:\n- outcome';

  await t.test('a heredoc with a numeric or punctuated delimiter feeds -F -', () => {
    assert.equal(findUnmarkedCommit(`git commit -F - <<123\n${BODY}\n123`), null);
    assert.equal(findUnmarkedCommit(`git commit -F - <<'END-MSG'\n${BODY}\nEND-MSG`), null);
    assert.equal(findUnmarkedCommit(`git commit -F - <<END.MSG\n${BODY}\nEND.MSG\ngit log -1`), null);
    assert.notEqual(findUnmarkedCommit('git commit -F - <<123\nJust a summary\n123'), null);
  });

  await t.test('a `<<` with no closing line does not stop a later heredoc being read', () => {
    assert.equal(findUnmarkedCommit(`echo "a << b" && git commit -F - <<'EOF'\n${BODY}\nEOF`), null);
  });

  await t.test('a heredoc on stdin does not count when -m supplies the message', () => {
    assert.notEqual(findUnmarkedCommit(`git commit -m "nope" <<'EOF'\n${BODY}\nEOF`), null);
  });

  await t.test('markers in other arguments or a comment do not count', () => {
    assert.notEqual(findUnmarkedCommit('git commit -m "nope" --author "WHY: EXPECTED: <a@b.c>"'), null);
    assert.notEqual(findUnmarkedCommit('git commit --pathspec-from-file="WHY: EXPECTED:" -m "nope"'), null);
    assert.notEqual(findUnmarkedCommit('git commit -m "nope" # WHY: EXPECTED:'), null);
    assert.notEqual(findUnmarkedCommit('git commit -m "nope" -- "WHY: EXPECTED:"'), null, 'a pathspec');
  });

  await t.test('a message from a file or another commit cannot be checked, so it is blocked', () => {
    assert.notEqual(findUnmarkedCommit('git commit -F "WHY: EXPECTED:.txt"'), null);
    assert.notEqual(findUnmarkedCommit('git commit -C HEAD --author "WHY: EXPECTED:"'), null);
  });

  await t.test('every message-bearing form is read', () => {
    assert.equal(findUnmarkedCommit('git commit -m "Fix" -m "WHY:\n- a" -m "EXPECTED:\n- b"'), null, 'several -m');
    assert.equal(findUnmarkedCommit(`git commit --message="${BODY}"`), null, '--message=');
    assert.equal(findUnmarkedCommit(`git commit --message "${BODY}"`), null, '--message <msg>');
    assert.equal(findUnmarkedCommit(`git commit -am "${BODY}"`), null, 'clustered -am');
    assert.equal(findUnmarkedCommit(`git commit -m"${BODY}"`), null, 'attached -m');
    assert.equal(findUnmarkedCommit(`git commit --file=- <<'EOF'\n${BODY}\nEOF`), null, '--file=-');
    assert.equal(findUnmarkedCommit('git commit -m "Fix" --trailer "WHY: a" --trailer "EXPECTED: b"'), null, 'trailers');
  });
});

test('commitVerdict', async (t) => {
  const BAD = 'git commit -m "nope"';

  await t.test('blocks a non-compliant commit when on_violation is block', () => {
    assert.equal(commitVerdict(BAD, { enabled: true, on_violation: 'block' }).action, 'block');
  });

  await t.test('only warns for a non-compliant commit when on_violation is warn', () => {
    assert.equal(commitVerdict(BAD, { enabled: true, on_violation: 'warn' }).action, 'warn');
  });

  await t.test('blocks by default when on_violation is unset', () => {
    assert.equal(commitVerdict(BAD, {}).action, 'block');
  });

  await t.test('allows everything when the guard is disabled', () => {
    assert.equal(commitVerdict(BAD, { enabled: false, on_violation: 'block' }).action, 'allow');
  });

  await t.test('allows a compliant commit regardless of on_violation', () => {
    assert.equal(commitVerdict(GOOD, { on_violation: 'block' }).action, 'allow');
  });

  await t.test('names the missing markers from required_markers', () => {
    const v = commitVerdict('git commit -m "x\n\nWHY:\n- y"', { required_markers: ['WHY:', 'EXPECTED:'] });
    assert.deepEqual(v.missing, ['EXPECTED:']);
  });
});
