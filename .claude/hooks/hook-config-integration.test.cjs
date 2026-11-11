// hook-config-integration.test.cjs
// RED-phase integration tests (REQ-8..REQ-13): spawn real hook scripts with a
// project-local .claude/hooks.config.json, selected ONLY via CLAUDE_PROJECT_DIR
// (cwd is a different temp dir). Written blind to hook implementations.
// Run with: node --test claude/hooks/hook-config-integration.test.cjs

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function msg(what, why, expected, actual, guidance) {
  return (
    `WHAT: ${what} FAILED\n` +
    `WHY: ${why}\n` +
    `EXPECTED: ${expected}\n` +
    `ACTUAL: ${typeof actual === 'string' ? actual : JSON.stringify(actual)}\n` +
    `GUIDANCE: ${guidance}`
  );
}

// Runs fn(projectDir, otherDir) with two fresh temp dirs; override is written if provided.
function withProject(override, fn) {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hookcfg-int-proj-'));
  const otherDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hookcfg-int-cwd-'));
  try {
    if (override !== undefined) {
      fs.mkdirSync(path.join(projectDir, '.claude'), { recursive: true });
      fs.writeFileSync(
        path.join(projectDir, '.claude', 'hooks.config.json'),
        typeof override === 'string' ? override : JSON.stringify(override)
      );
    }
    return fn(projectDir, otherDir);
  } finally {
    fs.rmSync(projectDir, { recursive: true, force: true });
    fs.rmSync(otherDir, { recursive: true, force: true });
  }
}

function runHook(script, projectDir, cwd, payload) {
  const r = spawnSync(process.execPath, [path.join(__dirname, script)], {
    input: JSON.stringify(payload),
    cwd,
    env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir },
    encoding: 'utf8',
    timeout: 30000,
  });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '', error: r.error };
}

function bash(command) {
  return { tool_name: 'Bash', tool_input: { command, description: 'integration test command' } };
}

test('check-dep-guard.js (REQ-8)', async (t) => {
  await t.test('no override: npm install warns on stderr, exit 0', () => {
    withProject(undefined, (p, c) => {
      const r = runHook('check-dep-guard.js', p, c, bash('npm install left-pad'));
      assert.equal(r.status, 0, msg('dep baseline exit', 'REQ-8', 'exit 0', `${r.status} ${r.stderr}`, 'dep_guard warns, never blocks.'));
      assert.notEqual(r.stderr.trim(), '', msg('dep baseline stderr', 'REQ-8 shared dep_guard.enabled=true', 'non-empty stderr warning', r.stderr, 'With shared defaults the dependency warning must be emitted.'));
    });
  });

  await t.test('override dep_guard.enabled=false: silent, exit 0', () => {
    withProject({ dep_guard: { enabled: false } }, (p, c) => {
      const r = runHook('check-dep-guard.js', p, c, bash('npm install left-pad'));
      assert.equal(r.status, 0, msg('dep override exit', 'REQ-8', 'exit 0', r.status, 'Disabled guard allows.'));
      assert.equal(r.stderr, '', msg('dep override stderr', 'REQ-8 project config disables dep_guard', 'empty stderr', r.stderr, 'The hook must read the project-local override found via CLAUDE_PROJECT_DIR.'));
    });
  });
});

test('check-search-command.js (REQ-9)', async (t) => {
  await t.test('no override: grep warns on stderr, exit 0', () => {
    withProject(undefined, (p, c) => {
      const r = runHook('check-search-command.js', p, c, bash('grep -r foo .'));
      assert.equal(r.status, 0, msg('search baseline exit', 'REQ-9 on_violation=warn', 'exit 0', r.status, 'Default is a nudge, not a block.'));
      assert.notEqual(r.stderr.trim(), '', msg('search baseline stderr', 'REQ-9', 'non-empty stderr nudge', r.stderr, 'Emit the nudge when search_guard is enabled.'));
    });
  });

  await t.test('override on_violation=block: exit 2', () => {
    withProject({ search_guard: { on_violation: 'block' } }, (p, c) => {
      const r = runHook('check-search-command.js', p, c, bash('grep -r foo .'));
      assert.equal(r.status, 2, msg('search block exit', 'REQ-9 override on_violation=block', 'exit 2', `${r.status} ${r.stderr}`, 'Project config may tighten search_guard to block.'));
    });
  });

  await t.test('override enabled=false: silent, exit 0', () => {
    withProject({ search_guard: { enabled: false } }, (p, c) => {
      const r = runHook('check-search-command.js', p, c, bash('grep -r foo .'));
      assert.equal(r.status, 0, msg('search disabled exit', 'REQ-9', 'exit 0', r.status, 'Disabled guard allows.'));
      assert.equal(r.stderr, '', msg('search disabled stderr', 'REQ-9', 'empty stderr', r.stderr, 'Disabled guard prints nothing.'));
    });
  });
});

