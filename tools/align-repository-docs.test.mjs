import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { alignRepositoryDocs, resolveRepositoryIdentity } from './align-repository-docs-lib.mjs';
import { CANON_PATHS } from './repository-docs-paths.mjs';

describe('align-repository-docs', () => {
  it('aligns a repository with stub Canon files and missing links', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'sdkwork-align-docs-'));
    const agents = [
      '# Repository Guidelines',
      '',
      '## Local Dictionary Structure',
      '',
      '- `docs/`: documentation',
      '',
      '## Spec Resolution Order',
      '',
      '1. Read AGENTS.md',
      '',
    ].join('\n');
    const readme = '# Example Repo\n';
    const prd = '# PRD\n\nReserved per SDKWORK_WORKSPACE_SPEC.md.\n';
    const tech = '# TECH_ARCHITECTURE\n\nReserved per SDKWORK_WORKSPACE_SPEC.md.\n';

    for (const [relativePath, content] of [
      ['AGENTS.md', agents],
      ['README.md', readme],
      ['docs/product/PRD.md', prd],
      ['docs/architecture/TECH_ARCHITECTURE.md', tech],
    ]) {
      const filePath = path.join(root, relativePath);
      mkdirSync(path.dirname(filePath), { recursive: true });
      writeFileSync(filePath, content);
    }

    const result = alignRepositoryDocs(root);
    assert.equal(result.validation.issues.length, 0);
    assert.match(readFileSync(path.join(root, 'AGENTS.md'), 'utf8'), /Documentation Canon/);
    assert.match(readFileSync(path.join(root, CANON_PATHS.prd), 'utf8'), /Status: draft/);
  });

  it('detects narrow-tool repositories without app manifests', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'sdkwork-align-docs-'));
    writeFileSync(path.join(root, 'AGENTS.md'), '# sdkwork-database\n');
    const identity = resolveRepositoryIdentity(path.join(root, '..', 'sdkwork-database'));
    if (identity.profile === 'narrow-tool') {
      assert.equal(identity.profile, 'narrow-tool');
      return;
    }
    const fakeDatabase = path.join(root, 'sdkwork-database');
    mkdirSync(fakeDatabase, { recursive: true });
    writeFileSync(path.join(fakeDatabase, 'AGENTS.md'), '# database\n');
    assert.equal(resolveRepositoryIdentity(fakeDatabase).profile, 'narrow-tool');
  });
});
