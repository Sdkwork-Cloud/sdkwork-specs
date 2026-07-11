import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  AGENTS_SECTION_BODY,
  classifyOpenApiEnvelope,
  classifyOpenApiWireProtocolMarkers,
  isExternalProtocolOpenApi,
  upsertAgentsEnvelopeSection,
  walkOpenApiFiles,
} from './lib/http-response-envelope-patterns.mjs';
import { migrateOpenApiDocument } from './lib/migrate-openapi-legacy-envelope.mjs';

const CHECKER = path.resolve(import.meta.dirname, 'check-api-response-envelope.mjs');

function standardComponents() {
  return {
    schemas: {
      SdkWorkApiResponse: {
        type: 'object',
        required: ['code', 'data', 'traceId'],
        properties: {
          code: { type: 'integer', format: 'int32' },
          data: { type: 'object' },
          traceId: { type: 'string' },
        },
      },
      ProblemDetail: {
        type: 'object',
        required: ['type', 'title', 'status', 'code', 'traceId'],
        properties: {
          type: { type: 'string' },
          title: { type: 'string' },
          status: { type: 'integer' },
          code: { type: 'integer', format: 'int32' },
          traceId: { type: 'string' },
        },
      },
      BareUser: {
        type: 'object',
        properties: { id: { type: 'string' } },
      },
    },
  };
}

test('classifyOpenApiEnvelope flags legacy AppbaseApiResult and requestId', () => {
  const text = `
components:
  schemas:
    AppbaseApiResult:
      type: object
      properties:
        requestId:
          type: string
  responses:
    default:
      content:
        application/problem+json:
          schema:
            $ref: '#/components/schemas/ProblemDetail'
`;
  const issues = classifyOpenApiEnvelope(text);
  assert.ok(issues.some((i) => i.kind === 'legacy-envelope'));
  assert.ok(issues.some((i) => i.kind === 'forbidden-request-id'));
});

test('classifyOpenApiEnvelope flags legacy string result codes', () => {
  const text = `
components:
  schemas:
    SdkWorkApiResponse:
      properties:
        code:
          type: string
          enum: [ok, created]
    ProblemDetail:
      type: object
paths:
  /app/v3/api/example:
    get:
      responses:
        default:
          content:
            application/problem+json:
              schema:
                $ref: '#/components/schemas/ProblemDetail'
`;
  const issues = classifyOpenApiEnvelope(text);
  assert.ok(issues.some((i) => i.kind === 'legacy-string-result-code'));
});

test('classifyOpenApiEnvelope accepts SdkWorkApiResponse contract', () => {
  const text = `
components:
  schemas:
    SdkWorkApiResponse:
      required: [code, data, traceId]
      properties:
        code:
          type: integer
          format: int32
        traceId:
          type: string
    ProblemDetail:
      type: object
paths:
  /app/v3/api/example:
    get:
      responses:
        default:
          content:
            application/problem+json:
              schema:
                $ref: '#/components/schemas/ProblemDetail'
`;
  const issues = classifyOpenApiEnvelope(text);
  assert.equal(issues.length, 0);
});

