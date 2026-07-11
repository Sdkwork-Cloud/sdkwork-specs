/**

 * App SDK consumer import naming patterns.

 * See APP_SDK_INTEGRATION_SPEC.md section 9 and SDK_SPEC.md package naming table.

 */

import fs from 'node:fs';

import path from 'node:path';



export const LEGACY_GENERATED_TYPESCRIPT_PATTERN =

  /\b(?:sdkwork-[a-z0-9-]+-(?:app|backend|internal)-sdk-generated-typescript|sdkwork-[a-z0-9-]+-sdk-generated-typescript|clawrouter-(?:app|backend)-domain-transport-generated-typescript|sdkwork-clawrouter-(?:app|backend)-sdk-domains-generated-typescript)\b/gu;



export const NON_STANDARD_SDK_PATH_PATTERN =

  /(?:domain-transport-typescript|domain-transport-sdk|clawrouter-(?:app|backend)-domain-transport(?:-generated-typescript)?)/gu;



export const AGENTS_SECTION_HEADING = '## App SDK Consumer Imports';



export const AGENTS_SECTION_BODY = `${AGENTS_SECTION_HEADING}



Application, feature, shell, and service packages \`MUST\` consume HTTP SDKs through scoped composed consumer packages, not generator transport package names.



- App API clients: \`@sdkwork/<application-code>-app-sdk\`

- Backend API clients (\`backend-admin\` only): \`@sdkwork/<application-code>-backend-sdk\`

- Federated Claw Router domain surfaces: \`@sdkwork/clawrouter-app-sdk/domains\` and \`@sdkwork/clawrouter-backend-sdk/domains\`

- Open/domain API clients: \`@sdkwork/<domain>-sdk\`



Canonical examples (IAM):



\`\`\`typescript

import { createClient, type SdkworkAppClient } from '@sdkwork/iam-app-sdk';

import type { SdkworkBackendClient } from '@sdkwork/iam-backend-sdk'; // backend-admin only

import { createClient as createClawRouterDomainsClient } from '@sdkwork/clawrouter-app-sdk/domains';

\`\`\`



Forbidden in application \`apps/\`, \`packages/\`, bootstrap, services, UI, contract tests, and composed SDK \`src/**\` outside generator ownership:



- \`sdkwork-*-app-sdk-generated-typescript\`, \`sdkwork-*-backend-sdk-generated-typescript\`, and other generator transport names as consumer imports

- \`@sdkwork/commerce-app-sdk\`, \`@sdkwork/commerce-backend-sdk\`, \`@sdkwork/clawrouter-*-domain-transport-sdk\`

- filesystem paths containing \`domain-transport-typescript\`, \`domain-transport-sdk\`, or sibling \`*-typescript/generated\` hops from composed \`src/**\`

- deep imports into \`generated/server-openapi/src/*\` from consumers when a composed facade exists



Allowed:



- Composed facade entry imports such as \`@sdkwork/iam-app-sdk\`, \`@sdkwork/knowledgebase-app-sdk\`, and \`@sdkwork/clawrouter-app-sdk/domains\`

- Composed re-exports that import only from \`../generated/**\` within the same \`*-sdk-typescript\` family root

- Generated transport ownership inside \`sdks/**/generated/**\` only



Each SDK family \`MUST\` expose the composed TypeScript facade at \`sdks/<sdk-family>/<sdk-family>-typescript/src/index.ts\` (and optional subpath exports such as \`./domains\`) with \`package.json#name\` equal to the scoped consumer package.



Before completing SDK integration or frontend service work, run:



\`\`\`bash

node <sdkwork-specs>/tools/check-app-sdk-consumer-imports.mjs --workspace <workspace-root>

\`\`\`



Authority: \`APP_SDK_INTEGRATION_SPEC.md\` section 9, \`SDK_SPEC.md\` package naming table, \`SDK_WORKSPACE_GENERATION_SPEC.md\` composed facade rules.

`;



const IGNORE_DIRS = new Set([

  'node_modules',

  '.git',

  'dist',

  'build',

  'target',

  'artifacts',

  '.pnpm-store',

  '.runtime',

]);



