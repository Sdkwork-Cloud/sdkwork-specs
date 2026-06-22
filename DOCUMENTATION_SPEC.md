# Documentation Standard

- Version: 1.0
- Scope: module README, requirements, architecture decisions, API examples, runbooks, changelogs, release notes, migration plans, quality evidence, supply-chain evidence, spec references
- Related: all specs, including `SOUL.md`, `AGENTS_SPEC.md`, `SDKWORK_WORKSPACE_SPEC.md`, `REQUIREMENTS_SPEC.md`, `ARCHITECTURE_DECISION_SPEC.md`, `ENGINEERING_WORKFLOW_SPEC.md`, `CODE_REVIEW_SPEC.md`, `QUALITY_GATE_SPEC.md`, `RELEASE_SPEC.md`, `MIGRATION_SPEC.md`, `DEPENDENCY_MANAGEMENT_SPEC.md`, `SUPPLY_CHAIN_SECURITY_SPEC.md`, `CODE_STYLE_SPEC.md`, `NAMING_SPEC.md`, `RPC_SDK_WORKSPACE_SPEC.md`, and `SDK_SPEC.md`

This standard defines the documentation required for reusable SDKWork capabilities. Documentation must make a module installable and operable by another application without reading its internals.

## 1. Documentation Source Rules

Rules:

- Root `specs/` is the source of truth for standards.
- App-local docs may extend root standards, but must link back to the relevant root spec.
- Repository/application `AGENTS.md` is the agent execution entrypoint. It must link to root specs by relative path and must not duplicate root spec bodies.
- Tool-specific files such as `CLAUDE.md`, `GEMINI.md`, and `CODEX.md` are compatibility shims. They must point to `AGENTS.md` and must not become a second copy of repository rules.
- `SOUL.md` defines shared agent behavior. Local docs may cite it, but must not replace it with a local agent philosophy.
- Repository/application `.sdkwork/README.md`, `.sdkwork/skills/README.md`, and
  `.sdkwork/plugins/README.md` are local documentation entrypoints governed by
  `SDKWORK_WORKSPACE_SPEC.md`.
- Repository/application README files `MUST` document the active top-level project directories from
  `SDKWORK_WORKSPACE_SPEC.md` when the root omits inactive reserved directories or uses both source
  and generated boundaries such as `apis/` and `sdks/`.
- Requirements, acceptance criteria, architecture decisions, workflow checkpoints, review evidence, quality gates, release evidence, migration plans, and supply-chain evidence `MUST` link to their governing root spec instead of inventing local-only lifecycle vocabulary.
- Lifecycle documentation `MUST` be traceable: requirement -> architecture decision when applicable -> implementation/change -> verification -> review -> release or migration evidence.
- API examples `MUST` match the OpenAPI contract and generated SDK method shape.
- Database docs `MUST` match migrations/entities/schema contracts.
- Generated documentation `MUST` identify the generator and source contract.
- Source/build dependency path examples `MUST` follow `DEPENDENCY_MANAGEMENT_SPEC.md`: use relative paths or placeholders such as `<workspace-root>` and `<release-root>`, not one developer's absolute machine path.

## 2. Required Module README

Every reusable module `MUST` have a README with:

- Capability and domain.
- Package type and architecture support.
- Public exports.
- Required SDK client surface.
- Initialization/configuration example.
- Standalone/cloud deployment profile and runtime target notes.
- Security and tenant assumptions.
- Extension points.
- Verification command.
- Owner and status.

Template:

```md
# <module-name>

Domain: iam
Capability: sessions
Package type: service
Status: standard

## Public API
## Required SDK Surface
## Configuration
## Deployment Profile And Runtime Target Behavior
## Security
## Extension Points
## Verification
```

## 2.1 Required Workspace README

Every git repository root and SDKWork application root `MUST` document its
source-controlled `.sdkwork/` workspace.

Rules:

