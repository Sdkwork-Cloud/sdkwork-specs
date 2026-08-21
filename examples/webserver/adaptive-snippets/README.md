# Adaptive Web nginx snippets (other modules)

Authority: `SDKWORK_DEPLOY_SPEC.md` §8, `NGINX_SPEC.md` §7.
For `expose.mode: web|web+api` only. Not used by `sdkwork-webserver`
(`expose.mode: api` → process `[app_roots]`).

Install roots: `RUNTIME_DIRECTORY_SPEC.md` §4.1.1.
Source builds: `APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC.md` §2.1.

| File | Role |
| --- | --- |
| `adaptive-web.maps.conf` | UA / Client-Hint → `pc` \| `h5` |
| `adaptive-web.dispatch.conf` | `location /` → named locations |
| `adaptive-web.named-locations.conf` | `@pc` / `@h5` SPA roots |
| `web.pc.conf` / `web.h5.conf` | Collapse helpers |
| `web.static.conf` | static-fallback |
