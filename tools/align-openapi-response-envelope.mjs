#!/usr/bin/env node
/**
 * Align an OpenAPI authority file with SdkWorkApiResponse envelopes.
 *
 * Usage:
 *   node tools/align-openapi-response-envelope.mjs --file path/to/openapi.yaml
 *   node tools/align-openapi-response-envelope.mjs --file apis/app-api/store/openapi.yaml --legacy-envelope StoreApiResult
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { migrateOpenApiDocument } from './lib/migrate-openapi-legacy-envelope.mjs';

function usage() {
  return [
    'Usage:',
    '  node tools/align-openapi-response-envelope.mjs --file <openapi.yaml|json> [--legacy-envelope StoreApiResult]',
    '',
    'Mutates the file in place after migrating legacy *ApiResult envelopes to SdkWorkApiResponse.',
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
  const payload = execFileSync(
    'python',
    ['-c', 'import json, sys, yaml; yaml.safe_dump(json.load(sys.stdin), open(sys.argv[1], "w", encoding="utf-8"), sort_keys=False, allow_unicode=True)', filePath],
    { input: JSON.stringify(document), encoding: 'utf8' },
  );
  if (payload && payload.trim()) {
    process.stdout.write(payload);
  }
}

function main() {
  const { values } = parseArgs({
    options: {
      file: { type: 'string' },
      'legacy-envelope': { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

  if (values.help || !values.file) {
    console.log(usage());
    process.exit(values.file ? 0 : 1);
  }

  const filePath = path.resolve(values.file);
  if (!fs.existsSync(filePath)) {
    console.error(`file not found: ${filePath}`);
    process.exit(1);
  }

  const document = loadDocument(filePath);
  const migrated = migrateOpenApiDocument(document, {
    legacyEnvelope: values['legacy-envelope'],
  });
  writeDocument(filePath, migrated);
  console.log(`aligned ${path.relative(process.cwd(), filePath)}`);
}

main();
