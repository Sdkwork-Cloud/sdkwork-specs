#!/usr/bin/env node
/**
 * Run SDK generation scripts across sdkwork-space repositories.
 * Prefer `node ../bin/generate-all-sdks.mjs` for full discovery; this entry
 * remains for sdkwork-specs tooling compatibility.
 */
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const specsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entrypoint = path.join(specsRoot, '..', 'bin', 'generate-all-sdks.mjs');

const { main } = await import(pathToFileURL(entrypoint).href);
main();
