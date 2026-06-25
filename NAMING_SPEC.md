# Naming Standard

- Version: 1.7
- Scope: domains, capabilities, repositories, applications, components, packages, SDK families, API authorities, route crates, database identifiers, files, and test names
- Related: `APPLICATION_GATEWAY_SPEC.md`, `DOMAIN_SPEC.md`, `APPLICATION_SPEC.md`, `APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC.md`, `APP_PC_ARCHITECTURE_SPEC.md`, `APP_H5_ARCHITECTURE_SPEC.md`, `FLUTTER_APP_MOBILE_ARCHITECTURE_SPEC.md`, `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md`, `ANDROID_APP_MOBILE_ARCHITECTURE_SPEC.md`, `IOS_APP_MOBILE_ARCHITECTURE_SPEC.md`, `HARMONY_APP_MOBILE_ARCHITECTURE_SPEC.md`, `APP_MINI_PROGRAM_UI_SPEC.md`, `APP_ANDROID_NATIVE_UI_SPEC.md`, `APP_IOS_NATIVE_UI_SPEC.md`, `APP_HARMONY_NATIVE_UI_SPEC.md`, `APP_MANIFEST_SPEC.md`, `GITHUB_WORKFLOW_SPEC.md`, `DEPLOYMENT_SPEC.md`, `CONFIG_SPEC.md`, `PNPM_SCRIPT_SPEC.md`, `COMPONENT_SPEC.md`, `MODULE_SPEC.md`, `API_SPEC.md`, `SDK_SPEC.md`, `SDK_WORKSPACE_GENERATION_SPEC.md`, `DATABASE_SPEC.md`, `CODE_STYLE_SPEC.md`

This standard is the naming entrypoint for SDKWork. It indexes naming rules that are also governed by more specific specs. If this file conflicts with a more specific root spec, the more specific spec wins and this file must be updated.

## 0. Identity And Terminology

SDKWork names use a fixed identity lattice. Do not collapse these layers into one placeholder such as `product` or `app`.

| Layer | Canonical term | Placeholder | Example | Must not use for this layer |
| --- | --- | --- | --- | --- |
| L1 product name | product name | (prose only) | SdkWork Claw Router | paths, packages, crates, env keys |
| L2 application code | application code | `<application-code>` (kebab-case paths) or `<application_code>` (Dart snake_case) | `commerce`, `router`, `drive` | `product`, bare `app`, repository name, process name |
| L3 process name | process name | `<process-name>` | `clawrouter` | application code |
| L4 manifest key | `app.key` | (manifest field, not a path placeholder) | `commerce-pc` | application code alone |
| L5 repository stem | SDKWork repository | `sdkwork-<application-code>` when they match | `sdkwork-drive` | guaranteed equal to L2 |
| L6 client architecture | client-arch | `<client-arch>` | `pc`, `h5`, `flutter-mobile` | ??|
| L7 domain | domain | `<domain>` | `commerce`, `iam` | product name |
| L8 capability | capability | `<capability>` | `cart`, `merchandise` | `product`, `common`, `manager` |
| L9 API owner | owner code | `<owner-code>` | `sdkwork-commerce` | SDK family name |

Rules:

- `application code` is defined authoritatively in `RUNTIME_DIRECTORY_SPEC.md`. It is the runtime directory and private env stem. Repository names and `app.key` may differ from it; directory names must still use application code, not product display names or repository stems when they differ.
- `app` in SDKWork already means application root, `app-api`, `app.key`, app/user surface, `apps/`, or PlusApp registration. Do not use bare `<app>` as a naming placeholder.
- `product` is retired as a naming placeholder. It remains valid only as L1 **product name** in prose, or in the forbidden generic suffix `sdkwork-<application-code>-product`.
- Commerce sellable-item work uses capability token **`merchandise`**. Public catalog browsing uses **`catalog`**. Shop configuration uses **`shop`**. See `DOMAIN_SPEC.md`.
- Retired synonyms: `<product>` ??`<application-code>`; use `application-specific` instead of retired `product-specific`; use `application-code-prefix` / `application-code-prefixed` instead of retired pnpm prefix terms.

### 0.1 Naming Formula Summary

```text
apps/sdkwork-<application-code>-<client-arch>/
sdkwork-<application-code>-<client-arch>-<capability>
sdkwork_<application_code>_<client_arch>_<capability>    # Dart only

sdkwork-<application-code>-standalone-gateway | -cloud-gateway | -api-server | -service-host | -native-host | -tauri-host
sdkwork-api-cloud-gateway                                              # platform plane only
sdkwork-<domain>-<capability>-service
sdkwork-router-<capability>-<surface>
sdkwork-<domain>-app-api | sdkwork-<domain>-backend-api | sdkwork-<domain>-open-api
```

