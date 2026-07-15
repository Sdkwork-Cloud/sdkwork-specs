# Repository Guidelines

## SDKWORK Soul

Read `SOUL.md` before changing SDKWork standards. It governs agent behavior, ambiguity handling, task-scoped checkpoints, and verification. Start with the sections that route the current task; do not treat its related-spec list as a startup bundle.

## SDKWORK Standards

This repository is the canonical **global standards** home for SDKWork. `README.md` is the global standards index and task matrix; the normative authorities are the relevant local `*_SPEC.md` file and `SOUL.md`. Consuming repositories and modules must reference these files by relative path; they must not copy global `*_SPEC.md` bodies locally.

When this repository is checked out inside the parent SDKWork workspace, it is the workspace `sdkwork-specs/` self-root. From this root, use `README.md`, `SOUL.md`, and local `*_SPEC.md` files directly. The parent-workspace aliases below resolve to the same authority for validators and compatibility shims; resolve them once and do not load both paths.

Parent workspace relative aliases resolve to this same self-root for validators and tool shims:

- `../sdkwork-specs/README.md`
- `../sdkwork-specs/SOUL.md`
- `../sdkwork-specs/AGENTS_SPEC.md`

## Spec System Hierarchy

This is the layer-1 standards self-root. `SOUL.md` section 2, `COMPONENT_SPEC.md` section 1, and `AGENTS_SPEC.md` section 4 define the complete three-layer hierarchy. Repository/application and module `specs/` belong to consumer roots; do not inspect them from this repository unless the task explicitly targets their standard integration.

## Application Identity

This repository is a standards repository, not an SDKWork application. If a future standards portal or app is added, its `sdkwork.app.config.json` must be read before app behavior, release, SDK wiring, or runtime config changes.

## Local Dictionary Structure

- `AGENTS.md`: agent execution rules for the standards repository.
- `CLAUDE.md`: Claude Code compatibility shim that points to `AGENTS.md` and must not duplicate rules.
- `GEMINI.md`: Gemini CLI compatibility shim that points to `AGENTS.md` and must not duplicate rules.
- `CODEX.md`: Codex compatibility shim that points to `AGENTS.md` and must not duplicate rules.
- `SOUL.md`: shared agent execution soul.
- `README.md`: global standards index and task matrix; read only the relevant row or navigation heading first.
- `docs/`: Canon documentation; see [docs/README.md](docs/README.md), [docs/product/prd/PRD.md](docs/product/prd/PRD.md), and [docs/architecture/tech/TECH_ARCHITECTURE.md](docs/architecture/tech/TECH_ARCHITECTURE.md).
- `*_SPEC.md`: global platform standards owned by this repository.
- `.sdkwork/`: repository-local skills, plugins, and manifests for standards maintenance. Read `.sdkwork/README.md` and only the skill or plugin that matches the task, such as `.sdkwork/skills/sdkwork-standards-review/` for standards changes.

## Spec Resolution Order

This repository maintains global standards only. Use dynamic progressive loading before implementation files. Resolve a path or task category before reading its contents; read the exact section needed for the current step, then expand only when evidence exposes a new contract boundary.

1. Read this `AGENTS.md` routing material and confirm that this directory is the standards self-root.
2. Read the applicable `SOUL.md` sections. For standards or entrypoint work, begin with sections 1, 2, 3, and 7.
3. Read `.sdkwork/README.md`, then only a local skill or plugin whose declared trigger matches the task.
4. Locate the relevant row or heading in `README.md`; do not load the whole task matrix or unrelated standards catalog.
5. Read the relevant sections of the task-specific global specs named by that row and the required-spec mapping below.
6. Read implementation or validation files only after the applicable authority is clear. Use the narrowest relevant verification, and widen the scope only when the change crosses a contract boundary.

This standards root has no application identity or authored consumer module to load. When editing a consumer repository or module instead, follow `SOUL.md` section 3 and `SDKWORK_WORKSPACE_SPEC.md` section 7: resolve the nearest `AGENTS.md`, task-scoped module or repository contracts, and then the relative global standards path.

## Required Specs By Task Type

The following are task gates, not a startup bundle. Read the relevant sections of the selected set in the order the task reveals them; do not load unrelated language, runtime, UI, SDK, or release standards.

