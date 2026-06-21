# SDKWork Repository Workspace Standard

- Version: 1.0
- Scope: standard project root directory dictionary and source-controlled `.sdkwork/` workspace metadata at every git repository root and every SDKWork application root
- Related: `README.md`, `SOUL.md`, `AGENTS_SPEC.md`, `PNPM_SCRIPT_SPEC.md`, `APPLICATION_SPEC.md`, `COMPONENT_SPEC.md`, `DOCUMENTATION_SPEC.md`, `GOVERNANCE_SPEC.md`, `SDK_SPEC.md`, `SDK_WORKSPACE_GENERATION_SPEC.md`, `RPC_SDK_WORKSPACE_SPEC.md`, `RUNTIME_DIRECTORY_SPEC.md`, `SECURITY_SPEC.md`, `TEST_SPEC.md`

This standard defines the repository/application root directory dictionary and the `.sdkwork/` directory. `.sdkwork/` is the local knowledge and extension workspace for SDKWork development. It stores reusable skills, repository-local plugins, and optional machine-readable workspace manifests that help agents, developers, and CI use the same standards.

Every SDKWork git repository root and every SDKWork application root `MUST` contain `AGENTS.md`, `.sdkwork/skills/`, and `.sdkwork/plugins/`. SDKWork-managed roots that support tool-specific compatibility also `MUST` contain shim files such as `CLAUDE.md`, `GEMINI.md`, or `CODEX.md` that point to `AGENTS.md`. Empty directories are not enough unless the repository has a tracked placeholder such as `README.md` or `.gitkeep`.

## 1. Directory Meanings

There are three different SDKWork path families that must not be mixed:

| Path family | Owner | Purpose | Governing spec |
| --- | --- | --- | --- |
| `<repo-or-application-root>/.sdkwork/` | repository/application maintainers | Source-controlled workspace metadata, common skills, local plugins, optional manifests | this file |
| `<generated-sdk-output>/.sdkwork/sdkwork-generator-*.json` | `sdkgen` | Generated SDK control-plane reports and manifests; required for HTTP/OpenAPI output and optional for RPC release, CI, audit, or migration evidence | `SDK_SPEC.md`, `SDK_WORKSPACE_GENERATION_SPEC.md`, `RPC_SDK_WORKSPACE_SPEC.md` |
| `~/.sdkwork/<application-code>` or `%USERPROFILE%\.sdkwork\<application-code>` | runtime user/process | User-private runtime config, data, cache, logs, secrets, temp files | `RUNTIME_DIRECTORY_SPEC.md` |

In addition, SDKWork source dependency paths declared in `pnpm-workspace.yaml`, root `Cargo.toml`, and root `pubspec.yaml` are workspace-root owned. Sibling SDKWork repositories are consumed through these native build-tool mechanisms; the workspace root is the single source of truth for those paths, and member packages consume them by protocol (`workspace:*`, `{ workspace = true }`, package name).

Rules:

- Root/application `.sdkwork/` is source workspace metadata. It is not runtime state.
- Generated SDK output `.sdkwork/` directories are generator-owned. Do not add repository skills, plugins, or hand-authored workspace manifests there.
- Runtime `~/.sdkwork/<application-code>` directories are user-private. Do not commit them, mirror them into source, or use them as source standards.
- Local/private source workspace state may exist only under ignored paths such as `.sdkwork/local/`, `.sdkwork/tmp/`, `.sdkwork/cache/`, or `.sdkwork/secrets/`.
- Multi-repository SDKWork workspaces `MUST` declare sibling SDKWork source paths in native build-tool workspace roots (`pnpm-workspace.yaml packages:`, `Cargo.toml [workspace.dependencies]`, or root `pubspec.yaml dependency_overrides`), not in `.sdkwork/`.
- A member package `MUST NOT` redeclare a sibling SDKWork source path; it consumes the workspace root entry by native protocol.
- A SDKWork workspace root `SHOULD` be co-located with the SDKWork application root or git repository root. A workspace root that is not a git repository root is allowed only when explicitly documented.