test('upsertAgentsEnvelopeSection inserts before Human Review Rules', () => {
  const input = '# Repository Guidelines\n\n## Human Review Rules\n\nReview required.\n';
  const output = upsertAgentsEnvelopeSection(input);
  assert.match(output, /## HTTP API Response Envelope/);
  assert.match(output, /SdkWorkApiResponse/);
  assert.match(output, /traceId/);
  assert.match(output, /wire field `requestId`/);
});

test('upsertAgentsEnvelopeSection replaces duplicate legacy envelope sections', () => {
  const input = `# Repository Guidelines

## SDKWORK Soul

Read SOUL.md.

## HTTP API Response Envelope

All L2+ contracts use the current section.

## HTTP API Response Envelope

All L2+ \`app-api\` success JSON bodies \`MUST\` use \`SdkWorkResponse\`.

- Envelope: \`{ "data": <payload>, "requestId": "<server-uuid>" }\`

## List And Search Pagination

Follow PAGINATION_SPEC.md.
`;

  const output = upsertAgentsEnvelopeSection(input);
  const sectionMatches = output.match(/^## HTTP API Response Envelope\b/gm) ?? [];

  assert.equal(sectionMatches.length, 1);
  assert.doesNotMatch(output, /success JSON bodies `MUST` use `SdkWorkResponse`/);
  assert.doesNotMatch(output, /Envelope: `\{ "data": <payload>, "requestId"/);
  assert.match(output, /## List And Search Pagination/);
});

test('AGENTS section references API_SPEC authority', () => {
  assert.match(AGENTS_SECTION_BODY, /API_SPEC\.md/);
  assert.match(AGENTS_SECTION_BODY, /SdkWorkApiResponse/);
  assert.match(AGENTS_SECTION_BODY, /section 4\.5/);
  assert.match(AGENTS_SECTION_BODY, /omitted `x-sdkwork-wire-protocol` means SDKWork-owned custom API/);
  assert.match(AGENTS_SECTION_BODY, /x-sdkwork-wire-protocol: external/);
  assert.match(AGENTS_SECTION_BODY, /check-api-operation-patterns\.mjs/);
  assert.match(AGENTS_SECTION_BODY, /create uses `201`/);
});

test('isExternalProtocolOpenApi detects vendor compatibility markers', () => {
  const text = `
info:
  x-sdkwork-wire-protocol: external
paths:
  /v1/chat/completions:
    post:
      x-sdkwork-wire-protocol: external
      x-sdkwork-external-protocol-id: openai-v1
`;
  assert.equal(isExternalProtocolOpenApi(text), true);
});

test('isExternalProtocolOpenApi rejects partial vendor markers', () => {
  const text = `
paths:
  /v1/chat/completions:
    post:
      x-sdkwork-wire-protocol: external
`;
  assert.equal(isExternalProtocolOpenApi(text), false);
});

test('classifyOpenApiWireProtocolMarkers flags incomplete vendor markers', () => {
  const text = `
paths:
  /v1/chat/completions:
    post:
      x-sdkwork-wire-protocol: external
`;
  const issues = classifyOpenApiWireProtocolMarkers(text);
  assert.ok(issues.some((i) => i.kind === 'incomplete-vendor-wire-protocol'));
});

test('omitted x-sdkwork-wire-protocol is treated as SDKWork-owned custom API', () => {
  const text = JSON.stringify({
    openapi: '3.1.2',
    info: { title: 'custom', version: '1.0.0' },
    paths: {
      '/im/v3/api/messages': {
        get: {
          operationId: 'messages.list',
          responses: { 200: { description: 'Bare SDKWork-owned response' } },
        },
      },
    },
  });

  assert.equal(isExternalProtocolOpenApi(text), false);
  const markerIssues = classifyOpenApiWireProtocolMarkers(text);
  assert.equal(markerIssues.length, 0);
  const envelopeIssues = classifyOpenApiEnvelope(text);
  assert.ok(envelopeIssues.some((i) => i.kind === 'missing-sdkwork-api-response'));
});

test('classifyOpenApiWireProtocolMarkers requires operation-level external protocol ids', () => {
  const text = JSON.stringify({
    openapi: '3.1.2',
    info: {
      title: 'mixed',
      version: '1.0.0',
      'x-sdkwork-wire-protocol': 'external',
      'x-sdkwork-external-protocol-id': 'openai-v1',
    },
    paths: {
      '/v1/chat/completions': {
        post: {
          operationId: 'chatCompletionsCreate',
          'x-sdkwork-wire-protocol': 'external',
          responses: { 200: { description: 'OpenAI response' } },
        },
      },
    },
  });
  const issues = classifyOpenApiWireProtocolMarkers(text);
  assert.ok(issues.some((i) => i.kind === 'incomplete-vendor-wire-protocol'));
});

test('isExternalProtocolOpenApi rejects mixed external and SDKWork-owned documents', () => {
  const text = JSON.stringify({
    openapi: '3.1.2',
    info: {
      title: 'mixed',
      version: '1.0.0',
      'x-sdkwork-wire-protocol': 'external',
      'x-sdkwork-external-protocol-id': 'openai-v1',
    },
    paths: {
      '/v1/chat/completions': {
        post: {
          operationId: 'chatCompletionsCreate',
          'x-sdkwork-wire-protocol': 'external',
          'x-sdkwork-external-protocol-id': 'openai-v1',
          responses: { 200: { description: 'OpenAI response' } },
        },
      },
      '/im/v3/api/messages': {
        get: {
          operationId: 'messages.list',
          responses: { 200: { description: 'Bare SDKWork-owned response' } },
        },
      },
    },
  });
  assert.equal(isExternalProtocolOpenApi(text), false);
});

test('walkOpenApiFiles includes SDK open-sdk authority OpenAPI files', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-envelope-walk-'));
  const authority = path.join(
    root,
    'sdks',
    'clawrouter-open-sdk',
    'openapi',
    'clawrouter-open-sdk.openapi.json',
  );
  fs.mkdirSync(path.dirname(authority), { recursive: true });
  fs.writeFileSync(authority, '{}\n', 'utf8');

  const files = walkOpenApiFiles(root).map((file) => file.replace(/\\/g, '/'));
  assert.ok(files.some((file) => file.endsWith('/sdks/clawrouter-open-sdk/openapi/clawrouter-open-sdk.openapi.json')));
});

test('walkOpenApiFiles ignores generated nested SDK OpenAPI snapshots', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-envelope-generated-walk-'));
  const generatedSnapshot = path.join(
    root,
    'apps',
    'example',
    'generated',
    'sdks',
    'file-app-sdk',
    'openapi',
    'file-app-sdk.openapi.json',
  );
  fs.mkdirSync(path.dirname(generatedSnapshot), { recursive: true });
  fs.writeFileSync(generatedSnapshot, '{}\n', 'utf8');

  const files = walkOpenApiFiles(root).map((file) => file.replace(/\\/g, '/'));
  assert.ok(!files.some((file) => file.endsWith('/generated/sdks/file-app-sdk/openapi/file-app-sdk.openapi.json')));
});

test('walkOpenApiFiles ignores runtime and cargo target directory variants', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-envelope-runtime-walk-'));
  for (const ignoredDir of ['.runtime', 'target-codex-verify']) {
    const authority = path.join(
      root,
      ignoredDir,
      'sdks',
      'sdkwork-demo-app-sdk',
      'openapi',
      'demo-app-api.openapi.json',
    );
    fs.mkdirSync(path.dirname(authority), { recursive: true });
    fs.writeFileSync(authority, '{}\n', 'utf8');
  }

  const files = walkOpenApiFiles(root);

  assert.deepEqual(files, []);
});

test('checker does not exempt SDKWork-owned operations in mixed external OpenAPI documents', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-envelope-mixed-'));
  const authority = path.join(root, 'apis', 'open-api', 'mixed', 'openapi.json');
  fs.mkdirSync(path.dirname(authority), { recursive: true });
  fs.writeFileSync(
    authority,
    `${JSON.stringify(
      {
        openapi: '3.1.2',
        info: {
          title: 'mixed',
          version: '1.0.0',
          'x-sdkwork-wire-protocol': 'external',
          'x-sdkwork-external-protocol-id': 'openai-v1',
        },
        paths: {
          '/v1/chat/completions': {
            post: {
              operationId: 'chatCompletionsCreate',
              'x-sdkwork-wire-protocol': 'external',
              'x-sdkwork-external-protocol-id': 'openai-v1',
              responses: { 200: { description: 'OpenAI response' } },
            },
          },
          '/im/v3/api/messages': {
            get: {
              operationId: 'messages.list',
              responses: { 200: { description: 'Bare SDKWork-owned response' } },
            },
          },
        },
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  const result = spawnSync(process.execPath, [CHECKER, '--root', root], {
    encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /missing-sdkwork-api-response/);
});

test('checker reports incomplete vendor markers without a ReferenceError', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-envelope-incomplete-'));
  const authority = path.join(root, 'apis', 'open-api', 'mixed', 'openapi.json');
  fs.mkdirSync(path.dirname(authority), { recursive: true });
  fs.writeFileSync(
    authority,
    `${JSON.stringify(
      {
        openapi: '3.1.2',
        info: { title: 'incomplete', version: '1.0.0' },
        paths: {
          '/v1/chat/completions': {
            post: {
              operationId: 'chatCompletionsCreate',
              'x-sdkwork-wire-protocol': 'external',
              responses: { 200: { description: 'OpenAI response' } },
            },
          },
        },
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  const result = spawnSync(process.execPath, [CHECKER, '--root', root], {
    encoding: 'utf8',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /incomplete-vendor-wire-protocol/);
  assert.doesNotMatch(result.stderr, /ReferenceError/);
});

test('classifyOpenApiEnvelope validates SDKWork-owned JSON responses per operation', () => {
  const text = JSON.stringify(
    {
      openapi: '3.1.2',
      info: { title: 'mixed custom', version: '1.0.0' },
      paths: {
        '/app/v3/api/good-users': {
          get: {
            operationId: 'goodUsers.list',
            responses: {
              200: {
                description: 'standard envelope',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/SdkWorkApiResponse' },
                  },
                },
              },
              default: {
                description: 'problem',
                content: {
                  'application/problem+json': {
                    schema: { $ref: '#/components/schemas/ProblemDetail' },
                  },
                },
              },
            },
          },
        },
        '/app/v3/api/bad-users': {
          get: {
            operationId: 'badUsers.list',
            responses: {
              200: {
                description: 'bare DTO',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/BareUser' },
                  },
                },
              },
              default: {
                description: 'problem',
                content: {
                  'application/problem+json': {
                    schema: { $ref: '#/components/schemas/ProblemDetail' },
                  },
                },
              },
            },
          },
        },
      },
      components: standardComponents(),
    },
    null,
    2,
  );

  const issues = classifyOpenApiEnvelope(text);
  assert.ok(issues.some((issue) => issue.kind === 'missing-sdkwork-api-response'));
  assert.ok(issues.some((issue) => /GET \/app\/v3\/api\/bad-users/.test(issue.detail)));
});

test('checker validates mixed YAML external and SDKWork-owned open-api operations per operation', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-envelope-yaml-mixed-'));
  const authority = path.join(root, 'apis', 'open-api', 'mixed', 'openapi.yaml');
  fs.mkdirSync(path.dirname(authority), { recursive: true });
  fs.writeFileSync(
    authority,
    `
openapi: 3.1.2
info:
  title: mixed yaml
  version: 1.0.0
paths:
  /v1/chat/completions:
    post:
      operationId: chatCompletionsCreate
      x-sdkwork-wire-protocol: external
      x-sdkwork-external-protocol-id: openai-v1
      responses:
        '200':
          description: OpenAI response
  /im/v3/open/messages:
    get:
      operationId: messages.list
      responses:
        '200':
          description: bare custom response
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/BareUser'
        default:
          description: problem
          content:
            application/problem+json:
              schema:
                $ref: '#/components/schemas/ProblemDetail'
components:
  schemas:
    SdkWorkApiResponse:
      type: object
    ProblemDetail:
      type: object
    BareUser:
      type: object
`,
    'utf8',
  );

  const result = spawnSync(process.execPath, [CHECKER, '--root', root], {
    encoding: 'utf8',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /missing-sdkwork-api-response/);
  assert.match(result.stderr, /GET \/im\/v3\/open\/messages/);
});

test('classifyOpenApiEnvelope accepts YAML SDKWork-owned responses with SdkWorkApiResponse schema refs', () => {
  const issues = classifyOpenApiEnvelope(`
openapi: 3.1.2
paths:
  /app/v3/api/users:
    get:
      operationId: users.list
      responses:
        '200':
          description: standard custom response
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SdkWorkApiResponse'
        default:
          description: problem
          content:
            application/problem+json:
              schema:
                $ref: '#/components/schemas/ProblemDetail'
components:
  schemas:
    SdkWorkApiResponse:
      type: object
    ProblemDetail:
      type: object
`);

  assert.deepEqual(issues, []);
});

test('classifyOpenApiEnvelope accepts YAML allOf extensions of SdkWorkApiResponse', () => {
  const issues = classifyOpenApiEnvelope(`
openapi: 3.1.2
paths:
  /app/v3/api/users/{userId}:
    get:
      operationId: users.retrieve
      responses:
        '200':
          description: standard typed resource response
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/SdkWorkApiResponse'
                  - type: object
                    required:
                      - data
                    properties:
                      data:
                        type: object
                        required:
                          - item
                        properties:
                          item:
                            $ref: '#/components/schemas/User'
        default:
          description: problem
          content:
            application/problem+json:
              schema:
                $ref: '#/components/schemas/ProblemDetail'
components:
  schemas:
    SdkWorkApiResponse:
      type: object
    ProblemDetail:
      type: object
    User:
      type: object
`);

  assert.deepEqual(issues, []);
});

test('classifyOpenApiEnvelope accepts YAML response refs to allOf SdkWorkApiResponse components', () => {
  const issues = classifyOpenApiEnvelope(`
openapi: 3.1.2
paths:
  /app/v3/api/users:
    get:
      operationId: users.list
      responses:
        '200':
          description: standard typed list response
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserListResponse'
        default:
          description: problem
          content:
            application/problem+json:
              schema:
                $ref: '#/components/schemas/ProblemDetail'
components:
  schemas:
    SdkWorkApiResponse:
      type: object
    ProblemDetail:
      type: object
    User:
      type: object
    UserListResponse:
      allOf:
        - $ref: '#/components/schemas/SdkWorkApiResponse'
        - type: object
          required:
            - data
          properties:
            data:
              type: object
              required:
                - items
                - pageInfo
              properties:
                items:
                  type: array
                  items:
                    $ref: '#/components/schemas/User'
                pageInfo:
                  $ref: '#/components/schemas/PageInfo'
    PageInfo:
      type: object
`);

  assert.deepEqual(issues, []);
});

test('migrateOpenApiDocument does not double wrap SdkWorkApiResponse result refs', () => {
  const document = {
    openapi: '3.1.2',
    paths: {
      '/backend/v3/api/system/analytics/admin/overview': {
        get: {
          operationId: 'analytics.admin.overview.retrieve',
          responses: {
            200: {
              description: 'OK',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/AnalyticsAdminOverviewRetrieveResult' },
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        SdkWorkApiResponse: {
          type: 'object',
          required: ['code', 'data', 'traceId'],
          properties: {
            code: { type: 'integer', format: 'int32' },
            data: true,
            traceId: { type: 'string' },
          },
        },
        AnalyticsAdminOverview: {
          type: 'object',
          additionalProperties: false,
          properties: {
            rankingSize: { type: 'integer' },
          },
        },
        AnalyticsAdminOverviewRetrieveResult: {
          allOf: [
            { $ref: '#/components/schemas/SdkWorkApiResponse' },
            {
              type: 'object',
              additionalProperties: false,
              required: ['data'],
              properties: {
                data: { $ref: '#/components/schemas/AnalyticsAdminOverview' },
              },
            },
          ],
        },
      },
    },
  };

  const migrated = migrateOpenApiDocument(document);
  const responseSchema =
    migrated.paths['/backend/v3/api/system/analytics/admin/overview'].get.responses[200].content[
      'application/json'
    ].schema;

  assert.deepEqual(responseSchema, {
    $ref: '#/components/schemas/AnalyticsAdminOverviewRetrieveResult',
  });
});

test('checker scans every same-surface OpenAPI authority for envelope violations', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-envelope-authorities-'));
  const goodAuthority = path.join(root, 'apis', 'app-api', 'aaa-good', 'openapi.json');
  const badAuthority = path.join(root, 'apis', 'app-api', 'zzz-bad', 'openapi.json');
  fs.mkdirSync(path.dirname(goodAuthority), { recursive: true });
  fs.mkdirSync(path.dirname(badAuthority), { recursive: true });
  const goodDocument = {
    openapi: '3.1.2',
    info: { title: 'good', version: '1.0.0' },
    paths: {
      '/app/v3/api/good-users': {
        get: {
          operationId: 'goodUsers.list',
          responses: {
            200: {
              description: 'standard envelope',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SdkWorkApiResponse' },
                },
              },
            },
            default: {
              description: 'problem',
              content: {
                'application/problem+json': {
                  schema: { $ref: '#/components/schemas/ProblemDetail' },
                },
              },
            },
          },
        },
      },
    },
    components: standardComponents(),
  };
  const badDocument = {
    ...goodDocument,
    info: { title: 'bad', version: '1.0.0' },
    paths: {
      '/app/v3/api/bad-users': {
        get: {
          operationId: 'badUsers.list',
          responses: {
            200: {
              description: 'bare DTO',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/BareUser' },
                },
              },
            },
            default: {
              description: 'problem',
              content: {
                'application/problem+json': {
                  schema: { $ref: '#/components/schemas/ProblemDetail' },
                },
              },
            },
          },
        },
      },
    },
  };
  fs.writeFileSync(goodAuthority, `${JSON.stringify(goodDocument, null, 2)}\n`, 'utf8');
  fs.writeFileSync(badAuthority, `${JSON.stringify(badDocument, null, 2)}\n`, 'utf8');

  const result = spawnSync(process.execPath, [CHECKER, '--root', root], {
    encoding: 'utf8',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /zzz-bad/);
  assert.match(result.stderr, /missing-sdkwork-api-response/);
});
