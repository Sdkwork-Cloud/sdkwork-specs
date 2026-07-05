/**
 * Rewrites consumer vite/tsconfig/package alias paths from generator transport
 * entries to composed facade entries within the same SDK family.
 */
import fs from 'node:fs';
import path from 'node:path';

import {
  isConsumerSourcePath,
  listWorkspaceRepos,
  walkFiles,
} from './app-sdk-consumer-import-patterns.mjs';

const CONSUMER_FILE_PREDICATE = (filePath) => {
  const norm = filePath.replace(/\\/g, '/');
  if (/\/sdk-manifest\.json$/u.test(norm)) return false;
  if (/\/sdkwork-sdk\.json$/u.test(norm)) return false;
  if (/\/\.sdkwork-assembly\.json$/u.test(norm)) return false;
  if (!/\.(?:tsx?|jsx?|mjs|cjs|json)$/u.test(norm)) return false;
  if (/(^|\/)apps\/[^/]+\//u.test(norm)) return true;
  if (/(^|\/)packages\/[^/]+\//u.test(norm) && /(^|\/)apps\//u.test(norm)) return true;
  if (/tsconfig[^/]*\.json$/u.test(norm) && /(^|\/)sdkwork-/u.test(norm)) return true;
  if (/(^|\/)sdkwork-specs\/workspace\/consumers\//u.test(norm)) return true;
  return isConsumerSourcePath(filePath);
};

export function rewriteConsumerSdkAliasPaths(text) {
  let next = text;

  next = next.replace(
    /([A-Za-z0-9._-]+-typescript)\/src\/index\.ts\/dist(?:\/[^"'`\s]*)?/gu,
    '$1/src/index.ts',
  );
  next = next.replace(
    /([A-Za-z0-9._-]+-typescript)\/generated\/server-openapi\/dist\/index\.(?:js|mjs|cjs)/gu,
    '$1/src/index.ts',
  );
  next = next.replace(
    /((?:\.\.\/)*sdks\/([a-z0-9-]+-(?:app|backend|internal)-sdk))\/generated\/server-openapi(?:\/src(?:\/index\.(?:tsx?|jsx?)?)?)?/gu,
    '$1/$2-typescript/src/index.ts',
  );
  next = next.replace(
    /([A-Za-z0-9._-]+-typescript)\/generated\/domains\/server-openapi\/src(?:\/index\.(?:tsx?|jsx?)?)?/gu,
    '$1/src/domains/index.ts',
  );
  next = next.replace(
    /([A-Za-z0-9._-]+-typescript)\/generated\/domains\/server-openapi/gu,
    '$1/src/domains/index.ts',
  );
  next = next.replace(
    /([A-Za-z0-9._-]+-typescript)\/generated\/server-openapi\/src(?:\/index\.(?:tsx?|jsx?)?)?/gu,
    '$1/src/index.ts',
  );
  next = next.replace(
    /([A-Za-z0-9._-]+-typescript)\/generated\/server-openapi\/src/gu,
    '$1/src/index.ts',
  );
  next = next.replace(
    /([A-Za-z0-9._-]+-typescript)\/generated\/server-openapi/gu,
    '$1/src/index.ts',
  );

  return next;
}

export function alignConsumerSdkAliasPaths(workspaceRoot, { dryRun = false } = {}) {
  const changed = [];

  for (const repoRoot of listWorkspaceRepos(workspaceRoot)) {
    for (const filePath of walkFiles(repoRoot, CONSUMER_FILE_PREDICATE)) {
      const before = fs.readFileSync(filePath, 'utf8');
      const after = rewriteConsumerSdkAliasPaths(before);
      if (before === after) continue;
      if (!dryRun) fs.writeFileSync(filePath, after, 'utf8');
      changed.push(filePath);
    }
  }

  const specsConsumersDir = path.join(workspaceRoot, 'sdkwork-specs', 'workspace', 'consumers');
  if (fs.existsSync(specsConsumersDir)) {
    for (const entry of fs.readdirSync(specsConsumersDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
      const filePath = path.join(specsConsumersDir, entry.name);
      const before = fs.readFileSync(filePath, 'utf8');
      const after = rewriteConsumerSdkAliasPaths(before);
      if (before === after) continue;
      if (!dryRun) fs.writeFileSync(filePath, after, 'utf8');
      changed.push(filePath);
    }
  }

  return changed;
}