test('check-merge-guard.js (REQ-10)', async (t) => {
  let baselineStderr = '';

  await t.test('no override: gh pr merge blocked with exit 2', () => {
    withProject(undefined, (p, c) => {
      const r = runHook('check-merge-guard.js', p, c, bash('gh pr merge 5'));
      baselineStderr = r.stderr;
      assert.equal(r.status, 2, msg('merge baseline exit', 'REQ-10', 'exit 2', `${r.status} ${r.stderr}`, 'Merges are blocked by default.'));
    });
  });

  await t.test('override merge_guard.enabled=false cannot disable it; warning emitted', () => {
    withProject({ merge_guard: { enabled: false } }, (p, c) => {
      const r = runHook('check-merge-guard.js', p, c, bash('gh pr merge 5'));
      assert.equal(r.status, 2, msg('merge protected exit', 'REQ-7+REQ-10 protected guard', 'exit 2', `${r.status} ${r.stderr}`, 'A project file must not be able to switch off the merge guard.'));
      assert.ok(r.stderr.includes('merge_guard'), msg('merge protected warning', 'REQ-7+REQ-10', "stderr names 'merge_guard'", r.stderr, 'Report the ignored disable attempt.'));
      assert.ok(
        r.stderr.length > baselineStderr.length,
        msg('merge protected extra warning', 'REQ-7+REQ-10', `stderr longer than baseline block message (${baselineStderr.length} chars)`, `${r.stderr.length} chars`, 'The protected-guard warning is in addition to the normal block message.')
      );
    });
  });
});

test('session-start.cjs banner (REQ-11)', async (t) => {
  const payload = { hook_event_name: 'SessionStart', source: 'startup' };

  await t.test('no override: banner shows project dir basename, not the placeholder', () => {
    withProject(undefined, (p, c) => {
      const r = runHook('session-start.cjs', p, c, payload);
      assert.equal(r.status, 0, msg('banner exit', 'REQ-11', 'exit 0', `${r.status} ${r.stderr}`, 'Banner never blocks.'));
      assert.ok(r.stdout.includes(path.basename(p)), msg('banner basename', 'REQ-11 default project name', `stdout contains '${path.basename(p)}'`, r.stdout, 'Default the banner name to the project directory basename.'));
      assert.ok(!r.stdout.includes('My Project'), msg('banner placeholder', 'REQ-11 / REQ-13', "stdout lacks 'My Project'", r.stdout, 'The template placeholder must never appear.'));
    });
  });

  await t.test('override project_name and custom_notes appear in banner', () => {
    withProject({ project_name: 'Override Name', session_start: { custom_notes: ['note from project'] } }, (p, c) => {
      const r = runHook('session-start.cjs', p, c, payload);
      assert.equal(r.status, 0, msg('banner override exit', 'REQ-11', 'exit 0', `${r.status} ${r.stderr}`, 'Banner never blocks.'));
      assert.ok(r.stdout.includes('Override Name'), msg('banner override name', 'REQ-11', "stdout contains 'Override Name'", r.stdout, 'Use the project-local project_name.'));
      assert.ok(r.stdout.includes('note from project'), msg('banner override note', 'REQ-11', "stdout contains 'note from project'", r.stdout, 'Show project-local custom notes.'));
    });
  });

  await t.test('banner tells the reader where project settings live', () => {
    withProject(undefined, (p, c) => {
      const r = runHook('session-start.cjs', p, c, payload);
      assert.ok(r.stdout.includes('.claude/hooks.config.json'), msg('banner pointer', 'REQ-11', "stdout contains '.claude/hooks.config.json'", r.stdout, 'Point readers at the project-local settings file (forward slashes).'));
    });
  });
});

