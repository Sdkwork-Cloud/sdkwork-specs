#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const CONTRACT_PATH = 'specs/process-database-pool.spec.json';
const ENABLE_MARKER = 'enable_process_shared_database_pool';
const BOOTSTRAP_PATTERN = /(?:bootstrap_[a-z0-9_]*database(?:_from_env)?|create_pool_from_(?:config|env)|assemble_[a-z0-9_]*(?:router|business_router)_from_env)\s*\(/giu;
const LOW_LEVEL_POOL_PATTERNS = [
  ['PgPoolOptions::new', /PgPoolOptions::new\s*\(/gu],
  ['AnyPoolOptions::new', /AnyPoolOptions::new\s*\(/gu],
  ['r2d2 Pool::builder', /(?:^|[^:])Pool::builder\s*\(/gmu],
];

function parseArgs(argv) {
  const args = { root: process.cwd() };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--root') {
      args.root = path.resolve(argv[index + 1] ?? '');
      index += 1;
    }
  }
  return args;
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function resolveEvidencePath(root, value) {
  const [relativePath] = String(value ?? '').split('#', 1);
  return path.resolve(root, relativePath);
}

function readEvidence(root, value, fail) {
  if (!isNonEmptyString(value)) {
    fail('evidence path must be a non-empty string');
    return '';
  }
  const filePath = resolveEvidencePath(root, value);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    fail(`evidence path does not exist: ${value}`);
    return '';
  }
  return fs.readFileSync(filePath, 'utf8');
}

function listSourceFiles(root, sourceRoots, fail) {
  const files = [];
  function visit(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!['target', 'generated', 'tests', 'test_support'].includes(entry.name)) {
          visit(absolute);
        }
      } else if (entry.isFile() && entry.name.endsWith('.rs')) {
        files.push(absolute);
      }
    }
  }
  for (const sourceRoot of sourceRoots) {
    const absolute = path.resolve(root, sourceRoot);
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isDirectory()) {
      fail(`production source root does not exist: ${sourceRoot}`);
      continue;
    }
    visit(absolute);
  }
  return files;
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const entries = {};
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) {
      continue;
    }
    const separator = line.indexOf('=');
    entries[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  return entries;
}

function validateProfile(root, profile, fail) {
  if (!profile || typeof profile !== 'object') {
    fail('profile must be an object');
    return;
  }
  for (const field of ['exampleFile', 'database', 'schema']) {
    if (!isNonEmptyString(profile[field])) {
      fail(`profile.${field} must be a non-empty string`);
    }
  }
  if (!isNonEmptyString(profile.exampleFile)) {
    return;
  }
  const examplePath = path.resolve(root, profile.exampleFile);
  if (!fs.existsSync(examplePath)) {
    fail(`profile example file does not exist: ${profile.exampleFile}`);
    return;
  }
  const env = parseEnvFile(examplePath);
  const databaseValues = Object.entries(env)
    .filter(([key]) => key.endsWith('_DATABASE_NAME') && !key.includes('_ADMIN_'))
    .map(([, value]) => value);
  const schemaValues = Object.entries(env)
    .filter(([key]) => key.endsWith('_DATABASE_SCHEMA') && !key.includes('_ADMIN_'))
    .map(([, value]) => value);
  for (const value of databaseValues) {
    if (value !== profile.database) {
      fail(`profile database mismatch: expected ${profile.database}, found ${value}`);
    }
  }
  for (const value of schemaValues) {
    if (value !== profile.schema) {
      fail(`profile schema mismatch: expected ${profile.schema}, found ${value}`);
    }
  }
  if (profile.database !== profile.schema && profile.allowDifferentSchema !== true) {
    fail('profile.database and profile.schema must match unless allowDifferentSchema is true');
  }
}

