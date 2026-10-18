# dashboard-expo

Foundation for the new School dashboard: **Expo SDK 57 + React Native 0.86 + React Native Web +
Expo Router + strict TypeScript**, targeting web, Android and iOS from one codebase.

The existing Vite dashboard (`../../dashboard`) stays in production until this app reaches parity.
The backend (`../../server`) and the public site (`../../client-next`) are untouched.

> Status: shell, API client and tenant-branding foundation only. Every number on the Overview
> and Students screens is **MOCK DATA** and labelled as such. There is no login screen yet.

## Quick start

```bash
# from the repo root (pnpm 12, Node >= 22.13, same as CI)
pnpm install
cp dashboard-expo/.env.example dashboard-expo/.env.local   # optional, see "Environments"

pnpm --filter dashboard-expo web        # dev server, web
pnpm --filter dashboard-expo android    # needs an emulator/device + a dev build (expo-dev-client)
pnpm --filter dashboard-expo ios        # macOS only
```

| Script                      | What it does                                                 |
| --------------------------- | ------------------------------------------------------------ |
| `typecheck`                 | `tsc --noEmit` for the app and for the unit tests            |
| `lint`                      | Repo ESLint config (`../../eslint.config.js`) on this folder |
| `test`                      | Node test runner + tsx, API client / tenant / storage units  |
| `build:web`                 | `expo export --platform web` -> `dist/web` (static SPA)      |
| `export:android` / `:ios`   | Hermes JS bundle export, no native build                     |
| `doctor`                    | `expo-doctor`                                                |
| root `check:dashboard-expo` | Lint + Prettier + typecheck, same pattern as other CI scopes |

There is intentionally no `build` script, so the root `turbo run build` and existing CI jobs are
unchanged.

## Layout

```
app/                      Expo Router routes
  _layout.tsx             providers: SafeArea -> QueryClient -> Api/session -> Tenant -> Theme
  (dashboard)/_layout.tsx AppShell (navbar + sidebar, or navbar + bottom tabs)
  (dashboard)/index.tsx   Admin Dashboard overview (MOCK DATA)
  (dashboard)/students.tsx Student List (MOCK DATA)
  (dashboard)/settings.tsx System status, Expo-only (real config, tenant, session, API probe)
  (dashboard)/attendance.tsx, results.tsx, soon/[id].tsx  "not built yet" placeholders
src/config                EXPO_PUBLIC_* parsing and validation
src/lib/api               fetch client, envelopes, errors, auth contracts, session manager
src/lib/storage           platform key-value + session persistence (*.web.ts for web)
src/tenant                tenant resolution, branding mapping, tenant-scoped query keys
src/session               ApiProvider (client + SessionManager per tenant), useSession
src/theme                 design tokens ported from dashboard/src/index.css + ThemeProvider
src/navigation            admin menu mirrored from dashboard/src/components/Sidebar.tsx
src/components/{ui,layout} shadcn-style primitives, lucide icons and the responsive shell
```

Responsive behaviour (`src/hooks/useBreakpoint.ts`), mirroring the web dashboard's `md:` split:

| Width    | Navigation                                                                                                | Navbar                                         |
| -------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| >= 768px | Persistent 250px sidebar, same sections/groups/order as the web                                           | "Admin" + active school, Power -> popover menu |
| < 768px  | Bottom tabs (Dashboard, Students, Attendance, Results, More); "More" opens the full admin menu in a sheet | "Admin", Power -> bottom sheet                 |

Page padding (16/24/32px at `sm`/`lg`) and grids (`lg:grid-cols-3/2`) follow the web pages.
Previews: `/?state=loading|error|empty` and `/students?state=loading|empty|error`.

## Design system (ported from `dashboard/`)

The web dashboard is the design reference; this app replicates it. Values come from its source,
not from screenshots. Colour hexes for Tailwind palette classes were converted from the oklch
values in the installed `tailwindcss@4.3.3/theme.css`.

