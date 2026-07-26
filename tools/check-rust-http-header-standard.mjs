#!/usr/bin/env node
/** Validates panic-free static Rust HTTP header construction. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const SPECS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IGNORED_DIRECTORIES = new Set([
  '.git', 'artifacts', 'dist', 'external', 'generated', 'node_modules', 'target', 'vendor',
]);

function rustFiles(root) {
  const files = [];
  function visit(current) {
    if (!fs.existsSync(current)) return;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) continue;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.name.endsWith('.rs')) files.push(absolute);
    }
  }
  visit(root);
  return files;
}

export function scanRustHttpHeaderStandard(root) {
  const issues = [];
  for (const file of rustFiles(root)) {
    const text = fs.readFileSync(file, 'utf8');
    const relative = path.relative(root, file).replace(/\\/gu, '/');
    const displayConstant = /HeaderName::from_static\s*\(\s*(?:sdkwork_utils_rust::)?SDKWORK_TRACE_ID_HEADER\s*\)/gu;
    if (displayConstant.test(text)) {
      issues.push(`${relative}: HeaderName::from_static uses display-cased SDKWORK_TRACE_ID_HEADER`);
    }
    const staticLiteral = /HeaderName::from_static\s*\(\s*"([^"]+)"\s*\)/gu;
    for (const match of text.matchAll(staticLiteral)) {
      if (match[1] !== match[1].toLowerCase() || !/^[!-~]+$/u.test(match[1])) {
        issues.push(`${relative}: static header literal must be lowercase ASCII: ${match[1]}`);
      }
    }
  }
  return issues;
}

function scanWorkspace(workspace) {
  const issues = [];
  for (const entry of fs.readdirSync(workspace, { withFileTypes: true })) {
    if (!entry.isDirectory() || IGNORED_DIRECTORIES.has(entry.name)) continue;
    const root = path.join(workspace, entry.name);
    issues.push(...scanRustHttpHeaderStandard(root).map((issue) => `${entry.name}: ${issue}`));
  }
  return issues;
}

function main() {
  const { values } = parseArgs({
    options: {
      root: { type: 'string', default: SPECS_ROOT },
      workspace: { type: 'string' },
    },
  });
  const issues = values.workspace
    ? scanWorkspace(path.resolve(values.workspace))
    : scanRustHttpHeaderStandard(path.resolve(values.root));
  if (issues.length > 0) {
    console.error('Rust HTTP header standard check failed:');
    for (const issue of issues.slice(0, 200)) console.error(`- ${issue}`);
    process.exit(1);
  }
  console.log('Rust HTTP header standard check passed');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
