# Component Specs Standard

- Version: 1.0
- Scope: local `specs/` directories for apps, reusable packages, language modules, SDK families, services, host adapters, and componentized integration units under `apps/`
- Related: `SDKWORK_WORKSPACE_SPEC.md`, `AGENTS_SPEC.md`, `CODE_STYLE_SPEC.md`, `NAMING_SPEC.md`, `MODULE_SPEC.md`, `APPLICATION_SPEC.md`, `WEB_BACKEND_SPEC.md`, `FRONTEND_SPEC.md`, `UI_ARCHITECTURE_SPEC.md`, `APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC.md`, `APP_PC_ARCHITECTURE_SPEC.md`, `APP_H5_ARCHITECTURE_SPEC.md`, `FLUTTER_APP_MOBILE_ARCHITECTURE_SPEC.md`, `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md`, `ANDROID_APP_MOBILE_ARCHITECTURE_SPEC.md`, `IOS_APP_MOBILE_ARCHITECTURE_SPEC.md`, `HARMONY_APP_MOBILE_ARCHITECTURE_SPEC.md`, `APP_PC_REACT_UI_SPEC.md`, `APP_MOBILE_REACT_UI_SPEC.md`, `APP_FLUTTER_UI_SPEC.md`, `APP_MINI_PROGRAM_UI_SPEC.md`, `APP_ANDROID_NATIVE_UI_SPEC.md`, `APP_IOS_NATIVE_UI_SPEC.md`, `APP_HARMONY_NATIVE_UI_SPEC.md`, `BACKEND_UI_SPEC.md`, `SDK_SPEC.md`, `CONFIG_SPEC.md`, `DOCUMENTATION_SPEC.md`, `TEST_SPEC.md`, `GOVERNANCE_SPEC.md`

This standard defines the local specification boundary for every authored SDKWork component. The root `specs/` directory remains authoritative; a component-local `specs/` directory exists to make the component discoverable, maintainable, and safe to integrate without reading its internals first.

Repository roots and application roots also carry the checked-in `.sdkwork/` workspace required by `SDKWORK_WORKSPACE_SPEC.md`. Component roots do not need their own `.sdkwork/` unless the component root is also a git repository root or an independently built/distributed application root.

## 1. Authority Chain

Rules:

- Root `specs/` files are the source of truth.
- Component-local specs may narrow, document, or add component-specific constraints.
- Component-local specs must not contradict root specs.
- If a component needs an exception, record it according to `GOVERNANCE_SPEC.md`.
- Generated language outputs should not each maintain independent standards; the SDK family root owns the component spec unless a generated output becomes a hand-maintained composed package.
- Component-local specs may reference repository/application `.sdkwork/skills` or `.sdkwork/plugins` for workflows, but they must not redefine those workspace rules.
- Component-local `AGENTS.md`, when present, must follow `AGENTS_SPEC.md` and use relative paths to root `sdkwork-specs`.

## 2. Required Local Directory

Every authored component `MUST` contain:

```text
<component-root>/
  specs/
    README.md
    component.spec.json
```

Rules:

- `README.md` is the human entrypoint.
- `component.spec.json` is the machine-readable contract used by validators.
- Local extension files such as `FRONTEND_SPEC.md`, `RUST_SPEC.md`, `DART_SPEC.md`, `I18N_SPEC.md`, or `RELEASE_SPEC.md` may be added only when the component has extra rules beyond the root specs.
- Do not copy root specs into component folders.

## 3. Component Manifest

`component.spec.json` `MUST` use:

```json
{
  "schemaVersion": 1,
  "kind": "sdkwork.component.spec",
  "component": {
    "name": "@sdkwork/example",
    "displayName": "SDKWork Example",
    "version": "0.1.0",
    "type": "react-package",
    "root": "sdkwork-appbase/packages/pc-react/iam/example",
    "domain": "iam",
    "capability": "auth",
    "surface": "app",
    "languages": ["typescript"],
    "generated": false,
    "manifests": ["package.json"]
  },
  "canonicalSpecs": [
    {
      "file": "MODULE_SPEC.md",
      "path": "../../../../specs/MODULE_SPEC.md",
      "purpose": "Reusable package contract and dependency direction."
    }
  ],
  "contracts": {
    "publicExports": ["."],
    "runtimeEntrypoints": ["package.json#scripts.typecheck"],
    "routeManifest": null,
    "sdkClients": [],
    "sdkDependencies": [],
    "dependencyApiExports": [],
    "dependencyApiSurfaces": [],
    "events": [],
    "configKeys": ["package.json#sdkwork"]
  },
  "verification": {
    "commands": ["pnpm --filter @sdkwork/example typecheck"]
  }
}
```

Rules:

- `component.name`, `component.type`, `component.root`, `component.domain`, `component.capability`, and `component.languages` are required.
- `component.domain` uses canonical root domain names such as `iam`, not legacy group aliases such as `identity`.
- `component.surface` is required when SDK surface access, route exposure, or package visibility
  depends on whether the component is app-side, console-side, backend-admin, public/open-api,
  backend service, host/native, or generated SDK infrastructure.
- `component.surface: "backend-admin"` is the machine-readable backend/admin UI boundary. PC React
  internal admin packages named with the `pc-admin` segment, such as
  `sdkwork-<product>-pc-admin-<capability>`, `MUST` declare this surface before importing product
  backend SDKs or appbase backend SDKs.
- Route paths, menu groups, page titles, and navigation labels are not component surfaces. A route
  under `/admin` is still non-admin unless its owning package/component declares the backend-admin
  surface and follows the backend UI package rules.
- `canonicalSpecs` must link to actual root spec files.
- `canonicalSpecs` must include `CODE_STYLE_SPEC.md` and `NAMING_SPEC.md` when the component owns authored source code.
- `canonicalSpecs` must include language-specific specs only for languages declared in `component.languages`.
- `contracts.publicExports` lists supported integration entrypoints, not internal source paths.
- `contracts.runtimeEntrypoints` lists executable integration entrypoints, service builders, router
  builders, scripts, or host adapters that a consumer can actually run or mount. Route metadata,
  OpenAPI files, and README examples are not executable runtime entrypoints.
- `contracts.routeManifest` is used only by Rust HTTP route crate components. It points to the
  route crate manifest entrypoint or normalized `sdks/_route-manifests/<surface>/<packageName>.route-manifest.json`
  artifact, and it is not an SDK client list.
- `contracts.sdkClients` lists generated SDK client classes or public SDK client exports only when the component owns a generated SDK family. It is not a runtime credential-injection list and `MUST NOT` be used as an IAM token-manager list, app/backend SDK injection list, or open-api API key provider list.
- `contracts.sdkDependencies` lists dependency SDK families consumed by this component, SDK family,
  or composed facade. It `MUST` be an explicit array for every authored SDK family, composed facade,
  application core package, or runtime component that consumes dependency SDKs; use `[]` when there
  are no dependency SDKs.
- `contracts.dependencyApiExports` lists dependency-owned API capabilities intentionally exposed by
  this component's public exports, composed wrappers, service ports, or application core surface.
  It `MUST` be explicit for authored SDK families and composed facades. The default is `[]`, which
  means dependency APIs are not re-exported by this component.
- `contracts.dependencyApiSurfaces` lists dependency-owned HTTP API surfaces that this runtime
  component serves, proxies, or requires as an external service. It is required for app shells,
  web-backend services, and Rust/native runtimes that declare HTTP `sdkDependencies`.
- Runtime SDK injection and credential wiring `MUST` follow `CONFIG_SPEC.md`, `SDK_SPEC.md`, and `IAM_LOGIN_INTEGRATION_SPEC.md`: app-api/backend-api SDKs receive the global token manager, while protected open-api SDKs receive API key credentials through a separate provider when their contract declares API key mode.
- `verification.commands` must include at least one command that validates the component or the component specs inventory.

## 4. Component Types

