/**
 * Shared patterns for SDKWork HTTP operation contract validation.
 * See API_SPEC.md section 15.4.
 */

import {
  isExternalProtocolOperation,
  openApiOperationEntriesFromText,
} from './openapi-operation-utils.mjs';

export function classifyOpenApiOperationPatterns(text) {
  const issues = [];
  const { entries } = openApiOperationEntriesFromText(text);
  for (const entry of entries) {
    if (isExternalProtocolOperation(entry.operation)) {
      continue;
    }
    issues.push(...classifyOperation(entry));
  }
  return issues;
}

function classifyOperation({ routePath, method, operation }) {
  const issues = [];
  const operationId = typeof operation.operationId === 'string' ? operation.operationId : '';
  const operationLabel = `${method.toUpperCase()} ${routePath}`;
  const operationRoot = operationId.split('.', 1)[0];
  const tags = Array.isArray(operation.tags)
    ? operation.tags.filter((tag) => typeof tag === 'string')
    : [];
  if (operationRoot && tags.includes(operationRoot)) {
    issues.push({
      kind: 'operation-id-tag-duplication',
      detail: `${operationLabel} operationId ${operationId} must not repeat tag ${operationRoot}`,
    });
  }

  const pattern = inferOpenApiOperationPattern(routePath, method, operation);
  if (!pattern) {
    return issues;
  }

  const finalAction = operationId.includes('.') ? operationId.split('.').at(-1) : operationId;

  if (!operationId || (pattern.expectedAction && finalAction !== pattern.expectedAction)) {
    issues.push({
      kind: 'operation-id-action',
      detail: `${operationLabel} must use operationId action ${pattern.expectedAction}`,
    });
  }

  const responses = operation.responses && typeof operation.responses === 'object' ? operation.responses : {};
  if (pattern.kind === 'create' && !hasStatus(responses, '201')) {
    issues.push({
      kind: 'create-status',
      detail: `${operationLabel} create operations must return HTTP 201 with SdkWorkApiResponse.data.item`,
    });
  }
  if (pattern.kind === 'delete') {
    if (!hasStatus(responses, '204') || hasJsonSuccessBody(responses, ['200', '201', '202'])) {
      issues.push({
        kind: 'delete-status',
        detail: `${operationLabel} delete operations must return HTTP 204 without a JSON success body`,
      });
    }
  }
  if (['retrieve', 'list', 'search', 'update'].includes(pattern.kind) && !hasStatus(responses, '200')) {
    issues.push({
      kind: `${pattern.kind}-status`,
      detail: `${operationLabel} ${pattern.kind} operations must return HTTP 200`,
    });
  }
  if (pattern.kind === 'command' && !hasAnyStatus(responses, ['200', '202'])) {
    issues.push({
      kind: 'command-status',
      detail: `${operationLabel} command operations must return HTTP 200 or 202`,
    });
  }
  if (pattern.kind === 'bulk' && !hasAnyStatus(responses, ['200', '202'])) {
    issues.push({
      kind: 'bulk-status',
      detail: `${operationLabel} bulk operations must return HTTP 200 or 202`,
    });
  }
  if (pattern.kind === 'stream' && !hasStatus(responses, '200')) {
    issues.push({
      kind: 'stream-status',
      detail: `${operationLabel} stream operations must return HTTP 200`,
    });
  }
  return issues;
}

export function inferOpenApiOperationPattern(routePath, method, operation) {
  const finalAction = finalOperationIdAction(operation);
  if (isInfrastructureProbePath(routePath) || isRedirectOnlyOperation(operation)) {
    return null;
  }
  if (isEventStreamOperation(operation)) {
    return { kind: 'stream', expectedAction: 'stream' };
  }
  if (method === 'get') {
    if (finalAction === 'list') {
      return { kind: 'list', expectedAction: 'list' };
    }
    if (
      finalAction === 'retrieve'
      || pathEndsWithParameter(routePath)
      || isSingletonReadSegment(finalPathSegment(routePath))
    ) {
      return { kind: 'retrieve', expectedAction: 'retrieve' };
    }
    return { kind: 'list', expectedAction: 'list' };
  }
  if (method === 'post') {
    if (isSearchPath(routePath)) {
      return { kind: 'search', expectedAction: 'search' };
    }
    if (isBulkPath(routePath)) {
      return { kind: 'bulk', expectedAction: bulkActionFromPath(routePath) };
    }
    const commandAction = commandActionFromPath(routePath, finalAction);
    if (commandAction) {
      return { kind: 'command', expectedAction: commandAction };
    }
    if (isNestedCollectionCreatePath(routePath, finalAction)) {
      return { kind: 'create', expectedAction: 'create' };
    }
    return { kind: 'create', expectedAction: 'create' };
  }
  if (method === 'put' || method === 'patch') {
    return { kind: 'update', expectedAction: 'update' };
  }
  if (method === 'delete') {
    return { kind: 'delete', expectedAction: 'delete' };
  }
  return null;
}

