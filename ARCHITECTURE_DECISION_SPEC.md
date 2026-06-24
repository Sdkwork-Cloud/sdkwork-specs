# Architecture Decision Standard

- Version: 1.0
- Scope: architecture decisions, architecture descriptions, decision records, views, tradeoffs, consequences, architecture evidence
- Related: `REQUIREMENTS_SPEC.md`, `APPLICATION_SPEC.md`, `APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC.md`, `MODULE_SPEC.md`, `COMPONENT_SPEC.md`, `API_SPEC.md`, `SDK_SPEC.md`, `DATABASE_SPEC.md`, `SECURITY_SPEC.md`, `PRIVACY_SPEC.md`, `DEPLOYMENT_SPEC.md`, `ENGINEERING_WORKFLOW_SPEC.md`, `QUALITY_GATE_SPEC.md`, `DOCUMENTATION_SPEC.md`, `GOVERNANCE_SPEC.md`, `TEST_SPEC.md`

This standard defines how SDKWork records architecture decisions. Repository baseline architecture lives in `docs/architecture/tech/TECH_ARCHITECTURE.md`. Point-in-time decisions live in `docs/architecture/decisions/`. It aligns with the ISO/IEC/IEEE 42010 architecture-description model without requiring heavyweight ceremony for small changes.

## 1. When Required

An architecture decision record is required when a change:

- creates or changes an application root, package family, component boundary, domain boundary, route authority, SDK family, data ownership boundary, or runtime topology.
- changes public API, RPC, SDK, database, security, privacy, deployment, release, or cross-client architecture behavior.
- introduces a new framework, platform, storage provider, generated code authority, host adapter category, or shared runtime dependency.
- creates a compatibility exception, migration strategy, release strategy, or quality gate exception.
- resolves a meaningful tradeoff where future readers need to understand why one approach was chosen.

Rules:

- Do not use architecture decisions to bypass root standards. Exceptions follow `GOVERNANCE_SPEC.md`.
- For simple additive work, a short decision section inside the requirement or implementation plan is enough if no long-lived architecture consequence exists.
- Architecture records must cite the more specific SDKWork spec that owns the technical rule.
- `docs/architecture/tech/TECH_ARCHITECTURE.md` `MUST` summarize the current baseline architecture and link to active `ADR-*` records. It `MUST` be updated when accepted ADRs change the baseline.
- `docs/adr/` is a retired layout. New ADRs `MUST` use `docs/architecture/decisions/`.

## 2. Baseline Technical Architecture

Every independent SDKWork git repository root and every independent SDKWork application root with active `docs/` `MUST` maintain:

```text
docs/architecture/tech/TECH_ARCHITECTURE.md
```

Rules:

- `TECH_ARCHITECTURE.md` explains repository-specific technology choices, module boundaries, runtime topology, and the SDKWork standards selected for this repository.
- `TECH_ARCHITECTURE.md` `MUST NOT` duplicate root `sdkwork-specs` bodies. It cites them and documents only local choices and boundaries.
- Standard architecture views `MAY` live in `docs/architecture/views/` and `MUST` be linked from `TECH_ARCHITECTURE.md` when used.
- When a decision changes the long-lived baseline, update `TECH_ARCHITECTURE.md` and record or supersede the corresponding `ADR-*`.

Recommended `TECH_ARCHITECTURE.md` header:

```md
# <Product Name> Technical Architecture

Status: draft | active | deprecated
Owner: <team-or-person>
Updated: YYYY-MM-DD
Specs: ARCHITECTURE_DECISION_SPEC.md, DOCUMENTATION_SPEC.md, <selected architecture standards>
```

## 3. Decision Record Shape

Recommended path:

```text
docs/architecture/decisions/ADR-YYYYMMDD-<short-title>.md
```

Minimal record:

```md
# ADR-YYYYMMDD-<short-title>

Status: proposed | accepted | superseded | deprecated
Requirement: REQ-YYYY-NNNN
Owner: team-or-person
Date: YYYY-MM-DD
Specs: REQUIREMENTS_SPEC.md, ARCHITECTURE_DECISION_SPEC.md

## Context
## Decision
## Alternatives
## Consequences
## Verification
## Supersedes / Superseded By
```

Rules:

- `Context` explains the force that made the decision necessary.
- `Decision` states the chosen boundary, dependency direction, API/SDK ownership, data ownership, runtime topology, or release model.
- `Alternatives` lists serious options and why they were not chosen.
- `Consequences` names both benefits and costs.
- `Verification` names tests, static scans, manifests, diagrams, or review gates that keep the decision true.
- Superseded records remain in history and point to the replacement.

## 4. Architecture Views

Architecture descriptions should include only the views needed for the decision:

| View | Use when |
| --- | --- |
| Context | external actors, systems, app roots, SDK families, or providers change |
| Component/package | package boundaries, component ownership, dependency direction, or public exports change |
| API/SDK | API authority, operation ownership, generated SDK surface, or app/backend/open SDK boundary changes |
| Data | database ownership, persistence model, retention, tenant isolation, or migration changes |
| Runtime/deployment | process topology, service boundaries, config surfaces, deployment profile, runtime target, or runtime directories change |
| Client route/UI | cross-client route identity, host adapters, UI architecture, or package families change |
| Security/privacy | authn/authz, token flow, secrets, data classification, audit, or privacy behavior changes |
| Release/migration | rollout, rollback, compatibility windows, or release train behavior changes |

Rules:

- Views should be text, Mermaid, C4-style diagrams, tables, or manifest excerpts that can be reviewed in source control.
- Diagrams must not become the only source of truth for API paths, SDK names, database identifiers, route ids, or package names.
- Architecture views must not contain secrets, live tokens, private keys, or private environment endpoints.

## 5. Decision Boundaries

Rules:

- Domain boundaries follow `DOMAIN_SPEC.md`.
- Application and package boundaries follow `APPLICATION_SPEC.md`, `MODULE_SPEC.md`, and the matching UI/app architecture spec.
- Component ownership follows `COMPONENT_SPEC.md`.
- API and SDK authority follows `API_SPEC.md`, `RPC_SPEC.md`, `SDK_SPEC.md`, and `SDK_WORKSPACE_GENERATION_SPEC.md`.
- Data ownership follows `DATABASE_SPEC.md`, `DRIVE_SPEC.md`, and `MEDIA_RESOURCE_SPEC.md`.
- Security and privacy decisions follow `SECURITY_SPEC.md` and `PRIVACY_SPEC.md`.
- Deployment and runtime decisions follow `CONFIG_SPEC.md`, `ENVIRONMENT_SPEC.md`, `RUNTIME_DIRECTORY_SPEC.md`, and `DEPLOYMENT_SPEC.md`.

## 6. Review And Governance

Rules:

- Architecture decisions that affect multiple repositories, generated SDK ownership, public naming, security posture, data ownership, or release compatibility require human review.
- Architecture decisions must be reviewed before broad implementation starts.
- If implementation discovers that a decision is wrong, update or supersede the decision before expanding the change.
- Decisions may be validated by tests, static scans, manifest checks, dependency graph checks, generated SDK checks, and release preflight checks.

## 7. Acceptance Checklist

- [ ] `docs/architecture/tech/TECH_ARCHITECTURE.md` exists and cites the relevant SDKWork architecture, API, SDK, database, security, and deployment standards.
- [ ] Decision has context, chosen approach, alternatives, consequences, owner, status, and date.
- [ ] Relevant SDKWork specs are cited.
- [ ] Required architecture views are present and scoped.
- [ ] Dependency direction, ownership, and runtime boundaries are explicit.
- [ ] Security, privacy, data, migration, and release impacts are addressed or marked not applicable.
- [ ] Verification evidence is defined.
