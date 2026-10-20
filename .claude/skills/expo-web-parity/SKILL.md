---
name: expo-web-parity
description: Compare a page of the web dashboard (dashboard/) with its Expo port (apps/dashboard-expo/) in the live browser via the brave-devtools MCP, list every UI difference, then fix them in Expo only. Use when the user says "compare web and expo", "make expo look like web", "UI parity", "same UI as web", or names a page to match (e.g. "platform overview", "student list").
---

# Expo ↔ web UI parity

Web (`dashboard/`) is the source of truth. Goal: the Expo page looks **as it is** on web.

## Hard rules

- **Never edit `dashboard/`** (web). Only `apps/dashboard-expo/`. If web is "worse" (e.g. no error state), mention it; don't fix it.
- Match web's limits too. Example: web ships only `Outfit.woff2` (Regular 400); Expo keeps only `Outfit_400Regular.ttf`. Don't add fonts, weights or features web lacks.
- Judge from the **live render**, not just code. Code reading misses card heights, borders, spacing and icons.
- Don't remove deliberate Expo differences documented in code comments (e.g. bottom tab bar instead of the burger drawer on phones, pull-to-refresh).
- Never commit unless asked.

## 1. Locate both pages

- Web: `dashboard/src/pages/**`. Super admin pages are in `pages/SuperAdmin/`.
- Expo: `apps/dashboard-expo/app/**` (expo-router). Its header comment usually says "ported from dashboard/...".
- Shared Expo pieces: `src/components/layout/` (AppShell, Navbar, Sidebar, PageLayout), `src/components/ui/` (SectionCard, Button, Text, icons.ts), `src/features/student/components.tsx` (StatsCard).
- Changing a shared Expo component affects every page that uses it. Say so in the report.

## 2. Open both in Brave (brave-devtools MCP)

Load tools with ToolSearch: `select:mcp__brave-devtools__list_pages,mcp__brave-devtools__navigate_page,mcp__brave-devtools__take_screenshot,mcp__brave-devtools__select_page,mcp__brave-devtools__evaluate_script,mcp__brave-devtools__resize_page,mcp__brave-devtools__new_page,mcp__brave-devtools__take_snapshot`.

- `list_pages` first. The user usually has both open already. Typical URLs:
  - web super admin: `http://admin.localhost:5177/...`, admin `:5174`, student `:5175`, teacher `:5176`
  - Expo web: `http://admin.localhost:8081/...` (e.g. `/platform`)
- If not open, check `netstat -ano | grep LISTENING` for the ports, then `new_page`. If a dev server is down or the page needs a login, ask the user. Don't start servers or log in with guessed credentials.

## 3. Compare

Do it at **desktop (1920×807)** and **phone (390×844)**. Call `select_page` with `bringToFront` before `resize_page`, otherwise the resize may not apply. Afterwards, restore the original size on both pages.

1. Take screenshots of both pages (`take_screenshot` with `filePath` in the scratchpad), then `Read` them and compare visually.
2. Measure. Don't trust your eye for 1–10px differences. Use `evaluate_script` to compare `getBoundingClientRect()` and computed styles (border width and color, box-shadow, padding, font-size, font-weight, z-index) of the matching elements. Handy query: elements near the top with any border >0 and width >200.
3. For hairline or border issues, crop both screenshots and compare pixel rows with PIL (`python -c "from PIL import Image ..."`).
4. Read the whole viewport: top bar, sidebar, header spacing, card heights in a row, icon shapes, bold vs regular text, button widths on phone, extra or missing elements.

Write the list of differences, then fix them all.

## 4. Known gotchas (from past parity work)

- **Bold text**: Expo native can't fake bold (`fontWeight` with a custom family breaks Android). On web, `src/theme/web-input-css.web.ts` sets `font-weight` on `.font-*` so the browser synthesizes bold like the dashboard does. Native stays at 400.
- **Icons**: Expo uses `lucide-react-native` v1, web uses `lucide-react` 0.x, and some names differ. Web `Building2` = v1 `building-complex`. Map in `src/components/ui/icons.ts` to the visually matching file, not the same name.
- **Stacking**: RN-web puts `z-index: 0` on every View, so a child can't stack above a sibling subtree (e.g. sidebar over navbar). Mask or redraw locally instead of raising the parent's z-index, which would hide the UserMenu dropdown under the content.
- **Navbar/sidebar seam**: the web sidebar starts 1px up (`top-[calc(3.5rem-1px)]`) and hides the navbar border. Expo masks the border with a strip in `Navbar.tsx` and uses `-mt-px` on `Sidebar.tsx`.
- **Equal-height cards in a row**: web CSS grid stretches cards. In Expo's flex-wrap, give the inner card `flex-1` inside a stretched wrapper.
- **Grid columns**: web `grid-cols-1 sm:2 lg:4` → Expo `basis-full sm:basis-[45%] lg:basis-[22%]` plus `flex-1`.
- **Phone buttons**: web `w-full sm:w-auto` → Expo wrapper `sm:items-start` (default stretch makes it full width).
- **Header spacing**: web `PageHeader` is `mb-8` and `items-start`. Expo `PageLayout` mirrors it (`mb-2` on top of `gap-6`).
- The Expo app is light-only (ThemeProvider pins the scheme), so skip dark-mode variants.
- Port missing web sections by reusing existing Expo features first (e.g. `PlatformCodeCard` reuses the `PlatformCodeDialog` hook).

## 5. Fix → verify loop

1. Make each fix in Expo, following existing comment and naming style. When you change a deliberate behavior, update the file header comment that describes it.
2. Reload the Expo page (`navigate_page` type `reload`), re-screenshot, re-measure. Repeat until it matches at both widths.
3. In `apps/dashboard-expo`, run `pnpm run typecheck`, `pnpm run lint` and `pnpm run test`. Use `pnpm run <x>`, not `pnpm -s`.

## 6. Report

Short: each difference found → fix made (file link), what's still different and why (deliberate Expo choice or platform limit), and which other pages a shared-component change affects. Give check results. No commit.
