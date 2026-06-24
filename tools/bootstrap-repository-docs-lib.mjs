import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CANON_PATHS } from './repository-docs-paths.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_ROOT = path.join(__dirname, '..', 'templates', 'docs');

const SKELETON_READMES = [
  'docs/README.md',
  'docs/product/README.md',
  'docs/product/prd/README.md',
  'docs/product/requirements/README.md',
  'docs/product/roadmap/README.md',
  'docs/architecture/README.md',
  'docs/architecture/tech/README.md',
  'docs/architecture/decisions/README.md',
  'docs/architecture/views/README.md',
  'docs/engineering/README.md',
  'docs/engineering/plans/README.md',
  'docs/engineering/reviews/README.md',
  'docs/guides/README.md',
  'docs/guides/developer/README.md',
  'docs/guides/operator/README.md',
  'docs/guides/integrator/README.md',
  'docs/runbooks/README.md',
  'docs/changelogs/README.md',
  'docs/migrations/README.md',
  'docs/releases/README.md',
  'docs/domains/README.md',
  'docs/archive/README.md',
];

function readTemplate(relativePath) {
  return fs.readFileSync(path.join(TEMPLATE_ROOT, relativePath), 'utf8');
}

function substituteTemplate(text, values) {
  return text
    .replaceAll('<Product Name>', values.productName)
    .replaceAll('<application-code>', values.applicationCode)
    .replaceAll('<team-or-person>', values.owner)
    .replaceAll('YYYY-MM-DD', values.updated);
}

function writeIfMissing(root, relativePath, content, force) {
  const absolutePath = path.join(root, relativePath);
  if (fs.existsSync(absolutePath) && !force) {
    return false;
  }
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content);
  return true;
}

function defaultDocsReadme(values) {
  return `# ${values.productName} Documentation

## Audience Routing

| I am… | Read first | Then read |
| --- | --- | --- |
| Product or business | [product/prd/PRD.md](product/prd/PRD.md) | [product/requirements/](product/requirements/) |
| Architect | [architecture/tech/TECH_ARCHITECTURE.md](architecture/tech/TECH_ARCHITECTURE.md) | [architecture/decisions/](architecture/decisions/) |
| Developer | [guides/developer/README.md](guides/developer/README.md) | [engineering/plans/](engineering/plans/) |
| Operator | [guides/operator/README.md](guides/operator/README.md) | [runbooks/](runbooks/) |
| Integrator | [guides/integrator/README.md](guides/integrator/README.md) | repository \`apis/\` and \`sdks/\` |
| Agent | [../AGENTS.md](../AGENTS.md) | [INDEX.yaml](INDEX.yaml) |

## Canon Documents

| Document | Path |
| --- | --- |
| Product PRD | [product/prd/PRD.md](product/prd/PRD.md) |
| Technical architecture | [architecture/tech/TECH_ARCHITECTURE.md](architecture/tech/TECH_ARCHITECTURE.md) |

## Related Specs

- \`DOCUMENTATION_SPEC.md\`
- \`SDKWORK_WORKSPACE_SPEC.md\`
- \`REQUIREMENTS_SPEC.md\`
- \`ARCHITECTURE_DECISION_SPEC.md\`

## Verification

\`\`\`bash
node ../sdkwork-specs/tools/check-repository-docs-standard.mjs --root .
\`\`\`
`;
}

function defaultAreaReadme(title, description) {
  return `# ${title}

${description}

See \`DOCUMENTATION_SPEC.md\` section 2.
`;
}

export function bootstrapRepositoryDocs(root, options = {}) {
  const force = Boolean(options.force);
  const applicationCode = options.applicationCode || path.basename(root);
  const productName = options.productName || applicationCode;
  const owner = options.owner || '<team-or-person>';
  const updated = options.updated || new Date().toISOString().slice(0, 10);
  const values = { applicationCode, productName, owner, updated };

  const created = [];

  const canonFiles = [
    [CANON_PATHS.prd, substituteTemplate(readTemplate('product/prd/PRD.md'), values)],
    [CANON_PATHS.techArchitecture, substituteTemplate(readTemplate('architecture/tech/TECH_ARCHITECTURE.md'), values)],
    [CANON_PATHS.prdDirReadme, readTemplate('product/prd/README.md')],
    [CANON_PATHS.techDirReadme, readTemplate('architecture/tech/README.md')],
    ['docs/INDEX.yaml', substituteTemplate(readTemplate('INDEX.yaml'), values)],
  ];

  for (const [relativePath, content] of canonFiles) {
    if (writeIfMissing(root, relativePath, content, force)) {
      created.push(relativePath);
    }
  }

  if (writeIfMissing(root, 'docs/README.md', defaultDocsReadme(values), force)) {
    created.push('docs/README.md');
  }

  const areaReadmes = {
    'docs/product/README.md': defaultAreaReadme('Product Documentation', 'Product PRD directory, requirements, and roadmap.'),
    'docs/architecture/README.md': defaultAreaReadme('Architecture Documentation', 'Technical architecture directory, ADRs, and views.'),
    'docs/architecture/decisions/README.md': [
      '# Architecture Decision Records',
      '',
      'New ADRs use `ADR-YYYYMMDD-<short-title>.md` in this directory.',
      '',
      'Retired layout: `docs/adr/` must not be used for new ADRs.',
      '',
      'See `ARCHITECTURE_DECISION_SPEC.md`.',
      '',
    ].join('\n'),
    'docs/product/requirements/README.md': defaultAreaReadme('Engineering Requirements', 'Implementable `REQ-*` records governed by `REQUIREMENTS_SPEC.md`.'),
    'docs/engineering/README.md': defaultAreaReadme('Engineering Collaboration', 'Implementation plans and review records.'),
    'docs/guides/README.md': defaultAreaReadme('Guides', 'Role-based developer, operator, and integrator guides.'),
    'docs/guides/developer/README.md': defaultAreaReadme('Developer Guide', 'Local setup, verification, and contribution workflow.'),
    'docs/guides/operator/README.md': defaultAreaReadme('Operator Guide', 'Deployment, monitoring, and incident response entrypoints.'),
    'docs/guides/integrator/README.md': defaultAreaReadme('Integrator Guide', 'SDK consumption, API boundaries, and integration examples.'),
    'docs/archive/README.md': defaultAreaReadme('Archive', 'Read-only retired documentation with stable links.'),
    'docs/domains/README.md': defaultAreaReadme('Domain Extensions', 'Register domain-specific documentation directories here.'),
  };

  for (const relativePath of SKELETON_READMES) {
    const content = areaReadmes[relativePath]
      || defaultAreaReadme(path.basename(path.dirname(relativePath)), 'See `DOCUMENTATION_SPEC.md` section 2.');
    if (writeIfMissing(root, relativePath, content, force)) {
      created.push(relativePath);
    }
  }

  return { created, values };
}
