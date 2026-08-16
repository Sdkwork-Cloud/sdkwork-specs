/**
 * Rust publisher.
 *
 * Publishes a crate to crates.io via `cargo publish`. Workspace `[workspace]`
 * roots and virtual manifests are skipped — only leaf package manifests are
 * publishable.
 *
 * Credentials: `CARGO_REGISTRY_TOKEN`.
 */
import fs from 'node:fs';
import path from 'node:path';

import { readText, runCommand, toDisplayPath } from '../util.mjs';

export const language = 'rust';
export const registry = 'crates.io';

function parseCargoNameVersion(cargoTomlPath) {
  const text = readText(cargoTomlPath);
  if (!text) return null;

  // Minimal TOML read: `[package]` section `name` and `version`.
  let inPackage = false;
  let name = null;
  let version = null;
  let isWorkspaceMember = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.startsWith('[')) {
      inPackage = line === '[package]';
      if (line === '[workspace]') isWorkspaceMember = true;
      continue;
    }
    if (!inPackage) continue;
    const m = line.match(/^(name|version)\s*=\s*"([^"]+)"/);
    if (m) {
      if (m[1] === 'name') name = m[2];
      if (m[1] === 'version') version = m[2];
    }
  }

  if (!name || !version) return null;
  return { name, version, isWorkspaceMember };
}

export function detect(familyRoot, _manifest) {
  const stem = path.basename(familyRoot);
  const candidates = [
    path.join(familyRoot, `${stem}-rust`),
    path.join(familyRoot, 'rust'),
    familyRoot,
  ];

  for (const candidate of candidates) {
    const cargoPath = path.join(candidate, 'Cargo.toml');
    if (!fs.existsSync(cargoPath)) continue;
    const info = parseCargoNameVersion(cargoPath);
    if (!info) continue;
    // A `[workspace]` table with no `[package]` is a virtual manifest.
    if (info.isWorkspaceMember && !info.name) continue;
    return {
      packageName: info.name,
      version: info.version,
      packagePath: candidate,
      packageJsonPath: cargoPath,
    };
  }
  return null;
}

export function build(pkgPath, { skipBuild }) {
  if (skipBuild) return { ok: true, detail: 'skipped build' };
  const r = runCommand('cargo', ['build', '--release'], { cwd: pkgPath });
  if (r.error || r.status !== 0) {
    return { ok: false, detail: `cargo build failed (status ${r.status ?? 'null'})` };
  }
  return { ok: true, detail: 'built' };
}

export function publish(pkgPath, { env = {} }) {
  // `--no-verify` because we already ran `cargo build` above; avoids a second compile.
  const r = runCommand('cargo', ['publish', '--no-verify'], { cwd: pkgPath, env });
  if (r.error || r.status !== 0) {
    return { ok: false, detail: `cargo publish exit ${r.status ?? 'null'} at ${toDisplayPath(pkgPath)}` };
  }
  return { ok: true, detail: 'published to crates.io' };
}

export function credentialName() {
  return 'CARGO_REGISTRY_TOKEN';
}

export function hasCredentials(env) {
  return Boolean(env.CARGO_REGISTRY_TOKEN);
}
