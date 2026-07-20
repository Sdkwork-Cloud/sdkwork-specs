#!/usr/bin/env node
/**
 * One-shot normative terminology migration for sdkwork-specs markdown.
 * Safe to re-run: skips lines that already use canonical tokens.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LEGACY_HTTP_ROUTE_PREFIX,
  legacyFoundationPcReactName,
} from './lib/naming-patterns.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SKIP_DIRS = new Set(['node_modules', '.git']);
const INCLUDE_EXT = new Set(['.md', '.mjs']);

function walk(dir, files = []) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, files);
    else if (INCLUDE_EXT.has(path.extname(name)) && name !== 'migrate-identity-terminology.mjs') {
      files.push(full);
    }
  }
  return files;
}

const orderedReplacements = [
  ['<product>', '<application-code>'],
  ['sdkwork_<product>_', 'sdkwork_<application_code>_'],
  ['sdkwork-commerce-product-service', 'sdkwork-commerce-merchandise-service'],
  ['sdkwork-commerce-pc-product', 'sdkwork-commerce-pc-merchandise'],
  ['sdkwork-commerce-h5-product', 'sdkwork-commerce-h5-merchandise'],
  ['react-backend-product', 'react-backend-merchandise'],
  ['capability: product', 'capability: merchandise'],
  ['sdkwork-<app>-api-server', 'sdkwork-<application-code>-api-server'],
  ['sdkwork-<app>-service-host', 'sdkwork-<application-code>-service-host'],
  ['sdkwork-<app>-native-host', 'sdkwork-<application-code>-native-host'],
  ['sdkwork-<app>-tauri-host', 'sdkwork-<application-code>-tauri-host'],
  ['sdkwork-<app>-gateway', 'sdkwork-<application-code>-gateway'],
  ['sdkwork-<app>-server-runtime', 'sdkwork-<application-code>-server-runtime'],
  ['sdkwork-<app>-product', 'sdkwork-<application-code>-product'],
  ['sdkwork-<app>-runtime', 'sdkwork-<application-code>-runtime'],
  ['sdkwork-<app>-backend', 'sdkwork-<application-code>-backend'],
  ['sdkwork-<app>-core', 'sdkwork-<application-code>-core'],
  ['sdkwork-<app>-common', 'sdkwork-<application-code>-common'],
  ['sdkwork-<app>-manager', 'sdkwork-<application-code>-manager'],
  ['Product repository', 'SDKWork repository'],
  ['product-prefixed', 'application-code-prefixed'],
  ['product-prefix', 'application-code-prefix'],
  ['product-specific', 'application-specific'],
  ['product-local', 'application-local'],
  ['product-owned', 'application-owned'],
  ['product feature', 'application feature'],
  ['product users', 'app users'],
  ['product-user', 'app-user'],
  ['cross-product', 'cross-application'],
  ['For product code', 'For application code'],
  ['product code', 'application code'],
  ['identify the product client', 'identify the application client'],
  ['SDKWORK_<APP>_', 'SDKWORK_<APPLICATION_CODE>_'],
  ['SDKWORK_<APP>_<DEPENDENCY>', 'SDKWORK_<APPLICATION_CODE>_<DEPENDENCY>'],
  ['VITE_<APP>_', 'VITE_<APP_CODE>_'],
  ['sdkwork/<app>', 'sdkwork/<application-code>'],
  ['/.sdkwork/<app>', '/.sdkwork/<application-code>'],
  ['~/.sdkwork/<app>', '~/.sdkwork/<application-code>'],
  ['%USERPROFILE%\\.sdkwork\\<app>', '%USERPROFILE%\\.sdkwork\\<application-code>'],
  ['product or capability line', 'application or capability line'],
  ['one product prefix per product family', 'one application-code prefix per application family'],
  ['Product-prefixed root script names', 'Application-code-prefixed root script names'],
  ['legacy:<product>:', 'legacy:<application-code>:'],
  ['<product>:dev', '<application-code>:dev'],
  ['<product>:build', '<application-code>:build'],
  ['<product>:release', '<application-code>:release'],
  ['API product', 'API authority'],
  ['logical API product', 'logical API authority'],
  ['A business capability may be named `product`', 'Commerce merchandise capability uses `merchandise`'],
  ['for example `sdkwork-commerce-product-service`. The forbidden form is using `product`',
    'for example `sdkwork-commerce-merchandise-service`. The forbidden form is using `product`'],
  ['product, cart, order, payment, catalog', 'merchandise, cart, order, payment, catalog'],
  ['such as product, cart, order', 'such as merchandise, cart, order'],
];

function migrateRouteCratePrefix(content) {
  return content.replace(
    new RegExp(
      `${LEGACY_HTTP_ROUTE_PREFIX}([a-z0-9]+)-(open-api|app-api|backend-api|internal-api)`,
      'gu',
    ),
    'sdkwork-routes-$1-$2',
  );
}

function migrateCommerceProductRouteTokens(content) {
  return content
    .replace(/sdkwork-routes-merchandise-/gu, 'sdkwork-routes-merchandise-')
    .replace(/routes-merchandise-/gu, 'routes-merchandise-');
}

function migrateShortRoutePrefix(content) {
  return content.replace(
    /router-([a-z0-9]+)-(open-api|app-api|backend-api|internal-api)/gu,
    'routes-$1-$2',
  );
}

function migrateFoundationPcReact(content) {
  const legacyFoundation = legacyFoundationPcReactName();
  return content.includes(legacyFoundation)
    ? content.split(legacyFoundation).join('sdkwork-shell-pc-react')
    : content;
}

function migrate(content) {
  let out = content;
  for (const [from, to] of orderedReplacements) {
    out = out.split(from).join(to);
  }
  out = migrateRouteCratePrefix(out);
  out = migrateCommerceProductRouteTokens(out);
  out = migrateShortRoutePrefix(out);
  return migrateFoundationPcReact(out);
}

let changed = 0;
for (const file of walk(root)) {
  if (file.includes('unify-postgres-profile') || file.includes('check-unified-postgres')) continue;
  const before = fs.readFileSync(file, 'utf8');
  const after = migrate(before);
  if (after !== before) {
    fs.writeFileSync(file, after, 'utf8');
    changed += 1;
    console.log(path.relative(root, file));
  }
}
console.log(`Updated ${changed} files.`);