test('hooks.json registration (REQ-12)', () => {
  const hooks = JSON.parse(fs.readFileSync(path.join(__dirname, 'hooks.json'), 'utf8')).hooks;
  const commandsOf = (event) =>
    (hooks[event] || []).flatMap((entry) => (entry.hooks || []).map((h) => h.command || ''));

  const start = commandsOf('SessionStart');
  assert.ok(
    start.some((cmd) => cmd.includes('session-start.cjs')),
    msg('SessionStart registration', 'REQ-12', "a SessionStart command referencing 'session-start.cjs'", start, 'Register the banner under SessionStart.')
  );
  const prompt = commandsOf('UserPromptSubmit');
  assert.deepStrictEqual(
    prompt.filter((cmd) => cmd.includes('session-start')),
    [],
    msg('UserPromptSubmit deregistration', 'REQ-12', 'no session-start command under UserPromptSubmit', prompt, 'The banner must not print on every prompt.')
  );
});

test('shared config.json is not a placeholder template (REQ-13)', () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
  assert.notEqual(cfg.project_name, 'My Project', msg('placeholder name', 'REQ-13', "project_name !== 'My Project'", cfg.project_name, 'Remove or replace the placeholder name.'));
  const notes = (cfg.session_start && cfg.session_start.custom_notes) || [];
  assert.ok(Array.isArray(notes), msg('notes type', 'REQ-13', 'custom_notes absent or an array', typeof notes, 'Keep notes an array if present.'));
  assert.deepStrictEqual(
    notes.filter((n) => String(n).includes('Add project-specific reminders here')),
    [],
    msg('placeholder notes', 'REQ-13', "no note containing 'Add project-specific reminders here'", notes, 'Remove the placeholder reminder.')
  );
});

test('merge_guard stays enforced against malformed overrides (REQ-7b)', async (t) => {
  const cases = [
    ['enabled:"false" string', { merge_guard: { enabled: 'false' } }],
    ['section null', { merge_guard: null }],
  ];
  for (const [label, override] of cases) {
    await t.test(`${label}: gh pr merge 5 still exits 2`, () => {
      withProject(override, (p, c) => {
        const r = runHook('check-merge-guard.js', p, c, bash('gh pr merge 5'));
        assert.equal(r.status, 2, msg(`merge ${label}`, 'REQ-7b', 'exit 2', `${r.status} ${r.stderr}`, 'Only a boolean true may influence a protected guard; malformed values must never disable it.'));
        assert.ok(r.stderr.includes('merge_guard'), msg(`merge ${label} stderr`, 'REQ-7b', "stderr names 'merge_guard'", r.stderr, 'Report the ignored override.'));
      });
    });
  }
});

// ---- REQ-14: BOM-prefixed override through real hooks ----

function withBomProject(json, fn) {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hookcfg-int-bom-proj-'));
  const otherDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hookcfg-int-bom-cwd-'));
  try {
    fs.mkdirSync(path.join(projectDir, '.claude'), { recursive: true });
    fs.writeFileSync(
      path.join(projectDir, '.claude', 'hooks.config.json'),
      Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(json)])
    );
    return fn(projectDir, otherDir);
  } finally {
    fs.rmSync(projectDir, { recursive: true, force: true });
    fs.rmSync(otherDir, { recursive: true, force: true });
  }
}

test('BOM-prefixed override file (REQ-14)', async (t) => {
  await t.test('dep_guard.enabled=false in BOM file: silent, exit 0', () => {
    withBomProject('{"dep_guard":{"enabled":false}}', (p, c) => {
      const r = runHook('check-dep-guard.js', p, c, bash('npm install left-pad'));
      assert.equal(r.status, 0, msg('BOM dep exit', 'REQ-14', 'exit 0', r.status, 'Hook must exit 0.'));
      assert.equal(r.stderr, '', msg('BOM dep stderr', 'REQ-14 BOM override honoured', 'empty stderr', r.stderr, 'A BOM-prefixed override must take effect, not be discarded with a warning.'));
    });
  });

  await t.test('merge_guard.enabled=false in BOM file: gh pr merge 5 still exits 2', () => {
    withBomProject('{"merge_guard":{"enabled":false}}', (p, c) => {
      const r = runHook('check-merge-guard.js', p, c, bash('gh pr merge 5'));
      assert.equal(r.status, 2, msg('BOM merge exit', 'REQ-14+REQ-7', 'exit 2', `${r.status} ${r.stderr}`, 'BOM handling must not weaken the protected merge guard.'));
    });
  });
});