- `AGENTS.md` `MUST` cite `AGENTS_SPEC.md`, `SOUL.md`, and the relative root `sdkwork-specs/README.md` path.
- Tool compatibility shims such as `CLAUDE.md`, `GEMINI.md`, and `CODEX.md`, when present, `MUST` cite the same-root `AGENTS.md` and the relative root `sdkwork-specs/README.md` path.
- `.sdkwork/README.md` `MUST` explain that the directory stores repository or
  application development metadata, not runtime state.
- `.sdkwork/skills/README.md` `MUST` explain where common skills live and how
  a new skill declares its `SKILL.md` entrypoint.
- `.sdkwork/plugins/README.md` `MUST` explain where repository/application
  plugins live and when `.codex-plugin/plugin.json` is required.
- Workspace READMEs `MUST` cite `SDKWORK_WORKSPACE_SPEC.md`.
- Workspace READMEs should point to `AGENTS.md` for execution order and to `SOUL.md` for shared agent behavior.
- Workspace READMEs `MUST NOT` duplicate root standards, include secrets, or
  document user-private runtime paths as committed source directories.

## 2.2 Required Root Layout Documentation

Every independent SDKWork git repository root and every independent SDKWork application root `MUST`
make its active root layout discoverable from its root README or an explicitly linked document.

Rules:

- Root layout documentation `MUST` cite `SDKWORK_WORKSPACE_SPEC.md` for the standard directory dictionary.
- If the root omits inactive reserved directories, the README `MUST` state which capabilities are active and which standard directories are intentionally absent.
- Each standard top-level directory README `MUST` document purpose, owner, allowed content, forbidden content, related specs, and verification command or checklist.
- If both `apis/` and `sdks/` exist, the README `MUST` explain that `apis/` contains authored API contracts and API review inputs, while `sdks/` contains SDK family workspaces, materialized authority OpenAPI, derived `sdkgen` inputs, and generated SDK output.
- If both `plugins/` and `.sdkwork/plugins/` exist, the README `MUST` distinguish application/runtime plugin source from repository/application agent plugin workspaces.
- If `configs/` or architecture-local `config/` and runtime config paths are documented, the README `MUST` distinguish source-controlled safe templates from user-private or environment-private runtime config governed by `RUNTIME_DIRECTORY_SPEC.md`.

## 3. API Documentation

Rules:

- API docs `MUST` be generated from or checked against OpenAPI.
- SDK examples `MUST` use resource-style calls such as `client.auth.sessions.create(body)`.
- Error examples `MUST` use `application/problem+json`.
- Auth examples `MUST` show both `Authorization: Bearer <JWT auth_token>` and `Access-Token: <JWT access_token>` for protected APIs.
- Backend API docs `MUST NOT` show login/session creation endpoints.

## 3.1 RPC SDK Documentation

RPC SDK documentation follows `RPC_SDK_WORKSPACE_SPEC.md`.

Rules:

- RPC SDK READMEs MUST identify proto packages, service catalog, generated languages, endpoint configuration, TLS/mTLS configuration, metadata auth, deadline and cancellation behavior, idempotent write example, error/status mapping, and verification commands.
- RPC SDK examples for protected methods MUST use metadata provider setup instead of hard-coded tokens or manually assembled business-module metadata.
- RPC SDK docs MUST state that `sdkgen` orchestrates SDKWork package layout and Buf/protoc-compatible generation configuration; it does not replace Protocol Buffers, Buf, protoc, or language-specific gRPC plugins.

## 4. Requirements Documentation

Rules:

- Business and engineering requirements `MUST` follow `REQUIREMENTS_SPEC.md`.
- Requirement docs `MUST` include owner, status, priority, acceptance criteria, non-functional requirements when relevant, affected specs/components, and verification evidence.
- Requirement changes `MUST` preserve traceability to the original requirement id or explicitly supersede it.
- Requirement docs `MUST NOT` hide breaking contract, security, privacy, release, or migration impact inside informal notes.

## 5. Architecture Decisions

Architecture decisions are governed by `ARCHITECTURE_DECISION_SPEC.md`.

Reusable foundation changes `MUST` record decisions when they affect:

