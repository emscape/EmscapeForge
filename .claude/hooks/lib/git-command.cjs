'use strict';

// Shared command parsing for the git/gh guard hooks (check-merge-guard.js,
// check-branch-delete-guard.js, check-ci-status-after-push.js).
//
// Every guard anchors its checks on a bare `git push` / `gh pr merge` /
// etc. at the start of a command segment, so all of them need the same
// normalization first: split the command on chain operators outside
// quotes, strip env/sudo/command/exec prefixes, unwrap `bash -c "..."`
// wrappers, drop a path prefix on the binary, and skip git/gh global
// options that sit before the subcommand. Each hook used to carry its own
// copy of some subset of this, and the copies drifted — the less thorough
// ones could be bypassed by forms the thorough one already handled.
//
// This is a guard against an assistant's mistakes, not a full shell
// parser: it covers the forms seen in practice and in review, and errs
// toward recognizing a command rather than missing it.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// One shell word as it appears in the raw command string: any run of
// unquoted non-space characters and quoted regions, concatenated —
// `"C:\Work Tree"`, `'/a b'`, and `user.name="A B"` are each one word. An
// option value pattern of `\S+` stops at the first space inside quotes,
// leaving the rest of the path behind as a fake subcommand.
const WORD = `(?:[^\\s"']|"[^"]*"|'[^']*')+`;
const OPTIONAL_WORD = `(?:${WORD})?`;