// ---- REQ-17: wiring proof for remaining hooks (behaviour documented in README.md) ----

function runHookRaw(script, projectDir, cwd, payload) {
  return runHook(script, projectDir, cwd, payload);
}

test('check-dep-guard.js documented options (README: custom_message)', () => {
  withProject({ dep_guard: { custom_message: 'CUSTOM-DEP-MSG-8841' } }, (p, c) => {
    const r = runHookRaw('check-dep-guard.js', p, c, bash('npm install left-pad'));
    assert.equal(r.status, 0, msg('custom_message exit', 'README dep_guard always exit 0', 'exit 0', r.status, 'Dep guard never blocks.'));
    assert.ok(r.stderr.includes('CUSTOM-DEP-MSG-8841'), msg('custom_message text', 'README custom_message overrides default text', "stderr contains 'CUSTOM-DEP-MSG-8841'", r.stderr, 'A project can replace the warning text.'));
  });
});

test('check-search-command.js documented options (README: allow_patterns)', () => {
  withProject({ search_guard: { allow_patterns: ['grep -r foo'] } }, (p, c) => {
    const r = runHookRaw('check-search-command.js', p, c, bash('grep -r foo .'));
    assert.equal(r.status, 0, msg('allow_patterns exit', 'README allow_patterns', 'exit 0', r.status, 'Allowed command passes.'));
    assert.equal(r.stderr, '', msg('allow_patterns stderr', 'README allow_patterns skip the check entirely', 'empty stderr', r.stderr, 'A matching allow pattern skips the check silently.'));
  });
});

