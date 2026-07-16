# SDKWork pnpm Script Standard

- Version: 1.0
- Scope: public `package.json#scripts` command names for SDKWork application repositories, application roots, app surface roots, and TypeScript/JavaScript packages
- Related: `README.md`, `SOUL.md`, `SDKWORK_WORKSPACE_SPEC.md`, `NAMING_SPEC.md`, `APPLICATION_GATEWAY_SPEC.md`, `APP_RUNTIME_TOPOLOGY_SPEC.md`, `APP_RUNTIME_TOPOLOGY_NAMING.md`, `CONFIG_SPEC.md`, `ENVIRONMENT_SPEC.md`, `DEPLOYMENT_SPEC.md`, `RELEASE_SPEC.md`, `TEST_SPEC.md`, `TYPESCRIPT_CODE_SPEC.md`

This standard defines the public `pnpm` command surface for SDKWork. It prevents each application from inventing application-code-prefixed or locally ordered commands such as `drive:dev`, `clawrouter:dev`, or `im:dev`.

The command name must describe the action and standard runtime axis. Product-specific implementation belongs behind a standard dispatcher, manifest, topology profile, workflow config, or internal runner script.

## 1. Goals

Rules:

- SDKWork automation `MUST` be able to run common application tasks without knowing the product name.
- Repository root commands `MUST` use one public vocabulary across applications.
- Application-code tokens `MUST NOT` be the first segment of public root scripts.
- Application differences `MUST` be expressed through `runtimeTarget`, `database`, `deploymentProfile`, `environment`, manifests, and topology profiles, not through application-code-prefixed script names.
- Command examples in standards, README files, agent instructions, and runbooks `MUST` use this standard vocabulary.

## 2. Command Layers

SDKWork uses four command layers.

| Layer | Owner | Purpose | Public automation surface |
| --- | --- | --- | --- |
| Repository root | application repository | Cross-application development, build, release, deployment, verification orchestration | Yes |
| App surface root | PC, H5, Flutter, native, mini program, backend/admin UI, docs, or equivalent app surface | Local renderer/package development and build | Yes, but scoped to that app surface |
| Package root | feature package, SDK wrapper, docs package, native host package | Package-local typecheck, test, build, lint | Package-local only |
| Internal runner | `scripts/`, `tools/`, package CLI, Rust/Cargo, Gradle, Flutter, Tauri, Vite | Implementation details | No |

Rules:

- Repository root commands are the stable automation contract.
- App surface and package commands may be narrower, but they should still use standard base names such as `dev`, `build`, `typecheck`, `lint`, `test`, and `clean`.
- Internal runner names may contain product names when the file is application-owned, but those names `MUST NOT` leak into public root script names.
- Root commands `SHOULD` call a standard dispatcher such as `node scripts/sdkwork-command.mjs ...` or a thin equivalent wrapper.

## 3. Required Root Commands

Every SDKWork application repository root `MUST` expose these commands:

```text
pnpm dev
pnpm build
pnpm test
pnpm check
pnpm verify
pnpm clean
```

Meanings:

| Command | Meaning |
| --- | --- |
| `dev` | Start the default local development workflow for the application |
| `stop` | Stop only the processes attributable to this repository's development workflow |
| `build` | Build the default production artifact or default app surface |
| `test` | Run the default stable test subset for the repository |
| `check` | Run static standards, generated-artifact, dependency, config, or policy checks without packaging a release |
| `verify` | Run the merge-ready verification aggregate for the repository |
| `clean` | Remove reproducible local build/test artifacts (`dist/`, `.runtime/dev-sites/`, cache directories) without deleting git-tracked source files, build-critical source contracts (see `CODE_STYLE_SPEC.md` §7), checked-in config, secrets, databases, or user-private runtime files |

When a repository root exposes `dev`, it `MUST` also expose `stop`. A `stop` command
MUST scope process selection to the owning repository or its explicitly configured
runtime bindings. It MUST NOT terminate processes merely because they share a generic
executable name such as `node`, `cargo`, `java`, or `python`.

