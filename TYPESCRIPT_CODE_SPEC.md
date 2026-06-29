# TypeScript Code Standard

- Version: 1.2
- Scope: TypeScript, JavaScript, Node tooling, package exports, service facades, generated TypeScript SDK composition, and TypeScript tests
- Related: `CODE_STYLE_SPEC.md`, `NAMING_SPEC.md`, `SDK_SPEC.md`, `SDK_WORKSPACE_GENERATION_SPEC.md`, `FRONTEND_SPEC.md`, `TEST_SPEC.md`

This standard applies only when TypeScript, JavaScript, Node scripts, package manifests, or TypeScript SDK facades are touched.

## 1. Baseline

Rules:

- Follow the repository `tsconfig` and package manager configuration.
- Prefer strict typing at public boundaries.
- Do not introduce implicit `any` in public APIs.
- Generated TypeScript SDK output under generator-owned directories must not be hand-edited.
- Handwritten customizations belong in generated `custom/` roots or approved composed facades.

## 2. Source File Design Principles

TypeScript source files should be designed for maintainability, readability, and logical coherence. The following principles guide file organization:

### 2.1 Core Principles: High Cohesion, Low Coupling

Every source file should adhere to these fundamental design principles:

| Principle | Definition | Application |
| --- | --- | --- |
| **Single Responsibility** | A file should have one reason to change | Files focused on a single domain, capability, or concern |
| **High Cohesion** | Related code belongs together | All functions/types in a file work toward a common purpose |
| **Low Coupling** | Minimize dependencies between files | Changes to one file don't cascade to many others |
| **Clear Boundaries** | File boundaries reflect logical boundaries | Split when responsibilities diverge, not when lines accumulate |

**When to split a file:**
- It contains multiple unrelated responsibilities (e.g., user management AND order processing)
- Changes to one part frequently require unrelated changes to another
- Different stakeholders need to modify different sections
- Testing requires mocking unrelated dependencies
- Understanding the file requires navigating multiple conceptual domains

**When NOT to split a file:**
- The code serves a single, cohesive purpose
- Splitting would force readers to jump between files to understand one concept
- The file represents a natural unit of domain knowledge
- Splitting would create artificial boundaries that harm maintainability

### 2.2 Size as a Signal, Not a Rule

File size is a **symptom indicator**, not a compliance target. Use these signals thoughtfully:

| Size Signal | Likely Meaning | Action |
| --- | --- | --- |
| Growing beyond ~300 lines | Possible responsibility creep | Review: does this file have multiple concerns? |
| Approaching ~500 lines | Strong signal to evaluate | Check cohesion: can parts evolve independently? |
| Exceeding ~1000 lines | High signal for review | Justify: is the cohesion genuine or accidental? |

**Important:** These signals are NOT limits. A well-structured 2000-line file with genuine cohesion is preferable to artificially splitting related code across multiple files that readers must jump between.

### 2.3 Examples of Valid Large Files

The following patterns commonly produce larger files that maintain high cohesion:

| Pattern | Why It's Valid | Cohesion Justification |
| --- | --- | --- |
| **Schema/Contract Definitions** | OpenAPI schemas, protobuf types, API contracts | Single source of truth for a contract surface |
| **Route/Endpoint Collections** | Many routes for one API surface | One domain's routing knowledge in one place |
| **State Machine Definitions** | Complex state transitions | All states and transitions visible together |
| **Enum/Constant Collections** | Domain constants, error codes | Complete enumeration without fragmentation |
| **Generated Type Aggregations** | Re-exporting generated types | Thin aggregation layer over external source |
| **Test Fixtures** | Inline test data | Test locality improves understanding |

When a large file genuinely reflects a cohesive unit, document the rationale:

```typescript
// Cohesion note: This file defines all OpenAPI schemas for the BirdCoder API.
// Schemas are interdependent (references, shared types) and reviewed together.
// Splitting would fragment knowledge and harm API contract visibility.
```

### 2.4 Barrel Files and Re-exports

Barrel files (`index.ts`) serve as public API boundaries:

- Barrel files that only re-export from other modules have **no size constraint**
- Barrel files **MUST NOT** contain business logic, implementations, or type definitions
- A barrel file with logic is no longer a barrel—it's a module that needs its own responsibility analysis

### 2.5 Decision Framework

When evaluating whether to split a file, ask:

1. **Cohesion Test**: Do all parts of this file change together? If one part changes, do others typically need updates?
2. **Coupling Test**: Would splitting create circular dependencies or force readers to jump between files?
3. **Responsibility Test**: Can you name the single responsibility? Would a new team member understand it?
4. **Evolution Test**: Do different parts evolve at different rates or by different teams?
5. **Testing Test**: Does the file require complex setup or mocking for unrelated functionality?

