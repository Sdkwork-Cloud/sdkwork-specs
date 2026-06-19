# SDKWork pnpm Script Standard

- Version: 1.0
- Scope: public `package.json#scripts` command names for SDKWork application repositories, application roots, app surface roots, and TypeScript/JavaScript packages
- Related: `README.md`, `SOUL.md`, `SDKWORK_WORKSPACE_SPEC.md`, `NAMING_SPEC.md`, `APP_RUNTIME_TOPOLOGY_SPEC.md`, `APP_RUNTIME_TOPOLOGY_NAMING.md`, `CONFIG_SPEC.md`, `ENVIRONMENT_SPEC.md`, `DEPLOYMENT_SPEC.md`, `RELEASE_SPEC.md`, `TEST_SPEC.md`, `TYPESCRIPT_CODE_SPEC.md`

This standard defines the public `pnpm` command surface for SDKWork. It prevents each application from inventing product-prefixed or locally ordered commands such as `drive:dev`, `clawrouter:dev`, or `im:dev`.

The command name must describe the action and standard runtime axis. Product-specific implementation belongs behind a standard dispatcher, manifest, topology profile, workflow config, or internal runner script.

## 1. Goals

Rules:

- SDKWork automation `MUST` be able to run common application tasks without knowing the product name.
- Repository root commands `MUST` use one public vocabulary across applications.
- Product names `MUST NOT` be the first segment of public root scripts.
- Application differences `MUST` be expressed through `runtimeTarget`, `database`, `serviceLayout`, `deploymentProfile`, `environment`, manifests, and topology profiles, not through product-prefixed script names.
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
- Internal runner names may contain product names when the file is product-owned, but those names `MUST NOT` leak into public root script names.
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
| `build` | Build the default production artifact or default app surface |
| `test` | Run the default stable test subset for the repository |
| `check` | Run static standards, generated-artifact, dependency, config, or policy checks without packaging a release |
| `verify` | Run the merge-ready verification aggregate for the repository |
| `clean` | Remove reproducible local build/test artifacts without deleting source, checked-in config, secrets, databases, or user-private runtime files |

When the capability exists, the repository root `MUST` expose the matching command family:

| Capability | Required commands |
| --- | --- |
| Runtime start or preview | `start`, `preview` |
| TypeScript/JavaScript package verification | `typecheck`, `lint`, `format`, `format:check` |
| Release packaging | `release:plan`, `release:build`, `release:stage`, `release:package`, `release:validate`, `release:publish` as applicable |
| Deployment | `deploy:plan`, `deploy:apply`, `deploy:rollback`, `deploy:validate` as applicable |
| API materialization | `api:materialize`, `api:materialize:check`, `api:check` |
| SDK generation | `sdk:generate`, `sdk:generate:check`, `sdk:check` |
| Database operations | `db:plan`, `db:init`, `db:migrate`, `db:status`, `db:validate` |
| Gateway operations | `gateway:run`, `gateway:plan`, `gateway:build`, `gateway:package`, `gateway:validate`, `gateway:matrix` |
| Topology | `topology:validate`, `topology:plan` as applicable |
| Supply-chain evidence | `sbom:generate`, `sbom:check` as applicable |

## 4. Script Name Grammar

Repository root script names `MUST` follow:

```text
<command>[:runtimeTarget][:database][:serviceLayout][:deploymentProfile][:tier]
```

The first segment `MUST` be a standard command or standard tool namespace.

Allowed command or namespace first segments:

```text
dev
start
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
docker
desktop
tauri
android
ios
harmony
flutter
mini-program
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
- Use `sdk`, not product-specific SDK prefixes such as `file-sdk`, for cross-application SDK generation and verification commands. Domain-specific package commands may keep narrower names inside the owning package.
- `docker` may be a tooling namespace, but Docker-compatible runtime artifacts `MUST` map to `runtimeTarget = container`.
- `tauri`, `android`, `ios`, `harmony`, `flutter`, and `mini-program` may be platform-tool namespaces, but repository root automation should also expose `dev:<runtimeTarget>` or `build:<runtimeTarget>` where a cross-application script needs that target.

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

Service layouts:

```text
unified-process
split-services
```

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
- `web`, `mobile`, `native`, and `docker` `MUST NOT` be used as deployment profile or runtime-target aliases.
- `dev`, `test`, `staging`, and `prod` may appear only as script/file profile aliases. Runtime config must normalize them to `development`, `test`, `staging`, and `production`.

## 6. Forbidden Product Prefixes

Repository root public scripts `MUST NOT` start with a product or repository-specific token.

Forbidden examples:

```text
drive:dev
drive:build
im:dev
im:dev:desktop
clawrouter:dev
clawrouter:plan
<product>:dev
<product>:build
<product>:release
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
| `clawrouter:dev:cloud:split` | `dev:browser:postgres:split-services:cloud` |
| `im:dev` | `dev` |
| `im:dev:desktop` | `dev:desktop` |

Unreleased applications `MUST` delete legacy product-prefixed scripts rather than preserve compatibility aliases. A temporary migration branch may use `legacy:<product>:<command>` only when a migration plan names the removal date and validation emits a warning.

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
gateway:package:cloud
gateway:validate:cloud
gateway:matrix
gateway:matrix:standalone
gateway:matrix:cloud
```

Rules:

- Use `gateway:package:cloud`, not `gateway:cloud:bundle`.
- Use `gateway:package:standalone`, not `gateway:standalone:pack`.
- Use `gateway:validate:<deploymentProfile>` for package/bundle validation.

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
- Environment selection belongs in config/profile flags or runtime config, not in product-specific release command names.

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
- The dispatcher `MUST` print or pass normalized `deploymentProfile`, `runtimeTarget`, `serviceLayout`, and lifecycle environment when they affect runtime behavior.
- The dispatcher `MUST` fail fast on unknown standard commands.
- The dispatcher `MUST NOT` accept retired public axis values such as `self-hosted` or `cloud-hosted`.
- Existing product runners such as `scripts/<product>-dev.mjs` may remain as internal implementation details.

## 10. Validation

pnpm script validation `MUST` check:

- Required repository root commands exist.
- Product-prefixed public root scripts are absent.
- Retired deployment words are absent from new script names.
- New root scripts use allowed first segments.
- `api:*` is preferred over new `apis:*` root scripts.
- `gateway:*` commands use action before deployment profile.
- App surface and package scripts use standard local names where applicable.
- Standards and README examples do not introduce product-prefixed public root commands.

Validation SHOULD provide a migration suggestion for every rejected script name.

## 11. Acceptance Checklist

- [ ] Repository root exposes `dev`, `build`, `test`, `check`, `verify`, and `clean`.
- [ ] Capability-specific root commands exist for release, deploy, API, SDK, database, gateway, topology, and supply-chain workflows when those capabilities exist.
- [ ] No repository root public script starts with a product prefix such as `drive`, `im`, or `clawrouter`.
- [ ] Script suffixes use canonical runtime target, database, service layout, deployment profile, and tier values.
- [ ] Gateway commands use `gateway:<action>[:deploymentProfile]`.
- [ ] Root public scripts call a standard dispatcher or thin wrapper.
- [ ] App surface/package scripts remain package-local and do not become a second root automation standard.
- [ ] `README.md`, related architecture specs, and `TEST_SPEC.md` reference this standard.
