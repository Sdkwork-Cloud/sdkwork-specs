# Naming Standard

- Version: 1.0
- Scope: domains, capabilities, repositories, applications, components, packages, SDK families, API authorities, route crates, database identifiers, files, and test names
- Related: `DOMAIN_SPEC.md`, `APPLICATION_SPEC.md`, `APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC.md`, `APP_PC_ARCHITECTURE_SPEC.md`, `APP_H5_ARCHITECTURE_SPEC.md`, `FLUTTER_APP_MOBILE_ARCHITECTURE_SPEC.md`, `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md`, `ANDROID_APP_MOBILE_ARCHITECTURE_SPEC.md`, `IOS_APP_MOBILE_ARCHITECTURE_SPEC.md`, `HARMONY_APP_MOBILE_ARCHITECTURE_SPEC.md`, `APP_MINI_PROGRAM_UI_SPEC.md`, `APP_ANDROID_NATIVE_UI_SPEC.md`, `APP_IOS_NATIVE_UI_SPEC.md`, `APP_HARMONY_NATIVE_UI_SPEC.md`, `APP_MANIFEST_SPEC.md`, `GITHUB_WORKFLOW_SPEC.md`, `DEPLOYMENT_SPEC.md`, `CONFIG_SPEC.md`, `PNPM_SCRIPT_SPEC.md`, `COMPONENT_SPEC.md`, `MODULE_SPEC.md`, `API_SPEC.md`, `SDK_SPEC.md`, `SDK_WORKSPACE_GENERATION_SPEC.md`, `DATABASE_SPEC.md`, `CODE_STYLE_SPEC.md`

This standard is the naming entrypoint for SDKWork. It indexes naming rules that are also governed by more specific specs. If this file conflicts with a more specific root spec, the more specific spec wins and this file must be updated.

## 1. General Rules

Rules:

- Names must describe ownership, domain, capability, and surface when those concepts matter.
- Use canonical domains from `DOMAIN_SPEC.md`.
- Do not invent aliases such as `identity` when the canonical domain is `iam`.
- New names use lowercase kebab-case for package and directory identifiers unless the language requires another convention.
- Public names must be stable enough for generated SDKs, package imports, tests, docs, and agent lookup.

## 2. Canonical Patterns

