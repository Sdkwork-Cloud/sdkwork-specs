# Internationalization Standard

- Version: 1.0
- Scope: user-facing UI text, validation messages, login/register/session flows, generated app copy, locale resources, accessibility text, and componentized reusable UI packages
- Related: `FRONTEND_SPEC.md`, `MODULE_SPEC.md`, `IAM_SPEC.md`, `SECURITY_SPEC.md`, `DOCUMENTATION_SPEC.md`, `TEST_SPEC.md`

This standard defines how SDKWork components handle language, locale, and user-facing copy. It exists so reusable appbase modules can be integrated by product apps without rewriting login, registration, validation, and account UI text.

## 1. Core Rule

Rules:

- User-facing UI text must come from message catalogs, typed translation keys, or injected text providers.
- Reusable modules must not hard-code product-specific copy.
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
- Do not use app names such as `birdcoder`, `claw`, or `magic-studio` inside reusable appbase keys.
- Validation, loading, empty, error, success, tooltip, aria label, and placeholder strings need keys when user-facing.

## 3. Resource Shape

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
- Product apps may override catalogs through module initialization or provider composition.
- Components must use fallback text only as a last line of defense; fallback text must be neutral and product-agnostic.
- Interpolation values must be escaped or rendered safely by the framework.

## 4. Locale Behavior

Rules:

- Locale selection belongs in app runtime/bootstrap, not in reusable components.
- Components must react to locale changes without remounting the whole app shell.
- Locale fallback order should be explicit, for example user preference, tenant preference, app default, `en-US`.
- Date, time, number, currency, and relative time formatting should use locale-aware APIs or approved utilities.
- Layout must tolerate text expansion without overlapping or truncating critical actions.

## 5. Auth And Security Copy

Rules:

- Auth errors should map backend problem details to safe translation keys.
- Invalid password, invalid token, expired session, and insufficient permission messages must not reveal account enumeration hints.
- MFA, QR login, passkey, OAuth, and verification-code flows must internationalize labels, help text, status, retry, and error states.
- Sensitive action confirmation copy must be explicit about tenant, organization, or account scope when applicable.

## 6. Testing

Rules:

- Reusable UI modules should test at least one non-default locale for critical flows.
- Auth forms should verify required labels, validation messages, and submit actions use translation keys or providers.
- Static scans should reject hard-coded product names in shared appbase modules.
- Accessibility names must be localized for icon-only or visually hidden controls.

## 7. Acceptance Checklist

- [ ] User-facing strings in reusable modules are keyed or injected.
- [ ] Login, registration, session, validation, and permission-denied states are localized.
- [ ] No product-specific copy appears in appbase shared modules.
- [ ] Locale fallback behavior is documented.
- [ ] Text expansion does not break responsive layouts.
- [ ] Tests cover translation behavior for critical flows.
