#!/usr/bin/env node
/**
 * Verify single HTTP ingress rules from APPLICATION_GATEWAY_SPEC.md §5.6 and
 * APP_RUNTIME_TOPOLOGY_SPEC.md §8.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const SPECS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_ROOT = path.resolve(SPECS_ROOT, '..');

const HTTP_INGRESS_SURFACE_IDS = new Set([
  'application.public-ingress',
  'platform.api-gateway',
  'application.backend-http',
  'application.open-http',
  'application.app-http',
  'application.admin-http',
  'operations.control-ingress',
]);

const NON_HTTP_ORCHESTRATION_PROCESS_IDS = new Set([
  'pc-renderer',
  'h5-renderer',
  'application.background-worker',
  'application.worker',
  'application.scheduler',
]);

const FORBIDDEN_DEV_SCRIPT_PATTERNS = [
  {
    id: 'unified-sidecar-hook',
    pattern: /createUnified\w*SidecarProcesses/u,
    message: 'dev orchestration must not define unified HTTP sidecar process hooks',
  },
  {
    id: 'sidecar-spawn-loop',
    pattern: /for\s*\(\s*const\s+\w*sidecar\w*\s+of\s+\w*sidecar\w*Processes\s*\)/u,
    message: 'dev orchestration must not spawn HTTP sidecar process loops',
  },
  {
    id: 'service-bin-dev-matrix',
    pattern: /cargo['"]\s*,\s*\[\s*['"]run['"]\s*,\s*['"]-p['"]\s*,\s*['"][^'"]*-service-bin['"]/u,
    message: 'dev orchestration must not cargo-run *-service-bin HTTP listeners by default',
  },
];

const SIDEcar_PORT_MATRIX_PATTERN = /DEFAULT_RESERVED_\w*PORTS\s*=\s*new Set\(\[[\s\S]*?1808[2-9][\s\S]*?1809\d[\s\S]*?\]\)/u;

const GATEWAY_INGRESS_SURFACE_IDS = new Set([
  'application.public-ingress',
  'platform.api-gateway',
  'platform.standalone-gateway',
]);

const GATEWAY_BINARY_PATTERN = /(?:^|-)(?:standalone-gateway|cloud-gateway|api-cloud-gateway|sdkwork-im-server)$/u;

const DECOMPOSED_HTTP_BINARY_PATTERN = /(?:^|-)(?:app-api|backend-api|open-api|admin-api|api-server)$/u;

const DECOMPOSED_HTTP_SURFACE_IDS = new Set([
  'application.backend-http',
  'application.open-http',
  'application.app-http',
  'application.admin-http',
]);

function usage() {
  return [
    'Usage: node tools/check-single-http-ingress.mjs [--root <repo>]',
    '',
    'Validates topology orchestration and dev scripts against single HTTP ingress rules.',
  ].join('\n');
}

function readText(filePath) {
  if (!fs.existsSync(filePath)) {
    return '';
  }
  return fs.readFileSync(filePath, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function listFilesRecursive(dir, predicate, results = []) {
  if (!fs.existsSync(dir)) {
    return results;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'target') {
        continue;
      }
      listFilesRecursive(fullPath, predicate, results);
      continue;
    }
    if (predicate(fullPath)) {
      results.push(fullPath);
    }
  }
  return results;
}

function isHttpIngressProcess(processEntry) {
  if (!processEntry || typeof processEntry !== 'object') {
    return false;
  }
  if (NON_HTTP_ORCHESTRATION_PROCESS_IDS.has(processEntry.id)) {
    return false;
  }
  if (processEntry.id && HTTP_INGRESS_SURFACE_IDS.has(processEntry.id)) {
    return true;
  }
  const binary = String(processEntry.binary ?? '');
  if (!binary) {
    return false;
  }
  if (/(?:^|-)worker$/u.test(binary)) {
    return false;
  }
  if (/(?:^|-)(?:standalone-gateway|cloud-gateway|api-cloud-gateway)$/u.test(binary)) {
    return true;
  }
  if (/(?:^|-)(?:app-api|backend-api|open-api|admin-api|api-server)$/u.test(binary)) {
    return true;
  }
  if (/-service-bin$/u.test(binary)) {
    return true;
  }
  return false;
}

function isGatewayIngressProcess(processEntry) {
  const binary = String(processEntry.binary ?? '');
  const id = String(processEntry.id ?? '');
  if (GATEWAY_INGRESS_SURFACE_IDS.has(id)) {
    return GATEWAY_BINARY_PATTERN.test(binary) || /gateway/u.test(binary);
  }
  return GATEWAY_BINARY_PATTERN.test(binary);
}

function isDecomposedHttpViolation(processEntry) {
  if (!isHttpIngressProcess(processEntry)) {
    return false;
  }
  if (NON_HTTP_ORCHESTRATION_PROCESS_IDS.has(processEntry.id)) {
    return false;
  }
  if (String(processEntry.id ?? '').startsWith('edge.')) {
    return false;
  }
  if (isGatewayIngressProcess(processEntry)) {
    return false;
  }
  const binary = String(processEntry.binary ?? '');
  const id = String(processEntry.id ?? '');
  if (DECOMPOSED_HTTP_SURFACE_IDS.has(id)) {
    return true;
  }
  if (id !== 'application.public-ingress' && id !== 'platform.api-gateway' && id !== 'platform.standalone-gateway') {
    if (DECOMPOSED_HTTP_BINARY_PATTERN.test(binary) || /-service-bin$/u.test(binary) || /(?:^|-)routes-/u.test(binary)) {
      return true;
    }
    if (/(?:^|-)app-api$/u.test(id)) {
      return true;
    }
    if (binary && isHttpIngressProcess(processEntry)) {
      return true;
    }
  }
  return false;
}

function isGatewayMigrationWarning(processEntry) {
  if (processEntry.id !== 'application.public-ingress') {
    return false;
  }
  const binary = String(processEntry.binary ?? '');
  if (!binary || isGatewayIngressProcess(processEntry)) {
    return false;
  }
  return DECOMPOSED_HTTP_BINARY_PATTERN.test(binary);
}

function countHttpIngressProcesses(processes = []) {
  return processes.filter((entry) => isHttpIngressProcess(entry));
}

function countDecomposedHttpViolations(processes = []) {
  return processes.filter((entry) => isDecomposedHttpViolation(entry));
}

function checkTopologySpec(repoRoot, errors, warnings) {
  const specPath = path.join(repoRoot, 'specs', 'topology.spec.json');
  if (!fs.existsSync(specPath)) {
    return;
  }

  const rel = path.relative(repoRoot, specPath);
  const spec = readJson(specPath);
  const profiles = spec.orchestration?.profiles ?? {};

  for (const [profileId, profile] of Object.entries(profiles)) {
    const processes = profile.processes ?? [];
    const httpProcesses = countHttpIngressProcesses(processes);
    const httpIds = httpProcesses.map((entry) => entry.id ?? entry.binary ?? 'unknown');

    if (profileId.includes('unified-process')) {
      const applicationHttp = httpProcesses.filter((entry) => (
        entry.id !== 'platform.api-gateway'
        && entry.id !== 'platform.standalone-gateway'
      ));
      if (applicationHttp.length > 1) {
        errors.push(
          `${rel}: ${profileId} starts ${applicationHttp.length} application HTTP ingress processes (${httpIds.join(', ')}); standalone unified-process must expose one application.public-ingress bind`,
        );
      }
    }

    const decomposedHttp = countDecomposedHttpViolations(processes);
    if (decomposedHttp.length > 0) {
      errors.push(
        `${rel}: ${profileId} starts decomposed HTTP listeners (${decomposedHttp.map((entry) => entry.id ?? entry.binary).join(', ')}); use gateway ingress and in-process route embedding instead`,
      );
    }

    for (const processEntry of processes) {
      if (isGatewayMigrationWarning(processEntry)) {
        warnings.push(
          `${rel}: ${profileId} uses ${processEntry.binary} on application.public-ingress; migrate to sdkwork-*-standalone-gateway or sdkwork-*-cloud-gateway`,
        );
      }
    }
  }
}

function checkDevScripts(repoRoot, errors) {
  const scriptDirs = ['scripts', 'tools'].map((dir) => path.join(repoRoot, dir));
  const files = scriptDirs.flatMap((dir) => listFilesRecursive(
    dir,
    (filePath) => /(?:^|[\\/])(?:[^\\/]*dev[^\\/]*|im-pc-dev)\.mjs$/u.test(filePath),
  ));

  for (const filePath of files) {
    const rel = path.relative(repoRoot, filePath);
    const content = readText(filePath);
    if (!content) {
      continue;
    }
    for (const rule of FORBIDDEN_DEV_SCRIPT_PATTERNS) {
      if (rule.pattern.test(content)) {
        errors.push(`${rel}: ${rule.message} (${rule.id})`);
      }
    }
    if (SIDEcar_PORT_MATRIX_PATTERN.test(content)) {
      errors.push(`${rel}: reserved loopback sidecar port matrix is forbidden for unified single-port ingress`);
    }
  }
}

export function validateRepository(repoRoot) {
  const errors = [];
  const warnings = [];
  checkTopologySpec(repoRoot, errors, warnings);
  checkDevScripts(repoRoot, errors);
  return { errors, warnings };
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const parsed = parseArgs({
    options: {
      root: { type: 'string' },
      strict: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h' },
    },
    allowPositionals: false,
  });

  if (parsed.values.help) {
    console.log(usage());
    process.exit(0);
  }

  const repoRoot = path.resolve(parsed.values.root || DEFAULT_ROOT);
  const { errors, warnings } = validateRepository(repoRoot);

  for (const warning of warnings) {
    console.warn(`warn: ${warning}`);
  }

  if (errors.length === 0) {
    console.log(`single HTTP ingress check passed: ${repoRoot}`);
    process.exit(parsed.values.strict && warnings.length > 0 ? 1 : 0);
  }

  console.error(`single HTTP ingress check failed: ${repoRoot}`);
  for (const issue of errors) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}