Environment variables:

```text
SDKWORK_<APPLICATION_CODE>_<SETTING>           # private runtime; APPLICATION_CODE is uppercase L2
VITE_<APP_CODE>_<SURFACE>_<SETTING>            # browser-internal; APP_CODE is uppercase L2
```

### 0.2 Second-Order Ambiguity Registry

After `product`, these words are the most common sources of naming drift. Each row lists allowed meanings and forbidden overloads.

| Word | Allowed meaning(s) | Forbidden or retired overload | Canonical replacement |
| --- | --- | --- | --- |
| `app` | `app-api` surface, `app.key`, app/user UI surface, `apps/` directory, PlusApp registration, prose "application root" | bare placeholder `<app>`; path/env token for L2 | `<application-code>` / `application code` |
| `application` | application root, application-owned API ingress, application packages | shortening L2 to just "application" in package tokens | `application code` for L2; `application-owned` for ingress |
| `catalog` | commerce browse/category capability; i18n **message catalog**; permission/route **metadata catalog**; DB **catalog** name | generic folder name `catalog/` without domain | `i18n catalog`, `message catalog`, commerce `catalog` capability |
| `console` | user-facing **management console** package role (`*-console-*`) | company-internal operator UI; `backend-admin`; capability token | `*-console-*` + app-api; internal ops ??`*-admin-*` + `backend-admin` |
| `admin` | package role segment only when paired with `backend-admin` surface rules | bare capability token `admin`; synonym for console | `*-admin-*` packages + `backend-admin` API/SDK |
| `backend` | `backend-api` surface; `backend-admin` surface; Rust crate suffix only in forbidden list context | vague crate suffix `sdkwork-<application-code>-backend`; capability token | `backend-api`, `backend-admin`, or `sdkwork-<domain>-<capability>-service` |
| `service` | business **service crate** `sdkwork-<domain>-<capability>-service`; OS/service manager prose | package profile alias for `server`; pnpm `service:*` namespace | package profile `server`; action-first `dev:server` |
| `server` | `runtimeTarget=server`; package profile `server`; `sdkwork-<application-code>-api-server` | deployment profile; domain name; generic "backend" | `deploymentProfile`, `runtimeTarget`, `api-server` |
| `platform` | domain `platform`; connectivity plane `platform`; OS platform in package ids | application line name; product name | domain `platform` or plane `platform` ??state which |
| `profile` | full topology profile id; **config profile alias** `dev`/`prod`; GitHub package **profile** segment | lifecycle environment alone; deployment profile alone | `environment`, `deploymentProfile`, `configProfile`, or full profile id |
| `runtime` | `runtimeTarget`; forbidden crate suffix `*-runtime` | synonym for application or environment | `runtimeTarget`, `environment`, or responsibility-specific crate |
| `gateway` | application `sdkwork-<application-code>-standalone-gateway` or `sdkwork-<application-code>-cloud-gateway`; platform `sdkwork-api-cloud-gateway`; `gateway:*` pnpm namespace | bare `sdkwork-<application-code>-gateway`; bare `sdkwork-api-cloud-gateway`; any HTTP server; SDK family name | `standalone-gateway` vs `cloud-gateway` vs `api-cloud-gateway` vs `api-server` vs `platform.api-gateway` ? pick one role |
| `foundation` | shared foundation **domain/module** tier (L3); foundation dependency SDKs | package name `foundation` without domain | `sdkwork-<domain>-*` or `shared foundation module` |
| `portal` | browser **portal** public config (`PORTAL_PUBLIC_*`, `[portal.public]`); static portal assets | application code; IAM domain | `PORTAL_PUBLIC_*`, `browser public runtime` |
| `identity` | prose "identity projection" in HTTP headers | domain name instead of `iam` | domain `iam` |
| `core` | reserved package role `*-core` (runtime/bootstrap) | business capability token; forbidden `sdkwork-<application-code>-core` crate | `*-core` role or `sdkwork-<domain>-<capability>-service` |
| `common` / `manager` | ??| capability or crate catch-alls | concrete domain capability |
| `open` | approved **open-api** prefix/path; `open-api` surface | shorthand package name `open` | `open-api`, `sdkwork-<domain>-open-api` |
| `domain` (L7) | bounded context `commerce`, `iam`, ??| application code; repository stem | `<domain>` vs `<application-code>` ??commerce can be both; document which axis |
| `owner-code` (L9) | API aggregation owner `sdkwork-commerce` | SDK family; application code when they differ | `owner` in route manifest; not `sdkFamily` |
| `sdk-family-stem` | generated SDK workspace stem `im`, `commerce` | route crate name; API authority directory; application code | `sdkwork-<sdk-family-stem>-app-sdk` family table |
| `utils` | TypeScript npm package `@sdkwork/utils`; cross-language repo `sdkwork-utils` | language suffix in TypeScript npm name such as `@sdkwork/utils-typescript` | `@sdkwork/utils`, directory `packages/sdkwork-utils-typescript` |
| `product name` (L1) | human brand in prose and store copy only | paths, crates, env, capability tokens | `application code`, `merchandise`, or `product name` prose |
| `application-line adapter` | framework extension implementing IAM/domain projections for one application line | `product adapter` | `application-line adapter` or `application adapter` |

