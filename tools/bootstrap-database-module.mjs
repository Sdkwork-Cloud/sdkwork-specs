#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validateDatabaseFramework } from './check-database-framework-standard.mjs';

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = path.join(TOOL_DIR, '../templates/database');
const REGISTRY_PATH = path.join(TOOL_DIR, 'database-module-registry.json');
const WORKSPACE_ROOT = path.resolve(TOOL_DIR, '../..');
const DATABASE_CLI = 'cargo run --manifest-path ../sdkwork-database/Cargo.toml -p sdkwork-database-cli -- --app-root .';

const DB_SCRIPTS = {
  'db:validate': 'node ../sdkwork-specs/tools/check-database-framework-standard.mjs --root .',
  'db:plan': `${DATABASE_CLI} plan`,
  'db:init': `${DATABASE_CLI} init`,
  'db:migrate': `${DATABASE_CLI} migrate`,
  'db:seed': `${DATABASE_CLI} seed`,
  'db:status': `${DATABASE_CLI} status`,
  'db:drift': `${DATABASE_CLI} drift`,
  'db:drift:check': `${DATABASE_CLI} drift-check`,
  'db:bootstrap': `${DATABASE_CLI} bootstrap`,
};

function buildMaterializeScript(moduleConfig) {
  const engines = moduleConfig.engines?.length ? moduleConfig.engines : ['postgres'];
  const defaultEngine = engines.includes('postgres') ? 'postgres' : engines[0];
  const baseline = `database/ddl/baseline/${defaultEngine}/0001_${moduleConfig.moduleId}_baseline.sql`;
  const prefixArg = moduleConfig.tablePrefix ? ` --prefixes ${moduleConfig.tablePrefix}` : '';
  return `node ../sdkwork-specs/tools/materialize-database-contract-from-baseline.mjs --root . --baseline ${baseline} --module-id ${moduleConfig.moduleId} --owner ${moduleConfig.ownerTeam}${prefixArg} --engines ${engines.join(',')}`;
}

function parseArgs(argv) {
  const args = {
    workspace: WORKSPACE_ROOT,
    repo: null,
    all: false,
    force: false,
    dryRun: false,
    refreshDocs: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--workspace') {
      args.workspace = path.resolve(argv[index + 1] ?? '');
      index += 1;
    } else if (token === '--repo') {
      args.repo = argv[index + 1] ?? null;
      index += 1;
    } else if (token === '--all') {
      args.all = true;
    } else if (token === '--force') {
      args.force = true;
    } else if (token === '--dry-run') {
      args.dryRun = true;
    } else if (token === '--refresh-docs') {
      args.refreshDocs = true;
    }
  }
  return args;
}

function readRegistry() {
  return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
}

function copyDirectory(source, destination) {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(sourcePath, destinationPath);
    } else {
      fs.copyFileSync(sourcePath, destinationPath);
    }
  }
}

function replaceInTree(rootDir, replacements) {
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const absolutePath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      replaceInTree(absolutePath, replacements);
      continue;
    }
    if (!/\.(json|yaml|yml|md)$/i.test(entry.name)) {
      continue;
    }
    let content = fs.readFileSync(absolutePath, 'utf8');
    for (const [from, to] of replacements) {
      content = content.split(from).join(to);
    }
    fs.writeFileSync(absolutePath, content, 'utf8');
  }
}

function globFiles(repoRoot, pattern) {
  const normalized = pattern.replace(/\\/g, '/');
  if (!normalized.includes('*')) {
    const absolute = path.join(repoRoot, normalized);
    return fs.existsSync(absolute) ? [absolute] : [];
  }
  const parts = normalized.split('/');
  const files = [];
  function walk(currentDir, partIndex) {
    if (partIndex >= parts.length) {
      return;
    }
    const part = parts[partIndex];
    if (part === '**') {
      for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
        const next = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          walk(next, partIndex);
          walk(next, partIndex + 1);
        } else if (partIndex + 1 >= parts.length) {
          files.push(next);
        }
      }
      return;
    }
    if (part.includes('*')) {
      const regex = new RegExp(`^${part.replace(/\*/g, '.*')}$`);
      for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
        if (!regex.test(entry.name)) {
          continue;
        }
        const next = path.join(currentDir, entry.name);
        if (partIndex + 1 >= parts.length) {
          if (entry.isFile()) {
            files.push(next);
          }
        } else if (entry.isDirectory()) {
          walk(next, partIndex + 1);
        }
      }
      return;
    }
    walk(path.join(currentDir, part), partIndex + 1);
  }
  walk(repoRoot, 0);
  return files.sort();
}

