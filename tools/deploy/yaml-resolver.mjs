import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let cachedYaml;

function yamlCandidates(repoRoot) {
  const resolvedRoot = path.resolve(repoRoot);
  return [
    path.join(resolvedRoot, 'node_modules'),
    path.join(resolvedRoot, '../sdkwork-deployments/node_modules'),
    path.join(__dirname, '../../../sdkwork-deployments/node_modules'),
    path.join(__dirname, '../../sdkwork-deployments/node_modules'),
  ];
}

export function getYaml(repoRoot = process.cwd()) {
  if (cachedYaml) return cachedYaml;

  const require = createRequire(path.join(path.resolve(repoRoot), 'package.json'));
  for (const candidate of yamlCandidates(repoRoot)) {
    try {
      cachedYaml = require(require.resolve('yaml', { paths: [candidate] }));
      return cachedYaml;
    } catch {
      // try next candidate
    }
  }

  throw new Error(
    'yaml package not found; run pnpm install in sdkwork-deployments or the target repository',
  );
}

export function parseYaml(text, repoRoot) {
  return getYaml(repoRoot).parse(text);
}

export function stringifyYaml(value, repoRoot) {
  return getYaml(repoRoot).stringify(value);
}
