# Shared Package Documentation (`@school/client-ui`)

This document explains how the shared package works in this repository and how to use or extend it safely.

---

## 1) What the shared package is

`@school/client-ui` is a local workspace package that contains reusable public-site UI and related logic:

- Layout primitives (`AppLayout`, `MainLayout`, `Header`, `Navbar`, `RightSidebar`, `Footer`, etc.)
- Home page building blocks (`HomePage`, `NoticeBoard`, `Chart`, `ExtraHome`)
- Shared context (`SchoolProvider`, `useSchoolConfig`)
- Shared API/data helpers (`useNotices`, `useHeadMasterMsg`, `useRoutinePDF`, etc.)
- Shared styling bundle (`index.css`/`styles.css` export)

It lives in:

- `packages/client-ui`

---

## 2) How workspace linking works

At repository root, `package.json` declares npm workspaces:

```json
"workspaces": [
  "client",
  "packages/*"
]
```

Because of this:

- `client` can depend on `"@school/client-ui": "*"`
- npm links it locally (no publish needed)
- Commands can target package workspaces directly using `-w`

Important root scripts:

- `build:client:ui` → builds only `@school/client-ui`
- `build:client:core` → builds `@school/client-ui` first, then `client`
- `dev:client:ui` → watch mode build for shared package

---

## 3) How the package is built

The package build is configured with `tsup`:

- Entry: `src/index.ts`
- Output: ESM + `.d.ts` typings in `dist/`
- Externals: React ecosystem/runtime libs are marked external
- Asset loaders: images (`png/jpg/jpeg/svg`) are handled as data URLs

`packages/client-ui/package.json` exposes:

- `.` → `dist/index.js` and `dist/index.d.ts`
- `./index.css` and `./styles.css` → `dist/index.css`

`sideEffects: ["*.css"]` prevents CSS imports from being tree-shaken away.

---

## 4) Public API surface (what consumers import)

Everything public is re-exported from:

- `packages/client-ui/src/index.ts`

If a component/hook/type is not exported there, consumers cannot import it via `@school/client-ui`.

---

## 5) How runtime configuration flows

The shared package is designed to stay generic while each school app injects data/config.

### In consumer app (`client`)

In `client/src/main.tsx`:

1. Shared CSS is imported once:

```ts
import "@school/client-ui/index.css";
```

2. App is wrapped with provider:

```tsx
<SchoolProvider config={{ ...schoolConfig, backendBaseUrl }}>
  <App />
</SchoolProvider>
```

3. `QueryClientProvider` is added so shared hooks using React Query work.

### Inside shared components

Components call `useSchoolConfig()` to read app-specific data (name, logos, links, map, etc.).

Examples of components that read this context:

- `Header`
- `Navbar`
- `Footer`
- `HomePage`
- `RightSidebar`

If `SchoolProvider` is missing, `useSchoolConfig()` throws an error by design.

---

## 6) How API data is fetched

Shared data functions in `packages/client-ui/src/data/index.ts` use:

- `axios` (relative API paths like `/api/notices/getNotices?...`)
- `@tanstack/react-query`

So the consuming app must ensure:

- `axios.defaults.baseURL` is configured (done in `client/src/App.tsx` using `VITE_BACKEND_URL`)
- `QueryClientProvider` exists at app root

---

## 7) Current usage in this repo

Currently, the active consumer is `client`:

- `client/src/main.tsx` imports CSS + `SchoolProvider` + `Analytics`
- `client/src/App.tsx` uses `AppLayout` and imports route pages from `@school/client-ui`
- Page logic and route components now live in `packages/client-ui/src/pages/`

No active `dashboard` imports from `@school/client-ui` were found.

---

## 8) How to add a new shared component

1. Create component in `packages/client-ui/src/components/`
2. Export it from `packages/client-ui/src/index.ts`
3. If it needs config, consume `useSchoolConfig()`
4. If it needs server data, use existing React Query + axios pattern
5. Build package:

```bash
npm run build:client:ui
```

6. Use it from `client`:

```ts
import { NewComponent } from "@school/client-ui";
```

---

## 9) Local development workflow

Recommended flow while editing shared UI:

1. Run shared package watch build:

```bash
npm run dev:client:ui
```

2. In another terminal run app:

```bash
npm run dev:client
```

This allows iterative development of shared code and immediate app feedback.

---

## 10) Common pitfalls

- **Forgetting export:** component exists but not exported from `src/index.ts`
- **Missing provider:** `useSchoolConfig` throws when `SchoolProvider` not mounted
- **Missing styles import:** components render but appear unstyled
- **No QueryClientProvider:** React Query hooks fail
- **Wrong axios baseURL:** API calls hit wrong origin

---

## 11) Quick mental model

Think of `@school/client-ui` as a reusable theme/layout + shared feature blocks package.

- **Structure and behavior** come from the package
- **Branding and school-specific values** come from `SchoolProvider` config
- **Backend target** comes from app-level `axios.defaults.baseURL`

That separation is what makes one package reusable across multiple school frontends.

---

## 12) Additional package for cross-project components

There is now a second package:

- `@school/common-ui` in `packages/common-ui`

Purpose:

- Store generic shared components (`Button`, `Card`, `Input`, `Badge`)
- Reuse in any React project in this monorepo (not only school-client pages)
- Use with minimal setup (styles are loaded automatically from package entry)

Build and dev commands:

```bash
npm run build:common:ui
npm run dev:common:ui
```
