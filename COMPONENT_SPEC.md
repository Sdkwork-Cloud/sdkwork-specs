# Component Specs Standard

- Version: 1.0
- Scope: local `specs/` directories for apps, reusable packages, language modules, SDK families, services, host adapters, and componentized integration units under `apps/`
- Related: `SDKWORK_WORKSPACE_SPEC.md`, `MODULE_SPEC.md`, `APPLICATION_SPEC.md`, `WEB_BACKEND_SPEC.md`, `FRONTEND_SPEC.md`, `UI_ARCHITECTURE_SPEC.md`, `APP_PC_ARCHITECTURE_SPEC.md`, `APP_PC_REACT_UI_SPEC.md`, `APP_MOBILE_REACT_UI_SPEC.md`, `APP_FLUTTER_UI_SPEC.md`, `BACKEND_UI_SPEC.md`, `SDK_SPEC.md`, `CONFIG_SPEC.md`, `DOCUMENTATION_SPEC.md`, `TEST_SPEC.md`, `GOVERNANCE_SPEC.md`

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
- `canonicalSpecs` must link to actual root spec files.
- `contracts.publicExports` lists supported integration entrypoints, not internal source paths.
- `contracts.routeManifest` is used only by Rust HTTP route crate components. It points to the
  route crate manifest entrypoint or normalized `sdks/_route-manifests/<surface>/<packageName>.route-manifest.json`
  artifact, and it is not an SDK client list.
- `contracts.sdkClients` lists generated SDK client classes or public SDK client exports only when the component owns a generated SDK family. It is not a runtime credential-injection list and `MUST NOT` be used as an IAM token-manager list, app/backend SDK injection list, or open-api API key provider list.
- Runtime SDK injection and credential wiring `MUST` follow `CONFIG_SPEC.md`, `SDK_SPEC.md`, and `IAM_LOGIN_INTEGRATION_SPEC.md`: app-api/backend-api SDKs receive the global token manager, while protected open-api SDKs receive API key credentials through a separate provider when their contract declares API key mode.
- `verification.commands` must include at least one command that validates the component or the component specs inventory.

## 4. Component Types

| Type | Description | Required root specs |
| --- | --- | --- |
| `react-app`, `react-tauri-app`, `pc-app`, `flutter-app`, `app` | Product app or app shell | `APPLICATION_SPEC.md`, `APP_MANIFEST_SPEC.md`, `FRONTEND_SPEC.md`, `UI_ARCHITECTURE_SPEC.md`, `APP_PC_ARCHITECTURE_SPEC.md` for PC roots, architecture UI spec, `CONFIG_SPEC.md`, `DEPLOYMENT_SPEC.md` |
| `react-package`, `react-tauri-package`, `flutter-package`, `dart-package`, `node-package` | Frontend or reusable UI/service package | `MODULE_SPEC.md`, `FRONTEND_SPEC.md`, `UI_ARCHITECTURE_SPEC.md`, architecture UI spec when UI is present, `SDK_SPEC.md`, `I18N_SPEC.md` when user-facing |
| `rust-route-crate` | Rust HTTP route/path source package named `sdkwork-routes-<capability>-<surface>` | `API_SPEC.md`, `SDK_WORKSPACE_GENERATION_SPEC.md`, `SDK_SPEC.md`, `DOMAIN_SPEC.md`, `SECURITY_SPEC.md`, `TEST_SPEC.md` |
| `web-backend-service` | Java/Rust HTTP backend service, controller module, handler/service/repository package, or runtime API composition unit | `WEB_BACKEND_SPEC.md`, `API_SPEC.md`, `DOMAIN_SPEC.md`, `SECURITY_SPEC.md`, `DATABASE_SPEC.md` when persistent, `SDK_SPEC.md`, `TEST_SPEC.md` |
| `rust-crate`, `tauri-host`, `go-module`, `java-module`, `python-package`, `csharp-project`, `swift-package` | Language-native runtime, service, SDK, or host unit | `MODULE_SPEC.md`, `CONFIG_SPEC.md`, `DEPLOYMENT_SPEC.md`, `TEST_SPEC.md` |
| `sdk-family` | Multi-language generated SDK family rooted by an SDK assembly manifest | `SDK_SPEC.md`, `SDK_WORKSPACE_GENERATION_SPEC.md`, `API_SPEC.md`, `TEST_SPEC.md`, `DOCUMENTATION_SPEC.md` |

