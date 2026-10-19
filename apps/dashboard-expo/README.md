# dashboard-expo

Foundation for the new School dashboard: **Expo SDK 57 + React Native 0.86 + React Native Web +
Expo Router + strict TypeScript**, targeting web, Android and iOS from one codebase.

The existing Vite dashboard (`../../dashboard`) stays in production until this app reaches parity.
The backend (`../../server`) and the public site (`../../client-next`) are untouched.

> Status: school-code onboarding, login (admin / teacher / student), role routing, the admin
> overview, attendance, and admin students / teachers / subjects / notices / events / holidays
> (CRUD), plus the teacher attendance home and the student portal. The per-route state against the
> web dashboard is tracked in [docs/web-parity.md](docs/web-parity.md).

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
  _layout.tsx             providers: SafeArea -> QueryClient -> School -> Api/session -> Tenant -> Theme
  (auth)/join.tsx         enter a school code (or open the scanner on native)
  (auth)/scan.tsx         QR scanner (expo-camera; web shows "type the code")
  (auth)/confirm.tsx      "You're joining <school>"
  (auth)/login.tsx        sign in: a role code shows only that role; a school-wide code all three
  teacher.tsx, student.tsx role homes (placeholders)
  (dashboard)/_layout.tsx RoleGate(admin) + AppShell (navbar + sidebar, or navbar + bottom tabs)
  (dashboard)/index.tsx   Admin Dashboard overview
  (dashboard)/students.tsx, teachers.tsx, subjects.tsx, notices.tsx, events.tsx, holidays.tsx
                          admin CRUD pages (tables on wide screens, cards on phones)
  (dashboard)/settings.tsx System status, Expo-only (real config, tenant, session, API probe)
  (dashboard)/attendance.tsx attendance; results.tsx, soon/[id].tsx  "not built yet" placeholders
