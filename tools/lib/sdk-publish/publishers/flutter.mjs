/**
 * Flutter / Dart publisher.
 *
 * Publishes a Dart package to pub.dev via `dart pub publish`. Packages with
 * `publish_to: none` in `pubspec.yaml` are explicitly skipped — that field
 * marks a package as private (per pub.dev convention).
 *
 * Credentials: `PUB_DEV_TOKEN` (OAUTH2 access token) or interactive login.
 */
import fs from 'node:fs';
import path from 'node:path';

import { readText, runCommand, toDisplayPath } from '../util.mjs';

export const language = 'flutter';
export const registry = 'pub.dev';

function parsePubspec(pubspecPath) {
  const text = readText(pubspecPath);
  if (!text) return null;

  // Minimal YAML read: top-level `name`, `version`, and `publish_to`.
  let name = null;
  let version = null;
  let publishTo = undefined;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+$/, '');
    if (/^\S/.test(line) === false && line.trim() === '') continue;
    if (!/^[a-zA-Z_]/.test(line)) continue;

    const m = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let value = m[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);

    if (key === 'name') name = value;
    else if (key === 'version') version = value;
    else if (key === 'publish_to') publishTo = value;
  }

  if (!name || !version) return null;
  return { name, version, publishTo };
}

export function detect(familyRoot, _manifest) {
  const stem = path.basename(familyRoot);
  const candidates = [
    path.join(familyRoot, `${stem}-flutter`),
    path.join(familyRoot, `${stem}-dart`),
    path.join(familyRoot, 'flutter'),
    path.join(familyRoot, 'dart'),
  ];

  for (const candidate of candidates) {
    const pubspecPath = path.join(candidate, 'pubspec.yaml');
    if (!fs.existsSync(pubspecPath)) continue;
    const info = parsePubspec(pubspecPath);
    if (!info) continue;
    if (info.publishTo === 'none') continue;
    return {
      packageName: info.name,
      version: info.version,
      packagePath: candidate,
      packageJsonPath: pubspecPath,
    };
  }
  return null;
}

export function build(pkgPath, { skipBuild }) {
  if (skipBuild) return { ok: true, detail: 'skipped build' };
  const r = runCommand('dart', ['pub', 'get'], { cwd: pkgPath });
  if (r.error || r.status !== 0) {
    return { ok: false, detail: `dart pub get failed (status ${r.status ?? 'null'})` };
  }
  return { ok: true, detail: 'pub get done' };
}

export function publish(pkgPath, { env = {} }) {
  // `--force` skips the interactive confirmation prompt for CI use.
  const r = runCommand('dart', ['pub', 'publish', '--force'], { cwd: pkgPath, env });
  if (r.error || r.status !== 0) {
    return { ok: false, detail: `dart pub publish exit ${r.status ?? 'null'} at ${toDisplayPath(pkgPath)}` };
  }
  return { ok: true, detail: 'published to pub.dev' };
}

export function credentialName() {
  return 'PUB_DEV_TOKEN';
}

export function hasCredentials(env) {
  return Boolean(env.PUB_DEV_TOKEN);
}
