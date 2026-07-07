#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateDatabaseFramework } from './check-database-framework-standard.mjs';

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(TOOL_DIR, '../..');
const forumRoot = path.join(WORKSPACE_ROOT, 'sdkwork-forum');

if (fs.existsSync(forumRoot)) {
  const forum = validateDatabaseFramework(forumRoot);
  assert.equal(forum.ok, true, forum.failures?.join('; '));
}

const { spawnSync } = await import('node:child_process');
const audit = spawnSync(
  process.execPath,
  [path.join(TOOL_DIR, 'audit-database-framework-workspace.mjs'), '--workspace', WORKSPACE_ROOT],
  { encoding: 'utf8' },
);
assert.ok([0, 1].includes(audit.status), audit.stdout || audit.stderr);
assert.match(audit.stdout, /Database framework workspace audit/, audit.stdout || audit.stderr);
assert.match(audit.stdout, /Repos scanned: \d+/, audit.stdout || audit.stderr);
assert.match(audit.stdout, /DB owners: \d+/, audit.stdout || audit.stderr);
assert.match(audit.stdout, /Compliant: \d+/, audit.stdout || audit.stderr);
if (fs.existsSync(forumRoot)) {
  assert.match(audit.stdout, /sdkwork-forum: compliant/, audit.stdout || audit.stderr);
}

process.stdout.write('audit-database-framework-workspace.test.mjs passed\n');
