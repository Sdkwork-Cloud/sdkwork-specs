# Repository Guidelines

## SDKWORK Soul

Read `SOUL.md` before changing SDKWork standards. Agent behavior, long-running execution, ambiguity handling, and verification expectations must follow that file.

## SDKWORK Standards

This repository is the canonical **global standards** home for SDKWork. The standards entrypoint is `README.md`. Consuming repositories and modules must reference these files by relative path; they must not copy global `*_SPEC.md` bodies locally.

When this repository is checked out inside the parent SDKWork workspace, it is the workspace `sdkwork-specs/` self-root. From inside this repository, use `README.md`, `SOUL.md`, and the local `*_SPEC.md` files directly instead of inventing a synthetic `../sdkwork-specs` path.

Parent workspace relative aliases resolve to this same self-root for validators and tool shims:

- `../sdkwork-specs/README.md`
- `../sdkwork-specs/SOUL.md`
- `../sdkwork-specs/AGENTS_SPEC.md`

## Spec System Hierarchy

SDKWork uses three spec layers. This repository owns layer 1 only.

| Layer | Location | This repository |
| --- | --- | --- |
| Global standards | `sdkwork-specs/*_SPEC.md`, `SOUL.md` | Authoritative here |
| Repository/application contracts | `<repo-or-app-root>/specs/` | Not applicable; this is not an application repository |
| Module-local specs | `<module-root>/specs/` | Not applicable; authored modules in consumer repositories own these |

Rules for consumer repositories:

- Load global standards from this directory by relative path.
- Keep repository-wide machine contracts under the repository or application root `specs/` when needed.
- Give every authored module its own independent `specs/` system per `COMPONENT_SPEC.md`.
- Do not mirror global spec files into child repositories or module folders.

Authority: `SOUL.md` section 2, `COMPONENT_SPEC.md` section 1, `AGENTS_SPEC.md` section 4.

## Application Identity

This repository is a standards repository, not an SDKWork application. If a future standards portal or app is added, its `sdkwork.app.config.json` must be read before app behavior, release, SDK wiring, or runtime config changes.

## Local Dictionary Structure

- `AGENTS.md`: agent execution rules for the standards repository.
- `CLAUDE.md`: Claude Code compatibility shim that points to `AGENTS.md` and must not duplicate rules.
- `GEMINI.md`: Gemini CLI compatibility shim that points to `AGENTS.md` and must not duplicate rules.
- `CODEX.md`: Codex compatibility shim that points to `AGENTS.md` and must not duplicate rules.
- `SOUL.md`: shared agent execution soul.
- `README.md`: canonical global standards index and task matrix.
- `docs/`: Canon documentation; see [docs/README.md](docs/README.md), [docs/product/prd/PRD.md](docs/product/prd/PRD.md), and [docs/architecture/tech/TECH_ARCHITECTURE.md](docs/architecture/tech/TECH_ARCHITECTURE.md).
- `*_SPEC.md`: global platform standards owned by this repository.
- `.sdkwork/`: repository-local skills, plugins, and manifests for standards maintenance.

## Spec Resolution Order

This repository maintains global standards only. Use dynamic progressive loading before implementation files. Resolution order for standards work here:

1. Read this `AGENTS.md`.
2. Read `SOUL.md`, especially section 2 (Spec System Hierarchy).
3. Read `README.md`.
4. Read the specific global spec files affected by the task.
5. Read implementation or validation files only after the relevant specs are clear.

When editing consumer repositories or modules instead of this repository, follow `SOUL.md` section 3: nearest `AGENTS.md`, module `specs/`, repository/application `specs/`, then global `sdkwork-specs`.

## Required Specs By Task Type

Agent or repository-entry changes:

- `SOUL.md`
- `AGENTS_SPEC.md`
- `SDKWORK_WORKSPACE_SPEC.md`
- `DOCUMENTATION_SPEC.md`
- `TEST_SPEC.md`

Code style or naming changes:

- `CODE_STYLE_SPEC.md`
- `NAMING_SPEC.md`
- language-specific specs are on-demand: load only the touched language spec (`RUST_CODE_SPEC.md`, `JAVA_CODE_SPEC.md`, `TYPESCRIPT_CODE_SPEC.md`, or `FRONTEND_CODE_SPEC.md`)
- `PNPM_SCRIPT_SPEC.md` when package command standardization, package scripts, or root lifecycle commands are touched

Contract or platform changes:

- `README.md`
- `REQUIREMENTS_SPEC.md`
- `ARCHITECTURE_DECISION_SPEC.md`
- `ENGINEERING_WORKFLOW_SPEC.md`
- `CODE_REVIEW_SPEC.md`
- `QUALITY_GATE_SPEC.md`
- the affected domain spec
- `GOVERNANCE_SPEC.md`
- `TEST_SPEC.md`

Release, migration, or supply-chain standard changes:

- `RELEASE_SPEC.md`
- `MIGRATION_SPEC.md`
- `SUPPLY_CHAIN_SECURITY_SPEC.md`
- `QUALITY_GATE_SPEC.md`
- `GITHUB_WORKFLOW_SPEC.md`
- `GOVERNANCE_SPEC.md`
- `TEST_SPEC.md`

## Code Style Rules

Spec files use concise Markdown, RFC-style `MUST`/`SHOULD`/`MAY` language where rules are normative, and examples only when they make validation clearer. Do not duplicate large sections across specs; cross-link instead.

Build scripts, dev runners, and `pnpm clean` must follow `CODE_STYLE_SPEC.md` §7 (Build Source Integrity And Self-Healing). Git-tracked build-critical source files must be verified before builds and self-healed from git when missing; `clean` must not delete them.

## Build, Test, and Verification

This repository currently contains Markdown standards. Before completion, verify that new spec files are listed in `README.md`, linked from related specs, and referenced by `TEST_SPEC.md` when they define executable rules.

```bash
node tools/bootstrap-repository-docs.mjs --root .
node tools/align-repository-docs.mjs --root .
node tools/check-repository-docs-standard.mjs --root .
node tools/check-apps-directory-index.mjs --root .
node tools/check-workspace-packages-layout.mjs --root . --mode enforce
node tools/check-workspace-packages-layout.mjs --workspace .. --mode audit
node tools/align-workspace-packages-layout.mjs --root . [--dry-run]
node tools/align-workspace-packages-layout.mjs --workspace .. [--dry-run]
node tools/check-workspace-federation-paths.mjs --workspace ..
node tools/align-workspace-federation-paths.mjs --workspace .. [--dry-run]
node tools/check-workspace-lock-package-paths.mjs --workspace ..
node tools/align-workspace-lock-package-paths.mjs --workspace ..
node tools/check-api-response-envelope.mjs --workspace ..
node tools/check-api-operation-patterns.mjs --workspace ..
node tools/check-route-path-collisions.mjs --workspace ..
node tools/check-permission-composition.mjs --workspace ..
node tools/check-component-port-bindings.mjs --workspace ..
node tools/check-frontend-composition.mjs --workspace ..
node tools/check-rust-backend-composition.mjs --workspace ..
node tools/check-i18n-standard.mjs --workspace ..
node tools/align-openapi-response-envelope-workspace.mjs --workspace .. [--dry-run]
node tools/align-apps-directory-index.mjs --root .
node tools/audit-apps-directory-index-workspace.mjs --workspace ..
node tools/audit-repository-docs-workspace.mjs --workspace ..
node tools/check-topology-deployment-profiles.mjs --workspace ..
node tools/check-app-runtime-hosting-debt.mjs --workspace ..
node tools/align-app-gateway-integration.mjs --workspace ..
node tools/verify-repo.mjs --root .
node tools/resolve-composition.mjs --root <path-to-repo> [--write]
node tools/check-composition-resolver.mjs --root <path-to-repo>
node tools/sweep-composition-resolver.mjs --workspace .. [--align] [--write]
node tools/align-composition-sdk-dependencies.mjs --root <path-to-repo> [--write]
node tools/sync-workspace.mjs --repo <repo-name> --root <path-to-repo> [--dry-run]
node tools/align-app-composition.mjs --root <path-to-repo> [--dry-run]
node tools/extract-consumer-overlay.mjs --repo <repo-name> --root <path-to-repo> [--write]
node tools/wire-app-composition-check.mjs [--workspace <path>] [--dry-run]
node --test tools/check-repository-docs-standard.test.mjs
node --test tools/check-apps-directory-index.test.mjs
node --test tools/align-apps-directory-index.test.mjs
node --test tools/verify-composition.test.mjs
node --test tools/bootstrap-repository-docs.test.mjs
node --test tools/align-repository-docs.test.mjs
node --test tools/check-identity-naming.test.mjs
node tools/audit-route-crate-naming-workspace.mjs --workspace ..
node tools/align-database-framework-workspace.mjs --workspace ..
node tools/audit-database-framework-workspace.mjs --workspace ..
node tools/check-api-response-envelope.mjs --root .
node tools/check-api-operation-patterns.mjs --root .
node tools/check-route-path-collisions.mjs --root .
node tools/check-permission-composition.mjs --root .
node tools/check-component-port-bindings.mjs --root .
node tools/check-frontend-composition.mjs --root .
node tools/check-rust-backend-composition.mjs --root .
node tools/check-i18n-standard.mjs --root .
node tools/align-agents-http-response-standard.mjs --workspace ..
node --test tools/check-api-response-envelope.test.mjs
node --test tools/check-api-operation-patterns.test.mjs
node --test tools/check-route-path-collisions.test.mjs
node --test tools/check-permission-composition.test.mjs
node --test tools/check-component-port-bindings.test.mjs
node --test tools/check-frontend-composition.test.mjs
node --test tools/check-rust-backend-composition.test.mjs
node --test tools/check-i18n-standard.test.mjs
node --test tools/check-workspace-packages-layout.test.mjs
node --test tools/check-workspace-federation-paths.test.mjs
node --test tools/check-composition-resolver.test.mjs
```

