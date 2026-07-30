import fs from 'node:fs';
import path from 'node:path';

const FORBIDDEN_GENERATED_STATE_DIRECTORIES = new Set(['.runtime']);
const RECURSION_SKIP_DIRECTORIES = new Set([
  '.dart_tool',
  '.git',
  '.gradle',
  '.pnpm',
  '.pnpm-store',
  'artifacts',
  'build',
  'coverage',
  'dist',
  'external',
  'node_modules',
  'target',
  'vendor',
]);
const COMPETING_ROOT_DIRECTORIES = new Map([
  ['api', 'apis'],
  ['sdk', 'sdks'],
  ['package', 'architecture-local packages'],
  ['deploy', 'deployments'],
  ['deployment', 'deployments'],
  ['tooling', 'tools'],
]);

function toPosix(value) {
  return value.replaceAll(path.sep, '/');
}

function scanDirectory(root, current, issues) {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const fullPath = path.join(current, entry.name);
    const relativePath = toPosix(path.relative(root, fullPath));
    if (FORBIDDEN_GENERATED_STATE_DIRECTORIES.has(entry.name)) {
      issues.push({
        kind: 'forbidden-generated-state-directory',
        path: relativePath,
        detail: '.runtime is forbidden inside a source tree; classify and move each producer to its native owner',
      });
      continue;
    }
    if (RECURSION_SKIP_DIRECTORIES.has(entry.name) || entry.isSymbolicLink()) continue;
    scanDirectory(root, fullPath, issues);
  }
}

function scanCompetingRootDirectories(root, issues) {
  for (const [name, replacement] of COMPETING_ROOT_DIRECTORIES) {
    if (!fs.existsSync(path.join(root, name))) continue;
    issues.push({
      kind: 'competing-root-directory',
      path: name,
      detail: `use ${replacement} according to SDKWORK_WORKSPACE_SPEC.md`,
    });
  }
}

export function validateWorkspaceLayout(root) {
  const resolvedRoot = path.resolve(root);
  if (!fs.existsSync(resolvedRoot) || !fs.statSync(resolvedRoot).isDirectory()) {
    return [{
      kind: 'missing-workspace-root',
      path: resolvedRoot,
      detail: 'workspace root must be an existing directory',
    }];
  }

  const issues = [];
  scanCompetingRootDirectories(resolvedRoot, issues);
  scanDirectory(resolvedRoot, resolvedRoot, issues);
  return issues.sort((left, right) => (
    left.path.localeCompare(right.path, 'en') || left.kind.localeCompare(right.kind, 'en')
  ));
}

export function listWorkspaceRepositoryRoots(workspaceRoot) {
  const resolvedRoot = path.resolve(workspaceRoot);
  return fs.readdirSync(resolvedRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(resolvedRoot, entry.name))
    .filter((candidate) => (
      fs.existsSync(path.join(candidate, 'AGENTS.md'))
      || fs.existsSync(path.join(candidate, 'package.json'))
      || fs.existsSync(path.join(candidate, 'Cargo.toml'))
      || fs.existsSync(path.join(candidate, 'pubspec.yaml'))
    ))
    .sort((left, right) => left.localeCompare(right, 'en'));
}