- domain boundary or naming.
- API path, operationId, or schema shape.
- database table prefix or ownership.
- security model.
- SDK generator behavior.
- Java/Rust parity.
- deployment profile and runtime target switching.
- client architecture alignment, route identity, or package family ownership.
- release, migration, security, privacy, or supply-chain posture.

Decision records `MUST` include context, decision, alternatives, consequences, verification, and supersession when replacing an earlier decision.

## 6. Runbooks

L3 foundation domains `MUST` have operational runbooks for:

- token/key rotation.
- tenant isolation incident response.
- migration rollback.
- provider outage when integrations are involved.
- rate-limit/quota incidents.
- audit log investigation.

Runbooks `SHOULD` include signals, dashboards, commands, rollback steps, and escalation owner.

## 7. Release, Migration, And Supply-Chain Docs

Rules:

- Release notes and changelog entries `MUST` follow `RELEASE_SPEC.md` and identify version, artifacts, compatibility impact, rollout/rollback posture, and verification evidence.
- Migration docs `MUST` follow `MIGRATION_SPEC.md` and identify scope, compatibility window, sequencing, rollback, affected consumers, and owner.
- Supply-chain evidence docs `MUST` follow `SUPPLY_CHAIN_SECURITY_SPEC.md` and identify dependency sources, build inputs, generated artifact authority, SBOM/provenance/signing/checksum/attestation locations, and exceptions.
- Quality gate evidence `MUST` follow `QUALITY_GATE_SPEC.md` and cite requirement, review, verification, release, migration, and supply-chain evidence when applicable.
- Code/spec review evidence `MUST` follow `CODE_REVIEW_SPEC.md` and record outcomes without copying generated SDK output into authored documentation.

## 8. Changelog

Rules:

- API, SDK, database, and module contract changes `MUST` be recorded.
- Breaking changes `MUST` include migration instructions or explicit no-compatibility approval.
- SDK generator version and OpenAPI version `SHOULD` be recorded for SDK releases.
- Release changelog entries `MUST` identify the release version or tag used by packaging and publication workflows.
- Standards changelog entries `SHOULD` identify affected requirement, ADR, review, quality gate, migration, or supply-chain evidence when applicable.
- Spec changes `SHOULD` reference affected validation tooling.

## 9. Acceptance Checklist

- [ ] Root specs are linked from local docs.
- [ ] `AGENTS.md` links to root `sdkwork-specs`, `SOUL.md`, and `AGENTS_SPEC.md` by relative path.
- [ ] Tool compatibility files such as `CLAUDE.md`, `GEMINI.md`, and `CODEX.md` point to `AGENTS.md` and do not duplicate divergent rules.
- [ ] Repository/application `.sdkwork/` README files exist and cite `SDKWORK_WORKSPACE_SPEC.md`.
- [ ] Repository/application root README documents the active standard top-level directories, including `apis/` versus `sdks/` when API contracts and generated SDK workspaces both exist.
- [ ] Requirements and acceptance criteria link to `REQUIREMENTS_SPEC.md` when non-trivial behavior is documented.
- [ ] Architecture decisions link to `ARCHITECTURE_DECISION_SPEC.md` and record supersession when decisions change.
- [ ] Module README includes public API, SDK surface, config, security, and verification.
- [ ] API examples match OpenAPI and generated SDK.
- [ ] RPC SDK READMEs include proto packages, service catalog, endpoint/TLS/mTLS, metadata auth, deadline, idempotency, status mapping, and verification commands when RPC SDKs are touched.
- [ ] Review and quality gate evidence link to `CODE_REVIEW_SPEC.md` and `QUALITY_GATE_SPEC.md` when work is reviewed or gated.
- [ ] Release notes, migration plans, and supply-chain evidence link to `RELEASE_SPEC.md`, `MIGRATION_SPEC.md`, and `SUPPLY_CHAIN_SECURITY_SPEC.md` when applicable.
- [ ] Operationally critical modules include runbooks.
- [ ] Contract changes have changelog entries.
