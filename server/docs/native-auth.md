# School codes and native auth

How the Expo app (`apps/dashboard-expo`) finds its school and signs in without cookies, and what
changed on the server for it. The web dashboard's cookie flow is unchanged.

## 1. School access codes

Admins create short codes such as `ABC-7K4Q` (Settings → School Codes in the dashboard,
`/admin/settings/school-codes`). The QR code shows the same bare code.

- Alphabet `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (no 0/O, 1/I/L), `XXX-XXXX`, from
  `crypto.randomInt` (31^7 ≈ 2.75e10 codes). Unique; collisions are retried.
- Each code has a `role_hint` (admin / teacher / student), an optional `expires_at`, and is
  soft-revoked (`revoked_at`). There can be at most 50 active codes per school.
- Admin API (tenant-scoped, `Auth('admin')`, RLS-scoped like every other tenant table):
  - `GET /api/school-codes`
  - `POST /api/school-codes` with `{ role_hint, expires_at? }`
  - `DELETE /api/school-codes/:id` (revoke; idempotent)

### Pre-auth lookup: `POST /api/school-code-lookups` `{ code }`

This is the only endpoint that runs before a tenant is known. It returns public data only:

```json
{
  "school": { "name": "…", "shortName": "…", "logo": "…" },
  "tenant": {
    "host": "lbp-dashboard.mutiurrahman.com",
    "apiBaseUrl": "https://lbp-dashboard.mutiurrahman.com"
  },
  "roleHint": "teacher"
}
```

Security design:

- **Narrow cross-tenant read.** `school_app` keeps NOBYPASSRLS and gets no new table
  privileges. The handler's only query is `app.lookup_school_access_code(code)`. That is a
  `SECURITY DEFINER` SQL function with a pinned `search_path` (`pg_catalog, pg_temp`) and
  fully qualified names. It matches one exact, active code (not revoked, not expired) and
  returns six public columns. `EXECUTE` is revoked from PUBLIC and granted to `school_app`
  only. It cannot list or enumerate codes, and it returns no ids, `created_by` or timestamps.
- **Owner requirement.** The function reads through RLS as its owner, which is the role that
  runs the migration. In this repo that role is the bootstrap superuser
  (`docker/postgres/init/10-harden-runtime-role.sh`). If the migration ever runs as a role
  without BYPASSRLS, the function fails closed: it returns no rows, so every lookup 404s.
- **Routing.** `server/src/app.ts` lists the exact `POST /api/school-code-lookups` in
  `PRE_TENANT_ROUTES`. Only that method and path skip `schoolContextMiddleware` and
  `requireSchoolContext`; everything else still needs a host-resolved tenant.
- **No enumeration hints.** Unknown, malformed, revoked and expired codes all return the
  same `404 School code not found`.
- **Rate limit.** `LookupThrottleGuard` applies 10 lookups per IP per 15 minutes on top of the
  global limiter. It uses express-rate-limit with the shared Redis (`rl:school-code-lookup:`);
  without Redis it falls back to memory. When the limit is hit it returns 429.
- **The host is derived, never stored.** `tenant.host` is the school's custom domain, else
  `<subdomain>` + `TENANT_HOST_SUFFIX`. That is the same host the tenant middleware resolves
  back to the school, so the client never sends a school id. The app checks that
  `apiBaseUrl` uses https (outside local dev), is on exactly `tenant.host`, and has no path.

## 2. Tokens

|        | Access                        | Refresh                                           |
| ------ | ----------------------------- | ------------------------------------------------- |
| Secret | `JWT_SECRET`                  | `JWT_SECRET` (the `typ` claim separates the two)  |
| Claims | `id, role, typ:'access', sch` | `id, role, version, typ:'refresh', fam, sch, jti` |
| TTL    | 15 min (1 min in development) | 7 days                                            |

- `verifyAccessToken` rejects refresh tokens, so a refresh token can never be used as a
  bearer token. `getTokenRole` (RLS super-admin context) only trusts access tokens.
- `sch` is the issuing school (`null` for super_admin). The auth middleware returns
  `403 Tenant context mismatch` when a token from school A is used on school B's host. The
  existing `school_id` check on the user row still applies too.
- **Rotation and reuse detection** use the `auth_sessions` table, one row per refresh token
  `jti`, grouped by family:
  - Every refresh claims its row atomically (`replaced_by IS NULL`), issues a new `jti`, and
    issues a new access token.
  - Presenting an already-rotated token more than 30 s later revokes the whole family. The
    30 s grace covers two tabs or a retried request; inside it the request gets 401 but the
    family survives.
  - Logout revokes the family and bumps `tokenVersion` as before.
- **Legacy tokens** (signed before this change, no `typ`):
  - Access tokens stay valid until they expire (at most 15 min).
  - A legacy web refresh cookie is accepted once and upgraded into a new family. Native
    clients never had one, so they are refused.
  - The legacy branch can be removed 7 days after rollout.

## 3. Web vs native transport

|                          | Web (default)                                                  | Native (`X-Client: native`)                      |
| ------------------------ | -------------------------------------------------------------- | ------------------------------------------------ |
| Login / refresh response | `{ accessToken, user }` plus an HttpOnly `refreshToken` cookie | `{ accessToken, refreshToken, user }`, no cookie |
| Refresh / logout request | cookie                                                         | `{ "refreshToken": "…" }` in the body            |
| Storage                  | browser cookie jar                                             | SecureStore, namespaced per school               |

`X-Client: native` is validated server-side (`authClientOf`):

- A request that also carries `Sec-Fetch-Site` / `Sec-Fetch-Mode` is a browser, so it gets
  `400 Unsupported client`.
- `X-Client` is deliberately not in the CORS `allowedHeaders`, so a cross-origin page cannot
  send it at all.
- Any other value is refused.

A page script therefore cannot opt into receiving the refresh token in a response body.

### Edge workers (`workers/auth-bff`, `workers/tenant-router`)

`tryHandleAuthSession` (`workers/shared/auth-proxy.js`) handles web requests the same way as
before:

- It moves `refreshToken` from login/refresh JSON bodies into a `refresh_token` cookie
  (`Path=/api/auth/sessions/refresh`).
- It sends that cookie upstream as `refreshToken=` on refresh.
- It maps a refresh 401 to `{ success: false }`.

For native requests (`isNativeClientRequest`: `X-Client: native` and no `Sec-Fetch-*`) it now
returns `null`, so the request is proxied untouched and the body token reaches the app. The
workers must be deployed for native sign-in through the edge.
`workers/shared/auth-proxy.test.mjs` covers both paths.

## 4. Environment

| Variable                    | Where    | Notes                                                                                                                                              |
| --------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TENANT_HOST_SUFFIX`        | server   | Optional. Host suffix for subdomain schools in lookup results. Defaults to `-dashboard.mutiurrahman.com` in production and `.localhost` otherwise. |
| `EXPO_PUBLIC_DIRECTORY_URL` | Expo app | Origin that answers the lookup before a school is chosen. It must reach the server without tenant resolution.                                      |
| `EXPO_PUBLIC_API_BASE_URL`  | Expo app | Optional. Pins a build to one school; school codes are then not used.                                                                              |

