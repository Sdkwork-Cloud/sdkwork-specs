export const CANON_PATHS = {
  index: 'docs/README.md',
  prd: 'docs/product/prd/PRD.md',
  techArchitecture: 'docs/architecture/tech/TECH_ARCHITECTURE.md',
  prdDirReadme: 'docs/product/prd/README.md',
  techDirReadme: 'docs/architecture/tech/README.md',
  productReadme: 'docs/product/README.md',
  architectureReadme: 'docs/architecture/README.md',
};

export const LEGACY_CANON_PATHS = {
  prd: 'docs/product/PRD.md',
  techArchitecture: 'docs/architecture/TECH_ARCHITECTURE.md',
};

export const REQUIRED_CANON_LINKS = [
  CANON_PATHS.index,
  CANON_PATHS.prd,
  CANON_PATHS.techArchitecture,
];

export const PRD_SHARD_PATTERN = /^PRD-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/u;
export const TECH_SHARD_PATTERN = /^TECH-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/u;

export function prdRedirectStub() {
  return `# Moved

This Canon entry moved to [PRD.md](prd/PRD.md).

Do not add new product PRD content here.
`;
}

export function techRedirectStub() {
  return `# Moved

This Canon entry moved to [TECH_ARCHITECTURE.md](tech/TECH_ARCHITECTURE.md).

Do not add new technical architecture content here.
`;
}

export function isLegacyRedirectStub(text) {
  return /#\s+Moved\b/iu.test(text) && /\]\((?:\.\/)?(?:prd\/PRD\.md|tech\/TECH_ARCHITECTURE\.md)\)/iu.test(text);
}