| Web dashboard source                                                | Expo equivalent                                      | What was ported                                                                                                  |
| ------------------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `src/index.css` `:root`                                             | `src/theme/tokens.ts` `lightColors`                  | All shadcn CSS variables (background, primary, muted, border, sidebar-_, chart-_...)                             |
| `src/index.css` `.dark`                                             | `src/theme/tokens.ts` `darkColors`                   | Ported but **not enabled** (the web theme switch is commented out in `index.html`/`main.tsx`)                    |
| `src/index.css` `--radius: 0.66rem` + `@theme inline`               | `radii` (sm/md/lg/xl)                                | 6.56 / 8.56 / 10.56 / 14.56 px                                                                                   |
| `src/index.css` `MixedFont` (Outfit + SolaimanLipi)                 | `fontFamilies` + `useFonts` in `app/_layout.tsx`     | Outfit 400/500/600/700 via `@expo-google-fonts/outfit` (TTF, works on native)                                    |
| Tailwind v4 `theme.css` (text scale, tracking, shadows)             | `fontSizes`, `trackingWider`, `shadows`              | text-xs...2xl sizes/line-heights, `tracking-wider`, `shadow-xs/sm`                                               |
| `components.json` (`iconLibrary: lucide`)                           | `src/components/ui/icons.ts` (lucide-react-native)   | Same icons, same names as the web imports (per-icon deep imports)                                                |
| `src/App.tsx` (layout shell)                                        | `src/components/layout/AppShell.tsx`                 | Navbar on top, 250px sidebar below at >= 768px                                                                   |
| `src/components/Navbar.tsx`                                         | `src/components/layout/Navbar.tsx`, `UserMenu.tsx`   | 56px bar, `bg-sidebar border-b`, "Admin" title, Power button                                                     |
| `src/components/Sidebar.tsx` (`adminRoutes`)                        | `src/navigation/nav-items.ts`, `layout/Sidebar.tsx`  | Labels, order, sections, dropdown groups, icons, active/hover/open styles, child-list rail                       |
| `src/pages/Admin/Dashboard.tsx`                                     | `app/(dashboard)/index.tsx`                          | Header + quick actions, KPI strip, Attendance chart + range toggle, Exams, notices, events, skeleton, error card |
| `src/pages/Admin/StudentList.tsx`                                   | `app/(dashboard)/students.tsx`                       | Title + Session select, summary, More/Add student, table header/rows, avatar, inactive badge                     |
| `src/components/SectionCard.tsx`                                    | `src/components/ui/SectionCard.tsx`                  | Card, header/body padding, title style, header-action wrap below `sm`                                            |
| `src/components/PageHeader.tsx`                                     | `src/components/layout/PageLayout.tsx`               | `text-2xl font-bold` title, muted description, actions; `max-w-7xl p-4 sm:p-6 lg:p-8`                            |
| `src/components/ui/button.tsx`                                      | `src/components/ui/Button.tsx`                       | default/destructive/outline/secondary/ghost/link x default/sm/lg/icon                                            |
| `src/components/ui/badge.tsx`, `StatusBadge.tsx`                    | `src/components/ui/Badge.tsx`                        | Badge variants, StatusBadge colours + icons, exam status chips                                                   |
| `src/components/ActionButton.tsx`                                   | `src/components/ui/ActionButton.tsx`                 | Quiet icon-only row actions, colour on hover                                                                     |
| `src/components/ui/input.tsx`                                       | `src/components/ui/Input.tsx`                        | `rounded-lg border px-3 py-2 text-sm`, focus ring                                                                |
| `src/components/ui/skeleton.tsx`, `Loading.tsx`, `ErrorMessage.tsx` | `src/components/ui/states.tsx`                       | Pulse skeleton, Loader2 spinner, empty line, error card, block error                                             |
| recharts `LineChart` in `Dashboard.tsx`                             | `src/components/ui/LineChart.tsx` (react-native-svg) | Grid, axis labels, 5 nice ticks, monotone lines; no tooltip yet                                                  |

Deliberate differences: phones use bottom tabs + a "More" sheet instead of the burger drawer;
the navbar shows the active school (tenant branding); System status is an Expo-only page;
Student List has a search box instead of per-column filter/sort menus (not ported yet).

### Styling approach

Plain `StyleSheet` + the ported tokens is enough to match the shadcn look today, and no styling
library was added. Recommendation for later: if the team wants to share class names with the web
dashboard (copying Tailwind classes from `dashboard/` as screens move), adopt **NativeWind v5**
(Tailwind v4 compatible), loading the same CSS variables, rather than Tamagui, whose token and
variant model would mean re-describing the shadcn components a second time. Decide that before
porting many more screens; the tokens file maps 1:1 onto a Tailwind theme either way.

## Environments

All runtime config is public (`EXPO_PUBLIC_*` is inlined into the bundle). **Never put secrets
in these variables or in `eas.json`.** See `.env.example`.