Rules:

- When two columns in this table could both apply, the name must encode the axis explicitly (`pc-console-order` = console role, not domain).
- Specs that still use retired overloads must be updated or listed in `MIGRATION_SPEC.md` ?8.
- `tools/check-identity-naming.mjs` enforces the highest-risk retired patterns; this table is the human-readable authority for the rest.

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
| SDKWork repository | `sdkwork-<application-code>` | `sdkwork-drive` |
| PC app root | `apps/sdkwork-<application-code>-pc/` | `apps/sdkwork-commerce-pc/` |
| H5 app root | `apps/sdkwork-<application-code>-h5/` | `apps/sdkwork-commerce-h5/` |
| Flutter mobile app root | `apps/sdkwork-<application-code>-flutter-mobile/` | `apps/sdkwork-commerce-flutter-mobile/` |
| Mini program app root | `apps/sdkwork-<application-code>-mini-program/` | `apps/sdkwork-commerce-mini-program/` |
| Android native app root | `apps/sdkwork-<application-code>-android-mobile/` | `apps/sdkwork-commerce-android-mobile/` |
| iOS native app root | `apps/sdkwork-<application-code>-ios-mobile/` | `apps/sdkwork-commerce-ios-mobile/` |
| Harmony native app root | `apps/sdkwork-<application-code>-harmony-mobile/` | `apps/sdkwork-commerce-harmony-mobile/` |
| PC app package | `sdkwork-<application-code>-pc-<capability>` | `sdkwork-commerce-pc-merchandise` |
| PC user console package | `sdkwork-<application-code>-pc-console-<capability>` | `sdkwork-commerce-pc-console-order` |
| PC internal admin package | `sdkwork-<application-code>-pc-admin-<capability>` | `sdkwork-commerce-pc-admin-audit` |
| H5 mobile app package | `sdkwork-<application-code>-h5-<capability>` | `sdkwork-commerce-h5-order` |
| H5 mobile user console package | `sdkwork-<application-code>-h5-console-<capability>` | `sdkwork-commerce-h5-console-order` |
| H5 mobile internal admin package | `sdkwork-<application-code>-h5-admin-<capability>` | `sdkwork-commerce-h5-admin-audit` |
| H5 mobile Capacitor host package | `sdkwork-<application-code>-h5-capacitor` | `sdkwork-commerce-h5-capacitor` |
| Flutter mobile Dart package | `sdkwork_<application_code>_flutter_mobile_<capability>` | `sdkwork_commerce_flutter_mobile_order` |
| Flutter mobile user console Dart package | `sdkwork_<application_code>_flutter_mobile_console_<capability>` | `sdkwork_commerce_flutter_mobile_console_order` |
| Flutter mobile internal admin Dart package | `sdkwork_<application_code>_flutter_mobile_admin_<capability>` | `sdkwork_commerce_flutter_mobile_admin_audit` |
| Mini program source package | `sdkwork-<application-code>-mp-<capability>` | `sdkwork-commerce-mp-order` |
| Mini program user console package | `sdkwork-<application-code>-mp-console-<capability>` | `sdkwork-commerce-mp-console-order` |
| Mini program internal admin package | `sdkwork-<application-code>-mp-admin-<capability>` | `sdkwork-commerce-mp-admin-audit` |
| Mini program host package | `sdkwork-<application-code>-mp-host` | `sdkwork-commerce-mp-host` |
| Shared mini program package | `sdkwork-<capability>-mini-program` | `sdkwork-order-mini-program` |
| Android native app package | `sdkwork-<application-code>-android-mobile-<capability>` | `sdkwork-commerce-android-mobile-order` |
| Android native user console package | `sdkwork-<application-code>-android-mobile-console-<capability>` | `sdkwork-commerce-android-mobile-console-order` |
| Android native internal admin package | `sdkwork-<application-code>-android-mobile-admin-<capability>` | `sdkwork-commerce-android-mobile-admin-audit` |
| Android native host package | `sdkwork-<application-code>-android-mobile-host` | `sdkwork-commerce-android-mobile-host` |
| Shared Android native package | `sdkwork-<capability>-android-native` | `sdkwork-order-android-native` |
| iOS native app package | `sdkwork-<application-code>-ios-mobile-<capability>` | `sdkwork-commerce-ios-mobile-order` |
| iOS native user console package | `sdkwork-<application-code>-ios-mobile-console-<capability>` | `sdkwork-commerce-ios-mobile-console-order` |
| iOS native internal admin package | `sdkwork-<application-code>-ios-mobile-admin-<capability>` | `sdkwork-commerce-ios-mobile-admin-audit` |
| iOS native host package | `sdkwork-<application-code>-ios-mobile-host` | `sdkwork-commerce-ios-mobile-host` |
| Shared iOS native package | `sdkwork-<capability>-ios-native` | `sdkwork-order-ios-native` |
| Harmony native app package | `sdkwork-<application-code>-harmony-mobile-<capability>` | `sdkwork-commerce-harmony-mobile-order` |
| Harmony native user console package | `sdkwork-<application-code>-harmony-mobile-console-<capability>` | `sdkwork-commerce-harmony-mobile-console-order` |
| Harmony native internal admin package | `sdkwork-<application-code>-harmony-mobile-admin-<capability>` | `sdkwork-commerce-harmony-mobile-admin-audit` |
| Harmony native host package | `sdkwork-<application-code>-harmony-mobile-host` | `sdkwork-commerce-harmony-mobile-host` |
| Shared Harmony native package | `sdkwork-<capability>-harmony-native` | `sdkwork-order-harmony-native` |
| Backend/admin React package | `@sdkwork/react-backend-<domain>` | `@sdkwork/react-backend-commerce` |
| Route crate package | `sdkwork-router-<capability>-<surface>` | `sdkwork-router-merchandise-app-api` |
| Web framework crate | `sdkwork-web-<capability>` | `sdkwork-web-context`, `sdkwork-web-axum`, `sdkwork-web-bootstrap` |
| RPC framework crate | `sdkwork-rpc-<capability>` | `sdkwork-rpc-core`, `sdkwork-rpc-server`, `sdkwork-rpc-client`, `sdkwork-rpc-discovery` |
| Discovery product host | `sdkwork-discovery-service-host` | `sdkwork-discovery-service-host` |
| Rust service crate | `sdkwork-<domain>-<capability>-service` | `sdkwork-drive-node-service` |
| Rust SQLx repository crate | `sdkwork-<domain>-<capability>-repository-sqlx` | `sdkwork-drive-node-repository-sqlx` |
| Rust API server crate | `sdkwork-<application-code>-api-server` | `sdkwork-drive-api-server` |
| Rust service host crate | `sdkwork-<application-code>-service-host` | `sdkwork-drive-service-host` |
| Rust native host crate | `sdkwork-<application-code>-native-host` or `sdkwork-<application-code>-tauri-host` | `sdkwork-drive-native-host` |
| Rust worker crate | `sdkwork-<domain>-<capability>-worker` | `sdkwork-drive-maintenance-worker` |
| Rust standalone application gateway crate | `sdkwork-<application-code>-standalone-gateway` | `sdkwork-drive-standalone-gateway` |
| Rust cloud application gateway crate | `sdkwork-<application-code>-cloud-gateway` | `sdkwork-im-cloud-gateway` |
| Rust platform gateway crate | `sdkwork-api-cloud-gateway` | `sdkwork-api-cloud-gateway` |
| Open API authority | `sdkwork-<domain>-open-api` | `sdkwork-im-open-api` |
| App API authority | `sdkwork-<domain>-app-api` | `sdkwork-commerce-app-api` |
| Backend API authority | `sdkwork-<domain>-backend-api` | `sdkwork-commerce-backend-api` |
| Public SDK family | `sdkwork-<sdk-family-stem>-sdk` | `sdkwork-im-sdk` |
| App SDK family | `sdkwork-<sdk-family-stem>-app-sdk` | `sdkwork-im-app-sdk` |
| Backend SDK family | `sdkwork-<sdk-family-stem>-backend-sdk` | `sdkwork-im-backend-sdk` |
| RPC SDK family | `sdkwork-<sdk-family-stem>-rpc-sdk` | `sdkwork-im-rpc-sdk` |
| Component spec | `specs/component.spec.json` | `packages/foo/specs/component.spec.json` |
| App manifest | `sdkwork.app.config.json` | `apps/sdkwork-drive-pc/sdkwork.app.config.json` |
| GitHub package id | `<platform>-<architecture>-<deployment-profile>-<profile>-<format-token>`; Linux native packages use `linux-<distribution>-<architecture>-<deployment-profile>-<profile>-<format-token>`; variant packages insert `<variant>` before `<format-token>` | `windows-x64-standalone-desktop-msi`, `linux-debian-x64-standalone-server-deb`, `container-x64-cloud-container-nvidia-cuda-tar-gz` |
| GitHub artifact name | `<artifact-prefix>-<package-id>` | `sdkwork-drive-android-arm64-standalone-mobile-aab` |
| Agent entrypoint | `AGENTS.md` | `AGENTS.md` |
| Tool compatibility shim | `<TOOL>.md` | `CLAUDE.md`, `GEMINI.md`, `CODEX.md` |

