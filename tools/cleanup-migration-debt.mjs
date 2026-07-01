#!/usr/bin/env node
/**
 * Cleanup remaining migration debt across all sdkwork-* projects:
 *
 * 1. Consolidate database/ddl/migrations/ SQL into baseline DDL (if not already present)
 * 2. Delete all crate-local migration SQL files (crates/*/migrations/**/*.sql)
 * 3. Delete specs/database/migrations/ SQL files (if content already in baseline)
 * 4. Delete database/ddl/migrations/ directories after consolidation
 * 5. Keep DEPRECATED.md and README.md files
 * 6. Keep database/migrations/{engine}/ directory structure (migration mechanism)
 *
 * Usage:
 *   node cleanup-migration-debt.mjs --workspace <dir> [--dry-run] [--repo <name>]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(TOOL_DIR, '../..');

const ENGINES = ['postgres', 'sqlite'];

function parseArgs(argv) {
  const args = { workspace: WORKSPACE_ROOT, dryRun: false, repo: '' };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--workspace') {
      args.workspace = path.resolve(argv[++i] ?? '');
    } else if (token === '--dry-run') {
      args.dryRun = true;
    } else if (token === '--repo') {
      args.repo = argv[++i] ?? '';
    } else if (token === '--help' || token === '-h') {
      console.log('Usage: node cleanup-migration-debt.mjs --workspace <dir> [--dry-run] [--repo <name>]');
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
    .filter((e) => e.isDirectory() && e.name.startsWith('sdkwork-'))
    .map((e) => e.name)
    .filter((name) => !repoFilter || name === repoFilter)
    .filter((name) => fs.existsSync(path.join(workspaceRoot, name, 'database', 'database.manifest.json')))
    .sort();
}

function listSqlFilesRecursive(dir) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listSqlFilesRecursive(fullPath));
    } else if (entry.name.endsWith('.sql')) {
      results.push(fullPath);
    }
  }
  return results;
}

function listSqlFilesFlat(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => path.join(dir, name));
}

function normalizeModuleId(moduleId) {
  return String(moduleId ?? 'module')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Check if the SQL content (stripped of comments) is already present in the baseline.
 */
function sqlContentAlreadyPresent(migrationSql, baselineContent) {
  // Extract executable SQL lines (non-comment, non-empty)
  const extractExecutable = (sql) =>
    sql
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('--'))
      .join('\n')
      .replace(/\s+/g, ' ')
      .trim();

  const needle = extractExecutable(migrationSql);
  if (!needle) return true;

  const haystack = extractExecutable(baselineContent);
  return haystack.includes(needle);
}

/**
 * Adapt PostgreSQL-specific SQL syntax to SQLite-compatible syntax.
 */
function adaptToSqlite(sql) {
  return sql
    // Remove PostgreSQL type casts like '::jsonb', '::json', '::text', '::int', etc.
    .replace(/'([^']*)'::\w+/g, "'$1'")
    .replace(/::\w+/g, '')
    // Replace BYTEA with BLOB
    .replace(/\bBYTEA\b/gi, 'BLOB')
    // Replace TIMESTAMPTZ with TEXT (SQLite stores as text)
    .replace(/\bTIMESTAMPTZ\b/gi, 'TEXT')
    // Replace ON CONFLICT ... DO NOTHING (keep as-is, SQLite supports this)
    // Replace GEN_RANDOM_UUID() - keep as text
    // Remove partial index WHERE clauses that use PostgreSQL-specific syntax
    // Keep WHERE for partial indexes - SQLite supports WHERE on indexes
    ;
}

/**
 * Consolidate database/ddl/migrations/ into baseline for a specific engine.
 */
