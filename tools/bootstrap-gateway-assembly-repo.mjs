#!/usr/bin/env node
/**
 * Bootstrap per-repository gateway assembly wiring:
 * - Cargo workspace member
 * - scripts/gateway/assembly-*.mjs wrappers
 * - package.json gateway:assembly:* scripts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { assemblyCrateDir, discoverRouteCrates, readText, resolveApplicationCode } from './gateway-assembly-lib.mjs';

const MATERIALIZE_SCRIPT = `#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { materializeGatewayAssembly } from '../../../sdkwork-specs/tools/materialize-gateway-assembly.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const result = materializeGatewayAssembly(root);
if (!result.ok) {
  console.error('gateway:assembly:materialize failed: ' + result.message);
  process.exit(1);
}
console.log('gateway:assembly:materialize wrote ' + result.crateDir + ' (' + result.routeCrates + ' route crates)');
`;

const VALIDATE_SCRIPT = `#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateGatewayAssembly } from '../../../sdkwork-specs/tools/validate-gateway-assembly.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const result = validateGatewayAssembly(root);
if (result.skipped) {
  console.log('gateway:assembly:validate skipped (' + result.message + ')');
  process.exit(0);
}
for (const warning of result.warnings) {
  console.warn('warning: ' + warning);
}
if (!result.ok) {
  for (const error of result.errors) {
    console.error('error: ' + error);
  }
  process.exit(1);
}
console.log('gateway:assembly:validate passed for sdkwork-' + result.applicationCode + ' (' + result.routeCrates + ' route crates)');
`;

function ensureWorkspaceMember(root, applicationCode) {
  const cargoPath = path.join(root, 'Cargo.toml');
  const cargoToml = readText(cargoPath);
  if (!cargoToml.includes('[workspace]')) {
    return false;
  }
  const member = assemblyCrateDir(applicationCode);
  if (cargoToml.includes(`"${member}"`)) {
    return false;
  }
  const updated = cargoToml.replace(
    /members\s*=\s*\[/u,
    `members = [\n    "${member}",`,
  );
  fs.writeFileSync(cargoPath, updated, 'utf8');
  return true;
}

function ensureGatewayScripts(root) {
  const scriptsDir = path.join(root, 'scripts', 'gateway');
  fs.mkdirSync(scriptsDir, { recursive: true });
  const materializePath = path.join(scriptsDir, 'assembly-materialize.mjs');
  const validatePath = path.join(scriptsDir, 'assembly-validate.mjs');
  let changed = false;
  if (readText(materializePath) !== MATERIALIZE_SCRIPT) {
    fs.writeFileSync(materializePath, MATERIALIZE_SCRIPT, 'utf8');
    changed = true;
  }
  if (readText(validatePath) !== VALIDATE_SCRIPT) {
    fs.writeFileSync(validatePath, VALIDATE_SCRIPT, 'utf8');
    changed = true;
  }
  return changed;
}

function ensurePackageScripts(root) {
  const packagePath = path.join(root, 'package.json');
  if (!fs.existsSync(packagePath)) {
    return false;
  }
  const pkg = JSON.parse(readText(packagePath).replace(/^\uFEFF/u, ''));
  pkg.scripts ??= {};
  let changed = false;
  if (pkg.scripts['gateway:assembly:materialize'] !== 'node scripts/gateway/assembly-materialize.mjs') {
    pkg.scripts['gateway:assembly:materialize'] = 'node scripts/gateway/assembly-materialize.mjs';
    changed = true;
  }
  if (pkg.scripts['gateway:assembly:validate'] !== 'node scripts/gateway/assembly-validate.mjs') {
    pkg.scripts['gateway:assembly:validate'] = 'node scripts/gateway/assembly-validate.mjs';
    changed = true;
  }
  if (changed) {
    fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  }
  return changed;
}

export function bootstrapGatewayAssemblyRepo(root) {
  const applicationCode = resolveApplicationCode(root);
  const routeCrates = discoverRouteCrates(root, applicationCode);
  if (routeCrates.length === 0) {
    return { ok: true, skipped: true, applicationCode };
  }

  return {
    ok: true,
    applicationCode,
    routeCrates: routeCrates.length,
    workspaceMemberAdded: ensureWorkspaceMember(root, applicationCode),
    scriptsAdded: ensureGatewayScripts(root),
    packageScriptsAdded: ensurePackageScripts(root),
  };
}

function main() {
  const { values } = parseArgs({
    options: {
      root: { type: 'string', default: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..') },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    console.log('Usage: node tools/bootstrap-gateway-assembly-repo.mjs [--root <repo>]');
    process.exit(0);
  }

  const root = path.resolve(values.root);
  const result = bootstrapGatewayAssemblyRepo(root);
  if (result.skipped) {
    console.log(`bootstrap-gateway-assembly skipped for ${path.basename(root)}`);
    process.exit(0);
  }
  console.log(
    `bootstrap-gateway-assembly ${path.basename(root)}: member=${result.workspaceMemberAdded} scripts=${result.scriptsAdded} package=${result.packageScriptsAdded}`,
  );
}

const entry = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === entry) {
  main();
}
