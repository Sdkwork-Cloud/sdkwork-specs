# SDKWork Agent Soul

- Version: 1.0
- Scope: shared execution principles for SDKWork agents, automation, human-assisted AI workflows, and repository-local `AGENTS.md` files
- Related: `AGENTS_SPEC.md`, `SDKWORK_WORKSPACE_SPEC.md`, `GOVERNANCE_SPEC.md`, `TEST_SPEC.md`, `CODE_STYLE_SPEC.md`

This file defines the operating soul for SDKWork agents. It is not a style guide and it is not a prompt library. It is the minimum behavior contract that keeps long-running AI work precise, recoverable, and governed by SDKWork standards.

## 1. Core Principles

Rules:

- Specs before memory. When a relevant SDKWork spec exists, load it by relative path instead of relying on remembered rules.
- Dictionary before context. Resolve the nearest `AGENTS.md`, `sdkwork.app.config.json`, `.sdkwork/`, local `specs/`, and root `sdkwork-specs/` before loading broad source context.
- Exact source before inference. Prefer manifest, OpenAPI, route manifest, SDK assembly, package manifest, and component spec evidence over natural-language guesses.
- Minimal context first. Load only the files needed for the current task, then expand deliberately when evidence requires it.
- Plan, execute, verify, fix, retry. Long tasks must be resumable from checkpoints and must not depend on one uninterrupted context window.
- Evidence before completion. Do not claim a task is complete until the relevant verification command or checklist has run and the result has been read.
- Stop on ambiguity. When two possible specs, app roots, SDK families, API authorities, or components match a task, stop and disambiguate before editing.
- Local conventions cannot override root standards. Local specs may narrow SDKWork rules, but they must not contradict root `sdkwork-specs`.
- Generated code is not hand-edited. Fix the source contract, generator input, or approved facade, then regenerate.
- Human review owns irreversible direction. Agents can execute, but humans approve unclear product direction, breaking standards changes, security exceptions, migrations, and destructive operations.

## 2. Standard Execution Order

Every agent starts with this order unless a higher-priority local instruction narrows it:

1. Read the nearest `AGENTS.md`.
2. Read `sdkwork.app.config.json` when present.
3. Read local `specs/README.md` and `specs/component.spec.json` when present.
4. Read local `.sdkwork/README.md` and relevant local skills/plugins when present.
5. Resolve the relative path to `sdkwork-specs/README.md`.
6. Read only the task-specific root specs.
7. Inspect implementation files.
8. Edit narrowly.
9. Run the narrowest relevant verification, then broader verification when the change crosses a contract boundary.
10. Report evidence, gaps, and residual risk.

## 3. On-Demand Language Loading

Language-specific specs are loaded only when the task touches that language or framework:

- Rust source, Cargo workspace, Tauri Rust, Rust route crate, or Rust RPC work loads `RUST_CODE_SPEC.md`.
- Java source, Spring backend, Maven module, or Java SDK work loads `JAVA_CODE_SPEC.md`.
- TypeScript, JavaScript, Node tooling, generated TypeScript SDK facade, or package export work loads `TYPESCRIPT_CODE_SPEC.md`.
- React, Flutter, mobile UI, PC UI, desktop renderer, or backend/admin UI work loads `FRONTEND_CODE_SPEC.md` plus the relevant UI architecture spec.

Do not load every language spec for unrelated tasks. This keeps context small and makes the active rules obvious.

## 4. Agent Refusal Points

Agents must stop rather than continue when:

- The required relative path to `sdkwork-specs` cannot be resolved.
- A required app identity file or component spec is missing for a task that depends on it.
- The task requires an SDK method that cannot be traced to OpenAPI, generated SDK output, or an approved composed facade.
- A code change would bypass generated SDKs, route manifests, appbase IAM, Drive Uploader, or root security standards.
- A file appears generated but the source contract or generator command is unknown.
- A requested change conflicts with root specs and no governance exception exists.

## 5. Long-Running Stability

Agents running multi-step work should record:

- task objective and current plan.
- resolved app/repository root.
- relative path to `sdkwork-specs`.
- specs read for the current step.
- files modified.
- verification commands and outputs.
- unresolved ambiguity or pending human review.

After interruption, re-read `AGENTS.md`, app identity, local specs, and the relevant root specs before continuing. Do not assume the standards or source files are unchanged.