`package.json#scripts` public command names follow `PNPM_SCRIPT_SPEC.md`. Repository root scripts use action-first standard names such as `dev`, `build`, `verify`, `release:package`, `api:materialize:check`, `sdk:generate`, and `gateway:package:cloud`. Application-code-prefixed root script names such as `drive:dev`, `im:dev`, and `clawrouter:dev` are forbidden public command names.

## 3. Language Naming

Rules:

- Rust packages use kebab-case and Rust modules/imports use snake_case. Rust crate names must use
  the responsibility-specific families from `RUST_CODE_SPEC.md`, such as `service`,
  `repository-sqlx`, `api-server`, `service-host`, `native-host`, `worker`,
  `standalone-gateway`, `cloud-gateway`, or platform `api-gateway`.
- Java packages use lowercase dotted names under an approved SDKWork root; Java classes use PascalCase.
- TypeScript packages use kebab-case or approved scoped names; exported types/classes/components use PascalCase; functions and variables use camelCase.
- Dart and Flutter package names use lowercase snake_case; SDKWork Flutter mobile packages use the `sdkwork_<application_code>_flutter_mobile_<capability>` family from `FLUTTER_APP_MOBILE_ARCHITECTURE_SPEC.md`.
- Android native SDKWork package directories use kebab-case `sdkwork-<application-code>-android-mobile-*`; Kotlin packages and Android namespaces use legal lowercase dotted names that preserve the SDKWork package identity.
- iOS native SDKWork package directories use kebab-case `sdkwork-<application-code>-ios-mobile-*`; Swift package targets/modules use legal PascalCase names derived from the SDKWork package identity.
- Harmony native SDKWork package directories use kebab-case `sdkwork-<application-code>-harmony-mobile-*`; ohpm package ids or ArkTS aliases must preserve the SDKWork package identity.
- React hooks start with `use`.
- Database tables and columns use lowercase snake_case according to `DATABASE_SPEC.md`.