src/config                EXPO_PUBLIC_* parsing and validation
src/lib/api               fetch client, envelopes, errors, auth contracts, session manager
src/lib/storage           platform key-value + session persistence (*.web.ts for web)
src/tenant                tenant resolution, branding mapping, tenant-scoped query keys
src/session               ApiProvider (client + SessionManager per tenant), useSession
src/school                school-code selection (persisted public data), switch school
src/features              join / login form logic, QR scanner, role placeholders
src/theme                 design tokens ported from dashboard/src/index.css + ThemeProvider
src/navigation            admin menu (mirrors dashboard Sidebar), role routes, RoleGate
src/components/{ui,layout} shadcn-style primitives, lucide icons and the responsive shell
```

Responsive behaviour (`src/hooks/useBreakpoint.ts`), mirroring the web dashboard's `md:` split:

| Width    | Navigation                                                                                                | Navbar                                         |
| -------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| >= 768px | Persistent 250px sidebar, same sections/groups/order as the web                                           | "Admin" + active school, Power -> popover menu |
| < 768px  | Bottom tabs (Dashboard, Students, Attendance, Results, More); "More" opens the full admin menu in a sheet | "Admin", Power -> bottom sheet                 |

Page padding (16/24/32px at `sm`/`lg`) and grids (`lg:grid-cols-3/2`) follow the web pages.
Previews: `/?state=loading|error|empty` (Overview only; the Student List shows real states).

## Design system (ported from `dashboard/`)

The web dashboard is the design reference; this app replicates it. Values come from its source,
not from screenshots. Colour hexes for Tailwind palette classes were converted from the oklch
values in the installed `tailwindcss@4.3.3/theme.css`.

| Web dashboard source                                                | Expo equivalent                                                       | What was ported                                                                                                  |
| ------------------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `src/index.css` `:root`                                             | `global.css` `:root` + `tokens.ts` `lightColors`                      | All shadcn CSS variables (background, primary, muted, border, sidebar-_, chart-_...)                             |
| `src/index.css` `.dark`                                             | `global.css` `.dark:root` + `tokens.ts` `darkColors`                  | Ported but **not enabled** (the web theme switch is commented out in `index.html`/`main.tsx`)                    |
| `src/index.css` `--radius: 0.66rem` + `@theme inline`               | `tailwind.config.js` `rounded-sm/md/lg/xl`                            | 6.56 / 8.56 / 10.56 / 14.56 px                                                                                   |
| `src/index.css` `MixedFont` (Outfit + SolaimanLipi)                 | `font-*` classes + `useFonts` in `app/_layout.tsx`                    | Outfit 400/500/600/700 via `@expo-google-fonts/outfit` (TTF, works on native)                                    |
| Tailwind v4 `theme.css` (text scale, tracking, shadows)             | Tailwind text scale + `tailwind.palette.js`; `shadows` in `tokens.ts` | text-xs...2xl sizes/line-heights, `tracking-wider`, `shadow-xs/sm`                                               |
| `components.json` (`iconLibrary: lucide`)                           | `src/components/ui/icons.ts` (lucide-react-native)                    | Same icons, same names as the web imports (per-icon deep imports)                                                |
| `src/App.tsx` (layout shell)                                        | `src/components/layout/AppShell.tsx`                                  | Navbar on top, 250px sidebar below at >= 768px                                                                   |
| `src/components/Navbar.tsx`                                         | `src/components/layout/Navbar.tsx`, `UserMenu.tsx`                    | 56px bar, `bg-sidebar border-b`, "Admin" title, Power button                                                     |
| `src/components/Sidebar.tsx` (`adminRoutes`)                        | `src/navigation/nav-items.ts`, `layout/Sidebar.tsx`                   | Labels, order, sections, dropdown groups, icons, active/hover/open styles, child-list rail                       |
| `src/pages/Admin/Dashboard.tsx`                                     | `app/(dashboard)/index.tsx`                                           | Header + quick actions, KPI strip, Attendance chart + range toggle, Exams, notices, events, skeleton, error card |
| `src/pages/Admin/StudentList.tsx`                                   | `app/(dashboard)/students.tsx`                                        | Title + Session select, summary, More/Add student, table header/rows, avatar, inactive badge                     |
| `src/components/SectionCard.tsx`                                    | `src/components/ui/SectionCard.tsx`                                   | Card, header/body padding, title style, header-action wrap below `sm`                                            |
| `src/components/PageHeader.tsx`                                     | `src/components/layout/PageLayout.tsx`                                | `text-2xl font-bold` title, muted description, actions; `max-w-7xl p-4 sm:p-6 lg:p-8`                            |
| `src/components/ui/button.tsx`                                      | `src/components/ui/Button.tsx`                                        | default/destructive/outline/secondary/ghost/link x default/sm/lg/icon                                            |
| `src/components/ui/badge.tsx`, `StatusBadge.tsx`                    | `src/components/ui/Badge.tsx`                                         | Badge variants, StatusBadge colours + icons, exam status chips                                                   |
| `src/components/ActionButton.tsx`                                   | `src/components/ui/ActionButton.tsx`                                  | Quiet icon-only row actions, colour on hover                                                                     |
| `src/components/ui/input.tsx`                                       | `src/components/ui/Input.tsx` (+ `control-spec.ts`)                   | Desktop web: parity (40px, `text-sm`). Touch: 48px, 16px text. See **Form controls**                             |
| `src/components/ui/skeleton.tsx`, `Loading.tsx`, `ErrorMessage.tsx` | `src/components/ui/states.tsx`                                        | Pulse skeleton, Loader2 spinner, empty line, error card, block error                                             |
| recharts `LineChart` in `Dashboard.tsx`                             | `src/components/ui/LineChart.tsx` (react-native-svg)                  | Grid, axis labels, 5 nice ticks, monotone lines; no tooltip yet                                                  |

Phone tab bar (`layout/BottomTabBar.tsx`): a docked `bg-sidebar` surface with a hairline
`border-t` and a soft upward shadow, safe-area padded. A `bg-primary/10` pill slides behind the
active icon: Reanimated on native (`TabIndicator.tsx`), a CSS transform transition on web
(`TabIndicator.web.tsx`, keeping Reanimated out of the web bundle). It is instant under reduced
motion. Tabs are 64px tall with `role="tab"`, selected state and pressed feedback
(`active:scale-95 opacity-70`).

Deliberate differences: phones use bottom tabs + a "More" sheet instead of the burger drawer;
the navbar shows the active school (tenant branding); System status is an Expo-only page;
table headers sort on wide screens (the web's column-header sort menus); header filter menus
are toolbar filters.

### Form controls (`src/components/ui/control-spec.ts`)

Every text-like control (Input, Textarea, SearchInput, PasswordInput, MoneyInput, mark cells,
Select, MultiSelect, DateInput) reads one spec, in two densities. Screens pass layout only
(width, alignment); `src/components/ui/control.test.ts` fails if a screen overrides height,
radius, border colour or text alignment, or renders a raw `<TextInput>`.

|                       | Desktop web (≥ `sm`)        | Touch (iOS / Android / phone-width web) |
| --------------------- | --------------------------- | --------------------------------------- |
| Height sm / md / lg   | 32 / 40 / 44                | 40 / 48 / 52                            |
| Text                  | 14px                        | 16px (no iOS zoom), 24px line           |
| Radius / side padding | `rounded-lg` / 12           | `rounded-xl` / 14                       |
| Focus                 | ring border + 3px soft ring | ring border + 4px soft ring             |

- **States:** invalid = red border (red ring while focused) + alert icon in the field + message
  with an icon under it (`Field` / `FieldError`); error wins over focus. Read-only = gray-50 +
  lock icon, normal text. Disabled = gray-100, gray-200 border, muted text, 60% opacity.
- **Android text:** `includeFontPadding: false`, `textAlignVertical: 'center'`, no vertical
  padding, 24px lineHeight so Bangla (system fallback font under Outfit's metrics) isn't clipped.
  iOS single-line fields get no lineHeight (UITextField centres itself).
- **Keyboards:** `kind` (`email`, `phone`, `number`, `decimal`, `password`, `new-password`,
  `code`, `otp`, `search`, `name`, `username`, `url`) sets keyboardType, inputMode,
  autoComplete, textContentType, autoCapitalize and autocorrect together. A bare
  `keyboardType` implies its kind. Explicit props win.
- **Next / Done:** fields inside `<FormChain>` (every PageLayout, Dialog, and the sign-in forms)
  get Next on the return key and Done/Go on the last field. iOS number/phone pads get a Next/Done
  bar above the keyboard (`InputAccessoryView`).
- **Keyboard covering fields:** PageLayout, AuthLayout and Dialog scroll in
  `KeyboardAwareScrollView`: a spacer for the covered part of the screen, the focused field
  scrolled above the keyboard (also after Next), tap outside or drag to dismiss. Dialog sheets
  also lift with `KeyboardAvoidingView` (padding on both platforms, since Android is edge-to-edge).
- **Pickers:** Select / MultiSelect open a bottom sheet on phones (drag handle, 48px rows,
  search past 8 options). Dates use the Android system dialog, and on iOS a bottom sheet with
  the inline calendar plus Cancel/Done.
- **Marks entry:** number pad, Next moves down the column, and on phones focus jumps to the next
  student once the mark can't take another digit. An over-max value stays put with its error.
- **Password / search:** show/hide eye on every password field; × clear on search fields.
- **Web:** no browser outline (the ring replaces it), autofill keeps the white field
  (`src/theme/web-input-css.web.ts`), ring-tinted selection.

### Styling approach: NativeWind v4

Components are styled with Tailwind class names through **NativeWind 4.2.7** (Tailwind CSS
3.4.19), so screens can reuse the dashboard's class strings (`rounded-xl border bg-card`,
`text-sm text-muted-foreground`, `p-4 sm:p-6 lg:p-8`, ...). `cn()` in `src/lib/utils.ts` is the
dashboard's helper (clsx + tailwind-merge).

**Why v4 and not v5.** v5 is the line that matches the dashboard's Tailwind v4, but on npm it is
still a release candidate (`5.0.0-rc.0`, Sept 2026, with `react-native-css` `3.1.0-rc.0`).
4.2.7 is the latest stable release and explicitly adds Expo SDK 57 support (NativeWind
installation docs). Sharing the dashboard theme does not need Tailwind 4 because the dashboard
already keeps its theme in shadcn CSS variables: `global.css` declares the same variable names,
and `tailwind.config.js` maps the same colour/radius names onto them. Move to v5 when it is stable;
the variables and class names carry over, while the config moves from `tailwind.config.js` into
CSS `@theme`.

| File                                 | Role                                                                                                                               |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `global.css`                         | `:root` (light) and `.dark:root` (ready, not enabled) variables from `dashboard/src/index.css`, as RGB channels                    |
| `tailwind.config.js`                 | shadcn colours (`rgb(var(--x) / <alpha-value>)`, so `bg-primary/90` works), `--radius` radii, Outfit `font-*`, `darkMode: 'class'` |
| `tailwind.palette.js`                | Tailwind **v4** palette converted from oklch to hex, so `bg-emerald-100` etc. match the dashboard (v3's palette differs)           |
| `babel.config.js`, `metro.config.js` | NativeWind preset / `withNativeWind` (`inlineRem: 16`, so 1rem = 16px on native like the browser)                                  |
| `nativewind-env.d.ts`                | `className` types                                                                                                                  |
| `src/theme/tokens.ts`                | Same colours as values, for props that cannot take classes (lucide `color`, SVG strokes, placeholder colour)                       |

Conventions:

- `font-normal|medium|semibold|bold` select an Outfit family (`Outfit_600SemiBold`, ...) instead
  of a weight, because React Native has one family per weight and `fontWeight` with a custom
  family breaks Android. Class names stay identical to the dashboard.
- Tenant theming: `ThemeProvider` overrides `--primary`/`--ring`/`--sidebar-primary` with
  NativeWind `vars()`, so classes and `useTheme()` values change together.
- `style` is kept only where NativeWind cannot express it:
  - shadows (`shadow-xs/sm`, the sidebar edge and popovers) are RN `boxShadow` strings, because
    NativeWind v4 maps `box-shadow` to iOS-only `shadow*` props and supports only one layer;
  - runtime values: safe-area insets, chart/skeleton sizes, the focus ring colour;
  - RN `Animated` values (spinner, skeleton pulse). NativeWind's `animate-*` support is experimental.
- Icon colours that react to hover (sidebar rows, View all, row actions) use JS hover state,
  because lucide colours are props.
- `src/components/ui/ScrollView.tsx` re-exports RN's ScrollView typed with
  `contentContainerClassName` (RN 0.86 declares `ScrollViewProps` as a type alias, which
  NativeWind's type augmentation cannot extend).
- `global.css` and `tokens.ts` must agree; `src/theme/theme.test.ts` fails if they drift.

## Environments

All runtime config is public (`EXPO_PUBLIC_*` is inlined into the bundle). **Never put secrets
in these variables or in `eas.json`.** See `.env.example`.

| Variable                      | Purpose                                                                                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `EXPO_PUBLIC_APP_ENV`         | `local` / `staging` / `production`                                                                                                                           |
| `EXPO_PUBLIC_API_BASE_URL`    | Optional. Pins the build to one school's API origin (no school codes).                                                                                       |
| `EXPO_PUBLIC_DIRECTORY_URL`   | Origin for the pre-login school-code lookup. Native needs it or `API_BASE_URL`.                                                                              |
| `EXPO_PUBLIC_SUPERADMIN_URL`  | Platform (super-admin) API origin; falls back to `DIRECTORY_URL` (staging sets only that: it is already the super-admin host). Empty hides platform sign-in. |
| `EXPO_PUBLIC_CDN_URL`         | Public CDN for R2 keys (photos, PDFs), mirrors `VITE_CDN_URL`; staging: `https://cdn.lbphs.gov.bd`                                                           |
| `EXPO_PUBLIC_DEV_TENANT_HOST` | Local only: sent as `x-tenant-host` (backend honours it only outside production)                                                                             |