| Type | Description | Required root specs |
| --- | --- | --- |
| `react-app`, `react-tauri-app`, `pc-app`, `h5-app`, `flutter-app`, `mini-program-app`, `android-native-app`, `ios-native-app`, `harmony-native-app`, `app` | Product app or app shell | `APPLICATION_SPEC.md`, `APP_MANIFEST_SPEC.md`, `FRONTEND_SPEC.md`, `UI_ARCHITECTURE_SPEC.md`, `APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC.md` for client roots, matching root architecture spec, architecture UI spec when applicable, `CONFIG_SPEC.md`, `DEPLOYMENT_SPEC.md` |
| `react-package`, `react-tauri-package`, `flutter-package`, `dart-package`, `android-native-package`, `ios-native-package`, `harmony-native-package`, `node-package` | Frontend or reusable UI/service package | `MODULE_SPEC.md`, `FRONTEND_SPEC.md`, `UI_ARCHITECTURE_SPEC.md`, architecture UI spec when UI is present, `SDK_SPEC.md`, `I18N_SPEC.md` when user-facing |
| `rust-route-crate` | Rust HTTP route/path source package named `sdkwork-routes-<capability>-<surface>` | `API_SPEC.md`, `SDK_WORKSPACE_GENERATION_SPEC.md`, `SDK_SPEC.md`, `DOMAIN_SPEC.md`, `SECURITY_SPEC.md`, `TEST_SPEC.md` |
| `web-backend-service` | Java/Rust HTTP backend service, controller module, handler/service/repository package, or runtime API composition unit | `WEB_BACKEND_SPEC.md`, `API_SPEC.md`, `DOMAIN_SPEC.md`, `SECURITY_SPEC.md`, `DATABASE_SPEC.md` when persistent, `SDK_SPEC.md`, `TEST_SPEC.md` |
| `rust-crate`, `tauri-host`, `go-module`, `java-module`, `python-package`, `csharp-project`, `swift-package` | Language-native runtime, service, SDK, or host unit | `MODULE_SPEC.md`, `CONFIG_SPEC.md`, `DEPLOYMENT_SPEC.md`, `TEST_SPEC.md` |
| `sdk-family` | Multi-language generated SDK family rooted by an SDK assembly manifest | `SDK_SPEC.md`, `SDK_WORKSPACE_GENERATION_SPEC.md`, `API_SPEC.md`, `TEST_SPEC.md`, `DOCUMENTATION_SPEC.md` |

Language-specific root specs are on-demand:

| `component.languages` value | Required language spec when authored source exists |
| --- | --- |
| `rust` | `RUST_CODE_SPEC.md` |
| `java` | `JAVA_CODE_SPEC.md` |
| `typescript`, `javascript`, `node` | `TYPESCRIPT_CODE_SPEC.md` |
| `react`, `tsx`, `flutter`, `dart`, `arkts`, `android-ui`, `ios-ui`, `harmony-ui`, `ui` | `FRONTEND_CODE_SPEC.md` plus the matching UI architecture spec |

Rules:

- Components must not list unrelated language specs in `canonicalSpecs` just because the repository is polyglot.
- Generated language outputs inherit the SDK family root spec unless they contain an authored composed facade.
- Authored composed facades must declare their language and code style specs in the SDK family or facade component spec.

Architecture UI spec selection:

