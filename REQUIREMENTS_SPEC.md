# Requirements Standard

- Version: 1.0
- Scope: product requirements, engineering requirements, acceptance criteria, non-functional requirements, traceability, change control
- Related: `SOUL.md`, `DOCUMENTATION_SPEC.md`, `GOVERNANCE_SPEC.md`, `ARCHITECTURE_DECISION_SPEC.md`, `ENGINEERING_WORKFLOW_SPEC.md`, `QUALITY_GATE_SPEC.md`, `COMPOSABLE_ARCHITECTURE_SPEC.md`, `APP_COMPOSITION_SPEC.md`, `APP_PERMISSION_COMPOSITION_SPEC.md`, `CODE_REVIEW_SPEC.md`, `TEST_SPEC.md`, `SECURITY_SPEC.md`, `PRIVACY_SPEC.md`

This standard defines how SDKWork work enters the engineering system. Requirements are not marketing text and not implementation notes. They are the smallest reviewed source of truth that explains why a change exists, what behavior it must deliver, what must not change, and what evidence proves completion.

## 1. Requirement Authority

Rules:

- Product scope and outcomes for a repository or application `MUST` be captured in `docs/product/prd/PRD.md` before non-trivial engineering work begins.
- `docs/product/prd/PRD.md` is the product authority. `docs/product/requirements/REQ-*` records are the engineering authority for implementable units of work.
- Work that changes user behavior, public contracts, runtime behavior, security posture, data shape, release behavior, or cross-repository behavior `MUST` have an explicit `REQ-*` record under `docs/product/requirements/` before implementation, unless the change is captured as a new or updated section inside `docs/product/prd/PRD.md` with explicit acceptance criteria and the work remains small enough for a single reviewable unit.
- Small clarifications and mechanical standard updates may use the task message as the requirement record only when scope, acceptance criteria, and affected files are unambiguous.
- Requirements `MUST` cite the relevant root specs instead of restating them.
- Requirements `MUST` distinguish product behavior from engineering implementation constraints.
- Requirements `MUST NOT` require bypassing generated SDKs, root security standards, Drive storage ownership, appbase IAM, route manifests, or component ownership rules.
- If the requirement conflicts with a root spec, implementation stops until `GOVERNANCE_SPEC.md` records an approved exception or the requirement is revised.

## 2. Requirement Shape

Recommended path:

```text
docs/product/requirements/REQ-YYYY-NNNN-<short-title>.md
```

Every non-trivial requirement record should include:

```yaml
id: REQ-2026-0001
title: short outcome-oriented title
owner: team-or-person
status: draft | ready | in-progress | blocked | accepted | superseded
source: customer | operator | platform | security | reliability | governance | internal
problem: concrete problem or opportunity
goals:
  - measurable outcome
non_goals:
  - explicitly excluded behavior
users:
  - affected actor or system
acceptance_criteria:
  - observable behavior or contract evidence
non_functional_requirements:
  security: required security posture or "none beyond root standards"
  privacy: data classification and minimization notes
  performance: latency, throughput, size, or "none beyond root standards"
  reliability: availability, retry, recovery, or "none beyond root standards"
affected_surfaces:
  - api
  - sdk
  - backend
  - composition
  - pc
  - h5
  - flutter-mobile
  - mini-program
  - android-native
  - ios-native
  - harmony-native
trace:
  specs:
    - REQUIREMENTS_SPEC.md
  components:
    - apps/<app>/packages/<package>
verification:
  - command or checklist evidence
```

Rules:

- Requirement ids `MUST` be stable once referenced by design, tests, release notes, or migration plans.
- `docs/product/prd/PRD.md` `SHOULD` link to active `REQ-*` records in its linked requirements section.
- Acceptance criteria `MUST` be testable or reviewable. "Improve", "optimize", "make better", or "support as needed" is not sufficient without a measurable or observable boundary.
- Non-goals are required when a requested change could be interpreted across multiple domains, surfaces, app roots, or SDK families.
- Security, privacy, performance, and reliability entries may explicitly say "none beyond root standards" only after the relevant root spec has been checked.

## 3. Readiness

A requirement is ready for implementation only when:

- The affected app/repository/component identity is known.
- The relevant root specs are known.
- Affected component layer roles, dependency SDKs, route ownership, permission inheritance, frontend packages, Rust crates, and composition resolver facts are known when the requirement touches composable architecture.
- The behavior, non-goals, acceptance criteria, and verification evidence are clear.
- Required architecture decisions are identified under `ARCHITECTURE_DECISION_SPEC.md`.
- Required migrations are identified under `MIGRATION_SPEC.md`.
- Required release or rollout controls are identified under `RELEASE_SPEC.md`.
- The work can be decomposed into reviewable units.

Rules:

- Agents and engineers `MUST` stop on ambiguous app identity, SDK family, API authority, component ownership, component layer role, dependency composition, permission inheritance, route identity, data ownership, or release target.
- A ready requirement `MUST NOT` depend on undocumented tribal knowledge.
- Requirements that touch multiple independent systems should be split into separate requirement records unless one end-to-end workflow is the actual deliverable.

## 4. Traceability

Rules:

- Every implementation plan, architecture decision, migration plan, release note, and verification report for non-trivial work should reference the requirement id.
- Tests should trace to acceptance criteria when the behavior is user-facing, contract-facing, security-sensitive, or release-critical.
- Release notes should reference the requirement id when the change affects users, operators, public APIs, SDKs, manifests, or deployment behavior.
- Superseded requirements must point to their replacement.

## 5. Change Control

Rules:

- Requirement changes after implementation starts `MUST` record what changed and whether architecture, tests, migration, release, or documentation must be updated.
- Scope expansion during implementation requires returning to readiness checks.
- Removing acceptance criteria requires explicit owner approval.
- Breaking compatibility, security exceptions, public naming changes, generated SDK ownership changes, or cross-repository migrations require `GOVERNANCE_SPEC.md` review.

## 6. Verification

Requirements verification should prove:

- Every acceptance criterion is covered by a test, static check, review checklist, or explicit owner acceptance.
- Relevant non-functional requirements have evidence or an approved deferral.
- Applicable `COMPOSABLE_ARCHITECTURE_SPEC.md` closure-matrix rows are covered by validator output or explicit owner acceptance when the requirement changes modular composition.
- Requirement ids referenced by code comments, docs, ADRs, tests, or release notes resolve to a real requirement record.
- No implementation-only behavior was introduced outside the stated goals or accepted scope.

## 7. Acceptance Checklist

- [ ] `docs/product/prd/PRD.md` exists and states product goals, non-goals, and linked `REQ-*` records when applicable.
- [ ] Requirement id, owner, status, source, goals, and non-goals are defined.
- [ ] Affected app/repository/component and root specs are known.
- [ ] Acceptance criteria are testable or reviewable.
- [ ] Non-functional requirements are explicit.
- [ ] Architecture, migration, release, security, privacy, and test implications are identified.
- [ ] Component composition, dependency SDK, permission inheritance, route ownership, frontend package, Rust crate, and resolver implications are identified when applicable.
- [ ] Trace links exist for design, implementation, verification, and release when applicable.