const CUSTOM_LEGACY_TO_SCOPED = new Map([

  ['clawrouter-app-domain-transport-generated-typescript', '@sdkwork/clawrouter-app-sdk/domains'],

  ['clawrouter-backend-domain-transport-generated-typescript', '@sdkwork/clawrouter-backend-sdk/domains'],

  ['sdkwork-clawrouter-app-sdk-domains-generated-typescript', '@sdkwork/clawrouter-app-sdk/domains'],

  ['sdkwork-clawrouter-backend-sdk-domains-generated-typescript', '@sdkwork/clawrouter-backend-sdk/domains'],

  ['sdkwork-games-app-sdk-generated-typescript', '@sdkwork/games-app-sdk'],

  ['sdkwork-commerce-app-sdk-generated-typescript', '@sdkwork/clawrouter-app-sdk/domains'],

  ['sdkwork-commerce-backend-sdk-generated-typescript', '@sdkwork/clawrouter-backend-sdk/domains'],

]);



export const DEBT_GUARD_PATH_PATTERNS = [

  /\/check-commerce-debt\.mjs$/u,

  /\/commerce-debt-runtime\.test\.[cm]?[jt]s$/u,

  /\/patch-domain-transport-openapi-metadata\.mjs$/u,

  /\/TECHNICAL_DEBT_APP_SDK_CONSUMER_IMPORTS\.md$/u,

  /\/app-sdk-consumer-import-patterns\.mjs$/u,

  /\/check-app-sdk-consumer-imports\.mjs$/u,

  /\/sdk-composition-standard\.test\.mjs$/u,

  /\/sdks\/sdkwork-commerce-(?:app|backend)-sdk\//u,

];



export function isDebtGuardSourcePath(filePath) {

  const norm = filePath.replace(/\\/g, '/');

  return DEBT_GUARD_PATH_PATTERNS.some((pattern) => pattern.test(norm));

}



export function isGeneratorOwnershipPath(filePath) {

  const norm = filePath.replace(/\\/g, '/');

  return /\/generated\//u.test(norm) || /\/\.sdkwork\//u.test(norm);

}



