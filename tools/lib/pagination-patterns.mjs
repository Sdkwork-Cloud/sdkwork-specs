/**
 * Shared patterns for SDKWork list/search pagination agent entrypoints.
 * See PAGINATION_SPEC.md.
 */
import fs from 'node:fs';
import path from 'node:path';

export const AGENTS_PAGINATION_SECTION_HEADING = '## List And Search Pagination';

export const AGENTS_PAGINATION_SECTION_BODY = `${AGENTS_PAGINATION_SECTION_HEADING}

All L2+ list/search APIs and their backing services, repositories, SDK consumers, and interactive frontend lists \`MUST\` follow \`PAGINATION_SPEC.md\`:

- **Input:** standard \`SdkWorkListQuery\` or query params (\`page\`/\`page_size\` or \`cursor\`/\`page_size\` per \`API_SPEC.md\` §14.1); default \`page_size\` \`20\`; max \`200\` unless a documented exception exists.
- **Output:** \`SdkWorkApiResponse.data.items\` + \`data.pageInfo\` with \`PageInfo.mode\` (\`offset\` or \`cursor\`) per \`API_SPEC.md\` §16.
- **Store-level pagination:** push filtering, sorting, and page selection to SQL \`LIMIT\`/keyset or incrementally maintained indexes — never unbounded collect then \`skip\`/\`take\`/\`slice\` in process memory (\`PAGINATION_SPEC.md\` §2).
- **SDK and frontend:** interactive lists request one page at a time from the server; no default \`listAll*\` on P0/P1 paths; no client-side \`slice\` pagination over full downloads.
- **Zero-debt wire contract:** HTTP GET list/search query strings use \`page_size\` only. \`pageSize\`, \`limit\`, numeric cursor offsets, and other pagination aliases are technical debt and are forbidden for new or pre-launch applications.

Before completing list/search API, repository, SDK list helper, projection read model, or paginated UI work, run:

\`\`\`bash
node <sdkwork-specs>/tools/check-pagination.mjs --workspace <workspace-root>
\`\`\`

Authority: \`PAGINATION_SPEC.md\`, \`API_SPEC.md\` §14.1/§16, \`DATABASE_SPEC.md\` §20.5, \`WEB_BACKEND_SPEC.md\` §12, \`SDK_SPEC.md\` §4.2/§6, \`FRONTEND_SPEC.md\`, \`APP_SDK_INTEGRATION_SPEC.md\` §9.
`;

const IGNORE_DIRS = new Set(['node_modules', '.git', 'artifacts', 'target', 'dist', 'build', '.pnpm-store', '.tmp']);

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

export function upsertAgentsPaginationSection(content) {
  const headingRegex = /^## List And Search Pagination\b/m;
  if (headingRegex.test(content)) {
    const idx = content.search(headingRegex);
    const before = content.slice(0, idx).trimEnd();
    const rest = content.slice(idx);
    const tail = rest.replace(/^## List And Search Pagination[\s\S]*?(?=^## )/m, '');
    return `${before}\n\n${AGENTS_PAGINATION_SECTION_BODY.trim()}\n\n${tail.replace(/^\n+/, '')}`;
  }
  const humanReview = '\n## Human Review Rules';
  if (content.includes(humanReview)) {
    return content.replace(humanReview, `\n${AGENTS_PAGINATION_SECTION_BODY.trim()}\n${humanReview}`);
  }
  return `${content.trimEnd()}\n\n${AGENTS_PAGINATION_SECTION_BODY.trim()}\n`;
}