Architecture UI spec selection:

| Component root pattern | Required architecture spec |
| --- | --- |
| `apps/<product>-pc/**` | `APP_PC_ARCHITECTURE_SPEC.md` |
| `apps/<product>-pc/packages/sdkwork-<product>-pc-<capability>` without `pc-console` or `pc-admin` | `APP_PC_ARCHITECTURE_SPEC.md`, `APP_PC_REACT_UI_SPEC.md` |
| `apps/<product>-pc/packages/sdkwork-<product>-pc-console-*` | `APP_PC_ARCHITECTURE_SPEC.md`, `APP_PC_REACT_UI_SPEC.md` |
| `apps/<product>-pc/packages/sdkwork-<product>-pc-admin-*` | `APP_PC_ARCHITECTURE_SPEC.md`, `BACKEND_UI_SPEC.md` |
| `packages/pc-react/**` | `APP_PC_REACT_UI_SPEC.md` |
| `packages/mobile-react/**` | `APP_MOBILE_REACT_UI_SPEC.md` |
| `packages/mobile-flutter/**` | `APP_FLUTTER_UI_SPEC.md` |
| `apps/sdkwork-backend-react-web/**` or `packages/sdkwork-react-backend-*` | `BACKEND_UI_SPEC.md` |

Rules:

- A UI component manifest `MUST` include `UI_ARCHITECTURE_SPEC.md` and the matching architecture UI spec in `canonicalSpecs`.
- PC user console component manifests `MUST` use `sdkwork-<product>-pc-console-<capability>` and must not declare internal admin ownership.
- PC internal admin component manifests `MUST` use `sdkwork-<product>-pc-admin-<capability>` and must include `BACKEND_UI_SPEC.md`.
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

## 5. Discovery Rules

Authored component roots are discovered from standard language manifests:

- JavaScript/TypeScript: `package.json`
- Flutter/Dart: `pubspec.yaml`
- Rust: `Cargo.toml`
- Go: `go.mod`
- Java: `pom.xml`
- C#: `*.csproj`
- Swift: `Package.swift`
- Python: `pyproject.toml`
- PHP: `composer.json`
- Ruby: `*.gemspec`
- SDK families: `.sdkwork-assembly.json`
- SDKWork apps: `sdkwork.app.config.json`

The standard tooling excludes archived, generated, and third-party paths such as `backup`, `external`, `vendor`, `generated`, `node_modules`, `dist`, `target`, `tmp`, `.worktrees`, and deprecated removed projects.

Repository and application workspace discovery is separate from component discovery. `SDKWORK_WORKSPACE_SPEC.md` validates `.sdkwork/` at git repository roots and application roots; this component spec validates component-local `specs/` directories below those roots.

## 6. Integration Rules

Rules:

- Consumers integrate through package root exports, generated SDK clients, documented adapters, or runtime entrypoints declared in `component.spec.json`.
- Reusable UI and service components must not require app-local globals, concrete app names, hard-coded base URLs, hard-coded tenant IDs, or manual token/API key headers.
- SDK clients must be injected through service/runtime boundaries according to `SDK_SPEC.md` and `FRONTEND_SPEC.md`.
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
- [ ] UI component manifests link to `UI_ARCHITECTURE_SPEC.md` and exactly one architecture-specific UI spec.
- [ ] Manifest uses canonical domain names.
- [ ] Public integration entrypoints are declared.
- [ ] Generated SDK language outputs are represented at the SDK family root.
- [ ] Verification commands are present and runnable from the repository root or the component root.
- [ ] Local specs do not copy or contradict root specs.