## 4. API And SDK Naming

Rules:

- Operation names and resource method trees follow `API_SPEC.md` and `SDK_SPEC.md`.
- SDK family names and API authority names must not be conflated.
- Route crates are source inputs, not SDK families and not OpenAPI authority directories.
- Generated package names must trace to the SDK family, not directly to the API authority.
- `<sdk-family-stem>` is the stable SDK family stem used by the application or capability line. It often
  matches the public integration name, such as `im`, even when the canonical domain used by proto
  packages is broader, such as `communication`.
- Public, app, backend, and RPC SDK families for the same capability line MUST share the same
  `<sdk-family-stem>` unless a migration or governance exception records the split.
- RPC proto `package` names use canonical domain-first `sdkwork.<domain>.<surface>.v<major>` names.
  They MUST NOT include a transport segment such as `rpc`, `grpc`, `http`, or `openapi`.
- The `rpc` segment is required in RPC artifact names, not in proto `package` names:
  - contract root `apis/rpc/`
  - SDK family `sdkwork-<sdk-family-stem>-rpc-sdk`
  - generated module paths such as `com.sdkwork.<domain>.rpc` or `sdkwork_<domain>_rpc_proto`
- The SDK family stem is linked to the proto domain through `.sdkwork-assembly.json`,
  `sdk-manifest.json` when present, `specs/component.spec.json`, and `apis/rpc/parity-registry.yaml`.

### 4.1 RPC Identity And Discovery Service Naming

RPC invocation identity follows `RPC_SPEC.md` section 3.2 and `RPC_FRAMEWORK_SPEC.md`.

Canonical RPC identity URI:

```text
sdkwork-rpc://{namespace}/{environment}/{rpc_surface}/{proto_package}/{Service}/{Method}?operationId={dotted.id}
```

Discovery `service_name` values use lowercase kebab-case:

```text
sdkwork-{domain}-{rpc_surface}-rpc
sdkwork-{application-code}-{rpc_surface}-rpc
sdkwork-discovery-internal-registry
```

Examples:

| Axis | Canonical name |
| --- | --- |
| IM internal RPC discovery name | `sdkwork-communication-internal-rpc` |
| Game internal RPC discovery name | `sdkwork-game-internal-rpc` |
| Discovery control plane registry | `sdkwork-discovery-internal-registry` |
| Commerce app RPC discovery name | `sdkwork-commerce-app-rpc` |

