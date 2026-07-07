# Java Code Standard

- Version: 1.0
- Scope: Java 21, Spring services, Maven modules, Java SDKs, Java backend implementation, and Java tests
- Related: `CODE_STYLE_SPEC.md`, `NAMING_SPEC.md`, `APPLICATION_LAYERED_ARCHITECTURE_SPEC.md`, `API_SPEC.md`, `WEB_BACKEND_SPEC.md`, `DATABASE_SPEC.md`, `I18N_SPEC.md`, `SECURITY_SPEC.md`, `TEST_SPEC.md`

This standard applies only when Java source, Maven configuration, Spring backend code, or Java SDK code is touched. Java backend package boundaries implement the L0-L6 profile from `APPLICATION_LAYERED_ARCHITECTURE_SPEC.md`.

## 1. Baseline

Rules:

- Java code targets Java 21 unless a repository-specific spec narrows the runtime.
- Source encoding is UTF-8.
- Maven modules must keep parent and module relationships explicit in `pom.xml`.
- Package names use `com.sdkwork.<domain>...` or the repository's approved SDKWork package root.
- Generated Java SDK output must not be hand-edited.

## 2. Package Structure

Recommended service module shape:

```text
src/main/java/com/sdkwork/<domain>/<capability>/
  api/          # controllers, request/response mapping
  application/  # use cases and services
  domain/       # domain models, policies, value objects
  repository/   # migration-compatible persistence ports and implementations
  infrastructure/persistence/ # preferred concrete persistence adapters for new modules
  adapter/      # provider or SDK adapters
  config/       # Spring configuration
  error/        # domain errors and exception mapping
  dto/          # internal DTOs when distinct from OpenAPI schemas
src/main/resources/i18n/<locale>/<domain>/<capability>/
  <bundle>.properties
```

Rules:

- Controllers are thin. They decode requests, call services, and map responses/errors.
- Services own business rules and transaction orchestration.
- Repositories own persistence queries and schema mapping.
- Provider clients and raw HTTP, when approved, stay inside adapters.
- DTOs used by SDK-generated operations must match OpenAPI schemas.
- Modules that own user-facing or operator-facing backend message resources `MUST` keep authored bundles under `src/main/resources/i18n/<locale>/<domain>/<capability>/` per `I18N_SPEC.md` section 6.1. Spring `MessageSource` configuration and generated validation bundles are thin framework adapters, not authored app-wide message catalogs.

## 3. Spring Boundaries

Rules:

- Do not put business logic in controllers.
- Do not put HTTP concerns in repositories.
- Controllers must not import repository, persistence, or infrastructure implementation packages directly.
- Use typed request context for tenant, user, organization, permissions, request id, and trace context.
- Transactions belong at service/use-case boundaries, not controllers.
- Validation annotations may tighten OpenAPI only when the contract documents the same constraints.
- `Map<String, Object>` and untyped JSON are forbidden for SDK-generated operations unless OpenAPI explicitly declares flexible objects.

## 4. Naming

Rules:

- Classes use PascalCase.
- Methods and fields use camelCase.
- Constants use UPPER_SNAKE_CASE.
- Controllers should end with `Controller`.
- Services should end with `Service` or name a use case.
- Repositories should end with `Repository`.
- Configuration classes should end with `Configuration`.
- Test classes should end with `Test` or `IT` according to repository convention.

## 5. Verification

Rules:

- Run the narrowest Maven test for touched modules first.
- Run `mvn test` or the repository wrapper when shared contracts change.
- Run `node ../sdkwork-specs/tools/check-application-layering.mjs --root .` when controller, service, repository, infrastructure, or frontend/service SDK injection boundaries are touched.
- API changes must prove OpenAPI and generated SDK compatibility.
- Persistence changes must include migration/schema verification from `DATABASE_SPEC.md`.
- Security-sensitive changes must cover negative authorization and tenant cases.

## 6. Acceptance Checklist

- [ ] Java 21 and UTF-8 expectations are preserved.
- [ ] Controller, service, repository, adapter, and config responsibilities are separated.
- [ ] Controllers do not import repositories/infrastructure directly, transactions stay in services, and repositories do not import HTTP framework types.
- [ ] Authored Java/Spring backend message resources, when present, live under `src/main/resources/i18n/<locale>/<domain>/<capability>/` and not in backend-wide `MessageSource` monoliths.
- [ ] OpenAPI DTOs and validation stay aligned.
- [ ] Generated Java SDK output was not hand-edited.
- [ ] Maven verification commands are documented.
