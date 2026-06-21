# Internationalization Standard

- Version: 1.1
- Scope: user-facing UI text, validation messages, login/register/session flows, generated app copy, locale resources, accessibility text, and componentized reusable UI packages
- Related: `FRONTEND_SPEC.md`, `MODULE_SPEC.md`, `IAM_SPEC.md`, `SECURITY_SPEC.md`, `DOCUMENTATION_SPEC.md`, `TEST_SPEC.md`, `NAMING_SPEC.md`, `DOMAIN_SPEC.md`

This standard defines how SDKWork components handle language, locale, and user-facing copy. It exists so reusable appbase modules can be integrated by consuming applications without rewriting login, registration, validation, and account UI text.

## 0. Catalog Terminology

Rules:

- **Message catalog** means translated UI strings owned by a package fragment. Use this phrase in normative text instead of bare **catalog** when the topic is i18n.
- **i18n catalog fragment** is the canonical file/dir unit (`locales/en-US/iam.auth.login.json`, etc.).
- **Catalog manifest** means the generated or configured index that points to fragments (`catalogManifestUrl`, `I18N_CATALOG_MANIFEST_URL`). It is not commerce domain `catalog` capability.
- Commerce **catalog** capability (browse/category trees) follows `DOMAIN_SPEC.md` §3.1 and `NAMING_SPEC.md` §0.2. Do not use commerce `catalog` directory names for locale files.
- **Application-line override** replaces retired **product override**: a consuming application may override fragments for its application line without merging locales into one monolithic file.

## 1. Core Rule

Rules:

- User-facing UI text must come from message catalogs, typed translation keys, or injected text providers.
- Reusable modules must not hard-code application-specific copy.
- Locale resources must be package-owned and split by domain, capability, route/screen, or component state. A client root or reusable package must not keep all messages for one locale in a single large authored file.
- Login, registration, password reset, token validation, tenant selection, permission denial, and session-expired states must be internationalized.
- Localized text must preserve security boundaries: do not expose tokens, stack traces, SQL, provider internals, or raw exception messages.
- Components should support `zh-CN` and `en-US` at minimum when they are used by SDKWork first-party apps.

## 2. Message Keys

Message keys should be stable and scoped:

```text
iam.auth.login.title
iam.auth.login.submit
iam.auth.login.validation.emailRequired
iam.auth.register.validation.passwordPolicy
iam.session.expired.message
iam.permission.denied.message
```

Rules:

- Key scope starts with canonical domain and capability, such as `iam.auth`.
- Keys describe meaning, not the current visual label.
- Key prefixes should align with the owning package and catalog fragment. A fragment that owns `iam.auth.login.*` keys must not also own unrelated `billing.invoice.*` or `admin.audit.*` keys.
- Do not use app names such as `birdcoder`, `claw`, or `magic-studio` inside reusable appbase keys.
- Validation, loading, empty, error, success, tooltip, aria label, and placeholder strings need keys when user-facing.

## 3. Catalog Ownership And Fragmentation

Message catalogs must remain small enough to review, translate, and merge without routine conflicts.

Recommended package-local shape for React and TypeScript packages:

```text
src/
  i18n/
    index.ts              # thin public export or generated aggregation only
    manifest.ts           # optional fragment manifest
    en-US/
      auth/
        login.ts
        register.ts
      session/
        expired.ts
    zh-CN/
      auth/
        login.ts
        register.ts
      session/
        expired.ts
```

Equivalent native or non-TypeScript packages may use platform resource formats, but the same logical split applies: locale -> domain -> capability -> route/screen/state fragment.

Rules:

- Authored locale files `MUST` be split by owning package and by feature fragment. Do not create or grow files such as `en-US.ts`, `zh-CN.ts`, `messages.json`, or `strings.xml` that contain the whole application or whole client root copy.
- `src/i18n/index.*`, `manifest.*`, app bootstrap locale registries, and platform resource aggregators `MUST` remain thin. They may export, register, or import fragments; they must not become the place where feature copy is authored.
- A reusable package owns its own default fragments. Consuming applications may override those fragments during bootstrap or provider composition, but application-line overrides must keep the same fragment boundaries.
- A fragment should normally map to one route/screen, dialog, form, table, or reusable component family. When a fragment starts mixing unrelated workflows, split it before adding more keys.
- Authored catalog files should stay below 200 message keys or 500 lines. Exceeding either threshold requires a new fragment, a documented exception, or an approved generator-owned aggregate.
- Cross-client implementations of the same workflow should reuse stable key names, but each architecture keeps resources in its own package-local i18n boundary unless an approved non-UI i18n contract package is used.
- Generated or build-time merged locale bundles must identify their source fragments and must not be hand-edited.
- If a platform requires monolithic runtime resources, the monolith must be generated from package-local fragments and excluded from hand-authored review except for generated-artifact integrity checks.