## 1.1 Standard Project Root Directories

SDKWork uses a two-layer source layout:

- `<project-root>/` is the git repository root or independent SDKWork application root governed by
  the standard top-level directory dictionary in this section.
- `apps/sdkwork-<application-code>-<client-arch>/` is an architecture-specific application surface root.
  It may contain `src/`, `lib/`, `App/`, `entry/`, `packages/`, `config/`, platform files, and
  other directories required by its selected architecture standard.
- `apps/` itself is a collection of application roots, not a language source root. Each direct child
  under `apps/` represents one selected application language/architecture root, such as
  `apps/sdkwork-<application-code>-pc/`, `apps/sdkwork-<application-code>-h5/`,
  `apps/sdkwork-<application-code>-flutter-mobile/`, `apps/sdkwork-<application-code>-mini-program/`,
  `apps/sdkwork-<application-code>-android-mobile/`, `apps/sdkwork-<application-code>-ios-mobile/`, or
  `apps/sdkwork-<application-code>-harmony-mobile/`. Architecture-local `src/`, `lib/`, `App/`,
  `entry/`, `packages/`, `config/`, and platform directories belong inside that child root.

Top-level `src/`, `packages/`, and `config/` are not generic SDKWork project-root directories. They
are allowed at the repository root only when the repository root is itself the primary
architecture-specific app surface root, or when a shared package repository is explicitly governed by
an architecture/package standard that names `packages/` as its root collection. In both cases the
root README `MUST` state the active architecture standard and explain that those paths are
architecture-local, not replacements for the project-root dictionary.

Every independent SDKWork git repository root and every independent SDKWork application root `MUST`
use the following reserved top-level directory names when the corresponding capability exists:

```text
<project-root>/
  apis/
  apps/
  crates/
  sdks/
  jobs/
  tools/
  plugins/
  examples/
  configs/
  deployments/
  scripts/
  docs/
  tests/
```

New independent repository and application templates `MUST` create the full directory dictionary
with `README.md` placeholders or tracked content. Narrow-purpose roots `MAY` omit inactive
capability directories only when the root README or a linked root-layout document lists the active
capabilities and intentionally absent standard directories.

Directory meanings:

| Directory | Purpose | Required when |
| --- | --- | --- |
| `apis/` | Author-owned API contracts and API source inputs for all API kinds, including HTTP OpenAPI surfaces, RPC/proto contracts, async/event API manifests, API examples, API changelogs, and API validation inputs | The repository or application defines, owns, reviews, or materializes any API contract |
| `apps/` | Collection of independently runnable application roots, application surfaces, app shells, demos promoted to runnable apps, or deployable application compositions; each direct child is a selected language/architecture application root | The repository contains more than one app root, an app surface below a larger workspace, or runnable app examples |
| `crates/` | Rust crates, including route crates, service crates, repository crates, API server/service-host/native-host/Tauri-host/gateway/worker crates, and reusable Rust libraries | Rust source is authored in the repository or application |
| `sdks/` | SDK family workspaces, SDK generation manifests, authority OpenAPI materialization outputs, derived `sdkgen` inputs, generated SDK language workspaces, and SDK component specs | The repository or application owns or generates SDK families |
| `jobs/` | Job definitions, schedules, queue bindings, batch descriptors, maintenance runbooks, and non-Rust job packages | Non-request/response jobs are scheduled, configured, operated, or packaged |
| `tools/` | Developer, validation, generation, migration, and operator tools that are not shipped as app runtime code | Repository-local reusable tooling is authored |
| `plugins/` | Application/runtime plugin source packages, marketplace plugin implementations, or extension packages | Application or runtime plugins are authored |
| `examples/` | Runnable examples, integration examples, sample configs, and SDK/API usage examples | Examples are needed for consumers or verification |
| `configs/` | Source-controlled safe config templates, profile examples, config schemas, and non-secret runtime defaults | The repository defines config templates or app/runtime configuration |
| `deployments/` | Deployment descriptors, environment topology, packaging handoff files, infrastructure examples, and release deployment documentation | The repository ships, deploys, or documents deployable artifacts |
| `scripts/` | Thin command entrypoints for build, verification, generation, migration, packaging, and release workflows | Shell/Node/Python/PowerShell command wrappers are needed |
| `docs/` | Repository/application documentation, architecture decisions, runbooks, design notes, changelogs, and user/developer guides | Documentation is authored beyond root README files |
| `tests/` | Cross-package tests, contract tests, integration tests, end-to-end tests, fixtures, and static verification inputs | Verification exists outside package-local test directories |