function consolidateDdlMigrations(databaseDir, moduleId, engine, dryRun, actions) {
  const ddlMigrationsDir = path.join(databaseDir, 'ddl', 'migrations', engine);
  const baselineDir = path.join(databaseDir, 'ddl', 'baseline', engine);
  const targetName = `0001_${normalizeModuleId(moduleId)}_baseline.sql`;
  const baselinePath = path.join(baselineDir, targetName);

  if (!fs.existsSync(ddlMigrationsDir)) {
    return;
  }

  const migrationFiles = listSqlFilesFlat(ddlMigrationsDir);
  if (migrationFiles.length === 0) {
    // Remove empty directory
    actions.push(`remove empty dir database/ddl/migrations/${engine}`);
    if (!dryRun) {
      try {
        fs.rmSync(ddlMigrationsDir, { recursive: true });
      } catch {
        // ignore
      }
    }
    return;
  }

  // Read baseline
  let baselineContent = '';
  if (fs.existsSync(baselinePath)) {
    baselineContent = fs.readFileSync(baselinePath, 'utf8');
  }

  const sections = [];
  let contentChanged = false;

  for (const migrationFile of migrationFiles) {
    const fileName = path.basename(migrationFile);
    let migrationSql = fs.readFileSync(migrationFile, 'utf8');

    // Adapt SQL for SQLite engine
    if (engine === 'sqlite') {
      migrationSql = adaptToSqlite(migrationSql);
    }

    if (sqlContentAlreadyPresent(migrationSql, baselineContent)) {
      actions.push(`skip duplicate ddl/migrations/${engine}/${fileName} (already in baseline)`);
    } else {
      sections.push(`-- folded ddl/migration: ddl/migrations/${engine}/${fileName}`);
      sections.push(migrationSql.trim());
      sections.push('');
      contentChanged = true;
      actions.push(`fold ddl/migrations/${engine}/${fileName} into baseline`);
    }

    actions.push(`delete ddl/migrations/${engine}/${fileName}`);
    if (!dryRun) {
      fs.unlinkSync(migrationFile);
    }
  }

  // Append folded content to baseline
  if (contentChanged && !dryRun) {
    const foldedContent = sections.join('\n').trim();
    const updatedBaseline = `${baselineContent.trimEnd()}\n\n${foldedContent}\n`;
    fs.writeFileSync(baselinePath, updatedBaseline, 'utf8');
    actions.push(`update baseline ${engine}/${targetName}`);
  }

  // Remove the now-empty ddl/migrations/{engine} directory
  const remainingFiles = fs.existsSync(ddlMigrationsDir)
    ? fs.readdirSync(ddlMigrationsDir)
    : [];
  if (remainingFiles.length === 0 || (remainingFiles.length === 1 && remainingFiles[0] === 'DEPRECATED.md')) {
    actions.push(`remove dir database/ddl/migrations/${engine}`);
    if (!dryRun) {
      try {
        fs.rmSync(ddlMigrationsDir, { recursive: true });
      } catch {
        // ignore
      }
    }
  }
}

/**
 * Remove the ddl/migrations directory entirely if empty.
 */
function removeDdlMigrationsRoot(databaseDir, dryRun, actions) {
  const ddlMigrationsRoot = path.join(databaseDir, 'ddl', 'migrations');
  if (!fs.existsSync(ddlMigrationsRoot)) return;

  // Check if directory is empty or only has empty subdirectories
  const entries = fs.readdirSync(ddlMigrationsRoot, { withFileTypes: true });
  let allEmpty = true;
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const subDir = path.join(ddlMigrationsRoot, entry.name);
      const subEntries = fs.readdirSync(subDir);
      if (subEntries.length > 0) {
        allEmpty = false;
        break;
      }
    } else {
      allEmpty = false;
      break;
    }
  }

  if (allEmpty) {
    actions.push('remove empty dir database/ddl/migrations');
    if (!dryRun) {
      try {
        fs.rmSync(ddlMigrationsRoot, { recursive: true });
      } catch {
        // ignore
      }
    }
  }
}

/**
 * Delete all .sql files from crate-local migrations directories.
 * Keep DEPRECATED.md and other non-SQL files.
 */
function deleteCrateLocalMigrationSql(repoRoot, dryRun, actions) {
  const cratesDir = path.join(repoRoot, 'crates');
  if (!fs.existsSync(cratesDir)) return;

  for (const crateEntry of fs.readdirSync(cratesDir, { withFileTypes: true })) {
    if (!crateEntry.isDirectory()) continue;
    const crateMigrationsDir = path.join(cratesDir, crateEntry.name, 'migrations');
    if (!fs.existsSync(crateMigrationsDir)) continue;

    // Recursively find and delete all .sql files
    const sqlFiles = listSqlFilesRecursive(crateMigrationsDir);
    for (const sqlFile of sqlFiles) {
      const relPath = path.relative(repoRoot, sqlFile);
      actions.push(`delete crate-local migration ${relPath}`);
      if (!dryRun) {
        fs.unlinkSync(sqlFile);
      }
    }
  }
}

/**
 * Delete all .sql files from specs/database/migrations/ directories.
 * Keep DEPRECATED.md and other non-SQL files.
 */
function deleteSpecsDatabaseMigrationSql(repoRoot, dryRun, actions) {
  const specsDbMigrations = path.join(repoRoot, 'specs', 'database', 'migrations');
  if (!fs.existsSync(specsDbMigrations)) return;

  const sqlFiles = listSqlFilesRecursive(specsDbMigrations);
  for (const sqlFile of sqlFiles) {
    const relPath = path.relative(repoRoot, sqlFile);
    actions.push(`delete specs migration ${relPath}`);
    if (!dryRun) {
      fs.unlinkSync(sqlFile);
    }
  }
}