Rules:

- Discovery `service_name` `MUST` include the `rpc` segment and `MUST NOT` reuse HTTP API authority names such as `sdkwork-im-app-api`.
- One discovery `service_name` `SHOULD` represent one RPC listener/process group that serves a cohesive proto surface set.
- `instance_id` `SHOULD` be stable for the lifetime of one RPC server process and `SHOULD` include host/process identity in operational logs without embedding secrets.
- RPC framework crate names `MUST` use the `sdkwork-rpc-<capability>` family and `MUST NOT` use generic suffixes such as `manager`, `runtime`, or `common` for framework crates.

### 4.2 Cross-Language Utility Libraries

Rules:

- The cross-language utility repository is `sdkwork-utils`.
- Language implementation directories use `packages/sdkwork-utils-<language>/`.
- TypeScript / Node npm package names `MUST` use `@sdkwork/utils`, not `@sdkwork/utils-typescript` or other language suffixes in the npm scope.
- Rust, Python, Go, Java, Kotlin, C#, and PHP package names `MAY` include the language in the artifact or module name when required by that ecosystem.
- `@sdkwork/utils` is not an HTTP generated SDK. Do not rename it to `@sdkwork/utils-app-sdk` or add `-sdk` unless the package becomes a generated transport SDK.
- Every contract module exported from `specs/utils.contract.json` `MUST` have a matching `@sdkwork/utils/<module>` subpath export in `packages/sdkwork-utils-typescript/package.json`.
- Application repositories `MUST` consume `@sdkwork/utils` through package `exports` and normal dependency resolution. They `MUST NOT` rely on Vite or TypeScript path aliases to bypass missing subpath exports.
- Retired npm name: `@sdkwork/utils-typescript`.

Examples:

| Axis | Canonical name |
| --- | --- |
| Repository | `sdkwork-utils` |
| TypeScript directory | `packages/sdkwork-utils-typescript` |
| TypeScript npm import | `@sdkwork/utils`, `@sdkwork/utils/string`, `@sdkwork/utils/optional` |
| Rust crate | `sdkwork-utils-rust` |

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
- PC packages use kebab-case names under `sdkwork-<application-code>-pc-*`, with `pc-console` reserved for user-facing console surfaces and `pc-admin` reserved for `backend-admin` company-internal admin surfaces.
- Packages without `console` or `admin` are the default app/user-facing package family for the selected architecture.
- Console packages insert the `console` role after the architecture segment and before the concrete capability. They are user-facing management console packages for customers, tenants, app owners, or app users managing their own resources, and they remain app-api/app SDK consumers unless a more specific approved contract says otherwise.
- Admin packages insert the `admin` role after the architecture segment and before the concrete capability. They map to `backend-admin` company-internal admin surfaces for staff, operators, support, auditors, platform administrators, or trusted backend services acting for those workflows.
- `backend-admin` is the canonical surface term for admin-only backend UI, backend SDK, and backend API consumption. `*-admin-*` client packages and standalone backend/admin packages map to `backend-admin`; `*-console-*`, default app packages, app auth runtime packages, and shared frontend core packages do not.
- H5/Capacitor packages use kebab-case names under `sdkwork-<application-code>-h5-*`; user console packages use `sdkwork-<application-code>-h5-console-*`; internal admin packages use `sdkwork-<application-code>-h5-admin-*`; the Capacitor host package is exactly `sdkwork-<application-code>-h5-capacitor`.
- Flutter mobile packages use Dart lower snake case names under `sdkwork_<application_code>_flutter_mobile_*`; user console packages use `sdkwork_<application_code>_flutter_mobile_console_*`; internal admin packages use `sdkwork_<application_code>_flutter_mobile_admin_*`; do not publish Flutter app-root packages with hyphenated Dart package names.
- Mini program source packages use kebab-case names under `sdkwork-<application-code>-mp-*`; user console packages use `sdkwork-<application-code>-mp-console-*`; internal admin packages use `sdkwork-<application-code>-mp-admin-*`; shared mini program packages use `sdkwork-<capability>-mini-program`; platform subpackages, pages, and platform config files must not replace SDKWork source package naming.
- Android native packages use kebab-case names under `sdkwork-<application-code>-android-mobile-*`; user console packages use `sdkwork-<application-code>-android-mobile-console-*`; internal admin packages use `sdkwork-<application-code>-android-mobile-admin-*`; shared Android native packages use `sdkwork-<capability>-android-native`.
- iOS native packages use kebab-case names under `sdkwork-<application-code>-ios-mobile-*`; user console packages use `sdkwork-<application-code>-ios-mobile-console-*`; internal admin packages use `sdkwork-<application-code>-ios-mobile-admin-*`; shared iOS native packages use `sdkwork-<capability>-ios-native`.
- Harmony native packages use kebab-case names under `sdkwork-<application-code>-harmony-mobile-*`; user console packages use `sdkwork-<application-code>-harmony-mobile-console-*`; internal admin packages use `sdkwork-<application-code>-harmony-mobile-admin-*`; shared Harmony native packages use `sdkwork-<capability>-harmony-native`.
- Optional `core`, `commons`, `shell`, `console-core`, `console-shell`, `admin-core`, `admin-shell`, and `host` suffixes are reserved role names inside each client root package family.
- The `<capability>` token is the concrete business module token. It `MUST` use canonical domain/capability vocabulary and `MUST NOT` be a catch-all such as `common`, `misc`, `manager`, `backend`, `console`, or `admin`.

