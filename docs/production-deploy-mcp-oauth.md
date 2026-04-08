# Production Deployment: MCP OAuth Provider

This document covers the server-side changes required when deploying the MCP OAuth feature to production.

## 1. Nginx Configuration

### Problem
The default BT Panel nginx config includes `location ~ \.well-known { allow all; }` which serves `.well-known` paths as static files from disk. Since the OAuth discovery files are Next.js route handlers (not static files), they return 404.

### Fix
Comment out the static `.well-known` block so requests fall through to the existing proxy rules (which forward to Next.js on port 3333):

```nginx
# location ~ \.well-known{
#     allow all;
# }
```

> **SSL cert renewal is not affected.** ACME challenges are already handled by the panel-managed include at the top of the config:
> ```nginx
> include /www/server/panel/vhost/nginx/well-known/<domain>.conf;
> ```

### Add X-Forwarded-Proto header
Ensure the proxy block passes the protocol so Next.js route handlers return `https://` URLs in OAuth metadata:

```nginx
proxy_set_header X-Forwarded-Proto $scheme;
```

Add this alongside the existing `proxy_set_header Host` and `proxy_set_header X-Real-IP` lines in the proxy include file.

### Reload nginx
```bash
nginx -t && nginx -s reload
```

---

## 2. Verify Discovery Endpoints

After deploy and nginx reload, confirm both endpoints return 200 with `https://` base URLs:

```bash
curl https://<domain>/.well-known/oauth-authorization-server
curl https://<domain>/.well-known/oauth-protected-resource
```

Expected: JSON responses with `issuer`, `authorization_endpoint`, `token_endpoint`, etc. — all using `https://`.

Also confirm the MCP endpoint returns the `WWW-Authenticate` header on 401:

```bash
curl -i https://<domain>/api/mcp
# Expected header:
# www-authenticate: Bearer resource_metadata="https://<domain>/.well-known/oauth-protected-resource"
```

---

## 3. Environment Variables

Ensure `NEXT_PUBLIC_SERVER_URL` is set to the production URL (with `https://`):

```env
NEXT_PUBLIC_SERVER_URL=https://pika.elabins.com
```

This is used by the well-known route handlers to construct the `issuer`, `authorization_endpoint`, and `resource` fields. An incorrect value here will cause MCP clients to fail discovery.

---

## 4. New Routes Added (no action needed)

These Next.js route handlers are part of the codebase and require no manual setup beyond deploying the code:

| Route | Purpose |
|---|---|
| `GET /.well-known/oauth-authorization-server` | RFC 8414 — OAuth server metadata |
| `GET /.well-known/oauth-protected-resource` | RFC 9728 — MCP resource metadata |
| `GET /api/oauth/authorize` | Validate client + redirect to consent page |
| `POST /api/oauth/authorize` | User approved consent — create API key + issue code |
| `POST /api/oauth/token` | Exchange auth code for access token |
| `GET /api/auth/client-init` | Initiate OAuth for any custom-scheme client (mobile, CLI) |
| `POST /api/auth/exchange` | Exchange HMAC-signed one-time code for JWT (mobile auth) |

---

## 5. Database Migration

The `oauth-codes` collection is new. Run Payload migrations after deploying:

```bash
npx payload migrate
```

Or if using the auto-run migration setting, it will apply on first boot.
