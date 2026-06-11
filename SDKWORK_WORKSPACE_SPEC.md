# SDKWork Repository Workspace Standard

- Version: 1.0
- Scope: source-controlled `.sdkwork/` workspace metadata at every git repository root and every SDKWork application root
- Related: `README.md`, `SOUL.md`, `AGENTS_SPEC.md`, `APPLICATION_SPEC.md`, `COMPONENT_SPEC.md`, `DOCUMENTATION_SPEC.md`, `GOVERNANCE_SPEC.md`, `SDK_SPEC.md`, `SDK_WORKSPACE_GENERATION_SPEC.md`, `RPC_SDK_WORKSPACE_SPEC.md`, `RUNTIME_DIRECTORY_SPEC.md`, `SECURITY_SPEC.md`, `TEST_SPEC.md`

This standard defines the repository/application `.sdkwork/` directory. It is the local knowledge and extension workspace for SDKWork development. It stores reusable skills, repository-local plugins, and optional machine-readable workspace manifests that help agents, developers, and CI use the same standards.

Every SDKWork git repository root and every SDKWork application root `MUST` contain `AGENTS.md`, `.sdkwork/skills/`, and `.sdkwork/plugins/`. SDKWork-managed roots that support tool-specific compatibility also `MUST` contain shim files such as `CLAUDE.md`, `GEMINI.md`, or `CODEX.md` that point to `AGENTS.md`. Empty directories are not enough unless the repository has a tracked placeholder such as `README.md` or `.gitkeep`.

## 1. Directory Meanings

There are three different SDKWork path families that must not be mixed:

| Path family | Owner | Purpose | Governing spec |
| --- | --- | --- | --- |
| `<repo-or-application-root>/.sdkwork/` | repository/application maintainers | Source-controlled workspace metadata, common skills, local plugins, optional manifests | this file |
| `<generated-sdk-output>/.sdkwork/sdkwork-generator-*.json` | `sdkgen` | Generated SDK control-plane reports and manifests; required for HTTP/OpenAPI output and optional for RPC release, CI, audit, or migration evidence | `SDK_SPEC.md`, `SDK_WORKSPACE_GENERATION_SPEC.md`, `RPC_SDK_WORKSPACE_SPEC.md` |
| `~/.sdkwork/<app>` or `%USERPROFILE%\.sdkwork\<app>` | runtime user/process | User-private runtime config, data, cache, logs, secrets, temp files | `RUNTIME_DIRECTORY_SPEC.md` |

In addition, SDKWork source dependency paths declared in `pnpm-workspace.yaml`, root `Cargo.toml`, and root `pubspec.yaml` are workspace-root owned. Sibling SDKWork repositories are consumed through these native build-tool mechanisms; the workspace root is the single source of truth for those paths, and member packages consume them by protocol (`workspace:*`, `{ workspace = true }`, package name).

Rules:

- Root/application `.sdkwork/` is source workspace metadata. It is not runtime state.
- Generated SDK output `.sdkwork/` directories are generator-owned. Do not add repository skills, plugins, or hand-authored workspace manifests there.
- Runtime `~/.sdkwork/<app>` directories are user-private. Do not commit them, mirror them into source, or use them as source standards.
- Local/private source workspace state may exist only under ignored paths such as `.sdkwork/local/`, `.sdkwork/tmp/`, `.sdkwork/cache/`, or `.sdkwork/secrets/`.
- Multi-repository SDKWork workspaces `MUST` declare sibling SDKWork source paths in native build-tool workspace roots (`pnpm-workspace.yaml packages:`, `Cargo.toml [workspace.dependencies]`, or root `pubspec.yaml dependency_overrides`), not in `.sdkwork/`.
- A member package `MUST NOT` redeclare a sibling SDKWork source path; it consumes the workspace root entry by native protocol.
- A SDKWork workspace root `SHOULD` be co-located with the SDKWork application root or git repository root. A workspace root that is not a git repository root is allowed only when explicitly documented.

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
- Skills `MUST NOT` store product source code, generated SDK output, runtime data, secrets, API keys, auth tokens, private certificates, local credentials, provider account IDs, or user-private files.
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
- Runtime `~/.sdkwork/<app>` directories are not copied into source.
- Multi-repository SDKWork source dependency paths are declared only in `pnpm-workspace.yaml packages:`, root `Cargo.toml [workspace.dependencies]`, or root `pubspec.yaml dependency_overrides`; member packages do not redeclare sibling source paths.
- `.sdkwork/manifests/*.json` does not contain SDKWork source dependency paths when native build-tool workspace roots are the declared source of truth.

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
