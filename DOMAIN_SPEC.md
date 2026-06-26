# Domain Modeling Standard

- Version: 1.0
- Scope: bounded contexts, domain naming, capability ownership, cross-module contracts, Java/Rust parity
- Related: `APPLICATION_SPEC.md`, `API_SPEC.md`, `DATABASE_SPEC.md`, `DRIVE_SPEC.md`, `IAM_SPEC.md`, `MODULE_SPEC.md`, `REGION_SPEC.md`

This standard defines how SDKWork domains are named, bounded, and composed. It prevents reusable modules from becoming vague shared utilities and keeps every API, table, SDK namespace, frontend package, event, and permission code aligned to the same business capability.

## 1. Domain Principles

Rules:

- A domain `MUST` represent a business capability, not a product name, team name, database technology, frontend framework, deployment profile, or runtime target.
- A domain `MUST` have one owner, one bounded context description, one canonical prefix, and one public integration contract.
- Canonical names `MUST` be stable across Java/Rust implementations,
  standalone/cloud deployment profiles, OpenAPI, database, SDK, frontend
  packages, events, permissions, and documentation.
- Ambiguous names such as `identity`, `common`, `base`, `core`, `manager`, `misc`, and `system` `MUST NOT` be used as domain names unless the spec explicitly defines the bounded context.
- Product-specific behavior `MAY` extend a standard domain through an extension package, but it must not mutate the shared domain contract.

## 2. Naming Matrix

| Contract Surface | Standard |
| --- | --- |
| Domain key | lowerCamelCase or lower_snake_case depending on surface; semantically identical |
| Database prefix | lower_snake_case, such as `iam_`, `billing_`, `content_` |
| API path segment | lower_snake_case, such as `/iam/users` |
| OpenAPI tag | lowerCamelCase, such as `iam`, `billing`, `content` |
| SDK namespace | lowerCamelCase, such as `client.iam.users` |
| Permission prefix | dotted lowerCamelCase, such as `iam.users.read` |
| Event type prefix | dotted lowerCamelCase, such as `iam.user.created` |
| Frontend package domain | lower kebab-case, such as `sdkwork-iam-core-pc-react` |
| Java package segment | lowercase, such as `com.sdkwork...iam` |
| Rust module | lower_snake_case, such as `iam` |

The same concept must not appear as `identity` in one surface, `user_center` in another, and `iam` in a third. New user, tenant, organization, session, role, permission, policy, and security-event work uses `iam`.

## 3. Standard Domain Catalog

| Domain | Boundary | Examples |
| --- | --- | --- |
| `iam` | Tenant, organization, user, authentication, authorization, policy, security/audit events | users, sessions, roles, permissions |
| `platform` | App registry, platform catalog, feature flags, runtime registration | apps, manifests, environments |
| `system` | Application settings, notifications, help, diagnostics | settings, preferences |
| `drive` | File storage, spaces, nodes, upload sessions, download grants, object storage providers, storage metadata | Drive spaces, nodes, files, folders, upload sessions |
| `content` | Documents, assets, media publishing, editors, content workflows that use Drive for file storage | articles, pages, media publishing |
| `communication` | Conversations, contacts, channels, inboxes, notifications | messages, threads |
| `intelligence` | AI models, prompts, tools, agents, workflows, inference jobs | agents, model catalogs |
| `commerce` | Billing, orders, subscriptions, entitlements, payments | plans, invoices |
| `integration` | External providers, connectors, webhooks, OAuth links, third-party resources | providers, accounts |
| `device` | Desktop/mobile/native host capabilities, local runtime, update distribution | devices, installers |
| `ecosystem` | Plugins, marketplace, extension registry, app store | plugins, packages |

Rules:

- A new domain `MUST` be added to this catalog or an app-local extension catalog before APIs or tables are created.
- A new domain `MUST` declare whether it is shared foundation, application feature, integration adapter, or app-local extension.
- A shared foundation domain `MUST` target Java/Rust contract parity when it
  participates in standalone/cloud deployment profiles or multiple runtime
  targets.
- File storage work uses the `drive` domain and `DRIVE_SPEC.md`. Other domains may reference Drive resources, but they must not take ownership of storage lifecycle.
- Intelligence catalog, vendor-region pricing, and model admin region fields use `REGION_SPEC.md` `regionCode` vocabulary. `catalogKey` must not encode region.

