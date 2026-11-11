#!/usr/bin/env node
// check-commit-message.js
// PreToolUse hook — Bash
//
// Checks every `git commit` in a Bash call for the commit-message markers in
// config.json's commit_guard.required_markers (default WHY: and EXPECTED:),
// then blocks or warns per commit_guard.on_violation (default block).
//
// Commands are split and normalized with lib/git-command.cjs, the same
// parser the push/merge guards use, so `echo ok && git commit ...`,
// `git -C <dir> commit`, `/usr/bin/git commit` and `bash -c "git commit ..."`
// are all checked. Only the commit's own message counts: the values of
// -m/--message and --trailer, and the heredoc fed to `-F -`. Markers in
// another command of the chain, another argument (`--author`, a pathspec),
// a comment, or a heredoc git doesn't read as the message don't count.

'use strict';

const { loadHookConfig } = require('./lib/hook-config.cjs');
const { commandSegments, shellWords } = require('./lib/git-command.cjs');

const DEFAULT_MARKERS = ['WHY:', 'EXPECTED:'];

// A heredoc body spans lines, but belongs to the command that opened it
// (`git commit -F - <<'EOF'`). Left in place, the segment splitter would cut
// it on its newlines — and on any apostrophe in the prose — so each body is
// lifted out first and replaced by a token that's expanded again only where
// it's the message. The delimiter is any word bash accepts: quoted
// (`'END-MSG'`), backslash-quoted (`\EOF`) or bare (`123`, `END.MSG`).
// `<<<` is a here-string, not a heredoc.
const HEREDOC_OPEN_RE = /(?<!<)<<(?!<)-?[ \t]*(?:'([^'\n]*)'|"([^"\n]*)"|\\?([^\s;&|<>()'"]+))/g;
const HEREDOC_TOKEN_RE = /__HEREDOC_(\d+)__/g;

function liftHeredocs(command) {
  const bodies = [];
  let text = '';
  let pos = 0;
  HEREDOC_OPEN_RE.lastIndex = 0;
  let m;
  while ((m = HEREDOC_OPEN_RE.exec(command)) !== null) {
    const delimiter = m[1] ?? m[2] ?? m[3];
    const lineEnd = command.indexOf('\n', HEREDOC_OPEN_RE.lastIndex);
    if (lineEnd === -1) break;
    const lines = command.slice(lineEnd + 1).split('\n');
    // No closing line: not a heredoc after all (`echo "a << b"`), so look
    // past it for the next one.
    const close = lines.findIndex((line) => line.trim() === delimiter);
    if (close === -1) continue;
    bodies.push(lines.slice(0, close).join('\n'));
    const bodyEnd = lineEnd + 1 + lines.slice(0, close + 1).join('\n').length;
    text += `${command.slice(pos, m.index)}<<__HEREDOC_${bodies.length - 1}__${command.slice(HEREDOC_OPEN_RE.lastIndex, lineEnd)}`;
    pos = bodyEnd;
    HEREDOC_OPEN_RE.lastIndex = bodyEnd;
  }
  return { text: text + command.slice(pos), bodies };
}

// `git commit` options whose value is the next word (or attached with `=`).
const VALUE_OPTIONS = new Set([
  '--message', '--file', '--trailer', '--author', '--date', '--cleanup', '--pathspec-from-file',
  '--reuse-message', '--reedit-message', '--fixup', '--squash', '--template',
]);
// Short options whose value is the rest of the word or the next word.
const SHORT_VALUE_OPTIONS = new Set(['m', 'F', 'c', 'C', 't']);
// Short options whose value, if any, can only be attached (`-uno`, `-Skey`).
const SHORT_OPTIONAL_VALUE = new Set(['u', 'S']);

