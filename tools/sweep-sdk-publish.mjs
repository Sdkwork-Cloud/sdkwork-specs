#!/usr/bin/env node
/**
 * Publish SDK packages across sdkwork-space repositories.
 * Prefer `node ../bin/publish-all-sdks.mjs` for workspace bin entry; this
 * wrapper remains for sdkwork-specs tooling compatibility.
 */
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const specsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entrypoint = path.join(specsRoot, 'tools', 'publish-sdk.mjs');

const { main } = await import(pathToFileURL(entrypoint).href);
await main(process.argv.slice(2));
