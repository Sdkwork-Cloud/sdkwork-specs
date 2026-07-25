import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeApiRoutePath,
  validateApiRuntimeParityEvidence,
} from './lib/api-runtime-parity.mjs';

const entry = Object.freeze({
  surface: 'app-api',
  method: 'POST',
  normalizedPath: '/app/v3/api/oauth/device_authorizations/{deviceAuthorizationId}',
  operationId: 'oauth.deviceAuthorizations.create',
  authProfile: 'credential-entry-bootstrap',
});

function evidence(overrides = {}) {
  return {
    schemaVersion: 1,
    kind: 'sdkwork.api-runtime-parity-evidence',
    application: 'sdkwork-test',
    profile: 'standalone',
    apiMode: 'served',
    sources: {
      executableRouter: { kind: 'runtime-probe', location: 'http://127.0.0.1/routes' },
      boundManifest: { kind: 'framework-bound-manifest', location: 'runtime:manifest' },
      servedOpenapi: { kind: 'runtime-http-openapi', location: 'http://127.0.0.1/openapi.json' },
      sdkAuthority: { kind: 'sdk-generation-authority', location: 'apis/app-api/openapi.json' },
    },
    inventories: {
      executableRouter: [{ ...entry }],
      boundManifest: [{ ...entry }],
      servedOpenapi: [{ ...entry }],
      sdkAuthority: [{ ...entry }],
    },
    ...overrides,
  };
}

test('accepts exact four-way runtime parity evidence', () => {
  assert.deepEqual(validateApiRuntimeParityEvidence(evidence()), []);
});

test('normalizes Axum-style path parameters without erasing names', () => {
  assert.equal(
    normalizeApiRoutePath('app/v3/api/users/:userId/'),
    '/app/v3/api/users/{userId}',
  );
  const candidate = evidence();
  candidate.inventories.executableRouter[0].normalizedPath =
    '/app/v3/api/oauth/device_authorizations/:deviceAuthorizationId';
  assert.deepEqual(validateApiRuntimeParityEvidence(candidate), []);
});

test('reports a missing served OpenAPI operation', () => {
  const candidate = evidence();
  candidate.inventories.servedOpenapi = [];
  assert.ok(validateApiRuntimeParityEvidence(candidate).some((issue) => (
    issue.includes('servedOpenapi is missing route')
  )));
});

test('reports an extra SDK authority operation', () => {
  const candidate = evidence();
  candidate.inventories.sdkAuthority.push({
    ...entry,
    method: 'GET',
    operationId: 'oauth.deviceAuthorizations.retrieve',
  });
  assert.ok(validateApiRuntimeParityEvidence(candidate).some((issue) => (
    issue.includes('sdkAuthority has extra route')
  )));
});

test('reports operationId and auth profile mismatches', () => {
  const candidate = evidence();
  candidate.inventories.boundManifest[0].operationId = 'wrong.operation';
  candidate.inventories.sdkAuthority[0].authProfile = 'anonymous';
  const issues = validateApiRuntimeParityEvidence(candidate);
  assert.ok(issues.some((issue) => issue.includes('operationId mismatch')));
  assert.ok(issues.some((issue) => issue.includes('authProfile mismatch')));
});

test('rejects duplicate normalized routes', () => {
  const candidate = evidence();
  candidate.inventories.executableRouter.push({
    ...entry,
    normalizedPath: '/app/v3/api/oauth/device_authorizations/:deviceAuthorizationId',
  });
  assert.ok(validateApiRuntimeParityEvidence(candidate).some((issue) => (
    issue.includes('contains duplicate route')
  )));
});

test('rejects static files masquerading as served runtime evidence', () => {
  const candidate = evidence();
  candidate.sources.servedOpenapi.kind = 'sdk-generation-authority';
  assert.ok(validateApiRuntimeParityEvidence(candidate).some((issue) => (
    issue.includes('sources.servedOpenapi.kind')
  )));
});
