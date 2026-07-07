# Code Review Standard

- Version: 1.0
- Scope: code review, spec review, generated artifact review, risk-based review, review evidence
- Related: `REQUIREMENTS_SPEC.md`, `ARCHITECTURE_DECISION_SPEC.md`, `ENGINEERING_WORKFLOW_SPEC.md`, `QUALITY_GATE_SPEC.md`, `COMPOSABLE_ARCHITECTURE_SPEC.md`, `APP_COMPOSITION_SPEC.md`, `APP_PERMISSION_COMPOSITION_SPEC.md`, `GOVERNANCE_SPEC.md`, `CODE_STYLE_SPEC.md`, `NAMING_SPEC.md`, `SECURITY_SPEC.md`, `PRIVACY_SPEC.md`, `TEST_SPEC.md`

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
- composable architecture closure rows and validator evidence when module, SDK dependency, route, permission, frontend, Rust backend, or composition resolver behavior changed.
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
- component layer roles, ports, permission inheritance, route ownership, frontend package boundaries, Rust crate boundaries, and resolved composition graph correctness when applicable.
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

### 3.1 Pagination Blocking Findings

Reviewers `MUST` request changes for SDKWork-owned list/search work that introduces or retains:

- HTTP query aliases `pageSize`, `limit`, `page_no`, `pageNo`, `per_page`, or `size`.
- numeric offset strings as `cursor`, or responses with `hasMore`/`nextCursor` but no `PageInfo.mode`.
- unbounded repository reads, full collect plus `skip`/`take`/`slice`, or per-request projection rebuild followed by window helpers.
- `listAll*` plus local `slice` for P0/P1 interactive UI or service paths.
- hand-edited generated SDK transport instead of fixing OpenAPI, sdkgen inputs, or composed facades.
- pagination migration exceptions for pre-launch applications.

### 3.2 HTTP Operation Blocking Findings

Reviewers `MUST` request changes for SDKWork-owned HTTP API work that introduces or retains:

- create operations returning HTTP `200` instead of `201`.
- delete operations returning JSON success bodies such as `{ success: true }` or `{ deleted: true }` instead of HTTP `204`.
- command operations that encode business failure as HTTP `200` with `accepted: false`, `success: false`, human text, or non-zero success-envelope codes.
- `batch_*` URL segments, `batch<Action>` SDK aliases, or flat SDK aliases that bypass `API_SPEC.md` section 15.4 operation actions.
- update operations that silently ignore required `If-Match`, version, or optimistic concurrency semantics.
- operation-pattern migration exceptions for pre-launch applications.

### 3.3 Composable Architecture Blocking Findings

Reviewers `MUST` request changes for composable module or dependency-integration work that introduces or retains:

- missing `contracts.layerRole`, `publicExports`, `providedPorts`, or `requiredPorts` for authored modules that are meant to compose.
- frontend feature packages importing generated SDK transport packages directly instead of core public exports, injected SDK clients, or declared ports.
- service crates depending on concrete SQLx repositories, route crates depending on generated SDKs for the same surface, or repository crates depending on HTTP framework crates.
- duplicated dependency permission catalogs, missing `contracts.permissionComposition`, or OpenAPI permissions that do not reconcile with inherited module manifests.
- duplicate normalized `(surface, method, path)` route ownership, generic health/status paths claimed by feature modules, or dependency-owned paths copied into application-owned authorities.
- hand-edited `generated/composition.resolved.json` or missing `resolve-composition.mjs --write` / `check-composition-resolver.mjs` evidence.

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