function finalOperationIdAction(operation) {
  const operationId = typeof operation?.operationId === 'string' ? operation.operationId : '';
  return operationId.includes('.') ? operationId.split('.').at(-1) : operationId;
}

function pathEndsWithParameter(routePath) {
  return /\/\{[^}/]+\}$/.test(routePath);
}

function isSearchPath(routePath) {
  return routePath.endsWith('/search') || routePath.endsWith(':search');
}

function isInfrastructureProbePath(routePath) {
  return /^\/(?:healthz|livez|readyz|metrics)$/u.test(routePath);
}

function isRedirectOnlyOperation(operation) {
  const statuses = Object.keys(operation?.responses ?? {});
  return statuses.some((status) => /^3\d\d$/u.test(status))
    && !statuses.some((status) => /^2\d\d$/u.test(status));
}

function isEventStreamOperation(operation) {
  const responses = operation?.responses && typeof operation.responses === 'object'
    ? operation.responses
    : {};
  return Object.entries(responses).some(([status, response]) => (
    /^2\d\d$/u.test(status)
    && response
    && typeof response === 'object'
    && response.content
    && Object.prototype.hasOwnProperty.call(response.content, 'text/event-stream')
  ));
}

function isBulkPath(routePath) {
  return /:bulk[A-Z][A-Za-z0-9]*$/.test(routePath) || /\/bulk_[a-z0-9_]+$/.test(routePath);
}

function commandActionFromPath(routePath, finalAction) {
  const colonAction = routePath.match(/:([a-z][A-Za-z0-9]*)$/);
  if (colonAction && colonAction[1] !== 'search' && !colonAction[1].startsWith('bulk')) {
    return colonAction[1];
  }
  const finalSegment = finalPathSegment(routePath);
  if (!finalSegment || isPathParameter(finalSegment)) {
    return null;
  }
  const pathAction = snakeToCamel(finalSegment);
  if (pathAction === finalAction && finalAction !== 'create') {
    return pathAction;
  }
  const suffixAction = snakeToCamel(finalSegment.split('_').at(-1) || '');
  if (
    suffixAction === finalAction
    && finalAction !== 'create'
    && COMMAND_ACTIONS.has(finalAction)
  ) {
    return finalAction;
  }
  if (isLikelyCommandSegment(finalSegment)) {
    return pathAction;
  }
  return null;
}

function isNestedCollectionCreatePath(routePath, finalAction) {
  if (finalAction !== 'create') {
    return false;
  }
  const segments = pathSegments(routePath);
  const finalSegment = segments.at(-1);
  return segments.some(isPathParameter) && isPluralResourceSegment(finalSegment);
}

function finalPathSegment(routePath) {
  const segments = pathSegments(routePath);
  return segments.at(-1) || '';
}

function pathSegments(routePath) {
  return String(routePath)
    .split('/')
    .filter((segment) => segment.length > 0);
}

function isPathParameter(segment) {
  return /^\{[^}/]+\}$/u.test(segment);
}

function isPluralResourceSegment(segment) {
  return typeof segment === 'string' && /s$/u.test(segment) && !isLikelyCommandSegment(segment);
}

function isSingletonReadSegment(segment) {
  const normalized = String(segment).replace(/^.*:/u, '');
  return SINGLETON_READ_SEGMENTS.has(snakeToCamel(normalized));
}

function isLikelyCommandSegment(segment) {
  const action = snakeToCamel(segment);
  return COMMAND_ACTIONS.has(action);
}

function bulkActionFromPath(routePath) {
  const colonAction = routePath.match(/:(bulk[A-Z][A-Za-z0-9]*)$/);
  if (colonAction) {
    return colonAction[1];
  }
  const slashAction = routePath.match(/\/(bulk_[a-z0-9_]+)$/);
  if (slashAction) {
    return snakeToCamel(slashAction[1]);
  }
  return null;
}

function snakeToCamel(value) {
  return value.replace(/_([a-z0-9])/g, (_, char) => char.toUpperCase());
}

const COMMAND_ACTIONS = new Set([
  'accept',
  'activate',
  'add',
  'approve',
  'archive',
  'cancel',
  'changeRole',
  'close',
  'complete',
  'convert',
  'deactivate',
  'heartbeat',
  'explain',
  'leave',
  'migrate',
  'preview',
  'publish',
  'refresh',
  'read',
  'rebuild',
  'reject',
  'remove',
  'restore',
  'revoke',
  'rollback',
  'submit',
  'sync',
  'transferOwner',
  'unpublish',
  'unpin',
  'verify',
]);

const SINGLETON_READ_SEGMENTS = new Set([
  'catalog',
  'health',
  'ready',
  'resolve',
  'runtimeDefaults',
  'status',
  'summary',
  'sync',
  'usage',
]);

function hasStatus(responses, status) {
  return Object.prototype.hasOwnProperty.call(responses, status);
}

function hasAnyStatus(responses, statuses) {
  return statuses.some((status) => hasStatus(responses, status));
}

function hasJsonSuccessBody(responses, statuses) {
  return statuses.some((status) => {
    const response = responses[status];
    return Boolean(response && typeof response === 'object' && response.content);
  });
}