| Concept | Pattern | Example |
| --- | --- | --- |
| Product repository | `sdkwork-<product>` | `sdkwork-drive` |
| PC app package | `sdkwork-<product>-pc-<capability>` | `sdkwork-commerce-pc-product` |
| PC user console package | `sdkwork-<product>-pc-console-<capability>` | `sdkwork-commerce-pc-console-order` |
| PC internal admin package | `sdkwork-<product>-pc-admin-<capability>` | `sdkwork-commerce-pc-admin-audit` |
| H5 mobile app package | `sdkwork-<product>-h5-<capability>` | `sdkwork-commerce-h5-order` |
| H5 mobile user console package | `sdkwork-<product>-h5-console-<capability>` | `sdkwork-commerce-h5-console-order` |
| H5 mobile internal admin package | `sdkwork-<product>-h5-admin-<capability>` | `sdkwork-commerce-h5-admin-audit` |
| H5 mobile Capacitor host package | `sdkwork-<product>-h5-capacitor` | `sdkwork-commerce-h5-capacitor` |
| Flutter mobile Dart package | `sdkwork_<product>_flutter_mobile_<capability>` | `sdkwork_commerce_flutter_mobile_order` |
| Flutter mobile user console Dart package | `sdkwork_<product>_flutter_mobile_console_<capability>` | `sdkwork_commerce_flutter_mobile_console_order` |
| Flutter mobile internal admin Dart package | `sdkwork_<product>_flutter_mobile_admin_<capability>` | `sdkwork_commerce_flutter_mobile_admin_audit` |
| Mini program source package | `sdkwork-<product>-mp-<capability>` | `sdkwork-commerce-mp-order` |
| Mini program user console package | `sdkwork-<product>-mp-console-<capability>` | `sdkwork-commerce-mp-console-order` |
| Mini program internal admin package | `sdkwork-<product>-mp-admin-<capability>` | `sdkwork-commerce-mp-admin-audit` |
| Mini program host package | `sdkwork-<product>-mp-host` | `sdkwork-commerce-mp-host` |
| Shared mini program package | `sdkwork-<capability>-mini-program` | `sdkwork-order-mini-program` |
| Android native app package | `sdkwork-<product>-android-mobile-<capability>` | `sdkwork-commerce-android-mobile-order` |
| Android native user console package | `sdkwork-<product>-android-mobile-console-<capability>` | `sdkwork-commerce-android-mobile-console-order` |
| Android native internal admin package | `sdkwork-<product>-android-mobile-admin-<capability>` | `sdkwork-commerce-android-mobile-admin-audit` |
| Android native host package | `sdkwork-<product>-android-mobile-host` | `sdkwork-commerce-android-mobile-host` |
| Shared Android native package | `sdkwork-<capability>-android-native` | `sdkwork-order-android-native` |
| iOS native app package | `sdkwork-<product>-ios-mobile-<capability>` | `sdkwork-commerce-ios-mobile-order` |
| iOS native user console package | `sdkwork-<product>-ios-mobile-console-<capability>` | `sdkwork-commerce-ios-mobile-console-order` |
| iOS native internal admin package | `sdkwork-<product>-ios-mobile-admin-<capability>` | `sdkwork-commerce-ios-mobile-admin-audit` |
| iOS native host package | `sdkwork-<product>-ios-mobile-host` | `sdkwork-commerce-ios-mobile-host` |
| Shared iOS native package | `sdkwork-<capability>-ios-native` | `sdkwork-order-ios-native` |
| Harmony native app package | `sdkwork-<product>-harmony-mobile-<capability>` | `sdkwork-commerce-harmony-mobile-order` |
| Harmony native user console package | `sdkwork-<product>-harmony-mobile-console-<capability>` | `sdkwork-commerce-harmony-mobile-console-order` |
| Harmony native internal admin package | `sdkwork-<product>-harmony-mobile-admin-<capability>` | `sdkwork-commerce-harmony-mobile-admin-audit` |
| Harmony native host package | `sdkwork-<product>-harmony-mobile-host` | `sdkwork-commerce-harmony-mobile-host` |
| Shared Harmony native package | `sdkwork-<capability>-harmony-native` | `sdkwork-order-harmony-native` |
| Backend/admin React package | `@sdkwork/react-backend-<domain>` | `@sdkwork/react-backend-commerce` |
| Route crate package | `sdkwork-router-<capability>-<surface>` | `sdkwork-router-product-app-api` |
| Web framework crate | `sdkwork-web-<capability>` | `sdkwork-web-context`, `sdkwork-web-axum`, `sdkwork-web-bootstrap` |
| Rust service crate | `sdkwork-<domain>-<capability>-service` | `sdkwork-drive-node-service` |
| Rust SQLx repository crate | `sdkwork-<domain>-<capability>-repository-sqlx` | `sdkwork-drive-node-repository-sqlx` |
| Rust API server crate | `sdkwork-<app>-api-server` | `sdkwork-drive-api-server` |
| Rust service host crate | `sdkwork-<app>-service-host` | `sdkwork-drive-service-host` |
| Rust native host crate | `sdkwork-<app>-native-host` or `sdkwork-<app>-tauri-host` | `sdkwork-drive-native-host` |
| Rust worker crate | `sdkwork-<domain>-<capability>-worker` | `sdkwork-drive-maintenance-worker` |
| Rust gateway crate | `sdkwork-<app>-gateway` | `sdkwork-drive-gateway` |
| Open API authority | `sdkwork-<domain>-open-api` | `sdkwork-im-open-api` |
| App API authority | `sdkwork-<domain>-app-api` | `sdkwork-commerce-app-api` |
| Backend API authority | `sdkwork-<domain>-backend-api` | `sdkwork-commerce-backend-api` |
| Public SDK family | `sdkwork-<sdk-family-stem>-sdk` | `sdkwork-im-sdk` |
| App SDK family | `sdkwork-<sdk-family-stem>-app-sdk` | `sdkwork-im-app-sdk` |
| Backend SDK family | `sdkwork-<sdk-family-stem>-backend-sdk` | `sdkwork-im-backend-sdk` |
| RPC SDK family | `sdkwork-<sdk-family-stem>-rpc-sdk` | `sdkwork-im-rpc-sdk` |
| Component spec | `specs/component.spec.json` | `packages/foo/specs/component.spec.json` |
| App manifest | `sdkwork.app.config.json` | `apps/foo/sdkwork.app.config.json` |
| GitHub package id | `<platform>-<architecture>-<deployment-profile>-<profile>-<format-token>`; Linux native packages use `linux-<distribution>-<architecture>-<deployment-profile>-<profile>-<format-token>`; variant packages insert `<variant>` before `<format-token>` | `windows-x64-standalone-desktop-msi`, `linux-debian-x64-standalone-server-deb`, `container-x64-cloud-container-nvidia-cuda-tar-gz` |
| GitHub artifact name | `<artifact-prefix>-<package-id>` | `sdkwork-drive-android-arm64-standalone-mobile-aab` |
| Agent entrypoint | `AGENTS.md` | `AGENTS.md` |
| Tool compatibility shim | `<TOOL>.md` | `CLAUDE.md`, `GEMINI.md`, `CODEX.md` |

