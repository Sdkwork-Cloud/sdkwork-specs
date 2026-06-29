/**
 * Migrates legacy *ApiResult OpenAPI envelopes to SdkWorkApiResponse.
 * Authority: API_SPEC.md §15, openapi-envelope-schemas.mjs
 */
import {
  sdkWorkEnvelopeComponentSchemas,
  typedSdkWorkResourceResponse,
} from './openapi-envelope-schemas.mjs';

const DEFAULT_LEGACY_NAMES = [
  'PlusApiResult',
  'AppbaseApiResult',
  'StoreApiResult',
  'BrowserApiResult',
  'CommerceApiResult',
  'CommunityApiResult',
  'DezhouApiResult',
  'DoudizhuApiResult',
  'GamesApiResult',
  'MahjongApiResult',
  'ImageApiResult',
  'MusicApiResult',
  'NewsApiResult',
  'RtcApiResult',
  'VoiceApiResult',
  'XiangqiApiResult',
  'CommandResult',
];

export function resolveLegacyEnvelopeNames(options = {}) {
  if (Array.isArray(options.legacyEnvelopes) && options.legacyEnvelopes.length > 0) {
    return options.legacyEnvelopes;
  }
  if (typeof options.legacyEnvelope === 'string' && options.legacyEnvelope.trim()) {
    return [options.legacyEnvelope.trim()];
  }
  return DEFAULT_LEGACY_NAMES;
}

export function migrateOpenApiDocument(document, options = {}) {
  const legacyNames = new Set(resolveLegacyEnvelopeNames(options));
  const next = structuredClone(document);
  next.components = next.components || {};
  next.components.schemas = next.components.schemas || {};

  for (const legacyName of legacyNames) {
    if (next.components.schemas[legacyName]) {
      delete next.components.schemas[legacyName];
    }
  }

  Object.assign(next.components.schemas, structuredClone(sdkWorkEnvelopeComponentSchemas));

  const schemaEntries = Object.entries(next.components.schemas);
  for (const [name, schema] of schemaEntries) {
    if (sdkWorkEnvelopeComponentSchemas[name]) {
      continue;
    }
    next.components.schemas[name] = migrateSchemaNode(schema, legacyNames, name);
  }

  migratePathResponses(next, legacyNames);
  bootstrapBareSuccessResponses(next);
  normalizeProblemDetailSchema(next);
  stripForbiddenWireFields(next);
  pruneUnreferencedLegacyEnvelopeSchemas(next);
  ensureProblemResponses(next);
  return next;
}

export function bootstrapOpenApiEnvelope(document, options = {}) {
  return migrateOpenApiDocument(document, options);
}

function migratePathResponses(document, legacyNames) {
  for (const pathItem of Object.values(document.paths || {})) {
    if (!pathItem || typeof pathItem !== 'object') {
      continue;
    }
    for (const operation of Object.values(pathItem)) {
      if (!operation || typeof operation !== 'object' || !operation.responses) {
        continue;
      }
      for (const [statusCode, response] of Object.entries(operation.responses)) {
        if (!String(statusCode).startsWith('2')) {
          continue;
        }
        const content = response?.content?.['application/json'];
        if (!content?.schema) {
          continue;
        }
        content.schema = migrateSchemaNode(content.schema, legacyNames, inferResponseName(operation, statusCode));
      }
    }
  }
}

function inferResponseName(operation, statusCode) {
  const operationId = typeof operation.operationId === 'string' ? operation.operationId : 'operation';
  return `${operationId}.${statusCode}.response`;
}

function migrateSchemaNode(schema, legacyNames, schemaName = '') {
  if (!schema || typeof schema !== 'object') {
    return schema;
  }

  if (typeof schema.$ref === 'string') {
    const refName = schema.$ref.split('/').pop();
    if (legacyNames.has(refName)) {
      return defaultEnvelopeRef(schemaName);
    }
    return schema;
  }

  if (Array.isArray(schema.allOf)) {
    return migrateAllOfSchema(schema, legacyNames, schemaName);
  }

  return schema;
}

function migrateAllOfSchema(schema, legacyNames, schemaName) {
  const parts = schema.allOf;
  const usesLegacy = parts.some((part) => legacyNames.has(refName(part?.$ref)));
  if (!usesLegacy) {
    return schema;
  }

  const overlay = parts.find((part) => part?.properties?.data || (part?.type === 'object' && part?.properties));
  const dataSchema = overlay?.properties?.data;
  if (!dataSchema) {
    return { $ref: defaultEnvelopeRef(schemaName).$ref };
  }

  if (isListDataSchema(dataSchema)) {
    return buildListEnvelope(dataSchema);
  }

  if (typeof dataSchema.$ref === 'string') {
    return typedSdkWorkResourceResponse(dataSchema.$ref);
  }

  if (dataSchema.type === 'object' && dataSchema.properties?.item) {
    return buildResourceEnvelope(dataSchema);
  }

  return {
    allOf: [
      { $ref: '#/components/schemas/SdkWorkApiResponse' },
      {
        type: 'object',
        required: ['data'],
        properties: {
          data: {
            type: 'object',
            required: ['item'],
            properties: {
              item: dataSchema,
            },
          },
        },
      },
    ],
  };
}