If the answers favor cohesion, keep the file together regardless of size. If they favor separation, split regardless of size.

## 3. Package Shape

Recommended authored package shape:

```text
src/
  index.ts
  contracts/
  services/
  adapters/
  runtime/
  config/
  errors/
  tests/
```

Rules:

- `src/index.ts` is the public export boundary.
- Keep package root exports stable and small.
- Do not import another package through `src/` internals.
- Service modules accept SDK clients through typed ports.
- Runtime/bootstrap constructs concrete SDK clients and injects token managers.
- Node scripts should be deterministic, fail fast, and avoid hidden global state.

### 2.1 `@sdkwork/utils` Package Exports

Rules:

- The canonical TypeScript utility npm package is `@sdkwork/utils` from
  `sdkwork-utils/packages/sdkwork-utils-typescript`.
- `package.json#exports` must expose every contract module as `./<module>` with paired `types` and
  `import` entries pointing at built artifacts under `dist/`.
- Do not publish or consume retired `@sdkwork/utils-typescript`.
- Application repositories must resolve `@sdkwork/utils` through package exports. Vite aliases and
  `tsconfig` path overrides are compatibility shims only and must not replace missing export maps.
- When adding a module to `specs/utils.contract.json`, update
  `scripts/check-typescript-exports.mjs` coverage by keeping `package.json#exports` in sync.

## 3. SDK And HTTP Boundaries

Rules:

- Business services use generated SDK clients or approved composed wrappers.
- Raw `fetch`, `axios`, or handwritten HTTP clients are forbidden for SDKWork APIs when generated SDK methods exist.
- Do not manually assemble `Authorization`, `Access-Token`, or `X-API-Key` headers in business modules.
- Protected app-api/backend-api SDKs use the global TokenManager or equivalent credential hook.
- Protected open-api SDKs use approved open-api credential providers matching their declared auth mode.

## 4. Naming

Rules:

- Packages use lowercase kebab-case or approved scoped package names such as `@sdkwork/<name>`.
- Files use repository convention; new utility/service files should use kebab-case or camelCase consistently with nearby files.
- Types, interfaces, classes, and React components use PascalCase.
- Functions, variables, and hooks use camelCase.
- Hooks start with `use`.
- Test files use the local pattern, commonly `*.test.ts`, `*.test.tsx`, or `*.test.mjs`.

## 5. Node Script And Build Runner Resilience

Node scripts under `scripts/` that orchestrate builds, dev servers, or dependency preparation must follow `CODE_STYLE_SPEC.md` §7 (Build Source Integrity And Self-Healing).

Rules:

- Build runners `MUST` verify build-critical source files before invoking `vite build`, `tsc`, or equivalent build commands.
- When a build-critical source file is missing, the runner `MUST` attempt `git checkout HEAD -- <path>` self-healing before failing.
- Verification and self-healing functions `SHOULD` accept injected `fileExists` and `runProcess` hooks for testability.
- Error messages from failed self-healing `MUST` name the missing files and provide the exact recovery command.
- `pnpm clean` scripts `MUST NOT` delete git-tracked `build/` directories, config helper modules, or any file that is imported by `vite.config.ts`, `tsconfig.json`, or build scripts at load time.
- Dev-server startup scripts `MUST NOT` assume that sibling workspace `dist/` directories are the only missing artifact; they `MUST` also verify sibling workspace build-critical source files when they invoke cross-repository builds.

## 6. Verification

Rules:

- Run `pnpm typecheck`, `pnpm test`, `pnpm lint`, or the package-specific wrapper when present.
- Run narrow package tests first, then workspace verification for shared package exports, SDK facades, or codegen changes.
- Static scans should fail on raw SDKWork HTTP calls, manual auth headers, and cross-package `/src/` imports when those boundaries are governed.
- Build runner tests `SHOULD` verify that missing build-critical source files trigger self-healing, not an immediate crash.

## 7. Acceptance Checklist

- [ ] Public TypeScript APIs are typed.
- [ ] `src/index.ts` is a stable export boundary.
- [ ] SDK clients are injected through typed ports.
- [ ] Raw HTTP did not replace generated SDK calls.
- [ ] Generated TypeScript output was not hand-edited.
- [ ] Typecheck/test/lint commands are documented.
- [ ] Build runners verify build-critical source files and self-heal from git when missing.
- [ ] `pnpm clean` does not delete git-tracked build-critical source files.