`APP_ENV` (build time, `app.config.ts`) selects the app name, bundle id suffix (`.dev`,
`.staging`) and URL scheme. `eas.json` sets it per profile:

| EAS profile   | Channel       | APP_ENV      | Distribution           |
| ------------- | ------------- | ------------ | ---------------------- |
| `development` | `development` | `local`      | internal, dev client   |
| `preview`     | `staging`     | `staging`    | internal (Android APK) |
| `production`  | `production`  | `production` | store                  |

### Over-the-air updates (expo-updates)

EAS project `@mutiur03/school-dashboard` (`52513465-21b2-46d6-bac4-93bbc2892291`; override with
`EAS_OWNER` / `EAS_PROJECT_ID`). `runtimeVersion` uses the `fingerprint` policy, so an update only
reaches binaries with identical native code; adding a native module, permission, icon or SDK
upgrade needs a new build. The app checks on every launch (`ON_LOAD`), starts at once from what it
has (`fallbackToCacheTimeout: 0`) and applies a downloaded update on the next cold start: close and
reopen the app twice.

`eas update` does **not** read the `env` of `eas.json` build profiles, so the bundle must get the
same `EXPO_PUBLIC_*` values as the build from the shell. Use the script, which mirrors `preview`:

```sh
cd apps/dashboard-expo
pnpm update:staging --message "Short description"
# = APP_ENV=staging EXPO_PUBLIC_APP_ENV=staging \
#   EXPO_PUBLIC_DIRECTORY_URL=https://superadmin.mutiurrahman.com \
#   EXPO_PUBLIC_CDN_URL=https://cdn.lbphs.gov.bd \
#   eas update --channel staging --platform android --message "..."
```

