// check-search-command.test.js
// Behavioral tests for the command detection in check-search-command.js —
// run with `node --test claude/hooks/*.test.js`.
//
// The hook only runs its stdin-driven lifecycle when executed directly
// (`require.main === module`), so requiring it here is safe.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { rawSearchCommands } = require('./check-search-command.js');

test('rawSearchCommands', async (t) => {
  await t.test('a leading watched command is detected', () => {
    assert.deepEqual(rawSearchCommands('grep -rn foo src'), ['grep']);
    assert.deepEqual(rawSearchCommands('/usr/bin/cat file.txt'), ['cat']);
  });

  await t.test('watched commands after real chain operators are detected', () => {
    assert.deepEqual(rawSearchCommands('npm test && cat out.log | tail -5'), ['cat', 'tail']);
    assert.deepEqual(rawSearchCommands('ls\nhead README.md'), ['head']);
  });

  await t.test('a VAR=value prefix is skipped', () => {
    assert.deepEqual(rawSearchCommands('LC_ALL=C grep foo bar'), ['grep']);
  });

  await t.test('operators inside quoted arguments do not create fake segments', () => {
    assert.deepEqual(rawSearchCommands("printf '%s\\n' 'text | cat secrets'"), []);
    assert.deepEqual(rawSearchCommands('git commit -m "fix; then grep the logs && tail them"'), []);
  });

  await t.test('unwatched commands are not reported', () => {
    assert.deepEqual(rawSearchCommands('npm run build'), []);
  });

  await t.test('a custom command list is honored', () => {
    assert.deepEqual(rawSearchCommands('less file.txt', ['less']), ['less']);
    assert.deepEqual(rawSearchCommands('cat file.txt', ['less']), []);
  });
});
