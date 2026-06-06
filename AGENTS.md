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
- the affected domain spec
- `GOVERNANCE_SPEC.md`
- `TEST_SPEC.md`

## Code Style Rules

Spec files use concise Markdown, RFC-style `MUST`/`SHOULD`/`MAY` language where rules are normative, and examples only when they make validation clearer. Do not duplicate large sections across specs; cross-link instead.

## Build, Test, and Verification

This repository currently contains Markdown standards. Before completion, verify that new spec files are listed in `README.md`, linked from related specs, and referenced by `TEST_SPEC.md` when they define executable rules.

## Agent Execution Rules

Do not invent standards from memory. Read the current spec files in this repository, edit narrowly, and keep compatibility with existing SDKWork terminology. Language-specific specs are loaded only when the task touches that language or framework.

## Human Review Rules

Human review is required for new root standards, breaking standard changes, security exceptions, naming migrations, and changes that affect all repositories or application roots.