### 4.2.1 npm Package Names And Surface Metadata

For packages under `apps/sdkwork-<application-code>-pc/packages/`, the npm `package.json#name` `MUST` mirror the directory name with the `sdkwork-` prefix removed:

| Directory | npm `name` |
| --- | --- |
| `sdkwork-iam-pc-admin-oauth` | `@sdkwork/iam-pc-admin-oauth` |
| `sdkwork-iam-pc-console-settings` | `@sdkwork/iam-pc-console-settings` |
| `sdkwork-iam-pc-auth` | `@sdkwork/iam-pc-auth` |

Rules:

- Application-root packages `MUST` encode the surface role in the directory/npm name: default app (`pc-<capability>`), user console (`pc-console-<capability>`), or internal admin (`pc-admin-<capability>`).
- `package.json#sdkwork.architecture` `MUST` be `pc-react` for app/console packages and `pc-admin` for `pc-admin-*` infrastructure and capability packages.
- `package.json#sdkwork.surface` `MUST` be `app` for default app packages, `console` for `pc-console-*`, and `backend-admin` for `pc-admin-*`.
- Forbidden npm names for new admin modules include `@sdkwork/<domain>-<capability>-pc-react`, `@sdkwork/<application-code>-admin-<capability>` without the `pc` segment, and any name that omits `pc-admin` while implementing `backend-admin` operator UI.
- Legacy shared-library names such as `@sdkwork/auth-pc-react` remain valid only in appbase foundation trees, not as replacements for `sdkwork-<application-code>-pc-admin-*` inside application roots.

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
- `sdkwork-<application-code>-api-server` owns an HTTP server process that mounts route crates and listens on
  HTTP.
- `sdkwork-<application-code>-service-host` owns an in-process service container and must not mount HTTP routes.
- `sdkwork-<application-code>-native-host` and `sdkwork-<application-code>-tauri-host` own native/Tauri command and platform
  adapter boundaries.
- `sdkwork-<domain>-<capability>-worker` owns background jobs, schedulers, queues, maintenance
  loops, retries, locks, and cursors.
- Application gateway crates `MUST` encode the deployment profile they serve. Use
  `sdkwork-<application-code>-standalone-gateway` for `deploymentProfile=standalone`
  application ingress, and `sdkwork-<application-code>-cloud-gateway` for
  `deploymentProfile=cloud` application ingress. Bare
  `sdkwork-<application-code>-gateway` is retired.
- `sdkwork-api-cloud-gateway` is the platform-plane gateway for `platform.api-gateway`.
  It uses scope token `api` and deployment qualifier `cloud`. Bare `sdkwork-api-cloud-gateway`
  is retired.
- Platform gateway support crates `MUST` mirror the parent family:
  `sdkwork-api-cloud-gateway-config`, `sdkwork-api-cloud-gateway-registry`, and
  `sdkwork-api-cloud-gateway-observability`.
- Standalone and cloud application gateway crates own upstream routing, route
  precedence, proxy behavior, dependency API surface aggregation, and
  fail-closed upstream validation for their deployment profile.
- An application repository `MAY` own both gateway crate families when it ships
  both standalone and cloud deployment profiles.
- Gateway support crates `MUST` mirror the parent gateway family:
  `sdkwork-<application-code>-standalone-gateway-config`,
  `sdkwork-<application-code>-standalone-gateway-observability`,
  `sdkwork-<application-code>-cloud-gateway-config`, and
  `sdkwork-<application-code>-cloud-gateway-observability`.
- Gateway crates `MUST` live under `crates/`, not `services/` or other ad hoc
  process directories.
- The following Rust crate names are forbidden and are not compatibility exceptions:
  `sdkwork-api-cloud-gateway` (bare platform gateway without `cloud` qualifier),
  `sdkwork-<application-code>-gateway` (bare application gateway without
  `standalone` or `cloud` qualifier),
  `sdkwork-<application-code>-product`, `sdkwork-<application-code>-runtime`,
  `sdkwork-<domain>-<capability>-runtime`, `sdkwork-<application-code>-backend`,
  `sdkwork-<application-code>-core`, `sdkwork-<application-code>-common`, `sdkwork-<application-code>-manager`, and
  `sdkwork-<application-code>-server-runtime`.
