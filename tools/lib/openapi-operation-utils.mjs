/**
 * Minimal OpenAPI operation view used by SDKWork validators.
 * JSON authorities are parsed structurally; YAML authorities are parsed through
 * the small subset validators need: paths, HTTP methods, operation metadata,
 * and response schema references.
 */

export const OPENAPI_HTTP_METHODS = new Set([
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'head',
  'options',
  'trace',
]);

export function parseJsonOpenApi(text) {
  try {
    const document = JSON.parse(text);
    if (!document || typeof document !== 'object' || !document.paths || typeof document.paths !== 'object') {
      return null;
    }
    return document;
  } catch {
    return null;
  }
}

export function openApiOperationEntriesFromDocument(document) {
  const entries = [];
  const paths = document?.paths && typeof document.paths === 'object' ? document.paths : {};
  for (const [routePath, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== 'object') continue;
    for (const [method, operation] of Object.entries(pathItem)) {
      const normalizedMethod = String(method).toLowerCase();
      if (!OPENAPI_HTTP_METHODS.has(normalizedMethod) || !operation || typeof operation !== 'object') {
        continue;
      }
      entries.push({ routePath, method: normalizedMethod, operation });
    }
  }
  return entries;
}

export function openApiOperationEntriesFromText(text) {
  const document = parseJsonOpenApi(text);
  if (document) {
    return {
      format: 'json',
      document,
      entries: openApiOperationEntriesFromDocument(document),
    };
  }
  const parsedYaml = parseYamlOperationEntries(text);
  return {
    format: parsedYaml.entries.length > 0 ? 'yaml' : 'unknown',
    document: parsedYaml.document,
    entries: parsedYaml.entries,
  };
}

export function isExternalProtocolOperation(operation) {
  return (
    operation?.['x-sdkwork-wire-protocol'] === 'external'
    && typeof operation?.['x-sdkwork-external-protocol-id'] === 'string'
    && operation['x-sdkwork-external-protocol-id'].trim().length > 0
  );
}

export function classifyOperationWireProtocolMarkers(entries) {
  const issues = [];
  for (const { routePath, method, operation } of entries) {
    const protocol = operation['x-sdkwork-wire-protocol'];
    const externalProtocolId = operation['x-sdkwork-external-protocol-id'];
    const operationLabel = `${method.toUpperCase()} ${routePath}`;
    if (protocol && protocol !== 'external' && protocol !== 'sdkwork-v3') {
      issues.push({
        kind: 'invalid-wire-protocol',
        detail: `${operationLabel} uses unsupported x-sdkwork-wire-protocol: ${protocol}`,
      });
    }
    if (protocol === 'external' && !externalProtocolId) {
      issues.push({
        kind: 'incomplete-vendor-wire-protocol',
        detail: `${operationLabel} external operation requires x-sdkwork-external-protocol-id on the same operation`,
      });
    }
    if (externalProtocolId && protocol !== 'external') {
      issues.push({
        kind: 'incomplete-vendor-wire-protocol',
        detail: `${operationLabel} x-sdkwork-external-protocol-id requires x-sdkwork-wire-protocol: external on the same operation`,
      });
    }
    if (
      typeof externalProtocolId === 'string'
      && externalProtocolId.trim().length > 0
      && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(externalProtocolId)
    ) {
      issues.push({
        kind: 'invalid-external-protocol-id',
        detail: `${operationLabel} x-sdkwork-external-protocol-id must be lowercase kebab-case`,
      });
    }
  }
  return issues;
}