export const DEEP_GENERATED_TRANSPORT_IMPORT_PATTERN =

  /(?:from|import\s+(?:type\s+)?(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from|import)\s+['"]([^'"]*\/generated\/server-openapi\/src\/[^'"]*)['"]/gu;



export const CROSS_SIBLING_TYPESCRIPT_IMPORT_PATTERN =

  /(?:from|import\s+(?:type\s+)?(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from|import)\s+['"](\.\.\/[^'"]*-typescript\/[^'"]*)['"]/gu;



export function legacyGeneratedPackageToScoped(packageName) {

  if (CUSTOM_LEGACY_TO_SCOPED.has(packageName)) {

    return CUSTOM_LEGACY_TO_SCOPED.get(packageName);

  }



  const patterns = [

    [/^sdkwork-([a-z0-9-]+)-app-sdk-generated-typescript$/u, '@sdkwork/$1-app-sdk'],

    [/^sdkwork-([a-z0-9-]+)-backend-sdk-generated-typescript$/u, '@sdkwork/$1-backend-sdk'],

    [/^sdkwork-([a-z0-9-]+)-internal-sdk-generated-typescript$/u, '@sdkwork/$1-internal-sdk'],

    [/^sdkwork-([a-z0-9-]+)-sdk-generated-typescript$/u, '@sdkwork/$1-sdk'],

  ];



  for (const [pattern, scoped] of patterns) {

    const match = packageName.match(pattern);

    if (!match) continue;

    return typeof scoped === 'function' ? scoped(match) : scoped.replace('$1', match[1]);

  }



  return null;

}



export function isConsumerSourcePath(filePath) {

  const norm = filePath.replace(/\\/g, '/');

  if (!/\.(?:tsx?|jsx?|mjs|cjs|json)$/u.test(norm)) return false;

  if (isDebtGuardSourcePath(filePath)) return false;

  if (isGeneratorOwnershipPath(filePath)) return false;

  if (/(^|\/)apps\/[^/]+\/sdks\//u.test(norm)) return false;

  if (/(^|\/)node_modules\//u.test(norm)) return false;

  if (/(^|\/)tools\//u.test(norm) && /sdkwork-specs\//u.test(norm)) return false;

  if (/(^|\/)apps\/[^/]+\/vite\.config\.[cm]?[jt]s$/u.test(norm)) return true;

  if (/(^|\/)apps\/[^/]+\/packages\/[^/]+\//u.test(norm)) return true;

  if (/(^|\/)apps\/[^/]+\/src\//u.test(norm)) return true;

  if (/tsconfig[^/]*\.json$/u.test(norm) && /(^|\/)apps\//u.test(norm)) return true;

  if (/tsconfig[^/]*\.json$/u.test(norm) && /(^|\/)sdkwork-/u.test(norm)) return true;

  if (/(^|\/)vite\.config\.[cm]?[jt]s$/u.test(norm) && /(^|\/)apps\//u.test(norm)) return true;

  if (/(^|\/)sdks\/[^/]+\/[^/]+-typescript\/src\//u.test(norm)) return true;

  if (/(^|\/)package\.json$/u.test(norm)) {

    return /(^|\/)apps\/|(^|\/)packages\//u.test(norm);

  }

  return /(^|\/)apps\/|(^|\/)packages\//u.test(norm);

}



export function shouldSkipDirectory(name) {

  return IGNORE_DIRS.has(name);

}



export function walkFiles(rootDir, predicate = () => true) {

  const results = [];

  if (!fs.existsSync(rootDir)) return results;



  const stack = [rootDir];

  while (stack.length > 0) {

    const current = stack.pop();

    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {

      if (entry.name.startsWith('.')) continue;

      const fullPath = path.join(current, entry.name);

      if (entry.isDirectory()) {

        if (shouldSkipDirectory(entry.name)) continue;

        stack.push(fullPath);

        continue;

      }

      if (predicate(fullPath)) results.push(fullPath);

    }

  }



  return results.sort();

}



export function listWorkspaceRepos(workspaceRoot) {

  const isRepoRoot = (repoRoot) => {

    const base = path.basename(repoRoot);

    if (base === 'node_modules' || base === '.git') return false;

    return fs.existsSync(path.join(repoRoot, 'AGENTS.md'))

      || fs.existsSync(path.join(repoRoot, 'package.json'))

      || fs.existsSync(path.join(repoRoot, 'Cargo.toml'))

      || fs.existsSync(path.join(repoRoot, 'pnpm-workspace.yaml'));

  };

  const repos = [];

  if (isRepoRoot(workspaceRoot)) {

    repos.push(workspaceRoot);

  }

  for (const repoRoot of fs.readdirSync(workspaceRoot, { withFileTypes: true })

    .filter((entry) => entry.isDirectory())

    .map((entry) => path.join(workspaceRoot, entry.name))

    .filter(isRepoRoot)) {

    repos.push(repoRoot);

  }

  return [...new Set(repos)].sort();

}



export const CONSUMER_GENERATED_TRANSPORT_ALIAS_PATTERN =

  /(?:['"][^'"]*(?:[A-Za-z0-9._-]+-typescript\/generated\/(?:domains\/)?server-openapi|sdks\/[a-z0-9-]+-(?:app|backend|internal)-sdk\/generated\/server-openapi)[^'"]*['"]|file:[^"\s]*(?:[A-Za-z0-9._-]+-typescript\/generated\/(?:domains\/)?server-openapi|sdks\/[a-z0-9-]+-(?:app|backend|internal)-sdk\/generated\/server-openapi)[^"\s]*|['"][^'"]*[A-Za-z0-9._-]+-typescript\/src\/index\.ts\/dist[^'"]*['"])/gu;



export function isComposedSdkFacadeSourcePath(filePath) {
  const norm = filePath.replace(/\\/g, '/');
  return /\/sdks\/[^/]+\/[^/]+-typescript\/src\//u.test(norm);
}

export function findViolationsInText(text, filePath) {

  const violations = [];

  const composedFacade = isComposedSdkFacadeSourcePath(filePath);



  for (const match of text.matchAll(LEGACY_GENERATED_TYPESCRIPT_PATTERN)) {

    violations.push({

      file: filePath,

      legacy: match[0],

      scoped: legacyGeneratedPackageToScoped(match[0]) ?? '(unmapped)',

      kind: 'legacy-generated-transport-name',

    });

  }



  for (const match of text.matchAll(NON_STANDARD_SDK_PATH_PATTERN)) {

    violations.push({

      file: filePath,

      legacy: match[0],

      scoped: '(use @sdkwork/<application-code>-app-sdk or @sdkwork/clawrouter-app-sdk/domains)',

      kind: 'non-standard-sdk-path',

    });

  }



  for (const match of text.matchAll(DEEP_GENERATED_TRANSPORT_IMPORT_PATTERN)) {

    if (composedFacade) continue;

    violations.push({

      file: filePath,

      legacy: match[1],

      scoped: '(use composed @sdkwork/*-app-sdk or @sdkwork/*-backend-sdk facade)',

      kind: 'deep-generated-transport-import',

    });

  }



  for (const match of text.matchAll(CROSS_SIBLING_TYPESCRIPT_IMPORT_PATTERN)) {

    if (composedFacade) continue;

    violations.push({

      file: filePath,

      legacy: match[1],

      scoped: '(import generated transport only from ../generated/** within the same SDK family)',

      kind: 'cross-sibling-typescript-import',

    });

  }



  for (const match of text.matchAll(CONSUMER_GENERATED_TRANSPORT_ALIAS_PATTERN)) {

    violations.push({

      file: filePath,

      legacy: match[0],

      scoped: '(point aliases and file: deps at *-typescript/src/index.ts composed facade)',

      kind: 'consumer-generated-transport-alias',

    });

  }



  for (const match of text.matchAll(/@sdk\/(?:composed\/|generated\/)/gu)) {

    violations.push({

      file: filePath,

      legacy: match[0],

      scoped: '(use scoped @sdkwork/<application-code>-app-sdk composed facade)',

      kind: 'non-standard-sdk-shorthand-alias',

    });

  }



  for (const match of text.matchAll(/@sdkwork\/(?:commerce-(?:app|backend)-sdk|clawrouter-(?:app|backend)-domain-transport-sdk)\b/gu)) {

    violations.push({

      file: filePath,

      legacy: match[0],

      scoped: match[0].includes('backend')

        ? '@sdkwork/clawrouter-backend-sdk/domains'

        : '@sdkwork/clawrouter-app-sdk/domains',

      kind: 'retired-scoped-package',

    });

  }



  return violations;

}



export function upsertAgentsImportSection(content) {
  const headingPattern = /^## App SDK Consumer Imports$/m;
  const headingMatch = content.match(headingPattern);
  const envelopeStart = content.indexOf('\n## HTTP API Response Envelope');
  const envelopeIndex = envelopeStart >= 0 ? envelopeStart + 1 : -1;

  if (headingMatch) {
    const start = headingMatch.index;
    const end = envelopeIndex >= 0 && envelopeIndex > start ? envelopeIndex : content.length;
    return `${content.slice(0, start)}${AGENTS_SECTION_BODY}\n\n${content.slice(end).trimStart()}`;
  }

  if (envelopeIndex >= 0) {
    return `${content.slice(0, envelopeIndex)}${AGENTS_SECTION_BODY}\n\n${content.slice(envelopeIndex)}`;
  }

  return `${content.trimEnd()}\n\n${AGENTS_SECTION_BODY}\n`;
}



export function walkAgentsFiles(workspaceRoot) {

  const results = [];

  for (const repoRoot of listWorkspaceRepos(workspaceRoot)) {

    const agentsPath = path.join(repoRoot, 'AGENTS.md');

    if (fs.existsSync(agentsPath)) results.push(agentsPath);

    const appsDir = path.join(repoRoot, 'apps');

    if (!fs.existsSync(appsDir)) continue;

    for (const entry of fs.readdirSync(appsDir, { withFileTypes: true })) {

      if (!entry.isDirectory()) continue;

      const appAgents = path.join(appsDir, entry.name, 'AGENTS.md');

      if (fs.existsSync(appAgents)) results.push(appAgents);

    }

  }

  const specsAgents = path.join(workspaceRoot, 'sdkwork-specs', 'AGENTS.md');

  if (fs.existsSync(specsAgents)) results.push(specsAgents);

  const workspaceAgents = path.join(workspaceRoot, 'AGENTS.md');

  if (fs.existsSync(workspaceAgents)) results.push(workspaceAgents);

  return [...new Set(results)].sort();

}