| Component root pattern | Required architecture spec |
| --- | --- |
| `apps/<product>-pc/**` | `APP_PC_ARCHITECTURE_SPEC.md` |
| `apps/<product>-pc/packages/sdkwork-<product>-pc-<capability>` without `pc-console` or `pc-admin` | `APP_PC_ARCHITECTURE_SPEC.md`, `APP_PC_REACT_UI_SPEC.md` |
| `apps/<product>-pc/packages/sdkwork-<product>-pc-console-*` | `APP_PC_ARCHITECTURE_SPEC.md`, `APP_PC_REACT_UI_SPEC.md` |
| `apps/<product>-pc/packages/sdkwork-<product>-pc-admin-*` | `APP_PC_ARCHITECTURE_SPEC.md`, `BACKEND_UI_SPEC.md` |
| `packages/pc-react/**` | `APP_PC_REACT_UI_SPEC.md` |
| `apps/<product>-h5/**` | `APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC.md`, `APP_H5_ARCHITECTURE_SPEC.md` |
| `apps/<product>-h5/packages/sdkwork-<product>-h5-*` | `APP_H5_ARCHITECTURE_SPEC.md`, `APP_MOBILE_REACT_UI_SPEC.md` |
| `apps/<product>-flutter-mobile/**` | `APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC.md`, `FLUTTER_APP_MOBILE_ARCHITECTURE_SPEC.md` |
| `apps/<product>-flutter-mobile/packages/sdkwork_<product>_flutter_mobile_*` | `FLUTTER_APP_MOBILE_ARCHITECTURE_SPEC.md`, `APP_FLUTTER_UI_SPEC.md` |
| `apps/<product>-mini-program/**` | `APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC.md`, `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md` |
| `apps/<product>-mini-program/packages/sdkwork-<product>-mp-*` | `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md`, `APP_MINI_PROGRAM_UI_SPEC.md` |
| `apps/<product>-android-mobile/**` | `APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC.md`, `ANDROID_APP_MOBILE_ARCHITECTURE_SPEC.md` |
| `apps/<product>-android-mobile/packages/sdkwork-<product>-android-mobile-*` | `ANDROID_APP_MOBILE_ARCHITECTURE_SPEC.md`, `APP_ANDROID_NATIVE_UI_SPEC.md` |
| `apps/<product>-ios-mobile/**` | `APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC.md`, `IOS_APP_MOBILE_ARCHITECTURE_SPEC.md` |
| `apps/<product>-ios-mobile/packages/sdkwork-<product>-ios-mobile-*` | `IOS_APP_MOBILE_ARCHITECTURE_SPEC.md`, `APP_IOS_NATIVE_UI_SPEC.md` |
| `apps/<product>-harmony-mobile/**` | `APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC.md`, `HARMONY_APP_MOBILE_ARCHITECTURE_SPEC.md` |
| `apps/<product>-harmony-mobile/packages/sdkwork-<product>-harmony-mobile-*` | `HARMONY_APP_MOBILE_ARCHITECTURE_SPEC.md`, `APP_HARMONY_NATIVE_UI_SPEC.md` |
| `packages/mobile-react/**` | `APP_MOBILE_REACT_UI_SPEC.md` |
| `packages/mobile-flutter/**` | `APP_FLUTTER_UI_SPEC.md` |
| `packages/mini-program/**` | `APP_MINI_PROGRAM_UI_SPEC.md` |
| `packages/android-native/**` | `APP_ANDROID_NATIVE_UI_SPEC.md` |
| `packages/ios-native/**` | `APP_IOS_NATIVE_UI_SPEC.md` |
| `packages/harmony-native/**` | `APP_HARMONY_NATIVE_UI_SPEC.md` |
| `apps/sdkwork-backend-react-web/**` or `packages/sdkwork-react-backend-*` | `BACKEND_UI_SPEC.md` |

Rules:

- A UI component manifest `MUST` include `UI_ARCHITECTURE_SPEC.md` and the matching architecture UI spec in `canonicalSpecs`.
- PC user console component manifests `MUST` use `sdkwork-<product>-pc-console-<capability>` and must not declare internal admin ownership.
- PC internal admin component manifests `MUST` use `sdkwork-<product>-pc-admin-<capability>` and must include `BACKEND_UI_SPEC.md`.
- H5 component manifests under app roots `MUST` use `sdkwork-<product>-h5-<capability>` or the reserved H5 mobile package roles from `APP_H5_ARCHITECTURE_SPEC.md`.
- Flutter mobile component manifests under app roots `MUST` use lower snake case Dart package names such as `sdkwork_<product>_flutter_mobile_<capability>`.
- Mini program component manifests under app roots `MUST` use SDKWork source packages such as `sdkwork-<product>-mp-<capability>` and include `APP_MINI_PROGRAM_UI_SPEC.md` when they own pages, components, services, state, or route projection inputs. They must not treat platform `pages` or `subpackages` as the source component boundary.
- Android native component manifests under app roots `MUST` use SDKWork source packages such as `sdkwork-<product>-android-mobile-<capability>` and include `APP_ANDROID_NATIVE_UI_SPEC.md` when they own screens, components, view models/controllers, services, state, or route inputs.
- iOS native component manifests under app roots `MUST` use SDKWork source packages such as `sdkwork-<product>-ios-mobile-<capability>` and include `APP_IOS_NATIVE_UI_SPEC.md` when they own screens, views, view models/controllers, services, state, or route inputs.
- Harmony native component manifests under app roots `MUST` use SDKWork source packages such as `sdkwork-<product>-harmony-mobile-<capability>` and include `APP_HARMONY_NATIVE_UI_SPEC.md` when they own pages, components, view models/controllers, services, state, or route inputs.
- Standalone backend/admin UI component manifests `MUST` use a backend domain package root, not a generic all-in-one backend package root.
- App UI component manifests `MUST` reference app-side package roots and must not declare backend SDK clients for user-facing workflows.
- A UI component manifest `MUST NOT` list more than one architecture-specific UI spec unless it is an explicit multi-package SDK family root with no UI implementation.
- A `rust-route-crate` component `MUST` use a component name and Cargo package name that follow
  `sdkwork-routes-<capability>-open-api`, `sdkwork-routes-<capability>-app-api`, or
  `sdkwork-routes-<capability>-backend-api`.
- A `rust-route-crate` component root `SHOULD` follow
  `packages/native-rust/routes/<surface>/sdkwork-routes-<capability>-<surface>/`.
- A `rust-route-crate` component `MUST` declare `contracts.routeManifest` and must not declare
  generated SDK clients in `contracts.sdkClients`.
- A `rust-route-crate` component manifest `MUST` include `API_SPEC.md`,
  `SDK_WORKSPACE_GENERATION_SPEC.md`, and `TEST_SPEC.md` in `canonicalSpecs`.
- A `web-backend-service` component `MUST` include `WEB_BACKEND_SPEC.md`, `API_SPEC.md`, and
  `TEST_SPEC.md` in `canonicalSpecs`.
- A `web-backend-service` component that owns persistence `MUST` also include
  `DATABASE_SPEC.md`; one that publishes events `MUST` include `EVENT_SPEC.md`; one that uses cache
  `MUST` include `CACHE_SPEC.md`.
- A `web-backend-service` component `MUST` document its API authority, owned surface, and generated
  SDK family or explicitly state that it is an implementation-only module with no HTTP authority.
- A `web-backend-service`, `rust-crate`, `tauri-host`, or app shell that mounts dependency APIs
  `MUST` declare `contracts.dependencyApiSurfaces` with dependency workspace, SDK family, API
  authority, surface, `apiPrefix`, runtime mode, executable public export, and coverage evidence.
  A dependency route manifest alone does not satisfy this runtime contract.

## 5. Discovery Rules

Authored component roots are discovered from standard language manifests:

- JavaScript/TypeScript: `package.json`
- Flutter/Dart: `pubspec.yaml`
- Android/Gradle: `build.gradle.kts`, `build.gradle`, or `settings.gradle.kts`
- Rust: `Cargo.toml`
- Go: `go.mod`
- Java: `pom.xml`
- C#: `*.csproj`
- Swift: `Package.swift`
- HarmonyOS/ohpm: `oh-package.json5` or `hvigorfile.ts`
- Python: `pyproject.toml`
- PHP: `composer.json`
- Ruby: `*.gemspec`
- SDK families: `.sdkwork-assembly.json`
- SDKWork apps: `sdkwork.app.config.json`

The standard tooling excludes archived, generated, and third-party paths such as `backup`, `external`, `vendor`, `generated`, `node_modules`, `dist`, `target`, `tmp`, `.worktrees`, and deprecated removed projects.

Repository and application workspace discovery is separate from component discovery. `SDKWORK_WORKSPACE_SPEC.md` validates `.sdkwork/` at git repository roots and application roots; this component spec validates component-local `specs/` directories below those roots.

