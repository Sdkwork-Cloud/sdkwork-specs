# SDKWork Dependency Management Standard

- Version: 1.1
- Scope: native build-tool dependency management, cross-repository source paths, release dependency refs, supply-chain evidence, and dependency-owned SDK/API boundaries
- Related: `CONFIG_SPEC.md`, `ENVIRONMENT_SPEC.md`, `GITHUB_WORKFLOW_SPEC.md`, `SUPPLY_CHAIN_SECURITY_SPEC.md`, `SDK_SPEC.md`, `SDK_WORKSPACE_GENERATION_SPEC.md`, `APP_SDK_INTEGRATION_SPEC.md`, `TEST_SPEC.md`, `DOCUMENTATION_SPEC.md`

This standard defines how SDKWork repositories depend on other SDKWork repositories without creating a second SDKWork-specific dependency system. SDKWork dependency management is build-tool-first: pnpm, Cargo, Flutter/Dart, Gradle, Maven, Python, and other package managers remain the dependency authorities for their language and runtime. SDKWork standards add cross-repository consistency, SDK/API ownership, release refs, and supply-chain evidence only where native tools do not cover SDKWork semantics.

Rules:

- SDKWork standards `MUST NOT` introduce a default source dependency directory or a new dependency manifest when the native build tool already has an appropriate dependency mechanism.
- Source dependency layout `MUST` use the repository's existing workspace shape and native build-tool conventions.
- SDKWork standards define no source dependency root; dependency roots belong to the active native build-tool workspace.
- Release and CI tooling may checkout repositories in runner-specific working directories, but those directories are workflow implementation details and must not become source dependency authorities.

## 1. System Model

SDKWork distinguishes these dependency concerns:

| Concern | Purpose | Authority |
| --- | --- | --- |
| Language/package dependency | Packages, crates, modules, SDK packages, generated client packages, and shared build inputs consumed by code | Native build-tool files such as `pnpm-workspace.yaml`, root `package.json`, `Cargo.toml`, `pubspec.yaml`, `settings.gradle.kts`, `libs.versions.toml`, parent `pom.xml`, `pyproject.toml`, and lockfiles |
| SDKWork release dependency | Git repository and ref that must be checked out or otherwise resolved for packaging, release, or reproducible CI | `sdkwork.workflow.json` and the reusable SDKWork workflow framework |
| SDK/API ownership dependency | Dependency-owned APIs, SDK families, and composed wrappers consumed by an app | `SDK_SPEC.md`, `SDK_WORKSPACE_GENERATION_SPEC.md`, `APP_SDK_INTEGRATION_SPEC.md`, SDK assembly metadata, and component specs |
| Runtime SDK dependency surface | Base URLs, credential modes, same-origin mount proof, and SDK client bootstrap for dependency SDKs | `CONFIG_SPEC.md`, `ENVIRONMENT_SPEC.md`, `APP_SDK_INTEGRATION_SPEC.md` |
| Runtime install path | Deployed binary, config, cache, database, service, or user-state path | `DEPLOYMENT_SPEC.md`, install package plans, runtime config |
| Documentation placeholder | Portable examples that describe a path without binding to a machine | `DOCUMENTATION_SPEC.md` |

Rules:

- Source/build dependency paths `MUST` be repository-relative, workspace-relative, or native package-manager coordinates. They must be portable across Windows, macOS, and Linux.
- Source/build dependency paths `MUST NOT` be machine-specific absolute paths such as `D:\workspace\...`, `/home/<user>/...`, `/Users/<user>/...`, or `/mnt/<drive>/...`.
- JSON, YAML, TOML, package manifests, workspace manifests, and SDKWork config files `MUST` use POSIX-style `/` separators for source/build paths unless a native tool format requires otherwise.
- Runtime install paths may be OS-specific when they are the actual target system contract, for example `/etc/sdkwork/...`, `/var/lib/sdkwork/...`, `%ProgramFiles%/...`, or `%USERPROFILE%/...`; they must not be reused as source dependency paths.
- Documentation `MUST` use placeholders such as `<workspace-root>`, `<repository-root>`, `<application-root>`, `<release-root>`, and `<dependency-id>` when describing variable local or release paths.

