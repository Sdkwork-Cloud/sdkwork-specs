import { openApiOperationEntriesFromDocument } from './openapi-operation-utils.mjs';
import { inferOpenApiOperationPattern } from './api-operation-patterns.mjs';

export function alignOpenApiOperationPatterns(document) {
  let changes = 0;
  for (const { routePath, method, operation } of openApiOperationEntriesFromDocument(document)) {
    if (
      operation?.['x-sdkwork-wire-protocol'] === 'external'
      && operation?.['x-sdkwork-external-protocol-id']
    ) {
      continue;
    }
    const pattern = inferOpenApiOperationPattern(routePath, method, operation);
    if (!pattern) {
      continue;
    }
    changes += alignOperationId(operation, pattern.expectedAction);
    changes += alignResponses(operation, pattern.kind);
  }
  return { document, changes };
}

function alignOperationId(operation, expectedAction) {
  if (!expectedAction || typeof operation.operationId !== 'string') {
    return 0;
  }
  const segments = operation.operationId.split('.');
  if (segments.at(-1) === expectedAction) {
    return 0;
  }
  segments[segments.length - 1] = expectedAction;
  operation.operationId = segments.join('.');
  return 1;
}

function alignResponses(operation, kind) {
  const responses = operation.responses && typeof operation.responses === 'object'
    ? operation.responses
    : (operation.responses = {});
  if (kind === 'create') {
    return moveSuccessResponse(responses, '201', ['200', '202']);
  }
  if (kind === 'delete') {
    return alignDeleteResponses(responses);
  }
  if (['retrieve', 'list', 'search', 'update', 'stream'].includes(kind)) {
    return moveSuccessResponse(responses, '200', ['201', '202']);
  }
  if (kind === 'command' || kind === 'bulk') {
    if (hasAnyStatus(responses, ['200', '202'])) {
      return 0;
    }
    return moveSuccessResponse(responses, '200', ['201']);
  }
  return 0;
}

function moveSuccessResponse(responses, targetStatus, sourceStatuses) {
  if (hasStatus(responses, targetStatus)) {
    return 0;
  }
  const sourceStatus = sourceStatuses.find((status) => hasStatus(responses, status));
  if (!sourceStatus) {
    return 0;
  }
  responses[targetStatus] = responses[sourceStatus];
  delete responses[sourceStatus];
  return 1;
}

function alignDeleteResponses(responses) {
  let changes = 0;
  if (!hasStatus(responses, '204')) {
    const sourceStatus = ['200', '201', '202'].find((status) => hasStatus(responses, status));
    const description = sourceStatus && typeof responses[sourceStatus]?.description === 'string'
      ? responses[sourceStatus].description
      : 'Deleted';
    responses['204'] = { description };
    changes += 1;
  } else if (responses['204']?.content) {
    delete responses['204'].content;
    changes += 1;
  }
  for (const status of ['200', '201', '202']) {
    if (hasStatus(responses, status)) {
      delete responses[status];
      changes += 1;
    }
  }
  return changes;
}

function hasStatus(responses, status) {
  return Object.prototype.hasOwnProperty.call(responses, status);
}

function hasAnyStatus(responses, statuses) {
  return statuses.some((status) => hasStatus(responses, status));
}
