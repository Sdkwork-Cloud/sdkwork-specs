# App Composition Standard

- Version: 1.1
- Scope: client application composition using native build-tool authority, core-package import entrypoints, and component-spec runtime metadata
- Related: `APPLICATION_SPEC.md`, `APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC.md`, `APP_SDK_INTEGRATION_SPEC.md`, `APP_PERMISSION_COMPOSITION_SPEC.md`, `DEPENDENCY_MANAGEMENT_SPEC.md`, `COMPONENT_SPEC.md`, `MODULE_SPEC.md`, `TEST_SPEC.md`

This standard defines application composition without a parallel dependency manifest. Native build-tool files own dependency graphs; component and app manifests own runtime semantics.

## 1. Authority Model

| Concern | Authority |
| --- | --- |
| Source dependency paths and versions | Native build-tool roots (`pnpm-workspace.yaml`, Cargo workspace, etc.) |
| Frontend SDK inventory (per surface) | `*-core/specs/component.spec.json#contracts.sdkDependencies` |
| Permission inheritance/overrides | App-surface `specs/component.spec.json#contracts.permissionComposition` |
| Backend/release SDK inventory | `sdkwork.app.config.json#sdkDependencies` |
| Dependency API export/runtime policy | `component.spec.json#contracts.dependencyApiExports` and `dependencyApiSurfaces` |

Rules:

- Do not introduce `specs/dependency.composition.json` or equivalent parallel manifest.
- A client repository must declare sibling source paths once at the repository workspace root.
- Feature packages must import SDK access only through core package public exports.

## 2. Composition Layers

```text
Feature packages (L2)
  -> Core package public exports (L1)
  -> Native workspace dependencies + app/component manifests (L0)
```

Allowed direction:

- feature/service -> `@sdkwork/<app>-<arch>-core/*`
- bootstrap -> core runtime factory
- core sdk registry -> generated SDK clients / approved facades

Forbidden:

- feature package direct imports of generated SDK packages
- app/console surface using backend-admin SDK inventory
- member package-local sibling path declarations

## 3. Core Package Conventions

Core packages (`-core`, `-console-core`, `-admin-core`) must expose:

- `.`
- `./sdk`
- `./modules`
- `./host`
- `./session`
- `./composition`

Rules:

- `./composition` is for bootstrap and verification only, not feature imports.
- `-admin-core` may expose backend-admin SDK helpers; app/console packages must not import them.
- Core `composition/` directory must include SDK registry, module registry, and host registry implementation.

## 4. Surface Metadata Placement

Rules:

- App-surface root `specs/component.spec.json` must include `contracts.permissionComposition` when modular permissions apply.
- Core package `component.spec.json` must include `contracts.sdkDependencies` with explicit `surface` and `credentialMode`.
- Bootstrap runtime must derive SDK wiring from core composition and component manifests; no second handwritten inventory.

## 5. Cross-Repository Package Consumption

When one SDKWork repository consumes another repository's feature packages during local development, consumption must follow native workspace and public export boundaries.

Rules:

- The consuming repository `MUST` register sibling packages once in its repository-root `pnpm-workspace.yaml` through `sdkwork-specs/workspace/consumers/<repo>.json` and `sync-workspace.mjs`.
- Cross-repository imports `MUST` use workspace package names and declared `exports` entrypoints. Example: `@sdkwork/knowledgebase-pc-knowledge`, not `../../sdkwork-knowledgebase/.../src`.
- The consumed sibling package `MUST` self-declare its direct third-party npm dependencies in its own `package.json`.
- Host applications `MUST` depend on the domain facade package (for example `@sdkwork/knowledgebase-pc-knowledge`) rather than importing deep sibling implementation packages unless that implementation package is explicitly registered and exported for host composition.
- Tailwind `@source`, Vite alias, and TypeScript path mappings `MAY` point at sibling source trees only when the consuming repository can resolve the scanned package's declared npm dependencies.
- Forbidden:
  - relative imports into another repository's `src/` tree
  - using app-root dependency hoisting to compensate for missing member `dependencies`
  - duplicate sibling path declarations in member packages

## 6. Verification

Required checks:

- `verify-workspace`: one workspace file per repository root; no nested app-level workspace files
- `verify-import-boundaries`: no feature direct generated SDK imports
- `verify-import-closure`: workspace member imports match declared package dependencies
- `verify-package-exports`: required core export subpaths
- `verify-sdk-dependencies`: surface segregation and package resolvability
- `verify-permission-composition`: app-surface permission composition integrity

Workspace commands:

```bash
node sdkwork-specs/tools/verify-repo.mjs --root <repo>
node sdkwork-specs/tools/verify-repo.mjs --root <repo> --strict-import-closure
node sdkwork-specs/tools/sweep-verify-repo.mjs
node sdkwork-specs/tools/audit-app-composition.mjs
```

`verify-repo.mjs` always enforces cross-package relative import boundaries (including package-to-app-root `src/` imports). Import-closure (`verify-import-closure`) is opt-in via `--strict-import-closure` or `VERIFY_IMPORT_CLOSURE_STRICT=1` until each repository completes member `package.json` alignment.

Acceptance:

- [ ] No `dependency.composition.json` in target repository
- [ ] Core imports are the only dependency entry for feature packages
- [ ] Runtime and permission metadata are resolved from existing manifest authorities
- [ ] Cross-repository imports use workspace package names and public exports only
- [ ] Consumed sibling packages self-declare direct third-party dependencies