## 4. Resource Shape

React packages should expose resources or adapters in a predictable shape:

```ts
export type I18nLocale = "en-US" | "zh-CN" | string;

export interface I18nMessages {
  [key: string]: string;
}

export interface I18nProvider {
  locale: I18nLocale;
  t(key: string, params?: Record<string, string | number>): string;
}
```

Rules:

- Shared modules may ship default catalogs.
- Consuming applications may override catalogs through module initialization or provider composition.
- Components must use fallback text only as a last line of defense; fallback text must be neutral and product-agnostic.
- Interpolation values must be escaped or rendered safely by the framework.
- Catalog fragment exports should use typed objects or generated key unions when the package toolchain supports them.

## 5. Locale Behavior

Rules:

- Locale selection belongs in app runtime/bootstrap, not in reusable components.
- Components must react to locale changes without remounting the whole app shell.
- Locale fallback order should be explicit, for example user preference, tenant preference, app default, `en-US`.
- Locale fallback is resolved by the provider or runtime registry. Individual catalog fragments should not import another locale just to implement fallback.
- Date, time, number, currency, and relative time formatting should use locale-aware APIs or approved utilities.
- Layout must tolerate text expansion without overlapping or truncating critical actions.

## 6. Auth And Security Copy

Rules:

- Auth errors should map backend problem details to safe translation keys.
- Invalid password, invalid token, expired session, and insufficient permission messages must not reveal account enumeration hints.
- MFA, QR login, passkey, OAuth, and verification-code flows must internationalize labels, help text, status, retry, and error states.
- Sensitive action confirmation copy must be explicit about tenant, organization, or account scope when applicable.

## 7. Catalog Loading And Overrides

Catalog loading must support modular ownership without forcing every app to eagerly ship every message.

Rules:

- App bootstrap may compose message fragments from packages, but composition must preserve package/domain/capability ownership in the registry or manifest.
- Lazy route or feature loading may lazy-load the matching i18n fragments. Missing fragments must fail with a stable missing-key behavior in development and safe fallback behavior in production.
- Application-line override files must be colocated by application package, locale, domain, capability, and fragment. Do not maintain one application-wide override file per locale.
- Override precedence must be explicit, for example product override, tenant override when supported, package default, app default fallback.
- Duplicate keys across fragments are allowed only when they intentionally override through declared precedence. Accidental duplicate keys in the same precedence layer must fail static validation.
- Missing required keys for supported locales should fail tests or release preflight for first-party critical flows.

## 8. Testing

Rules:

- Reusable UI modules should test at least one non-default locale for critical flows.
- Auth forms should verify required labels, validation messages, and submit actions use translation keys or providers.
- Static scans should reject hard-coded product names in shared appbase modules.
- Accessibility names must be localized for icon-only or visually hidden controls.
- Static scans should reject authored app-wide locale monoliths and catalog files that exceed the configured key or line threshold without an exception.
- Fragment manifest or aggregation tests should verify every registered fragment has the same required keys for supported locales, unless the missing key is explicitly optional.

## 9. Acceptance Checklist

- [ ] User-facing strings in reusable modules are keyed or injected.
- [ ] Locale resources are split by package, locale, domain, capability, and route/screen/state fragment.
- [ ] App-level and package-level i18n index files are thin exports, registries, or generated aggregators, not authored monolithic catalogs.
- [ ] Login, registration, session, validation, and permission-denied states are localized.
- [ ] No application-specific copy appears in appbase shared modules.
- [ ] Locale fallback behavior is documented.
- [ ] Application-line overrides preserve package-local fragment boundaries.
- [ ] Duplicate keys and missing keys are covered by static validation or tests.
- [ ] Text expansion does not break responsive layouts.
- [ ] Tests cover translation behavior for critical flows.
