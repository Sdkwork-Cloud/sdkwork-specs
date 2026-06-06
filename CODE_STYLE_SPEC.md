# Code Style Standard

- Version: 1.0
- Scope: cross-language code organization, module boundaries, public exports, generated code handling, errors, testing, and review expectations
- Related: `SOUL.md`, `AGENTS_SPEC.md`, `NAMING_SPEC.md`, `RUST_CODE_SPEC.md`, `JAVA_CODE_SPEC.md`, `TYPESCRIPT_CODE_SPEC.md`, `FRONTEND_CODE_SPEC.md`, `MODULE_SPEC.md`, `COMPONENT_SPEC.md`, `TEST_SPEC.md`

This standard defines SDKWork rules that apply to all authored code. Language-specific standards are loaded only when that language is touched.

## 1. Universal Rules

Rules:

- Keep files focused. A file should have one clear reason to change.
- Public entrypoints re-export stable APIs; they must not become dumping grounds for business logic.
- Split by responsibility before files become hard to review: contracts, DTOs, errors, services, repositories, adapters, config, tests, and runtime bootstrap belong in separate modules when they grow independently.
- Generated output must not be hand-edited. Change source contracts, generator inputs, or approved composed facades.
- Business code must not bypass generated SDKs with raw HTTP, manual auth headers, or local DTO forks when an SDK contract exists.
- Runtime config, credentials, tokens, tenant, organization, user, request id, and trace context must flow through approved config or request-context boundaries.
- Avoid broad refactors unless they are required to make the touched behavior correct and maintainable.
- New public names follow `NAMING_SPEC.md`.

## 2. Source Layout Principles

Recommended authored module shape:

```text
src/
  index.*        # public exports only
  contracts/     # public interfaces and stable DTO adapters
  models/        # local domain models
  services/      # use cases and orchestration
  repositories/  # persistence access
  adapters/      # provider, SDK, host, or runtime adapters
  config/        # typed config and bootstrap helpers
  errors/        # typed errors and mapping helpers
  tests/         # colocated test helpers when the language supports it
```

Small modules may collapse folders, but the boundaries must remain visible. Once a file mixes public exports, request decoding, business rules, persistence, provider calls, and tests, it must be split before more behavior is added.

## 3. Public Export Rules

Rules:

- Root public exports must be stable and documented.
- Do not import another package through `/src/...` internals.
- Internal files may be reorganized only when public exports and documented contracts remain compatible.
- UI packages export components/hooks/types; services export functions/classes/ports; SDK facades export generated or composed client surfaces only.

## 4. Error And Result Rules

Rules:

- Domain errors should be typed and mapped at the boundary.
- HTTP errors must preserve RFC 9457 Problem Details rules from `API_SPEC.md`.
- Provider errors must be normalized inside provider adapters.
- Do not leak database, provider, storage, or framework exceptions into API schemas or frontend state.

## 5. Testing Rules

Rules:

- Tests live close to the behavior they verify or in the repository's established test directory.
- Add or update tests when behavior, contracts, validation, authorization, persistence, or generated surfaces change.
- Use fake clients or generated SDK clients at service boundaries.
- Prefer narrow tests first, then run aggregate verification when a shared contract changed.

## 6. Language-Specific Loading

Rules:

- Rust changes load `RUST_CODE_SPEC.md`.
- Java changes load `JAVA_CODE_SPEC.md`.
- TypeScript/JavaScript changes load `TYPESCRIPT_CODE_SPEC.md`.
- Frontend/React/Flutter/UI changes load `FRONTEND_CODE_SPEC.md` and the relevant UI architecture spec.
- Do not load unrelated language specs just because the repository is polyglot.

## 7. Acceptance Checklist

- [ ] Code follows `NAMING_SPEC.md`.
- [ ] Public exports are explicit and stable.
- [ ] Files have focused responsibilities.
- [ ] Generated output was not hand-edited.
- [ ] SDKWork SDK boundaries were not bypassed.
- [ ] Relevant language-specific spec was consulted only when applicable.
- [ ] Tests or documented verification cover the changed behavior.

