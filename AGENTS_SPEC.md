# AGENTS.md Standard

- Version: 1.0
- Scope: repository, application, and component-level `AGENTS.md` files used by SDKWork agents and AI-assisted development tools, plus tool compatibility shims such as `CLAUDE.md`, `GEMINI.md`, and `CODEX.md`
- Related: `SOUL.md`, `SDKWORK_WORKSPACE_SPEC.md`, `APP_MANIFEST_SPEC.md`, `COMPONENT_SPEC.md`, `DOCUMENTATION_SPEC.md`, `GOVERNANCE_SPEC.md`, `CODE_STYLE_SPEC.md`, `NAMING_SPEC.md`, `TEST_SPEC.md`

This standard defines `AGENTS.md` as the execution entrypoint for SDKWork repositories and applications. `AGENTS.md` is the nearest human- and agent-readable index for the convention-based dictionary: local app identity, local specs, `.sdkwork/`, root `sdkwork-specs`, build commands, verification rules, and human review boundaries.

Tool-specific files such as `CLAUDE.md`, `GEMINI.md`, and `CODEX.md` exist only to route tools to `AGENTS.md`. They are compatibility shims, not independent standards.

## 1. File Naming And Placement

Rules:

- The authoritative file name is `AGENTS.md`.
- `agent.md`, `AGENT.md`, or `agents.md` may exist only as compatibility shims that point to `AGENTS.md`. They must not contain a second copy of the rules.
- `CLAUDE.md` `MUST` exist at SDKWork-managed repository and application roots when Claude Code compatibility is required.
- `GEMINI.md` `MUST` exist at SDKWork-managed repository and application roots when Gemini CLI compatibility is required.
- `CODEX.md` `MUST` exist at SDKWork-managed repository and application roots when Codex-specific compatibility is required.
- Tool compatibility shims `MUST` point to the nearest `AGENTS.md`, cite the relative `sdkwork-specs` path, and must not contain a divergent rule body.
- Every git repository root `MUST` have `AGENTS.md`.
- Every SDKWork application root `MUST` have `AGENTS.md`.
- Every independently built, distributed, generated, or long-lived component root `SHOULD` have `AGENTS.md` when its relative path to `sdkwork-specs` or local execution rules differ from the repository root.
- Generated SDK transport output must not own `AGENTS.md`; the SDK family root may own one when it has authored facade or generation rules.

## 2. Required Sections

Each authored `AGENTS.md` must include these sections, with local details filled in:

```md
# Repository Guidelines

## SDKWORK Soul
## SDKWORK Standards
## Application Identity
## Local Dictionary Structure
## Spec Resolution Order
## Required Specs By Task Type
## Code Style Rules
## Build, Test, and Verification
## Agent Execution Rules
## Human Review Rules
```

Sections may be brief, but they must be actionable and must use repository-relative paths.

## 3. Relative Path Rules

Rules:

- `AGENTS.md` must reference root standards by relative path.
- Do not copy root spec content into `AGENTS.md`.
- If `sdkwork-specs` moves or the relative path is broken, agents must stop and report the unresolved path.
- Top-level sibling repositories in the standard workspace use paths such as `../sdkwork-specs/README.md`.
- Nested components must use the accurate relative path from the component root, for example `../../../sdkwork-specs/README.md`.
- When a repository can be checked out alone, `AGENTS.md` should state the expected workspace layout and fallback instruction for locating `sdkwork-specs`.

Example:

```md
Canonical SDKWORK specs path from this repository:

- `../sdkwork-specs/README.md`
- `../sdkwork-specs/SOUL.md`
- `../sdkwork-specs/AGENTS_SPEC.md`
- `../sdkwork-specs/CODE_STYLE_SPEC.md`
- `../sdkwork-specs/NAMING_SPEC.md`
```

## 4. Spec Resolution Order

`AGENTS.md` must require agents to resolve standards in this order:

1. Current or nearest `AGENTS.md`.
2. `sdkwork.app.config.json` when present.
3. Local `specs/README.md` and `specs/component.spec.json` when present.
4. Local `.sdkwork/README.md`, `.sdkwork/skills/`, and `.sdkwork/plugins/` when relevant.
5. Root `sdkwork-specs/README.md` through the declared relative path.
6. Task-specific root specs.
7. Implementation files.

Local files may narrow the task, but root `sdkwork-specs` remain authoritative.

Rules:

- Loading is dynamic and progressive. Agents `MUST` load the nearest
  `AGENTS.md` and dictionary entries first, then only the root specs required
  by the current task.
- Agents `MUST NOT` eagerly load all language, runtime, UI, deployment, or SDK
  specs for unrelated work.
- `sdkwork.app.config.json`, local `specs/`, and local `.sdkwork/` are loaded
  when the task touches the application identity, component contract, local
  skills/plugins, runtime, SDK wiring, release, or packaging behavior they
  govern. They are not a reason to scan the entire repository first.
- Durable local rules belong in local `specs/`, README/runbooks, manifests, or
  task-specific documentation. `AGENTS.md` `MUST NOT` keep an "Existing Local
  Guidance" block or preserved legacy command list that competes with root
  SDKWork standards.

## 5. Required Specs By Task Type

`AGENTS.md` must map common task types to the minimum specs agents read before editing.

