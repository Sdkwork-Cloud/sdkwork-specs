#!/usr/bin/env node
/** Second pass: remaining product/application ambiguity in specs. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['node_modules', '.git']);

function walk(dir, files = []) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, files);
    else if (name.endsWith('.md')) files.push(full);
  }
  return files;
}

const replacements = [
  ['without reimplementing auth flows in product apps', 'without reimplementing auth flows in consuming applications'],
  ['Product repositories `SHOULD', 'Application repositories `SHOULD'],
  ['Product RPC SDK', 'Application RPC SDK'],
  ['Product names `MUST NOT` be the first segment', 'Application-code tokens `MUST NOT` be the first segment'],
  ['## 6. Forbidden Product Prefixes', '## 6. Forbidden Application-Code Prefixes'],
  ['| Product core package |', '| Application core package |'],
  ['Product/dependency app SDKs', 'Application and dependency app SDKs'],
  ['Product open-api SDKs', 'Application open-api SDKs'],
  ['product-side `createIamRuntime', 'application-side `createIamRuntime'],
  ['Product auth runtime', 'Application auth runtime'],
  ['Product app does not', 'Application does not'],
  ['Product override files', 'Application-line override files'],
  ['by product package', 'by application package'],
  ['one product-wide override', 'one application-wide override'],
  ['Product overrides preserve', 'Application-line overrides preserve'],
  ['Product business code', 'Application business code'],
  ["a product app's verified", "an application's verified"],
  ['-> product app-api/backend-api/open-api SDKs', '-> app-api/backend-api/open-api SDKs'],
  ['the product application uses one', 'the application uses one'],
  ['Product Rust services', 'Application Rust services'],
  ['Product PC React packages', 'Application PC React packages'],
  ['Product packages `MUST NOT', 'Application packages `MUST NOT'],
  ['import product app shells', 'import application app shells'],
  ['Product open-api and app-api', 'Application open-api and app-api'],
  ['Product app login/session', 'Application login/session'],
  ['Product features `MUST', 'Application features `MUST'],
  ['Product modules must', 'Application modules must'],
  ['| App RPC | `app.v3` | Product clients,', '| App RPC | `app.v3` | Application clients,'],
  ['## 6. Product Catalog Profile', '## 6. Merchandise Catalog Profile'],
  ['| `system` | Product settings,', '| `system` | Application settings,'],
  ['| Product or capability | Application code |', '| Application line or capability | Application code |'],
  ['Product purpose such', 'Release purpose such'],
  ['Product and engineering requirements', 'Business and engineering requirements'],
];

let changed = 0;
for (const file of walk(root)) {
  if (file.includes('MIGRATION_SPEC.md')) continue;
  let text = fs.readFileSync(file, 'utf8');
  let out = text;
  for (const [from, to] of replacements) out = out.split(from).join(to);
  if (out !== text) {
    fs.writeFileSync(file, out, 'utf8');
    changed += 1;
    console.log(path.relative(root, file));
  }
}
console.log(`Updated ${changed} files.`);