Recommended initial skeleton:

```text
<project-root>/
  apis/
    README.md
    open-api/<domain>/
      openapi.yaml
      routes/
      schemas/
      examples/
      changelogs/
      tests/
    app-api/<domain>/
      openapi.yaml
      routes/
      schemas/
      examples/
      changelogs/
      tests/
    backend-api/<domain>/
      openapi.yaml
      routes/
      schemas/
      examples/
      changelogs/
      tests/
    rpc/
    async/
    internal/
    examples/
    changelogs/
    tests/
  apps/
    README.md
    sdkwork-<application-code>-pc/
      README.md
      sdkwork.app.config.json
      src/ | lib/ | App/ | entry/        # selected architecture standard owns this level
      packages/                         # only when that architecture standard requires it
      config/                           # only when that architecture standard requires it
  crates/
    README.md
    sdkwork-router-<capability>-<surface>/
    sdkwork-<domain>-<capability>-service/
    sdkwork-<domain>-<capability>-repository-sqlx/
    sdkwork-<application-code>-api-server/
    sdkwork-<application-code>-service-host/
    sdkwork-<application-code>-native-host/
    sdkwork-<application-code>-tauri-host/
    sdkwork-<domain>-<capability>-worker/
    sdkwork-<application-code>-gateway/
  sdks/
    README.md
    sdkwork-<domain>-sdk/
    sdkwork-<domain>-app-sdk/
    sdkwork-<domain>-backend-sdk/
  database/
    README.md
    database.manifest.json
    contract/
      schema.yaml
      prefix-registry.json
      table-registry.json
    ddl/
      baseline/
        postgres/
        sqlite/
      generated/
    migrations/
      postgres/
      sqlite/
    seeds/
      seed.manifest.json
      common/
      locales/
        zh-CN/
        en-US/
        ja-JP/
        de-DE/
        fr-FR/
        ru-RU/
        ko-KR/
    drift/
      policy.yaml
    fixtures/
  jobs/
    README.md
    schedules/
    queues/
    batches/
    runbooks/
    packages/
  tools/
    README.md
    validators/
    generators/
    migrations/
    operators/
  plugins/
    README.md
    <plugin-name>/
      README.md
      specs/component.spec.json
      src/
      tests/
  examples/
    README.md
  configs/
    README.md
    schemas/
    profiles/
    examples/
    defaults/
  deployments/
    README.md
    docker/
    k8s/
    systemd/
    nginx/
    runbooks/
  scripts/
    README.md
  docs/
    README.md
    adr/
    runbooks/
    changelogs/
  tests/
    README.md
    contract/
    integration/
    e2e/
    fixtures/
    static/
```

Each standard top-level directory README `MUST` include:

- Purpose.
- Owner.
- Allowed content.
- Forbidden content.
- Related specs.
- Verification command or checklist.

Capability activation signals:

| Directory | Active when |
| --- | --- |
| `apis/` | An OpenAPI document, proto file, AsyncAPI/event manifest, route authority source, API example, API changelog, or API validation fixture exists |
| `apps/` | More than one app surface exists, an app surface lives below a larger workspace, or runnable demos/app shells are part of the repository |
| `crates/` | A Cargo workspace member or Rust source crate is authored |
| `sdks/` | A SDK family is owned, generated, assembled, inspected, or published |
| `database/` | A relational database lifecycle module is owned: contract, migrations, seeds, drift policy, or bootstrap assets |
| `jobs/` | A cron schedule, queue consumer binding, batch job, maintenance task, or job runbook is owned |
| `tools/` | Reusable validators, generators, migration tools, parsers, CLIs, or operator utilities are authored |
| `plugins/` | Application/runtime installable extension source is authored |
| `examples/` | Consumer-facing runnable or copyable examples are maintained |
| `configs/` | Safe config templates, schemas, profiles, or non-secret defaults are committed |
| `deployments/` | Docker, Kubernetes, systemd, nginx, environment topology, release handoff, or deployment runbook content is owned |
| `scripts/` | Thin shell/Node/Python/PowerShell entrypoints are committed |
| `docs/` | Documentation beyond root README files is authored |
| `tests/` | Cross-package, contract, integration, end-to-end, fixture, or static verification content exists |