// Splits on shell chain operators (`&&`, `||`, `;`, `&`, `|`, newline) —
// only those outside any quoted string, so a commit message that merely
// *mentions* `git push origin main && ...` is not split into a fake push.
// Inside double quotes a backslash escapes the next character (so `\"`
// doesn't end the quote); single quotes are fully literal.
function segmentsOf(fullCmd) {
  const segments = [];
  let current = '';
  let quote = null; // null | '"' | "'"

  for (let i = 0; i < fullCmd.length; i++) {
    const ch = fullCmd[i];

    if (quote === '"') {
      if (ch === '\\' && i + 1 < fullCmd.length) {
        current += ch + fullCmd[i + 1];
        i++;
        continue;
      }
      current += ch;
      if (ch === '"') quote = null;
      continue;
    }
    if (quote === "'") {
      current += ch;
      if (ch === "'") quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }
    if ((ch === '&' && fullCmd[i + 1] === '&') || (ch === '|' && fullCmd[i + 1] === '|')) {
      segments.push(current);
      current = '';
      i++;
      continue;
    }
    if (ch === ';' || ch === '&' || ch === '|' || ch === '\n') {
      segments.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  segments.push(current);

  return segments.map((s) => s.trim()).filter(Boolean);
}

// Index of the closing quote for a quoted argument whose content starts at
// `startIdx`, honoring double-quote backslash escapes. -1 if unterminated.
function findClosingQuote(str, startIdx, quoteChar) {
  for (let i = startIdx; i < str.length; i++) {
    const ch = str[i];
    if (quoteChar === '"' && ch === '\\' && i + 1 < str.length) {
      i++;
      continue;
    }
    if (ch === quoteChar) return i;
  }
  return -1;
}

// `bash -c "..."` / `sh -lc '...'` / `--command` run their quoted argument
// as a nested command string. Returns that inner string (with the outer
// double-quote escaping undone), or null if `segment` isn't such a wrapper.
// Trailing words after the closing quote ($0/$1 for the inner script) are
// ignored — they can't change what runs.
function unwrapShellDashC(segment) {
  const opener = segment.match(/^(?:\S*[\\/])?(?:bash|sh|zsh|dash|ksh)(?:\.exe)?\s+(?:-[a-zA-Z]*c[a-zA-Z]*|--command)\s+(["'])/);
  if (!opener) return null;

  const quoteChar = opener[1];
  const contentStart = opener[0].length;
  const closeIdx = findClosingQuote(segment, contentStart, quoteChar);
  if (closeIdx === -1) return null;

  const content = segment.slice(contentStart, closeIdx);
  return quoteChar === '"' ? content.replace(/\\(["\\$`])/g, '$1') : content;
}

// A leading `env` (bare or path-qualified, with its own flags) and any
// number of `VAR=value` assignments — `GIT_SSH_COMMAND="ssh -vv" git push`
// is the same push.
const ENV_COMMAND = /^(?:\S*[\\/])?env(?=\s|$)\s*/;
const ENV_ASSIGNMENT = new RegExp(`^[A-Za-z_][A-Za-z0-9_]*=${OPTIONAL_WORD}\\s*`);
const ENV_NO_ARG_FLAG = /^(?:-i|--ignore-environment|-0|--null|-v|--debug)\s*/;
const ENV_ARG_FLAG_SEPARATE = new RegExp(`^(?:-u|--unset|-C|--chdir|-S|--split-string)\\s+${WORD}\\s*`);
const ENV_ARG_FLAG_COMBINED = new RegExp(`^(?:--unset|--chdir|--split-string)=${OPTIONAL_WORD}\\s*`);
const ENV_END_OPTIONS = /^--\s+/;

function stripLeadingEnvPrefix(segment) {
  let s = segment.replace(ENV_COMMAND, '');
  let prev;
  do {
    prev = s;
    s = s
      .replace(ENV_END_OPTIONS, '')
      .replace(ENV_ARG_FLAG_COMBINED, '')
      .replace(ENV_ARG_FLAG_SEPARATE, '')
      .replace(ENV_NO_ARG_FLAG, '')
      .replace(ENV_ASSIGNMENT, '');
  } while (s !== prev);
  return s;
}

// `sudo`, `command`, and `exec` run the real command without being a
// different, unwatched command themselves. Only each wrapper's common
// flags are handled.
const SUDO_ARG_FLAG = new RegExp(`^(?:-u|--user)\\s+${WORD}\\s*`);
const SUDO_NO_ARG_FLAG = /^(?:-n|--non-interactive|-i|--login|-E|--preserve-env|-H|--set-home)\s*/;
const COMMAND_NO_ARG_FLAG = /^-[pvV]\s*/;

function stripLeadingWrapperPrefix(segment) {
  const m = segment.match(/^(sudo|command|exec)\b\s*/);
  if (!m) return segment;

  let s = segment.slice(m[0].length);
  let prev;
  do {
    prev = s;
    if (m[1] === 'sudo') {
      s = s.replace(SUDO_ARG_FLAG, '').replace(SUDO_NO_ARG_FLAG, '');
    } else if (m[1] === 'command') {
      s = s.replace(COMMAND_NO_ARG_FLAG, '');
    }
  } while (s !== prev);
  return s;
}

// Shell control-flow words that put the next word in command position:
// once `if true; then git push; fi` is split on `;`, the push segment
// starts with `then`. Same for `do`/`else`/`elif`/`if`/`while`/`until`,
// `!`, a `{` group, and a `(` subshell (whose closing `)` is dropped too,
// so `(git push origin main)` doesn't leave `main)` as the branch).
const CONTROL_FLOW_WORD = /^(?:if|then|else|elif|do|while|until|!|\{)\s+/;
const SUBSHELL_OPEN = /^\(\s*/;

function stripLeadingControlFlow(segment) {
  const s = segment.replace(CONTROL_FLOW_WORD, '');
  if (s !== segment) return s;
  if (SUBSHELL_OPEN.test(segment)) {
    return segment.replace(SUBSHELL_OPEN, '').replace(/\s*\)$/, '');
  }
  return segment;
}

// Env prefixes, sudo/command/exec wrappers, and control-flow words, in any
// mix and order.
function stripPrefixes(segment) {
  let s = segment;
  let prev;
  do {
    prev = s;
    s = stripLeadingWrapperPrefix(stripLeadingEnvPrefix(stripLeadingControlFlow(s)));
  } while (s !== prev);
  return s;
}

// `/usr/bin/git`, `./bin/gh.exe`, or a quoted Windows path such as
// `"C:\Program Files\Git\bin\git.exe"` → bare `git` / `gh`.
function stripCommandPathPrefix(segment) {
  const quoted = segment.match(/^(["'])([^"']*[\\/](gh|git)(?:\.exe)?)\1(\s.*)?$/);
  if (quoted) {
    return `${quoted[3]}${quoted[4] || ''}`;
  }
  return segment.replace(/^(\S*[\\/])(gh|git)(?:\.exe)?\b/, '$2');
}

// git's own global options between `git` and the subcommand
// (`git -C "C:\Work Tree" push ...`). Values are whole shell words, so a
// quoted path with spaces is consumed in full.
const GIT_GLOBAL_ARG_FLAG_SEPARATE = new RegExp(`^(?:-C|-c|--git-dir|--work-tree|--namespace|--exec-path|--config-env)\\s+${WORD}\\s*`);
const GIT_GLOBAL_ARG_FLAG_COMBINED = new RegExp(`^(?:--git-dir|--work-tree|--namespace|--exec-path|--config-env)=${OPTIONAL_WORD}\\s*`);
const GIT_GLOBAL_NO_ARG_FLAG = /^(?:-p|--paginate|-P|--no-pager|--bare|--no-replace-objects|--literal-pathspecs|--no-optional-locks)\s*/;

function stripGitGlobalOptions(afterGit) {
  let s = afterGit;
  let prev;
  do {
    prev = s;
    s = s
      .replace(GIT_GLOBAL_ARG_FLAG_COMBINED, '')
      .replace(GIT_GLOBAL_ARG_FLAG_SEPARATE, '')
      .replace(GIT_GLOBAL_NO_ARG_FLAG, '');
  } while (s !== prev);
  return s;
}

// gh's -R/--repo and --hostname selectors before the subcommand.
const GH_GLOBAL_ARG_FLAG_SEPARATE = new RegExp(`^(?:-R|--repo|--hostname)\\s+${WORD}\\s*`);
const GH_GLOBAL_ARG_FLAG_COMBINED = new RegExp(`^--(?:repo|hostname)=${OPTIONAL_WORD}\\s*`);

function stripGhGlobalOptions(afterGh) {
  let s = afterGh;
  let prev;
  do {
    prev = s;
    s = s
      .replace(GH_GLOBAL_ARG_FLAG_COMBINED, '')
      .replace(GH_GLOBAL_ARG_FLAG_SEPARATE, '');
  } while (s !== prev);
  return s;
}

// One segment (no chain operators, not a shell wrapper) → its bare
// `git <subcommand> ...` / `gh <subcommand> ...` form, or the prefix-
// stripped segment unchanged if it's some other command.
function normalizeSegment(segment) {
  const s = stripCommandPathPrefix(stripPrefixes(segment));
  if (/^git\s+/.test(s)) {
    return `git ${stripGitGlobalOptions(s.slice('git '.length).trimStart())}`;
  }
  if (/^gh\s+/.test(s)) {
    return `gh ${stripGhGlobalOptions(s.slice('gh '.length).trimStart())}`;
  }
  return s;
}

// Git Bash spells Windows drives as `/c/repos/x`; Node on Windows would
// resolve that against the current drive as `C:\c\repos\x`.
function toNativePath(p) {
  if (process.platform !== 'win32') return p;
  const m = p.match(/^\/([a-zA-Z])(?:\/(.*))?$/);
  return m ? `${m[1].toUpperCase()}:\\${(m[2] || '').replace(/\//g, '\\')}` : p;
}

// A directory argument as written (`"C:\Work Tree"`, `~/x`, `../y`)
// resolved against `base`, or null when it can't be known statically —
// `cd -`, a `$VAR`, a command substitution, or no known base.
function resolveDirArg(base, rawArg) {
  if (base === null) return null;
  const arg = stripSurroundingQuotes(rawArg || '~');
  if (arg === '-' || /[$`]/.test(arg)) return null;
  if (arg === '~') return os.homedir();
  if (arg.startsWith('~/')) return path.join(os.homedir(), arg.slice(2));
  return path.resolve(base, toNativePath(arg));
}

const CD_COMMAND = new RegExp(`^(?:cd|pushd)(?:\\s+(${WORD}))?\\s*$`);
const GIT_DASH_C = new RegExp(`^-C\\s+(${WORD})\\s*`);

// The directory a git command runs in: each `-C <dir>` global option
// resolves against the one before it, as git itself does.
function gitDir(segment, base) {
  const s = stripCommandPathPrefix(stripPrefixes(segment));
  if (!/^git\s+/.test(s)) return base;
  let rest = s.slice('git '.length).trimStart();
  let dir = base;
  let prev;
  do {
    prev = rest;
    const m = rest.match(GIT_DASH_C);
    if (m) {
      dir = resolveDirArg(dir, m[1]);
      rest = rest.slice(m[0].length);
    } else {
      rest = rest
        .replace(GIT_GLOBAL_ARG_FLAG_COMBINED, '')
        .replace(GIT_GLOBAL_ARG_FLAG_SEPARATE, '')
        .replace(GIT_GLOBAL_NO_ARG_FLAG, '');
    }
  } while (rest !== prev);
  return dir;
}

// Every command a raw Bash command string would run, flattened: split on
// chain operators, with shell -c wrappers unwrapped recursively. Prefixes
// are stripped *before* testing for a wrapper — otherwise `env bash -c
// "gh pr merge 27"` is never seen as a wrapper (it starts with `env`) and
// stripping `env` afterward leaves an un-expanded `bash -c ...`.
//
// Returns [{ raw, normalized, cwd }]: `raw` is the segment as written, for
// human-readable reports; `normalized` is what anchored checks run on;
// `cwd` is the directory the command runs in, after any earlier `cd`/
// `pushd` and its own `git -C` (null when that can't be known statically).
// A `cd` inside a shell wrapper doesn't carry out of it, as in a real shell.
function commandSegments(fullCmd, startDir = process.cwd()) {
  const out = [];
  let dir = startDir;
  for (const raw of segmentsOf(fullCmd)) {
    const inner = unwrapShellDashC(stripPrefixes(raw));
    if (inner !== null) {
      out.push(...commandSegments(inner, dir));
      continue;
    }
    const normalized = normalizeSegment(raw);
    if (/^(?:cd|pushd|popd)(?:\s|$)/.test(normalized)) {
      // A form this can't follow (`cd $(...)`, `popd`) makes the directory
      // unknown rather than silently leaving it where it was.
      const cd = normalized.match(CD_COMMAND);
      dir = cd && !normalized.startsWith('popd') ? resolveDirArg(dir, cd[1]) : null;
    }
    out.push({ raw, normalized, cwd: gitDir(raw, dir) });
  }
  return out;
}

// The directory the first `git push` in the command runs in, if it can be
// determined and exists; otherwise null.
function pushTargetDir(fullCmd, startDir = process.cwd()) {
  const push = commandSegments(fullCmd, startDir).find((s) => /^git\s+push(?:\s|$)/.test(s.normalized));
  if (!push || push.cwd === null) return null;
  return fs.existsSync(push.cwd) ? push.cwd : null;
}

// True if any command in the string is an actual `git push`.
function isGitPush(fullCmd) {
  return commandSegments(fullCmd).some((s) => /^git\s+push(?:\s|$)/.test(s.normalized));
}

// Strips one matching pair of surrounding quotes from a whitespace-split
// token, so `"main"` compares equal to `main`.
function stripSurroundingQuotes(token) {
  if (token.length >= 2) {
    const first = token[0];
    const last = token[token.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return token.slice(1, -1);
    }
  }
  return token;
}

module.exports = {
  commandSegments,
  isGitPush,
  normalizeSegment,
  pushTargetDir,
  segmentsOf,
  stripLeadingEnvPrefix,
  stripSurroundingQuotes,
};