- Commerce merchandise capability uses `merchandise` for sellable-item master data, SKU, and attributes, for example `sdkwork-commerce-merchandise-service` and `sdkwork-router-merchandise-app-api`. The forbidden form is using `product` as the application entrypoint or runtime suffix, such as `sdkwork-drive-product`, or reviving capability token `product` for commerce merchandise.
- Repositories must not preserve forbidden Rust crate names through wrapper crates, package aliases,
  feature aliases, or public re-export aliases.

### 4.3.1 Gateway Deployment Qualifiers

Normative gateway structure, topology binding, component contracts, and verification live in
`APPLICATION_GATEWAY_SPEC.md`. Every gateway crate `MUST` follow
`sdkwork-<scope>-<deploymentProfile>-gateway`. Application scope uses
`<application-code>`; platform scope uses `api`.

| Crate family | `deploymentProfile` | Typical `serviceLayout` | Primary surface | When to use |
| --- | --- | --- | --- | --- |
| `sdkwork-<application-code>-standalone-gateway` | `standalone` | `unified-process` (default) or approved `split-services` | `application.public-ingress` | Local dev, desktop/private appliance, single-container, or other self-contained application ingress that may embed an approved platform adapter |
| `sdkwork-<application-code>-cloud-gateway` | `cloud` | `split-services` (default) or approved `unified-process` | `application.public-ingress` | Cloud release, scale-out, or private-cloud application ingress that proxies to decomposed internal services |
| `sdkwork-api-cloud-gateway` | platform | n/a | `platform.api-gateway` | Shared SDKWork platform APIs such as IAM, Drive, and Notary |

Rules:

- `sdkwork-<application-code>-api-server` and application gateway crates are different
  responsibilities. Use `api-server` when the process only mounts application-owned route
  crates. Use `standalone-gateway` or `cloud-gateway` when the process also composes,
  proxies, or fail-closes dependency or platform surfaces for that deployment profile.
- `gateway:run:standalone`, `gateway:build:standalone`, `gateway:package:standalone`, and
  `gateway:validate:standalone` `MUST` target
  `sdkwork-<application-code>-standalone-gateway`.
- `gateway:run:cloud`, `gateway:build:cloud`, `gateway:package:cloud`, and
  `gateway:validate:cloud` `MUST` target `sdkwork-<application-code>-cloud-gateway`.
- Retired application gateway crate name: `sdkwork-<application-code>-gateway`. Retired platform
  gateway crate name: `sdkwork-api-cloud-gateway`. Migration mapping follows `MIGRATION_SPEC.md` section 8.
- Internal service names such as `session-gateway` remain capability/process names and
  `MUST NOT` replace application gateway crate naming unless they terminate
  `application.public-ingress` for a declared deployment profile.

Examples:

| Application | Standalone gateway | Cloud gateway | Platform gateway |
| --- | --- | --- | --- |
| `drive` | `sdkwork-drive-standalone-gateway` | optional when cloud split ingress exists | consumes `sdkwork-api-cloud-gateway` |
| `im` | `sdkwork-im-standalone-gateway` | `sdkwork-im-cloud-gateway` | consumes `sdkwork-api-cloud-gateway` |
| `clawrouter` | optional when standalone ingress exists | `sdkwork-clawrouter-cloud-gateway` | consumes `sdkwork-api-cloud-gateway` |
| `aiot` | optional when standalone ingress exists | `sdkwork-aiot-cloud-gateway` | consumes `sdkwork-api-cloud-gateway` |

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
- [ ] Application gateway crates use `sdkwork-<application-code>-standalone-gateway` or
      `sdkwork-<application-code>-cloud-gateway`; bare `sdkwork-<application-code>-gateway` is not used.
- [ ] Platform gateway uses `sdkwork-api-cloud-gateway`; bare `sdkwork-api-cloud-gateway` is not used.
- [ ] Rust crate names use responsibility-specific families and do not use forbidden generic
      `product`, `runtime`, `backend`, `core`, `common`, or `manager` suffixes on application-code crates.
- [ ] Commerce sellable-item capabilities use `merchandise`, not retired capability token `product`.
- [ ] Client app packages use the required PC, H5, Flutter, mini program, Android native, iOS native, or Harmony native architecture segment and reserved role names.
- [ ] Component manifests use matching names.
- [ ] Database identifiers follow `DATABASE_SPEC.md`.
- [ ] Any legacy alias has a migration or exception record.