Boundary rules:

- When a reserved capability is active, the matching directory `MUST` be represented by tracked
  source or a tracked placeholder such as `README.md` or `.gitkeep`.
- Active capabilities `MUST NOT` use competing top-level names such as `api/`, `sdk/`, `package/`,
  `packages/`, `config/`, `deploy/`, `deployment/`, or `tooling/` as generic project-root
  replacements.
- `apis/` is the canonical source directory for API contracts and API materialization inputs. It is
  not an implementation package root and it is not generated SDK output.
- `sdks/` remains the SDK family and generation workspace governed by
  `SDK_WORKSPACE_GENERATION_SPEC.md`. `apis/` may feed `sdks/`, but `apis/` must not contain
  generated transport packages, generated SDK control-plane `.sdkwork/` files, or SDK family
  directories.
- `database/` is the canonical source directory for application database lifecycle assets governed
  by `DATABASE_FRAMEWORK_SPEC.md`. It stores contracts, migrations, seeds, drift policy, and
  bootstrap fixtures. SQLx repository implementations remain in
  `crates/sdkwork-<domain>-<capability>-repository-sqlx/`; crate-local `migrations/` directories
  are legacy and must converge into `database/migrations/` during adoption.
- A single-application repository may make the repository root the primary app root. Its `apps/`
  directory still `SHOULD` exist as a tracked placeholder explaining that the root is the primary app
  surface and listing any secondary app surfaces, shells, or demos.
- `jobs/` owns schedules, queue bindings, batch descriptors, job definitions, maintenance runbooks,
  and non-Rust job packages. Rust worker implementations belong in
  `crates/sdkwork-<domain>-<capability>-worker/`; `jobs/` may reference those crates but must not
  duplicate their implementation.
- `scripts/` contains thin command entrypoints. Public `package.json#scripts`
  names follow `PNPM_SCRIPT_SPEC.md`; application-specific runner file names may
  remain internal implementation details only. Reusable logic, parsers,
  generators, validators, CLIs, and operator utilities belong in `tools/` or
  in a proper package/crate.
- `plugins/` stores application/runtime plugin source. Repository/application agent plugins remain
  under `.sdkwork/plugins/` and follow this standard's plugin workspace rules.
- `configs/` stores source-controlled safe config templates, schemas, profile examples, and
  non-secret defaults. Runtime user/private config remains governed by `RUNTIME_DIRECTORY_SPEC.md`
  and must not be committed.
- `deployments/` stores deployment topology, infrastructure descriptors, release handoff files, and
  deployment runbooks. It must not store live secrets, private keys, local override files, or
  runtime user config.
- Root `tests/` stores cross-package, contract, integration, end-to-end, fixture, and static
  verification content. Package-local unit tests stay beside the package/crate/module they verify.
  Fixtures must not contain real secrets, tokens, private customer data, or runtime state.
- Top-level `config/` is allowed only as an architecture-local directory when the repository root is
  itself the selected app surface root and that architecture standard requires `config/`. Otherwise
  project-root config content belongs in `configs/`.
- Top-level `packages/` is allowed only when the repository root is itself the selected app surface
  root or a shared package-family repository whose governing architecture/package standard requires
  `packages/`. Otherwise package families belong under the appropriate project-root capability such
  as `apps/`, `crates/`, `sdks/`, or `plugins/`.

Standard root examples:

```text
<single-app-repository>/
  AGENTS.md
  sdkwork.app.config.json
  .sdkwork/
  apis/
  apps/
    README.md                 # root is the primary app surface; secondary surfaces live here
  crates/
  sdks/
  jobs/
  tools/
  plugins/
  examples/
  configs/
  deployments/
  scripts/
  docs/
  tests/
```

```text
<multi-surface-app-repository>/
  AGENTS.md
  sdkwork.app.config.json
  .sdkwork/
  apis/app-api/<domain>/openapi.yaml
  apps/sdkwork-<application-code>-pc/
    sdkwork.app.config.json
    packages/
    config/
  apps/sdkwork-<application-code>-h5/
    sdkwork.app.config.json
    packages/
    config/
  crates/
  sdks/
  jobs/
  tools/
  plugins/
  examples/
  configs/
  deployments/
  scripts/
  docs/
  tests/
```

```text
<rust-backend-or-local-service-repository>/
  AGENTS.md
  .sdkwork/
  apis/app-api/<domain>/openapi.yaml
  crates/sdkwork-router-<capability>-app-api/
  crates/sdkwork-<domain>-<capability>-service/
  crates/sdkwork-<domain>-<capability>-repository-sqlx/
  crates/sdkwork-<application-code>-api-server/
  crates/sdkwork-<application-code>-service-host/
  crates/sdkwork-<domain>-<capability>-worker/
  sdks/sdkwork-<domain>-app-sdk/
  jobs/schedules/
  tools/
  configs/
  deployments/
  scripts/
  docs/
  tests/
```

## 2. Required Workspace Shape

Every git repository root and every SDKWork application root `MUST` have:

```text
<repo-or-application-root>/
  AGENTS.md
  CLAUDE.md                 # compatibility shim to AGENTS.md when Claude Code is supported
  GEMINI.md                 # compatibility shim to AGENTS.md when Gemini CLI is supported
  CODEX.md                  # compatibility shim to AGENTS.md when Codex-specific entry is supported
  .sdkwork/
    README.md
    .gitignore
    skills/
      README.md
      <skill-name>/
        SKILL.md
        references/        # optional
        scripts/           # optional
        assets/            # optional
    plugins/
      README.md
      <plugin-name>/
        .codex-plugin/
          plugin.json
        skills/            # optional
        mcp/               # optional
        apps/              # optional
        scripts/           # optional
    manifests/             # optional
    local/                 # ignored when present
    tmp/                   # ignored when present
    cache/                 # ignored when present
    secrets/               # ignored when present
```

Rules:

- `AGENTS.md` `MUST` follow `AGENTS_SPEC.md`, cite `SOUL.md`, and declare the relative path to root `sdkwork-specs/README.md`.
- Tool compatibility shims such as `CLAUDE.md`, `GEMINI.md`, and `CODEX.md`, when present, `MUST` point to `AGENTS.md`; they must not copy or override root standards.
- `.sdkwork/README.md` `MUST` explain the workspace purpose, owner, and which directories are authoritative.
- `.sdkwork/skills/README.md` `MUST` explain how to add repository/application skills.
- `.sdkwork/plugins/README.md` `MUST` explain how to add repository/application plugins.
- `.sdkwork/.gitignore` `MUST` ignore local-only state when those paths may be created.
- `.sdkwork/skills/` and `.sdkwork/plugins/` `MUST` be committed or otherwise represented by tracked files.
- A monorepo root `.sdkwork/` contains shared repository skills/plugins. An application root inside that monorepo still needs its own `.sdkwork/` when it is independently built, distributed, launched, or represented by `sdkwork.app.config.json`.
- Application-root `.sdkwork/` may reference repository-root skills/plugins, but it must not rely on user-global skills as its only project knowledge.

## 3. Skills Directory

`.sdkwork/skills/` stores reusable agent/operator workflows for the repository or application.

Skill directory shape:

```text
.sdkwork/skills/<skill-name>/
  SKILL.md
  references/
  scripts/
  assets/
```

Rules:

- `<skill-name>` `MUST` be lowercase kebab-case.
- A real skill `MUST` have `SKILL.md` as its entrypoint.
- `SKILL.md` `MUST` state when to use the skill, what inputs it expects, what files or commands it may touch, and which root specs it follows.
- Common skills should cite canonical specs instead of copying them. For example, an SDK generation skill cites `SDK_SPEC.md` and `SDK_WORKSPACE_GENERATION_SPEC.md`.
- Skills may include scripts only when the scripts are deterministic, documented, and safe to run from the declared root.
- Skills may include references or assets only when they are needed by the skill workflow.
- Skills `MUST NOT` store application/runtime source code, generated SDK output, runtime data, secrets, API keys, auth tokens, private certificates, local credentials, provider account IDs, or user-private files.
- Skills `MUST NOT` weaken root specs, bypass SDK generation standards, replace generated SDK clients with raw HTTP, or redefine API/security/runtime rules.

Recommended common skill categories:

- API route and OpenAPI materialization.
- SDK generation and generated-client verification.
- Appbase IAM integration checks.
- Repository/component standards inventory.
- Release and deployment readiness checks.
- Security, privacy, and observability review workflows.

## 4. Plugins Directory

`.sdkwork/plugins/` stores repository/application-local agent extensions and plugin bundles.

Plugin directory shape:

```text
.sdkwork/plugins/<plugin-name>/
  .codex-plugin/
    plugin.json
  skills/
  mcp/
  apps/
  scripts/
```

Rules:

- `<plugin-name>` `MUST` be lowercase kebab-case.
- Installable plugins `MUST` declare `.codex-plugin/plugin.json`.
- Plugin manifests `MUST` identify the plugin name, version, owner, description, and contributed skills/tools/apps when the plugin framework supports those fields.
- Plugin skills follow the same rules as `.sdkwork/skills/`.
- Plugins may contain MCP server definitions, app definitions, scripts, or bundled assets only when they are repository/application-specific and documented.
- Plugins `MUST NOT` vendor unrelated external toolchains, generated SDK outputs, secrets, runtime databases, caches, logs, or user-private data.
- A plugin that wraps build, SDK generation, or deployment commands `MUST` call the canonical commands defined by the relevant specs. It must not silently substitute local stubs or incompatible generators.

## 5. Optional Workspace Manifests

Repositories may add machine-readable manifests under `.sdkwork/manifests/` when tooling needs them.

Recommended workspace manifest shape:

```json
{
  "schemaVersion": 1,
  "kind": "sdkwork.workspace",
  "rootType": "repository",
  "name": "sdkwork-example",
  "applicationCode": null,
  "skillsDir": ".sdkwork/skills",
  "pluginsDir": ".sdkwork/plugins",
  "canonicalSpecs": ["specs/README.md"]
}
```

Rules:

- `kind` `MUST` be `sdkwork.workspace`.
- `rootType` `MUST` be `repository` or `application`.
- `canonicalSpecs` should include the repository/application relative path to the root standards entrypoint, such as `../sdkwork-specs/README.md`, when the workspace follows central SDKWork standards.
- `skillsDir` and `pluginsDir` `MUST` point to the required local directories.
- Optional manifests must not become a second source of truth for API, SDK, database, security, runtime, or component contracts.
- Optional manifests `MUST NOT` redeclare SDKWork source dependency paths. Those paths remain owned by `pnpm-workspace.yaml`, root `Cargo.toml`, and root `pubspec.yaml` as defined in `DEPENDENCY_MANAGEMENT_SPEC.md`.

## 5.1 Multi-Repository Workspace Layout

When a SDKWork application consumes multiple SDKWork git repositories as siblings, the consuming repository's build-tool workspace root is the canonical place to declare those paths.

Recommended multi-repository layout:

```text
<sdkwork-workspace-root>/
  sdkwork-app/                       # application root = workspace root
    pnpm-workspace.yaml              # packages + catalog (SDKWork source)
    Cargo.toml                       # [workspace.dependencies] (SDKWork source)
    package.json
  sdkwork-appbase/                   # sibling SDKWork repository
  sdkwork-core/                      # sibling SDKWork repository
  sdkwork-ui/                        # sibling SDKWork repository
  sdkwork-rtc/                       # sibling SDKWork repository
```