test('check-arch-boundary.mjs reads the project override (README: arch_rules)', async (t) => {
  const payload = { tool_name: 'Write', tool_input: { file_path: 'packages/core/a.ts', content: "import { Button } from 'apps/ui/button';\n" } };
  const override = { arch_rules: { enabled: true, rules: [{ package_path: 'packages/core', forbidden_imports: ['apps/ui'], forbidden_frameworks: [], forbidden_content_pattern: null }] } };
  await t.test('no override: allowed (arch_rules disabled by default)', () => {
    withProject(undefined, (p, c) => {
      const r = runHookRaw('check-arch-boundary.mjs', p, c, payload);
      assert.equal(r.status, 0, msg('arch baseline', 'README arch_rules disabled by default', 'exit 0', `${r.status} ${r.stderr}`, 'Without a project rule nothing is blocked.'));
    });
  });
  await t.test('override enables a rule: forbidden import blocked with exit 2', () => {
    withProject(override, (p, c) => {
      const r = runHookRaw('check-arch-boundary.mjs', p, c, payload);
      assert.equal(r.status, 2, msg('arch override', 'README: rule violation exits 2', 'exit 2', `${r.status} ${r.stderr}`, 'The hook must apply rules from the project-local override.'));
      assert.notEqual(r.stderr.trim(), '', msg('arch override stderr', 'README stderr shows violation', 'non-empty stderr', r.stderr, 'Explain the violation.'));
    });
  });

  // Edit/MultiEdit carry replacement fields, not the file, and this hook runs
  // before the edit lands, so the file on disk is still the old version.
  const original = 'export const x = 1;\n';
  const forbidden = "import { Button } from 'apps/ui/button';\n";
  function sourceIn(dir) {
    const file = path.join(dir, 'packages', 'core', 'a.ts');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, original);
    return file;
  }
  await t.test('Edit adding a forbidden import: blocked with exit 2', () => {
    withProject(override, (p, c) => {
      const edit = { tool_name: 'Edit', tool_input: { file_path: sourceIn(p), old_string: original, new_string: forbidden + original } };
      const r = runHookRaw('check-arch-boundary.mjs', p, c, edit);
      assert.equal(r.status, 2, msg('arch edit', 'Edit payloads have no content field', 'exit 2', `${r.status} ${r.stderr}`, 'Apply old_string -> new_string to the current file and check the result.'));
    });
  });
  await t.test('MultiEdit adding a forbidden import: blocked with exit 2', () => {
    withProject(override, (p, c) => {
      const edits = [{ old_string: 'x = 1', new_string: 'x = 2' }, { old_string: 'export', new_string: forbidden + 'export' }];
      const r = runHookRaw('check-arch-boundary.mjs', p, c, { tool_name: 'MultiEdit', tool_input: { file_path: sourceIn(p), edits } });
      assert.equal(r.status, 2, msg('arch multiedit', 'MultiEdit applies edits in order', 'exit 2', `${r.status} ${r.stderr}`, 'Apply each edit in sequence and check the result.'));
    });
  });
  await t.test('Edit with no forbidden import: allowed with exit 0', () => {
    withProject(override, (p, c) => {
      const edit = { tool_name: 'Edit', tool_input: { file_path: sourceIn(p), old_string: 'x = 1', new_string: 'x = 2' } };
      const r = runHookRaw('check-arch-boundary.mjs', p, c, edit);
      assert.equal(r.status, 0, msg('arch benign edit', 'Only violations block', 'exit 0', `${r.status} ${r.stderr}`, 'A clean edit must pass.'));
    });
  });
  await t.test('Edit whose old_string is not in the file: new_string is still checked', () => {
    withProject(override, (p, c) => {
      const edit = { tool_name: 'Edit', tool_input: { file_path: sourceIn(p), old_string: 'not present', new_string: forbidden } };
      const r = runHookRaw('check-arch-boundary.mjs', p, c, edit);
      assert.equal(r.status, 2, msg('arch unmatched edit', 'The added text must not escape the check', 'exit 2', `${r.status} ${r.stderr}`, 'Fall back to checking new_string.'));
    });
  });
});

