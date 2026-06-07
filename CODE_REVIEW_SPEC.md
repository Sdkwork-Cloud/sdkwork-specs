# Code Review Standard

- Version: 1.0
- Scope: code review, spec review, generated artifact review, risk-based review, review evidence
- Related: `REQUIREMENTS_SPEC.md`, `ARCHITECTURE_DECISION_SPEC.md`, `ENGINEERING_WORKFLOW_SPEC.md`, `QUALITY_GATE_SPEC.md`, `GOVERNANCE_SPEC.md`, `CODE_STYLE_SPEC.md`, `NAMING_SPEC.md`, `SECURITY_SPEC.md`, `PRIVACY_SPEC.md`, `TEST_SPEC.md`

This standard defines SDKWork review expectations. Review is a correctness and risk-control activity, not a formatting ceremony.

## 1. Review Scope

Code review is required when a change affects:

- authored source code.
- root standards.
- application or component architecture.
- API, RPC, SDK, database, config, release, deployment, or security behavior.
- generated SDK inputs, route manifests, component manifests, app manifests, or workflow config.
- public naming, compatibility, migrations, or reusable module contracts.

Rules:

- Small documentation-only clarifications may use lightweight review, but root standard changes still require governance review.
- Generated SDK output is not reviewed as authored logic. Review the OpenAPI/proto/manifest/generator input and generator evidence.
- Reviewers must check behavior, boundaries, tests, and risk before style.

## 2. Review Inputs

A review should include:

- requirement id or task source.
- affected specs.
- architecture decision or migration plan when required.
- changed files or package list.
- verification commands and outcomes.
- known risks, non-goals, and deferred work.
- screenshots or rendered artifacts when UI or documents changed.

Rules:

- A review without verification evidence may proceed only as design review, not completion review.
- A reviewer may request missing evidence before inspecting implementation details.
- Pull requests should be small enough that changed behavior and verification can be understood in one review session.

## 3. Review Responsibilities

Reviewers check:

- requirement coverage and non-goal preservation.
- package/component ownership.
- dependency direction and public export boundaries.
- generated SDK/API/RPC/database contract correctness.
- security, privacy, tenant isolation, auth, and secret handling.
- test quality and negative cases.
- migration and compatibility behavior.
- release, rollback, and documentation impact.
- operational impact: logs, metrics, traces, audit, runbooks.

Rules:

- Reviewers should cite file paths, spec names, and concrete failure modes.
- Review feedback should distinguish blocking issues from suggestions.
- Authors must address or explicitly reject each blocking finding with technical reasoning.
- Review cannot approve known root-spec violations without a `GOVERNANCE_SPEC.md` exception.

## 4. Risk-Based Review

| Risk | Examples | Minimum review |
| --- | --- | --- |
| Low | wording, examples, local UI copy, non-contract docs | one qualified reviewer or owner acceptance |
| Medium | package internals, non-public UI behavior, local service logic | one qualified reviewer plus relevant tests |
| High | API/SDK/database/config/security/release behavior | owner reviewer plus verification evidence |
| Critical | breaking change, generated SDK ownership, tenant/auth/security, cross-repository migration, root standard change | human approval, governance check, migration/release evidence |

Rules:

- Risk level is based on blast radius, not lines changed.
- Security-sensitive and data-sensitive changes are high risk even when small.
- Root standard changes are at least high risk; breaking root standard changes are critical.

## 5. Review Outcomes

Allowed outcomes:

- Approved: evidence is sufficient and no blocking issue remains.
- Changes requested: blocking issue or missing evidence.
- Approved with follow-up: only for non-blocking gaps with owner, due date, and tracking.
- Rejected: direction conflicts with root standards or accepted architecture.

Rules:

- "Looks good" without evidence is not a useful review record.
- Follow-ups must not hide incomplete acceptance criteria, security gaps, migration gaps, or release blockers.
- A merge owner must not override review gates without an approved governance exception.

## 6. Acceptance Checklist

- [ ] Requirement/task source is clear.
- [ ] Relevant specs were checked.
- [ ] Ownership, dependency direction, and generated boundaries are correct.
- [ ] Verification evidence is present and relevant.
- [ ] Security, privacy, migration, release, and documentation impact were considered.
- [ ] Blocking findings are resolved or formally excepted.