## 2. Native Build-Tool Dependency Authorities

SDKWork repositories must use the native dependency management system for the language or build runtime in use.

Rules:

- Node, TypeScript, React, and Vite work `MUST` use pnpm's native workspace model: `pnpm-workspace.yaml`, root `package.json`, `workspace:*`, catalogs, overrides, and `pnpm-lock.yaml`.
- Rust work `MUST` use Cargo's native workspace model: root `Cargo.toml`, `[workspace]`, `[workspace.dependencies]`, path dependencies, feature unification, and `Cargo.lock` where applicable.
- Flutter and Dart work `MUST` use `pubspec.yaml`, native path/git/hosted dependency declarations, dependency overrides when appropriate, and lockfiles for applications.
- Android and Gradle work `MUST` use `settings.gradle`, `settings.gradle.kts`, included builds, version catalogs such as `libs.versions.toml`, dependency constraints, and Gradle lock or verification metadata where applicable.
- Java and Maven work `MUST` use parent POMs, modules, `dependencyManagement`, profiles, and lock or reproducibility mechanisms available to that build.
- Python work `MUST` use the repository's chosen native Python dependency authority, such as `pyproject.toml`, lockfiles, constraints, or workspace tooling.
- Package, crate, module, and SDK dependency versions and paths `SHOULD` be centralized at the build workspace root and reused by child packages through native mechanisms.
- Child packages `SHOULD NOT` repeat the same SDKWork source path or third-party version when the native tool supports root-level dependency management.
- SDKWork standards checks read and validate native build-tool files. They must not require a parallel SDKWork dependency manifest solely to restate the same dependencies.

Recommended native centralization patterns:

| Toolchain | Preferred centralization |
| --- | --- |
| pnpm | Root `pnpm-workspace.yaml`, root `package.json`, `catalog`, `overrides`, `workspace:*`, `pnpm-lock.yaml` |
| Cargo | Workspace root `[workspace.dependencies]`, crate-level `{ workspace = true }`, `Cargo.lock` where applicable |
| Flutter/Dart | Root or app `pubspec.yaml`, dependency overrides for local SDKWork package paths when needed, app `pubspec.lock` |
| Gradle | `settings.gradle.kts`, included builds, version catalogs, dependency constraints, lock or verification metadata |
| Maven | Parent POM, modules, `dependencyManagement`, profiles |
| Python | `pyproject.toml`, lockfiles, constraints, native workspace tool config |

## 3. Cross-Repository Source Paths

SDKWork commonly uses a multi-repository workspace where SDKWork repositories are checked out as siblings under one workspace root. Local development and CI/release **MUST** consume sibling SDKWork source through the native build-tool workspace mechanism of the consuming repository; ad-hoc `link:` references and scattered `path = "..."` declarations are forbidden.

Rules:

- Local development `MUST` consume sibling SDKWork repositories through the consuming repository's native workspace mechanism, not through hand-written link targets or absolute paths.
- The consuming workspace `MUST` declare each SDKWork source package **exactly once** at the workspace root. Member packages `MUST NOT` redeclare the same source path.
- pnpm workspaces `MUST` declare sibling SDKWork source packages under the root `pnpm-workspace.yaml` `packages:` array. Consumer `package.json` `MUST` reference them with `workspace:*`; `link:` is forbidden for SDKWork cross-workspace sources.
- Cargo workspaces `MUST` declare sibling SDKWork source crates under the root `Cargo.toml` `[workspace.dependencies]` table using `path = "..."`. Member crates `MUST` consume them with `crate_name.workspace = true`; direct `path = "..."` in member crates is forbidden for SDKWork cross-workspace sources.
- Flutter and Dart workspaces `MUST` declare sibling SDKWork source packages under the consuming app's `pubspec.yaml` `dependency_overrides` with `path:` declared **once** at the workspace root or app entry, and consumed by member packages by package name.
- Gradle workspaces `MUST` use `settings.gradle(.kts)` included builds; Maven workspaces `MUST` use parent POM modules; both are forbidden from declaring cross-workspace paths in member modules.
- Sibling paths in native build-tool files `MUST` resolve to a known SDKWork repository, SDK family, package, crate, or module. Unknown or stale sibling paths are invalid.
- A repository that can be checked out alone `SHOULD` document the expected sibling workspace layout and the fallback release/CI behavior.
- Native toolchain files `MUST NOT` scatter equivalent dependency paths across many child packages when a root workspace mechanism can centralize them.
- If a build must use generated SDK output from a sibling repository, the path must point to the owning SDK family output or approved facade. Generated output must still remain generator-owned under `SDK_SPEC.md`.
- Source dependencies must not be copied into product source trees for convenience.
- `[workspace.dependencies]` and `pnpm-workspace.yaml packages:` are the **single source of truth** for SDKWork source dependency paths. Documentation, scripts, and tests must derive paths from these roots, not from a parallel list.