function materializeLegacyBaseline(repoRoot, moduleConfig, databaseDir) {
  const globs = moduleConfig.legacySqlGlobs ?? [];
  if (globs.length === 0) {
    return [];
  }
  const copied = [];
  const chunks = [];
  for (const pattern of globs) {
    for (const filePath of globFiles(repoRoot, pattern)) {
      copied.push(path.relative(repoRoot, filePath).replace(/\\/g, '/'));
      chunks.push(
        `-- source: ${path.relative(repoRoot, filePath).replace(/\\/g, '/')}\n${fs.readFileSync(filePath, 'utf8').trim()}\n`,
      );
    }
  }
  if (chunks.length === 0) {
    return copied;
  }
  const baselinePath = path.join(
    databaseDir,
    'ddl/baseline/postgres',
    `0001_${moduleConfig.moduleId}_baseline.sql`,
  );
  fs.writeFileSync(
    baselinePath,
    `-- Consolidated legacy baseline imported by bootstrap-database-module.mjs\n-- Review and replace with contract-first migrations.\n\n${chunks.join('\n')}\n`,
    'utf8',
  );
  return copied;
}

function ensurePackageJson(repoRoot, moduleConfig) {
  const packageJsonPath = path.join(repoRoot, 'package.json');
  let packageJson;
  if (fs.existsSync(packageJsonPath)) {
    packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  } else {
    packageJson = {
      name: moduleConfig.repo,
      private: true,
      type: 'module',
      scripts: {},
    };
  }
  packageJson.scripts = packageJson.scripts ?? {};
  for (const [name, command] of Object.entries(DB_SCRIPTS)) {
    packageJson.scripts[name] = command;
  }
  packageJson.scripts['db:materialize:contract'] = buildMaterializeScript(moduleConfig);
  if (!packageJson.scripts.test) {
    packageJson.scripts.test = 'node ../sdkwork-specs/tools/check-database-framework-standard.mjs --root .';
  } else if (!packageJson.scripts.test.includes('check-database-framework-standard')) {
    packageJson.scripts['test:contract:database'] =
      'node ../sdkwork-specs/tools/check-database-framework-standard.mjs --root .';
  }
  fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
}

function ensureSeedBootstrap(databaseDir, moduleConfig) {
  const seedPath = path.join(databaseDir, 'seeds/common/001_bootstrap.sql');
  if (fs.existsSync(seedPath)) {
    return;
  }
  fs.writeFileSync(
    seedPath,
    `-- Minimal bootstrap seed for ${moduleConfig.moduleId}\n-- Replace with locale-aware initialization data.\nSELECT 1;\n`,
    'utf8',
  );
}

function writeDatabaseReadme(databaseDir, moduleConfig, legacyCopied) {
  const lines = [
    `# ${moduleConfig.serviceCode} Database Module`,
    '',
    `Canonical lifecycle assets for \`${moduleConfig.repo}\` per \`DATABASE_FRAMEWORK_SPEC.md\`.`,
    '',
    `- moduleId: \`${moduleConfig.moduleId}\``,
    `- serviceCode: \`${moduleConfig.serviceCode}\``,
    `- tablePrefix: \`${moduleConfig.tablePrefix}\``,
    '',
    '## Commands',
    '',
    '```bash',
    'pnpm run db:validate',
    'pnpm run db:materialize:contract',
    'pnpm run db:plan',
    'pnpm run db:init',
    'pnpm run db:migrate',
    'pnpm run db:seed',
    'pnpm run db:status',
    'pnpm run db:drift:check',
    '```',
    '',
    '## Migration status',
    '',
  ];
  if (legacyCopied.length > 0) {
    lines.push(
      'Legacy SQL was consolidated into `ddl/baseline/postgres/0001_*_baseline.sql` for bootstrap review.',
      'Author contract-first tables in `contract/schema.yaml`, then split baseline into versioned `migrations/` pairs.',
      '',
      'Imported legacy sources:',
      ...legacyCopied.map((item) => `- \`${item}\``),
      '',
    );
  } else {
    lines.push(
      'No legacy SQL was auto-imported. Author `contract/schema.yaml` before adding migrations.',
      '',
    );
  }
  lines.push(
    'Runtime services MUST create pools through `sdkwork-database-sqlx` and register `DefaultDatabaseModule` at bootstrap.',
  );
  fs.writeFileSync(path.join(databaseDir, 'README.md'), `${lines.join('\n')}\n`, 'utf8');
}

