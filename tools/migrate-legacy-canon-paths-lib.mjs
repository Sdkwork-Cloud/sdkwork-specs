import fs from 'node:fs';
import path from 'node:path';

import {
  CANON_PATHS,
  LEGACY_CANON_PATHS,
  isLegacyRedirectStub,
  prdRedirectStub,
  techRedirectStub,
} from './repository-docs-paths.mjs';

function readText(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return fs.readFileSync(filePath, 'utf8');
}

function writeText(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text);
}

function migratePair(root, legacyRelative, newRelative, redirectFactory) {
  const legacyPath = path.join(root, legacyRelative);
  const newPath = path.join(root, newRelative);
  const legacyText = readText(legacyPath);
  const newText = readText(newPath);
  const migrated = [];

  if (legacyText && !isLegacyRedirectStub(legacyText)) {
    if (!newText) {
      writeText(newPath, legacyText);
      migrated.push(`migrated ${legacyRelative} -> ${newRelative}`);
    }
    writeText(legacyPath, redirectFactory());
    migrated.push(`redirect ${legacyRelative}`);
  }

  return migrated;
}

export function migrateLegacyCanonPaths(root) {
  return [
    ...migratePair(root, LEGACY_CANON_PATHS.prd, CANON_PATHS.prd, prdRedirectStub),
    ...migratePair(
      root,
      LEGACY_CANON_PATHS.techArchitecture,
      CANON_PATHS.techArchitecture,
      techRedirectStub,
    ),
  ];
}

export function ensureCanonDirReadmes(root) {
  const created = [];
  const readmes = {
    [CANON_PATHS.prdDirReadme]: `# Product PRD Directory

This directory owns the product Canon for the repository.

## Fixed Entry

- [PRD.md](PRD.md) — required entry document. Keep summary, status, and links here.

## Splitting Rules

- Split large PRD content into sibling shards named \`PRD-<kebab-topic>.md\`.
- Every shard \`MUST\` be linked from \`PRD.md\`.
- Do not create competing product roots such as \`docs/product/PRD.md\`; that path is retired and redirect-only.

See \`DOCUMENTATION_SPEC.md\` section 2.2.
`,
    [CANON_PATHS.techDirReadme]: `# Technical Architecture Directory

This directory owns the technical architecture Canon for the repository.

## Fixed Entry

- [TECH_ARCHITECTURE.md](TECH_ARCHITECTURE.md) — required entry document. Keep summary, status, and links here.

## Splitting Rules

- Split large architecture content into sibling shards named \`TECH-<kebab-topic>.md\`.
- Every shard \`MUST\` be linked from \`TECH_ARCHITECTURE.md\`.
- Do not create competing architecture roots such as \`docs/architecture/TECH_ARCHITECTURE.md\`; that path is retired and redirect-only.

See \`DOCUMENTATION_SPEC.md\` section 2.2.
`,
  };

  for (const [relativePath, content] of Object.entries(readmes)) {
    const absolutePath = path.join(root, relativePath);
    if (!fs.existsSync(absolutePath)) {
      writeText(absolutePath, content);
      created.push(relativePath);
    }
  }

  return created;
}
