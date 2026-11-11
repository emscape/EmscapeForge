// check-env-guard.test.js
// Lifecycle tests for check-env-guard.js — run with
// `node --test *.test.js *.test.cjs lib/*.test.cjs` from the hooks directory.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function readOf(filePath) {
  return spawnSync(process.execPath, [path.join(__dirname, 'check-env-guard.js')], {
    input: JSON.stringify({ tool_name: 'Read', tool_input: { file_path: filePath } }),
    encoding: 'utf8',
  });
}

test('check-env-guard', async (t) => {
  for (const name of ['.env', '.env.production', '.ENV', '.Env.Local']) {
    await t.test(`blocks reading ${name}`, () => {
      const r = readOf(path.join('project', name));
      assert.equal(r.status, 2, `${name}: ${r.stdout}`);
      assert.match(r.stdout, /off-limits/);
    });
  }

  for (const name of ['env.js', '.envrc', 'my.env', 'README.md']) {
    await t.test(`allows reading ${name}`, () => {
      const r = readOf(path.join('project', name));
      assert.equal(r.status, 0, `${name}: ${r.stdout}`);
      assert.equal(r.stdout, '');
    });
  }
});