test('check-empty-tests.mjs reads the project override (README: empty_test_guard)', async (t) => {
  const content = "describe('suite', () => {\n  it('does something', () => {\n  });\n});\n";
  function payloadFor(dir) {
    const file = path.join(dir, 'sample.test.js');
    fs.writeFileSync(file, content);
    return { tool_name: 'Write', tool_input: { file_path: file, content } };
  }
  await t.test('no override: empty describe fails with exit 1', () => {
    withProject(undefined, (p, c) => {
      const r = runHookRaw('check-empty-tests.mjs', p, c, payloadFor(p));
      assert.equal(r.status, 1, msg('empty-tests baseline', 'README: fail when test files have empty blocks (exit 1)', 'exit 1', `${r.status} ${r.stderr}`, 'Default config rejects empty describe blocks.'));
    });
  });
  await t.test('Edit payload (no content field): reads the edited file and fails with exit 1', () => {
    withProject(undefined, (p, c) => {
      const { tool_input: { file_path } } = payloadFor(p);
      const edit = { tool_name: 'Edit', tool_input: { file_path, old_string: 'x', new_string: 'y' } };
      const r = runHookRaw('check-empty-tests.mjs', p, c, edit);
      assert.equal(r.status, 1, msg('empty-tests edit', 'Edit/MultiEdit carry no full content', 'exit 1', `${r.status} ${r.stderr}`, 'After an edit, read the file from file_path when tool_input.content is absent.'));
    });
  });
  function writePayload(dir, body) {
    const file = path.join(dir, 'node.test.js');
    fs.writeFileSync(file, body);
    return { tool_name: 'Write', tool_input: { file_path: file, content: body } };
  }
  await t.test('Node assert methods count as assertions: exit 0', () => {
    const body = "test('adds', () => {\n  assert.equal(add(1, 2), 3);\n  assert.strict.deepEqual([1], [1]);\n});\n";
    withProject(undefined, (p, c) => {
      const r = runHookRaw('check-empty-tests.mjs', p, c, writePayload(p, body));
      assert.equal(r.status, 0, msg('empty-tests node assert', 'assert.equal(...) is a real assertion', 'exit 0', `${r.status} ${r.stderr}`, 'Recognize assert.<method>(...) as well as assert(...).'));
    });
  });
  await t.test('test block with no assertion call at all: still exit 1', () => {
    const body = "test('runs', () => {\n  const assertion = add(1, 2);\n});\n";
    withProject(undefined, (p, c) => {
      const r = runHookRaw('check-empty-tests.mjs', p, c, writePayload(p, body));
      assert.equal(r.status, 1, msg('empty-tests no assert', 'A file with no assertion calls is theater', 'exit 1', `${r.status} ${r.stderr}`, 'Only an assert/expect call counts, not an identifier that starts with assert.'));
    });
  });
  await t.test("empty describe('suite', () => {}) beside a real test: exit 1 naming the describe", () => {
    const body = "describe('empty suite', () => {});\ntest('adds', () => {\n  assert.equal(add(1, 2), 3);\n});\n";
    withProject(undefined, (p, c) => {
      const r = runHookRaw('check-empty-tests.mjs', p, c, writePayload(p, body));
      assert.equal(r.status, 1, msg('empty-tests empty describe', 'README: fail when test files have empty blocks', 'exit 1', `${r.status} ${r.stderr}`, 'The callback is inside the describe( ) parentheses, so the pattern must not stop at its ().'));
      assert.match(r.stderr, /Empty describe\/suite block \(1 found\)/, msg('empty-tests empty describe stderr', 'README', 'names 1 empty describe block', r.stderr, 'Report the empty describe, not only the assertion check.'));
    });
  });
  await t.test("empty it('x', () => {}) and test('y', async () => {}) beside a real test: exit 1 counting both", () => {
    const body = "it('pending', () => {});\ntest('later', async () => { });\ntest('adds', () => {\n  assert.equal(add(1, 2), 3);\n});\n";
    withProject(undefined, (p, c) => {
      const r = runHookRaw('check-empty-tests.mjs', p, c, writePayload(p, body));
      assert.equal(r.status, 1, msg('empty-tests empty it', 'README: fail when test files have empty blocks', 'exit 1', `${r.status} ${r.stderr}`, 'Match empty it/test callbacks, sync or async.'));
      assert.match(r.stderr, /Empty it\/test block \(2 found\)/, msg('empty-tests empty it stderr', 'README', 'names 2 empty it/test blocks', r.stderr, 'Count each empty it/test block.'));
    });
  });
  await t.test('describe with a non-empty body and assertions: exit 0', () => {
    const body = "describe('math', () => {\n  test('adds', () => {\n    assert.equal(add(1, 2), 3);\n  });\n});\n";
    withProject(undefined, (p, c) => {
      const r = runHookRaw('check-empty-tests.mjs', p, c, writePayload(p, body));
      assert.equal(r.status, 0, msg('empty-tests full describe', 'Only empty blocks fail', 'exit 0', `${r.status} ${r.stderr}`, 'A describe whose body has tests must pass.'));
    });
  });
  await t.test('override enabled=false: silent, exit 0', () => {
    withProject({ empty_test_guard: { enabled: false } }, (p, c) => {
      const r = runHookRaw('check-empty-tests.mjs', p, c, payloadFor(p));
      assert.equal(r.status, 0, msg('empty-tests override exit', 'README project can disable non-protected guards', 'exit 0', `${r.status} ${r.stderr}`, 'Project override must reach this hook.'));
      assert.equal(r.stderr, '', msg('empty-tests override stderr', 'README', 'empty stderr', r.stderr, 'Disabled guard is silent.'));
    });
  });
});

