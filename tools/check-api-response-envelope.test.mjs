import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AGENTS_SECTION_BODY,
  classifyOpenApiEnvelope,
  classifyOpenApiWireProtocolMarkers,
  isExternalProtocolOpenApi,
  upsertAgentsEnvelopeSection,
} from './lib/http-response-envelope-patterns.mjs';

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

test('AGENTS section references API_SPEC authority', () => {
  assert.match(AGENTS_SECTION_BODY, /API_SPEC\.md/);
  assert.match(AGENTS_SECTION_BODY, /SdkWorkApiResponse/);
  assert.match(AGENTS_SECTION_BODY, /section 4\.5/);
  assert.match(AGENTS_SECTION_BODY, /x-sdkwork-wire-protocol: external/);
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
