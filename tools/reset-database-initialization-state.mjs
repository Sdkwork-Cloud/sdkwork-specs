#!/usr/bin/env node
/**
 * Reset application database modules to initialization state:
 * - Consolidate ddl/baseline/* + non-noop migrations into a single baseline DDL per engine
 * - Remove migration debt (.up.sql / .down.sql / loose migrations/*.sql)
 * - Keep migrations/{engine}/ directories and README placeholders for future versioned changes
 * - Mark legacy crate migration directories with DEPRECATED.md
 *
 * Usage:
 *   node reset-database-initialization-state.mjs --workspace <dir> [--dry-run] [--repo <name>]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateDatabaseFramework } from './check-database-framework-standard.mjs';

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(TOOL_DIR, '../..');

const DEPRECATED_NOTICE = `# Deprecated

Canonical database lifecycle assets live in the application-root \`database/\` directory.

Do not add new schema files here. Migrate remaining changes into:

- \`database/contract/schema.yaml\`
- \`database/migrations/{engine}/\`
- \`database/ddl/baseline/{engine}/\`

See \`DATABASE_FRAMEWORK_SPEC.md\` and \`database/README.md\`.
`;

function parseArgs(argv) {
  const args = {
    workspace: WORKSPACE_ROOT,
    dryRun: false,
    repo: '',
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--workspace') {
      args.workspace = path.resolve(argv[index + 1] ?? '');
      index += 1;
    } else if (token === '--dry-run') {
      args.dryRun = true;
    } else if (token === '--repo') {
      args.repo = argv[index + 1] ?? '';
      index += 1;
    } else if (token === '--help' || token === '-h') {
      console.log(
        'Usage: node reset-database-initialization-state.mjs --workspace <dir> [--dry-run] [--repo <name>]',
      );
      process.exit(0);
    }
  }
  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/u, ''));
}

function listRepos(workspaceRoot, repoFilter) {
  return fs
    .readdirSync(workspaceRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('sdkwork-'))
    .map((entry) => entry.name)
    .filter((name) => !repoFilter || name === repoFilter)
    .filter((name) => fs.existsSync(path.join(workspaceRoot, name, 'database', 'database.manifest.json')))
    .sort();
}

function isNoopMigration(sql) {
  const lines = sql
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('--'));
  return lines.length === 1 && /^SELECT\s+1;?$/i.test(lines[0]);
}

function resolveIrIncludes(sql, baseDir) {
  return sql.replace(/^\\ir\s+(.+)$/gm, (_, relative) => {
    const includePath = path.resolve(baseDir, relative.trim());
    if (!fs.existsSync(includePath)) {
      return `-- unresolved include: ${relative}`;
    }
    return fs.readFileSync(includePath, 'utf8');
  });
}

function normalizeModuleId(moduleId) {
  return String(moduleId ?? 'module')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function listEngines(databaseDir, manifestEngines) {
  const engines = new Set(manifestEngines?.length ? manifestEngines : ['postgres', 'sqlite']);
  for (const engine of ['postgres', 'sqlite']) {
    const baselineDir = path.join(databaseDir, 'ddl/baseline', engine);
    const migrationDir = path.join(databaseDir, 'migrations', engine);
    if (fs.existsSync(baselineDir) || fs.existsSync(migrationDir)) {
      engines.add(engine);
    }
  }
  return [...engines].sort();
}

function listSqlFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .sort();
}

function sqlAlreadyPresent(needle, haystack) {
  const normalizedNeedle = needle.replace(/\r\n/g, '\n').trim();
  if (!normalizedNeedle) {
    return true;
  }
  return haystack.replace(/\r\n/g, '\n').includes(normalizedNeedle);
}

function listMigrationUpFiles(migrationDir) {
  if (!fs.existsSync(migrationDir)) {
    return [];
  }
  return fs
    .readdirSync(migrationDir)
    .filter((name) => {
      if (name === 'README.md') {
        return false;
      }
      if (name.endsWith('.down.sql')) {
        return false;
      }
      return name.endsWith('.up.sql') || name.endsWith('.sql');
    })
    .sort();
}

function consolidateEngine(databaseDir, moduleId, engine) {
  const baselineDir = path.join(databaseDir, 'ddl/baseline', engine);
  const migrationDir = path.join(databaseDir, 'migrations', engine);
  const baselineFiles = listSqlFiles(baselineDir);
  const migrationFiles = listMigrationUpFiles(migrationDir);
  const targetName = `0001_${normalizeModuleId(moduleId)}_baseline.sql`;

  if (baselineFiles.length === 0 && migrationFiles.length === 0) {
    return { changed: false, actions: [] };
  }

  if (
    migrationFiles.length === 0 &&
    baselineFiles.length === 1 &&
    baselineFiles[0] === targetName
  ) {
    return { changed: false, actions: [] };
  }

  const actions = [];
  const sections = [
    `-- SDKWork ${moduleId} consolidated initialization baseline (${engine})`,
    `-- Generated by reset-database-initialization-state.mjs`,
    `-- Application is in initialization state: full DDL lives here; migrations/ is reserved for post-GA changes.`,
    '',
  ];

  let consolidated = '';
  for (const fileName of baselineFiles) {
    const filePath = path.join(baselineDir, fileName);
    let sql = fs.readFileSync(filePath, 'utf8');
    sql = resolveIrIncludes(sql, path.dirname(filePath));
    sections.push(`-- baseline source: ddl/baseline/${engine}/${fileName}`);
    sections.push(sql.trim());
    sections.push('');
    consolidated += `\n${sql}`;
  }

  for (const fileName of migrationFiles) {
    const filePath = path.join(migrationDir, fileName);
    let sql = resolveIrIncludes(fs.readFileSync(filePath, 'utf8'), path.dirname(filePath));
    if (isNoopMigration(sql)) {
      actions.push(`skip noop migration ${engine}/${fileName}`);
      continue;
    }
    if (sqlAlreadyPresent(sql, consolidated)) {
      actions.push(`skip duplicate migration ${engine}/${fileName}`);
      continue;
    }
    sections.push(`-- folded migration: migrations/${engine}/${fileName}`);
    sections.push(sql.trim());
    sections.push('');
    consolidated += `\n${sql}`;
    actions.push(`fold migration ${engine}/${fileName}`);
  }

  const targetPath = path.join(baselineDir, targetName);
  const output = `${sections.join('\n').trim()}\n`;

  const existing =
    fs.existsSync(targetPath) && baselineFiles.length === 1 && baselineFiles[0] === targetName
      ? fs.readFileSync(targetPath, 'utf8')
      : null;
  const contentChanged = existing !== output;

  if (contentChanged) {
    actions.push(`write ${engine}/${targetName}`);
  }

  const removeBaselines = baselineFiles.filter(
    (name) => name !== targetName && name.toLowerCase() !== targetName.toLowerCase(),
  );
  for (const name of removeBaselines) {
    actions.push(`remove baseline ${engine}/${name}`);
  }

  for (const fileName of migrationFiles) {
    actions.push(`remove migration ${engine}/${fileName}`);
    const downName = fileName.endsWith('.up.sql')
      ? fileName.replace(/\.up\.sql$/, '.down.sql')
      : null;
    if (downName && fs.existsSync(path.join(migrationDir, downName))) {
      actions.push(`remove migration ${engine}/${downName}`);
    }
  }

  return {
    changed: actions.length > 0,
    actions,
    apply(dryRun) {
      if (dryRun) {
        return;
      }
      fs.mkdirSync(baselineDir, { recursive: true });
      if (contentChanged) {
        fs.writeFileSync(targetPath, output, 'utf8');
      }
      for (const name of removeBaselines) {
        const removePath = path.join(baselineDir, name);
        if (
          fs.existsSync(removePath) &&
          path.resolve(removePath).toLowerCase() !== path.resolve(targetPath).toLowerCase()
        ) {
          fs.unlinkSync(removePath);
        }
      }
      for (const fileName of migrationFiles) {
        fs.unlinkSync(path.join(migrationDir, fileName));
        const downName = fileName.endsWith('.up.sql')
          ? fileName.replace(/\.up\.sql$/, '.down.sql')
          : null;
        const downPath = downName ? path.join(migrationDir, downName) : null;
        if (downPath && fs.existsSync(downPath)) {
          fs.unlinkSync(downPath);
        }
      }
    },
  };
}

function removeLooseMigrationSql(databaseDir, dryRun, actions) {
  const migrationsRoot = path.join(databaseDir, 'migrations');
  if (!fs.existsSync(migrationsRoot)) {
    return;
  }
  for (const entry of fs.readdirSync(migrationsRoot, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.sql')) {
      continue;
    }
    actions.push(`remove loose migration ${entry.name}`);
    if (!dryRun) {
      fs.unlinkSync(path.join(migrationsRoot, entry.name));
    }
  }
}

function updateDatabaseReadme(repoRoot, moduleId, dryRun) {
  const readmePath = path.join(repoRoot, 'database/README.md');
  if (!fs.existsSync(readmePath)) {
    return false;
  }
  let content = fs.readFileSync(readmePath, 'utf8');
  const commandsSection = [
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
  ].join('\n');
  const initSection = [
    '## Initialization state',
    '',
    'This module is in **initialization state** for greenfield deployments:',
    '',
    '1. **Baseline** — `database/ddl/baseline/{engine}/0001_' + moduleId + '_baseline.sql` contains the full DDL snapshot.',
    '2. **Migrations** — `database/migrations/{engine}/` is reserved for post-GA incremental schema changes only. It is intentionally empty at initialization.',
    '3. **Drift** — run `pnpm db:drift:check` before release.',
    '',
  ].join('\n');

  if (content.includes('## Initialization state')) {
    content = content.replace(/## Initialization state[\s\S]*?(?=\n## |\n```|$)/, `${initSection.trim()}\n\n`);
  } else if (content.includes('## Migration strategy')) {
    content = content.replace(/## Migration strategy[\s\S]*?(?=\n## |\n```|$)/, `${initSection.trim()}\n\n`);
  } else if (content.includes('## Commands')) {
    content = content.replace('## Commands', `${initSection}## Commands`);
  } else {
    content = `${content.trim()}\n\n${initSection}`;
  }

  const commandsIndex = content.indexOf('## Commands');
  if (commandsIndex >= 0) {
    content = `${content.slice(0, commandsIndex).trimEnd()}\n\n${commandsSection}`;
  } else {
    content = `${content.trimEnd()}\n\n${commandsSection}`;
  }

  if (!dryRun) {
    fs.writeFileSync(readmePath, content.endsWith('\n') ? content : `${content}\n`, 'utf8');
  }
  return true;
}

function markLegacyCrateMigrations(repoRoot, dryRun) {
  const cratesDir = path.join(repoRoot, 'crates');
  if (!fs.existsSync(cratesDir)) {
    return [];
  }
  const marked = [];
  for (const entry of fs.readdirSync(cratesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const migrationDir = path.join(cratesDir, entry.name, 'migrations');
    if (!fs.existsSync(migrationDir)) {
      continue;
    }
    const deprecatedPath = path.join(migrationDir, 'DEPRECATED.md');
    if (!fs.existsSync(deprecatedPath)) {
      marked.push(path.relative(repoRoot, migrationDir));
      if (!dryRun) {
        fs.writeFileSync(deprecatedPath, `${DEPRECATED_NOTICE}\n`, 'utf8');
      }
    }
  }
  return marked;
}

function markOtherLegacyPaths(repoRoot, dryRun) {
  const marked = [];
  const candidates = [
    path.join(repoRoot, 'migrations'),
    path.join(repoRoot, 'specs/database'),
    path.join(repoRoot, 'deployments/database'),
  ];
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) {
      continue;
    }
    const deprecatedPath = path.join(candidate, 'DEPRECATED.md');
    if (!fs.existsSync(deprecatedPath)) {
      marked.push(path.relative(repoRoot, candidate));
      if (!dryRun) {
        fs.writeFileSync(deprecatedPath, `${DEPRECATED_NOTICE}\n`, 'utf8');
      }
    }
  }
  return marked;
}

function normalizeBaselineLayout(databaseDir, normalizedModuleId, dryRun) {
  const actions = [];
  const targetName = `0001_${normalizedModuleId}_baseline.sql`;
  const engines = ['postgres', 'sqlite'];
  const resolved = {};

  for (const engine of engines) {
    const baselineDir = path.join(databaseDir, 'ddl/baseline', engine);
    if (!fs.existsSync(baselineDir)) {
      continue;
    }
    const files = listSqlFiles(baselineDir);
    const targetPath = path.join(baselineDir, targetName);

    if (files.length === 0) {
      resolved[engine] = null;
      continue;
    }

    if (files.length === 1 && files[0].toLowerCase() === targetName.toLowerCase()) {
      if (files[0] !== targetName) {
        actions.push(`rename baseline ${engine}/${files[0]} -> ${targetName}`);
        if (!dryRun) {
          fs.renameSync(path.join(baselineDir, files[0]), targetPath);
        }
      }
      resolved[engine] = targetPath;
      continue;
    }

    if (files.length === 1) {
      actions.push(`rename baseline ${engine}/${files[0]} -> ${targetName}`);
      if (!dryRun) {
        fs.renameSync(path.join(baselineDir, files[0]), targetPath);
      }
      resolved[engine] = targetPath;
      continue;
    }

    const result = consolidateEngine(databaseDir, normalizedModuleId, engine);
    if (result.changed) {
      actions.push(...result.actions);
      result.apply(dryRun);
      resolved[engine] = targetPath;
    }
  }

  if (!resolved.postgres && resolved.sqlite && fs.existsSync(path.join(databaseDir, 'ddl/baseline/postgres'))) {
    const targetPath = path.join(databaseDir, 'ddl/baseline/postgres', targetName);
    actions.push(`copy sqlite baseline -> postgres/${targetName}`);
    if (!dryRun) {
      fs.copyFileSync(resolved.sqlite, targetPath);
    }
    resolved.postgres = targetPath;
  }

  if (!resolved.sqlite && resolved.postgres && fs.existsSync(path.join(databaseDir, 'ddl/baseline/sqlite'))) {
    const targetPath = path.join(databaseDir, 'ddl/baseline/sqlite', targetName);
    actions.push(`copy postgres baseline -> sqlite/${targetName}`);
    if (!dryRun) {
      fs.copyFileSync(resolved.postgres, targetPath);
    }
    resolved.sqlite = targetPath;
  }

  return actions;
}

function ensureContractTest(repoRoot, dryRun, actions) {
  const target = path.join(repoRoot, 'tests/contract/database-framework.contract.test.mjs');
  if (fs.existsSync(target)) {
    return;
  }
  const template = path.join(TOOL_DIR, '../templates/tests/database-framework.contract.test.mjs');
  actions.push('add tests/contract/database-framework.contract.test.mjs');
  if (!dryRun) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(template, target);
  }
}

function resetRepo(workspaceRoot, repoName, dryRun) {
  const repoRoot = path.join(workspaceRoot, repoName);
  const databaseDir = path.join(repoRoot, 'database');
  const manifest = readJson(path.join(databaseDir, 'database.manifest.json'));
  const moduleId = manifest.moduleId ?? repoName.replace(/^sdkwork-/u, '');
  const normalizedModuleId = normalizeModuleId(moduleId);
  const engines = listEngines(databaseDir, manifest.engines);

  const actions = [];
  for (const engine of engines) {
    const result = consolidateEngine(databaseDir, normalizedModuleId, engine);
    if (result.changed) {
      actions.push(...result.actions);
      result.apply(dryRun);
    }
  }

  removeLooseMigrationSql(databaseDir, dryRun, actions);
  actions.push(...normalizeBaselineLayout(databaseDir, normalizedModuleId, dryRun));
  ensureContractTest(repoRoot, dryRun, actions);
  updateDatabaseReadme(repoRoot, normalizedModuleId, dryRun);
  const legacyMarked = [...markLegacyCrateMigrations(repoRoot, dryRun), ...markOtherLegacyPaths(repoRoot, dryRun)];

  const validation = dryRun ? { ok: true, failures: [] } : validateDatabaseFramework(repoRoot);
  return { repoName, actions, legacyMarked, validation };
}

function main() {
  const { workspace, dryRun, repo } = parseArgs(process.argv.slice(2));
  const repos = listRepos(workspace, repo);
  if (repos.length === 0) {
    console.error('No database modules found.');
    process.exit(1);
  }

  let exitCode = 0;
  console.log(
    `${dryRun ? '[dry-run] ' : ''}Resetting database initialization state for ${repos.length} module(s) in ${workspace}`,
  );

  for (const repoName of repos) {
    const result = resetRepo(workspace, repoName, dryRun);
    if (result.actions.length === 0 && result.legacyMarked.length === 0) {
      console.log(`ok ${repoName} (already initialized)`);
      continue;
    }
    console.log(`${result.validation.ok ? 'ok' : 'fail'} ${repoName} (${result.actions.length} action(s))`);
    for (const action of result.actions.slice(0, 20)) {
      console.log(`  - ${action}`);
    }
    if (result.actions.length > 20) {
      console.log(`  - ... ${result.actions.length - 20} more`);
    }
    for (const legacy of result.legacyMarked) {
      console.log(`  - mark deprecated ${legacy}`);
    }
    if (!result.validation.ok) {
      for (const failure of result.validation.failures.slice(0, 5)) {
        console.log(`  issue: ${failure}`);
      }
      exitCode = 1;
    }
  }

  process.exit(exitCode);
}

main();