## Agent Execution Rules

Do not invent standards from memory. Read the current spec files in this repository, edit narrowly, and keep compatibility with existing SDKWork terminology. Language-specific specs are loaded only when the task touches that language or framework.

When changing HTTP input/output rules, update `API_SPEC.md` section 4.5 and sections 14–16 first, then `WEB_FRAMEWORK_SPEC.md`, `WEB_BACKEND_SPEC.md`, `SDK_SPEC.md`, `FRONTEND_SPEC.md`, `MIGRATION_SPEC.md`, `TEST_SPEC.md`, `AGENTS_SPEC.md`, shared templates under `templates/openapi/`, and run `node tools/align-agents-http-response-standard.mjs --workspace ..`.

## App SDK Consumer Imports



Application, feature, shell, and service packages `MUST` consume HTTP SDKs through scoped composed consumer packages, not generator transport package names.



- App API clients: `@sdkwork/<application-code>-app-sdk`

- Backend API clients (`backend-admin` only): `@sdkwork/<application-code>-backend-sdk`

- Federated Claw Router domain surfaces: `@sdkwork/clawrouter-app-sdk/domains` and `@sdkwork/clawrouter-backend-sdk/domains`

- Open/domain API clients: `@sdkwork/<domain>-sdk`



Canonical examples (IAM):



```typescript

import { createClient, type SdkworkAppClient } from '@sdkwork/iam-app-sdk';

import type { SdkworkBackendClient } from '@sdkwork/iam-backend-sdk'; // backend-admin only

import { createClient as createClawRouterDomainsClient } from '@sdkwork/clawrouter-app-sdk/domains';

```



Forbidden in application `apps/`, `packages/`, bootstrap, services, UI, contract tests, and composed SDK `src/**` outside generator ownership:



- `sdkwork-*-app-sdk-generated-typescript`, `sdkwork-*-backend-sdk-generated-typescript`, and other generator transport names as consumer imports

