# TypeScript Code Standard

- Version: 1.0
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

## 2. Package Shape

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

## 5. Verification

Rules:

- Run `pnpm typecheck`, `pnpm test`, `pnpm lint`, or the package-specific wrapper when present.
- Run narrow package tests first, then workspace verification for shared package exports, SDK facades, or codegen changes.
- Static scans should fail on raw SDKWork HTTP calls, manual auth headers, and cross-package `/src/` imports when those boundaries are governed.

## 6. Acceptance Checklist

- [ ] Public TypeScript APIs are typed.
- [ ] `src/index.ts` is a stable export boundary.
- [ ] SDK clients are injected through typed ports.
- [ ] Raw HTTP did not replace generated SDK calls.
- [ ] Generated TypeScript output was not hand-edited.
- [ ] Typecheck/test/lint commands are documented.

