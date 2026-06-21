---
name: Wexora Brand
description: Rebrand details — all VaultX references replaced with Wexora Global; logo assets, colors, domain, and key strings.
---

# Wexora Global Rebrand

**Why:** Full white-label rebrand from VaultX to Wexora Global.

## Identity
- Brand name: **Wexora Global** (long) / **Wexora** (short)
- Domain: `wexoraglobal.com`
- Tagline: "Global Opportunities. Smarter Growth."
- Brand color: `#060d1a` (dark navy)
- Accent: `#2563EB` (blue)

## Logo Assets (in `artifacts/vaultx/public/`)
- `wx-logo.png` — main square icon used in TopBar, SplashScreen, login/signup/forgot-password pages, PWA icon, apple-touch-icon, og:image fallback
- `wx-social.png` — social/OG preview image
- `wx-icon.png` — transparent variant

## Key String Locations
- localStorage theme key: `wexora-theme` (index.html inline script + lib/theme.tsx)
- sessionStorage splash key: `wexora-splash-shown` (App.tsx)
- Session secret fallback: `wexora-secret-change-in-production` (api-server/src/app.ts)
- Notification mute key: `wexora-notifications-muted` (notificationSound.ts)
- Install version key: `wexora-installed-version` (download-app.tsx)

## Platform Settings Defaults (seed.ts)
- `platform_name`: "Wexora"
- `platform_tagline`: "Global Opportunities. Smarter Growth."
- `support_email`: support@wexoraglobal.com
- `support_telegram`: @WexoraGlobal
- `site_url`: https://wexoraglobal.com

## Files Updated
- `artifacts/vaultx/index.html` — title, meta, OG tags, PWA manifest link, favicon, theme script
- `artifacts/vaultx/public/manifest.json` — created (PWA)
- `artifacts/vaultx/public/favicon.svg` — WX-branded (dark navy + blue W + white X)
- `artifacts/vaultx/src/components/SplashScreen.tsx` — WX logo image, navy bg, WEXORA text
- `artifacts/vaultx/src/components/TopBar.tsx` — WX logo image replaces "V" badge
- `artifacts/vaultx/src/pages/login.tsx` — WX logo replaces "V" span
- `artifacts/vaultx/src/pages/signup.tsx` — WX logo replaces "V" span
- `artifacts/vaultx/src/pages/forgot-password.tsx` — WX logo replaces "V" span

**How to apply:** When adding new pages or components, import `/wx-logo.png` from public/ for any brand icon. Never use the old "V" text badge. Use `wexora-theme` as the localStorage key.