// What a normalized `git commit` segment's message is made of: `parts`
// (-m/--message and --trailer values, as the shell passes them), `stdin`
// (-F - / --file=-: the message is read from stdin) and `unknown` (it comes
// from a file, another commit or a template, which this hook can't read).
function messageSources(segment) {
  const args = shellWords(segment).slice(2);
  const parts = [];
  let stdin = false;
  let unknown = false;
  const take = (option, value) => {
    if (value === undefined) return;
    if (option === 'm' || option === '--message' || option === '--trailer') parts.push(value);
    else if (option === 'F' || option === '--file') {
      if (value === '-') stdin = true;
      else unknown = true;
    } else if (['c', 'C', 't', '--reuse-message', '--reedit-message', '--fixup', '--squash', '--template'].includes(option)) {
      unknown = true;
    }
  };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--') break;
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      const name = eq === -1 ? arg : arg.slice(0, eq);
      if (!VALUE_OPTIONS.has(name)) continue;
      take(name, eq === -1 ? args[++i] : arg.slice(eq + 1));
    } else if (arg.startsWith('-') && arg.length > 1) {
      for (let j = 1; j < arg.length; j++) {
        const opt = arg[j];
        if (SHORT_OPTIONAL_VALUE.has(opt)) break;
        if (SHORT_VALUE_OPTIONS.has(opt)) {
          take(opt, j + 1 < arg.length ? arg.slice(j + 1) : args[++i]);
          break;
        }
      }
    }
  }
  return { parts, stdin, unknown };
}

// The message a normalized `git commit` segment commits, as far as it can
// be known: heredoc tokens inside a -m value (`-m "$(cat <<'EOF' ...)"`)
// are expanded, and with `-F -` a heredoc the segment feeds to stdin is
// the message. Null when it can't be known.
function commitMessage(segment, bodies) {
  const { parts, stdin, unknown } = messageSources(segment);
  if (unknown) return null;
  const used = new Set();
  const expand = (s) => s.replace(HEREDOC_TOKEN_RE, (_m, i) => {
    used.add(i);
    return `\n${bodies[i]}\n`;
  });
  const message = parts.map(expand);
  if (stdin) {
    const fed = [...segment.matchAll(/<<__HEREDOC_(\d+)__/g)].map((m) => m[1]).find((i) => !used.has(i));
    if (fed === undefined) return null;
    message.push(bodies[fed]);
  }
  return message.join('\n\n');
}

function missingMarkers(command, markers = DEFAULT_MARKERS) {
  const { text, bodies } = liftHeredocs(command || '');
  for (const { raw, normalized } of commandSegments(text)) {
    if (!/^git\s+commit(?:\s|$)/.test(normalized)) continue;
    const message = commitMessage(normalized, bodies) ?? '';
    const missing = markers.filter((m) => !message.includes(m));
    if (missing.length > 0) return { segment: raw.replace(HEREDOC_TOKEN_RE, '<<heredoc'), missing };
  }
  return null;
}

// The first `git commit` segment missing a required marker, or null.
function findUnmarkedCommit(command, markers = DEFAULT_MARKERS) {
  const found = missingMarkers(command, markers);
  return found ? found.segment : null;
}

// What the hook should do with a command under a commit_guard config:
// { action: 'allow' | 'warn' | 'block', segment?, missing? }.
function commitVerdict(command, guard = {}) {
  if (guard.enabled === false) return { action: 'allow' };
  const markers = Array.isArray(guard.required_markers) && guard.required_markers.length > 0
    ? guard.required_markers
    : DEFAULT_MARKERS;
  const found = missingMarkers(command, markers);
  if (!found) return { action: 'allow' };
  return { action: guard.on_violation === 'warn' ? 'warn' : 'block', ...found };
}

module.exports = { findUnmarkedCommit, commitVerdict };

if (require.main === module) {
  const chunks = [];
  process.stdin.on('data', (chunk) => chunks.push(chunk));
  process.stdin.on('end', () => {
    let input;
    try {
      input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      process.exit(0);
    }

    let guard = {};
    try {
      guard = loadHookConfig({ hooksDir: __dirname }).commit_guard || {};
    } catch {
      // Unreadable shared config: keep enforcing with the defaults.
    }

    const verdict = commitVerdict(input?.tool_input?.command, guard);
    if (verdict.action === 'allow') process.exit(0);

    const reason = `Commit messages must include ${verdict.missing.join(' and ')} section(s). Use the required format before proceeding.`;
    if (verdict.action === 'warn') {
      process.stderr.write(`[commit-guard] WARN: ${reason}\n  Command: ${verdict.segment}\n`);
      process.exit(0);
    }
    process.stdout.write(JSON.stringify({ continue: false, stopReason: reason }));
    process.exit(2);
  });
}
