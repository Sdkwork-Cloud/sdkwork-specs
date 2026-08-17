/**
 * Unit tests for publish-sdk orchestrator.
 * Run with: node --test tools/publish-sdk.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import {
  discoverPublishableSdks,
  discoverRepoSdks,
  discoverFamilyLanguages,
  filterPublishable,
  SUPPORTED_LANGUAGES,
} from './lib/sdk-publish/discover-publishable-sdks.mjs';
import { getPublisher } from './lib/sdk-publish/publisher-registry.mjs';
import { ReportBuilder } from './lib/sdk-publish/report.mjs';
import { isPreRelease, toDisplayPath, bumpVersion } from './lib/sdk-publish/util.mjs';

function makeTempWorkspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-pub-'));
  return root;
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function writeText(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text);
}

test('SUPPORTED_LANGUAGES lists all six languages', () => {
  assert.deepEqual(SUPPORTED_LANGUAGES, ['typescript', 'rust', 'java', 'flutter', 'python', 'go']);
});

test('isPreRelease detects 0.x and -rc / -beta', () => {
  assert.equal(isPreRelease('0.1.0'), true);
  assert.equal(isPreRelease('1.0.0-rc.1'), true);
  assert.equal(isPreRelease('2.3.0-beta'), true);
  assert.equal(isPreRelease('1.0.0'), false);
  assert.equal(isPreRelease('3.2.1'), false);
});

test('toDisplayPath normalizes backslashes', () => {
  assert.equal(toDisplayPath('a\\b\\c'), 'a/b/c');
  assert.equal(toDisplayPath('a/b/c'), 'a/b/c');
});

test('bumpVersion increments patch/minor/major correctly', () => {
  assert.equal(bumpVersion('0.1.0', 'patch'), '0.1.1');
  assert.equal(bumpVersion('1.2.3', 'patch'), '1.2.4');
  assert.equal(bumpVersion('0.1.0', 'minor'), '0.2.0');
  assert.equal(bumpVersion('1.2.3', 'minor'), '1.3.0');
  assert.equal(bumpVersion('0.1.0', 'major'), '1.0.0');
  assert.equal(bumpVersion('1.2.3', 'major'), '2.0.0');
  // pre-release suffix stripped
  assert.equal(bumpVersion('1.0.0-rc.1', 'patch'), '1.0.1');
  assert.equal(bumpVersion('1.0.0-beta', 'minor'), '1.1.0');
});

test('typescript publisher bumpPackageVersion writes new version to package.json', () => {
  const ws = makeTempWorkspace();
  const familyRoot = path.join(ws, 'sdks', 'sdkwork-bump-app-sdk');
  const tsRoot = path.join(familyRoot, 'sdkwork-bump-app-sdk-typescript');
  fs.mkdirSync(tsRoot, { recursive: true });
  writeJson(path.join(tsRoot, 'package.json'), {
    name: '@sdkwork/bump-app-sdk',
    version: '0.1.0',
  });

  const pub = getPublisher('typescript');
  const r = pub.bumpPackageVersion(tsRoot, 'patch');
  assert.ok(r.ok);
  assert.equal(r.version, '0.1.1');
  const after = JSON.parse(fs.readFileSync(path.join(tsRoot, 'package.json'), 'utf8'));
  assert.equal(after.version, '0.1.1');
});

test('discoverFamilyLanguages picks up manifest-declared languages', () => {
  const ws = makeTempWorkspace();
  const repoRoot = path.join(ws, 'sdkwork-fake');
  const familyRoot = path.join(repoRoot, 'sdks', 'sdkwork-fake-app-sdk');
  fs.mkdirSync(familyRoot, { recursive: true });

  // TypeScript consumer package.
  const tsRoot = path.join(familyRoot, 'sdkwork-fake-app-sdk-typescript');
  fs.mkdirSync(tsRoot, { recursive: true });
  writeJson(path.join(tsRoot, 'package.json'), {
    name: '@sdkwork/fake-app-sdk',
    version: '1.2.3',
  });

  writeJson(path.join(familyRoot, 'sdk-manifest.json'), {
    schemaVersion: 1,
    sdkFamily: 'sdkwork-fake-app-sdk',
    packageName: '@sdkwork/fake-app-sdk',
    transportPackageName: 'sdkwork-fake-app-sdk-generated-typescript',
    languages: [{ language: 'typescript' }],
    typescript: { composedRoot: 'sdkwork-fake-app-sdk-typescript' },
  });

  const families = discoverFamilyLanguages(repoRoot, familyRoot, 'sdkwork-fake-app-sdk');
  assert.equal(families.length, 1);
  assert.equal(families[0].language, 'typescript');
  assert.equal(families[0].manifestDriven, true);
  assert.equal(families[0].sdkFamily, 'sdkwork-fake-app-sdk');
});

test('discoverFamilyLanguages probes conventional dirs when manifest is silent', () => {
  const ws = makeTempWorkspace();
  const repoRoot = path.join(ws, 'sdkwork-fake2');
  const familyRoot = path.join(repoRoot, 'sdks', 'sdkwork-fake2-app-sdk');
  fs.mkdirSync(familyRoot, { recursive: true });

  const rustRoot = path.join(familyRoot, 'sdkwork-fake2-app-sdk-rust');
  fs.mkdirSync(rustRoot, { recursive: true });
  writeText(
    path.join(rustRoot, 'Cargo.toml'),
    `[package]
name = "sdkwork-fake2-app-sdk"
version = "0.4.1"
`,
  );

  const families = discoverFamilyLanguages(repoRoot, familyRoot, 'sdkwork-fake2-app-sdk');
  const rust = families.find((f) => f.language === 'rust');
  assert.ok(rust, 'rust family should be discovered');
  assert.equal(rust.manifestDriven, false);
});

test('filterPublishable respects repo / family / language', () => {
  const items = [
    { repoName: 'sdkwork-a', sdkFamily: 'fa', language: 'typescript' },
    { repoName: 'sdkwork-a', sdkFamily: 'fb', language: 'rust' },
    { repoName: 'sdkwork-b', sdkFamily: 'fc', language: 'go' },
  ];
  assert.equal(filterPublishable(items, { repo: 'sdkwork-a' }).length, 2);
  assert.equal(filterPublishable(items, { family: 'fb' }).length, 1);
  assert.equal(filterPublishable(items, { language: 'typescript' }).length, 1);
  assert.equal(filterPublishable(items, { language: 'all' }).length, 3);
  assert.equal(filterPublishable(items, {}).length, 3);
});

test('typescript publisher detects consumer package and rejects transport', () => {
  const ws = makeTempWorkspace();
  const familyRoot = path.join(ws, 'sdks', 'sdkwork-ts-app-sdk');
  const tsRoot = path.join(familyRoot, 'sdkwork-ts-app-sdk-typescript');
  fs.mkdirSync(tsRoot, { recursive: true });
  writeJson(path.join(tsRoot, 'package.json'), {
    name: '@sdkwork/ts-app-sdk',
    version: '1.0.0',
  });

  const pub = getPublisher('typescript');
  const detected = pub.detect(familyRoot, {});
  assert.ok(detected);
  assert.equal(detected.packageName, '@sdkwork/ts-app-sdk');
  assert.equal(detected.version, '1.0.0');
});

test('typescript publisher refuses to publish generated transport package', () => {
  const ws = makeTempWorkspace();
  const familyRoot = path.join(ws, 'sdks', 'sdkwork-ts-app-sdk');
  const tsRoot = path.join(familyRoot, 'sdkwork-ts-app-sdk-typescript');
  const transportRoot = path.join(tsRoot, 'generated', 'server-openapi');
  fs.mkdirSync(transportRoot, { recursive: true });
  writeJson(path.join(transportRoot, 'package.json'), {
    name: 'sdkwork-ts-app-sdk-generated-typescript',
    version: '1.0.0',
  });
  // No consumer package.json — only transport exists.
  const pub = getPublisher('typescript');
  const detected = pub.detect(familyRoot, {});
  assert.equal(detected, null, 'transport-only family must not be publishable');
});

test('typescript publisher skips packages marked private: true', () => {
  const ws = makeTempWorkspace();
  const familyRoot = path.join(ws, 'sdks', 'sdkwork-priv-app-sdk');
  const tsRoot = path.join(familyRoot, 'sdkwork-priv-app-sdk-typescript');
  fs.mkdirSync(tsRoot, { recursive: true });
  writeJson(path.join(tsRoot, 'package.json'), {
    name: '@sdkwork/priv-app-sdk',
    version: '1.0.0',
    private: true,
  });

  const pub = getPublisher('typescript');
  const detected = pub.detect(familyRoot, {});
  assert.equal(detected, null, 'private packages must not be publishable');
});

test('rust publisher parses Cargo.toml name/version', () => {
  const ws = makeTempWorkspace();
  const familyRoot = path.join(ws, 'sdks', 'sdkwork-rust-app-sdk');
  const rustRoot = path.join(familyRoot, 'sdkwork-rust-app-sdk-rust');
  fs.mkdirSync(rustRoot, { recursive: true });
  writeText(
    path.join(rustRoot, 'Cargo.toml'),
    `[package]
name = "sdkwork-rust-app-sdk"
version = "2.1.0"

[dependencies]
`,
  );

  const pub = getPublisher('rust');
  const detected = pub.detect(familyRoot, {});
  assert.ok(detected);
  assert.equal(detected.packageName, 'sdkwork-rust-app-sdk');
  assert.equal(detected.version, '2.1.0');
});

test('java publisher parses pom.xml coordinates', () => {
  const ws = makeTempWorkspace();
  const familyRoot = path.join(ws, 'sdks', 'sdkwork-java-app-sdk');
  const javaRoot = path.join(familyRoot, 'sdkwork-java-app-sdk-java');
  fs.mkdirSync(javaRoot, { recursive: true });
  writeText(
    path.join(javaRoot, 'pom.xml'),
    `<?xml version="1.0"?>
<project>
  <modelVersion>4.0.0</modelVersion>
  <groupId>dev.sdkwork</groupId>
  <artifactId>sdkwork-java-app-sdk</artifactId>
  <version>3.0.0</version>
</project>
`,
  );

  const pub = getPublisher('java');
  const detected = pub.detect(familyRoot, {});
  assert.ok(detected);
  assert.equal(detected.packageName, 'dev.sdkwork:sdkwork-java-app-sdk');
  assert.equal(detected.version, '3.0.0');
});

test('flutter publisher respects publish_to: none', () => {
  const ws = makeTempWorkspace();
  const familyRoot = path.join(ws, 'sdks', 'sdkwork-flutter-app-sdk');
  const dartRoot = path.join(familyRoot, 'sdkwork-flutter-app-sdk-flutter');
  fs.mkdirSync(dartRoot, { recursive: true });
  writeText(
    path.join(dartRoot, 'pubspec.yaml'),
    `name: sdkwork_flutter_app_sdk
version: 1.5.0
publish_to: none
`,
  );

  const pub = getPublisher('flutter');
  assert.equal(pub.detect(familyRoot, {}), null, 'private (publish_to: none) packages must be skipped');
});

test('flutter publisher detects normal pubspec', () => {
  const ws = makeTempWorkspace();
  const familyRoot = path.join(ws, 'sdks', 'sdkwork-flutter-app-sdk');
  const dartRoot = path.join(familyRoot, 'sdkwork-flutter-app-sdk-flutter');
  fs.mkdirSync(dartRoot, { recursive: true });
  writeText(
    path.join(dartRoot, 'pubspec.yaml'),
    `name: sdkwork_flutter_app_sdk
version: 1.5.0
`,
  );

  const pub = getPublisher('flutter');
  const detected = pub.detect(familyRoot, {});
  assert.ok(detected);
  assert.equal(detected.packageName, 'sdkwork_flutter_app_sdk');
  assert.equal(detected.version, '1.5.0');
});

test('python publisher parses pyproject.toml', () => {
  const ws = makeTempWorkspace();
  const familyRoot = path.join(ws, 'sdks', 'sdkwork-py-app-sdk');
  const pyRoot = path.join(familyRoot, 'sdkwork-py-app-sdk-python');
  fs.mkdirSync(pyRoot, { recursive: true });
  writeText(
    path.join(pyRoot, 'pyproject.toml'),
    `[project]
name = "sdkwork-py-app-sdk"
version = "0.9.0"
`,
  );

  const pub = getPublisher('python');
  const detected = pub.detect(familyRoot, {});
  assert.ok(detected);
  assert.equal(detected.packageName, 'sdkwork-py-app-sdk');
  assert.equal(detected.version, '0.9.0');
});

test('go publisher parses go.mod module path', () => {
  const ws = makeTempWorkspace();
  const familyRoot = path.join(ws, 'sdks', 'sdkwork-go-app-sdk');
  const goRoot = path.join(familyRoot, 'sdkwork-go-app-sdk-go');
  fs.mkdirSync(goRoot, { recursive: true });
  writeText(
    path.join(goRoot, 'go.mod'),
    `module github.com/sdkwork-ai/sdkwork-go-app-sdk

go 1.22
`,
  );
  // init a tiny git repo with a v1.0.0 tag so version detection works
  spawnSync('git', ['init'], { cwd: goRoot, stdio: 'ignore' });
  spawnSync('git', ['add', '-A'], { cwd: goRoot, stdio: 'ignore' });
  spawnSync('git', ['commit', '-m', 'init', '--allow-empty'], { cwd: goRoot, stdio: 'ignore' });
  spawnSync('git', ['tag', 'v1.0.0'], { cwd: goRoot, stdio: 'ignore' });

  const pub = getPublisher('go');
  const detected = pub.detect(familyRoot, {});
  assert.ok(detected);
  assert.equal(detected.packageName, 'github.com/sdkwork-ai/sdkwork-go-app-sdk');
  assert.equal(detected.version, '1.0.0');
  assert.equal(detected.repoUrl, 'https://github.com/sdkwork-ai/sdkwork-go-app-sdk.git');
});

test('ReportBuilder accumulates and summarizes items', () => {
  const r = new ReportBuilder({ mode: 'publish', workspace: '/x', startedAt: '2026-08-15T00:00:00Z' });
  r.add({ repo: 'a', family: 'fa', language: 'typescript', packageName: '@sdkwork/a', version: '1.0.0', status: 'success', durationMs: 1 });
  r.add({ repo: 'b', family: 'fb', language: 'rust', packageName: 'b', version: '1.0.0', status: 'skipped', durationMs: 0, reason: 'exists' });
  r.add({ repo: 'c', family: 'fc', language: 'go', packageName: 'c', version: '1.0.0', status: 'failed', durationMs: 0, reason: 'err' });

  const s = r.summary();
  assert.equal(s.total, 3);
  assert.equal(s.success, 1);
  assert.equal(s.skipped, 1);
  assert.equal(s.failed, 1);

  const json = r.toJSON();
  assert.equal(json.mode, 'publish');
  assert.equal(json.items.length, 3);
});

test('ReportBuilder writes a JSON file', () => {
  const ws = makeTempWorkspace();
  const r = new ReportBuilder({ mode: 'dry-run', workspace: ws, startedAt: '2026-08-15T00:00:00Z' });
  r.add({ repo: 'a', family: 'fa', language: 'typescript', packageName: '@sdkwork/a', version: '1.0.0', status: 'dry-run', durationMs: 0 });
  const out = path.join(ws, 'report.json');
  r.write(out);
  assert.ok(fs.existsSync(out));
  const parsed = JSON.parse(fs.readFileSync(out, 'utf8'));
  assert.equal(parsed.summary.dryRun, 1);
});

test('discoverRepoSdks walks apps/*/sdks too', () => {
  const ws = makeTempWorkspace();
  const repoRoot = path.join(ws, 'sdkwork-app');
  const familyRoot = path.join(repoRoot, 'apps', 'main', 'sdks', 'sdkwork-main-app-sdk');
  const tsRoot = path.join(familyRoot, 'sdkwork-main-app-sdk-typescript');
  fs.mkdirSync(tsRoot, { recursive: true });
  writeJson(path.join(tsRoot, 'package.json'), { name: '@sdkwork/main-app-sdk', version: '1.0.0' });
  writeJson(path.join(familyRoot, 'sdk-manifest.json'), {
    schemaVersion: 1,
    sdkFamily: 'sdkwork-main-app-sdk',
    packageName: '@sdkwork/main-app-sdk',
    transportPackageName: 'sdkwork-main-app-sdk-generated-typescript',
    languages: [{ language: 'typescript' }],
  });

  const items = discoverRepoSdks(repoRoot);
  assert.equal(items.length, 1);
  assert.equal(items[0].sdkFamily, 'sdkwork-main-app-sdk');
});

test('getPublisher returns null for unknown language', () => {
  assert.equal(getPublisher('cobol'), null);
});