function validateProcess(root, processContract, fail) {
  for (const field of [
    'id',
    'entrypoint',
    'poolOwner',
    'driver',
    'databaseUrlEnv',
    'schemaEnv',
    'maxConnectionsEnv',
  ]) {
    if (!isNonEmptyString(processContract[field])) {
      fail(`process.${field} must be a non-empty string`);
    }
  }
  if (processContract.poolCount !== 1) {
    fail(`process ${processContract.id ?? '<unknown>'} poolCount must be 1`);
  }
  const entrypoint = readEvidence(root, processContract.entrypoint, fail);
  const poolOwner = readEvidence(root, processContract.poolOwner, fail);
  const enableIndex = entrypoint.indexOf(ENABLE_MARKER);
  if (enableIndex < 0) {
    fail(`process ${processContract.id ?? '<unknown>'} entrypoint must call ${ENABLE_MARKER}`);
  }
  const firstBootstrap = [...entrypoint.matchAll(BOOTSTRAP_PATTERN)][0]?.index ?? -1;
  if (firstBootstrap >= 0 && enableIndex > firstBootstrap) {
    fail(`process ${processContract.id ?? '<unknown>'} enables the shared pool after database bootstrap`);
  }
  if (!poolOwner.includes(ENABLE_MARKER) && !poolOwner.includes('create_pool_from_config')) {
    fail(`process ${processContract.id ?? '<unknown>'} poolOwner lacks approved process-pool wiring`);
  }

  const consumers = Array.isArray(processContract.consumers) ? processContract.consumers : [];
  if (consumers.length === 0) {
    fail(`process ${processContract.id ?? '<unknown>'} consumers must be non-empty`);
  }
  for (const consumer of consumers) {
    if (!isNonEmptyString(consumer.module)) {
      fail(`process ${processContract.id ?? '<unknown>'} consumer.module must be non-empty`);
    }
    if (!['injected', 'installed-process-pool'].includes(consumer.poolMode)) {
      fail(`consumer ${consumer.module ?? '<unknown>'} poolMode must be injected or installed-process-pool`);
    }
    const evidence = Array.isArray(consumer.evidence) ? consumer.evidence : [];
    if (evidence.length === 0) {
      fail(`consumer ${consumer.module ?? '<unknown>'} evidence must be non-empty`);
    }
    for (const item of evidence) {
      readEvidence(root, item, fail);
    }
  }

  const exceptions = Array.isArray(processContract.temporaryDriverExceptions)
    ? processContract.temporaryDriverExceptions
    : [];
  const requiresTemporaryDriverCount = exceptions.length > 1
    || exceptions.some((exception) => exception.driver !== 'sqlx::AnyPool');
  if (
    requiresTemporaryDriverCount
    && processContract.temporaryDriverPoolCountEnv !== 'SDKWORK_DATABASE_TEMPORARY_DRIVER_POOL_COUNT'
  ) {
    fail(
      `process ${processContract.id ?? '<unknown>'} must declare temporaryDriverPoolCountEnv as SDKWORK_DATABASE_TEMPORARY_DRIVER_POOL_COUNT`,
    );
  }
  const exceptionFiles = new Set();
  for (const exception of exceptions) {
    for (const field of ['driver', 'owner', 'removalMilestone', 'adr']) {
      if (!isNonEmptyString(exception[field])) {
        fail(`temporary driver exception ${field} must be non-empty`);
      }
    }
    for (const evidence of exception.evidence ?? []) {
      const content = readEvidence(root, evidence, fail);
      if (content || fs.existsSync(resolveEvidencePath(root, evidence))) {
        exceptionFiles.add(resolveEvidencePath(root, evidence));
      }
    }
  }

  const sourceRoots = Array.isArray(processContract.productionSourceRoots)
    ? processContract.productionSourceRoots
    : [];
  if (sourceRoots.length === 0) {
    fail(`process ${processContract.id ?? '<unknown>'} productionSourceRoots must be non-empty`);
  }
  for (const filePath of listSourceFiles(root, sourceRoots, fail)) {
    if (exceptionFiles.has(filePath)) {
      continue;
    }
    const rawContent = fs.readFileSync(filePath, 'utf8');
    const content = filePath.endsWith('.rs') ? rustProductionSource(rawContent) : rawContent;
    for (const [label, pattern] of LOW_LEVEL_POOL_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(content)) {
        fail(`${path.relative(root, filePath)} constructs ${label} outside the declared pool owner`);
      }
    }
  }
}

function rustProductionSource(content) {
  const testModuleIndex = content.search(/#\s*\[\s*cfg\s*\(\s*test\s*\)\s*\]/u);
  return testModuleIndex >= 0 ? content.slice(0, testModuleIndex) : content;
}

export function validateProcessSharedDatabasePool(root) {
  const failures = [];
  const fail = (message) => failures.push(message);
  const contractPath = path.join(root, CONTRACT_PATH);
  if (!fs.existsSync(contractPath)) {
    return { ok: false, failures: [`${CONTRACT_PATH} must exist`] };
  }
  let contract;
  try {
    contract = readJson(contractPath);
  } catch (error) {
    return { ok: false, failures: [`${CONTRACT_PATH} must be valid JSON (${error.message})`] };
  }
  if (contract.schemaVersion !== 1) {
    fail('schemaVersion must be 1');
  }
  if (contract.kind !== 'sdkwork.process-database-pool') {
    fail('kind must be sdkwork.process-database-pool');
  }
  validateProfile(root, contract.profile, fail);
  const processes = Array.isArray(contract.processes) ? contract.processes : [];
  if (processes.length === 0) {
    fail('processes must be non-empty');
  }
  const ids = new Set();
  for (const processContract of processes) {
    if (ids.has(processContract.id)) {
      fail(`duplicate process id: ${processContract.id}`);
    }
    ids.add(processContract.id);
    validateProcess(root, processContract, fail);
  }
  const verification = Array.isArray(contract.verification) ? contract.verification : [];
  if (!verification.some((command) => String(command).includes('check-process-shared-database-pool.mjs'))) {
    fail('verification must include check-process-shared-database-pool.mjs');
  }
  return { ok: failures.length === 0, failures };
}

function main() {
  const { root } = parseArgs(process.argv.slice(2));
  const result = validateProcessSharedDatabasePool(root);
  if (!result.ok) {
    process.stderr.write(
      `Process-shared database pool standard failed:\n${result.failures.map((item) => `- ${item}`).join('\n')}\n`,
    );
    process.exit(1);
  }
  process.stdout.write('Process-shared database pool standard passed\n');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
