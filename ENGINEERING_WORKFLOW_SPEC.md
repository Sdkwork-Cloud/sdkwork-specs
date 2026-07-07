# Engineering Workflow Standard

- Version: 1.0
- Scope: engineering work intake, planning, execution, verification, review, release handoff, checkpoints, blocker handling
- Related: `SOUL.md`, `AGENTS_SPEC.md`, `REQUIREMENTS_SPEC.md`, `ARCHITECTURE_DECISION_SPEC.md`, `CODE_REVIEW_SPEC.md`, `QUALITY_GATE_SPEC.md`, `COMPOSABLE_ARCHITECTURE_SPEC.md`, `APP_COMPOSITION_SPEC.md`, `APP_PERMISSION_COMPOSITION_SPEC.md`, `RELEASE_SPEC.md`, `MIGRATION_SPEC.md`, `GOVERNANCE_SPEC.md`, `DOCUMENTATION_SPEC.md`, `TEST_SPEC.md`

This standard defines the human and agent engineering workflow. It is separate from `GITHUB_WORKFLOW_SPEC.md`, which governs GitHub Actions packaging and deployment automation.

## 1. Workflow Model

SDKWork engineering work follows:

```text
Intake -> Clarify -> Decide -> Plan -> Implement -> Verify -> Review -> Release -> Observe -> Learn
```

Rules:

- Work starts from a requirement, incident, standard change, migration, or approved maintenance task.
- Agents and engineers `MUST` load relevant specs before implementation.
- Ambiguity in app identity, component ownership, component layer role, SDK family, API authority, dependency composition, permission inheritance, data ownership, route identity, release target, or security posture stops implementation.
- Long-running work must leave enough status for another worker to resume.
- Verification evidence must be captured before claiming completion.

## 2. Intake And Clarification

Rules:

- Intake follows `REQUIREMENTS_SPEC.md` and `DOCUMENTATION_SPEC.md` section 2.
- Product scope `MUST` be reflected in `docs/product/prd/PRD.md` before non-trivial work begins.
- Implementable units `MUST` be captured as `docs/product/requirements/REQ-*` records or as an explicit PRD section with acceptance criteria when the work remains a single reviewable unit.
- Clarification should identify goals, non-goals, affected surfaces, constraints, risk level, required specs, and expected evidence.
- Product, security, data, migration, release, and generated SDK implications must be identified before implementation when relevant.
- Module composition, dependency SDK, route ownership, permission inheritance, frontend package, Rust crate layering, and resolved composition implications must be identified before implementation when relevant.
- If the task spans unrelated subsystems, split it into separate work items unless one end-to-end workflow is the deliverable.

## 3. Decision And Planning

Rules:

- Architecture decisions follow `ARCHITECTURE_DECISION_SPEC.md`.
- Repository baseline architecture `MUST` stay current in `docs/architecture/tech/TECH_ARCHITECTURE.md` when accepted ADRs change boundaries or technology choices.
- Implementation plans `SHOULD` live under `docs/engineering/plans/PLAN-*` when the work spans multiple reviewable units.
- Implementation plans should be small enough to review and verify incrementally.
- Plans should name exact files or component areas, expected commands, expected evidence, and rollback or recovery steps when relevant.
- Plans that touch composable modules must name the applicable `COMPOSABLE_ARCHITECTURE_SPEC.md` closure-matrix rows and expected validators.
- Plans must not propose hand-editing generated SDK output.
- Plans must not bypass root standards by treating local convention as authority.

## 4. Implementation

Rules:

- Edits should be narrow and aligned with existing package/component ownership.
- Generated output is changed only through its source contract or generator.
- Cross-module behavior should be composed through public exports, declared ports, generated SDK clients, route manifests, permission catalog refs, runtime entrypoints, or approved facades.
- Reusable modules must remain understandable without reading unrelated packages.
- A worker encountering unrelated dirty work must not revert it.

## 5. Verification

Rules:

- Run the narrowest relevant verification first.
- Run broader verification when a contract boundary changes.
- Verification must cover acceptance criteria from `REQUIREMENTS_SPEC.md`.
- Verification must include architecture, SDK, config, security, migration, release, and documentation evidence when those surfaces changed.
- Verification must include applicable composition closure evidence when module ports, frontend packages, Rust crate dependencies, route manifests, permission catalogs, dependency SDKs, or the resolved composition graph changed.
- Composition closure evidence uses the same validator set named in `COMPOSABLE_ARCHITECTURE_SPEC.md` and `QUALITY_GATE_SPEC.md`, including component ports, frontend composition, Rust backend composition, permission composition, route collision, resolver materialization, resolver check, and repository verification.
- Failed verification requires fix and retry, or an explicit blocked status with evidence.

## 6. Review And Completion

Rules:

- Code review follows `CODE_REVIEW_SPEC.md`.
- Merge and release readiness follow `QUALITY_GATE_SPEC.md`.
- Completion reports must include changed areas, verification commands, outcomes, gaps, and residual risk.
- A task is not complete merely because code was written.
- Human review is required for breaking standards, security exceptions, destructive operations, generated SDK ownership changes, public naming changes, and cross-repository migrations.

## 7. Checkpoints

Long-running work should record:

- objective and current status.
- resolved repository/application/component root.
- specs loaded.
- files changed.
- decisions made.
- verification commands and outputs.
- open risks or blockers.
- next action.

## 8. Acceptance Checklist

- [ ] Requirement or approved task source is clear.
- [ ] Relevant specs and ownership boundaries are known.
- [ ] Architecture decisions and migrations are recorded when needed.
- [ ] Plan includes verification evidence.
- [ ] Applicable composable architecture closure rows and validators are named.
- [ ] Implementation stays within component/package ownership.
- [ ] Review and quality gates are satisfied.
- [ ] Completion report includes evidence, gaps, and residual risk.