Never publish to the `production` channel without sign-off. Only public values go in
`EXPO_PUBLIC_*`. `com.mutiurrahman.schooldashboard` is still a placeholder: confirm it before the
first store build.

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
  (`POST /api/auth/sessions/refresh`: cookie on web, `{ refreshToken }` body on native) then one
  retry. Only a 401/403 from refresh
  ends the session (`endedReason: 'expired'`) and drops `['tenant', key, 'private', ...]`
  queries. Network errors, 5xx, 429 and **402 (subscription lock)** never sign the user out,
  matching `dashboard/src/context/unifiedAuthContext.tsx`.
- **Typed only where verified**: auth (`auth.ts`, request bodies are `z.input` of the shared
  login schemas), `GET /api/schools/public` (`school.ts`), `POST /api/school-code-lookups`
  (`school-codes.ts`, response validated: https, API host must equal the tenant host) and
  `GET /api/students` (`students.ts`).

### Session storage

| Platform | Access token | Refresh credential                                                                                                     |
| -------- | ------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Web      | memory only  | HttpOnly cookie set by the backend / edge worker. JS persists nothing.                                                 |
| Native   | memory only  | Returned in the body (`X-Client: native`), kept in `expo-secure-store`, one slot per school. Rotated on every refresh. |

Native requests send `X-Client: native` and no cookies (`credentials: 'omit'`). The server
returns `{ accessToken, refreshToken, user }`; every refresh rotates the refresh token, and the
new one is stored before it is used. Re-presenting a spent token revokes the session family
(server reuse detection), so refreshes are single-flight. See `server/docs/native-auth.md`.

