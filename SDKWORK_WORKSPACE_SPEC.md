# SDKWork Repository Workspace Standard

- Version: 1.0
- Scope: source-controlled `.sdkwork/` workspace metadata at every git repository root and every SDKWork application root
- Related: `README.md`, `APPLICATION_SPEC.md`, `COMPONENT_SPEC.md`, `DOCUMENTATION_SPEC.md`, `GOVERNANCE_SPEC.md`, `SDK_SPEC.md`, `SDK_WORKSPACE_GENERATION_SPEC.md`, `RUNTIME_DIRECTORY_SPEC.md`, `SECURITY_SPEC.md`, `TEST_SPEC.md`

This standard defines the repository/application `.sdkwork/` directory. It is the local knowledge and extension workspace for SDKWork development. It stores reusable skills, repository-local plugins, and optional machine-readable workspace manifests that help agents, developers, and CI use the same standards.

Every SDKWork git repository root and every SDKWork application root `MUST` contain `.sdkwork/skills/` and `.sdkwork/plugins/`. Empty directories are not enough unless the repository has a tracked placeholder such as `README.md` or `.gitkeep`.

## 1. Directory Meanings

There are three different SDKWork path families that must not be mixed:

| Path family | Owner | Purpose | Governing spec |
| --- | --- | --- | --- |
| `<repo-or-application-root>/.sdkwork/` | repository/application maintainers | Source-controlled workspace metadata, common skills, local plugins, optional manifests | this file |
| `<generated-sdk-output>/.sdkwork/sdkwork-generator-*.json` | `sdkgen` | Generated SDK control-plane reports and manifests | `SDK_SPEC.md`, `SDK_WORKSPACE_GENERATION_SPEC.md` |
| `~/.sdkwork/<app>` or `%USERPROFILE%\.sdkwork\<app>` | runtime user/process | User-private runtime config, data, cache, logs, secrets, temp files | `RUNTIME_DIRECTORY_SPEC.md` |

Rules:

- Root/application `.sdkwork/` is source workspace metadata. It is not runtime state.
- Generated SDK output `.sdkwork/` directories are generator-owned. Do not add repository skills, plugins, or hand-authored workspace manifests there.
- Runtime `~/.sdkwork/<app>` directories are user-private. Do not commit them, mirror them into source, or use them as source standards.
- Local/private source workspace state may exist only under ignored paths such as `.sdkwork/local/`, `.sdkwork/tmp/`, `.sdkwork/cache/`, or `.sdkwork/secrets/`.

## 2. Required Workspace Shape

Every git repository root and every SDKWork application root `MUST` have:

```text
<repo-or-application-root>/
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
- `skillsDir` and `pluginsDir` `MUST` point to the required local directories.
- `canonicalSpecs` should point to the root standards entrypoint used by the repository/application.
- Optional manifests must not become a second source of truth for API, SDK, database, security, runtime, or component contracts.

## 6. Source Control And Security

Rules:

- `.sdkwork/README.md`, `.sdkwork/skills/README.md`, `.sdkwork/plugins/README.md`, approved skills, approved plugins, and optional non-secret manifests should be committed.
- `.sdkwork/local/`, `.sdkwork/tmp/`, `.sdkwork/cache/`, `.sdkwork/secrets/`, local install state, generated transient outputs, and any secret-bearing files `MUST` be ignored.
- Repository-local skills and plugins may reference private repository paths, but they `MUST NOT` embed private credentials or machine-specific absolute paths unless the path is a documented SDKWork canonical path.
- Any script under `.sdkwork/` that contacts external services `MUST` document the service, credential source, dry-run behavior when available, and verification command.
- Security reviews may scan `.sdkwork/` as source. Sensitive local state must never be placed there in committed form.

## 7. Discovery And Precedence

Recommended discovery order:

1. Current application root `.sdkwork/`.
2. Enclosing git repository root `.sdkwork/`.
3. Root `specs/` standards referenced by the local workspace.
4. User-global skills or plugins.

Rules:

- Closer `.sdkwork/` content may add application-specific guidance, but it must not contradict repository-root or root `specs/` standards.
- If two skills have the same name, the application-local skill may specialize the repository skill only when it explicitly cites the repository skill or canonical specs it extends.
- User-global skills and plugins are optional conveniences. They cannot replace the checked-in repository/application `.sdkwork/` standard content.

## 8. Verification

Repository/application workspace verification `MUST` check:

- Every git repository root has `.sdkwork/`, `.sdkwork/skills/`, and `.sdkwork/plugins/`.
- Every application root has `.sdkwork/`, `.sdkwork/skills/`, and `.sdkwork/plugins/`.
- Required directories are represented by tracked files such as `README.md` when they are otherwise empty.
- Real skills have `.sdkwork/skills/<skill-name>/SKILL.md`.
- Installable plugins have `.sdkwork/plugins/<plugin-name>/.codex-plugin/plugin.json`.
- `.sdkwork/` does not contain obvious secret-bearing files, runtime database files, generated SDK transport outputs, or `sdkgen` generated control-plane reports outside generated SDK output.
- Generated SDK output `.sdkwork/sdkwork-generator-*.json` remains under generated SDK output and is not treated as a repository/application workspace.
- Runtime `~/.sdkwork/<app>` directories are not copied into source.

## 9. Acceptance Checklist

- [ ] Git repository root has `.sdkwork/README.md`.
- [ ] Git repository root has `.sdkwork/skills/README.md`.
- [ ] Git repository root has `.sdkwork/plugins/README.md`.
- [ ] Each application root has its own `.sdkwork/README.md`, `.sdkwork/skills/README.md`, and `.sdkwork/plugins/README.md`.
- [ ] `.sdkwork/.gitignore` ignores local, temp, cache, and secret-bearing state.
- [ ] Repository/application skills have `SKILL.md` and cite the relevant root specs.
- [ ] Repository/application plugins have `.codex-plugin/plugin.json` when installable.
- [ ] `.sdkwork/` contains no secrets, runtime data, generated SDK transport output, or user-private files.
- [ ] Generated SDK `.sdkwork/sdkwork-generator-*.json` files remain generator-owned and are not modified by repository workspace tooling.
- [ ] Runtime private paths still follow `RUNTIME_DIRECTORY_SPEC.md`.