## 5. Rollout order

1. **Migration first:** `20261018120000_school_access_codes_auth_sessions`. It is additive:
   two new tables, RLS, one function. Old code ignores it.
2. **Server.** Existing sessions keep working (see legacy tokens).
3. **Workers** (`auth-bff`, `tenant-router`) for native pass-through. Web behavior is
   identical before and after.
4. **Dashboard** (School Codes page), then app builds.

Rotating `JWT_SECRET` signs everyone out at their next refresh.

## 6. Tests

- Unit tests run in CI and need no DB: `auth-tokens.spec.ts`, `auth-sessions.spec.ts`,
  `school-code.util.spec.ts`, `dto/school-codes.dto.spec.ts`,
  `school-codes.service.spec.ts` and `lookup-throttle.guard.spec.ts`.
- Real-DB specs are excluded in CI by `--testPathIgnorePatterns http.spec`:
  - `native-auth.http.spec.ts` covers response shapes, token types, rotation and reuse, and
    cross-tenant isolation.
  - `school-codes.http.spec.ts` covers resolve valid/revoked/expired, the rate limit and the
    admin API.
  - Run them against a throwaway local database that has every migration applied and is
    connected as the non-bypass `school_app` role, plus a local Redis:

```bash
DATABASE_URL=postgresql://school_app:…@127.0.0.1:55432/school_test \
JWT_SECRET=local-test-jwt-secret ENCRYPTION_KEY=$(printf '0%.0s' {1..64}) NODE_ENV=test \
pnpm test:nest native-auth.http school-codes.http
```

