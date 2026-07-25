import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { validateCredentialEntryRepository } from './lib/credential-entry-bootstrap-standard.mjs';

function createFixture({ installPlugin = true, publicToken = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-credential-entry-'));
  const appRoot = path.join(root, 'apps', 'sdkwork-demo-pc');
  fs.mkdirSync(path.join(appRoot, 'src'), { recursive: true });
  fs.writeFileSync(path.join(appRoot, 'sdkwork.app.config.json'), '{"kind":"sdkwork.app"}\n');
  fs.writeFileSync(path.join(appRoot, 'index.html'), '<div id="root"></div>\n');
  fs.writeFileSync(path.join(appRoot, 'package.json'), JSON.stringify({
    name: '@sdkwork/demo-pc',
    private: true,
    scripts: { dev: 'vite' },
  }, null, 2));
  fs.writeFileSync(
    path.join(appRoot, 'src', 'runtime.ts'),
    "import { wrapCredentialEntryClient } from '@sdkwork/iam-credential-entry';\nvoid wrapCredentialEntryClient;\n",
  );
  fs.writeFileSync(
    path.join(appRoot, 'vite.config.ts'),
    installPlugin
      ? "import { createSdkworkCredentialEntryBootstrapVitePlugin } from '@sdkwork/iam-credential-entry/vite';\nexport default { plugins: [createSdkworkCredentialEntryBootstrapVitePlugin()] };\n"
      : 'export default { plugins: [] };\n',
  );
  fs.writeFileSync(path.join(appRoot, '.env.example'), 'SDKWORK_ACCESS_TOKEN=\n');
  fs.writeFileSync(
    path.join(appRoot, '.env.production.example'),
    publicToken ? 'SDKWORK_ACCESS_TOKEN=unsafe\n' : 'PUBLIC_API_URL=https://api.example.test\n',
  );
  return root;
}

test('accepts a canonical credential-entry Vite consumer', () => {
  const root = createFixture();
  try {
    assert.deepEqual(validateCredentialEntryRepository(root), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('accepts canonical Vite integration through a local composition helper', () => {
  const root = createFixture({ installPlugin: false });
  const appRoot = path.join(root, 'apps', 'sdkwork-demo-pc');
  try {
    fs.writeFileSync(
      path.join(appRoot, 'credential-entry-plugins.mjs'),
      "import { createSdkworkCredentialEntryBootstrapVitePlugin } from '@sdkwork/iam-credential-entry/vite';\nexport function createCredentialEntryPlugins() { return [createSdkworkCredentialEntryBootstrapVitePlugin()]; }\n",
    );
    fs.writeFileSync(
      path.join(appRoot, 'vite.config.ts'),
      "import { createCredentialEntryPlugins } from './credential-entry-plugins.mjs';\nexport default { plugins: createCredentialEntryPlugins() };\n",
    );
    assert.deepEqual(validateCredentialEntryRepository(root), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('reports missing canonical Vite integration', () => {
  const root = createFixture({ installPlugin: false });
  try {
    assert.ok(validateCredentialEntryRepository(root).some((issue) => issue.includes('must install')));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('reports resolved production browser bootstrap tokens', () => {
  const root = createFixture({ publicToken: true });
  try {
    const issues = validateCredentialEntryRepository(root);
    assert.ok(issues.some((issue) => issue.includes('resolved bootstrap token')));
    assert.ok(issues.some((issue) => issue.includes('production browser template')));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('does not treat nested library Vite configs as executable IAM renderers', () => {
  const root = createFixture();
  const libraryRoot = path.join(root, 'apps', 'sdkwork-demo-pc', 'packages', 'ui');
  try {
    fs.mkdirSync(path.join(libraryRoot, 'src'), { recursive: true });
    fs.writeFileSync(path.join(libraryRoot, 'package.json'), JSON.stringify({
      name: '@sdkwork/demo-ui',
      private: true,
      scripts: { build: 'vite build' },
    }, null, 2));
    fs.writeFileSync(path.join(libraryRoot, 'vite.config.ts'), 'export default { plugins: [] };\n');
    fs.writeFileSync(
      path.join(libraryRoot, 'src', 'auth.ts'),
      "import type { IamClient } from '@sdkwork/iam-app-sdk';\nexport type AuthClient = IamClient;\n",
    );
    assert.deepEqual(validateCredentialEntryRepository(root), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('ignores vendored external Vite projects', () => {
  const root = createFixture();
  const externalRoot = path.join(root, 'external', 'vendor-app');
  try {
    fs.mkdirSync(path.join(externalRoot, 'src'), { recursive: true });
    fs.writeFileSync(path.join(externalRoot, 'index.html'), '<div id="root"></div>\n');
    fs.writeFileSync(path.join(externalRoot, 'vite.config.ts'), 'export default { plugins: [] };\n');
    fs.writeFileSync(
      path.join(externalRoot, 'src', 'auth.ts'),
      "import { wrapCredentialEntryClient } from '@sdkwork/iam-credential-entry';\nvoid wrapCredentialEntryClient;\n",
    );
    assert.deepEqual(validateCredentialEntryRepository(root), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('ignores JWT helpers in test fixtures and mocks', () => {
  const root = createFixture();
  const scriptsRoot = path.join(root, 'scripts');
  try {
    fs.mkdirSync(path.join(scriptsRoot, 'fixtures'), { recursive: true });
    fs.writeFileSync(
      path.join(scriptsRoot, 'fixtures', 'credential-entry-bootstrap.fixture.mjs'),
      'function createTestJwt() { return "fixture"; }\nvoid createTestJwt;\n',
    );
    fs.writeFileSync(
      path.join(scriptsRoot, 'pc-e2e-mock-api-fixtures.mjs'),
      'function createTestJwt() { return "mock"; }\nvoid createTestJwt;\n',
    );
    assert.deepEqual(validateCredentialEntryRepository(root), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('still reports a production-local bootstrap implementation', () => {
  const root = createFixture();
  const devRoot = path.join(root, 'scripts', 'dev');
  try {
    fs.mkdirSync(devRoot, { recursive: true });
    fs.writeFileSync(
      path.join(devRoot, 'application-bootstrap.mjs'),
      'function createDevBootstrapAccessTokenJwt() { return "unsafe"; }\nvoid createDevBootstrapAccessTokenJwt;\n',
    );
    assert.ok(
      validateCredentialEntryRepository(root)
        .some((issue) => issue.includes('application-local credential-entry bootstrap fork')),
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
