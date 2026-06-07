# SDKWork Dependency Management Standard

- Version: 1.0
- Scope: source dependency layout, local development dependency materialization, release Git dependency checkout, cross-platform path rules, dependency-owned SDK/API boundaries
- Related: `SDKWORK_WORKSPACE_SPEC.md`, `CONFIG_SPEC.md`, `ENVIRONMENT_SPEC.md`, `GITHUB_WORKFLOW_SPEC.md`, `SUPPLY_CHAIN_SECURITY_SPEC.md`, `SDK_SPEC.md`, `SDK_WORKSPACE_GENERATION_SPEC.md`, `APP_SDK_INTEGRATION_SPEC.md`, `TEST_SPEC.md`, `DOCUMENTATION_SPEC.md`

This standard defines how SDKWork repositories depend on other SDKWork repositories without baking one developer machine, one operating system, or one release checkout layout into application source. Dependency paths are build-time source paths, not runtime install paths.

## 1. System Model

SDKWork distinguishes these path classes:

| Path class | Purpose | Authority |
| --- | --- | --- |
| Source dependency path | Source packages, generated SDK packages, and shared build inputs consumed by an app repository | `sdkwork.workflow.json`, package workspace manifests, and local materialization scripts |
| Runtime install path | Deployed binary, config, cache, database, service, or user-state path | `DEPLOYMENT_SPEC.md`, install package plans, runtime config |
| Generated SDK output path | Product-owned generated SDK artifacts under an application `sdks/` family | `SDK_SPEC.md` and `SDK_WORKSPACE_GENERATION_SPEC.md` |
| Documentation placeholder | Portable examples that describe a path without binding to a machine | `DOCUMENTATION_SPEC.md` |

Rules:

- Source/build dependency paths `MUST` be repository-relative and cross-platform.
- Source/build dependency paths `MUST NOT` be machine-specific absolute paths such as `D:\workspace\...`, `/home/<user>/...`, `/Users/<user>/...`, or `/mnt/<drive>/...`.
- JSON, YAML, TOML, package manifests, workspace manifests, and SDKWork config files `MUST` use POSIX-style `/` separators for source/build paths.
- Runtime install paths may be OS-specific when they are the actual target system contract, for example `/etc/sdkwork/...`, `/var/lib/sdkwork/...`, `%ProgramFiles%/...`, or `%USERPROFILE%/...`; they must not be reused as source dependency paths.
- Documentation `MUST` use placeholders such as `<workspace-root>`, `<application-root>`, `<release-root>`, and `<dependency-id>` when describing variable local or release paths.

## 2. Dependency Declaration

Rules:

- SDKWork application release dependencies `MUST` be declared in `sdkwork.workflow.json`.
- Release dependencies `MUST` declare stable `id`, `repository`, `ref` or `refInput`, and `tokenSecret`.
- `repository` `MUST` use the `owner/repo` form.
- `tokenSecret` for v1 SDKWork release checkout `MUST` be `SDKWORK_RELEASE_TOKEN`.
- Dependency refs `MUST` be pinned commit SHAs or validated safe Git refs before checkout.
- Application workflow YAML `MUST NOT` hide release dependency checkout logic outside `sdkwork.workflow.json` and the reusable SDKWork GitHub workflow framework.
- A dependency not consumed by the current application build `MUST NOT` remain in `sdkwork.workflow.json` as stale release configuration.

Recommended release dependency shape:

```json
{
  "id": "sdkwork-appbase",
  "repository": "Sdkwork-Cloud/sdkwork-appbase",
  "ref": "0123456789abcdef0123456789abcdef01234567",
  "refInput": "SDKWORK_APPBASE_REF",
  "tokenSecret": "SDKWORK_RELEASE_TOKEN"
}
```

## 3. Materialized Dependency Root

Rules:

- The default materialized dependency root is:

```text
<application-root>/.sdkwork/dependencies/<dependency-id>
```

- When `dependencies[].path` is omitted in `sdkwork.workflow.json`, the reusable workflow `MUST` checkout each dependency under `.sdkwork/dependencies/<dependency-id>`.
- Application source workspaces, TypeScript path mappings, Vite aliases, Cargo path dependencies, Maven/Gradle included builds, and other build manifests `SHOULD` point at the materialized dependency root instead of hard-coded sibling repository paths.
- `dependencies[].path` `SHOULD` be omitted unless a documented framework constraint requires an override.
- If `dependencies[].path` is used, it `MUST` be a safe relative path, must not escape the application repository, and must not overlap the application source path, generated SDK output, framework checkout, or another dependency checkout.
- `.sdkwork/dependencies/` is local/release materialized state and `MUST` be ignored by source control.