Rules:

- The consuming application root `MUST` own a single `pnpm-workspace.yaml` and/or a single root `Cargo.toml`. The pnpm workspace and the Cargo workspace are aligned by relative path; do not create separate pnpm workspaces that overlap.
- Each sibling SDKWork source path `MUST` be declared exactly once at the consuming workspace root.
- Local development resolves these paths from sibling checkouts. Release/CI resolves them from the framework checkout (see `DEPENDENCY_MANAGEMENT_SPEC.md` §5) without changing consumer `package.json` / `Cargo.toml` files.
- The layout `SHOULD` be documented in the application root `README.md` and `sdkwork.app.config.json` when present, listing the expected sibling SDKWork repositories.

## 6. Source Control And Security

Rules:

- `.sdkwork/README.md`, `.sdkwork/skills/README.md`, `.sdkwork/plugins/README.md`, approved skills, approved plugins, and optional non-secret manifests should be committed.
- `.sdkwork/local/`, `.sdkwork/tmp/`, `.sdkwork/cache/`, `.sdkwork/secrets/`, local install state, generated transient outputs, and any secret-bearing files `MUST` be ignored.
- Repository-local skills and plugins may reference private repository paths, but they `MUST NOT` embed private credentials or machine-specific absolute paths unless the path is a documented SDKWork canonical path.
- Any script under `.sdkwork/` that contacts external services `MUST` document the service, credential source, dry-run behavior when available, and verification command.
- Security reviews may scan `.sdkwork/` as source. Sensitive local state must never be placed there in committed form.

## 7. Discovery And Precedence

Recommended discovery order:

1. Nearest `AGENTS.md`.
2. Current application root `sdkwork.app.config.json` when present.
3. Current component/application local `specs/` when present.
4. Current application root `.sdkwork/`.
5. Enclosing git repository root `AGENTS.md` and `.sdkwork/`.
6. Root `sdkwork-specs/` standards referenced by relative path.
7. User-global skills or plugins.

Rules:

- `AGENTS.md` provides the first execution index, but it must not duplicate or override root specs.
- Closer `.sdkwork/` content may add application-specific guidance, but it must not contradict repository-root or root `specs/` standards.
- If two skills have the same name, the application-local skill may specialize the repository skill only when it explicitly cites the repository skill or canonical specs it extends.
- User-global skills and plugins are optional conveniences. They cannot replace the checked-in repository/application `.sdkwork/` standard content.

## 8. Verification

Repository/application workspace verification `MUST` check:

- Every git repository root has `AGENTS.md`.
- Every SDKWork application root has `AGENTS.md`.
- `AGENTS.md` resolves the relative path to `sdkwork-specs/README.md`, `SOUL.md`, and `AGENTS_SPEC.md`.
- Tool compatibility shims such as `CLAUDE.md`, `GEMINI.md`, and `CODEX.md`, when present, resolve the same-root `AGENTS.md` and the relative path to `sdkwork-specs/README.md`.
- Every git repository root has `.sdkwork/`, `.sdkwork/skills/`, and `.sdkwork/plugins/`.
- Every application root has `.sdkwork/`, `.sdkwork/skills/`, and `.sdkwork/plugins/`.
- Required directories are represented by tracked files such as `README.md` when they are otherwise empty.
- Real skills have `.sdkwork/skills/<skill-name>/SKILL.md`.
- Installable plugins have `.sdkwork/plugins/<plugin-name>/.codex-plugin/plugin.json`.
- `.sdkwork/` does not contain obvious secret-bearing files, runtime database files, generated SDK transport outputs, or `sdkgen` generated control-plane reports outside generated SDK output.
- Generated SDK output `.sdkwork/sdkwork-generator-*.json` remains under generated SDK output and is not treated as a repository/application workspace.
- Runtime `~/.sdkwork/<application-code>` directories are not copied into source.
- Multi-repository SDKWork source dependency paths are declared only in `pnpm-workspace.yaml packages:`, root `Cargo.toml [workspace.dependencies]`, or root `pubspec.yaml dependency_overrides`; member packages do not redeclare sibling source paths.
- `.sdkwork/manifests/*.json` does not contain SDKWork source dependency paths when native build-tool workspace roots are the declared source of truth.
- Active top-level capabilities use the reserved project root directory names from section 1.1. Competing top-level names such as `api/`, `sdk/`, `package/`, `packages/`, `config/`, `deploy/`, `deployment/`, or `tooling/` are rejected unless `packages/` or `config/` is explicitly architecture-local for the selected app surface root.
- Full new repository/application templates contain the complete standard directory dictionary with tracked placeholders or content; narrow roots that omit inactive directories document the active layout in the root README.
- `apis/` and `sdks/` are not conflated: API contract sources and materialization inputs stay in `apis/` when authored there, while SDK family workspaces and generated SDK output stay in `sdks/`.
- `apis/` contains no generated SDK transport output, SDK family directories, implementation code, or generated SDK control-plane `.sdkwork/` files.
- `sdks/` is not used as the sole authored API source when the repository/application owns API contracts that require `apis/`.
- `jobs/` does not duplicate Rust worker implementation that belongs in `crates/sdkwork-<domain>-<capability>-worker/`.
- `scripts/` contains thin entrypoints only; reusable logic lives in `tools/` or an appropriate package/crate.
- `plugins/` application/runtime source and `.sdkwork/plugins/` agent plugin workspaces are distinct.
- `configs/`, `deployments/`, and any architecture-local `config/` contain no live secrets, local overrides, user-private runtime config, or runtime state.
- Root `tests/` contains cross-package/contract/integration/e2e/static verification and safe fixtures, while package-local unit tests remain package-local.

## 9. Acceptance Checklist

- [ ] Git repository root has `AGENTS.md` that follows `AGENTS_SPEC.md`.
- [ ] Git repository root has tool compatibility shims, such as `CLAUDE.md`, `GEMINI.md`, or `CODEX.md`, when those tool entrypoints are required.
- [ ] Git repository root has `.sdkwork/README.md`.
- [ ] Git repository root has `.sdkwork/skills/README.md`.
- [ ] Git repository root has `.sdkwork/plugins/README.md`.
- [ ] Each application root has its own `AGENTS.md`, `.sdkwork/README.md`, `.sdkwork/skills/README.md`, and `.sdkwork/plugins/README.md`.
- [ ] Each tool-compatible application root has shim files such as `CLAUDE.md`, `GEMINI.md`, or `CODEX.md` pointing to its own `AGENTS.md`.
- [ ] `AGENTS.md` uses valid relative links to root `sdkwork-specs`.
- [ ] `.sdkwork/.gitignore` ignores local, temp, cache, and secret-bearing state.
- [ ] Repository/application skills have `SKILL.md` and cite the relevant root specs.
- [ ] Repository/application plugins have `.codex-plugin/plugin.json` when installable.
- [ ] `.sdkwork/` contains no secrets, runtime data, generated SDK transport output, or user-private files.
- [ ] Generated SDK `.sdkwork/sdkwork-generator-*.json` files remain generator-owned and are not modified by repository workspace tooling.
- [ ] Runtime private paths still follow `RUNTIME_DIRECTORY_SPEC.md`.
- [ ] New repository/application templates contain the complete standard project root dictionary with tracked placeholders or content.
- [ ] Narrow roots that omit inactive standard directories document the active layout in the root README.
- [ ] Active repository/application capabilities use only the standard top-level directory names: `apis/`, `apps/`, `crates/`, `sdks/`, `jobs/`, `tools/`, `plugins/`, `examples/`, `configs/`, `deployments/`, `scripts/`, `docs/`, and `tests/`; `config/` and `packages/` are used only as architecture-local directories for the selected app surface root.
- [ ] API contract sources, generated SDK workspaces, application/runtime plugins, agent plugins, source config templates, deployment descriptors, job definitions, worker implementations, and runtime private config are placed in their distinct standard directories.
