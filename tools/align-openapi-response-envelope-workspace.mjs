#!/usr/bin/env node
/**
 * Batch-align OpenAPI authorities under a workspace root that still use legacy *ApiResult envelopes.
 *
 * Usage:
 *   node tools/align-openapi-response-envelope-workspace.mjs --workspace ..
 *   node tools/align-openapi-response-envelope-workspace.mjs --workspace .. --dry-run
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import {
  classifyOpenApiEnvelope,
  classifyOpenApiWireProtocolMarkers,
  dedupeAuthorities,
  isExternalProtocolOpenApi,
  LEGACY_ENVELOPE_PATTERN,
  walkOpenApiFiles,
} from './lib/http-response-envelope-patterns.mjs';
import { migrateOpenApiDocument } from './lib/migrate-openapi-legacy-envelope.mjs';

function usage() {
  return [
    'Usage:',
    '  node tools/align-openapi-response-envelope-workspace.mjs --workspace <sdkwork-space-root> [--dry-run]',
    '',
    'Bootstraps deduplicated app-api, backend-api, and SDKWork-owned business open-api OpenAPI authorities onto SdkWorkApiResponse envelopes.',
  ].join('\n');
}

function loadDocument(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  if (filePath.endsWith('.json')) {
    return JSON.parse(text);
  }
  const payload = execFileSync(
    'python',
    ['-c', 'import json, sys, yaml; print(json.dumps(yaml.safe_load(open(sys.argv[1], encoding="utf-8"))))', filePath],
    { encoding: 'utf8' },
  );
  return JSON.parse(payload);
}

function writeDocument(filePath, document) {
  if (filePath.endsWith('.json')) {
    fs.writeFileSync(filePath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
    return;
  }
  execFileSync(
    'python',
    ['-c', 'import json, sys, yaml; yaml.safe_dump(json.load(sys.stdin), open(sys.argv[1], "w", encoding="utf-8"), sort_keys=False, allow_unicode=True)', filePath],
    { input: JSON.stringify(document), encoding: 'utf8' },
  );
}

function detectLegacyEnvelopeName(text) {
  const match = text.match(LEGACY_ENVELOPE_PATTERN);
  return match?.[0];
}

function needsEnvelopeBootstrap(issues) {
  return issues.some((issue) =>
    ['legacy-envelope', 'missing-sdkwork-api-response', 'legacy-string-result-code', 'success-boolean-envelope', 'forbidden-request-id'].includes(
      issue.kind,
    ),
  );
}

function scanWorkspace(workspaceRoot) {
  const targets = [];
  if (!fs.existsSync(workspaceRoot)) {
    return targets;
  }
  for (const entry of fs.readdirSync(workspaceRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name === '.git') {
      continue;
    }
    const repoRoot = path.join(workspaceRoot, entry.name);
    const authorities = dedupeAuthorities(walkOpenApiFiles(repoRoot));
    for (const { file, repo, surface } of authorities) {
      const text = fs.readFileSync(file, 'utf8');
      if (surface === 'open-api' && isExternalProtocolOpenApi(text)) {
        continue;
      }
      const wireIssues = classifyOpenApiWireProtocolMarkers(text);
      if (wireIssues.length > 0) {
        continue;
      }
      const issues = classifyOpenApiEnvelope(text);
      if (!needsEnvelopeBootstrap(issues)) {
        continue;
      }
      targets.push({
        file,
        repo,
        surface,
        legacyEnvelope: detectLegacyEnvelopeName(text),
        issues: issues.map((issue) => issue.kind),
      });
    }
  }
  return targets;
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
    console.log(usage());
    process.exit(values.workspace ? 0 : 1);
  }

  const workspaceRoot = path.resolve(values.workspace);
  const targets = scanWorkspace(workspaceRoot);
  if (targets.length === 0) {
    console.log('no OpenAPI authorities require envelope bootstrap');
    process.exit(0);
  }

  for (const target of targets) {
    const rel = path.relative(workspaceRoot, target.file).replace(/\\/g, '/');
    if (values['dry-run']) {
      console.log(`would align ${rel} (${target.issues.join(', ')})`);
      continue;
    }
    const document = loadDocument(target.file);
    const migrated = migrateOpenApiDocument(document, {
      legacyEnvelope: target.legacyEnvelope,
    });
    writeDocument(target.file, migrated);
    console.log(`aligned ${rel} (${target.issues.join(', ')})`);
  }
}

main();
