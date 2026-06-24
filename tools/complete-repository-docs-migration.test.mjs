import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import {
  archiveLegacyTrees,
  classifyLegacyDoc,
  completeRepositoryDocsMigration,
  fixLegacyCanonLinks,
  ingestLegacyDocAsShard,
  slugFromLegacyFilename,
  updateCanonDocumentMaps,
} from './complete-repository-docs-migration-lib.mjs';
import { validateRepositoryDocsStandard } from './check-repository-docs-standard.mjs';
import { CANON_PATHS } from './repository-docs-paths.mjs';

describe('complete-repository-docs-migration', () => {
  it('classifies Chinese legacy filenames', () => {
    assert.equal(classifyLegacyDoc('01-产品设计与需求范围.md'), 'product');
    assert.equal(classifyLegacyDoc('02-架构标准与总体设计.md'), 'architecture');
    assert.match(slugFromLegacyFilename('01-产品设计与需求范围.md'), /^01-product/);
  });

  it('ingests legacy docs as shards and updates Canon entry maps', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'sdkwork-complete-docs-'));
    const identity = {
      profile: 'application',
      repoName: 'sdkwork-notes',
      applicationCode: 'notes',
      productName: 'SDKWork Notes',
      owner: 'SDKWork maintainers',
    };

    writeFileSync(path.join(root, 'AGENTS.md'), '# notes\n');
    writeFileSync(path.join(root, 'README.md'), '# notes\n');
    mkdirSync(path.join(root, 'docs/product/prd'), { recursive: true });
    mkdirSync(path.join(root, 'docs/architecture/tech'), { recursive: true });
    writeFileSync(path.join(root, CANON_PATHS.prd), [
      '# Notes PRD',
      'Status: draft',
      'Owner: SDKWork maintainers',
      'Specs: REQUIREMENTS_SPEC.md',
      '',
      '## 1. Background And Problem',
      '',
      '## 2. Target Users',
      '',
    ].join('\n'));
    writeFileSync(path.join(root, CANON_PATHS.techArchitecture), [
      '# Notes Technical Architecture',
      'Status: draft',
      'Owner: SDKWork maintainers',
      'Specs: ARCHITECTURE_DECISION_SPEC.md',
      '',
      '## 1. Architecture Overview',
      '',
      '## 2. Technology Choices',
      '',
    ].join('\n'));
    writeFileSync(path.join(root, 'docs/README.md'), [
      '# Docs',
      '',
      '| Product PRD | [product/PRD.md](product/PRD.md) |',
      '',
    ].join('\n'));
    mkdirSync(path.join(root, 'docs/架构'), { recursive: true });
    writeFileSync(path.join(root, 'docs/架构/01-产品设计与需求范围.md'), '# Product\n\nReal product content with enough detail for migration.\n'.repeat(3));
    writeFileSync(path.join(root, 'docs/架构/02-架构标准与总体设计.md'), '# Architecture\n\nReal architecture content with enough detail for migration.\n'.repeat(3));

    const productShard = ingestLegacyDocAsShard(root, identity, 'docs/架构/01-产品设计与需求范围.md', 'product');
    const techShard = ingestLegacyDocAsShard(root, identity, 'docs/架构/02-架构标准与总体设计.md', 'architecture');
    assert.match(productShard, /PRD-/);
    assert.match(techShard, /TECH-/);

    updateCanonDocumentMaps(root, identity);
    archiveLegacyTrees(root);

    mkdirSync(path.join(root, 'docs/product'), { recursive: true });
    mkdirSync(path.join(root, 'docs/architecture'), { recursive: true });
    writeFileSync(path.join(root, 'docs/product/README.md'), '# Product\n');
    writeFileSync(path.join(root, 'docs/architecture/README.md'), '# Architecture\n');
    writeFileSync(path.join(root, 'docs/product/prd/README.md'), '# PRD\n');
    writeFileSync(path.join(root, 'docs/architecture/tech/README.md'), '# Tech\n');
    writeFileSync(path.join(root, 'docs/README.md'), [
      '# Docs',
      '',
      '- [product/prd/PRD.md](product/prd/PRD.md)',
      '- [architecture/tech/TECH_ARCHITECTURE.md](architecture/tech/TECH_ARCHITECTURE.md)',
      '',
    ].join('\n'));
    writeFileSync(path.join(root, 'AGENTS.md'), [
      '# notes',
      '',
      '- [docs/README.md](docs/README.md)',
      '- [docs/product/prd/PRD.md](docs/product/prd/PRD.md)',
      '- [docs/architecture/tech/TECH_ARCHITECTURE.md](docs/architecture/tech/TECH_ARCHITECTURE.md)',
      '',
    ].join('\n'));
    writeFileSync(path.join(root, 'README.md'), readFileSync(path.join(root, 'AGENTS.md'), 'utf8'));

    const validation = validateRepositoryDocsStandard(root, { profile: 'application' });
    assert.equal(validation.issues.length, 0);
    assert.match(readFileSync(path.join(root, CANON_PATHS.prd), 'utf8'), /Status: active/);
    assert.match(readFileSync(path.join(root, CANON_PATHS.prd), 'utf8'), /PRD-/);
    assert.equal(readFileSync(path.join(root, 'docs/README.md'), 'utf8').includes('product/PRD.md'), false);
  });

  it('runs end-to-end migration on a repository with numbered legacy docs', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'sdkwork-complete-docs-'));
    writeFileSync(path.join(root, 'AGENTS.md'), '# sdkwork-claw-router\n');
    writeFileSync(path.join(root, 'README.md'), '# claw-router\n');
    mkdirSync(path.join(root, 'docs/product/prd'), { recursive: true });
    mkdirSync(path.join(root, 'docs/architecture/tech'), { recursive: true });
    writeFileSync(path.join(root, CANON_PATHS.index), '# Docs\n');
    writeFileSync(path.join(root, CANON_PATHS.prd), [
      '# Claw Router PRD',
      'Status: draft',
      'Owner: SDKWork maintainers',
      'Specs: REQUIREMENTS_SPEC.md',
      '',
      '## 1. Background And Problem',
      '',
    ].join('\n'));
    writeFileSync(path.join(root, CANON_PATHS.techArchitecture), [
      '# Claw Router Technical Architecture',
      'Status: draft',
      'Owner: SDKWork maintainers',
      'Specs: ARCHITECTURE_DECISION_SPEC.md',
      '',
      '## 1. Architecture Overview',
      '',
      '## 2. Technology Choices',
      '',
    ].join('\n'));
    writeFileSync(path.join(root, 'docs/01-PRD-sdkwork-clawrouter.md'), '# PRD\n\nUnified AI API Router product scope.\n'.repeat(5));
    writeFileSync(path.join(root, 'docs/02-技术架构设计.md'), '# Architecture\n\nGateway and control-plane design.\n'.repeat(5));

    const result = completeRepositoryDocsMigration(root);
    assert.ok(result.ingested.length >= 2);
    assert.equal(result.validation.issues.length, 0);
    assert.ok(existsSync(path.join(root, 'docs/archive/migrated-legacy/numbered-docs/01-PRD-sdkwork-clawrouter.md')));
  });
});
