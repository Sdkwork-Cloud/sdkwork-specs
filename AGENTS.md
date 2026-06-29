# Repository Guidelines

## SDKWORK Soul

Read `SOUL.md` before changing SDKWork standards. Agent behavior, long-running execution, ambiguity handling, and verification expectations must follow that file.

## SDKWORK Standards

This repository is the canonical SDKWork standards repository. The standards entrypoint is `README.md`. Do not create local copies of these specs in consuming repositories; consuming repositories must link back by relative path.

When this repository is checked out inside the parent SDKWork workspace, it is the workspace `sdkwork-specs/` self-root. From inside this repository, use `README.md`, `SOUL.md`, and the local `*_SPEC.md` files directly instead of inventing a synthetic `../sdkwork-specs` path.

Parent workspace relative aliases resolve to this same self-root for validators and tool shims:

- `../sdkwork-specs/README.md`
- `../sdkwork-specs/SOUL.md`
- `../sdkwork-specs/AGENTS_SPEC.md`

## Application Identity

This repository is a standards repository, not an SDKWork application. If a future standards portal or app is added, its `sdkwork.app.config.json` must be read before app behavior, release, SDK wiring, or runtime config changes.

## Local Dictionary Structure

- `AGENTS.md`: agent execution rules for the standards repository.
- `CLAUDE.md`: Claude Code compatibility shim that points to `AGENTS.md` and must not duplicate rules.
- `GEMINI.md`: Gemini CLI compatibility shim that points to `AGENTS.md` and must not duplicate rules.
- `CODEX.md`: Codex compatibility shim that points to `AGENTS.md` and must not duplicate rules.
- `SOUL.md`: shared agent execution soul.
- `README.md`: canonical standards index and task matrix.
- `docs/`: Canon documentation; see [docs/README.md](docs/README.md), [docs/product/prd/PRD.md](docs/product/prd/PRD.md), and [docs/architecture/tech/TECH_ARCHITECTURE.md](docs/architecture/tech/TECH_ARCHITECTURE.md).
- `*_SPEC.md`: root standards.
- `.sdkwork/`: repository-local skills, plugins, and manifests.

## Spec Resolution Order

1. Read this `AGENTS.md`.
2. Read `SOUL.md`.
3. Read `README.md`.
4. Read the specific spec files affected by the task.
5. Read implementation or validation files only after the relevant specs are clear.

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
- only the relevant language-specific spec: `RUST_CODE_SPEC.md`, `JAVA_CODE_SPEC.md`, `TYPESCRIPT_CODE_SPEC.md`, or `FRONTEND_CODE_SPEC.md`

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
node tools/align-apps-directory-index.mjs --root .
node tools/audit-apps-directory-index-workspace.mjs --workspace ..
node tools/audit-repository-docs-workspace.mjs --workspace ..
node tools/check-topology-deployment-profiles.mjs --workspace ..
node tools/check-app-runtime-hosting-debt.mjs --workspace ..
node tools/align-app-gateway-integration.mjs --workspace ..
node tools/verify-repo.mjs --root .
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
node tools/align-agents-http-response-standard.mjs --workspace ..
node --test tools/check-api-response-envelope.test.mjs
```

## Agent Execution Rules

Do not invent standards from memory. Read the current spec files in this repository, edit narrowly, and keep compatibility with existing SDKWork terminology. Language-specific specs are loaded only when the task touches that language or framework.

When changing HTTP input/output rules, update `API_SPEC.md` section 4.5 and sections 14–16 first, then `WEB_FRAMEWORK_SPEC.md`, `WEB_BACKEND_SPEC.md`, `SDK_SPEC.md`, `FRONTEND_SPEC.md`, `MIGRATION_SPEC.md`, `TEST_SPEC.md`, `AGENTS_SPEC.md`, shared templates under `templates/openapi/`, and run `node tools/align-agents-http-response-standard.mjs --workspace ..`.

## HTTP API Response Envelope

All L2+ `app-api`, `backend-api`, and SDKWork-owned business `open-api` HTTP contracts `MUST` follow `API_SPEC.md` section 4.5, section 14, and section 15:

- **Input:** typed request bodies, section 14.1 list/search/command input, `SdkWorkListQuery`, and `q` for free-text search.
- **Success output:** `SdkWorkApiResponse` with `{ "code": 0, "data": <payload>, "traceId": "<server-uuid>" }`.
- **Error output:** HTTP 4xx/5xx `application/problem+json` (`ProblemDetail`) with numeric `code` and `traceId`.
- Success `code` is numeric `int32`; HTTP 2xx JSON bodies `MUST` use `0` only. REST semantics remain on HTTP status (`201`, `202`, etc.).
- Platform error codes are numeric non-zero values per section 15.3 (`40001`, `40101`, `40401`, …).
- Single resource: `data.item`
- Lists: `data.items` + `data.pageInfo` (`PageInfo.mode` is `offset` or `cursor`)
- Commands: `data.accepted` plus optional `resourceId` / `status`
- Async accept (`202`): `data.operationId`, `data.status`, optional `pollUrl`

Vendor compatibility `open-api` routes that mirror upstream tool or provider wire (for example OpenAI `/v1/*`, Claude Code, Codex) `MAY` opt out only when every exempt operation declares `x-sdkwork-wire-protocol: external` and `x-sdkwork-external-protocol-id` per `API_SPEC.md` section 4.5.2. SDKWork-owned business `open-api` operations `MUST NOT` opt out.

Errors `MUST` use HTTP 4xx/5xx with `application/problem+json` (`ProblemDetail`) including required numeric `code` and `traceId`. Business failures `MUST NOT` use HTTP 2xx with non-zero `code`, string wire codes, `success`, or human `message`.

Forbidden legacy envelopes and fields: `PlusApiResult`, `AppbaseApiResult`, `StoreApiResult`, `SdkWorkResponse`, per-domain `*ApiResult`, wire field `requestId`, bare domain DTOs at the HTTP root, and top-level `{ items, pageInfo, traceId }` without `data`.

Handlers `MUST` serialize success and map errors through `sdkwork-web-framework` response mapping. Generated HTTP SDKs (`--standard-profile sdkwork-v3`) unwrap `data` by default and expose typed numeric `ProblemDetail.code` / `traceId` on errors; use `.raw` when the full envelope is required.

Before completing API contract, SDK generation, or frontend service work, run:

```bash
node <sdkwork-specs>/tools/check-api-response-envelope.mjs --workspace <workspace-root>
```

Authority: `sdkwork-specs/API_SPEC.md` section 4.5 and sections 14–16, `SDK_SPEC.md` section 4.2, `FRONTEND_SPEC.md`, `MIGRATION_SPEC.md` section 4.2.

## Human Review Rules

Human review is required for new root standards, breaking standard changes, security exceptions, naming migrations, and changes that affect all repositories or application roots.