test('check-todo-format.mjs reads the project override (README: todo_format)', async (t) => {
  const payload = { tool_name: 'Write', tool_input: { file_path: 'a.js', content: '// TODO fix this later\n' } };
  await t.test('no override: disabled by default, silent exit 0', () => {
    withProject(undefined, (p, c) => {
      const r = runHookRaw('check-todo-format.mjs', p, c, payload);
      assert.equal(r.status, 0, msg('todo baseline exit', 'config todo_format.enabled=false', 'exit 0', r.status, 'Disabled by default.'));
      assert.equal(r.stderr, '', msg('todo baseline stderr', 'config', 'empty stderr', r.stderr, 'Disabled hook is silent.'));
    });
  });
  await t.test('override enabled + on_violation=block: exit 1 with stderr', () => {
    withProject({ todo_format: { enabled: true, on_violation: 'block' } }, (p, c) => {
      const r = runHookRaw('check-todo-format.mjs', p, c, payload);
      assert.equal(r.status, 1, msg('todo block', 'README on_violation block exits 1', 'exit 1', `${r.status} ${r.stderr}`, 'Project override must enable and tune the hook.'));
      assert.notEqual(r.stderr.trim(), '', msg('todo block stderr', 'README', 'non-empty stderr', r.stderr, 'Report the bad TODO.'));
    });
  });
  await t.test('override enabled + on_violation=warn: exit 0 with stderr', () => {
    withProject({ todo_format: { enabled: true, on_violation: 'warn' } }, (p, c) => {
      const r = runHookRaw('check-todo-format.mjs', p, c, payload);
      assert.equal(r.status, 0, msg('todo warn exit', 'README on_violation warn exits 0', 'exit 0', r.status, 'Warn mode never fails.'));
      assert.notEqual(r.stderr.trim(), '', msg('todo warn stderr', 'README', 'non-empty stderr', r.stderr, 'Warn mode prints.'));
    });
  });
  // PostToolUse: after an Edit, the file on disk is the edited version.
  function editOf(dir, body) {
    const file = path.join(dir, 'b.js');
    fs.writeFileSync(file, body);
    return { tool_name: 'Edit', tool_input: { file_path: file, old_string: 'x', new_string: 'y' } };
  }
  await t.test('Edit payload (no content field): bare TODO in the edited file blocks with exit 1', () => {
    withProject({ todo_format: { enabled: true, on_violation: 'block' } }, (p, c) => {
      const r = runHookRaw('check-todo-format.mjs', p, c, editOf(p, 'const y = 1;\n// TODO fix this later\n'));
      assert.equal(r.status, 1, msg('todo edit', 'Edit/MultiEdit carry no full content', 'exit 1', `${r.status} ${r.stderr}`, 'Read the file from file_path when tool_input.content is absent.'));
    });
  });
  await t.test('Edit payload with a conforming TODO: exit 0', () => {
    withProject({ todo_format: { enabled: true, on_violation: 'block' } }, (p, c) => {
      const r = runHookRaw('check-todo-format.mjs', p, c, editOf(p, 'const y = 1;\n// TODO(owner): fix this later\n'));
      assert.equal(r.status, 0, msg('todo edit ok', 'Conforming TODOs pass', 'exit 0', `${r.status} ${r.stderr}`, 'Only bare TODOs are violations.'));
    });
  });
});

test('validate-content.mjs reads the project override (README: content_watch)', async (t) => {
  const payload = { tool_name: 'Write', tool_input: { file_path: 'packages/content/items.json' } };
  function watch(validate_command) {
    return { content_watch: { enabled: true, path_pattern: 'packages/content', file_extensions: ['.json'], validate_command } };
  }
  await t.test('no override: disabled by default, silent exit 0', () => {
    withProject(undefined, (p, c) => {
      const r = runHookRaw('validate-content.mjs', p, c, payload);
      assert.equal(r.status, 0, msg('content baseline exit', 'config content_watch.enabled=false', 'exit 0', `${r.status} ${r.stderr}`, 'Disabled by default.'));
      assert.equal(r.stderr, '', msg('content baseline stderr', 'config', 'empty stderr', r.stderr, 'Disabled hook is silent.'));
    });
  });
  await t.test('override enables a failing validate_command: exit 1', () => {
    withProject(watch('node -e "process.exit(3)"'), (p, c) => {
      const r = runHookRaw('validate-content.mjs', p, c, payload);
      assert.equal(r.status, 1, msg('content fail exit', 'README: validation failure exits 1', 'exit 1', `${r.status} ${r.stderr}`, 'The hook must apply content_watch from the project-local override.'));
      assert.ok(r.stderr.includes('CONTENT VALIDATION FAILED'), msg('content fail stderr', 'README', "stderr contains 'CONTENT VALIDATION FAILED'", r.stderr, 'Report the failed validation.'));
    });
  });
  await t.test('override enables a passing validate_command: exit 0', () => {
    withProject(watch('node -e "process.exit(0)"'), (p, c) => {
      const r = runHookRaw('validate-content.mjs', p, c, payload);
      assert.equal(r.status, 0, msg('content pass exit', 'README: passing validation exits 0', 'exit 0', `${r.status} ${r.stderr}`, 'A passing command lets the write through.'));
      assert.ok(r.stderr.includes('Validation passed'), msg('content pass stderr', 'README', "stderr contains 'Validation passed'", r.stderr, 'The hook ran the override command.'));
    });
  });
});