When the capability exists, the repository root `MUST` expose the matching command family:

| Capability | Required commands |
| --- | --- |
| Runtime start, stop, or preview | `start`, `stop`, `preview` |
| TypeScript/JavaScript package verification | `typecheck`, `lint`, `format`, `format:check` |
| Release packaging | `release:plan`, `release:build`, `release:stage`, `release:package`, `release:validate`, `release:publish` as applicable |
| Deployment | `deploy:plan`, `deploy:apply`, `deploy:rollback`, `deploy:validate` as applicable |
| API materialization | `api:materialize`, `api:materialize:check`, `api:check` |
| SDK generation | `sdk:generate`, `sdk:generate:check`, `sdk:check` |
| Database operations | `db:plan`, `db:init`, `db:migrate`, `db:seed`, `db:status`, `db:validate`, `db:materialize:contract`, `db:bootstrap`, `db:drift`, `db:drift:check`, `db:postgres:plan`, `db:postgres:init`, `db:postgres:migrate` when PostgreSQL is used |
| IAM application bootstrap | `admin:bootstrap:app`, `check:iam-application-bootstrap`, `test:contract:iam-application-bootstrap` when bootstrap tooling exists |
| Gateway operations | `gateway:run`, `gateway:plan`, `gateway:build`, `gateway:package`, `gateway:validate`, `gateway:matrix` |
| Topology | `topology:validate`, `topology:plan` as applicable |
| Supply-chain evidence | `sbom:generate`, `sbom:check` as applicable |

## 4. Script Name Grammar

Repository root script names `MUST` follow:

```text
<command>[:runtimeTarget][:database][:deploymentProfile][:tier]
```

The first segment `MUST` be a standard command or standard tool namespace.

Allowed command or namespace first segments:

```text
dev
start
stop
preview
build
test
check
verify
clean
typecheck
lint
format
release
deploy
db
api
sdk
gateway
topology
workflow
sbom
nginx
docs
perf
migrate
install
admin
models
downloads
skills
app-store
smoke
```

Rules:

- Use `api`, not `apis`, for new root scripts.
- Use `sdk`, not application-specific SDK prefixes such as `file-sdk`, for cross-application SDK generation and verification commands. Domain-specific package commands may keep narrower names inside the owning package.
- Runtime targets `MUST` be exposed through action-first scripts such as `dev:browser`,
  `dev:desktop`, `build:desktop`, `build:container`, `build:android-native`,
  `build:ios-native`, `dev:flutter-android`, and `release:package:mini-program`.
- Root `dev:browser` and `dev:desktop` are normalized development defaults.
  When present, each `MUST` resolve to `database = postgres`,
  `deploymentProfile = standalone`, and `environment = development`,
  either by delegating to `dev:<target>:postgres:standalone`
  or by passing equivalent explicit flags such as `--database postgres`,
  `--deployment-profile standalone`, and `--environment development`.
  SQLite or cloud development variants must use explicit
  suffixed scripts such as `dev:browser:sqlite`,
  `dev:desktop:sqlite`, or `dev:browser:postgres:cloud`.
- Tool or platform names such as `browser:*`, `desktop:*`, `tauri:*`, `docker:*`,
  `android:*`, `ios:*`, `harmony:*`, `flutter:*`, and `mini-program:*` `MUST NOT`
  be public root, app surface, or package-local script names when they represent
  a runtime target. The tool remains an internal runner detail behind the
  standard action-first script.
- `tauri` `MUST NOT` appear as a public script runtime target suffix such as `dev:tauri`; use `dev:desktop` or `build:desktop` instead.
- Docker-compatible runtime artifacts `MUST` map to `runtimeTarget = container`,
  not to a public `docker:*` command family.

## 5. Axis Values

Script suffixes use canonical values from `APP_RUNTIME_TOPOLOGY_NAMING.md`, `CONFIG_SPEC.md`, and `ENVIRONMENT_SPEC.md`.

Runtime targets:

```text
browser
desktop
server
container
tablet-ipados
tablet-android
capacitor-ios
capacitor-android
flutter-ios
flutter-android
android-native
ios-native
harmony-native
mini-program
test-runner
```

