import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { classifyOpenApiOperationPatterns } from './lib/api-operation-patterns.mjs';

const CHECKER = path.resolve(import.meta.dirname, 'check-api-operation-patterns.mjs');

function openApi(paths) {
  return JSON.stringify(
    {
      openapi: '3.1.2',
      info: { title: 'operation patterns', version: '1.0.0' },
      paths,
      components: {
        schemas: {
          SdkWorkApiResponse: { type: 'object' },
          SdkWorkPageData: { type: 'object' },
          ProblemDetail: { type: 'object' },
        },
      },
    },
    null,
    2,
  );
}

test('classifyOpenApiOperationPatterns flags create operations that do not return 201', () => {
  const issues = classifyOpenApiOperationPatterns(
    openApi({
      '/app/v3/api/users': {
        post: {
          operationId: 'users.create',
          responses: {
            200: { description: 'wrong create status' },
            default: { description: 'problem' },
          },
        },
      },
    }),
  );

  assert.ok(issues.some((issue) => issue.kind === 'create-status'));
});

test('classifyOpenApiOperationPatterns flags delete operations that return JSON success bodies', () => {
  const issues = classifyOpenApiOperationPatterns(
    openApi({
      '/app/v3/api/users/{userId}': {
        delete: {
          operationId: 'users.delete',
          responses: {
            200: {
              description: 'wrong delete body',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SdkWorkApiResponse' },
                },
              },
            },
            default: { description: 'problem' },
          },
        },
      },
    }),
  );

  assert.ok(issues.some((issue) => issue.kind === 'delete-status'));
});

test('classifyOpenApiOperationPatterns flags search operationId drift', () => {
  const issues = classifyOpenApiOperationPatterns(
    openApi({
      '/app/v3/api/users/search': {
        post: {
          operationId: 'users.list',
          responses: {
            200: { description: 'search response' },
            default: { description: 'problem' },
          },
        },
      },
    }),
  );

  assert.ok(issues.some((issue) => issue.kind === 'operation-id-action'));
});

test('classifyOpenApiOperationPatterns rejects operationIds that repeat the SDK tag namespace', () => {
  const issues = classifyOpenApiOperationPatterns(
    openApi({
      '/app/v3/api/catalog/products': {
        get: {
          tags: ['catalog'],
          operationId: 'catalog.products.list',
          responses: {
            200: { description: 'catalog products' },
            default: { description: 'problem' },
          },
        },
      },
    }),
  );

  assert.ok(issues.some((issue) => issue.kind === 'operation-id-tag-duplication'));
  assert.ok(issues.some((issue) => issue.detail.includes('must not repeat tag catalog')));
});

test('classifyOpenApiOperationPatterns skips external compatibility operations', () => {
  const issues = classifyOpenApiOperationPatterns(
    openApi({
      '/v1/chat/completions': {
        post: {
          operationId: 'chatCompletionsCreate',
          'x-sdkwork-wire-protocol': 'external',
          'x-sdkwork-external-protocol-id': 'openai-v1',
          responses: {
            200: { description: 'OpenAI response' },
          },
        },
      },
    }),
  );

  assert.equal(issues.length, 0);
});

test('classifyOpenApiOperationPatterns accepts singleton retrieve GET operations without path parameters', () => {
  const issues = classifyOpenApiOperationPatterns(
    openApi({
      '/app/v3/api/auth/sessions/current': {
        get: {
          operationId: 'sessions.current.retrieve',
          responses: {
            200: { description: 'current session' },
            default: { description: 'problem' },
          },
        },
      },
    }),
  );

  assert.equal(issues.length, 0);
});

test('classifyOpenApiOperationPatterns requires singleton summary GET operations to use retrieve', () => {
  const issues = classifyOpenApiOperationPatterns(
    openApi({
      '/app/v3/api/comments/threads/{threadId}/summary': {
        get: {
          operationId: 'comments.threads.summary',
          responses: {
            200: { description: 'thread summary' },
            default: { description: 'problem' },
          },
        },
      },
    }),
  );

  assert.ok(issues.some((issue) => issue.detail.includes('operationId action retrieve')));
});

test('classifyOpenApiOperationPatterns accepts explicit nested list GET operations ending in a parameter', () => {
  const issues = classifyOpenApiOperationPatterns(
    openApi({
      '/app/v3/api/music/charts/{chartId}': {
        get: {
          operationId: 'charts.entries.list',
          responses: {
            200: { description: 'chart entries' },
            default: { description: 'problem' },
          },
        },
      },
    }),
  );

  assert.equal(issues.length, 0);
});

test('classifyOpenApiOperationPatterns accepts redirect-only callback operations', () => {
  const issues = classifyOpenApiOperationPatterns(
    openApi({
      '/app/v3/api/github/integration/oauth/callback': {
        get: {
          operationId: 'integration.oauth.callback',
          responses: {
            302: { description: 'redirect' },
            default: { description: 'problem' },
          },
        },
      },
    }),
  );

  assert.equal(issues.length, 0);
});

test('classifyOpenApiOperationPatterns accepts SSE operations with the stream action', () => {
  const issues = classifyOpenApiOperationPatterns(
    openApi({
      '/app/v3/api/device/terminal/sessions/{sessionId}/events': {
        get: {
          operationId: 'device.terminal.sessions.events.stream',
          responses: {
            200: {
              description: 'event stream',
              content: { 'text/event-stream': { schema: { type: 'string' } } },
            },
            default: { description: 'problem' },
          },
        },
      },
    }),
  );

  assert.equal(issues.length, 0);
});