Never point these at a shared, staging or production database: they create and delete
fixture schools.

## 7. Running locally

Everything below is local only: never point it at a shared database.

1. **Postgres and Redis.**
   - Use `server/postgres-run.yml` and `server/redis-run.yml`, or any local Postgres 15+ and
     Redis.
   - The runtime role must be a non-superuser with NOBYPASSRLS (`school_app`, as in
     `docker/postgres/init/10-harden-runtime-role.sh`), so RLS is enforced the way it is in
     production.
2. **`server/.env`** (git-ignored). Generate secrets with `openssl rand -hex 32`:

   ```env
   NODE_ENV=development            # access tokens live 1 minute here: refresh is exercised
   PORT=5000
   DATABASE_URL=postgresql://school_app:<pw>@127.0.0.1:5432/school_dev   # runtime, RLS enforced
   DIRECT_URL=postgresql://postgres:<pw>@127.0.0.1:5432/school_dev       # migrations (superuser)
   JWT_SECRET=<random>
   ENCRYPTION_KEY=<64 hex chars>
   REDIS_HOST=127.0.0.1
   TENANT_HOST_SUFFIX=.localhost   # school "alpha" -> alpha.localhost
   ```

3. **Migrate and seed.**
   - From `server/`, run `pnpm db:migrate`. `prisma.config.ts` uses `DIRECT_URL`, so
     migrations run as the owner and the lookup function is owned by a BYPASSRLS role.
   - Then apply the `school_app` grants from the hardening script.
   - Then run `pnpm db:seed`. It only adds categories for existing schools, so create the
     schools first: each with a `subdomain`, an active `school_subscriptions` row, an admin,
     a teacher, and students with 2026 enrollments.
4. **Run the stack.**

   | Process   | Command                                                                                                                                         | URL                                       |
   | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
   | Server    | `pnpm dev` in `server/`                                                                                                                         | <http://localhost:5000>                   |
   | auth-bff  | `pnpm exec wrangler dev --port 8787`, with `.dev.vars` `BACKEND_URL=http://127.0.0.1:5000`                                                      | <http://127.0.0.1:8787>                   |
   | Dashboard | `pnpm exec vite --mode admin --port 5174`. It proxies `/api` to auth-bff on 8787.                                                               | <http://alpha.localhost:5174/admin/login> |
   | Expo web  | `npx expo start --web`, with `apps/dashboard-expo/.env.local` `EXPO_PUBLIC_APP_ENV=local` and `EXPO_PUBLIC_DIRECTORY_URL=http://localhost:5000` | <http://localhost:8081/join>              |
   - Expo web runs on a bare `localhost`, which is not a school host. In local mode the app
     names the school with `x-tenant-host`, and outside production the server ignores a bare
     localhost Origin so that header applies.
   - `tenant-router` has no local equivalent: its routes match the production
     `*-dashboard.mutiurrahman.com` hosts.
   - Expo SDK 57 dev builds read `EXPO_PUBLIC_*` from the `.env*` files, not from the shell.

5. **Tests against the seeded DB.**
   - Clone the dev DB first (`CREATE DATABASE school_jest TEMPLATE school_dev`), then run
     `DATABASE_URL=…/school_jest NODE_ENV=test pnpm test:nest`.
   - Stop `pnpm dev` while jest runs: tests write logs under `src/logs`, and the dev
     watcher restarts on every write.
