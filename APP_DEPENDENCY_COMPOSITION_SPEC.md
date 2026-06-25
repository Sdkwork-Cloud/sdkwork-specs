# App Dependency Composition Standard

- Version: 1.0
- Scope: dual-entry application dependency architecture across PC, H5, Flutter, mini program, native Android, native iOS, native HarmonyOS, backend/admin React, and Rust-enabled application roots; semantic dependency manifests; core-package import entrypoints; frontend/backend dependency chains; L0–L3 dependency layering
- Related: `APPLICATION_SPEC.md`, `APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC.md`, `APP_SDK_INTEGRATION_SPEC.md`, `APP_PERMISSION_COMPOSITION_SPEC.md`, `MODULE_SPEC.md`, `COMPONENT_SPEC.md`, `DEPENDENCY_MANAGEMENT_SPEC.md`, `SDK_SPEC.md`, `CONFIG_SPEC.md`, `WEB_BACKEND_SPEC.md`, `TEST_SPEC.md`

This standard defines how SDKWork applications declare, compose, import, and verify dependencies without creating a second build-tool dependency system. Applications use two symmetric entrypoints:

1. **Application bootstrap entry** — thin app shell startup in `src/` or `lib/`.
2. **Library dependency composition entry** — the architecture `-core`, `-console-core`, or `-admin-core` package plus `specs/dependency.composition.json`.

Use `DEPENDENCY_MANAGEMENT_SPEC.md` for native build-tool workspace paths. Use `APP_SDK_INTEGRATION_SPEC.md` for runtime SDK inventory, TokenManager closure, and dependency API export/runtime surfaces. This file owns the semantic bridge and import-entry contract between those layers.

## 1. Four-Layer Dependency Model

SDKWork dependency concerns are layered. Lower layers are authoritative for their concern. Higher layers must not bypass lower-layer rules.

| Layer | Name | Authority | Owns |
| --- | --- | --- | --- |
| L0 | Build-tool | `DEPENDENCY_MANAGEMENT_SPEC.md` | pnpm/Cargo/Gradle/Maven/pubspec paths, versions, lockfiles |
| L1 | Semantic contract | this file + `COMPONENT_SPEC.md` + `SDK_SPEC.md` | `dependency.composition.json`, `sdkDependencies`, `dependencyApiExports`, `dependencyApiSurfaces` |
| L2 | Runtime composition | `APP_SDK_INTEGRATION_SPEC.md` + `CONFIG_SPEC.md` | bootstrap SDK inventory, TokenManager, base URLs, IAM runtime |
| L3 | Feature consumption | `MODULE_SPEC.md` + architecture UI specs | injected SDK ports, services, host contracts, route contributions |

Allowed direction:

```text
L3 feature packages
  -> L2 runtime/bootstrap through -core public exports only
  -> L1 semantic manifest and component contracts
  -> L0 native workspace entries declared once at workspace root
```

Forbidden:

- L3 packages importing generated SDK packages, appbase SDK packages, sibling capability private paths, or backend SDK packages outside an explicit `backend-admin` boundary.
- L2 bootstrap re-declaring dependency lists that are not derived from L1 manifests.
- L1 manifests declaring SDKWork source paths that are absent from L0 native workspace roots.
- Introducing a parallel dependency manifest that replaces pnpm/Cargo/Gradle/Maven/pubspec authority.

## 2. Dual Entry Architecture

Every SDKWork client application root `MUST` separate startup from dependency composition.

```text
client application root
  src/ or lib/                         # application bootstrap entry
    main.*
    bootstrap/
      environment.*
      routes.*
      providers.*

  packages/
    sdkwork-<application-code>-<arch>-core/           # app-side composition entry
    sdkwork-<application-code>-<arch>-console-core/   # optional console composition entry
    sdkwork-<application-code>-<arch>-admin-core/     # optional backend-admin composition entry
      src/ or lib/
        index.*
        composition/
          dependency-manifest.*
          sdk-inventory.*
          module-registry.*
          host-registry.*
        sdk/
        session/
        runtime/

  specs/
    component.spec.json
    dependency.composition.json       # semantic dependency manifest
```