function isListDataSchema(dataSchema) {
  if (!dataSchema || typeof dataSchema !== 'object') {
    return false;
  }
  if (dataSchema.properties?.items) {
    return true;
  }
  if (dataSchema.$ref) {
    return false;
  }
  return false;
}

function buildListEnvelope(dataSchema) {
  const items = dataSchema.properties?.items || { type: 'array', items: { type: 'object', additionalProperties: true } };
  const hasLegacyCursor = Boolean(dataSchema.properties?.nextCursor);
  const pageInfo = hasLegacyCursor
    ? {
        type: 'object',
        additionalProperties: false,
        required: ['mode', 'hasMore'],
        properties: {
          mode: { type: 'string', enum: ['cursor'] },
          nextCursor: { type: ['string', 'null'] },
          hasMore: { type: 'boolean' },
        },
      }
    : { $ref: '#/components/schemas/PageInfo' };

  return {
    allOf: [
      { $ref: '#/components/schemas/SdkWorkApiResponse' },
      {
        type: 'object',
        required: ['data'],
        properties: {
          data: {
            type: 'object',
            additionalProperties: false,
            required: ['items', 'pageInfo'],
            properties: {
              items,
              pageInfo,
            },
          },
        },
      },
    ],
  };
}

function buildResourceEnvelope(dataSchema) {
  return {
    allOf: [
      { $ref: '#/components/schemas/SdkWorkApiResponse' },
      {
        type: 'object',
        required: ['data'],
        properties: {
          data: dataSchema,
        },
      },
    ],
  };
}

function defaultEnvelopeRef(schemaName = '') {
  const normalized = String(schemaName || '').toLowerCase();
  if (normalized.includes('list') || normalized.endsWith('.list')) {
    return { $ref: '#/components/schemas/SdkWorkListResponse' };
  }
  if (normalized.includes('command') || normalized.includes('delete') || normalized.includes('verify')) {
    return { $ref: '#/components/schemas/SdkWorkCommandResponse' };
  }
  return { $ref: '#/components/schemas/SdkWorkResourceResponse' };
}

function refName(ref) {
  return typeof ref === 'string' ? ref.split('/').pop() : undefined;
}

function ensureProblemResponses(document) {
  const problemSchema = { $ref: '#/components/schemas/ProblemDetail' };
  const errorStatuses = ['400', '401', '403', '404', '409', '422', '429', '500', '503', 'default'];

  const responseContainers = [
    ...(Object.values(document.paths || {}).flatMap((pathItem) =>
      pathItem && typeof pathItem === 'object'
        ? Object.values(pathItem).filter((operation) => operation && typeof operation === 'object')
        : [],
    )),
    ...Object.values(document.components?.responses || {}),
  ];

  for (const container of responseContainers) {
    const responses = container.responses || (container.content ? { inline: container } : null);
    if (!responses) {
      continue;
    }
    for (const [statusCode, response] of Object.entries(responses)) {
      if (String(statusCode).startsWith('2')) {
        continue;
      }
      if (!response || typeof response !== 'object') {
        continue;
      }
      const resolved = resolveResponseObject(document, response);
      if (!resolved) {
        continue;
      }
      const hasProblem = resolved.content?.['application/problem+json'];
      if (hasProblem) {
        resolved.content['application/problem+json'].schema = problemSchema;
        continue;
      }
      if (resolved.content?.['application/json']) {
        resolved.content['application/problem+json'] = {
          schema: problemSchema,
        };
      }
    }
  }
}

function resolveResponseObject(document, response) {
  if (response?.$ref?.startsWith('#/components/responses/')) {
    const name = response.$ref.split('/').pop();
    return document.components?.responses?.[name];
  }
  return response;
}

function bootstrapBareSuccessResponses(document) {
  for (const [name, response] of Object.entries(document.components?.responses || {})) {
    wrapSuccessResponseSchema(document, response, name);
  }

  for (const pathItem of Object.values(document.paths || {})) {
    if (!pathItem || typeof pathItem !== 'object') {
      continue;
    }
    for (const operation of Object.values(pathItem)) {
      if (!operation || typeof operation !== 'object' || !operation.responses) {
        continue;
      }
      for (const [statusCode, response] of Object.entries(operation.responses)) {
        if (!String(statusCode).startsWith('2')) {
          continue;
        }
        const resolved = resolveResponseObject(document, response) || response;
        const hint = inferResponseName(operation, statusCode);
        wrapSuccessResponseSchema(document, resolved, hint);
      }
    }
  }
}

function wrapSuccessResponseSchema(document, response, hint) {
  const content = response?.content?.['application/json'];
  if (!content?.schema) {
    return;
  }
  content.schema = wrapBareSchema(document, content.schema, hint);
}

