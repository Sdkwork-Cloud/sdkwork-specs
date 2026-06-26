# NGINX Reverse Proxy Standard

- Version: 1.0
- Scope: SDKWork public reverse proxy deployment, generated nginx site files, TLS certificate paths, and release host handoff
- Related: `DEPLOYMENT_SPEC.md`, `ENVIRONMENT_SPEC.md`, `SECURITY_SPEC.md`, `OBSERVABILITY_SPEC.md`

SDKWork nginx deployment must keep public-domain routing reproducible across Linux servers and local operator workstations. Generated files are deployable artifacts, not handwritten one-off snippets.

## 1. Site File Path Contract

The canonical Linux deployment path is:

```text
/etc/nginx/sites-enabled/sdkwork/<domain>.conf
```

`<domain>` is the complete public hostname and is always the file name stem. It is not a directory.

Examples:

```text
/etc/nginx/sites-enabled/sdkwork/api.sdkwork.com.conf
/etc/nginx/sites-enabled/sdkwork/www.sdkwork.com.conf
```

Rules:

- The site-family directory is `sdkwork` unless an operator explicitly chooses another safe directory name.
- The deployed nginx file name must be the full domain plus `.conf`.
- Do not deploy `domain/api.sdkwork.com.conf`, `api.conf`, or `sdkwork.com.conf` for an `api.sdkwork.com` virtual host.
- Generated config comments must include the domain, site family, canonical deploy path, upstream, and certificate root.

The canonical repository template is:

```text
apps/sdkwork-clawrouter/etc/nginx/NGINX_SAMPLE.conf
```

`API_SAMPLE.conf` is retained only as a compatibility sample for older references. New documentation and operator handoff must point to `etc/nginx/NGINX_SAMPLE.conf` or to generated full-domain examples under `etc/nginx/sdkwork/`.

## 2. Upstream Contract

Release deployments proxy to the packaged Rust edge server:

```text
http://127.0.0.1:3900
```

Rules:

- The old sample upstream `http://127.0.0.1:8080` is obsolete.
- The edge server owns the portal, OpenAI-compatible gateway API, backend/admin API, app API, OpenAPI documents, `/healthz`, and `/readyz`.
- The proxy must preserve `Host`, real client IP, `X-Forwarded-*`, and websocket upgrade headers.
- Streaming and generation routes must not be broken by proxy buffering; generated configs set `proxy_buffering off` and use long read/send timeouts.
- `client_max_body_size` must not be lower than the Claw Router upload body limits. The default generated value is `1100m`.

## 3. Certificate Path Contract

Certificates use a stable root and a certificate name directory:

```text
/opt/certs/letsencrypt/live/<cert-name>/fullchain.pem
/opt/certs/letsencrypt/live/<cert-name>/privkey.pem
```

For `api.sdkwork.com` and `www.sdkwork.com`, the default certificate name is `sdkwork.com`:

```text
/opt/certs/letsencrypt/live/sdkwork.com/fullchain.pem
/opt/certs/letsencrypt/live/sdkwork.com/privkey.pem
```

Rules:

- Operators may override the certificate name with `--cert-name`.
- Operators may override the certificate root with `--cert-root`.
- The certificate name is a directory name, not an arbitrary path.
- TLS configs should enable `TLSv1.2` and `TLSv1.3`; legacy `TLSv1.1`, `TLSv1`, and broad legacy ciphers are not allowed in new generated configs.

## 4. Generated Command Contract

The Claw Router workspace exposes these pnpm commands:

```sh
pnpm nginx:plan -- --domain api.sdkwork.com
pnpm nginx:render -- --domain api.sdkwork.com --output-root target/nginx
sudo pnpm nginx:deploy -- --domain api.sdkwork.com --cert-name sdkwork.com
```

Command behavior:

- `nginx:plan` prints the canonical path, output path, upstream, certificate files, reload commands, and rendered config without writing files.
- `nginx:render` writes a local staging file. On Windows and macOS, the default staging path is `target/nginx/sites-enabled/sdkwork/<domain>.conf`.
- `nginx:deploy` writes the selected output file. On Linux with no `--output` or `--output-root`, it writes the canonical `/etc/nginx/sites-enabled/sdkwork/<domain>.conf` path.
- `--output <path>` writes one exact file.
- `--output-root <path>` writes `sites-enabled/sdkwork/<domain>.conf` under the given local root.
- `--platform linux|windows|macos` lets operators produce a platform-specific plan from any workstation.

After deploy, operators validate and reload nginx explicitly:

```sh
sudo nginx -t
sudo systemctl reload nginx
```

## 5. Ubuntu Release Build, Install, Start, And Proxy

Build from a source checkout:

```sh
pnpm release:env:write -- --check
pnpm release:env:write -- --force
pnpm build
pnpm install:package:build -- --package-id linux-x64-service
```

Install and start on Ubuntu:

```sh
sudo apt install ./clawrouter-linux-x64-server-0.3.0.deb
sudo editor /etc/sdkwork/router/clawrouter.toml
sudo editor /etc/sdkwork/router/database.secret
sudo systemctl start clawrouter
curl http://127.0.0.1:3900/healthz
curl http://127.0.0.1:3900/readyz
```

Deploy nginx for an API domain:

```sh
sudo pnpm nginx:deploy -- --domain api.sdkwork.com --cert-name sdkwork.com
sudo nginx -t
sudo systemctl reload nginx
curl https://api.sdkwork.com/healthz
curl https://api.sdkwork.com/readyz
```

Deploy nginx for a web domain:

```sh
sudo pnpm nginx:deploy -- --domain www.sdkwork.com --site-type web --cert-name sdkwork.com
sudo nginx -t
sudo systemctl reload nginx
```

## 6. Cross-Platform Operator Flow

Linux production host:

```sh
sudo pnpm nginx:deploy -- --domain api.sdkwork.com --cert-name sdkwork.com
sudo nginx -t
sudo systemctl reload nginx
```

Windows workstation staging:

```powershell
pnpm nginx:render -- --platform windows --domain api.sdkwork.com --output-root target/nginx
```

macOS workstation staging:

```sh
pnpm nginx:render -- --platform macos --domain api.sdkwork.com --output-root target/nginx
```

Windows or macOS hosts with a local nginx install must pass an explicit `--output-root` or `--output` matching their nginx config layout. The rendered nginx content still uses Linux-style certificate paths when that config will be copied to a Linux host.

## 7. Acceptance Checklist

- [ ] The deployed file path is `/etc/nginx/sites-enabled/sdkwork/<domain>.conf`.
- [ ] The file name is the complete public domain plus `.conf`.
- [ ] The upstream is `http://127.0.0.1:3900`.
- [ ] TLS certificate paths use `/opt/certs/letsencrypt/live/<cert-name>`.
- [ ] Configs preserve forwarded headers and streaming behavior.
- [ ] `nginx -t` passes before reload.
- [ ] `/healthz` and `/readyz` pass through the public domain after reload.
