/**
 * Shared helpers for SDK publish tooling.
 *
 * Conventions:
 * - All language publishers receive normalized absolute paths.
 * - Commands run via `runCommand`, which uses a shell on Windows so that
 *   `pnpm`, `cargo`, `mvn`, `dart`, `python`, `gh` resolve via PATHEXT.
 * - Logs are emitted through `log`/`warn` so the orchestrator can prefix them.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Run a command, inheriting stdio by default. Returns the full result.
 *
 * @param {string} command - executable name, e.g. `pnpm`, `cargo`
 * @param {string[]} args - arguments
 * @param {object} [options]
 * @param {string} [options.cwd] - working directory
 * @param {object} [options.env] - merged into process.env
 * @param {'inherit'|'pipe'|'ignored'} [options.stdio] - default `inherit`
 * @returns {import('node:child_process').SpawnSyncReturns<string>}
 */
export function runCommand(command, args, options = {}) {
  const { cwd, env, stdio = 'inherit' } = options;
  return spawnSync(command, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio,
    shell: process.platform === 'win32',
  });
}

/**
 * Read JSON safely; returns `null` when missing or unparseable.
 * @param {string} filePath
 * @returns {object|null}
 */
export function readJson(filePath) {
  try {
    const text = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Read text safely; returns `null` when missing.
 * @param {string} filePath
 * @returns {string|null}
 */
export function readText(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

/**
 * Normalize a path for cross-platform display (forward slashes).
 * @param {string} p
 * @returns {string}
 */
export function toDisplayPath(p) {
  return p.replace(/\\/g, '/');
}

/**
 * Resolve the family-relative directory for a language.
 *
 * Conventional names tried in order:
 *   1. `<stem>-<language>` (e.g. `sdkwork-im-app-sdk-typescript`)
 *   2. `<language>` (e.g. `typescript`)
 *   3. Any subdirectory ending with `-<language>`
 *
 * @param {string} familyRoot - absolute path to `sdks/<family>`
 * @param {string} language - `typescript` | `rust` | `java` | `flutter` | `python` | `go`
 * @returns {string|null} absolute path to the language package root, or null
 */
export function findLanguageRoot(familyRoot, language) {
  if (!fs.existsSync(familyRoot)) return null;
  const stem = path.basename(familyRoot);
  const canonical = path.join(familyRoot, `${stem}-${language}`);
  if (fs.existsSync(canonical)) return canonical;

  const plain = path.join(familyRoot, language);
  if (fs.existsSync(plain)) return plain;

  for (const entry of fs.readdirSync(familyRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name.endsWith(`-${language}`)) {
      return path.join(familyRoot, entry.name);
    }
  }
  return null;
}

/**
 * Whether a version string looks like a pre-release.
 * Treats `0.x` and any SemVer pre-release suffix (`-rc.1`, `-beta`, `-alpha-1`)
 * as pre-release. Build metadata (`+build`) is ignored.
 * @param {string} version
 * @returns {boolean}
 */
export function isPreRelease(version) {
  const core = String(version).split('+')[0];
  if (core.includes('-')) return true;
  return /^0\./.test(core);
}

/** Console wrapper so callers can swap sinks if needed. */
export const log = (...args) => console.log(...args);
export const warn = (...args) => console.warn(...args);
