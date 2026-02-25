# @school/client-ui

Reusable school UI package for sharing common pages and components across multiple school projects.

## What is shared

- Layout: `AppLayout`, `MainLayout`, `Header`, `Navbar`, `TopBanner`, `RightSidebar`, `Footer`
- Home page blocks: `HomePage`, `NoticeBoard`, `Chart`, `ExtraHome`
- Context/config: `SchoolProvider`, `useSchoolConfig`
- Helpers: `Analytics`
- Styles: `@school/client-ui/styles.css`

## Use in a school app

1. Install package (workspace or npm/private registry).
2. Wrap app with `SchoolProvider` and pass school-specific config.
3. Import shared stylesheet once in app entry.
4. Use shared `AppLayout` and `HomePage`.

```tsx
import "@school/client-ui/styles.css";
import { BrowserRouter } from "react-router-dom";
import { AppLayout, HomePage, SchoolProvider } from "@school/client-ui";

<BrowserRouter>
  <SchoolProvider config={schoolConfig}>
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage documentTitle={schoolConfig.name.en} />} />
      </Route>
    </Routes>
  </SchoolProvider>
</BrowserRouter>
```

## School-specific customization

Keep these per project:

- `schoolConfig` (name, links, sidebar links, assets, map)
- API base URL (`axios.defaults.baseURL`)
- Project-specific routes/pages not included in shared package

This keeps design/layout identical while allowing different school data per project.
