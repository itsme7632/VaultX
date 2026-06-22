---
name: Compounding Profit Model
description: How the ROI engine compounds daily profits and how claiming/reinvesting works after the Portfolio overhaul
---

## The Rule
Daily ROI is applied to `effectivePrincipal = amount + pendingEarnings` (not just `amount`). This means unclaimed profits automatically compound every 24 hours.

**Why:** User-facing simplification — no toggles, no manual reinvest. Profits grow faster the longer they remain unclaimed. Claiming resets `pendingEarnings` to 0, so the principal reverts to the original `amount`.

**How to apply:**
- `amount` in DB = original investment (never changes during active lifetime)
- `pendingEarnings` = accumulated unclaimed profits
- `currentValue` (computed, not stored) = `amount + pendingEarnings`
- Claiming: moves `pendingEarnings` → wallet balance, sets `pendingEarnings = 0`

## Removed Endpoints
- `POST /investments/:id/reinvest` — deleted
- `POST /investments/:id/compound` — deleted
- `POST /investments/:id/toggle-compound` — deleted

## computeInvestmentView Fix
The function previously referenced undefined `minRoi`/`maxRoi` variables. Now correctly parses `planMinRoi`/`planMaxRoi` parameters as `minRoiRate`/`maxRoiRate`. Also adds `currentValue` and `originalAmount` to the response.

## Referral Salary System
- Table: `referral_salary` (userId unique, currentVolume, currentTier, monthlySalary, nextPaymentDate, totalSalaryPaid)
- Platform settings: `salary_tier1_volume` (1500), `salary_tier1_amount` (100), `salary_tier2_volume` (3500), `salary_tier2_amount` (300), `salary_program_enabled`
- `processReferralSalary()` in roi-engine.ts — runs on every ROI cron cycle
- Admin routes: GET/POST /admin/referral-salary, PUT /admin/referral-salary/settings, PUT /admin/referral-salary/:userId/override
- User route: GET /referrals/salary
- Admin tab: "Referral Salary" with ReferralSalaryTab component in admin.tsx