## 4. Local Development

Rules:

- Local development `MAY` consume sibling repositories from a multi-repository workspace, but build manifests `SHOULD` still resolve them through `.sdkwork/dependencies/<dependency-id>`.
- A repository-local materialization command `SHOULD` create symlinks or platform-equivalent directory links from `.sdkwork/dependencies/<dependency-id>` to `../<dependency-id>` when that sibling repository exists.
- On Windows, local materialization may use directory junctions for developer environments where directory symlinks require elevated privileges or developer mode.
- Local materialization `MUST NOT` overwrite a real Git checkout, non-empty directory, or non-link dependency root produced by release tooling.
- Local materialization `MUST` provide a check mode that fails when required dependencies are not present or linked.
- Local materialization scripts `MUST` read dependency ids from `sdkwork.workflow.json` rather than duplicating a second dependency list.

Recommended local commands:

```bash
pnpm deps:local:link
pnpm deps:local:check
```

## 5. Release And CI

Rules:

- Release and CI builds `MUST` use Git repository/ref checkout through `sdkwork.workflow.json` and the reusable SDKWork workflow framework.
- Release and CI builds `MUST NOT` rely on sibling directories outside the application repository.
- Release dependency refs used for package artifacts `MUST` be included in release evidence according to `SUPPLY_CHAIN_SECURITY_SPEC.md`.
- Release jobs `MUST` fail when a declared dependency cannot be checked out, uses an unsafe ref, or checks out to a path that overlaps application source.
- Thin application workflow YAML may expose manual `workflow_dispatch` inputs for dependency refs, but must pass those refs as structured `dependency_refs_json` to the reusable framework.

## 6. SDK/API Ownership

Dependency management does not change API or SDK ownership.

Rules:

- A consuming application `MUST NOT` regenerate dependency-owned APIs into its own generated SDK families.
- Dependency-owned APIs consumed by an app `MUST` remain in the owning dependency SDK family or an approved composed wrapper.
- Product-owned SDK generation inputs `MUST` subtract dependency-owned routes and operations before sdkgen runs, unless the current product is the owner.
- Rust backends integrated through a dependency library `MUST` compose the dependency runtime/backend as a dependency; they must not cause dependency-owned APIs such as appbase IAM to appear in the consuming product SDK.
- Appbase IAM, Drive upload, IM, commerce, media, or other dependency surfaces must be represented through `sdkDependencies`, dependency SDK base URLs, generated dependency SDK clients, or approved composed SDK facades.

The detailed SDK ownership rules remain in `SDK_SPEC.md`, `SDK_WORKSPACE_GENERATION_SPEC.md`, `API_SPEC.md`, and `APP_SDK_INTEGRATION_SPEC.md`.

## 7. Documentation

Rules:

- Documentation examples for source/build dependency paths `MUST` use relative paths or placeholders.
- Documentation `MUST NOT` tell developers to edit source manifests with one person's absolute path.
- Cross-platform command examples `SHOULD` use extensionless commands such as `pnpm`, `node`, `cargo`, and `python`; a Windows note may document `pnpm.cmd` when PowerShell script execution policy blocks `pnpm.ps1`.
- OS-specific runtime install paths are allowed only when documenting target installation layout, not local source dependency layout.

## 8. Tests

Rules:

- Repositories that declare release dependencies `MUST` include static verification that `sdkwork.workflow.json`, workflow YAML, workspace manifests, and path mappings use portable source dependency paths.
- Tests `MUST` fail on source/build dependency paths containing machine-specific absolute paths.
- Tests `MUST` fail when workspace manifests depend on undeclared release dependencies.
- Tests `MUST` fail when stale dependencies remain in `sdkwork.workflow.json`.
- Tests `MUST` verify local dependency materialization has both apply and check commands when local source dependencies are supported.
- SDK generation tests `MUST` verify dependency-owned API operations are filtered from product-owned SDK generator inputs.

## 9. Acceptance Checklist

- [ ] Release dependencies are declared in `sdkwork.workflow.json`.
- [ ] Local dev uses `.sdkwork/dependencies/<dependency-id>` as the build dependency root.
- [ ] Release/CI checkout uses Git repository/ref dependencies through the reusable workflow.
- [ ] No source/build config contains machine-specific absolute paths.
- [ ] Workspace manifests do not reference undeclared SDKWork dependencies.
- [ ] Stale dependencies have been removed.
- [ ] `.sdkwork/dependencies/` is ignored by source control.
- [ ] Dependency-owned APIs are not regenerated into consuming product SDKs.
