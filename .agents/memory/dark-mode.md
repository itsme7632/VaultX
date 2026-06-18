---
name: Dark Mode Strategy
description: How dark mode is implemented across the VaultX platform
---

## Mechanism
- **Custom variant:** `@custom-variant dark (&:is(.dark *))` in index.css — class-based, needs `.dark` on an ancestor
- **ThemeProvider:** `src/lib/theme.tsx` — toggles `.dark` on `document.documentElement`, persists to `localStorage("vaultx-theme")`
- **Anti-flash:** Inline script in `index.html` reads localStorage before first paint
- **App entry:** `ThemeProvider` wraps `QueryClientProvider` in `App.tsx`

## CSS Override Strategy
Since 24 page files hardcode `bg-white`, `bg-slate-50`, etc., dark mode overrides are applied via higher-specificity CSS rules in `index.css`:

```css
.dark .bg-white { background-color: hsl(var(--card)); }
.dark .bg-slate-50 { background-color: hsl(217 30% 16%); }
/* ... etc */
```

**Why:** This avoids per-page `dark:` prefix edits across 24+ files. `.dark .bg-white` has higher specificity than `.bg-white` so it wins without `!important`.

## Dark CSS Variables
`.dark {}` block in `index.css` defines all CSS vars: `--background: 222 47% 9%`, `--card: 222 40% 14%`, etc.

## Theme Toggle Location
- TopBar: Sun/Moon button next to bell icon
- TopBar dropdown menu: "Light Mode" / "Dark Mode" item
- Settings page: Toggle switch in "Preferences" section

**How to apply:** Use `useTheme()` from `lib/theme.tsx` to get `{ theme, toggleTheme, setTheme }`.
