# SDKWork Agent Soul

- Version: 1.3
- Scope: shared execution principles for SDKWork agents, automation, human-assisted AI workflows, and repository-local `AGENTS.md` files
- Related: `AGENTS_SPEC.md`, `COMPONENT_SPEC.md`, `SDKWORK_WORKSPACE_SPEC.md`, `GOVERNANCE_SPEC.md`, `TEST_SPEC.md`, `CODE_STYLE_SPEC.md`

This file defines the operating soul for SDKWork agents. It is not a style guide and it is not a prompt library. It is the minimum behavior contract that keeps long-running AI work precise, recoverable, and governed by SDKWork standards.

## 1. Core Principles

Rules:

- Specs before memory. When a relevant SDKWork spec exists, load it by relative path instead of relying on remembered rules.
- Dictionary before context. Resolve the nearest `AGENTS.md`, `sdkwork.app.config.json`, module `specs/`, repository/application root `specs/`, `.sdkwork/`, and global `sdkwork-specs/` before loading broad source context.
- Exact source before inference. Prefer manifest, OpenAPI, route manifest, SDK assembly, package manifest, and component spec evidence over natural-language guesses.
- Native authority before parallel manifests. Use pnpm/Cargo/Gradle/Maven/pubspec/OpenAPI and existing package manifests as dependency authority; do not introduce a second manifest that restates the same dependency graph.
- Minimal context first. Load only the files needed for the current task, then expand deliberately when evidence requires it.
- Plan, execute, verify, fix, retry. Long tasks must be resumable from checkpoints and must not depend on one uninterrupted context window.
- Evidence before completion. Do not claim a task is complete until the relevant verification command or checklist has run and the result has been read.
- Stop on ambiguity. When two possible specs, app roots, SDK families, API authorities, or components match a task, stop and disambiguate before editing.
- Local conventions cannot override global standards. Module-local and repository-local specs may narrow SDKWork rules, but they must not contradict global `sdkwork-specs`.
- One module, one specs directory. Every authored module owns its own `specs/` system; do not centralize module contracts in repository READMEs, `AGENTS.md` bodies, or copied global spec files.
- README and docs are discovery, not standards. Repository README, `docs/`, and `sdkwork-specs/README.md` are indexes and narrative; normative rules live in global `*_SPEC.md` and machine contracts in `specs/`.
- Generated code is not hand-edited. Fix the source contract, generator input, or approved facade, then regenerate.
- Human review owns irreversible direction. Agents can execute, but humans approve unclear product direction, breaking standards changes, security exceptions, migrations, and destructive operations.

## 2. Spec System Hierarchy

SDKWork separates **global standards** from **local spec systems**. Agents must respect layer boundaries and must not copy global standards into consuming repositories or module directories.

| Layer | Location | Owner | Responsibility |
| --- | --- | --- | --- |
| Global standards | `sdkwork-specs/*_SPEC.md`, `sdkwork-specs/SOUL.md` | SDKWork platform maintainers | Platform-wide rules: API, SDK, naming, security, architecture, verification. Single source of truth. Referenced by relative path only. |
| Repository/application contracts | `<git-repo-root>/specs/` or `<application-root>/specs/` | Repository or application maintainers | Repository-wide machine-readable contracts that span modules, such as `topology.spec.json`, deployment profile manifests, or application composition metadata. Not a substitute for global standards. |
| Module-local specs | `<module-root>/specs/` | Module maintainers | Each authored app, package, crate, service, SDK family, or host adapter owns an independent local spec system per `COMPONENT_SPEC.md`. |

Module-local spec system requirements:

- Every authored module `MUST` maintain `<module-root>/specs/component.spec.json`.
- Module `<module-root>/specs/README.md` `MAY` exist as a human index for that module's spec system. It is not a normative standard file; machine authority is `component.spec.json`.
- `component.spec.json` is the machine-readable integration contract: identity, surface, `canonicalSpecs` links, SDK/route/runtime contracts, and verification commands.
- Module `specs/` `MAY` add narrowing extension files such as `FRONTEND_SPEC.md` or `RELEASE_SPEC.md` only when the module needs rules beyond global standards.
- Module `specs/` `MUST NOT` copy, fork, or paraphrase global `*_SPEC.md` bodies. Link through `canonicalSpecs` instead.
- Durable module rules belong in module `specs/`, not in `AGENTS.md` preserved-guidance blocks or repository README prose.

### 2.1 Discovery Layer (README And Docs)

README files and `docs/` belong to the **discovery and documentation layer**. They are not part of the normative specs hierarchy above.

| Artifact | Role | Authority |
| --- | --- | --- |
| `sdkwork-specs/README.md` | Global standards index and task matrix | Navigation only; load specific `*_SPEC.md` for rules |
| Repository/application `README.md`, `apps/README.md` | Directory index and onboarding | Link to specs, docs, and manifests; no normative rule bodies |
| `docs/**` | PRD, architecture Canon, ADRs, runbooks | Human narrative per `DOCUMENTATION_SPEC.md` |
| `AGENTS.md` | Agent execution entrypoint | Index and boundaries; no duplicated global spec bodies |
| Module `specs/README.md` | Module spec human index | `component.spec.json` remains machine authority |

Rules:

