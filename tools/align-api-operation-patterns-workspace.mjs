#!/usr/bin/env node
/**
 * Aligns SDKWork-owned OpenAPI authorities with API_SPEC.md section 15.4.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { alignOpenApiOperationPatterns } from './lib/align-api-operation-patterns.mjs';
import {
  openApiAuthorityEntries,
  walkOpenApiFiles,
} from './lib/http-response-envelope-patterns.mjs';

function loadDocument(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  if (filePath.endsWith('.json') || source.trimStart().startsWith('{')) {
    return { document: JSON.parse(source), sourceFormat: 'json' };
  }
  const payload = execFileSync(
    'python',
    ['-c', 'import json, sys, yaml; print(json.dumps(yaml.safe_load(open(sys.argv[1], encoding="utf-8"))))', filePath],
    { encoding: 'utf8' },
  );
  return { document: JSON.parse(payload), sourceFormat: 'yaml' };
}

function writeDocument(filePath, document, sourceFormat) {
  if (sourceFormat === 'json') {
    fs.writeFileSync(filePath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
    return;
  }
  execFileSync(
    'python',
    [
      '-c',
      'import json, sys, yaml; yaml.safe_dump(json.load(sys.stdin), open(sys.argv[1], "w", encoding="utf-8"), sort_keys=False, allow_unicode=True)',
      filePath,
    ],
    { input: JSON.stringify(document), encoding: 'utf8' },
  );
}

function workspaceAuthorities(workspaceRoot) {
  const authorities = [];
  for (const entry of fs.readdirSync(workspaceRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name === '.git') {
      continue;
    }
    authorities.push(...openApiAuthorityEntries(walkOpenApiFiles(path.join(workspaceRoot, entry.name))));
  }
  return authorities;
}

function main() {
  const { values } = parseArgs({
    options: {
      workspace: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help || !values.workspace) {
    console.log('Usage: node tools/align-api-operation-patterns-workspace.mjs --workspace <sdkwork-space-root> [--dry-run]');
    process.exit(values.workspace ? 0 : 1);
  }

  const workspaceRoot = path.resolve(values.workspace);
  let changedFiles = 0;
  let totalChanges = 0;
  for (const authority of workspaceAuthorities(workspaceRoot)) {
    const { document, sourceFormat } = loadDocument(authority.file);
    const { changes } = alignOpenApiOperationPatterns(document);
    if (changes === 0) {
      continue;
    }
    changedFiles += 1;
    totalChanges += changes;
    const relativeFile = path.relative(workspaceRoot, authority.file).replace(/\\/gu, '/');
    console.log(`${values['dry-run'] ? 'would align' : 'aligned'} ${relativeFile} (${changes} changes)`);
    if (!values['dry-run']) {
      writeDocument(authority.file, document, sourceFormat);
    }
  }
  console.log(`${values['dry-run'] ? 'would align' : 'aligned'} ${changedFiles} files (${totalChanges} changes)`);
}

main();