Rules:

- Application bootstrap entry `MUST` stay thin: environment selection, provider wiring, route/shell assembly, host registration, and calls into the architecture core runtime factory.
- Library dependency composition entry `MUST` live in the architecture core package for each surface family. Do not create a separate `-dependencies` package unless `GOVERNANCE_SPEC.md` records an exception.
- Feature, console, and admin capability packages `MUST` consume SDK clients, reusable modules, host contracts, and session helpers through the matching core package public exports.
- Bootstrap `MUST` derive runtime SDK inventory from `specs/dependency.composition.json` and the core package composition helpers. Bootstrap `MUST NOT` maintain a second handwritten inventory that can drift from L1.
- Shared cross-application modules `MUST` be registered in `dependency.composition.json` `reusableModules[]` and bound in the core package `composition/module-registry.*`.

## 3. Semantic Dependency Manifest

Every client application root `MUST` contain `specs/dependency.composition.json`.

Required top-level fields:

| Field | Required | Purpose |
| --- | --- | --- |
| `schemaVersion` | yes | Manifest schema version; current value is `1` |
| `kind` | yes | Must be `sdkwork.dependency.composition` |
| `applicationCode` | yes | Canonical application code from `NAMING_SPEC.md` |
| `clientArchitecture` | yes | Architecture id such as `pc`, `h5`, `flutter-mobile`, `mp`, `android-mobile`, `ios-mobile`, `harmony-mobile` |
| `surfaces[]` | yes | One entry per runtime surface family actually present |
| `buildToolEntries` | yes | Native package references consumed by the app root; must map to L0 workspace entries |

Each `surfaces[]` entry `MUST` include:

| Field | Required | Purpose |
| --- | --- | --- |
| `surface` | yes | `app`, `console`, or `backend-admin` |
| `corePackage` | yes | Architecture core package name for this surface |
| `sdkClients[]` | yes | Declarative SDK inventory for the surface |
| `reusableModules[]` | yes | Explicit array; use `[]` when none |
| `hostAdapters[]` | yes | Explicit array; use `[]` when browser-only |
| `dependencyApiExports` | yes | Explicit array; default `[]` |
| `dependencyApiSurfaces` | yes | Explicit array; required when HTTP dependency SDKs are consumed |

Each `sdkClients[]` entry `MUST` include:

| Field | Required | Purpose |
| --- | --- | --- |
| `id` | yes | Stable runtime id such as `appbaseApp`, `productApp`, `driveApp` |
| `workspace` | yes | SDK family workspace id |
| `surface` | yes | `app-api`, `backend-api`, or `open-api` |
| `credentialMode` | yes | One of `authenticated-app-api`, `authenticated-backend-admin`, `protected-open-api-api-key`, `protected-open-api-oauth`, `protected-open-api-flexible`, `public-open-api`, `local-native`, `test-fake` |
| `nativePackage` | recommended | pnpm/Cargo/Gradle/Maven/pubspec package name bound in L0 |
| `role` | when dependency-owned | `application-owned` or `dependency` |
| `sdkDependencyRef` | when `role=dependency` | Matching `sdkDependencies[].workspace` |
| `exportFrom` | recommended | Core package public export consumers should use |

Rules:

- `surfaces[]` `MUST` include an `app` entry for every client root.
- `console` and `backend-admin` entries `MUST` exist only when the root owns those package families.
- `backend-admin` SDK clients `MUST` appear only under a `backend-admin` surface entry or inside the `-admin-core` composition entry. They `MUST NOT` appear under `app` or `console`.
- `sdkClients[].workspace` values `MUST` be a subset of or equal to the union of `sdkDependencies` declared by the matching core component spec and SDK assembly metadata.
- `dependencyApiExports` and `dependencyApiSurfaces` `MUST` follow `SDK_SPEC.md` and `APP_SDK_INTEGRATION_SPEC.md`. Default is no export.
- `buildToolEntries` `MUST NOT` duplicate L0 path strings in member packages. They reference package names/coordinates only.

