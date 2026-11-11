#!/usr/bin/env node
/**
 * check-arch-boundary.mjs
 * Hook type : PreToolUse — Write | Edit | MultiEdit
 * Purpose   : Enforce package boundary rules defined in config.json.
 *             Exits 2 (block) on violation so Claude Code sees the message
 *             and self-corrects. Exits 0 (allow) when all checks pass.
 *
 * Inputs (via stdin JSON):
 *   { tool_name, tool_input: { file_path, content } }                (Write)
 *   { tool_name, tool_input: { file_path, old_string, new_string } } (Edit)
 *   { tool_name, tool_input: { file_path, edits: [...] } }           (MultiEdit)
 *
 * Config used:
 *   .claude/hooks/config.json → arch_rules.enabled, arch_rules.rules[]
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

// ── Locate config relative to this script ────────────────────────────────
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const { loadHookConfig } = createRequire(import.meta.url)('./lib/hook-config.cjs');
const CONFIG_PATH = resolve(SCRIPT_DIR, 'config.json');

function warn(msg) {
  process.stderr.write(`[arch-boundary] WARN: ${msg}\n`);
}

function block(violations) {
  process.stderr.write('\n⛔ ARCH-BOUNDARY VIOLATION — fix before proceeding\n\n');
  violations.forEach(v => process.stderr.write(`   • ${v}\n`));
  process.stderr.write('\n');
  process.exit(2);
}

// Write sends the whole file as `content`. Edit and MultiEdit send only
// replacement fields, and this hook runs before the edit lands, so the
// edits are applied to the current file to get what it will become. A
// new_string whose old_string isn't found is appended, so text being added
// is never left unchecked.
function contentAfterEdit(input) {
  if (typeof input.content === 'string') return input.content;
  const edits = Array.isArray(input.edits) ? input.edits : [input];
  let text = '';
  try {
    text = readFileSync(input.file_path, 'utf8');
  } catch {
    // New or unreadable file: only the added text can be checked.
  }
  const unmatched = [];
  for (const { old_string: from = '', new_string: to = '', replace_all } of edits) {
    if (from && text.includes(from)) {
      text = replace_all ? text.split(from).join(to) : text.replace(from, () => to);
    } else if (to) {
      unmatched.push(to);
    }
  }
  return [text, ...unmatched].join('\n');
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Load config ───────────────────────────────────────────────────────────
let config;
try {
  config = loadHookConfig({ hooksDir: SCRIPT_DIR });
} catch {
  warn(`config.json not found or invalid at ${CONFIG_PATH} — skipping arch checks`);
  process.exit(0);
}

if (!config.arch_rules?.enabled) {
  // Arch checking is opt-in. Silent pass when not enabled.
  process.exit(0);
}

const rules = config.arch_rules.rules ?? [];
if (rules.length === 0) {
  warn('arch_rules.enabled is true but no rules are defined in config.json — add rules or set enabled=false');
  process.exit(0);
}

// ── Read stdin ────────────────────────────────────────────────────────────
const chunks = [];
process.stdin.on('data', c => chunks.push(c));
process.stdin.on('end', () => {
  let payload;
  try {
    payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    // Cannot parse stdin — allow and move on (do not block on hook failure)
    process.exit(0);
  }

  const filePath = (payload?.tool_input?.file_path ?? '').replace(/\\/g, '/');
  if (!filePath) process.exit(0);
  const content = contentAfterEdit(payload.tool_input);

  // ── Run rules ───────────────────────────────────────────────────────────
  process.stderr.write(`[arch-boundary] Checking: ${filePath}\n`);

  const violations = [];

  for (const rule of rules) {
    if (!rule.package_path) continue;
    if (!filePath.includes(rule.package_path)) continue;

    // Forbidden import paths (e.g. "apps/ui")
    for (const forbidden of rule.forbidden_imports ?? []) {
      const pattern = new RegExp(`from ['"][^'"]*${escapeRegex(forbidden)}`);
      if (pattern.test(content)) {
        violations.push(`${rule.package_path} must not import from ${forbidden}`);
      }
    }

    // Forbidden framework imports (e.g. "react", "vue")
    for (const framework of rule.forbidden_frameworks ?? []) {
      const pattern = new RegExp(`from ['"]${escapeRegex(framework)}['"]`);
      if (pattern.test(content)) {
        violations.push(
          `${rule.package_path} must not import '${framework}' — keep this package framework-free`
        );
      }
    }

    // Hardcoded content strings (optional heuristic, expects a regex string)
    if (rule.forbidden_content_pattern) {
      try {
        if (new RegExp(rule.forbidden_content_pattern).test(content)) {
          violations.push(
            `${rule.package_path}: file appears to hardcode content strings ` +
            `matching /${rule.forbidden_content_pattern}/ — move content to a dedicated data package`
          );
        }
      } catch {
        warn(`forbidden_content_pattern for '${rule.package_path}' is not valid regex — skipping that check`);
      }
    }
  }

  if (violations.length > 0) {
    block(violations);
  }

  process.stderr.write('[arch-boundary] OK\n');
  process.exit(0);
});
