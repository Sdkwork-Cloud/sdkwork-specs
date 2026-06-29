/**
 * Shared patterns for SdkWork HTTP response envelope validation.
 * See API_SPEC.md §15.
 */
import fs from 'node:fs';
import path from 'node:path';

export const LEGACY_ENVELOPE_SCHEMAS = [
  'PlusApiResult',
  'AppbaseApiResult',
  'StoreApiResult',
  'CommunityApiResult',
  'CatalogApiResult',
  'SdkWorkResponse',
];

export const LEGACY_ENVELOPE_PATTERN = new RegExp(
  `\\b(${LEGACY_ENVELOPE_SCHEMAS.join('|')}|\\w+ApiResult)\\b`,
);

export const FORBIDDEN_REQUEST_ID_PATTERN = /(?:["']requestId["']|\brequestId)\s*:/;

export const LEGACY_STRING_RESULT_CODE_PATTERN =
  /enum:\s*\[(?:ok|created|accepted|updated|deleted|validation_error|not_found|internal_error)/;

export const PROBLEM_DETAIL_PATTERN = /ProblemDetail|application\/problem\+json/;

export const SDKWORK_API_RESPONSE_PATTERN =
  /SdkWorkApiResponse|SdkWorkResourceData|SdkWorkPageData|SdkWorkCommandData/;

export const AGENTS_SECTION_HEADING = '## HTTP API Response Envelope';

export const AGENTS_SECTION_BODY = `${AGENTS_SECTION_HEADING}

All L2+ \`app-api\`, \`backend-api\`, and SDKWork-owned business \`open-api\` HTTP contracts \`MUST\` follow \`API_SPEC.md\` section 4.5, section 14, and section 15:

- **Input:** typed request bodies, section 14.1 list/search/command input, \`SdkWorkListQuery\`, and \`q\` for free-text search.
- **Success output:** \`SdkWorkApiResponse\` with \`{ "code": 0, "data": <payload>, "traceId": "<server-uuid>" }\`.
- **Error output:** HTTP 4xx/5xx \`application/problem+json\` (\`ProblemDetail\`) with numeric \`code\` and \`traceId\`.
- Success \`code\` is numeric \`int32\`; HTTP 2xx JSON bodies \`MUST\` use \`0\` only. REST semantics remain on HTTP status (\`201\`, \`202\`, etc.).
- Platform error codes are numeric non-zero values per section 15.3 (\`40001\`, \`40101\`, \`40401\`, …).
- Single resource: \`data.item\`
- Lists: \`data.items\` + \`data.pageInfo\` (\`PageInfo.mode\` is \`offset\` or \`cursor\`)
- Commands: \`data.accepted\` plus optional \`resourceId\` / \`status\`
- Async accept (\`202\`): \`data.operationId\`, \`data.status\`, optional \`pollUrl\`

Vendor compatibility \`open-api\` routes that mirror upstream tool or provider wire (for example OpenAI \`/v1/*\`, Claude Code, Codex) \`MAY\` opt out only when every exempt operation declares \`x-sdkwork-wire-protocol: external\` and \`x-sdkwork-external-protocol-id\` per \`API_SPEC.md\` section 4.5.2. SDKWork-owned business \`open-api\` operations \`MUST NOT\` opt out.

Errors \`MUST\` use HTTP 4xx/5xx with \`application/problem+json\` (\`ProblemDetail\`) including required numeric \`code\` and \`traceId\`. Business failures \`MUST NOT\` use HTTP 2xx with non-zero \`code\`, string wire codes, \`success\`, or human \`message\`.

Forbidden legacy envelopes and fields: \`PlusApiResult\`, \`AppbaseApiResult\`, \`StoreApiResult\`, \`SdkWorkResponse\`, per-domain \`*ApiResult\`, wire field \`requestId\`, bare domain DTOs at the HTTP root, and top-level \`{ items, pageInfo, traceId }\` without \`data\`.

Handlers \`MUST\` serialize success and map errors through \`sdkwork-web-framework\` response mapping. Generated HTTP SDKs (\`--standard-profile sdkwork-v3\`) unwrap \`data\` by default and expose typed numeric \`ProblemDetail.code\` / \`traceId\` on errors; use \`.raw\` when the full envelope is required.

Before completing API contract, SDK generation, or frontend service work, run:

\`\`\`bash
node <sdkwork-specs>/tools/check-api-response-envelope.mjs --workspace <workspace-root>
\`\`\`

Authority: \`sdkwork-specs/API_SPEC.md\` section 4.5 and sections 14–16, \`SDK_SPEC.md\` section 4.2, \`FRONTEND_SPEC.md\`, \`MIGRATION_SPEC.md\` section 4.2.
`;

const IGNORE_DIRS = new Set(['node_modules', '.git', 'artifacts', 'target', 'dist', 'build', '.pnpm-store', '.tmp']);

export function repoNameFromPath(filePath) {
  const parts = filePath.replace(/\\/g, '/').split('/');
  const sdkParts = parts.filter((p) => /^sdkwork-/.test(p));
  const appRepo = sdkParts.find((p) => p !== 'sdkwork-space' && p !== 'sdkwork-specs');
  return appRepo || sdkParts[sdkParts.length - 1] || 'unknown';
}

export function isAppOrBackendApiOpenApi(filePath) {
  const norm = filePath.replace(/\\/g, '/');
  return /(open-api|app-api|backend-api)/i.test(norm) && /openapi\.(ya?ml|json)$/i.test(norm);
}

export function isExternalProtocolOpenApi(text) {
  return (
    /x-sdkwork-wire-protocol["']?\s*:\s*["']?external["']?/i.test(text) &&
    /x-sdkwork-external-protocol-id["']?\s*:/i.test(text)
  );
}

export function preferredAuthorityScore(filePath) {
  const norm = filePath.replace(/\\/g, '/');
  if (norm.includes('/sdks/') && norm.includes('/openapi/')) return 3;
  if (norm.includes('/apis/')) return 2;
  if (norm.includes('/generated/openapi/')) return 1;
  return 0;
}

export function walkOpenApiFiles(root, acc = []) {
  if (!fs.existsSync(root)) return acc;
  let entries;
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const ent of entries) {
    if (IGNORE_DIRS.has(ent.name)) continue;
    const full = path.join(root, ent.name);
    let stat;
    try {
      stat = fs.statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) walkOpenApiFiles(full, acc);
    else if (isAppOrBackendApiOpenApi(full)) acc.push(full);
  }
  return acc;
}

export function classifyOpenApiWireProtocolMarkers(text) {
  const issues = [];
  if (
    /x-sdkwork-wire-protocol["']?\s*:\s*["']?external["']?/i.test(text) &&
    !/x-sdkwork-external-protocol-id["']?\s*:/i.test(text)
  ) {
    issues.push({
      kind: 'incomplete-vendor-wire-protocol',
      detail:
        'x-sdkwork-wire-protocol: external requires x-sdkwork-external-protocol-id on the same document or operation',
    });
  }
  return issues;
}

export function classifyOpenApiEnvelope(text) {
  const issues = [];
  const legacyMatch = text.match(LEGACY_ENVELOPE_PATTERN);
  if (legacyMatch && !text.includes('Forbidden legacy')) {
    issues.push({ kind: 'legacy-envelope', detail: `uses ${legacyMatch[0]}` });
  }
  if (FORBIDDEN_REQUEST_ID_PATTERN.test(text)) {
    issues.push({ kind: 'forbidden-request-id', detail: 'response schema still declares requestId' });
  }
  if (LEGACY_STRING_RESULT_CODE_PATTERN.test(text)) {
    issues.push({
      kind: 'legacy-string-result-code',
      detail: 'result code still uses forbidden string enum tokens',
    });
  }
  if (
    /\bsuccess\s*:\s*\{?\s*type:\s*boolean/.test(text) ||
    /"success"\s*:\s*\{[^}]*"type"\s*:\s*"boolean"/.test(text)
  ) {
    if (/StoreApiResult|CommandResult/.test(text)) {
      issues.push({ kind: 'success-boolean-envelope', detail: 'success boolean in response schema' });
    }
  }
  if (!PROBLEM_DETAIL_PATTERN.test(text)) {
    issues.push({ kind: 'missing-problem-detail', detail: 'no ProblemDetail or application/problem+json' });
  }
  const hasModern =
    SDKWORK_API_RESPONSE_PATTERN.test(text) ||
    (/required:\s*\[(?:code,\s*)?data,\s*traceId\]/i.test(text) &&
      /traceId:/.test(text) &&
      /code:/.test(text) &&
      !LEGACY_ENVELOPE_PATTERN.test(text));
  if (!hasModern) {
    issues.push({
      kind: 'missing-sdkwork-api-response',
      detail: 'no SdkWorkApiResponse or canonical code+data+traceId envelope',
    });
  }
  return issues;
}

export function dedupeAuthorities(files) {
  const map = new Map();
  for (const file of files) {
    const repo = repoNameFromPath(file);
    const norm = file.replace(/\\/g, '/');
    const surface = norm.includes('backend-api')
      ? 'backend-api'
      : norm.includes('open-api')
        ? 'open-api'
        : 'app-api';
    const key = `${repo}::${surface}`;
    const score = preferredAuthorityScore(file);
    const prev = map.get(key);
    if (!prev || score > prev.score) {
      map.set(key, { file, score, repo, surface });
    }
  }
  return [...map.values()];
}

export function walkAgentsFiles(root, acc = []) {
  if (!fs.existsSync(root)) return acc;
  let entries;
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const ent of entries) {
    if (IGNORE_DIRS.has(ent.name)) continue;
    const full = path.join(root, ent.name);
    let stat;
    try {
      stat = fs.statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) walkAgentsFiles(full, acc);
    else if (ent.name === 'AGENTS.md') acc.push(full);
  }
  return acc;
}

export function upsertAgentsEnvelopeSection(content) {
  const headingRegex = /^## HTTP API Response Envelope\b/m;
  if (headingRegex.test(content)) {
    const idx = content.search(headingRegex);
    const before = content.slice(0, idx).trimEnd();
    const rest = content.slice(idx);
    const tail = rest.replace(/^## HTTP API Response Envelope[\s\S]*?(?=^## )/m, '');
    return `${before}\n\n${AGENTS_SECTION_BODY.trim()}\n\n${tail.replace(/^\n+/, '')}`;
  }
  const humanReview = '\n## Human Review Rules';
  if (content.includes(humanReview)) {
    return content.replace(humanReview, `\n${AGENTS_SECTION_BODY.trim()}\n${humanReview}`);
  }
  return `${content.trimEnd()}\n\n${AGENTS_SECTION_BODY.trim()}\n`;
}