### 3.1 Permission composition (`permissionComposition`)

When an application composes dependency modules with admin/console/app surfaces, it **must** declare `permissionComposition` in the same manifest. See `APP_PERMISSION_COMPOSITION_SPEC.md`.

Rules:

- Dependency module permission catalogs are inherited through `moduleCatalogRefs[]`; consumers **must not** copy dependency codes into feature packages.
- Application-owned permissions live in `specs/iam.module.manifest.json` referenced by `applicationModule.manifestRef`.
- Overrides are explicit entries under `routePermissionHints.overrides[]` or `bootstrapAccessTokenScope.supplement[]` only.
- L1 SDK inventory and L1 permission composition **must** stay in the same `dependency.composition.json` file so validators can prove consumer/runtime alignment.

Example:

```json
{
  "schemaVersion": 1,
  "kind": "sdkwork.dependency.composition",
  "applicationCode": "commerce",
  "clientArchitecture": "pc",
  "surfaces": [
    {
      "surface": "app",
      "corePackage": "@sdkwork/commerce-pc-core",
      "sdkClients": [
        {
          "id": "appbaseApp",
          "workspace": "sdkwork-iam-app-sdk",
          "surface": "app-api",
          "credentialMode": "authenticated-app-api",
          "nativePackage": "@sdkwork/iam-app-sdk",
          "role": "dependency",
          "sdkDependencyRef": "sdkwork-iam-app-sdk",
          "exportFrom": "@sdkwork/commerce-pc-core/sdk"
        },
        {
          "id": "productApp",
          "workspace": "sdkwork-commerce-app-sdk",
          "surface": "app-api",
          "credentialMode": "authenticated-app-api",
          "nativePackage": "sdkwork-commerce-app-sdk-generated-typescript",
          "role": "application-owned",
          "exportFrom": "@sdkwork/commerce-pc-core/sdk"
        }
      ],
      "reusableModules": [],
      "hostAdapters": [],
      "dependencyApiExports": [],
      "dependencyApiSurfaces": []
    }
  ],
  "buildToolEntries": {
    "pnpm": {
      "workspacePackages": [
        "@sdkwork/commerce-pc-core",
        "@sdkwork/iam-app-sdk",
        "sdkwork-commerce-app-sdk-generated-typescript"
      ]
    }
  }
}
```

## 4. Core Package Public Export Surface

Architecture core packages are the only supported library dependency import entry for their surface family.

TypeScript/React core packages `SHOULD` expose these public subpaths through `package.json#exports`:

| Subpath | Owns | Consumers |
| --- | --- | --- |
| `.` | runtime identity, route registry helpers, composition factory entry | bootstrap, tests |
| `./sdk` | SDK inventory types and app-side SDK getters/factories | capability services |
| `./modules` | bound reusable module registry | feature providers |
| `./host` | host adapter contracts | feature packages, host package |
| `./session` | token/context read helpers for guards and bridges | shell, AuthGate |
| `./composition` | manifest types and inventory helpers for tests/validators | bootstrap, verification only |

Rules:

- `./composition` `MUST NOT` become a feature-package import path except in bootstrap and standards verification.
- `-admin-core` `MAY` expose `./backend-sdk` for backend-admin SDK getters. App and console packages `MUST NOT` import it.
- Flutter, Android, iOS, Harmony, and Rust equivalents `MUST` preserve the same logical subpaths using language-native public export boundaries documented by the matching architecture spec.
- Core packages `MUST` contain a `composition/` directory with at least `dependency-manifest.*` that reads or mirrors `specs/dependency.composition.json` for the owning surface.

Cross-language import entry matrix:

| Architecture | Core package | Public import root | Feature package rule |
| --- | --- | --- | --- |
| PC/H5 React | `sdkwork-<app>-<arch>-core` | `package.json#exports` | import only `@sdkwork/<app>-<arch>-core/*` subpaths |
| Flutter | `sdkwork_<app>_flutter_mobile_core` | `lib/<core>.dart` | import SDK/module/host through core library only |
| Mini program | `sdkwork-<app>-mp-core` | `src/index.ts` + `exports` | same as React |
| Android | `sdkwork-<app>-android-mobile-core` | public Kotlin facade / `api` source set | no direct generated SDK imports |
| iOS | `sdkwork-<app>-ios-mobile-core` | Swift public module | no cross-architecture imports |
| Harmony | `sdkwork-<app>-harmony-mobile-core` | ohpm `Index.ets` / main | no cross-architecture imports |
| Rust backend bootstrap | `sdkwork-<app>-runtime-bootstrap` or approved core crate | `lib.rs` `pub mod composition` | service crates depend on traits from bootstrap/core only |

## 5. Frontend And Backend Dependency Chains

Applications `MUST` use one of these chains. Route paths and menu labels do not change the chain.

### 5.1 App and console chain (app-api)

```text
capability UI
  -> capability service (injected app SDK port)
  -> generated app SDK or approved appbase app wrapper
  -> HTTP app-api
  -> route crate / controller
  -> service -> repository
```

### 5.2 Backend-admin chain (backend-api)

```text
admin capability UI
  -> admin service (injected backend SDK port)
  -> generated backend SDK or approved backend wrapper
  -> HTTP backend-api
  -> route crate / controller
  -> service -> repository
```

### 5.3 Dependency-owned capabilities

```text
application root
  L1 sdkClients role=dependency + dependencyApiSurfaces
  L2 -core injects dependency SDK through global TokenManager when authenticated
  backend: prefer shared gateway composition per APP_SDK_INTEGRATION_SPEC.md §2.3
```

Forbidden chains:

| Forbidden | Reason |
| --- | --- |
| app/console UI -> backend SDK | surface misclassification |
| app/console UI -> raw HTTP business transport | bypasses generated SDK and auth transport |
| admin UI -> app SDK for IAM management | operator resources belong to backend-api |
| UI -> construct TokenManager or SDK clients | breaks runtime closure |
| application repo regenerates dependency-owned APIs | SDK ownership violation |
| feature package -> generated SDK direct import | bypasses composition entry |

## 6. Alignment With Existing Standards

Rules:

- `component.spec.json` `contracts.sdkDependencies` and app-root `dependency.composition.json` `MUST` remain consistent for each surface.
- `component.spec.json` `SHOULD` include `contracts.dependencyComposition: "specs/dependency.composition.json"`.
- Runtime bootstrap SDK inventory classification `MUST` match `sdkClients[].credentialMode`.
- Reusable modules `MUST` follow `MODULE_SPEC.md` port injection and be listed in `reusableModules[]`.
- Native workspace paths `MUST` remain centralized in L0 per `DEPENDENCY_MANAGEMENT_SPEC.md`.
- Verification `MUST` include `node tools/check-dependency-composition.mjs` for application roots and workspace audits.

Scaffold and repair with:

```bash
node tools/align-dependency-composition.mjs --workspace ..
node tools/check-dependency-composition.mjs --workspace ..
```

## 7. Verification

Required checks:

| Check | Evidence |
| --- | --- |
| Manifest presence | Client app root has `specs/dependency.composition.json` |
| Surface closure | Every present core package family has a matching `surfaces[]` entry |
| SDK closure | `sdkClients[]` matches core component `sdkDependencies` and bootstrap inventory |
| Backend boundary | backend SDK clients appear only under `backend-admin` |
| Core composition layout | `-core` has `composition/` and required public export subpaths |
| L0 bridge | `buildToolEntries` packages resolve in native workspace roots |
| Import boundary | capability packages do not import generated SDK packages directly |
| Frontend/backend chain | static scans and architecture tests prove allowed chains only |

Acceptance checklist:

- [ ] Client root declares `specs/dependency.composition.json`.
- [ ] Bootstrap derives inventory from the manifest through the core composition entry.
- [ ] Feature packages import dependencies only through core public exports.
- [ ] App/console surfaces do not expose backend SDK subpaths.
- [ ] Dependency API export and runtime surface rules remain explicit and default to no export.
- [ ] Verification commands pass before release.
