# Dual deploy: Vercel + Cloudflare (OpenNext)

Same `client-next` codebase. Platform-specific files do not block each other.

## Account status (via Cloudflare MCP)

| Resource         | Status                                                           |
| ---------------- | ---------------------------------------------------------------- |
| Existing Workers | `school-auth-bff`, `school-tenant-router`, `r2-upload-worker`, … |
| New Worker name  | `school-client` (not deployed yet)                               |
| R2 cache bucket  | **`school-client-next-cache`** (created)                         |

## Vercel (unchanged)

```bash
pnpm run build:client:core
```

Env: Vercel project settings.

## Cloudflare Workers (OpenNext)

```bash
# from repo root (builds shared packages first)
pnpm run build:client:cf
pnpm run preview:client:cf
pnpm run deploy:client:cf
```

Or after deps are built:

```bash
pnpm --filter client-next deploy:cf
```

### Env on Cloudflare

Mirror Vercel vars (Workers → Settings → Variables/Secrets, or Workers Builds → Build variables):

- `NEXT_PUBLIC_BACKEND_URL` / `API_URL` / `BACKEND_URL`
- `NEXT_PUBLIC_DEFAULT_TENANT_HOST`
- `NEXT_PUBLIC_CDN_URL`
- other `NEXT_PUBLIC_*`

### GitHub Actions (recommended on Windows)

Workflow: `.github/workflows/deploy-client-next-cf.yml`

- Triggers: push to `main` (client-next / shared packages) or **workflow_dispatch**
- Runs on **ubuntu-latest** (avoids OpenNext Windows bundler bugs)
- Reuses secrets: `CF_API_TOKEN`, `CF_ACCOUNT_ID`
- Build env secrets:
  - `CLIENT_NEXT_BACKEND_URL` (fallback: `LBP_VITE_BACKEND_URL`)
  - `CLIENT_NEXT_CDN_URL` (fallback: `LBP_VITE_CDN_URL`)
  - `CLIENT_NEXT_DEFAULT_TENANT_HOST` (optional)

After first successful run, Worker **`school-client`** appears in the Cloudflare dashboard (`*.workers.dev`). Attach a custom hostname when ready.

Manual run: GitHub → Actions → **Deploy School Client (Cloudflare)** → Run workflow.

### Local / Workers Builds (optional)

```bash
# from repo root (builds shared packages first)
pnpm run build:client:cf
pnpm run preview:client:cf
pnpm run deploy:client:cf
```

Prefer **WSL2 / Linux** locally — OpenNext warns native Windows builds can fail.

### Watch-outs

- Keep **`middleware.ts`** (Edge). Do **not** use Next 16 `proxy.ts` until your OpenNext version supports Node middleware.
- R2 binding `NEXT_INC_CACHE_R2_BUCKET` → bucket `school-client-next-cache` is wired in `wrangler.jsonc`.
- Dual host: keep `lbphs.gov.bd` on Vercel; add e.g. `cf.lbphs.gov.bd` → Worker until you cut over DNS.