function parseYamlOperationEntries(text) {
  if (!/(^|\n)paths:\s*(\n|$)/u.test(text)) {
    return { document: parseYamlDocumentView(text.split(/\r?\n/u)), entries: [] };
  }
  const entries = [];
  const lines = text.split(/\r?\n/u);
  let inPaths = false;
  let currentPath = null;
  let currentEntry = null;
  let inResponses = false;
  let currentStatus = null;
  let currentContentType = null;
  let inSchema = false;

  for (const line of lines) {
    if (/^\S/u.test(line)) {
      inPaths = /^paths:\s*$/u.test(line);
      currentPath = null;
      currentEntry = null;
      inResponses = false;
      currentStatus = null;
      currentContentType = null;
      inSchema = false;
      continue;
    }
    if (!inPaths) {
      continue;
    }

    const pathMatch = line.match(/^ {2}(.+):\s*$/u);
    if (pathMatch) {
      const candidate = unquoteYamlScalar(pathMatch[1].trim());
      if (candidate.startsWith('/')) {
        currentPath = candidate;
        currentEntry = null;
        inResponses = false;
        currentStatus = null;
        currentContentType = null;
        inSchema = false;
        continue;
      }
    }

    const methodMatch = line.match(/^ {4}(get|post|put|patch|delete|head|options|trace):\s*$/u);
    if (methodMatch && currentPath) {
      currentEntry = {
        routePath: currentPath,
        method: methodMatch[1],
        operation: { responses: {} },
      };
      entries.push(currentEntry);
      inResponses = false;
      currentStatus = null;
      currentContentType = null;
      inSchema = false;
      continue;
    }

    if (!currentEntry) {
      continue;
    }

    const operationIdMatch = line.match(/^ {6}operationId:\s*(.+?)\s*$/u);
    if (operationIdMatch) {
      currentEntry.operation.operationId = unquoteYamlScalar(operationIdMatch[1].trim());
      continue;
    }
    const protocolMatch = line.match(/^ {6}x-sdkwork-wire-protocol:\s*(.+?)\s*$/u);
    if (protocolMatch) {
      currentEntry.operation['x-sdkwork-wire-protocol'] = unquoteYamlScalar(protocolMatch[1].trim());
      continue;
    }
    const protocolIdMatch = line.match(/^ {6}x-sdkwork-external-protocol-id:\s*(.+?)\s*$/u);
    if (protocolIdMatch) {
      currentEntry.operation['x-sdkwork-external-protocol-id'] = unquoteYamlScalar(protocolIdMatch[1].trim());
      continue;
    }
    if (/^ {6}responses:\s*$/u.test(line)) {
      inResponses = true;
      currentStatus = null;
      currentContentType = null;
      inSchema = false;
      continue;
    }
    if (!inResponses) {
      continue;
    }

    const statusMatch = line.match(/^ {8}((?:['"]?[0-9]{3}['"]?)|default):\s*$/u);
    if (statusMatch) {
      currentStatus = unquoteYamlScalar(statusMatch[1].trim());
      currentEntry.operation.responses[currentStatus] = {};
      currentContentType = null;
      inSchema = false;
      continue;
    }
    if (!currentStatus) {
      continue;
    }
    if (/^ {10}content:\s*$/u.test(line)) {
      currentEntry.operation.responses[currentStatus].content = {};
      currentContentType = null;
      inSchema = false;
      continue;
    }
    const contentTypeMatch = line.match(/^ {12}(\S.+?):\s*$/u);
    if (contentTypeMatch && currentEntry.operation.responses[currentStatus].content) {
      currentContentType = unquoteYamlScalar(contentTypeMatch[1].trim());
      currentEntry.operation.responses[currentStatus].content[currentContentType] = {};
      inSchema = false;
      continue;
    }
    if (!currentContentType) {
      continue;
    }
    if (/^ {14}schema:\s*$/u.test(line)) {
      const content = currentEntry.operation.responses[currentStatus].content[currentContentType];
      content.schema = {};
      inSchema = true;
      continue;
    }
    const refMatch = line.match(/^ {16,}(?:-\s*)?\$ref:\s*(.+?)\s*$/u);
    if (inSchema && refMatch) {
      const content = currentEntry.operation.responses[currentStatus].content[currentContentType];
      const schemaRef = unquoteYamlScalar(refMatch[1].trim());
      if (typeof content.schema.$ref !== 'string') {
        content.schema.$ref = schemaRef;
      }
      content.schema.refs = Array.isArray(content.schema.refs) ? content.schema.refs : [];
      content.schema.refs.push(schemaRef);
    }
  }
  return { document: parseYamlDocumentView(lines), entries };
}

function parseYamlDocumentView(lines) {
  const schemas = {};
  let inComponents = false;
  let inSchemas = false;
  let currentSchemaName = null;

  for (const line of lines) {
    if (/^\S/u.test(line)) {
      inComponents = /^components:\s*$/u.test(line);
      inSchemas = false;
      currentSchemaName = null;
      continue;
    }
    if (!inComponents) {
      continue;
    }
    if (/^ {2}schemas:\s*$/u.test(line)) {
      inSchemas = true;
      currentSchemaName = null;
      continue;
    }
    if (!inSchemas) {
      continue;
    }

    const schemaMatch = line.match(/^ {4}([^\s:#][^:]*):\s*$/u);
    if (schemaMatch) {
      currentSchemaName = unquoteYamlScalar(schemaMatch[1].trim());
      schemas[currentSchemaName] = schemas[currentSchemaName] ?? {};
      continue;
    }
    if (!currentSchemaName) {
      continue;
    }
    const refMatch = line.match(/^ {6,}(?:-\s*)?\$ref:\s*(.+?)\s*$/u);
    if (refMatch) {
      const schemaRef = unquoteYamlScalar(refMatch[1].trim());
      const schema = schemas[currentSchemaName];
      if (typeof schema.$ref !== 'string') {
        schema.$ref = schemaRef;
      }
      schema.refs = Array.isArray(schema.refs) ? schema.refs : [];
      schema.refs.push(schemaRef);
    }
  }

  return { components: { schemas } };
}

function unquoteYamlScalar(value) {
  if (
    (value.startsWith("'") && value.endsWith("'"))
    || (value.startsWith('"') && value.endsWith('"'))
  ) {
    return value.slice(1, -1);
  }
  return value;
}