`package.json#scripts` public command names follow `PNPM_SCRIPT_SPEC.md`. Repository root scripts use action-first standard names such as `dev`, `build`, `verify`, `release:package`, `api:materialize:check`, `sdk:generate`, and `gateway:package:cloud`. Product-prefixed root script names such as `drive:dev`, `im:dev`, and `clawrouter:dev` are forbidden public command names.

## 3. Language Naming

Rules:

- Rust packages use kebab-case and Rust modules/imports use snake_case. Rust crate names must use
  the responsibility-specific families from `RUST_CODE_SPEC.md`, such as `service`,
  `repository-sqlx`, `api-server`, `service-host`, `native-host`, `worker`, or `gateway`.
- Java packages use lowercase dotted names under an approved SDKWork root; Java classes use PascalCase.
- TypeScript packages use kebab-case or approved scoped names; exported types/classes/components use PascalCase; functions and variables use camelCase.
- Dart and Flutter package names use lowercase snake_case; SDKWork Flutter mobile packages use the `sdkwork_<product>_flutter_mobile_<capability>` family from `FLUTTER_APP_MOBILE_ARCHITECTURE_SPEC.md`.
- Android native SDKWork package directories use kebab-case `sdkwork-<product>-android-mobile-*`; Kotlin packages and Android namespaces use legal lowercase dotted names that preserve the SDKWork package identity.
- iOS native SDKWork package directories use kebab-case `sdkwork-<product>-ios-mobile-*`; Swift package targets/modules use legal PascalCase names derived from the SDKWork package identity.
- Harmony native SDKWork package directories use kebab-case `sdkwork-<product>-harmony-mobile-*`; ohpm package ids or ArkTS aliases must preserve the SDKWork package identity.
- React hooks start with `use`.
- Database tables and columns use lowercase snake_case according to `DATABASE_SPEC.md`.

## 4. API And SDK Naming

Rules:

- Operation names and resource method trees follow `API_SPEC.md` and `SDK_SPEC.md`.
- SDK family names and API authority names must not be conflated.
- Route crates are source inputs, not SDK families and not OpenAPI authority directories.
- Generated package names must trace to the SDK family, not directly to the API authority.
- `<sdk-family-stem>` is the stable SDK family stem used by the product or capability line. It often
  matches the public integration name, such as `im`, even when the canonical domain used by proto
  packages is broader, such as `communication`.
- Public, app, backend, and RPC SDK families for the same capability line MUST share the same
  `<sdk-family-stem>` unless a migration or governance exception records the split.
- RPC proto package names continue to use canonical `sdkwork.<domain>.*` package names. The SDK
  family stem is linked to that domain through `.sdkwork-assembly.json`, `sdk-manifest.json` when
  present, and `specs/component.spec.json`.

## 4.1 Package Artifact Naming

Rules:

- GitHub workflow package ids use `<platform>-<architecture>-<deployment-profile>-<profile>-<format-token>`.
- Linux native `deb` and `rpm` package ids use `linux-<distribution>-<architecture>-<deployment-profile>-<profile>-<format-token>` because distribution families have different package metadata, dependencies, signing, repositories, and install validation.
- Package ids with a real variant use `<platform>-<architecture>-<deployment-profile>-<profile>-<variant>-<format-token>`. Linux native variant packages use `linux-<distribution>-<architecture>-<deployment-profile>-<profile>-<variant>-<format-token>`.
- Use the variant segment only when distinct releasable artifacts share the same platform, architecture, deployment profile, profile, and format. Examples include `cpu`, `nvidia-cuda`, and `amd-rocm` deployment bundles.
- GitHub workflow artifact names use `<artifact-prefix>-<package-id>`.
- `artifact-prefix` comes from `release.artifactPrefix` and normally matches `app.id` unless an application has a documented release-branding reason.
- `format-token` is the lowercase kebab token for the package format. Dots and other separators are normalized to hyphens, for example `tar.gz` becomes `tar-gz`.
- Valid Linux native package distributions are `debian` and `ubuntu` for `deb`, and `rhel`, `centos`, `fedora`, `opensuse`, and `suse` for `rpm`.
- Generic Linux archive formats such as `tar.gz`, `appimage`, `snap`, and `flatpak` do not include the distribution segment unless a more specific future standard defines one.
- Package ids and artifact names `MUST` use lowercase kebab tokens only. Do not use `service` as a package profile alias for `server`, and do not omit the format token.
- Variant values `MUST` use lowercase kebab tokens and must not be encoded into `architecture`, `profile`, or `format`.
- When an SDKWork application supports more than one surface, the `profile` segment distinguishes server, desktop, browser, mobile, tablet, mini-program, worker, and library packages.
- The `deployment-profile` segment is always `standalone` or `cloud`. Runtime
  targets such as `server`, `container`, `desktop`, `browser`, mobile,
  mini-program, or Docker-compatible container images must not replace that
  segment.

Examples:

| Surface | Package id | Artifact name with `artifact-prefix: sdkwork-drive` |
| --- | --- | --- |
| Server Debian `.deb` | `linux-debian-x64-standalone-server-deb` | `sdkwork-drive-linux-debian-x64-standalone-server-deb` |
| Server Ubuntu `.deb` | `linux-ubuntu-arm64-standalone-server-deb` | `sdkwork-drive-linux-ubuntu-arm64-standalone-server-deb` |
| Server RHEL `.rpm` | `linux-rhel-x64-standalone-server-rpm` | `sdkwork-drive-linux-rhel-x64-standalone-server-rpm` |
| Desktop Fedora `.rpm` | `linux-fedora-x64-standalone-desktop-rpm` | `sdkwork-drive-linux-fedora-x64-standalone-desktop-rpm` |
| Server Linux archive | `linux-x64-standalone-server-tar-gz` | `sdkwork-drive-linux-x64-standalone-server-tar-gz` |
| Standalone container image | `container-arm64-standalone-container-oci` | `sdkwork-drive-container-arm64-standalone-container-oci` |
| Cloud CPU container bundle | `container-x64-cloud-container-cpu-tar-gz` | `sdkwork-drive-container-x64-cloud-container-cpu-tar-gz` |
| Cloud NVIDIA CUDA container bundle | `container-x64-cloud-container-nvidia-cuda-tar-gz` | `sdkwork-drive-container-x64-cloud-container-nvidia-cuda-tar-gz` |
| Cloud AMD ROCm container bundle | `container-x64-cloud-container-amd-rocm-tar-gz` | `sdkwork-drive-container-x64-cloud-container-amd-rocm-tar-gz` |
| PC desktop Windows installer | `windows-x64-standalone-desktop-msi` | `sdkwork-drive-windows-x64-standalone-desktop-msi` |
| PC desktop Windows bootstrapper | `windows-x64-standalone-desktop-exe` | `sdkwork-drive-windows-x64-standalone-desktop-exe` |
| PC desktop macOS bundle | `macos-arm64-standalone-desktop-dmg` | `sdkwork-drive-macos-arm64-standalone-desktop-dmg` |
| Browser web URL package | `web-universal-cloud-browser-web-url` | `sdkwork-drive-web-universal-cloud-browser-web-url` |
| H5 mobile URL package | `h5-universal-cloud-mobile-web-url` | `sdkwork-drive-h5-universal-cloud-mobile-web-url` |
| WeChat H5 mobile URL package | `h5-weixin-universal-cloud-mobile-web-url` | `sdkwork-drive-h5-weixin-universal-cloud-mobile-web-url` |
| Phone Android app bundle | `android-arm64-standalone-mobile-aab` | `sdkwork-drive-android-arm64-standalone-mobile-aab` |
| Phone iOS app archive | `ios-universal-standalone-mobile-ipa` | `sdkwork-drive-ios-universal-standalone-mobile-ipa` |
| Phone Harmony app package | `harmony-arm64-standalone-mobile-other` | `sdkwork-drive-harmony-arm64-standalone-mobile-other` |
| Tablet iPadOS app archive | `ipados-universal-standalone-tablet-ipa` | `sdkwork-drive-ipados-universal-standalone-tablet-ipa` |
| Tablet Windows package | `windows-tablet-x64-standalone-tablet-msix` | `sdkwork-drive-windows-tablet-x64-standalone-tablet-msix` |
| WeChat mini program package | `mp-weixin-universal-cloud-mini-program-mini-program-package` | `sdkwork-drive-mp-weixin-universal-cloud-mini-program-mini-program-package` |

