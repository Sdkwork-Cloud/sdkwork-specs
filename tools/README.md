# SDKWork Standards Tools

This directory contains executable validators for SDKWork standards.

Rules:

- Tools in this directory are standards-owned and application-neutral.
- Application repositories may call these tools through thin `package.json` scripts.
- `check-pnpm-script-standard.mjs` validates root scripts, package-local
  script names and command values, default `dev:browser`/`dev:desktop`
  PostgreSQL + standalone + development resolution, action-first runtime
  target command names, retired deployment flags, and active Markdown/AGENTS
  plus command-bearing JSON examples against `PNPM_SCRIPT_SPEC.md`.
- `check-agent-workflow-standard.mjs` validates repository/application
  `AGENTS.md` dynamic progressive loading, compatibility shims, relative
  `sdkwork-specs` links, and list/search pagination section presence. For
  application/package repositories it also validates `sdkwork.workflow.json`
  package target metadata and thin `.github/workflows/package.yml` reusable
  workflow integration; `repository-kind: standards` roots skip application
  packaging workflow requirements.
- `align-agents-pagination-standard.mjs` inserts or refreshes the
  `## List And Search Pagination` section in repository `AGENTS.md` files per
  `PAGINATION_SPEC.md` and `AGENTS_SPEC.md`.
- `check-api-operation-patterns.mjs` validates SDKWork-owned custom OpenAPI
  operations against `API_SPEC.md` section 15.4: operationId action alignment,
  create `201`, update `200`, delete `204` without JSON bodies, command/bulk
  status rules, and operation-level vendor compatibility exemptions.
- `check-api-response-envelope.mjs` validates SDKWork-owned custom OpenAPI
  response envelopes and problem details for app-api, backend-api, and business
  open-api authorities, while skipping only operation-level external protocol
  compatibility routes.
- `check-route-path-collisions.mjs` validates normalized route registry
  uniqueness across route manifests and OpenAPI authorities. It fails when
  distinct operations share the same `(surface, method, path)` after path
  template normalization.
- `check-permission-composition.mjs` validates client application permission
  composition for HTTP `sdkDependencies`: required `contracts.permissionComposition`,
  inherited IMF module catalog refs, and OpenAPI `x-sdkwork-permission` codes
  that resolve to inherited or application-owned manifests.
- `check-component-port-bindings.mjs` validates composable component contracts:
  `contracts.layerRole`, valid provided/required port declarations, and executable
  runtime entrypoints for same-origin dependency API surfaces. Use `--root` for one
  repository or `--workspace` for all child `sdkwork-*` repositories.
- `check-application-layering.mjs` validates cross-language application L0-L6
  boundaries: Java controllers stay out of repositories/infrastructure and
  transactions, repositories stay out of HTTP framework types, frontend UI stays
  out of raw HTTP, and frontend services receive injected SDK clients. Use `--root`
  for one repository or `--workspace` for all child `sdkwork-*` repositories.
- `check-frontend-composition.mjs` validates client package composition boundaries:
  required core exports, core/commons not depending on capability packages, host
  packages not depending on business SDKs, and feature packages not importing
  generated SDK packages directly. Use `--root` for one repository or `--workspace`
  for all child `sdkwork-*` repositories.
- `check-rust-backend-composition.mjs` validates Rust backend Cargo boundaries:
  service crates do not depend on concrete SQLx repository crates, route crates
  do not depend on generated SDKs for the same surface, repository crates do not
  depend on HTTP framework crates, and member Cargo manifests do not declare
  sibling SDKWork source paths outside root workspace dependencies. Use `--root`
  for one repository or `--workspace` for all child `sdkwork-*` repositories.
- `check-i18n-standard.mjs` validates SDKWork i18n source layouts, rejects
  authored locale monoliths, checks generated/thin platform resource projections,
  and enforces Rust/Java backend message bundle plus database locale seed
  placement. It skips vendored or third-party source trees such as `external/`,
  `third_party/`, and `vendor/`. Use `--root` for one repository or `--workspace`
  for all child `sdkwork-*` repositories.
- `check-pagination.mjs` heuristically scans for in-process pagination smells,
  OpenAPI wire alias debt (`pageSize`, `limit`, `page_no`, `pageNo`,
  `per_page`, `size`), missing `page_size.maximum`, missing `PageInfo.mode`,
  docs/tests examples with retired query names, and generated SDK transport
  query aliases per `PAGINATION_SPEC.md` section 2, section 10.2, and section 12.
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