### School codes and tenant

1. No school yet: `/join`. The code is looked up at `EXPO_PUBLIC_DIRECTORY_URL`, with no auth and
   no tenant header.
2. `/confirm` shows the public school info. Confirming stores it (`sd.school-selection`: host,
   API origin, name, logo, role hint; never an id or a credential) and the app re-keys to that
   school.
3. `/login`: from then on every request goes to the school's own host. The server resolves the
   tenant from the host; the app never sends a school id.
   A code created for one role (the lookup's `roleHint`) locks the form to that role: no role
   tabs, only its fields (`src/features/auth/role-lock.ts`). A school-wide code (no hint) keeps
   all three roles. The lock is stored with the selection, so it survives restarts and
   sign-out. It is a UI hint only: the server decides the role at login and the app routes by
   the session's role.
4. "Switch school" ("Use a different code" on a role-locked login; user menu, role homes) signs out, drops the school's cached
   queries and tenant-scoped storage, forgets the selection and returns to `/join`.

### Platform admin (super admin)

There is no platform link on `/join`. The **platform access code** goes into the same code box or
QR scanner as a school code. It is the server's `PLATFORM_ACCESS_CODE`, shown to signed-in super
admins on the web overview and in the app's user menu ("App sign-in code", with QR and Copy/Share).
The lookup then answers `{ target: 'platform' }` (`resolveCodeLookup` in
`src/features/join/join-form.ts`). If the build has no super-admin origin, or the server lacks the
feature, the code shows the same "code not found" as any unknown code. The code only opens the
sign-in screen; it grants nothing. Opening it signs out any school session, clears that school's cache and storage, stores
`{ kind: 'platform', host, apiBaseUrl }` in `sd.school-selection` and opens `/platform-login`
(email + password, POST /api/auth/super_admin/sessions; refresh and logout are the normal
session endpoints, so native uses SecureStore + body refresh tokens as for schools).

- Tenant key `_platform.<host>`: its own SecureStore slot (`sd.t._platform.<host>.session`),
  API client, `SessionManager` and react-query namespace. The platform API object exists only
  in platform mode (`usePlatformApi()` throws elsewhere).
- Requests always go to the build's super-admin origin (`EXPO_PUBLIC_SUPERADMIN_URL`, else
  `EXPO_PUBLIC_DIRECTORY_URL`; local dev adds `x-tenant-host: admin.localhost`). A stored platform choice that names another origin is
  ignored, so storage can never redirect the app.