Database aliases:

```text
postgres
sqlite
```

`postgres` is the command alias for the PostgreSQL runtime engine. Runtime config may normalize it to `postgresql`.

Deployment profiles:

```text
standalone
cloud
```

Quality or execution tiers:

```text
fast
precommit
full
parallel
smoke
debug
local
check
required
docker
```

Rules:

- `self-hosted`, `cloud-hosted`, `hosting`, and `deploymentMode` `MUST NOT` appear in new public script names or standard command examples.
- Root default dev scripts `dev:browser` and `dev:desktop` `MUST NOT` pass
  retired topology flags such as `--hosting self-hosted` or
  `--hosting cloud-hosted`; use `--deployment-profile standalone|cloud` plus
  `--environment <tier>`.
- Public script names and command values `MUST NOT` include internal process
  layout values. Process decomposition is selected by the active topology
  profile and deployment manifests behind `standalone` or `cloud`.
- `web`, `mobile`, `native`, and `docker` `MUST NOT` be used as deployment profile or runtime-target aliases.
- `dev`, `test`, `staging`, and `prod` may appear only as script/file profile aliases. Runtime config must normalize them to `development`, `test`, `staging`, and `production`.

## 6. Forbidden Application-Code Prefixes

Repository root public scripts `MUST NOT` start with a product or repository-specific token.

Forbidden examples:

```text
drive:dev
drive:build
im:dev
im:dev:desktop
clawrouter:dev
clawrouter:plan
<application-code>:dev
<application-code>:build
<application-code>:release
```

Migration examples:

| Legacy command | Standard command |
| --- | --- |
| `drive:dev` | `dev` |
| `drive:dev:desktop` | `dev:desktop` |
| `drive:build` | `build` |
| `drive:build:self-hosted` | `build:standalone` |
| `clawrouter:dev` | `dev` |
| `clawrouter:dev:postgres` | `dev:server:postgres` or `dev:browser:postgres` based on the orchestrated target |
| `clawrouter:dev:cloud:split` | `dev:browser:postgres:cloud` |
| `browser:dev` | `dev:browser` |
| `desktop:dev` | `dev:desktop` |
| `desktop:build` | `build:desktop` |
| `tauri:dev` | `dev:desktop` |
| `dev:tauri` | `dev:desktop` |
| `docker:build` | `build:container` |
| `android:build` | `build:android-native` |
| `ios:build` | `build:ios-native` |
| `harmony:dev` | `dev:harmony-native` |
| `flutter:dev` | `dev:flutter-android` or `dev:flutter-ios` based on the selected target |
| `mini-program:build` | `build:mini-program` |
| `im:dev` | `dev` |
| `im:dev:desktop` | `dev:desktop` |

Unreleased applications `MUST` delete legacy application-code-prefixed scripts rather than preserve compatibility aliases. A temporary migration branch may use `legacy:<application-code>:<command>` only when a migration plan names the removal date and validation emits a warning.

## 7. Gateway Commands

Gateway root scripts `MUST` use action before deployment profile:

```text
gateway:<action>[:deploymentProfile]
```

Examples:

```text
gateway:run:standalone
gateway:plan:standalone
gateway:build:standalone
gateway:package:standalone
gateway:validate:standalone
gateway:run:cloud
gateway:plan:cloud
gateway:build:cloud
gateway:validate:cloud
gateway:package:cloud
gateway:matrix
gateway:matrix:standalone
gateway:matrix:cloud
gateway:assembly:materialize
gateway:assembly:validate
gateway:route-composition:audit
```

Examples:

```text
gateway:assembly:materialize
gateway:assembly:validate
gateway:route-composition:audit
```

Rules:

- Use `gateway:package:cloud`, not `gateway:cloud:bundle`.
- Use `gateway:package:standalone`, not `gateway:standalone:pack`.
- Use `gateway:validate:<deploymentProfile>` for package/bundle validation.
- `gateway:*:standalone` commands `MUST` target
  `sdkwork-<application-code>-standalone-gateway` when the repository owns an application
  standalone gateway crate.
