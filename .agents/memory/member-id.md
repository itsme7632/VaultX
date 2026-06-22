---
name: Member ID System
description: How the WX member ID system works — displayId field, generation, display, migration status
---

# Member ID System

## Rule
Profile and settings must always display `WX{displayId}` — never expose the database row `id` (integer). If `displayId` is null, show `"—"`, not a padded row ID.

**Why:** Users were seeing `#3`, `#4`, `#5` (raw DB row IDs). The displayId system was added to give users a branded, non-sequential identifier.

## How to apply
- `displayId` is a `text("display_id").unique()` column in the `users` table (schema: `lib/db/src/schema/users.ts`)
- `generateDisplayId()` in `artifacts/api-server/src/routes/auth.ts` generates a random 6-digit string, retrying on collision
- On signup: `displayId` is generated and stored automatically
- Seed users have hardcoded displayIds: admin=`000100`, demo=`100042`
- `serializeUser()` in auth.ts exposes `displayId` to the frontend
- Profile page (`artifacts/vaultx/src/pages/profile.tsx`): renders `{user?.displayId ? \`WX${user.displayId}\` : "—"}`
- Settings page shows displayId in the user card: `ID: {(user as any)?.displayId ?? "—"}`