- Only a `super_admin` session from that login is stored. Routing: super_admin lands on
  `/platform` only in platform mode; any other role there is signed out, and a super_admin at a
  school is signed out too. The server enforces the same (`authenticate(['super_admin'])` plus
  the super-admin host check); the app does not relax anything.
- Logout and "Use a school code instead" forget the platform choice and go back to `/join`.
- The user menu's "App sign-in code" reads `GET /api/auth/super_admin/platform-code`
  (super_admin + super-admin host). An older server, or one without the code, shows "Not set up".
- Pages: Overview, Schools (profile, domains, branding, admins, billing, SMS, tools), Exam
  types, SMS. Every tenant-affecting action asks first (`src/features/platform/confirm-gate.ts`:
  one action at a time, a second Confirm press never re-sends).

Precedence: dev override > pinned `EXPO_PUBLIC_API_BASE_URL` > web page host (a real school
host keeps first-party cookies) > platform choice > school-code selection. Local dev reaches every school through
`EXPO_PUBLIC_DIRECTORY_URL` and selects it with `x-tenant-host`.

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
- `react-native-reanimated` is now loaded by NativeWind's runtime (css-interop, for transitions and
  animations): most of the ~1 MB native bundle growth from NativeWind is Reanimated's JS.
  `react-native-gesture-handler`, `react-native-worklets` and
  `@react-native-masked-view/masked-view` are not used directly. They are optional peers of
  `expo-router`/`@expo/ui` that pnpm auto-installs at their latest versions, which do not match
  SDK 57 and would be autolinked into native builds. They are pinned to SDK 57 versions.
  `@react-native/metro-config` is pinned for the same reason.
- No Redux or other state library: TanStack Query (already used by the dashboard) for server
  state, React context for session/tenant/theme.
- Styling: `nativewind` 4.2.7 + `tailwindcss` 3.4.19 (dev), `react-native-css-interop` 0.2.7 (a
  direct dependency because NativeWind's Babel preset rewrites JSX to import it and pnpm does not
  hoist it), `clsx` + `tailwind-merge` 2.6.1 (the Tailwind 3 line). See "Styling approach".
- Icons: `lucide-react-native` + `react-native-svg` (installed with `expo install`), the RN build
  of the web dashboard's `lucide-react`. Always import through `src/components/ui/icons.ts`:
  the barrel import bundles every icon (web bundle 3.6 MB vs 1.4 MB), and ESLint blocks it.
- Font: `@expo-google-fonts/outfit`, the same Outfit typeface the web dashboard self-hosts.

## Known limitations

- [docs/web-parity.md](docs/web-parity.md): every admin, teacher, student and super-admin page
  is done. Uploads use `expo-document-picker` / `expo-image-picker` on native and a
  file input on web; native dates use `@react-native-community/datetimepicker`; Android PDF View
  uses `expo-intent-launcher`. These native modules changed the runtime fingerprint, so a build
  from before them cannot take newer OTAs: install the new preview APK.
- Visual gaps vs the web dashboard: no Bangla font (SolaimanLipi ships only as woff2, which
  native cannot load), chart has no tooltip/active dot, sidebar/dropdown have no framer-motion
  animations, no collapsed 64px sidebar mode, dark mode not enabled (same as web). Header sort is
  wide-screen only (phones show cards). Inline PDF previews are web-only. Every native PDF View
  goes through `src/lib/files/open-pdf.native.ts`: Android opens the device's PDF viewer
  (ACTION_VIEW on a content:// URI with a read grant), falling back to the share sheet with a toast
  when no viewer is installed; iOS uses the share sheet's QuickLook preview. Explicit Share
  buttons (marksheet, fee receipts) use the share sheet. The Android viewer path and its
  no-viewer fallback are checked by unit tests and need a device run.
- The QR scanner and SecureStore token restore have not been run on a device (no simulator on
  the build box); they are covered by unit tests and bundle exports only.
- Android native builds run on EAS (`eas build --profile preview`, staging channel); no iOS build
  has been made.
- Excel import (students, subjects) reads .xlsx on the device with `src/lib/files/xlsx.ts`
  (fflate; no SheetJS), with the web's limits and checks.
- Web export is an SPA (`web.output: 'single'`): hosting needs an index.html fallback.
- Public R2 bucket: marksheet and photo URLs are guessable today (owner-confirmed). Screens added
  later must not depend on public CDN links for private files.
