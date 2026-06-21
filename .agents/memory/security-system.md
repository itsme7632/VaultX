---
name: Security System
description: Withdrawal security system — 3-factor gate, withdrawal password, saved addresses, TOTP enforcement on withdraw/transfer
---

## Architecture

Three security layers are required before a withdrawal can proceed:
1. **2FA (TOTP)** — `users.two_fa_enabled` + `users.two_fa_secret`, verified via speakeasy
2. **Withdrawal Password** — `users.withdrawal_password_hash` (bcrypt 12), separate from login password
3. **Saved Withdrawal Address** — `withdrawal_addresses` table, at least 1 required

**Why:** Prevents unauthorized withdrawals even if login session is compromised. Three independent factors must all pass.

## DB Tables
- `users.withdrawal_password_hash` — text, nullable, added via COLUMN_MIGRATIONS_SQL
- `withdrawal_addresses` — id, user_id, network, address, label, created_at; max 5 per user

## Backend Routes (`artifacts/api-server/src/routes/security.ts`)
- `GET /security/status` — returns twoFaEnabled, hasWithdrawalPassword, withdrawalAddresses[], allConfigured
- `POST /security/withdrawal-password/set` — first-time set (rejects if already set)
- `POST /security/withdrawal-password/change` — verify current + set new
- `GET /security/addresses` — list (masked: first4****last4)
- `POST /security/addresses` — add (max 5, duplicate check)
- `DELETE /security/addresses/:id` — remove (ownership verified)

## Enforcement in wallet.ts
- **Withdrawal**: Hard gate — all 3 must be configured AND verified in request body (`withdrawalPassword` + `twoFaCode`)
- **Transfer**: Soft gate — only verifies what user has set up (withdrawal password if set, TOTP if enabled)

## Frontend
- `/security` page: status header + 3 collapsible sections (2FA links to /setup-2fa, withdrawal password set/change, addresses list/add)
- `/withdraw`: 3-step flow — form (saved address selector) → confirm → security (password + TOTP) → submit via raw fetch
- `/transfer`: 3-step flow — input → confirm → security (skipped if neither configured) → submit via raw fetch
- Security gate on withdraw page: if not allConfigured, shows checklist with links to fix each item

## Admin
- User list: badges 2FA / WDP / ADDR (green if set, grey if not)
- User modal: full status rows for all 3 security factors
- Recovery: existing `/admin/users/:id/reset-2fa` endpoint resets twoFaEnabled + twoFaSecret

## **How to apply:**
Any new endpoint that moves funds (new payout type, bonus withdrawal, etc.) must check withdrawalPassword + twoFaCode exactly as wallet.ts withdraw does, using the same bcrypt.compare + speakeasy.totp.verify pattern.