/**
 * Delete any loose .sql files from database/migrations/ root (not in engine subdirs).
 */
function deleteLooseMigrationSql(databaseDir, dryRun, actions) {
  const migrationsRoot = path.join(databaseDir, 'migrations');
  if (!fs.existsSync(migrationsRoot)) return;

  for (const entry of fs.readdirSync(migrationsRoot, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.sql')) {
      actions.push(`delete loose migration ${entry.name}`);
      if (!dryRun) {
        fs.unlinkSync(path.join(migrationsRoot, entry.name));
      }
    }
  }
}

/**
 * Ensure database/migrations/{engine}/ has README.md placeholder.
 */
function ensureMigrationReadme(databaseDir, engine, dryRun, actions) {
  const migrationDir = path.join(databaseDir, 'migrations', engine);
  const readmePath = path.join(migrationDir, 'README.md');

  if (fs.existsSync(migrationDir) && !fs.existsSync(readmePath)) {
    const content = `# ${engine} migrations

This directory is reserved for post-GA incremental schema changes.

The application is currently in **initialization state** — the full DDL
lives in \`database/ddl/baseline/${engine}/\`.

When a post-GA schema change is needed:

1. Create \`{NNNN}_{description}.up.sql\` and \`{NNNN}_{description}.down.sql\`
2. Run \`pnpm db:migrate\` to apply
3. Run \`pnpm db:drift:check\` to verify

See \`DATABASE_FRAMEWORK_SPEC.md\` for details.
`;
    actions.push(`add migrations/${engine}/README.md`);
    if (!dryRun) {
      fs.writeFileSync(readmePath, content, 'utf8');
    }
  }
}

function resetRepo(workspaceRoot, repoName, dryRun) {
  const repoRoot = path.join(workspaceRoot, repoName);
  const databaseDir = path.join(repoRoot, 'database');
  const manifestPath = path.join(databaseDir, 'database.manifest.json');

  if (!fs.existsSync(manifestPath)) {
    return { repoName, actions: [], skipped: true };
  }

  const manifest = readJson(manifestPath);
  const moduleId = manifest.moduleId ?? repoName.replace(/^sdkwork-/u, '');
  const normalizedModuleId = normalizeModuleId(moduleId);
  const engines = manifest.engines?.length ? manifest.engines : ['postgres', 'sqlite'];

  const actions = [];

  // 1. Consolidate database/ddl/migrations/ into baseline
  for (const engine of engines) {
    consolidateDdlMigrations(databaseDir, normalizedModuleId, engine, dryRun, actions);
  }
  removeDdlMigrationsRoot(databaseDir, dryRun, actions);

  // 2. Delete loose migration SQL from database/migrations/
  deleteLooseMigrationSql(databaseDir, dryRun, actions);

  // 3. Delete crate-local migration SQL files
  deleteCrateLocalMigrationSql(repoRoot, dryRun, actions);

  // 4. Delete specs/database/migrations/ SQL files
  deleteSpecsDatabaseMigrationSql(repoRoot, dryRun, actions);

  // 5. Ensure migration READMEs exist
  for (const engine of engines) {
    ensureMigrationReadme(databaseDir, engine, dryRun, actions);
  }

  return { repoName, actions, skipped: false };
}

function main() {
  const { workspace, dryRun, repo } = parseArgs(process.argv.slice(2));
  const repos = listRepos(workspace, repo);
  if (repos.length === 0) {
    console.error('No database modules found.');
    process.exit(1);
  }

  console.log(
    `${dryRun ? '[dry-run] ' : ''}Cleaning migration debt for ${repos.length} module(s) in ${workspace}`,
  );

  let totalActions = 0;

  for (const repoName of repos) {
    const result = resetRepo(workspace, repoName, dryRun);
    if (result.skipped) {
      continue;
    }
    if (result.actions.length === 0) {
      console.log(`ok ${repoName} (no migration debt)`);
      continue;
    }
    console.log(`clean ${repoName} (${result.actions.length} action(s))`);
    for (const action of result.actions.slice(0, 30)) {
      console.log(`  - ${action}`);
    }
    if (result.actions.length > 30) {
      console.log(`  - ... ${result.actions.length - 30} more`);
    }
    totalActions += result.actions.length;
  }

  console.log(`\nTotal actions: ${totalActions}`);
  if (dryRun) {
    console.log('(dry-run — no files were modified)');
  }
}

main();