function markLegacyAssetDeprecation(repoRoot, moduleConfig) {
  const globs = moduleConfig.legacySqlGlobs ?? [];
  const directories = new Set();
  for (const pattern of globs) {
    for (const filePath of globFiles(repoRoot, pattern)) {
      directories.add(path.dirname(filePath));
    }
  }
  const notice = [
    '# Deprecated',
    '',
    'Canonical database lifecycle assets live in the application-root `database/` directory.',
    '',
    'Do not add new schema files here. Migrate remaining changes into:',
    '',
    '- `database/contract/schema.yaml`',
    '- `database/migrations/{engine}/`',
    '- `database/ddl/baseline/{engine}/`',
    '',
    'See `DATABASE_FRAMEWORK_SPEC.md` and `database/README.md`.',
    '',
  ].join('\n');
  for (const directory of directories) {
    fs.writeFileSync(path.join(directory, 'DEPRECATED.md'), notice, 'utf8');
  }
}

function ensureContractTest(repoRoot) {
  const target = path.join(repoRoot, 'tests/contract/database-framework.contract.test.mjs');
  if (fs.existsSync(target)) {
    return;
  }
  const template = path.join(TOOL_DIR, '../templates/tests/database-framework.contract.test.mjs');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(template, target);
}

function bootstrapRepo(moduleConfig, options) {
  const repoRoot = path.join(options.workspace, moduleConfig.repo);
  const databaseDir = path.join(repoRoot, 'database');
  if (!fs.existsSync(repoRoot)) {
    return { repo: moduleConfig.repo, status: 'missing-repo' };
  }
  if (options.refreshDocs && fs.existsSync(databaseDir)) {
    const legacyCopied = (moduleConfig.legacySqlGlobs ?? []).flatMap((pattern) =>
      globFiles(repoRoot, pattern).map((filePath) =>
        path.relative(repoRoot, filePath).replace(/\\/g, '/'),
      ),
    );
    writeDatabaseReadme(databaseDir, moduleConfig, legacyCopied);
    markLegacyAssetDeprecation(repoRoot, moduleConfig);
    ensureContractTest(repoRoot);
    return { repo: moduleConfig.repo, status: 'docs-refreshed' };
  }
  if (fs.existsSync(databaseDir) && !options.force) {
    ensurePackageJson(repoRoot, moduleConfig);
    return { repo: moduleConfig.repo, status: 'skipped-existing' };
  }
  if (options.dryRun) {
    return { repo: moduleConfig.repo, status: 'dry-run' };
  }
  if (fs.existsSync(databaseDir) && options.force) {
    fs.rmSync(databaseDir, { recursive: true, force: true });
  }
  copyDirectory(TEMPLATE_DIR, databaseDir);
  const engines = moduleConfig.engines ?? ['postgres'];
  replaceInTree(databaseDir, [
    ['<module-id>', moduleConfig.moduleId],
    ['<SERVICE>', moduleConfig.serviceCode],
    ['<Display Name>', moduleConfig.serviceCode],
    ['<owner-team>', moduleConfig.ownerTeam ?? `${moduleConfig.moduleId}-platform`],
    ['<prefix>_', moduleConfig.tablePrefix],
    ['<prefix>', moduleConfig.tablePrefix.replace(/_$/, '')],
  ]);
  const manifestPath = path.join(databaseDir, 'database.manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.engines = engines;
  manifest.defaultEngine = engines[0];
  manifest.contractVersion = '0.1.0';
  manifest.baselineStrategy = 'baseline-plus-migrations';
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  ensureSeedBootstrap(databaseDir, moduleConfig);
  const legacyCopied = materializeLegacyBaseline(repoRoot, moduleConfig, databaseDir);
  writeDatabaseReadme(databaseDir, moduleConfig, legacyCopied);
  markLegacyAssetDeprecation(repoRoot, moduleConfig);
  ensurePackageJson(repoRoot, moduleConfig);
  ensureContractTest(repoRoot);
  const validation = validateDatabaseFramework(repoRoot);
  return {
    repo: moduleConfig.repo,
    status: validation.ok ? 'bootstrapped' : 'bootstrapped-with-failures',
    legacyCopied,
    failures: validation.failures ?? [],
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const registry = readRegistry();
  const selected = options.all
    ? registry
    : registry.filter((entry) => entry.repo === options.repo);
  if (selected.length === 0) {
    process.stderr.write('No registry entries selected. Use --repo <name> or --all.\n');
    process.exit(1);
  }
  const results = selected.map((entry) => bootstrapRepo(entry, options));
  for (const result of results) {
    process.stdout.write(`${result.repo}: ${result.status}\n`);
    if (result.legacyCopied?.length) {
      process.stdout.write(`  legacy sql: ${result.legacyCopied.join(', ')}\n`);
    }
    for (const failure of result.failures ?? []) {
      process.stdout.write(`  - ${failure}\n`);
    }
  }
  const failed = results.some((result) => result.status === 'bootstrapped-with-failures');
  process.exit(failed ? 1 : 0);
}

export { bootstrapRepo, readRegistry, materializeLegacyBaseline, markLegacyAssetDeprecation, writeDatabaseReadme };

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main();
}
