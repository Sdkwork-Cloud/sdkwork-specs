import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { validateRepositoryDocsStandard } from './check-repository-docs-standard.mjs';
import { CANON_PATHS } from './repository-docs-paths.mjs';

function write(root, relativePath, text) {
  const filePath = path.join(root, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, text);
}

function makeCanonDocs(root, options = {}) {
  const prdBody = options.prdBody || `# Example PRD

Status: active
Owner: example-team
Application: example
Updated: 2026-06-23
Specs: REQUIREMENTS_SPEC.md, DOCUMENTATION_SPEC.md

## 1. Background And Problem
Example problem.

## 2. Goals And Scope
Deliver example capability.
`;

  const techBody = options.techBody || `# Example Technical Architecture

Status: active
Owner: example-team
Updated: 2026-06-23
Specs: ARCHITECTURE_DECISION_SPEC.md, DOCUMENTATION_SPEC.md

## 1. Architecture Overview
Example overview.

## 2. Technology Choices
TypeScript and PostgreSQL.
`;

  write(root, 'docs/README.md', [
    '# Docs',
    '',
    '| Audience | Entry |',
    '| --- | --- |',
    `| Product | [PRD](product/prd/PRD.md) |`,
    `| Architecture | [TECH_ARCHITECTURE](architecture/tech/TECH_ARCHITECTURE.md) |`,
    '',
    `- [${CANON_PATHS.prd}](product/prd/PRD.md)`,
    `- [${CANON_PATHS.techArchitecture}](architecture/tech/TECH_ARCHITECTURE.md)`,
  ].join('\n'));
  write(root, 'docs/product/README.md', '# Product Docs\n');
  write(root, 'docs/architecture/README.md', '# Architecture Docs\n');
  write(root, CANON_PATHS.prdDirReadme, '# PRD Directory\n');
  write(root, CANON_PATHS.techDirReadme, '# Tech Directory\n');
  write(root, CANON_PATHS.prd, prdBody);
  write(root, CANON_PATHS.techArchitecture, techBody);
  write(root, 'AGENTS.md', [
    '# Repository Guidelines',
    '',
    'Read `../sdkwork-specs/SOUL.md`.',
    '',
    `- [${CANON_PATHS.index}](docs/README.md)`,
    `- [${CANON_PATHS.prd}](docs/product/prd/PRD.md)`,
    `- [${CANON_PATHS.techArchitecture}](docs/architecture/tech/TECH_ARCHITECTURE.md)`,
  ].join('\n'));
  write(root, 'README.md', [
    '# Example',
    '',
    `- [${CANON_PATHS.index}](docs/README.md)`,
    `- [${CANON_PATHS.prd}](docs/product/prd/PRD.md)`,
    `- [${CANON_PATHS.techArchitecture}](docs/architecture/tech/TECH_ARCHITECTURE.md)`,
  ].join('\n'));
}

describe('check-repository-docs-standard', () => {
  it('accepts a compliant application repository', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'sdkwork-docs-standard-'));
    makeCanonDocs(root);
    const result = validateRepositoryDocsStandard(root, { profile: 'application' });
    assert.deepEqual(result.issues, []);
  });

  it('fails when Canon PRD is missing', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'sdkwork-docs-standard-'));
    makeCanonDocs(root);
    write(root, CANON_PATHS.prd, '');
    const result = validateRepositoryDocsStandard(root, { profile: 'application' });
    assert.ok(result.issues.some((issue) => issue.includes(CANON_PATHS.prd)));
  });

  it('accepts a standards repository governance PRD', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'sdkwork-docs-standard-'));
    makeCanonDocs(root, {
      prdBody: `# SDKWork Standards PRD

Status: active
Owner: standards-team
Updated: 2026-06-23
Specs: REQUIREMENTS_SPEC.md, DOCUMENTATION_SPEC.md, GOVERNANCE_SPEC.md

## 1. Background And Problem
sdkwork-specs must remain the canonical standards entrypoint for SDKWork repositories.

## 2. Goals And Scope
Govern standards evolution and repository documentation alignment.
`,
    });
    write(root, 'AGENTS.md', [
      '# Repository Guidelines',
      '',
      'This repository is a standards repository.',
      '',
      `- [${CANON_PATHS.index}](docs/README.md)`,
      `- [${CANON_PATHS.prd}](docs/product/prd/PRD.md)`,
      `- [${CANON_PATHS.techArchitecture}](docs/architecture/tech/TECH_ARCHITECTURE.md)`,
    ].join('\n'));
    const result = validateRepositoryDocsStandard(root, { profile: 'standards' });
    assert.deepEqual(result.issues, []);
  });

  it('accepts docs-relative Canon links in docs/README.md', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'sdkwork-docs-standard-'));
    makeCanonDocs(root);
    write(root, 'docs/README.md', [
      '# Docs',
      '',
      '- [PRD](product/prd/PRD.md)',
      '- [TECH_ARCHITECTURE](architecture/tech/TECH_ARCHITECTURE.md)',
    ].join('\n'));
    const result = validateRepositoryDocsStandard(root, { profile: 'application' });
    assert.deepEqual(result.issues, []);
  });

  it('flags retired docs/adr layout when ADR files remain', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'sdkwork-docs-standard-'));
    makeCanonDocs(root);
    write(root, 'docs/adr/ADR-20260101-old-layout.md', '# Old ADR\n');
    const result = validateRepositoryDocsStandard(root, { profile: 'application' });
    assert.ok(result.issues.some((issue) => issue.includes('docs/adr/')));
  });

  it('requires PRD shards to be linked from PRD.md', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'sdkwork-docs-standard-'));
    makeCanonDocs(root);
    write(root, 'docs/product/prd/PRD-scope.md', '# Scope shard\n');
    const result = validateRepositoryDocsStandard(root, { profile: 'application' });
    assert.ok(result.issues.some((issue) => issue.includes('PRD-scope.md')));
  });
});