Examples:

```yaml
# pnpm-workspace.yaml  (declared ONCE at the workspace root)
packages:
  - "packages/*"
  - "../sdkwork-appbase/packages/common/iam/sdkwork-iam-contracts"
  - "../sdkwork-appbase/packages/pc-react/iam/sdkwork-auth-pc-react"
  - "../sdkwork-core/sdkwork-core-pc-react"
  - "../sdkwork-ui/sdkwork-ui-pc-react"
  - "../sdkwork-rtc/sdks/sdkwork-rtc-sdk/sdkwork-rtc-sdk-typescript"

catalog:
  react: ^19.2.4
  vite: ^8.0.3
```

```json
// Consumer package.json  (consumes from pnpm-workspace.yaml packages:)
{
  "dependencies": {
    "@sdkwork/iam-contracts": "workspace:*",
    "@sdkwork/auth-pc-react": "workspace:*",
    "@sdkwork/core-pc-react": "workspace:*"
  }
}
```

```toml
# Root Cargo.toml  (declared ONCE in [workspace.dependencies])
[workspace]
members = [ "crates/*", "services/*" ]

[workspace.dependencies]
sdkwork_id_rust = { path = "../sdkwork-appbase/packages/native-rust/foundation/sdkwork-id-rust" }
sdkwork_drive_storage_contract = { path = "../sdkwork-drive/crates/sdkwork-drive-storage-contract" }
sdkwork_knowledgebase_contract = { path = "crates/sdkwork-knowledgebase-contract" }
```

```toml
# Member Cargo.toml  (consumes from [workspace.dependencies])
[dependencies]
sdkwork_id_rust.workspace = true
sdkwork_drive_storage_contract.workspace = true
sdkwork_knowledgebase_contract.workspace = true
```

## 4. Release And CI Dependencies

Release and CI dependency refs must be reproducible, but release checkout layout must not redefine local source dependency layout.

Rules:

- SDKWork application release dependencies `MUST` be declared in `sdkwork.workflow.json` when packaging or release requires checking out another SDKWork repository.
- Release dependencies `MUST` declare stable `id`, `repository`, `ref` or `refInput`, and `tokenSecret`.
- `repository` `MUST` use the `owner/repo` form.
- `tokenSecret` for v1 SDKWork release checkout `MUST` be `SDKWORK_RELEASE_TOKEN`.
- Dependency refs `MUST` be pinned commit SHAs or validated safe Git refs before checkout.
- Application workflow YAML `MUST NOT` hide release dependency checkout logic outside `sdkwork.workflow.json` and the reusable SDKWork GitHub workflow framework.
- A dependency not consumed by the current application build `MUST NOT` remain in `sdkwork.workflow.json` as stale release configuration.
- `dependencies[].path`, when used, is a release/CI checkout path for that workflow. It `MUST` be a safe relative path, must not escape the workflow workspace, and must not overlap application source, generated SDK output, framework checkout, or another dependency checkout.
- When `dependencies[].path` is omitted, the reusable workflow may choose its own safe checkout directory. That default is a workflow implementation detail, not a standards-defined source path.
- Release jobs `MUST` fail when a declared dependency cannot be checked out, uses an unsafe ref, or checks out to an unsafe path.
- Thin application workflow YAML may expose manual `workflow_dispatch` inputs for dependency refs, but must pass those refs as structured `dependency_refs_json` to the reusable framework.

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

## 5. Native Tooling And Release Ref Consistency

SDKWork checks bridge native build tools and release dependency refs.

Rules:

- If native build-tool files consume an external SDKWork repository and the application is packaged or released, `sdkwork.workflow.json` `MUST` declare a matching release dependency for that repository unless the dependency is resolved from a registry with separate supply-chain evidence.
- The same SDKWork source dependency `MUST` appear **exactly once** in the consuming workspace: pnpm at `pnpm-workspace.yaml packages:`, Cargo at `[workspace.dependencies]`, Flutter/Dart at the root `pubspec.yaml dependency_overrides`. Member packages consume the entry by protocol (`workspace:*`, `{ workspace = true }`, package name) and never redeclare the path.
- If `sdkwork.workflow.json` declares a release dependency, native build-tool files or build scripts `MUST` consume that dependency through a documented package, crate, module, SDK family, generated SDK output, composed facade, or release-only build step.
- The release-time materialization of a `sdkwork.workflow.json` dependency `MUST` place the checkout where the consuming workspace root expects it: the path declared in `pnpm-workspace.yaml packages:` or `Cargo.toml [workspace.dependencies]` MUST resolve to the checkout root used by the workflow. When the workflow checkout path differs from the local sibling path, the framework `MUST` redirect the workspace root's declared path to the checkout (symlink, junction, or workspace-root path rewrite); consumer `package.json` / `Cargo.toml` files do not need to be edited.
- Native build-tool workspace paths, package names, SDK family names, and release dependency ids must be machine-checkable. The id used in `sdkwork.workflow.json dependencies[]` `MUST` equal the relative sibling path's basename used in the consuming workspace root.
- Release evidence `MUST` include the dependency refs actually used for package artifacts according to `SUPPLY_CHAIN_SECURITY_SPEC.md`.
- Lockfiles and native dependency verification files must be kept in sync with dependency changes.
- Legacy scripts that clone or rewrite shared SDK dependencies outside native build-tool mechanisms `SHOULD` be migrated to native workspace, package-manager, or release workflow mechanisms. While retained, they must be documented and covered by verification.

## 6. SDK/API Ownership

Dependency management does not change API or SDK ownership.

Rules:

- A consuming application `MUST NOT` regenerate dependency-owned APIs into its own generated SDK families.
- Dependency-owned APIs consumed by an app `MUST` remain in the owning dependency SDK family or an approved composed wrapper.
- Product-owned SDK generation inputs `MUST` subtract dependency-owned routes and operations before sdkgen runs, unless the current product is the owner.
- Rust backends integrated through a dependency library `MUST` compose the dependency runtime/backend as a dependency; they must not cause dependency-owned APIs such as appbase IAM to appear in the consuming product SDK.
- Appbase IAM, Drive upload, IM, commerce, media, or other dependency surfaces must be represented through `sdkDependencies`, dependency SDK base URLs, generated dependency SDK clients, or approved composed SDK facades.
- Native build-tool dependencies and runtime API composition are separate facts. A Cargo, pnpm,
  Maven, Gradle, Flutter/Dart, Python, or other package dependency proves source/build availability
  only; it does not prove that dependency-owned HTTP APIs are exported from the consuming SDK or
  mounted by the consuming runtime.
- Dependency API export is opt-in. Consuming components `MUST` declare `dependencyApiExports`
  explicitly and default it to `[]` when dependency capabilities are consumed but not re-exported.
  Build-tool dependencies, `sdkDependencies`, and workspace membership do not authorize API
  re-export.
- Runtime dependency API availability is opt-in. Consuming runtimes `MUST` declare
  `dependencyApiSurfaces` for same-origin mounts, external services, or intentionally not-mounted
  dependency surfaces. A route manifest, route contract crate, or SDK dependency is not executable
  router coverage.
- Rust component dependencies used for embedded composition `MUST` expose public executable
  router/controller/service builders or approved service traits. Consumers must not deep-import
  private dependency source files or copy dependency handlers to satisfy runtime composition.

The detailed SDK ownership rules remain in `SDK_SPEC.md`, `SDK_WORKSPACE_GENERATION_SPEC.md`, `API_SPEC.md`, and `APP_SDK_INTEGRATION_SPEC.md`.

## 7. Documentation

Rules:

- Documentation examples for source/build dependency paths `MUST` use relative paths or placeholders.
- Documentation `MUST NOT` tell developers to edit source manifests with one person's absolute path.
- Cross-platform command examples `SHOULD` use extensionless commands such as `pnpm`, `node`, `cargo`, and `python`; a Windows note may document `pnpm.cmd` when PowerShell script execution policy blocks `pnpm.ps1`.
- OS-specific runtime install paths are allowed only when documenting target installation layout, not local source dependency layout.
- Documentation should explain which native build-tool file owns dependency declarations for each language runtime in the repository.

## 8. Tests

Rules:

- Repositories that declare release dependencies `MUST` include static verification that `sdkwork.workflow.json`, workflow YAML, native build-tool workspace manifests, and path mappings use portable source dependency paths.
- Tests `MUST` fail on source/build dependency paths containing machine-specific absolute paths.
- Tests `MUST` fail when native build-tool files consume undeclared SDKWork release dependencies for a packaged application.
- Tests `MUST` fail when stale dependencies remain in `sdkwork.workflow.json`.
- Tests `MUST` verify dependency path and version declarations are centralized through native workspace mechanisms where the build tool supports them.
- Tests `MUST` verify that every SDKWork source dependency declared in any member `package.json` / `Cargo.toml` / `pubspec.yaml` is also declared in the workspace root (`pnpm-workspace.yaml packages:`, root `Cargo.toml [workspace.dependencies]`, or root `pubspec.yaml dependency_overrides`).
- Tests `MUST` fail on `link:` protocol references to SDKWork cross-workspace sources in pnpm `package.json` files; SDKWork cross-workspace sources `MUST` use `workspace:*`.
- Tests `MUST` fail on direct `path = "../sdkwork-..."` declarations in member Cargo crate `Cargo.toml` files; SDKWork cross-workspace sources `MUST` use `{ workspace = true }`.
- Tests `MUST` verify package manager lockfiles or equivalent reproducibility files are present and updated when required by the repository's build tool.
- SDK generation tests `MUST` verify dependency-owned API operations are filtered from product-owned SDK generator inputs.
- Dependency integration tests `MUST` verify `dependencyApiExports` defaults to no export, configured
  exports reference declared `sdkDependencies`, and generated product SDK output does not change when
  dependency export configuration changes.
- Runtime dependency tests `MUST` verify `dependencyApiSurfaces` exists for HTTP dependency SDKs and
  fails when a dependency API is treated as same-origin without executable router/controller/service
  coverage.

## 9. Acceptance Checklist

- [ ] Dependencies are managed through native build-tool files instead of a parallel SDKWork dependency system.
- [ ] pnpm: every SDKWork cross-workspace source is declared exactly once in `pnpm-workspace.yaml packages:`; member `package.json` files use `workspace:*` only.
- [ ] Cargo: every SDKWork cross-workspace source is declared exactly once in root `Cargo.toml [workspace.dependencies]`; member crates use `{ workspace = true }` only.
- [ ] Flutter/Dart: every SDKWork cross-workspace source is declared exactly once at the workspace root or app entry; member packages consume by package name.
- [ ] `sdkwork.workflow.json dependencies[]` ids match the workspace root's declared sibling paths by basename.
- [ ] pnpm, Cargo, Flutter/Dart, Gradle, Maven, Python, and other toolchains use their native workspace, dependency management, and lockfile mechanisms where applicable.
- [ ] Source/build config contains no machine-specific absolute paths.
- [ ] External SDKWork source paths in native build-tool files resolve to known SDKWork repositories, packages, crates, modules, SDK families, or approved generated SDK outputs.
- [ ] Repeated path and version declarations are centralized through native workspace mechanisms where practical.
- [ ] Release dependencies needed for packaged artifacts are declared in `sdkwork.workflow.json`.
- [ ] Stale release dependencies have been removed.
- [ ] Release dependency refs are pinned or safely validated and included in release evidence.
- [ ] Dependency-owned APIs are not regenerated into consuming product SDKs.
- [ ] Dependency API exports are explicit through `dependencyApiExports` and default to no export.
- [ ] Runtime dependency API surfaces are explicit through `dependencyApiSurfaces`; build-tool
  dependencies are not treated as same-origin router coverage.
