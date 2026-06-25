#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execSync } from 'node:child_process';

function parseArgs(argv) {
  const args = { root: process.cwd() };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--root' && argv[i + 1]) {
      args.root = resolve(argv[i + 1]);
      i += 1;
    }
  }
  return args;
}

function checkGitBranch(root) {
  try {
    const branch = execSync('git branch --show-current', { cwd: root, encoding: 'utf8' }).trim();
    return { ok: branch === 'main', detail: branch || 'detached' };
  } catch {
    return { ok: false, detail: 'not a git repository' };
  }
}

function checkFile(root, rel) {
  return existsSync(join(root, rel));
}

function checkForbiddenTracked(root) {
  try {
    const files = execSync('git ls-files', { cwd: root, encoding: 'utf8' })
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const forbidden = files.filter((file) =>
      /(^|\/)node_modules\//.test(file)
      || /(^|\/)target\//.test(file)
      || /(^|\/)dist\//.test(file)
      || /(^|\/)\.env$/.test(file),
    );
    return { ok: forbidden.length === 0, detail: forbidden.slice(0, 5) };
  } catch {
    return { ok: true, detail: [] };
  }
}

function main(argv = process.argv.slice(2)) {
  const { root } = parseArgs(argv);
  const checks = [
    ['branch-main', checkGitBranch(root)],
    ['agents', { ok: checkFile(root, 'AGENTS.md'), detail: 'AGENTS.md' }],
    ['claude-shim', { ok: checkFile(root, 'CLAUDE.md'), detail: 'CLAUDE.md' }],
    ['gemini-shim', { ok: checkFile(root, 'GEMINI.md'), detail: 'GEMINI.md' }],
    ['codex-shim', { ok: checkFile(root, 'CODEX.md'), detail: 'CODEX.md' }],
    ['gitignore', { ok: checkFile(root, '.gitignore'), detail: '.gitignore' }],
    ['sdkwork-readme', { ok: checkFile(root, '.sdkwork/README.md'), detail: '.sdkwork/README.md' }],
    ['sdkwork-skills', { ok: checkFile(root, '.sdkwork/skills/README.md'), detail: '.sdkwork/skills/README.md' }],
    ['sdkwork-plugins', { ok: checkFile(root, '.sdkwork/plugins/README.md'), detail: '.sdkwork/plugins/README.md' }],
    ['sdkwork-gitignore', { ok: checkFile(root, '.sdkwork/.gitignore'), detail: '.sdkwork/.gitignore' }],
    ['forbidden-tracked', checkForbiddenTracked(root)],
  ];

  const failures = checks.filter(([, result]) => !result.ok);
  const lines = [`Repository baseline audit: ${root}`];
  for (const [name, result] of checks) {
    lines.push(`${result.ok ? 'PASS' : 'FAIL'} ${name}${result.detail ? ` (${JSON.stringify(result.detail)})` : ''}`);
  }

  console.log(lines.join('\n'));
  return failures.length === 0 ? 0 : 1;
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  process.exitCode = main();
}

export { main };
