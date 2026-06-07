# Quality Gate Standard

- Version: 1.0
- Scope: definition of ready, definition of done, merge gates, release gates, evidence bundles, exceptions
- Related: `REQUIREMENTS_SPEC.md`, `ARCHITECTURE_DECISION_SPEC.md`, `ENGINEERING_WORKFLOW_SPEC.md`, `CODE_REVIEW_SPEC.md`, `RELEASE_SPEC.md`, `MIGRATION_SPEC.md`, `SUPPLY_CHAIN_SECURITY_SPEC.md`, `SECURITY_SPEC.md`, `PRIVACY_SPEC.md`, `PERFORMANCE_SPEC.md`, `OBSERVABILITY_SPEC.md`, `TEST_SPEC.md`, `GOVERNANCE_SPEC.md`

This standard defines when SDKWork work is allowed to start, merge, and release.

## 1. Gate Model

SDKWork uses four quality gates:

| Gate | Purpose |
| --- | --- |
| Ready | work is clear enough to implement |
| Merge | source change is safe to integrate |
| Release | artifact or deployment is safe to ship |
| Exception | controlled deviation with owner and expiry |

Rules:

- Passing tests alone is not enough when requirements, architecture, migration, release, security, or documentation evidence is missing.
- A gate must name evidence, not confidence.
- Gate exceptions follow `GOVERNANCE_SPEC.md`.

## 2. Definition Of Ready

Work is ready only when:

- Requirement or task source is clear.
- Affected repository, app, component, API authority, SDK family, data owner, and release target are known when relevant.
- Relevant root specs are identified.
- Acceptance criteria and non-goals are explicit.
- Architecture decisions, migration plans, release plans, and security/privacy review needs are known.
- Verification commands or review evidence are planned.

## 3. Definition Of Done

Work is done only when:

- Acceptance criteria are satisfied.
- Relevant tests, static scans, build/typecheck, generated SDK checks, config checks, and documentation checks have been run or explicitly marked not applicable.
- Review findings are resolved.
- Required ADRs, migration notes, release notes, changelog entries, and runbooks are updated.
- No generated output was hand-edited.
- Completion evidence records commands, outcomes, gaps, and residual risk.

## 4. Merge Gate

Merge gate evidence should include:

- requirement or task reference.
- changed component/package list.
- spec checklist.
- verification command output.
- review approval.
- security/privacy impact result.
- migration and compatibility result when relevant.
- generated artifact provenance when generated inputs changed.

Rules:

- Public API/RPC/SDK/database/config changes require contract verification.
- UI architecture changes require package placement and SDK boundary verification.
- Security-sensitive changes require negative tests or static scans.
- Root standard changes require README/index and `TEST_SPEC.md` updates when executable behavior changes.

## 5. Release Gate

Release gate evidence should include:

- manifest and package target validation.
- version and changelog evidence.
- build artifact checksums.
- signing evidence when required.
- SBOM and provenance evidence when required.
- migration readiness and rollback path.
- deployment/rollout plan.
- smoke test and monitoring plan.
- owner approval for production or customer-impacting releases.

Rules:

- Release gate follows `RELEASE_SPEC.md`.
- Supply-chain evidence follows `SUPPLY_CHAIN_SECURITY_SPEC.md`.
- Workflow automation follows `GITHUB_WORKFLOW_SPEC.md`.

## 6. Risk Levels

| Risk | Gate expectation |
| --- | --- |
| Low | targeted verification and owner review |
| Medium | tests plus review |
| High | tests, static checks, owner review, docs, rollback notes |
| Critical | governance approval, migration/release plan, security/privacy review, production evidence |

Risk is high or critical when work touches authentication, authorization, tenant isolation, generated SDK ownership, database migrations, public APIs, release artifacts, root standards, or cross-repository behavior.

## 7. Acceptance Checklist

- [ ] Ready gate was satisfied before implementation.
- [ ] Merge gate has evidence, not assumptions.
- [ ] Release gate is satisfied when artifacts or deployments are produced.
- [ ] Exceptions have owner, expiry, risk, and removal plan.
- [ ] Completion evidence records commands and outcomes.