- `@sdkwork/commerce-app-sdk`, `@sdkwork/commerce-backend-sdk`, `@sdkwork/clawrouter-*-domain-transport-sdk`

- filesystem paths containing `domain-transport-typescript`, `domain-transport-sdk`, or sibling `*-typescript/generated` hops from composed `src/**`

- deep imports into `generated/server-openapi/src/*` from consumers when a composed facade exists



Allowed:



- Composed facade entry imports such as `@sdkwork/iam-app-sdk`, `@sdkwork/knowledgebase-app-sdk`, and `@sdkwork/clawrouter-app-sdk/domains`

- Composed re-exports that import only from `../generated/**` within the same `*-sdk-typescript` family root

- Generated transport ownership inside `sdks/**/generated/**` only



Each SDK family `MUST` expose the composed TypeScript facade at `sdks/<sdk-family>/<sdk-family>-typescript/src/index.ts` (and optional subpath exports such as `./domains`) with `package.json#name` equal to the scoped consumer package.



Before completing SDK integration or frontend service work, run:



```bash

node <sdkwork-specs>/tools/check-app-sdk-consumer-imports.mjs --workspace <workspace-root>

```



Authority: `APP_SDK_INTEGRATION_SPEC.md` section 9, `SDK_SPEC.md` package naming table, `SDK_WORKSPACE_GENERATION_SPEC.md` composed facade rules.

## HTTP API Response Envelope

All L2+ SDKWork-owned custom HTTP contracts, including `app-api`, `backend-api`, and SDKWork-owned business `open-api`, `MUST` follow `API_SPEC.md` section 4.5, section 14, and section 15:

- **Default classification:** omitted `x-sdkwork-wire-protocol` means SDKWork-owned custom API (`sdkwork-v3`); only operation-level `x-sdkwork-wire-protocol: external` plus `x-sdkwork-external-protocol-id` identifies a third-party compatibility `open-api` operation.
- **Input:** typed request bodies, section 14.1 list/search/command input, `SdkWorkListQuery`, and `q` for free-text search.
- **Success output:** `SdkWorkApiResponse` with `{ "code": 0, "data": <payload>, "traceId": "<server-uuid>" }`.
- **Error output:** HTTP 4xx/5xx `application/problem+json` (`ProblemDetail`) with numeric `code` and `traceId`; SDKWork-owned errors may include `i18nKey` and `locale` presentation metadata.
- Success `code` is numeric `int32`; HTTP 2xx JSON bodies `MUST` use `0` only. REST semantics remain on HTTP status (`201`, `202`, etc.).
- Platform error codes are numeric non-zero values per section 15.3 (`40001`, `40101`, `40401`, …).
- Single resource: `data.item`
- Lists: `data.items` + `data.pageInfo` (`PageInfo.mode` is `offset` or `cursor`)
- Commands: `data.accepted` plus optional `resourceId` / `status`
- Async accept (`202`): `data.operationId`, `data.status`, optional `pollUrl`
- Operation patterns: retrieve/list/search/create/update/delete/command/async/bulk semantics follow `API_SPEC.md` section 15.4; create uses `201`, delete uses `204` with no JSON body, and `PUT`/`PATCH` use SDK action `update`.

Vendor compatibility `open-api` routes that mirror upstream tool or provider wire (for example OpenAI `/v1/*`, Anthropic/Claude `/anthropic/v1/*`, Google/Gemini `/google/v1beta/*`, Claude Code, or Codex) `MAY` opt out only when every exempt operation declares operation-level `x-sdkwork-wire-protocol: external` and `x-sdkwork-external-protocol-id` per `API_SPEC.md` section 4.5.2. SDKWork-owned business `open-api` operations `MUST NOT` opt out. Mixed OpenAPI documents are validated per operation; one external operation never exempts SDKWork-owned operations in the same document.

Errors `MUST` use HTTP 4xx/5xx with `application/problem+json` (`ProblemDetail`) including required numeric `code` and `traceId`. Optional `i18nKey` and `locale` are display metadata only. Business failures `MUST NOT` use HTTP 2xx with non-zero `code`, string wire codes, `success`, or human `message`.