| Task | Required specs |
| --- | --- |
| Agent/workflow rules | `SOUL.md`, `AGENTS_SPEC.md`, `SDKWORK_WORKSPACE_SPEC.md` |
| Any code change | `CODE_STYLE_SPEC.md`, `NAMING_SPEC.md`, plus only the touched language/framework spec |
| Rust code | `RUST_CODE_SPEC.md`, plus `RUST_RPC_SPEC.md` when RPC is touched |
| Java/Spring code | `JAVA_CODE_SPEC.md`, `WEB_BACKEND_SPEC.md` when HTTP backend code is touched |
| TypeScript/Node code | `TYPESCRIPT_CODE_SPEC.md` |
| Frontend/UI code | `FRONTEND_CODE_SPEC.md`, `FRONTEND_SPEC.md`, `UI_ARCHITECTURE_SPEC.md`, and exactly one detailed UI architecture spec |
| API changes | `API_SPEC.md`, `WEB_FRAMEWORK_SPEC.md` when Rust HTTP runtime is touched, `WEB_BACKEND_SPEC.md`, `SDK_SPEC.md`, `TEST_SPEC.md` |
| Rust HTTP route crates / API servers | `API_SPEC.md`, `WEB_FRAMEWORK_SPEC.md`, `WEB_BACKEND_SPEC.md`, `RUST_CODE_SPEC.md`, `SECURITY_SPEC.md`, `TEST_SPEC.md` |
| Database changes | `DATABASE_SPEC.md`, `PRIVACY_SPEC.md`, `TEST_SPEC.md` |
| SDK generation/consumption | `SDK_SPEC.md`, `SDK_WORKSPACE_GENERATION_SPEC.md`, `API_SPEC.md`, `TEST_SPEC.md` |
| App identity/release | `APP_MANIFEST_SPEC.md`, `CONFIG_SPEC.md`, `DEPLOYMENT_SPEC.md` |
| Security/auth | `IAM_SPEC.md`, `IAM_LOGIN_INTEGRATION_SPEC.md`, `SECURITY_SPEC.md`, `PRIVACY_SPEC.md` |

Language specs are on-demand. Do not require agents to load Rust, Java, TypeScript, and frontend specs for unrelated tasks.

## 6. Local Dictionary Structure

`AGENTS.md` must identify the local convention dictionary:

- `AGENTS.md`: agent execution rules and relative spec entrypoint.
- `sdkwork.app.config.json`: application identity, app metadata, release surfaces, and owned capabilities.
- `.sdkwork/`: local skills, plugins, manifests, and repository/application AI workspace metadata.
- `specs/`: local app/component contracts and narrowing rules.
- `sdks/`: SDK families, OpenAPI authorities, derived generator inputs, route manifests, SDK assembly, and generated outputs.
- language manifests such as `package.json`, `Cargo.toml`, `pom.xml`, `pyproject.toml`, or `pubspec.yaml`.

## 7. Template

Minimal repository template:

```md
# Repository Guidelines

## SDKWORK Soul

Read `../sdkwork-specs/SOUL.md` before executing repository tasks.

## SDKWORK Standards

This repository follows `../sdkwork-specs/README.md`. Do not copy root standards locally.

## Application Identity

Read `sdkwork.app.config.json` before changing application behavior, runtime config, SDK wiring, release metadata, or app-owned capabilities.

## Local Dictionary Structure

- `AGENTS.md`: agent execution rules.
- `.sdkwork/`: local skills, plugins, and manifests.
- `specs/`: local application or component contracts.
- `sdks/`: OpenAPI authorities and SDK generation artifacts.

## Spec Resolution Order

Read local identity and specs first, then task-specific files from `../sdkwork-specs/`, then implementation files.

## Required Specs By Task Type

Code changes require `../sdkwork-specs/CODE_STYLE_SPEC.md`, `../sdkwork-specs/NAMING_SPEC.md`, and only the language/framework spec for the touched files.

## Build, Test, and Verification

Use this repository's package manifest scripts. Record commands and outputs.
```

## 8. Compatibility Shim Templates

Recommended `CLAUDE.md` shape:

```md
# Claude Code Entry

This file is a compatibility shim for Claude Code. The authoritative SDKWork agent entrypoint is `AGENTS.md`.

Read in this order:

1. `AGENTS.md`
2. `../sdkwork-specs/SOUL.md`
3. `../sdkwork-specs/AGENTS_SPEC.md`
4. Task-specific files from `../sdkwork-specs/README.md`

Do not duplicate or override SDKWork rules here.
```

Recommended `GEMINI.md` and `CODEX.md` shape follows the same rule: change only the title and tool name, keep `AGENTS.md` as the authority, and keep relative `sdkwork-specs` references accurate from the shim location.

## 9. Verification

Validation should check:

- `AGENTS.md` exists at each repository root and application root.
- Compatibility shim files, including `CLAUDE.md`, `GEMINI.md`, and `CODEX.md`, point to `AGENTS.md` when present.
- Relative `sdkwork-specs` paths resolve.
- Required sections are present.
- Required task-to-spec mappings include language-on-demand behavior.
- `AGENTS.md` states dynamic progressive loading and does not require loading
  every language/framework spec for unrelated tasks.
- `AGENTS.md` references `PNPM_SCRIPT_SPEC.md` and `GITHUB_WORKFLOW_SPEC.md`
  when command or GitHub packaging workflows exist in the repository.
- `AGENTS.md` does not retain "Existing Local Guidance" or legacy preserved
  rule blocks; durable local rules are moved to local specs or linked docs.
- `AGENTS.md` does not duplicate root spec bodies or embed secrets.

Application repositories may call the canonical validator with:

```text
node ../sdkwork-specs/tools/check-agent-workflow-standard.mjs --root .
```
