import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { bootstrapRepositoryDocs } from './bootstrap-repository-docs-lib.mjs';
import { CANON_PATHS } from './repository-docs-paths.mjs';
import { validateRepositoryDocsStandard } from './check-repository-docs-standard.mjs';

describe('bootstrap-repository-docs', () => {
  it('creates the standard docs skeleton', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'sdkwork-docs-bootstrap-'));
    const result = bootstrapRepositoryDocs(root, {
      applicationCode: 'example-app',
      owner: 'example-team',
      productName: 'Example App',
      updated: '2026-06-23',
    });

    assert.ok(result.created.includes(CANON_PATHS.prd));
    assert.ok(result.created.includes(CANON_PATHS.techArchitecture));
    assert.ok(result.created.includes('docs/README.md'));

    const prd = readFileSync(path.join(root, CANON_PATHS.prd), 'utf8');
    assert.match(prd, /Example App PRD/);
    assert.match(prd, /Application: example-app/);
    assert.match(prd, /Owner: example-team/);
  });

  it('does not overwrite existing Canon files by default', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'sdkwork-docs-bootstrap-'));
    bootstrapRepositoryDocs(root, { applicationCode: 'first' });
    const first = readFileSync(path.join(root, CANON_PATHS.prd), 'utf8');
    bootstrapRepositoryDocs(root, { applicationCode: 'second' });
    const second = readFileSync(path.join(root, CANON_PATHS.prd), 'utf8');
    assert.equal(first, second);
  });
});

describe('bootstrap plus validator integration', () => {
  it('reports missing AGENTS links after bootstrap only', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'sdkwork-docs-bootstrap-'));
    bootstrapRepositoryDocs(root, {
      applicationCode: 'example-app',
      owner: 'example-team',
      productName: 'Example App',
      updated: '2026-06-23',
    });
    const result = validateRepositoryDocsStandard(root, { profile: 'application' });
    assert.ok(result.issues.some((issue) => issue.includes('AGENTS.md')));
  });
});