- `gateway:*:cloud` commands `MUST` target `sdkwork-<application-code>-cloud-gateway` when
  the repository owns an application cloud gateway crate.
- Repositories that only package `platform.api-gateway` config bundles and do not own an
  application gateway crate `MAY` expose `gateway:package:cloud` and
  `gateway:validate:cloud` without a local gateway binary, but `MUST NOT` invent a bare
  `sdkwork-<application-code>-gateway` crate name in scripts or docs.
- Retired gateway script names `gateway:bundle:*` and `gateway:bundle:validate:*` `MUST` be
  renamed to `gateway:package:*` and `gateway:validate:*`.
- `gateway:assembly:materialize` `MUST` invoke `node scripts/gateway/assembly-materialize.mjs`
  (or an equivalent thin repo wrapper around `sdkwork-specs/tools/materialize-gateway-assembly.mjs`)
  and regenerate `crates/sdkwork-<application-code>-gateway-assembly/` deterministically.
- `gateway:assembly:validate` `MUST` invoke `node scripts/gateway/assembly-validate.mjs`
  (or an equivalent thin wrapper around `sdkwork-specs/tools/validate-gateway-assembly.mjs`)
  and fail on missing assembly crates, manifest drift, or forbidden route-crate merges in gateway mains.
- Workspace roots `SHOULD` expose `gateway:route-composition:audit` through a thin wrapper around
  `sdkwork-specs/tools/audit-gateway-route-composition-workspace.mjs` to detect infrastructure probe
  duplication, empty assemblies, and platform collapsed-ingress violations across repositories.
- Repositories without `sdkwork-routes-<application-code>-*` workspace members `MAY` omit
  `gateway:assembly:*` commands.

## 8. Release And Deployment Commands

Release scripts `MUST` use lifecycle phases:

```text
release:plan
release:build
release:stage
release:package
release:package:check
release:validate
release:publish
release:preflight
```

Rules:

- Bare `release` is not a canonical required command. Repositories may keep it only as a documented aggregate that calls canonical `release:*` phases.
- Use `release:build:desktop` or `release:package:desktop`, not `release:desktop`.
- Environment selection belongs in config/profile flags or runtime config, not in application-specific release command names.

Deploy scripts `MUST` use:

```text
deploy:plan
deploy:apply
deploy:rollback
deploy:validate
```

Provider-specific wrappers may add a provider suffix only after the phase, such as `deploy:plan:kubernetes`, when a deployment standard or runbook owns that provider.

## 9. Dispatcher Standard

Application repositories `SHOULD` provide:

```text
scripts/sdkwork-command.mjs
```

Rules:

- The dispatcher `MUST` parse standard command names or explicit flags and map them to product implementation scripts.
- The dispatcher `MUST` print or pass normalized `deploymentProfile`, `runtimeTarget`, database profile, and lifecycle environment when they affect runtime behavior.
- The dispatcher `MUST` fail fast on unknown standard commands.
- The dispatcher `MUST NOT` accept retired public axis values such as `self-hosted` or `cloud-hosted`.
- Existing product runners such as `scripts/<application-code>-dev.mjs` may remain as internal implementation details.

## 10. Validation

pnpm script validation `MUST` check:

- Required repository root commands exist.
- Product-prefixed public root scripts are absent.
- Retired deployment words and flags are absent from new script names, script
  command values, standard command examples, and command-bearing manifests.
- New root scripts use allowed first segments.
- `api:*` is preferred over new `apis:*` root scripts.
- `gateway:*` commands use action before deployment profile.
- Runtime target command aliases use action-first names; `browser:*`, `desktop:*`,
  `tauri:*`, `docker:*`, `android:*`, `ios:*`, `harmony:*`, `flutter:*`,
  `mini-program:*`, and `*:tauri` are absent from root, app surface, and
  package-local scripts.
- App surface and package scripts use standard local names where applicable, and do not keep
  retired public namespaces such as `server:*`, `service:*`, `portal:*`, `product:*`,
  `alignment:*`, `apis:*`, `file-sdk:*`, or `prepare:*`.