### 3.1 Commerce Capability Tokens

Within domain `commerce`, these capability tokens are canonical and must not be collapsed into `product`:

| Capability | Owns | Example packages or route crates | Must not mean |
| --- | --- | --- | --- |
| `shop` | Shop configuration, brands, categories, shop staff | `@sdkwork/react-backend-shop` | application code or SDKWork repository |
| `catalog` | Public or browsable catalog trees, navigation catalog, open-api catalog surfaces | `sdkwork-routes-catalog-open-api` | i18n message catalog |
| `merchandise` | Sellable-item master data, SKU, attributes, merchandise admin | `sdkwork-commerce-merchandise-service`, `sdkwork-routes-merchandise-app-api`, `@sdkwork/react-backend-merchandise` | application entrypoint crate suffix `product` |

Rules:

- Retired commerce capability token `product` must converge to `merchandise` per `MIGRATION_SPEC.md`.
- `catalog` and `merchandise` are sibling capabilities. Do not use `product` as a catch-all for both.
- `shop`, `catalog`, and `merchandise` remain inside domain `commerce` for API tags, permissions, and database prefixes unless a governance exception splits them.

### 3.2 `platform` Domain Vs Connectivity Plane

Rules:

- Domain `platform` in this file means the **bounded context** for app registry, manifests, and runtime registration.
- Connectivity plane `platform` in `APP_RUNTIME_TOPOLOGY_NAMING.md` means **shared SDKWork ingress** for IAM, Drive, and other foundation APIs.
- Package names, database prefixes, and API tags must use domain `platform` only for the bounded context.
- Topology env keys such as `SDKWORK_<APPLICATION_CODE>_PLATFORM_API_GATEWAY_*` refer to the connectivity plane, not the domain catalog entry.
- Do not name application-line packages `sdkwork-<application-code>-platform-*` when the work belongs to domain `platform`; use domain-owned packages or dependency SDKs instead.

## 4. Bounded Context Record

Every reusable domain `MUST` have a record.

```yaml
domain: iam
status: standard
owner: sdkwork-platform
database_prefix: iam
api_tags:
  - auth
  - iam
sdk_namespaces:
  - auth
  - iam
frontend_packages:
  - sdkwork-iam-core-pc-react
capabilities:
  - tenants
  - organizations
  - users
  - sessions
  - roles
  - permissions
depends_on: []
extends: []
java_parity: required
rust_parity: required
```

Rules:

- The record `MUST` identify owner, prefix, API tags, SDK namespaces, frontend packages, capabilities, dependencies, and parity requirements.
- Domain dependencies `MUST` point inward to more stable domains. `iam` and `platform` should not depend on application feature domains.
- Cyclic domain dependencies are forbidden.

## 5. Model Boundary Rules

Rules:

- Shared models `MUST` be owned by exactly one domain.
- Cross-domain references `MUST` use stable IDs and published read models or APIs, not direct table ownership leakage.
- A domain may expose read projections for other domains, but the projection owner and refresh semantics must be explicit.
- Domain commands `MUST` preserve invariants inside the owning domain.
- Domain events `SHOULD` be emitted for state changes that another domain may consume.
- Domain names in APIs and database tables `MUST` stay aligned unless an explicit compatibility mapping exists.

## 6. Capability Levels

| Level | Meaning | Requirement |
| --- | --- | --- |
| L0 | App-local behavior | May be implemented inside an app package, no shared contract |
| L1 | Reusable module | Public package contract and tests required |
| L2 | Shared domain | API, database, SDK, docs, and contract tests required |
| L3 | Platform foundation | Java/Rust parity, security model, audit, migration, observability required |

IAM, authentication, tenant isolation, organization structure, users, roles, permissions, policies, app manifest, SDK integration, and deployment switching are L3 foundation domains.

## 7. Domain Review Checklist

- [ ] Domain name is canonical and not vague.
- [ ] Domain has owner, boundary, dependencies, and capability list.
- [ ] API path, tag, operationId, SDK namespace, table prefix, event prefix, and permission prefix align.
- [ ] Java/Rust and standalone/cloud parity requirement is explicit.
- [ ] Cross-domain references use stable IDs or published contracts.
- [ ] Extension points are explicit and do not mutate the standard domain.
