# Wexora Global — Crypto Investment Platform

A premium light-theme mobile-first crypto investment platform where users can invest, earn daily returns, manage wallets, refer friends, and track portfolio performance.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — build + run API server (port 8080, proxied at `/api`)
- `pnpm --filter @workspace/vaultx run dev` — run Vite frontend (proxied at `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` (Postgres), `SESSION_SECRET`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 18 + Vite + wouter routing + Tailwind + shadcn/ui + TanStack Query + recharts
- API: Express 5 with session-based auth (express-session + connect-pg-simple)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec at `lib/api-spec/openapi.yaml`)
- Build: esbuild (CJS bundle for API)
- 2FA: speakeasy + qrcode

## Where things live

- `artifacts/vaultx/src/pages/` — all page components (login, signup, dashboard, wallet, investments, portfolio, referrals, notifications, profile, security, kyc, settings, admin)
- `artifacts/vaultx/src/components/` — shared components (AppLayout, BottomNav, TopBar, ProtectedRoute)
- `artifacts/vaultx/src/lib/auth.tsx` — AuthProvider and useAuth hook
- `artifacts/api-server/src/routes/` — all Express route handlers
- `artifacts/api-server/src/routes/index.ts` — router registration
- `lib/api-spec/openapi.yaml` — source-of-truth API contract
- `lib/api-client-react/src/generated/api.ts` — generated React Query hooks (DO NOT edit manually)
- `lib/db/src/schema.ts` — Drizzle schema (source of truth for DB)

## Architecture decisions

- **Cookie sessions over JWT**: express-session + connect-pg-simple stores sessions in PostgreSQL; cookies sent with `credentials: "include"` on every request.
- **Contract-first API**: OpenAPI spec drives Orval codegen; never write fetch calls directly in components — always use generated hooks from `@workspace/api-client-react`.
- **No sidebar**: Mobile-first bottom navigation with 5 tabs (Dashboard, Wallet, Invest, Portfolio, Referrals).
- **Live earnings counter**: Dashboard and portfolio use a JS interval to tick earnings in real-time without polling.
- **Admin access**: `isAdmin` flag on user record; admin panel accessible via profile dropdown menu.

## Product

- Auth: signup, login, forgot password, 2FA (TOTP), session management
- Dashboard: live balance, earnings chart, market ticker, recent activity
- Wallet: deposit/withdraw/transfer with crypto address book
- Investments: tiered plans (Starter/Silver/Gold/Platinum), claim/compound earnings, auto-compound toggle
- Portfolio: live earnings counter, progress bars, compound/claim buttons
- Referrals: shareable code, WhatsApp sharing, leaderboard, commission history
- Notifications: grouped by date, mark read/all
- KYC: document submission (passport/license/national ID), admin review
- Admin: analytics, user management, KYC approvals, withdrawal approvals, broadcast notifications

## User preferences

- Premium fintech look inspired by Coinbase/Revolut: light theme, blue primary, emerald accent
- Mobile-first, max-width `screen-sm` centered layout
- No sidebar — bottom nav only
- Test admin: email `admin@wexoraglobal.com`, password `Admin123@`

## Gotchas

- API server must be rebuilt (`pnpm run build`) before any route change takes effect (runs as a built bundle, not ts-node)
- Always restart the API Server workflow after editing any server-side file
- Orval codegen must be re-run after any OpenAPI spec changes: `pnpm --filter @workspace/api-spec run codegen`
- `lib/api-zod/src/index.ts` must stay as a single `export * from "./generated/api"` barrel
- Investment plan `features` column is `text[]` (not JSONB) — use `ARRAY[...]` syntax when seeding
- 4 investment plans pre-seeded: Starter ($100), Silver ($1000), Gold ($5000), Platinum ($25000)

## Pointers

- See `.local/skills/pnpm-workspace` for workspace structure, TypeScript setup, and codegen details
- See `.local/skills/react-vite` for Vite config and frontend patterns
- shadcn/ui components are in `artifacts/vaultx/src/components/ui/`
