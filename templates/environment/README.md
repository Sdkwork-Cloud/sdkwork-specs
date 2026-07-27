# SDKWork Environment Profile Templates

These templates demonstrate the canonical environment profile contract from
`ENVIRONMENT_SPEC.md` section 5.1 and `SOURCE_CONFIG_SPEC.md`.

Use them as shape references only. An application materializer reads concrete
safe values from its own `etc/` authority and generates the framework-specific
files. Do not copy example origins, app ids, tokens, or secrets as live values.

Files:

- `sdkwork.deployment.config.example.json` - eight-profile source index.
- `topology.profile.env.example` - source `etc/topology/<profile-id>.env` shape.
- `vite.env.example` - PC, H5, and uni-app `.env.<profile-id>` shape.
- `flutter.dart-define.example.json` - Flutter
  `env/sdkwork.<profile-id>.json` shape.
- `mini-program.runtime-env.example.json` - native WeChat
  `config/mini-program/runtime-env.<profile-id>.json` shape.
- `native-mobile.runtime-env.example.json` - Android, iOS, and HarmonyOS
  `config/app/runtime-env.<profile-id>.json` shape.

All tracked examples are public/non-secret. Local bootstrap credentials belong
only in ignored `.local` overlays or secure runtime inputs.
