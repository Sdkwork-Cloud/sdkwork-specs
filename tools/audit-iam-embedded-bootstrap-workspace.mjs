#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const iamRepoRoot = path.join(workspaceRoot, 'sdkwork-iam');

const EMBEDDED_IAM_REPOS = [
  {
    name: 'sdkwork-im',
    governanceTest: 'scripts/dev/sdkwork-im-iam-application-bootstrap-standard.test.mjs',
  },
  {
    name: 'sdkwork-drive',
    governanceTest: 'scripts/dev/sdkwork-drive-iam-application-bootstrap-standard.test.mjs',
  },
  {
    name: 'sdkwork-notes',
    governanceTest: 'scripts/dev/sdkwork-notes-iam-application-bootstrap-standard.test.mjs',
  },
  {
    name: 'sdkwork-github',
    governanceTest: 'scripts/dev/sdkwork-github-iam-application-bootstrap-standard.test.mjs',
  },
  {
    name: 'sdkwork-birdcoder',
    governanceTest: 'scripts/dev/sdkwork-birdcoder-iam-application-bootstrap-standard.test.mjs',
  },
  {
    name: 'sdkwork-clawrouter',
    governanceTest: 'scripts/dev/sdkwork-clawrouter-iam-application-bootstrap-standard.test.mjs',
  },
  {
    name: 'sdkwork-api-cloud-gateway',
    governanceTest: 'scripts/dev/sdkwork-api-cloud-gateway-iam-application-bootstrap-standard.test.mjs',
  },
];

const EMBEDDED_GATEWAY_CONSUMER_REPOS = [
  { name: 'sdkwork-documents', devScript: 'scripts/documents-dev.mjs' },
  { name: 'sdkwork-knowledgebase', devScript: 'scripts/knowledgebase-dev.mjs' },
  { name: 'sdkwork-terminal', devScript: 'scripts/terminal-dev.mjs' },
  { name: 'sdkwork-mail', devScript: 'scripts/mail-dev.mjs' },
  { name: 'sdkwork-rtc', devScript: 'scripts/rtc-dev.mjs' },
  { name: 'sdkwork-aiot', devScript: 'scripts/aiot-dev.mjs' },
  { name: 'sdkwork-kernel', devScript: 'scripts/kernel-dev.mjs' },
  { name: 'sdkwork-notes', devScript: 'scripts/notes-dev.mjs' },
  { name: 'sdkwork-drive', devScript: 'scripts/drive-dev.mjs' },
  { name: 'sdkwork-im', devScript: 'scripts/im-dev.mjs' },
];

const FORBIDDEN_ADAPTER_PATTERN = /ensure_tenant_application_from_app_root_with_env\s*\(/u;

function readIfExists(root, relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    return null;
  }
  return fs.readFileSync(absolutePath, 'utf8');
}

function readJsonIfExists(root, relativePath) {
  const source = readIfExists(root, relativePath);
  if (!source) {
    return null;
  }
  return JSON.parse(source);
}

function scanApplicationRustSources(repoRoot) {
  const hits = [];
  const queue = [repoRoot];
  while (queue.length > 0) {
    const current = queue.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name === 'target' || entry.name === 'node_modules' || entry.name === '.git') {
        continue;
      }
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
        continue;
      }
      if (!entry.name.endsWith('.rs')) {
        continue;
      }
      const source = fs.readFileSync(fullPath, 'utf8');
      if (FORBIDDEN_ADAPTER_PATTERN.test(source)) {
        hits.push(path.relative(repoRoot, fullPath));
      }
    }
  }
  return hits;
}

function resolveBootstrapManifestPath(repoRoot, topologySource) {
  const appRootMatch = topologySource.match(
    /SDKWORK_APP_ROOT:\s*([A-Z0-9_]+)/u,
  );
  if (!appRootMatch) {
    return path.join(repoRoot, 'sdkwork.app.config.json');
  }

  const rootConstant = appRootMatch[1];
  const constantMatch = topologySource.match(
    new RegExp(`export const ${rootConstant}\\s*=\\s*([^;]+);`, 'u'),
  );
  if (!constantMatch) {
    return path.join(repoRoot, 'sdkwork.app.config.json');
  }

  const expression = constantMatch[1];
  if (expression.includes('sdkwork-notes-pc-react')) {
    return path.join(repoRoot, 'sdkwork-notes-pc-react', 'sdkwork.app.config.json');
  }
  if (expression.includes('sdkwork-rtc-pc')) {
    return path.join(repoRoot, 'apps', 'sdkwork-rtc-pc', 'sdkwork.app.config.json');
  }
  if (expression.includes('sdkwork-terminal-pc')) {
    return path.join(repoRoot, 'apps', 'sdkwork-terminal-pc', 'sdkwork.app.config.json');
  }

  return path.join(repoRoot, 'sdkwork.app.config.json');
}