test('classifyOpenApiOperationPatterns recognizes snake-case command suffixes', () => {
  const issues = classifyOpenApiOperationPatterns(
    openApi({
      '/backend/v3/api/ai/route_explain': {
        post: {
          operationId: 'routeExplain.explain',
          responses: {
            200: { description: 'route explanation' },
            default: { description: 'problem' },
          },
        },
      },
    }),
  );

  assert.equal(issues.length, 0);
});

test('classifyOpenApiOperationPatterns accepts nested collection create operations', () => {
  const issues = classifyOpenApiOperationPatterns(
    openApi({
      '/backend/v3/api/iam/organizations/{organizationId}/members': {
        post: {
          operationId: 'organizations.members.create',
          responses: {
            201: { description: 'created member' },
            default: { description: 'problem' },
          },
        },
      },
    }),
  );

  assert.equal(issues.length, 0);
});

test('classifyOpenApiOperationPatterns accepts resource command operations with stable verbs', () => {
  const issues = classifyOpenApiOperationPatterns(
    openApi({
      '/backend/v3/api/iam/users/{userId}/restore': {
        post: {
          operationId: 'users.restore',
          responses: {
            200: { description: 'restored user' },
            default: { description: 'problem' },
          },
        },
      },
    }),
  );

  assert.equal(issues.length, 0);
});

test('classifyOpenApiOperationPatterns accepts domain-specific command verbs', () => {
  const issues = classifyOpenApiOperationPatterns(
    openApi({
      '/im/v3/api/chat/messages/{messageId}/unpin': {
        post: {
          operationId: 'messages.unpin',
          responses: {
            200: { description: 'unpinned message' },
            default: { description: 'problem' },
          },
        },
      },
    }),
  );

  assert.equal(issues.length, 0);
});

test('classifyOpenApiOperationPatterns reports domain-specific command operationId drift with the path action', () => {
  const issues = classifyOpenApiOperationPatterns(
    openApi({
      '/im/v3/api/chat/messages/{messageId}/unpin': {
        post: {
          operationId: 'messages.pin.delete',
          responses: {
            200: { description: 'unpinned message' },
            default: { description: 'problem' },
          },
        },
      },
    }),
  );

  assert.ok(issues.some((issue) => issue.detail.includes('operationId action unpin')));
});

test('classifyOpenApiOperationPatterns accepts collection command operations with stable verbs', () => {
  const issues = classifyOpenApiOperationPatterns(
    openApi({
      '/app/v3/api/messaging/verification_codes/verify': {
        post: {
          operationId: 'verificationCodes.verify',
          responses: {
            200: { description: 'verified code' },
            default: { description: 'problem' },
          },
        },
      },
    }),
  );

  assert.equal(issues.length, 0);
});

test('classifyOpenApiOperationPatterns flags YAML create status drift', () => {
  const issues = classifyOpenApiOperationPatterns(`
openapi: 3.1.2
paths:
  /app/v3/api/users:
    post:
      operationId: users.create
      responses:
        '200':
          description: wrong create status
        default:
          description: problem
`);

  assert.ok(issues.some((issue) => issue.kind === 'create-status'));
});

test('classifyOpenApiOperationPatterns flags YAML colon bulk path operationId drift', () => {
  const issues = classifyOpenApiOperationPatterns(`
openapi: 3.1.2
paths:
  /app/v3/api/users:bulkCreate:
    post:
      operationId: users.create
      responses:
        '200':
          description: wrong bulk action
        default:
          description: problem
`);

  assert.ok(issues.some((issue) => issue.kind === 'operation-id-action'));
});

test('classifyOpenApiOperationPatterns flags quoted YAML colon search path operationId drift', () => {
  const issues = classifyOpenApiOperationPatterns(`
openapi: 3.1.2
paths:
  "/app/v3/api/users:search":
    post:
      operationId: users.list
      responses:
        '200':
          description: wrong search action
        default:
          description: problem
`);

  assert.ok(issues.some((issue) => issue.kind === 'operation-id-action'));
});

test('checker reports operation-pattern violations for repo OpenAPI authorities', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-operation-patterns-'));
  const authority = path.join(root, 'apis', 'app-api', 'iam', 'openapi.json');
  fs.mkdirSync(path.dirname(authority), { recursive: true });
  fs.writeFileSync(
    authority,
    `${openApi({
      '/app/v3/api/users': {
        post: {
          operationId: 'users.create',
          responses: {
            200: { description: 'wrong create status' },
            default: { description: 'problem' },
          },
        },
      },
    })}\n`,
    'utf8',
  );

  const result = spawnSync(process.execPath, [CHECKER, '--root', root], {
    encoding: 'utf8',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /create-status/);
});

test('checker scans every same-surface OpenAPI authority instead of one preferred file', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-operation-patterns-authorities-'));
  const goodAuthority = path.join(root, 'apis', 'app-api', 'aaa-good', 'openapi.json');
  const badAuthority = path.join(root, 'apis', 'app-api', 'zzz-bad', 'openapi.json');
  fs.mkdirSync(path.dirname(goodAuthority), { recursive: true });
  fs.mkdirSync(path.dirname(badAuthority), { recursive: true });
  fs.writeFileSync(
    goodAuthority,
    `${openApi({
      '/app/v3/api/good-users': {
        post: {
          operationId: 'users.create',
          responses: {
            201: { description: 'created' },
            default: { description: 'problem' },
          },
        },
      },
    })}\n`,
    'utf8',
  );
  fs.writeFileSync(
    badAuthority,
    `${openApi({
      '/app/v3/api/bad-users': {
        post: {
          operationId: 'users.create',
          responses: {
            200: { description: 'wrong create status' },
            default: { description: 'problem' },
          },
        },
      },
    })}\n`,
    'utf8',
  );

  const result = spawnSync(process.execPath, [CHECKER, '--root', root], {
    encoding: 'utf8',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /zzz-bad/);
  assert.match(result.stderr, /create-status/);
});