function wrapBareSchema(document, schema, hint = '') {
  if (isEnvelopeSchema(schema)) {
    return schema;
  }

  const normalized = String(hint).toLowerCase();

  if (schema?.type === 'array') {
    return buildListEnvelope({
      properties: {
        items: schema,
      },
    });
  }

  if (schema?.properties?.success && schema?.properties?.success?.type === 'boolean') {
    return { $ref: '#/components/schemas/SdkWorkCommandResponse' };
  }

  if (schema?.properties?.items && !schema?.properties?.code) {
    return buildListEnvelope({
      properties: {
        items: schema.properties.items,
        ...(schema.properties.nextCursor ? { nextCursor: schema.properties.nextCursor } : {}),
        ...(schema.properties.pageInfo ? { pageInfo: schema.properties.pageInfo } : {}),
      },
    });
  }

  if (typeof schema?.$ref === 'string') {
    const refName = schema.$ref.split('/').pop();
    const resolved = document.components?.schemas?.[refName];
    if (resolved?.properties?.items) {
      return buildListEnvelope({
        properties: {
          items: resolved.properties.items,
          ...(resolved.properties.nextCursor ? { nextCursor: resolved.properties.nextCursor } : {}),
          ...(resolved.properties.pageInfo ? { pageInfo: resolved.properties.pageInfo } : {}),
        },
      });
    }
    if (
      normalized.includes('list') ||
      normalized.includes('page') ||
      /page$|list$/i.test(refName)
    ) {
      return { $ref: '#/components/schemas/SdkWorkListResponse' };
    }
    if (normalized.includes('delete') || normalized.includes('command')) {
      return { $ref: '#/components/schemas/SdkWorkCommandResponse' };
    }
    return typedSdkWorkResourceResponse(schema.$ref);
  }

  if (normalized.includes('delete') || normalized.includes('command')) {
    return { $ref: '#/components/schemas/SdkWorkCommandResponse' };
  }
  if (normalized.includes('list') || normalized.includes('page')) {
    return { $ref: '#/components/schemas/SdkWorkListResponse' };
  }

  return {
    allOf: [
      { $ref: '#/components/schemas/SdkWorkApiResponse' },
      {
        type: 'object',
        required: ['data'],
        properties: {
          data: {
            type: 'object',
            required: ['item'],
            properties: {
              item: schema,
            },
          },
        },
      },
    ],
  };
}

function isEnvelopeSchema(schema) {
  const ref = typeof schema?.$ref === 'string' ? schema.$ref : '';
  if (/SdkWork(ApiResponse|ResourceResponse|ListResponse|CommandResponse)/.test(ref)) {
    return true;
  }
  if (Array.isArray(schema?.allOf) && schema.allOf.some((part) => String(part?.$ref).includes('SdkWorkApiResponse'))) {
    return true;
  }
  if (schema?.properties?.code && schema?.properties?.data && schema?.properties?.traceId) {
    return true;
  }
  return false;
}

function normalizeProblemDetailSchema(document) {
  document.components = document.components || {};
  document.components.schemas = document.components.schemas || {};
  document.components.schemas.ProblemDetail = structuredClone(sdkWorkEnvelopeComponentSchemas.ProblemDetail);
}

function stripForbiddenWireFields(node) {
  if (!node || typeof node !== 'object') {
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      stripForbiddenWireFields(item);
    }
    return;
  }
  if (Array.isArray(node.required)) {
    node.required = node.required.filter((field) => field !== 'requestId');
    if (node.required.length === 0) {
      delete node.required;
    }
  }
  if (node.properties?.requestId) {
    delete node.properties.requestId;
  }
  for (const value of Object.values(node)) {
    stripForbiddenWireFields(value);
  }
}

function isLegacyWireEnvelopeComponentSchema(schema) {
  if (!schema || typeof schema !== 'object' || !schema.properties) {
    return false;
  }
  const code = schema.properties.code;
  if (code?.type !== 'string' && !Array.isArray(code?.enum)) {
    return false;
  }
  return Boolean(schema.properties.message && schema.properties.data);
}

function collectComponentSchemaRefs(node, refs = new Set()) {
  if (!node || typeof node !== 'object') {
    return refs;
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      collectComponentSchemaRefs(item, refs);
    }
    return refs;
  }
  if (typeof node.$ref === 'string' && node.$ref.startsWith('#/components/schemas/')) {
    refs.add(node.$ref.split('/').pop());
  }
  for (const value of Object.values(node)) {
    collectComponentSchemaRefs(value, refs);
  }
  return refs;
}

function pruneUnreferencedLegacyEnvelopeSchemas(document) {
  const schemas = document.components?.schemas;
  if (!schemas) {
    return;
  }
  const referenced = collectComponentSchemaRefs(document);
  for (const [name, schema] of Object.entries(schemas)) {
    if (sdkWorkEnvelopeComponentSchemas[name]) {
      continue;
    }
    if (referenced.has(name)) {
      continue;
    }
    if (!isLegacyWireEnvelopeComponentSchema(schema)) {
      continue;
    }
    delete schemas[name];
  }
}