- Standards, `README.md`, `AGENTS.md`, active runbook examples, `sdkwork.app.config.json`,
  `sdkwork.workflow.json`, active `specs/*.json`, and Tauri config command hooks do not
  introduce application-code-prefixed public root commands, platform/tool-first runtime aliases,
  retired deployment flags such as `--hosting self-hosted`, or retired command
  order such as `gateway:cloud:bundle`.
- Active runner scripts under `scripts/` and `tools/` do not invoke or
  document retired public `pnpm` commands such as `browser:dev`,
  `desktop:dev`, `server:dev`, `tauri:dev`, `dev:tauri`,
  `dev:portal`, or `dev:service`; internal implementation may still call
  native tools such as Vite, Tauri, Cargo, Docker, Flutter, Gradle, Xcode, or
  hvigor behind the standard action-first `pnpm` surface.
- Root `dev:browser` and `dev:desktop` resolve through their direct command
  value or root-script delegation chain to PostgreSQL, standalone, and
  `development` defaults, and fail when they resolve to SQLite, cloud, retired
  process-layout flags, or retired `--hosting` flags.

Validation SHOULD provide a migration suggestion for every rejected script name.

## 11. Clean Command Boundary

The `pnpm clean` command removes reproducible local artifacts. It `MUST NOT` delete:

- Git-tracked source files of any kind.
- Build-critical source files as defined in `CODE_STYLE_SPEC.md` §7.1 (e.g., `build/package-contract.ts`, config helper modules imported by `vite.config.ts` or `tsconfig.json`).
- Checked-in config, manifests, specs, or documentation.
- Secrets, databases, or user-private runtime files governed by `RUNTIME_DIRECTORY_SPEC.md`.

Allowed deletion targets:

- `dist/` directories (build output).
- `.runtime/dev-sites/` and similar transient dev-server state.
- `node_modules/.cache/`, `node_modules/.vite/`, and similar tool caches.
- `.runtime/cargo-target/` and similar build caches when explicitly scoped.

Rules:

- `clean` scripts `MUST` enumerate the exact paths they delete. Glob-based deletion `MUST NOT` match git-tracked paths.
- When `clean` deletes a directory, it `MUST NOT` use patterns that could match a `build/` directory containing git-tracked source files.
- Build runners invoked after `clean` `MUST` be able to recover without manual intervention through the self-healing pattern in `CODE_STYLE_SPEC.md` §7.3.

## 12. Acceptance Checklist

- [ ] Repository root exposes `dev`, `build`, `test`, `check`, `verify`, and `clean`.
- [ ] Capability-specific root commands exist for release, deploy, API, SDK, database, gateway, topology, and supply-chain workflows when those capabilities exist.
- [ ] No repository root public script starts with a application-code prefix such as `drive`, `im`, or `clawrouter`.
- [ ] Runtime-target commands are action-first, for example `dev:browser`, `dev:desktop`, `build:desktop`, `build:container`, `build:android-native`, `build:ios-native`, and `build:mini-program`; no public script uses platform/tool-first aliases such as `browser:*`, `desktop:*`, `tauri:*`, `docker:*`, `android:*`, `ios:*`, `harmony:*`, `flutter:*`, `mini-program:*`, or `*:tauri`.
- [ ] Root `dev:browser` and `dev:desktop` default to
      `postgres:standalone` with `environment = development`; SQLite and cloud
      variants are explicit suffixed commands.
- [ ] Script suffixes use canonical runtime target, database, deployment profile, and tier values.
- [ ] Gateway commands use `gateway:<action>[:deploymentProfile]`.
- [ ] Root public scripts call a standard dispatcher or thin wrapper.
- [ ] App surface/package scripts remain package-local and do not become a second root automation standard.
- [ ] `pnpm clean` does not delete git-tracked build-critical source files (see `CODE_STYLE_SPEC.md` §7).
- [ ] `README.md`, related architecture specs, and `TEST_SPEC.md` reference this standard.