test('check-git-push-audit.js reads the project override (README: push_audit)', async (t) => {
  // cwd is a temp dir that isn't a git repo, so an enabled audit can't read
  // the outgoing changes and blocks; a disabled one must not run at all.
  await t.test('no override: the audit runs and blocks an unauditable push', () => {
    withProject(undefined, (p, c) => {
      const r = runHook('check-git-push-audit.js', p, c, bash('git push origin feature'));
      assert.equal(r.status, 2, msg('push audit baseline', 'push_audit.enabled defaults to true', 'exit 2', `${r.status} ${r.stderr}`, 'The audit must run when not disabled.'));
    });
  });

  await t.test('override push_audit.enabled=false: allowed silently', () => {
    withProject({ push_audit: { enabled: false } }, (p, c) => {
      const r = runHook('check-git-push-audit.js', p, c, bash('git push origin feature'));
      assert.equal(r.status, 0, msg('push audit disabled exit', 'project config disables push_audit', 'exit 0', `${r.status} ${r.stderr}`, 'Honor push_audit.enabled=false before auditing.'));
      assert.equal(r.stdout, '', msg('push audit disabled stdout', 'disabled guard', 'empty stdout', r.stdout, 'A disabled audit must not emit a block decision.'));
    });
  });
});

test('check-commit-message.js reads the project override (README: commit_guard)', async (t) => {
  const BAD = bash('git commit -m "no sections"');

  await t.test('no override: the shared default blocks', () => {
    withProject(undefined, (p, c) => {
      const r = runHook('check-commit-message.js', p, c, BAD);
      assert.equal(r.status, 2, msg('commit guard default', 'commit_guard defaults to enabled + block', 'exit 2', `${r.status} ${r.stderr}`, 'A registered guard must keep blocking unless a project opts out.'));
    });
  });

  await t.test('override enabled + on_violation=block: blocks', () => {
    withProject({ commit_guard: { enabled: true, on_violation: 'block' } }, (p, c) => {
      const r = runHook('check-commit-message.js', p, c, BAD);
      assert.equal(r.status, 2, msg('commit guard block', 'on_violation=block', 'exit 2', `${r.status} ${r.stderr}`, 'Block a commit missing the required markers.'));
    });
  });

  await t.test('override enabled + on_violation=warn: warns on stderr, exit 0', () => {
    withProject({ commit_guard: { enabled: true, on_violation: 'warn' } }, (p, c) => {
      const r = runHook('check-commit-message.js', p, c, BAD);
      assert.equal(r.status, 0, msg('commit guard warn exit', 'on_violation=warn', 'exit 0', `${r.status} ${r.stdout}`, 'Warn mode never blocks.'));
      assert.match(r.stderr, /WHY:/, msg('commit guard warn stderr', 'on_violation=warn', 'stderr names the missing marker', r.stderr, 'Explain what is missing.'));
    });
  });

  await t.test('override enabled=false: allowed silently', () => {
    withProject({ commit_guard: { enabled: false } }, (p, c) => {
      const r = runHook('check-commit-message.js', p, c, BAD);
      assert.equal(r.status, 0, msg('commit guard disabled exit', 'enabled=false', 'exit 0', r.status, 'Disabled guard allows.'));
      assert.equal(r.stderr + r.stdout, '', msg('commit guard disabled output', 'enabled=false', 'no output', r.stderr + r.stdout, 'Disabled guard is silent.'));
    });
  });
});