## 4.2 Client Architecture Package Naming

Rules:

- Client application root packages `MUST` include the architecture segment required by `APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC.md` and the matching root architecture standard.
- PC packages use kebab-case names under `sdkwork-<product>-pc-*`, with `pc-console` reserved for user-facing console surfaces and `pc-admin` reserved for `backend-admin` company-internal admin surfaces.
- Packages without `console` or `admin` are the default app/user-facing package family for the selected architecture.
- Console packages insert the `console` role after the architecture segment and before the concrete capability. They are user-facing management console packages for customers, tenants, app owners, or product users managing their own resources, and they remain app-api/app SDK consumers unless a more specific approved contract says otherwise.
- Admin packages insert the `admin` role after the architecture segment and before the concrete capability. They map to `backend-admin` company-internal admin surfaces for staff, operators, support, auditors, platform administrators, or trusted backend services acting for those workflows.
- `backend-admin` is the canonical surface term for admin-only backend UI, backend SDK, and backend API consumption. `*-admin-*` client packages and standalone backend/admin packages map to `backend-admin`; `*-console-*`, default app packages, app auth runtime packages, and shared frontend core packages do not.
- H5/Capacitor packages use kebab-case names under `sdkwork-<product>-h5-*`; user console packages use `sdkwork-<product>-h5-console-*`; internal admin packages use `sdkwork-<product>-h5-admin-*`; the Capacitor host package is exactly `sdkwork-<product>-h5-capacitor`.
- Flutter mobile packages use Dart lower snake case names under `sdkwork_<product>_flutter_mobile_*`; user console packages use `sdkwork_<product>_flutter_mobile_console_*`; internal admin packages use `sdkwork_<product>_flutter_mobile_admin_*`; do not publish Flutter app-root packages with hyphenated Dart package names.
- Mini program source packages use kebab-case names under `sdkwork-<product>-mp-*`; user console packages use `sdkwork-<product>-mp-console-*`; internal admin packages use `sdkwork-<product>-mp-admin-*`; shared mini program packages use `sdkwork-<capability>-mini-program`; platform subpackages, pages, and platform config files must not replace SDKWork source package naming.
- Android native packages use kebab-case names under `sdkwork-<product>-android-mobile-*`; user console packages use `sdkwork-<product>-android-mobile-console-*`; internal admin packages use `sdkwork-<product>-android-mobile-admin-*`; shared Android native packages use `sdkwork-<capability>-android-native`.
- iOS native packages use kebab-case names under `sdkwork-<product>-ios-mobile-*`; user console packages use `sdkwork-<product>-ios-mobile-console-*`; internal admin packages use `sdkwork-<product>-ios-mobile-admin-*`; shared iOS native packages use `sdkwork-<capability>-ios-native`.
- Harmony native packages use kebab-case names under `sdkwork-<product>-harmony-mobile-*`; user console packages use `sdkwork-<product>-harmony-mobile-console-*`; internal admin packages use `sdkwork-<product>-harmony-mobile-admin-*`; shared Harmony native packages use `sdkwork-<capability>-harmony-native`.
- Optional `core`, `commons`, `shell`, `console-core`, `console-shell`, `admin-core`, `admin-shell`, and `host` suffixes are reserved role names inside each client root package family.
- The `<capability>` token is the concrete business module token. It `MUST` use canonical domain/capability vocabulary and `MUST NOT` be a catch-all such as `common`, `misc`, `manager`, `backend`, `console`, or `admin`.