Forbidden legacy envelopes and fields: `PlusApiResult`, `AppbaseApiResult`, `StoreApiResult`, `SdkWorkResponse`, per-domain `*ApiResult`, wire field `requestId`, bare domain DTOs at the HTTP root, and top-level `{ items, pageInfo, traceId }` without `data`.

Handlers `MUST` serialize success and map errors through `sdkwork-web-framework` response mapping. Generated HTTP SDKs (`--standard-profile sdkwork-v3`) unwrap `data` by default and expose typed numeric `ProblemDetail.code` / `traceId` and returned localization metadata on errors; use `.raw` when the full envelope is required.

Before completing API contract, SDK generation, or frontend service work, run:

```bash
node <sdkwork-specs>/tools/check-api-operation-patterns.mjs --workspace <workspace-root>
node <sdkwork-specs>/tools/check-api-response-envelope.mjs --workspace <workspace-root>
```

Authority: `sdkwork-specs/API_SPEC.md` section 4.5 and sections 14–16, `SDK_SPEC.md` section 4.2, `FRONTEND_SPEC.md`, `MIGRATION_SPEC.md` section 4.2.

## List And Search Pagination

All L2+ list/search APIs and their backing services, repositories, SDK consumers, and interactive frontend lists `MUST` follow `PAGINATION_SPEC.md`:

- **Input:** standard `SdkWorkListQuery` or query params (`page`/`page_size` or `cursor`/`page_size` per `API_SPEC.md` §14.1); default `page_size` `20`; max `200` unless a documented exception exists.
- **Output:** `SdkWorkApiResponse.data.items` + `data.pageInfo` with `PageInfo.mode` (`offset` or `cursor`) per `API_SPEC.md` §16.
- **Store-level pagination:** push filtering, sorting, and page selection to SQL `LIMIT`/keyset or incrementally maintained indexes — never unbounded collect then `skip`/`take`/`slice` in process memory (`PAGINATION_SPEC.md` §2).
- **SDK and frontend:** interactive lists request one page at a time from the server; no default `listAll*` on P0/P1 paths; no client-side `slice` pagination over full downloads.

Before completing list/search API, repository, SDK list helper, projection read model, or paginated UI work, run:

```bash
node <sdkwork-specs>/tools/check-pagination.mjs --workspace <workspace-root>
```

Authority: `PAGINATION_SPEC.md`, `API_SPEC.md` §14.1/§16, `DATABASE_SPEC.md` §20.5, `WEB_BACKEND_SPEC.md` §12, `SDK_SPEC.md` §4.2/§6, `FRONTEND_SPEC.md`, `APP_SDK_INTEGRATION_SPEC.md` §9.

## Permission Composition And Route Registry

Client app roots with HTTP `contracts.sdkDependencies` `MUST` declare `contracts.permissionComposition` and inherit dependency IAM module catalogs by reference. OpenAPI `x-sdkwork-permission` codes `MUST` resolve to inherited or application-owned IMF catalogs.

Route manifests and OpenAPI authorities `MUST` pass normalized route path collision validation before gateway assembly, SDK generation, or release. `{id}`, `:id`, and `<id>` path parameters collide as the same `{param}` segment.

Before completing SDK dependency integration, permission catalog changes, route manifests, OpenAPI authority changes, or gateway assembly work, run:

```bash
node <sdkwork-specs>/tools/check-permission-composition.mjs --workspace <workspace-root>
node <sdkwork-specs>/tools/check-route-path-collisions.mjs --workspace <workspace-root>
```

Authority: `APP_PERMISSION_COMPOSITION_SPEC.md`, `PERMISSION_STANDARD_SPEC.md`, `APP_COMPOSITION_SPEC.md`, `APPLICATION_GATEWAY_SPEC.md`, `API_SPEC.md`, `TEST_SPEC.md`.

## Human Review Rules

Human review is required for new root standards, breaking standard changes, security exceptions, naming migrations, and changes that affect all repositories or application roots.