- README and docs `MUST` link to authoritative specs and contracts instead of restating them.
- Validators and agents `MUST NOT` treat README prose as a substitute for global specs or `component.spec.json`.
- When README and a spec disagree, the global spec or machine contract wins unless a governance exception exists.

Authority and cleanup rules:

- Global `sdkwork-specs` wins on conflict unless an approved governance exception exists.
- Repository/application `specs/` may declare cross-module topology and release facts; they must not redefine platform contracts already owned by global specs.
- Closer module `specs/` define integration boundaries for that module only; they must not become a second global standards tree.
- If a convenience copy of a global spec exists locally, the global `sdkwork-specs` version remains authoritative.

Detailed module spec shape and discovery: `COMPONENT_SPEC.md`. Repository workspace dictionary and `.sdkwork/` boundaries: `SDKWORK_WORKSPACE_SPEC.md`. Agent entrypoint and progressive loading: `AGENTS_SPEC.md`.

## 3. Standard Execution Order

Every agent starts with this order unless a higher-priority local instruction narrows it:

1. Read the nearest `AGENTS.md`.
2. Read `sdkwork.app.config.json` when present.
3. Read the nearest module `specs/component.spec.json` when the task touches an authored module; read module `specs/README.md` only when it adds integration context not present in the manifest.
4. Read repository/application root `specs/` when the task is repository-wide or application-wide rather than module-local.
5. Read local `.sdkwork/README.md` and relevant local skills/plugins when present.
6. Resolve the relative path to `sdkwork-specs/README.md`.
7. Read only the task-specific global specs referenced by the task matrix, nearest `AGENTS.md`, or module `canonicalSpecs`.
8. Inspect implementation files.
9. Edit narrowly.
10. Run the narrowest relevant verification, then broader verification when the change crosses a contract boundary.
11. Report evidence, gaps, and residual risk.

## 4. List And Search Pagination

List and search work crosses API, service, repository, database, SDK, and frontend layers. Agents `MUST` treat pagination as a store-level contract, not a post-processing convenience.

Rules:

- Load `PAGINATION_SPEC.md` before adding or changing list/search APIs, repositories, projection read models, SDK list helpers, or paginated UI surfaces.
- L2+ list/search operations `MUST` use standard input (`SdkWorkListQuery` or `page`/`page_size` or `cursor`/`page_size`) and return `SdkWorkApiResponse.data.items` with `data.pageInfo` per `API_SPEC.md` §14.1 and §16.
- Pagination `MUST` happen at the authoritative store: SQL `LIMIT`/keyset, or incrementally maintained in-memory indexes. In-process full collect followed by `skip`, `take`, `slice`, or equivalent windowing is forbidden for production list paths (`PAGINATION_SPEC.md` §2).
- SDK consumers and interactive frontend lists `MUST` request one page at a time from the server. Default `listAll*` aggregation and client-side `slice` pagination over full downloads are forbidden for P0/P1 interactive surfaces.
- Do not claim list/search work is complete until `node <sdkwork-specs>/tools/check-pagination.mjs --workspace <root>` has run for the touched repository when implementation changed.

Task matrix authority: `README.md` list/search pagination row, `PAGINATION_SPEC.md`, `AGENTS_SPEC.md` API changes row.

## 5. On-Demand Language Loading

Language-specific specs are loaded only when the task touches that language or framework:

- Rust source, Cargo workspace, Tauri Rust, Rust route crate, or Rust RPC work loads `RUST_CODE_SPEC.md`.
- Java source, Spring backend, Maven module, or Java SDK work loads `JAVA_CODE_SPEC.md`.
- TypeScript, JavaScript, Node tooling, generated TypeScript SDK facade, or package export work loads `TYPESCRIPT_CODE_SPEC.md`.
- React, Flutter, mobile UI, PC UI, desktop renderer, or backend/admin UI work loads `FRONTEND_CODE_SPEC.md` plus the relevant UI architecture spec.

Do not load every language spec for unrelated tasks. This keeps context small and makes the active rules obvious.

## 6. Agent Refusal Points

Agents must stop rather than continue when:

- The required relative path to `sdkwork-specs` cannot be resolved.
- A required app identity file, module `specs/component.spec.json`, or repository contract spec is missing for a task that depends on it.
- A module lacks its own `specs/` directory but the task requires an integration or verification contract for that module.
- The task requires an SDK method that cannot be traced to OpenAPI, generated SDK output, or an approved composed facade.
- A code change would bypass generated SDKs, route manifests, appbase IAM, Drive Uploader, global security standards, or workspace federation (`file:` / `link:` sibling SDKWork sources in member `package.json`; authority: `DEPENDENCY_MANAGEMENT_SPEC.md` section 3, `check-workspace-member-protocol.mjs`).
- A file appears generated but the source contract or generator command is unknown.
- A requested change conflicts with global specs and no governance exception exists.

## 7. Long-Running Stability

Agents running multi-step work should record:

- task objective and current plan.
- resolved app/repository root.
- relative path to `sdkwork-specs`.
- specs read for the current step.
- files modified.
- verification commands and outputs.
- unresolved ambiguity or pending human review.

After interruption, re-read `AGENTS.md`, app identity, the nearest module and repository `specs/`, and the relevant global specs before continuing. Do not assume the standards or source files are unchanged.