## 6. Integration Rules

Rules:

- Component implementation follows `CODE_STYLE_SPEC.md` and public naming follows `NAMING_SPEC.md`.
- Component roots should split source by responsibility. A single file containing public exports, business logic, persistence, provider adapters, and tests is not an acceptable component boundary.
- Rust components must keep `src/lib.rs` as a module assembly and re-export boundary according to `RUST_CODE_SPEC.md`.
- Consumers integrate through package root exports, generated SDK clients, documented adapters, or runtime entrypoints declared in `component.spec.json`.
- Reusable UI and service components must not require app-local globals, concrete app names, hard-coded base URLs, hard-coded tenant IDs, or manual token/API key headers.
- SDK clients must be injected through service/runtime boundaries according to `SDK_SPEC.md` and `FRONTEND_SPEC.md`.
- Component-level dependency API exports `MUST` follow `SDK_SPEC.md`: dependency APIs are not
  exported by default, `contracts.dependencyApiExports: []` is the no-export state, and any
  `composed-wrapper` or `service-port` export must point to authored public code outside generated
  SDK transport.
- Runtime components that expose Rust HTTP integration `SHOULD` provide stable surface-specific
  public modules or files such as `sdkwork_<component>_open_api`,
  `sdkwork_<component>_app_api`, and `sdkwork_<component>_backend_api`. Each mounted surface
  `SHOULD` expose a public router/controller/service builder such as
  `build_sdkwork_<component>_<surface>_router` or a documented service builder with equivalent
  semantics.
- A consuming application integrates a dependency component by importing the declared public
  surface entrypoint, dependency SDK family, or composed facade. It `MUST NOT` deep-import private
  source files, copy dependency handlers, copy dependency OpenAPI, or infer executable coverage from
  route metadata.
- If a component exposes only route contracts or manifests and no executable router/controller or
  service builder, consumers `MUST` treat its HTTP SDK as an external dependency surface for runtime
  base URL configuration.
- App-specific visual identity may be passed as configuration or design tokens, not embedded as a dependency from shared component packages to product apps.
- Component specs should make extension points explicit when the component is intended for reuse by multiple applications.

## 7. Verification

Rules:

- Run `node apps/scripts/validate-component-specs.mjs --apps-root apps` before declaring component specs complete.
- Standard changes require tests for the discovery and validation tooling.
- Component-local README examples and verification commands should stay aligned with the package manifest and generated SDK surface.

## 8. Acceptance Checklist

- [ ] Component has `specs/README.md`.
- [ ] Component has `specs/component.spec.json`.
- [ ] If the component root is also a git repository root or application root, it has `.sdkwork/skills/` and `.sdkwork/plugins/` according to `SDKWORK_WORKSPACE_SPEC.md`.
- [ ] Manifest links to root canonical specs.
- [ ] Manifest includes `CODE_STYLE_SPEC.md`, `NAMING_SPEC.md`, and only the language-specific specs required by `component.languages`.
- [ ] UI component manifests link to `UI_ARCHITECTURE_SPEC.md` and exactly one architecture-specific UI spec.
- [ ] Manifest uses canonical domain names.
- [ ] Public integration entrypoints are declared.
- [ ] Dependency SDK consumption is declared through `contracts.sdkDependencies`, including `[]`
  when there are no dependency SDKs.
- [ ] Dependency API export policy is declared through `contracts.dependencyApiExports`, including
  `[]` when the component does not re-export dependency capabilities.
- [ ] Runtime dependency API mounting or external-service requirements are declared through
  `contracts.dependencyApiSurfaces` when the component serves, proxies, or depends on dependency
  HTTP APIs.
- [ ] Rust/runtime components expose executable surface-specific integration entrypoints when they
  claim same-origin dependency API coverage.
- [ ] Generated SDK language outputs are represented at the SDK family root.
- [ ] Verification commands are present and runnable from the repository root or the component root.
- [ ] Authored source is split by responsibility and does not hide component behavior in a catch-all entrypoint file.
- [ ] Local specs do not copy or contradict root specs.