function assertBootstrapManifestReady(repoName, manifestPath) {
  assert.ok(
    fs.existsSync(manifestPath),
    `${repoName} must provide sdkwork.app.config.json for embedded gateway bootstrap at ${manifestPath}`,
  );
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const appKey = manifest?.app?.key?.trim();
  const legacyAppId = manifest?.app?.id?.trim();
  assert.ok(
    appKey || legacyAppId,
    `${repoName} bootstrap manifest must define app.key or legacy app.id`,
  );
  const appType = manifest?.app?.appType?.trim();
  assert.ok(appType, `${repoName} bootstrap manifest must define app.appType`);
  const permissions = manifest?.backend?.accessTokenPermissionScope
    ?? manifest?.backend?.permissionScope
    ?? [];
  assert.ok(
    Array.isArray(permissions) && permissions.length > 0,
    `${repoName} bootstrap manifest must define backend.accessTokenPermissionScope`,
  );
}

for (const repo of EMBEDDED_IAM_REPOS) {
  const repoRoot = path.join(workspaceRoot, repo.name);
  assert.ok(fs.existsSync(repoRoot), `${repo.name} repository must exist under sdkwork-space`);
  const governancePath = path.join(repoRoot, repo.governanceTest);
  assert.ok(
    fs.existsSync(governancePath),
    `${repo.name} must provide ${repo.governanceTest}`,
  );
}

const sharedRuntime = readIfExists(
  iamRepoRoot,
  'crates/sdkwork-iam-embedded-application-bootstrap/src/runtime.rs',
);
assert.ok(sharedRuntime, 'sdkwork-iam embedded bootstrap runtime must exist');
assert.match(
  sharedRuntime,
  /ensure_tenant_application_from_app_root_with_env_and_fallback/u,
  'Shared embedded bootstrap must expose repository-root fallback API.',
);

for (const repo of EMBEDDED_IAM_REPOS) {
  const repoRoot = path.join(workspaceRoot, repo.name);
  const forbiddenHits = scanApplicationRustSources(repoRoot).filter(
    (relativePath) => !relativePath.includes('sdkwork-iam-embedded-application-bootstrap'),
  );
  assert.equal(
    forbiddenHits.length,
    0,
    `${repo.name} must not use ensure_tenant_application_from_app_root_with_env without fallback: ${forbiddenHits.join(', ')}`,
  );
}

const gatewayBootstrapSource = readIfExists(
  workspaceRoot,
  'sdkwork-api-cloud-gateway/crates/sdkwork-api-cloud-gateway/src/iam_application_bootstrap.rs',
);
assert.ok(gatewayBootstrapSource, 'sdkwork-api-cloud-gateway embedded IAM bootstrap module must exist');
assert.match(
  gatewayBootstrapSource,
  /ensure_tenant_application_from_app_root_with_env_and_fallback/u,
  'sdkwork-api-cloud-gateway must provision tenant applications before mounting embedded IAM routes.',
);

for (const repo of EMBEDDED_GATEWAY_CONSUMER_REPOS) {
  const repoRoot = path.join(workspaceRoot, repo.name);
  if (!fs.existsSync(repoRoot)) {
    continue;
  }

  const devScriptPath = path.join(repoRoot, repo.devScript);
  assert.ok(
    fs.existsSync(devScriptPath),
    `${repo.name} must provide ${repo.devScript} for embedded gateway dev orchestration`,
  );
  const devScriptSource = fs.readFileSync(devScriptPath, 'utf8');
  assert.match(
    devScriptSource,
    /IAM_APPLICATION_BOOTSTRAP_ENV/u,
    `${repo.name} dev orchestration must inject IAM_APPLICATION_BOOTSTRAP_ENV for embedded gateway bootstrap`,
  );

  const topologyCandidates = fs
    .globSync('scripts/lib/*-topology.mjs', { cwd: repoRoot })
    .concat(fs.globSync('scripts/lib/im-topology.mjs', { cwd: repoRoot }));
  const topologySource = topologyCandidates
    .map((relativePath) => readIfExists(repoRoot, relativePath))
    .find((source) => source?.includes('IAM_APPLICATION_BOOTSTRAP_ENV'));
  assert.ok(
    topologySource,
    `${repo.name} must export IAM_APPLICATION_BOOTSTRAP_ENV from a topology helper`,
  );
  assert.match(
    topologySource,
    /SDKWORK_IAM_APP_ROOT/u,
    `${repo.name} topology must export SDKWORK_IAM_APP_ROOT for embedded gateway bootstrap`,
  );
  assert.match(
    topologySource,
    /sdkwork-iam/u,
    `${repo.name} topology must point SDKWORK_IAM_APP_ROOT at the sdkwork-iam repository root`,
  );

  const manifestPath = resolveBootstrapManifestPath(repoRoot, topologySource);
  assertBootstrapManifestReady(repo.name, manifestPath);
}

console.log('sdkwork-space IAM embedded bootstrap workspace audit passed.');
