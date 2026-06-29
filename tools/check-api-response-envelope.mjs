#!/usr/bin/env node
/**
 * Validates SdkWork HTTP response envelope alignment for app-api, backend-api, and SDKWork-owned business open-api OpenAPI authorities.
 * See API_SPEC.md section 4.5 and section 15 and TEST_SPEC.md.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  classifyOpenApiEnvelope,
  classifyOpenApiWireProtocolMarkers,
  dedupeAuthorities,
  isExternalProtocolOpenApi,
  walkOpenApiFiles,
} from './lib/http-response-envelope-patterns.mjs';

const SPECS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function usage() {
  return [
    'Usage:',
    '  node tools/check-api-response-envelope.mjs [--root <specs-or-repo>]',
    '  node tools/check-api-response-envelope.mjs --workspace <sdkwork-space-root>',
    '',
    'Modes:',
    '  --root .            scan normative specs and optional repo openapi authorities',
    '  --workspace ..      scan all child repositories under the workspace',
  ].join('\n');
}

function fail(message, details = []) {
  console.error(`api response envelope failed: ${message}`);
  for (const detail of details) {
    console.error(`- ${detail}`);
  }
  process.exit(1);
}

function scanSpecsNormative(root) {
  const issues = [];
  const apiSpec = path.join(root, 'API_SPEC.md');
  if (!fs.existsSync(apiSpec)) {
    issues.push('API_SPEC.md missing');
    return issues;
  }
  const text = fs.readFileSync(apiSpec, 'utf8');
  if (!text.includes('SdkWorkApiResponse')) issues.push('API_SPEC.md missing SdkWorkApiResponse definition');
  if (!text.includes('Result Code Standard')) issues.push('API_SPEC.md missing result code standard');
  if (text.includes('SdkWorkResponse') && !text.includes('Forbidden legacy wire fields')) {
    issues.push('API_SPEC.md still promotes SdkWorkResponse without forbidden-legacy context');
  }
  if (!text.includes('Forbidden legacy wire fields')) {
    issues.push('API_SPEC.md missing forbidden legacy envelope list');
  }
  if (!text.includes('### 4.5 Open API Input And Output Standard')) {
    issues.push('API_SPEC.md missing open-api input and output standard (section 4.5)');
  }
  if (!text.includes('x-sdkwork-wire-protocol')) {
    issues.push('API_SPEC.md missing x-sdkwork-wire-protocol vendor compatibility extension');
  }
  return issues;
}

function scanOpenApiAuthorities(root) {
  const issues = [];
  const files = dedupeAuthorities(walkOpenApiFiles(root));
  for (const { file, repo, surface } of files) {
    const text = fs.readFileSync(file, 'utf8');
    for (const issue of classifyOpenApiWireProtocolMarkers(text)) {
      issues.push(`${repo}/${surface} (${rel}): ${issue.kind} — ${issue.detail}`);
    }
    if (surface === 'open-api' && isExternalProtocolOpenApi(text)) continue;
    const rel = path.relative(root, file).replace(/\\/g, '/');
    for (const issue of classifyOpenApiEnvelope(text)) {
      issues.push(`${repo}/${surface} (${rel}): ${issue.kind} — ${issue.detail}`);
    }
  }
  return issues;
}

function scanWorkspace(workspaceRoot) {
  const issues = [];
  if (!fs.existsSync(workspaceRoot)) return [`workspace root not found: ${workspaceRoot}`];
  for (const entry of fs.readdirSync(workspaceRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name === '.git') continue;
    issues.push(...scanOpenApiAuthorities(path.join(workspaceRoot, entry.name)));
  }
  return issues;
}

function main() {
  const { values } = parseArgs({
    options: {
      root: { type: 'string', default: SPECS_ROOT },
      workspace: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    console.log(usage());
    process.exit(0);
  }

  const issues = [...scanSpecsNormative(path.resolve(values.root))];
  if (values.workspace) {
    issues.push(...scanWorkspace(path.resolve(values.workspace)));
  } else if (values.root !== SPECS_ROOT) {
    issues.push(...scanOpenApiAuthorities(path.resolve(values.root)));
  }

  if (issues.length > 0) {
    fail('response envelope alignment violations found', issues);
  }
  console.log('api response envelope check passed');
}

main();