| Variable                      | Purpose                                                                          |
| ----------------------------- | -------------------------------------------------------------------------------- |
| `EXPO_PUBLIC_APP_ENV`         | `local` / `staging` / `production`                                               |
| `EXPO_PUBLIC_API_BASE_URL`    | API origin without `/api`. Empty on web = same origin. Required on native.       |
| `EXPO_PUBLIC_CDN_URL`         | Public CDN for R2 keys (logo etc.), mirrors `VITE_CDN_URL`                       |
| `EXPO_PUBLIC_DEV_TENANT_HOST` | Local only: sent as `x-tenant-host` (backend honours it only outside production) |

`APP_ENV` (build time, `app.config.ts`) selects the app name, bundle id suffix (`.dev`,
`.staging`) and URL scheme. `eas.json` sets it per profile:

| EAS profile   | Channel       | APP_ENV      | Distribution           |
| ------------- | ------------- | ------------ | ---------------------- |
| `development` | `development` | `local`      | internal, dev client   |
| `preview`     | `staging`     | `staging`    | internal (Android APK) |
| `production`  | `production`  | `production` | store                  |

`runtimeVersion` uses the `fingerprint` policy. **Nothing is published from this repo yet**:
`expo-updates` is not installed and there is no EAS project id. Before the first EAS build:
`eas init`, confirm the bundle identifier (`com.mutiurrahman.schooldashboard` is a placeholder),
and set `EXPO_PUBLIC_API_BASE_URL` per environment with `eas env:create` (plain-text visibility).

## API client (`src/lib/api`)

Platform-neutral TypeScript (no React / RN imports), so it runs in Node tests and can move to
`packages/api-client` once a second consumer exists.

```ts
import { createApiClient, createSchoolApi } from '@/lib/api';

const client = createApiClient({ baseUrl: '', credentials: 'include', auth: sessionManager });
const school = createSchoolApi(client);
const info = await school.getPublicInfo(abortController.signal); // typed PublicSchoolInfo
```

Inside the app use `useApi()` (client, `auth`, `school`, `session`) and `useSession()`.

What it does:

- **Base URL**: `EXPO_PUBLIC_API_BASE_URL`, or same-origin on web. Paths always start with `/api`.
- **Envelopes**: unwraps both verified success shapes, legacy Express
  `{ statusCode, data, message, success }` and Nest `{ success: true, data }`, and returns `data`.
  `success: false` is an error even on 2xx.
- **Errors**: everything becomes an `ApiError` with `kind` (`http` | `network` | `timeout` |
  `aborted` | `parse` | `config`), `status`, `message`, `details` (server `errors[]`) and `data`
  (e.g. subscription state on 402). Handles the `{ success:false, message, errors, error }` body
  from `errorHandler`/`LegacyErrorFilter`, bare `{ message }` from the tenant middleware and rate
  limiter, and non-JSON proxy pages.
- **Cancellation**: every call takes an `AbortSignal`; a per-request timeout is combined with it
  without relying on `AbortSignal.any` (not on every RN runtime). TanStack Query passes its signal.
- **Auth**: bearer access token from memory; on 401 one **single-flight** refresh
  (`POST /api/auth/sessions/refresh`, cookie-based) then one retry. Only a 401/403 from refresh
  ends the session (`endedReason: 'expired'`) and drops `['tenant', key, 'private', ...]`
  queries. Network errors, 5xx, 429 and **402 (subscription lock)** never sign the user out,
  matching `dashboard/src/context/unifiedAuthContext.tsx`.
- **Typed only where verified**: auth (`auth.ts`, request bodies are `z.input` of the shared
  login schemas) and `GET /api/schools/public` (`school.ts`). No other endpoint is wrapped yet.

### Session storage

| Platform | Access token | Refresh credential                                                                                                            |
| -------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Web      | memory only  | HttpOnly cookie set by the backend / edge worker. JS persists nothing.                                                        |
| Native   | memory only  | `SessionPersistence` adapter (`token-store.ts`), implemented with `expo-secure-store`, one slot per tenant. **Unused today.** |

Today's backend only issues the refresh token as a cookie, and the edge workers strip it from
response bodies. A native app therefore cannot restore a session after the 15-minute access token
expires unless the OS cookie jar happens to keep the cookie (not verified). A proper native token
mode needs backend work (body-returned refresh token on a native flag, a separate
`REFRESH_TOKEN_SECRET`, a `typ` claim, rotation). That is deliberately **not** in this milestone.

## Tenant branding (`src/tenant`)

The backend resolves the school from the request **hostname** (tenant middleware; in production
from `X-Forwarded-Host`, which tenant-router / auth-bff set). The client never sends a school id.

