#!/usr/bin/env node
/** Reduce second-order ambiguous terminology in sdkwork-specs markdown. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['node_modules', '.git', 'migrate-identity-terminology.mjs', 'migrate-ambiguity-terminology.mjs']);

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
  ['owns product app-api', 'owns app-api'],
  ['protected product app-api', 'protected app-api'],
  ['downstream product app-api', 'downstream app-api'],
  ['product app-api SDK', 'app-api SDK'],
  ['Product applications compose', 'Consuming applications compose'],
  ['Product applications ', 'Application repositories '],
  ['Product application servers', 'Application servers'],
  ['Product application dev runners', 'Application dev runners'],
  ['Product application runtime config', 'Application runtime config'],
  ['Product-local server env', 'Application-local server env'],
  ['Product application uses one', 'The application uses one'],
  ['one product application root', 'one application root'],
  ['A PC application is one product application root', 'A PC application is one application root'],
  ['Product apps `MUST', 'Consuming applications `MUST'],
  ['Product apps may', 'Consuming applications may'],
  ['product apps without', 'consuming applications without'],
  ['into the product repo', 'into the application repository'],
  ['into product SDK families', 'into application-owned SDK families'],
  ['product SDK families', 'application-owned SDK families'],
  ['product SDK base URLs', 'application-owned SDK base URLs'],
  ['product repositories implement', 'application repositories implement'],
  ['product repositories `MUST', 'application repositories `MUST'],
  ['appbase or product repositories', 'appbase or application repositories'],
  ['another product app.', 'another application.'],
  ['product app does not', 'application does not'],
  ['product app login', 'application login'],
  ['product approval', 'governance approval'],
  ['product overrides', 'application-line overrides'],
  ['product prefix such', 'application-code prefix such'],
  ['product-owned internal', 'application-owned internal'],
  ['product-server upstream', 'application-server upstream'],
  ['| Product app or app shell |', '| Application shell or client app root |'],
  ['to product apps.', 'to consuming applications.'],
  ['from product apps.', 'from consuming applications.'],
  ['a product application\'s same-origin', 'an application\'s same-origin'],
  ['shared foundation gateway', 'shared platform connectivity-plane gateway'],
  ['shared foundation APIs', 'shared platform foundation APIs'],
  ['foundation API runtime crates', 'platform foundation API runtime crates'],
  ['PRODUCT_OR_PLATFORM', 'PLATFORM_OR_APPLICATION_CODE'],
  ['For application-specific products:', 'For SDKWork application private runtime values:'],
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
