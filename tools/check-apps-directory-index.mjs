#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import {
  listAppsChildDirectories,
  shouldValidateAppsDirectoryIndex,
} from './lib/apps-directory-index.mjs';

function usage() {
  return [
    'Usage: node tools/check-apps-directory-index.mjs --root <repo>',
    '',
    'Validates apps/README.md directory index rules from DOCUMENTATION_SPEC.md section 3.3.',
  ].join('\n');
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function isDirectory(absolutePath) {
  return fs.existsSync(absolutePath) && fs.statSync(absolutePath).isDirectory();
}

function isFile(absolutePath) {
  return fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile();
}

function containsLink(text, target) {
  const normalized = target.replace(/\\/g, '/');
  return (
    text.includes(normalized)
    || text.includes(`(${normalized})`)
    || text.includes(`<${normalized}>`)
  );
}

export function validateAppsDirectoryIndex(root) {
  const issues = [];

  if (!shouldValidateAppsDirectoryIndex(root)) {
    return { skipped: true, issues };
  }

  const appsDir = path.join(root, 'apps');
  if (!isDirectory(appsDir)) {
    issues.push('apps/ must exist for independent SDKWork application repositories');
    return { skipped: false, issues };
  }

  const appsReadmePath = path.join(appsDir, 'README.md');
  if (!isFile(appsReadmePath)) {
    issues.push('apps/README.md must exist and index every direct child application root');
    return { skipped: false, issues };
  }

  const appsReadmeText = readText(appsReadmePath);
  if (!/APPLICATION_SPEC\.md/iu.test(appsReadmeText)) {
    issues.push('apps/README.md must cite APPLICATION_SPEC.md');
  }
  if (!/SDKWORK_WORKSPACE_SPEC\.md/iu.test(appsReadmeText)) {
    issues.push('apps/README.md must cite SDKWORK_WORKSPACE_SPEC.md');
  }
  if (!/primary app surface|repository root is|仓库根|主应用面/iu.test(appsReadmeText)) {
    issues.push('apps/README.md must state whether the repository root is the primary app surface');
  }
  if (!/directory index|目录索引|##\s+.*index/iu.test(appsReadmeText)) {
    issues.push('apps/README.md must include a directory index section');
  }

  for (const childName of listAppsChildDirectories(root)) {
    if (!appsReadmeText.includes(childName)) {
      issues.push(`apps/README.md must index direct child directory ${childName}`);
    }
  }

  const rootReadmePath = path.join(root, 'README.md');
  if (isFile(rootReadmePath)) {
    const rootReadmeText = readText(rootReadmePath);
    if (!containsLink(rootReadmeText, 'apps/README.md')) {
      issues.push('README.md must link to apps/README.md when apps/ exists');
    }
  } else {
    issues.push('README.md must exist and link to apps/README.md when apps/ exists');
  }

  return { skipped: false, issues };
}

function fail(message, details = []) {
  console.error(`apps directory index failed: ${message}`);
  for (const detail of details) {
    console.error(`- ${detail}`);
  }
  process.exit(1);
}

function runCli() {
  const parsed = parseArgs({
    options: {
      root: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
    allowPositionals: false,
  });

  if (parsed.values.help) {
    console.log(usage());
    process.exit(0);
  }

  const root = path.resolve(
    parsed.values.root
    || path.join(path.dirname(fileURLToPath(import.meta.url)), '..'),
  );
  const result = validateAppsDirectoryIndex(root);

  if (result.skipped) {
    process.stdout.write('apps directory index skipped (not an independent application repository)\n');
    process.exit(0);
  }

  if (result.issues.length > 0) {
    fail(`repository layout is not compliant (${root})`, result.issues);
  }

  process.stdout.write('apps directory index ok\n');
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  runCli();
}
