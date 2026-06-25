import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  buildDependencyCompositionManifest,
  extractListSdkInventoryExports,
  extractSdkFamiliesFromCoreSource,
  validateManifestSchema,
} from './lib/dependency-composition.mjs';

const CHECKER = path.resolve('tools/check-dependency-composition.mjs');
const ALIGNER = path.resolve('tools/align-dependency-composition.mjs');

function write(root, relativePath, text) {
  const filePath = path.join(root, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, text);
}

describe('dependency composition standard', () => {
  it('extracts sdk families and inventory exports from core index', () => {
    const source = [
      'export const sdkworkCommercePcAppSdkFamilies = [',
      '  { family: "sdkwork-commerce-app-sdk", surface: "app" },',
      '  { family: "sdkwork-iam-app-sdk", surface: "app" },',
      '  { family: "sdkwork-commerce-sdk", surface: "open" },',
      '] as const;',
      'export function listSdkworkCommercePcAppSdkFamilies() { return sdkworkCommercePcAppSdkFamilies; }',
      'export type SdkworkCommercePcSdkFamilyInventoryItem = { family: string };',
    ].join('\n');

    assert.deepEqual(extractSdkFamiliesFromCoreSource(source), [
      'sdkwork-commerce-app-sdk',
      'sdkwork-iam-app-sdk',
      'sdkwork-commerce-sdk',
    ]);
    assert.deepEqual(extractListSdkInventoryExports(source).listFunctions, [
      'listSdkworkCommercePcAppSdkFamilies',
    ]);
  });

  it('validates manifest schema', () => {
    const manifest = buildDependencyCompositionManifest({
      applicationCode: 'commerce',
      architecture: { id: 'pc' },
      cores: [{
        surface: 'app',
        componentName: '@sdkwork/commerce-pc-core',
        componentSpec: {
          contracts: {
            sdkDependencies: ['sdkwork-commerce-app-sdk', 'sdkwork-iam-app-sdk'],
          },
        },
      }],
    });
    assert.deepEqual(validateManifestSchema(manifest), []);
  });

  it('passes specs repo self-check', () => {
    const result = spawnSync(process.execPath, [CHECKER, '--root', '.'], {
      cwd: path.resolve('.'),
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  });

  it('aligns a minimal client app root', () => {
    const workspace = mkdtempSync(path.join(os.tmpdir(), 'sdkwork-dep-comp-'));
    const repoRoot = path.join(workspace, 'sdkwork-demo');
    write(repoRoot, 'apps/sdkwork-demo-pc/sdkwork.app.config.json', '{}\n');
    write(repoRoot, 'apps/sdkwork-demo-pc/specs/component.spec.json', JSON.stringify({
      schemaVersion: 1,
      kind: 'sdkwork.component.spec',
      component: { name: 'sdkwork-demo-pc', type: 'pc-app', root: '.', domain: 'demo', capability: 'pc', surface: 'app', languages: ['typescript'] },
      contracts: { sdkDependencies: [], dependencyApiExports: [], dependencyApiSurfaces: [] },
    }, null, 2));
    write(repoRoot, 'apps/sdkwork-demo-pc/packages/sdkwork-demo-pc-core/package.json', JSON.stringify({
      name: '@sdkwork/demo-pc-core',
      exports: { '.': './src/index.ts' },
    }, null, 2));
    write(repoRoot, 'apps/sdkwork-demo-pc/packages/sdkwork-demo-pc-core/specs/component.spec.json', JSON.stringify({
      schemaVersion: 1,
      kind: 'sdkwork.component.spec',
      component: { name: '@sdkwork/demo-pc-core', type: 'typescript-package', root: '.', domain: 'demo', capability: 'core', surface: 'app', languages: ['typescript'] },
      contracts: {
        sdkDependencies: ['sdkwork-demo-app-sdk'],
        dependencyApiExports: [],
        dependencyApiSurfaces: [],
      },
    }, null, 2));
    write(repoRoot, 'apps/sdkwork-demo-pc/packages/sdkwork-demo-pc-core/src/index.ts', 'export {};\n');

    const align = spawnSync(process.execPath, [ALIGNER, '--workspace', workspace], { encoding: 'utf8' });
    assert.equal(align.status, 0, align.stderr || align.stdout);

    const check = spawnSync(process.execPath, [CHECKER, '--root', '.', '--workspace', workspace], { encoding: 'utf8' });
    assert.equal(check.status, 0, check.stderr || check.stdout);
  });
});
