# SDKWork Standards Tools

This directory contains executable validators for SDKWork standards.

Rules:

- Tools in this directory are standards-owned and application-neutral.
- Application repositories may call these tools through thin `package.json` scripts.
- `check-pnpm-script-standard.mjs` validates root scripts, package-local
  script names and command values, default `dev:browser`/`dev:desktop`
  PostgreSQL + `unified-process` + standalone resolution, action-first runtime
  target command names, retired deployment flags, and active Markdown/AGENTS
  plus command-bearing JSON examples against `PNPM_SCRIPT_SPEC.md`.
- `check-agent-workflow-standard.mjs` validates repository/application
  `AGENTS.md` dynamic progressive loading, compatibility shims, relative
  `sdkwork-specs` links, list/search pagination section presence,
  `sdkwork.workflow.json` package target metadata, and
  thin `.github/workflows/package.yml` reusable workflow integration against
  `AGENTS_SPEC.md` and `GITHUB_WORKFLOW_SPEC.md`.
- `align-agents-pagination-standard.mjs` inserts or refreshes the
  `## List And Search Pagination` section in repository `AGENTS.md` files per
  `PAGINATION_SPEC.md` and `AGENTS_SPEC.md`.
- `check-pagination.mjs` heuristically scans for in-process pagination smells
  per `PAGINATION_SPEC.md` §2 and §10.2.
- `check-database-framework-standard.mjs` validates application-root `database/`
  lifecycle assets, locale directories, manifests, L2 contract registries,
  per-engine baseline DDL, and required `db:*` scripts against
  `DATABASE_FRAMEWORK_SPEC.md`.
- `audit-database-framework-workspace.mjs` scans all `sdkwork-*` repositories under
  a workspace root and reports database framework compliance tiers.
- `bootstrap-database-module.mjs` scaffolds a standard `database/` module from
  `templates/database/` using `database-module-registry.json`.
- `check-identity-naming.mjs` validates identity lattice terminology in standards
  (`NAMING_SPEC.md` §0–§0.2) and scans consumer repositories for retired identity
  placeholders, commerce `product` overloads, non-canonical Rust HTTP route crate names,
  `identity` domain packages, and related patterns. See `MIGRATION_SPEC.md` §8.
- `check-iam-web-adapter-standard.mjs` scans consumer repositories for canonical IAM
  web-adapter integration (`IamWebRequestContextResolver`,
  `iam_web_request_context_resolver_from_env`) and blocks legacy resolver imports,
  deprecated factory calls, and application-local pass-through resolver wrappers per
  `IAM_SPEC.md` and `WEB_FRAMEWORK_SPEC.md`.
- Tools must not embed application-specific secrets, local paths, or application-line behavior.