| Platform                 | Tenant key / where requests go                                           |
| ------------------------ | ------------------------------------------------------------------------ |
| Web, same origin         | Page host, e.g. `<school>-dashboard.mutiurrahman.com` or a custom domain |
| Web/native with base URL | The `EXPO_PUBLIC_API_BASE_URL` host (one school per build/config today)  |
| Local dev                | `EXPO_PUBLIC_DEV_TENANT_HOST`, sent as `x-tenant-host`                   |

Branding comes from the existing public contract `GET /api/schools/public` (`name`, `shortName`,
`nameBn`, `logo`/`headerLogo` resolved against the CDN like `getFileUrl`). The School model has no
theme fields, so every tenant uses the default theme; `ThemeProvider` accepts a validated
`primary` override for when that exists.

Leak prevention:

- school data is cached only under `tenantQueryKey(tenantKey, ...)`; on a tenant change all other
  tenants' queries are cancelled and removed, and the previous tenant's scoped storage is wiped;
- the persisted branding cache is namespaced per tenant and re-checked on read;
- while the new tenant loads, the neutral default is shown, never the previous school;
- the API client and session are recreated per tenant, so tokens never cross schools.

The **native launcher icon is static** (`assets/icon.png`, `assets/adaptive-icon.png`) and never
changes per school. School logos are in-app only.

What is and is not verified: tenant resolution, cache isolation and storage clearing are covered
by unit tests. The fallback to default branding when the API is unreachable was verified in a
browser. Fetching real branding from a running backend, switching schools at runtime and native
school selection are **not** verified yet.

## Shared code reuse

- `@school/shared-schemas`: type-only imports for login bodies (no runtime import, so the
  `instanceof File` guard issue in `class6RegistrationSchemas.ts` does not affect this app yet).
- `@school/common-ui`: not used. It is DOM-only (iframes, `document`, `URL.createObjectURL`).
- Dashboard UI (Radix/shadcn, Tailwind, react-hot-toast, recharts, xlsx, framer-motion,
  react-router) is web-only and is not imported.

## Dependency notes

- **Expo SDK 57, not 58.** SDK 58 needs React 19.3.0 (RN 0.88 peer `^19.3.0`). The workspace is
  on React 19.2.4. RN 0.86.3 accepts `^19.2.3`, so SDK 57 keeps one React version across the
  monorepo without touching the existing dashboard. `react`/`react-dom` are pinned to 19.2.4 and
  excluded from `expo install --check` for that reason. Move to SDK 58 together with a
  workspace-wide React 19.3 upgrade.
- **TypeScript 6.0.3** here (Expo's expected `~6.0.3`; the rest of the workspace uses TS 7 and the
  server TS 6.0.2 via alias).
- `react-native-reanimated`, `react-native-gesture-handler`, `react-native-worklets` and
  `@react-native-masked-view/masked-view` are not used directly. They are optional peers of
  `expo-router`/`@expo/ui` that pnpm auto-installs at their latest versions, which do not match
  SDK 57 and would be autolinked into native builds. They are pinned to SDK 57 versions.
  `@react-native/metro-config` is pinned for the same reason.
- No Redux or other state library: TanStack Query (already used by the dashboard) for server
  state, React context for session/tenant/theme.
- No styling library (plain `StyleSheet` + ported tokens); see "Styling approach".
- Icons: `lucide-react-native` + `react-native-svg` (installed with `expo install`), the RN build
  of the web dashboard's `lucide-react`. Always import through `src/components/ui/icons.ts`:
  the barrel import bundles every icon (web bundle 3.6 MB vs 1.4 MB), and ESLint blocks it.
- Font: `@expo-google-fonts/outfit`, the same Outfit typeface the web dashboard self-hosts.

## Known limitations

- No login screen, role routing or real school data (next milestone). Only the admin menu is
  mirrored; teacher/student/super_admin menus follow with role routing.
- Visual gaps vs the web dashboard: no Bangla font (SolaimanLipi ships only as woff2, which
  native cannot load), chart has no tooltip/active dot, sidebar/dropdown have no framer-motion
  animations, no collapsed 64px sidebar mode, dark mode not enabled (same as web), Student List
  lacks column filter/sort menus, checkboxes and bulk actions.
- Native session restore is not possible with the current backend contract (see above).
- Android/iOS native builds (Gradle/Xcode) have not been run; only Hermes bundle exports and
  `expo prebuild` config generation were checked.
- Web export is an SPA (`web.output: 'single'`): hosting needs an index.html fallback.
- Public R2 bucket: marksheet and photo URLs are guessable today (owner-confirmed). Screens added
  later must not depend on public CDN links for private files.