| Task | Read before editing | Load when the task reaches the condition |
| --- | --- | --- |
| Agent or repository-entry change | `SOUL.md`, `AGENTS_SPEC.md`, `SDKWORK_WORKSPACE_SPEC.md`, `DOCUMENTATION_SPEC.md`, `TEST_SPEC.md` | `GOVERNANCE_SPEC.md` when the change is breaking, cross-root, or needs an exception |
| Code style or naming change | `CODE_STYLE_SPEC.md`, `NAMING_SPEC.md` | Only the touched language/framework spec: `RUST_CODE_SPEC.md`, `JAVA_CODE_SPEC.md`, `TYPESCRIPT_CODE_SPEC.md`, or `FRONTEND_CODE_SPEC.md`; `PNPM_SCRIPT_SPEC.md` for package command standardization, package scripts, or root lifecycle commands |
| Contract or platform change | `README.md`, `REQUIREMENTS_SPEC.md`, `ARCHITECTURE_DECISION_SPEC.md`, `ENGINEERING_WORKFLOW_SPEC.md`, `CODE_REVIEW_SPEC.md`, `QUALITY_GATE_SPEC.md`, the affected domain spec, `GOVERNANCE_SPEC.md`, and `TEST_SPEC.md` | Read the applicable sections in lifecycle order rather than loading every full file at startup |
| Release, migration, or supply-chain standard change | `RELEASE_SPEC.md`, `MIGRATION_SPEC.md`, `SUPPLY_CHAIN_SECURITY_SPEC.md`, `QUALITY_GATE_SPEC.md`, `GITHUB_WORKFLOW_SPEC.md`, `GOVERNANCE_SPEC.md`, and `TEST_SPEC.md` | Read the applicable sections in release, migration, and supply-chain sequence rather than loading every full file at startup |

## Code Style Rules

Spec files use concise Markdown, RFC-style `MUST`/`SHOULD`/`MAY` language where rules are normative, and examples only when they make validation clearer. Do not duplicate large sections across specs; cross-link instead.

Build scripts, dev runners, and `pnpm clean` must follow `CODE_STYLE_SPEC.md` §7 (Build Source Integrity And Self-Healing). Git-tracked build-critical source files must be verified before builds and self-healed from git when missing; `clean` must not delete them.

## Build, Test, and Verification

This repository contains Markdown standards. Before completion, verify that a new spec is listed in `README.md`, linked from affected authorities, and referenced by `TEST_SPEC.md` when it defines executable rules.

Choose only the narrowest commands selected by the changed standard; this is not a default full-suite command list. Run workspace-wide checks only after the task crosses that boundary. `bootstrap-*`, `align-*`, `sync-*`, `--write`, and other mutating repair commands are not verification defaults: use them only for an explicitly scoped bootstrap, alignment, migration, or repair task, then inspect the resulting diff.

| Change scope | Minimum verification |
| --- | --- |
| `SOUL.md`, `AGENTS.md`, compatibility shim, or documentation entrypoint | `node tools/check-agent-workflow-standard.mjs --root .`, `node tools/check-repository-docs-standard.mjs --root .`, `node --test tools/check-agent-workflow-standard.test.mjs`, `node --test tools/check-repository-docs-standard.test.mjs` |
| Documentation debt or Canon layout | `node tools/audit-repository-docs-debt.mjs --root .` and the affected documentation checker or its test |
| Validator or tool implementation | The matching `node --test tools/<tool>.test.mjs` and the tool's narrow `--root .` check |
| API, SDK, composition, workspace, runtime, or other domain standard | The validator and test command required by the affected authority and `TEST_SPEC.md`; use `--workspace ..` only when the change actually crosses repository roots |
| Broad cross-contract change | `node tools/verify-repo.mjs --root .` after the narrow checks pass |

Run `git diff --check` and inspect the relevant terminology and cross-references before completion.

## Agent Execution Rules

Do not invent standards from memory. Follow this file's dynamic progressive resolution order, read only the current task's authoritative files or sections, edit narrowly, and keep compatibility with existing SDKWork terminology. Language-specific specs are loaded only when the task touches that language or framework.

When changing HTTP input/output rules, first update `API_SPEC.md` section 4.5 and sections 14-16. Then load and update the affected downstream authorities: `WEB_FRAMEWORK_SPEC.md`, `WEB_BACKEND_SPEC.md`, `SDK_SPEC.md`, `FRONTEND_SPEC.md`, `MIGRATION_SPEC.md`, `TEST_SPEC.md`, `AGENTS_SPEC.md`, and shared templates under `templates/openapi/`. Run `node tools/align-agents-http-response-standard.mjs --workspace ..` only for that resolved HTTP-standard propagation task.

The task-specific sections below are not startup requirements. Read only the matching section after the task category is known. Their canonical excerpts remain discoverable under `AGENTS_SPEC.md`; do not create independent or divergent copies of the underlying global rules.

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

When a task changes SDK dependency integration, permission catalogs, route manifests, OpenAPI authorities, or gateway assembly, load `APP_PERMISSION_COMPOSITION_SPEC.md`, `PERMISSION_STANDARD_SPEC.md`, `APP_COMPOSITION_SPEC.md`, `APPLICATION_GATEWAY_SPEC.md`, `API_SPEC.md`, and the relevant `TEST_SPEC.md` sections. Before completion, run:

```bash
node <sdkwork-specs>/tools/check-permission-composition.mjs --workspace <workspace-root>
node <sdkwork-specs>/tools/check-route-path-collisions.mjs --workspace <workspace-root>
```

Those authorities define the permission-inheritance and normalized route-collision rules; this entrypoint is only the task trigger and verification route.

## Human Review Rules

Human review is required for new root standards, breaking standard changes, security exceptions, naming migrations, and changes that affect all repositories or application roots.