## 4.3 Rust Crate Responsibility Naming

Rust crate names must describe engineering responsibility, not a vague application tier.

Rules:

- `sdkwork-<domain>-<capability>-service` owns business rules, use cases, domain models, commands,
  results, and service ports.
- `sdkwork-<domain>-<capability>-repository-sqlx` owns SQLx database access for a service-defined
  repository port.
- `sdkwork-router-<capability>-<surface>` owns HTTP route adaptation for one capability and one
  surface. `<surface>` is normally `open-api`, `app-api`, or `backend-api`.
- `sdkwork-web-<capability>` owns HTTP framework integration code only and lives in the
  `sdkwork-web-framework` repository. Business repositories must not create local `sdkwork-web-*`
  crates.
- `sdkwork-<app>-api-server` owns an HTTP server process that mounts route crates and listens on
  HTTP.
- `sdkwork-<app>-service-host` owns an in-process service container and must not mount HTTP routes.
- `sdkwork-<app>-native-host` and `sdkwork-<app>-tauri-host` own native/Tauri command and platform
  adapter boundaries.
- `sdkwork-<domain>-<capability>-worker` owns background jobs, schedulers, queues, maintenance
  loops, retries, locks, and cursors.
- `sdkwork-<app>-gateway` owns upstream routing, route precedence, proxy behavior, and dependency
  API surface aggregation.
- The following Rust crate names are forbidden and are not compatibility exceptions:
  `sdkwork-<app>-product`, `sdkwork-<app>-runtime`,
  `sdkwork-<domain>-<capability>-runtime`, `sdkwork-<app>-backend`,
  `sdkwork-<app>-core`, `sdkwork-<app>-common`, `sdkwork-<app>-manager`, and
  `sdkwork-<app>-server-runtime`.
- A business capability may be named `product` when the domain actually owns product/catalog
  behavior, for example `sdkwork-commerce-product-service`. The forbidden form is using `product`
  as the application entrypoint or runtime suffix, such as `sdkwork-drive-product`.
- Repositories must not preserve forbidden Rust crate names through wrapper crates, package aliases,
  feature aliases, or public re-export aliases.

## 5. Component Naming

Rules:

- `component.name` in `component.spec.json` must match the package/crate/module identity when one exists.
- `component.domain` must use a canonical domain.
- `component.capability` should be a small business or technical capability, not a catch-all such as `common`, `misc`, or `core` unless the owning spec approves it.
- Components that cross domains must document the composition reason and preserve domain-owned service boundaries.

## 6. Collision And Migration Rules

Rules:

- If two names differ only by legacy aliases, case, pluralization, or omitted surface, choose the canonical name and document migration.
- Compatibility wrappers may preserve old imports during migration, but new public contracts use canonical names.
- Breaking renames require `GOVERNANCE_SPEC.md` approval and migration notes.
- Renaming a forbidden Rust crate to its responsibility-specific name may need a migration/release
  plan, but the final compliant state must remove the forbidden crate name and all public aliases.

## 7. Acceptance Checklist

- [ ] Domain and capability names are canonical.
- [ ] Package, route crate, SDK family, and API authority names follow the required patterns.
- [ ] Rust crate names use responsibility-specific families and do not use forbidden generic
      `product`, `runtime`, `backend`, `core`, `common`, or `manager` suffixes.
- [ ] Client app packages use the required PC, H5, Flutter, mini program, Android native, iOS native, or Harmony native architecture segment and reserved role names.
- [ ] Component manifests use matching names.
- [ ] Database identifiers follow `DATABASE_SPEC.md`.
- [ ] Any legacy alias has a migration or exception record.
