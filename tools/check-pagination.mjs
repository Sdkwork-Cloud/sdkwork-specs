#!/usr/bin/env node
/**
 * Heuristic pagination smell checker per PAGINATION_SPEC.md §2 and §10.2.
 * Reports likely in-process pagination and interactive listAll usage; not a substitute for review.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const SPECS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const RUST_SMELLS = [
  {
    id: 'rust-collect-then-skip',
    pattern: /collect::<Vec[^>]*>\(\)[\s\S]{0,240}?\.(skip|take)\(/g,
    message: 'collect into Vec then skip/take — likely in-process pagination',
  },
  {
    id: 'rust-list-window',
    pattern: /\blist_window\s*\(/g,
    message: 'list_window helper on materialized collection',
  },
  {
    id: 'rust-per-request-inbox-collect',
    pattern: /collect_inbox_entries_for_principal_kind/g,
    message: 'per-request inbox projection rebuild before paging (§2.3)',
    debtId: 'PAG-001',
  },
  {
    id: 'rust-per-request-contact-collect',
    pattern: /collect_contacts_for_owner/g,
    message: 'per-request contacts projection rebuild before paging (§2.3)',
    debtId: 'PAG-002',
  },
  {
    id: 'rust-member-directory-overfetch',
    pattern: /limit\.saturating_mul\(4\)/g,
    message: 'member directory over-fetch then filter/take',
    debtId: 'PAG-003',
  },
];

const TS_SMELLS = [
  {
    id: 'ts-list-all-helper',
    pattern: /\blistAll[A-Z][A-Za-z0-9]*\s*\(/g,
    message: 'listAll* aggregation helper — reserve for export/batch only',
    allowlist: [
      'listAllConversationMembers',
      'listAllConversationEntries',
      'listAllContacts',
      'listAllFriendRequests',
      'listAllContactTags',
      'listAllPages',
      'listAllInboxEntries',
      'listAllInboxGroups',
    ],
  },
  {
    id: 'ts-client-slice-pagination',
    pattern: /\.slice\s*\(\s*(?:offset|start|page)/gi,
    message: 'client slice with offset/page — likely client-side pagination',
  },
  {
    id: 'ts-get-contacts-interactive',
    pattern: /contactService\.getContacts\s*\(/g,
    message: 'getContacts() loads first page only — prefer listContactsPage in interactive UI',
    pathsOnly: ['apps/'],
  },
];

function usage() {
  return [
    'Usage:',
    '  node tools/check-pagination.mjs --workspace <sdkwork-space-or-repo-root>',
    '',
    'Scans child repositories when workspace root is given; otherwise scans the repo root.',
  ].join('\n');
}

function fail(message, details = []) {
  console.error(`pagination check failed: ${message}`);
  for (const detail of details.slice(0, 200)) {
    console.error(`- ${detail}`);
  }
  if (details.length > 200) {
    console.error(`- ... and ${details.length - 200} more`);
  }
  process.exit(1);
}

function isIgnoredDir(name) {
  return (
    name === 'node_modules'
    || name === 'target'
    || name === 'dist'
    || name === 'generated'
    || name === '.git'
    || name === 'build'
  );
}

function walkFiles(root, extensions) {
  const files = [];
  if (!fs.existsSync(root)) {
    return files;
  }
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!isIgnoredDir(entry.name)) {
          stack.push(fullPath);
        }
        continue;
      }
      const ext = path.extname(entry.name);
      if (extensions.includes(ext)) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

function discoverRepoRoots(workspaceRoot) {
  const roots = [];
  if (fs.existsSync(path.join(workspaceRoot, 'Cargo.toml')) || fs.existsSync(path.join(workspaceRoot, 'package.json'))) {
    roots.push(workspaceRoot);
  }
  let entries = [];
  try {
    entries = fs.readdirSync(workspaceRoot, { withFileTypes: true });
  } catch {
    return roots.length > 0 ? roots : [workspaceRoot];
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || isIgnoredDir(entry.name)) {
      continue;
    }
    const child = path.join(workspaceRoot, entry.name);
    if (fs.existsSync(path.join(child, 'Cargo.toml')) || fs.existsSync(path.join(child, 'package.json'))) {
      roots.push(child);
    }
  }
  return roots.length > 0 ? roots : [workspaceRoot];
}

function scanFile(file, repoRoot, smells, issues) {
  const rel = path.relative(repoRoot, file).replace(/\\/g, '/');
  const text = fs.readFileSync(file, 'utf8');
  for (const smell of smells) {
    if (smell.pathsOnly && !smell.pathsOnly.some((prefix) => rel.startsWith(prefix))) {
      continue;
    }
    if (smell.invert) {
      if (!smell.pattern.test(text)) {
        issues.push(`${rel}: ${smell.message}`);
      }
      smell.pattern.lastIndex = 0;
      continue;
    }
    let match;
    const pattern = new RegExp(smell.pattern.source, smell.pattern.flags);
    while ((match = pattern.exec(text)) !== null) {
      if (smell.allowlist) {
        const snippet = text.slice(match.index, match.index + 80);
        if (smell.allowlist.some((name) => snippet.includes(name))) {
          continue;
        }
      }
      const line = text.slice(0, match.index).split('\n').length;
      issues.push(`${rel}:${line}: [${smell.debtId ?? smell.id}] ${smell.message}`);
      if (!smell.pattern.global) {
        break;
      }
    }
  }
}

function scanRepo(repoRoot) {
  const issues = [];
  for (const file of walkFiles(path.join(repoRoot, 'services'), ['.rs'])) {
    scanFile(file, repoRoot, RUST_SMELLS, issues);
  }
  for (const file of walkFiles(path.join(repoRoot, 'adapters'), ['.rs'])) {
    scanFile(file, repoRoot, RUST_SMELLS, issues);
  }
  for (const file of walkFiles(path.join(repoRoot, 'crates'), ['.rs'])) {
    scanFile(file, repoRoot, RUST_SMELLS, issues);
  }
  for (const file of walkFiles(path.join(repoRoot, 'apps'), ['.ts', '.tsx'])) {
    scanFile(file, repoRoot, TS_SMELLS, issues);
  }
  return issues;
}

function main() {
  const { values } = parseArgs({
    options: {
      workspace: { type: 'string' },
      root: { type: 'string' },
      'allow-known-debt': { type: 'boolean', default: false },
    },
  });
  const workspace = values.workspace ?? values.root;
  if (!workspace) {
    fail(usage());
  }
  const workspaceRoot = path.resolve(workspace);
  const repoRoots = discoverRepoRoots(workspaceRoot);
  const allIssues = [];
  const knownDebt = [];
  for (const repoRoot of repoRoots) {
    const repoName = path.basename(repoRoot);
    for (const issue of scanRepo(repoRoot)) {
      const entry = `${repoName}/${issue}`;
      if (values['allow-known-debt'] && /\[PAG-00[123]\]/.test(issue)) {
        knownDebt.push(entry);
        continue;
      }
      allIssues.push(entry);
    }
  }
  if (knownDebt.length > 0) {
    console.warn(`pagination known debt (${knownDebt.length}):`);
    for (const entry of knownDebt) {
      console.warn(`- ${entry}`);
    }
  }
  if (allIssues.length > 0) {
    fail(`found ${allIssues.length} pagination smell(s)`, allIssues);
  }
  console.log(`pagination check passed (${repoRoots.length} repo root(s))`);
}

main();
