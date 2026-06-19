import { Router } from "express";
import { count, sum, eq, and, isNotNull, sql } from "drizzle-orm";
import {
  db,
  usersTable,
  userInvestmentsTable,
  transactionsTable,
  platformSettingsTable,
} from "@workspace/db";
import { requireAdmin } from "../middlewares/auth";

const router = Router();

// ─── Public: about page content + stats (mode-aware) ─────────────────────
router.get("/about", async (_req, res): Promise<void> => {
  try {
    const rows = await db.select().from(platformSettingsTable);
    const s: Record<string, string> = {};
    for (const r of rows) s[r.key] = r.value;

    const statsMode = (s.stats_mode ?? "real") as "real" | "custom" | "animated";

    // Always fetch real stats
    const [usersCount]    = await db.select({ value: count() }).from(usersTable);
    const [activeInv]     = await db.select({ value: count() }).from(userInvestmentsTable).where(eq(userInvestmentsTable.status, "active"));
    const [completedInv]  = await db.select({ value: count() }).from(userInvestmentsTable).where(eq(userInvestmentsTable.status, "completed"));
    const [depositsSum]   = await db.select({ value: sum(transactionsTable.amount) }).from(transactionsTable).where(and(eq(transactionsTable.type, "deposit"), eq(transactionsTable.status, "completed")));
    const [withdrawalsSum]= await db.select({ value: sum(transactionsTable.amount) }).from(transactionsTable).where(and(eq(transactionsTable.type, "withdrawal"), eq(transactionsTable.status, "completed")));
    const countriesRows   = await db.selectDistinct({ country: usersTable.country }).from(usersTable).where(isNotNull(usersTable.country));
    const countriesServed = countriesRows.filter((r) => r.country).length;

    const realStats = {
      totalUsers:            Number(usersCount?.value ?? 0),
      activeInvestments:     Number(activeInv?.value ?? 0),
      completedInvestments:  Number(completedInv?.value ?? 0),
      totalDeposits:         parseFloat(depositsSum?.value ?? "0"),
      totalWithdrawals:      parseFloat(withdrawalsSum?.value ?? "0"),
      countriesServed:       countriesServed || 1,
    };

    // Custom stats (admin-configured)
    const statsCustom = {
      members:              Number(s.stats_members ?? 0) || realStats.totalUsers,
      activeInvestments:    Number(s.stats_active_investments ?? 0) || realStats.activeInvestments,
      totalDeposits:        Number(s.stats_total_deposits ?? 0) || realStats.totalDeposits,
      totalWithdrawals:     Number(s.stats_total_withdrawals ?? 0) || realStats.totalWithdrawals,
      countriesServed:      Number(s.stats_countries ?? 0) || realStats.countriesServed,
      completedInvestments: Number(s.stats_completed ?? 0) || realStats.completedInvestments,
    };

    // Animated stats (min/max ranges)
    const statsAnim = {
      members:              { min: Number(s.stats_anim_members_min ?? 5000),      max: Number(s.stats_anim_members_max ?? 10000) },
      activeInvestments:    { min: Number(s.stats_anim_investments_min ?? 300),   max: Number(s.stats_anim_investments_max ?? 800) },
      totalDeposits:        { min: Number(s.stats_anim_deposits_min ?? 250000),   max: Number(s.stats_anim_deposits_max ?? 500000) },
      totalWithdrawals:     { min: Number(s.stats_anim_withdrawals_min ?? 150000),max: Number(s.stats_anim_withdrawals_max ?? 400000) },
      countriesServed:      { min: Number(s.stats_anim_countries_min ?? 35),      max: Number(s.stats_anim_countries_max ?? 60) },
      completedInvestments: { min: Number(s.stats_anim_completed_min ?? 800),     max: Number(s.stats_anim_completed_max ?? 2000) },
    };

    res.json({
      content: {
        hero_title:        s.about_hero_title        || "About VaultX",
        hero_subtitle:     s.about_hero_subtitle     || "A Modern Digital Investment Platform Designed for Growth, Transparency, and Security.",
        hero_description:  s.about_hero_description  || "VaultX is a digital investment platform that provides users with access to carefully structured investment opportunities across global industries.",
        mission_text:      s.about_mission_text      || "At VaultX, our mission is to provide a secure, user-friendly, and innovative investment platform that helps members access investment opportunities with confidence.",
        security_text:     s.about_security_text     || "VaultX prioritizes platform security through account protection measures, encrypted connections, and continuous monitoring.",
        platform_name:     s.platform_name           || "VaultX",
        support_email:     s.support_email           || "",
        support_telegram:  s.support_telegram        || "",
        support_whatsapp:  s.support_whatsapp        || "",
      },
      stats:       realStats,
      statsMode,
      statsCustom,
      statsAnim,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to load about page data" });
  }
});

// ─── Admin: get about content keys ────────────────────────────────────────
router.get("/admin/about", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db.select().from(platformSettingsTable);
  const s: Record<string, string> = {};
  for (const r of rows) s[r.key] = r.value;

  res.json({
    about_hero_title:       s.about_hero_title       || "",
    about_hero_subtitle:    s.about_hero_subtitle    || "",
    about_hero_description: s.about_hero_description || "",
    about_mission_text:     s.about_mission_text     || "",
    about_security_text:    s.about_security_text    || "",
  });
});

// ─── Admin: save about content ────────────────────────────────────────────
router.put("/admin/about", requireAdmin, async (req, res): Promise<void> => {
  const allowed = ["about_hero_title", "about_hero_subtitle", "about_hero_description", "about_mission_text", "about_security_text"];
  const body = req.body as Record<string, string>;

  for (const key of allowed) {
    if (key in body) {
      await db
        .insert(platformSettingsTable)
        .values({ key, value: body[key] ?? "" })
        .onConflictDoUpdate({ target: platformSettingsTable.key, set: { value: body[key] ?? "", updatedAt: sql`now()` } });
    }
  }

  res.json({ success: true });
});

// ─── Admin: get platform statistics config ─────────────────────────────────
router.get("/admin/statistics", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db.select().from(platformSettingsTable);
  const s: Record<string, string> = {};
  for (const r of rows) s[r.key] = r.value;

  res.json({
    stats_mode:                 s.stats_mode                    || "real",
    stats_members:              s.stats_members                 || "",
    stats_active_investments:   s.stats_active_investments      || "",
    stats_total_deposits:       s.stats_total_deposits          || "",
    stats_total_withdrawals:    s.stats_total_withdrawals       || "",
    stats_countries:            s.stats_countries               || "",
    stats_completed:            s.stats_completed               || "",
    stats_anim_members_min:     s.stats_anim_members_min        || "5000",
    stats_anim_members_max:     s.stats_anim_members_max        || "10000",
    stats_anim_investments_min: s.stats_anim_investments_min    || "300",
    stats_anim_investments_max: s.stats_anim_investments_max    || "800",
    stats_anim_deposits_min:    s.stats_anim_deposits_min       || "250000",
    stats_anim_deposits_max:    s.stats_anim_deposits_max       || "500000",
    stats_anim_withdrawals_min: s.stats_anim_withdrawals_min    || "150000",
    stats_anim_withdrawals_max: s.stats_anim_withdrawals_max    || "400000",
    stats_anim_countries_min:   s.stats_anim_countries_min      || "35",
    stats_anim_countries_max:   s.stats_anim_countries_max      || "60",
    stats_anim_completed_min:   s.stats_anim_completed_min      || "800",
    stats_anim_completed_max:   s.stats_anim_completed_max      || "2000",
  });
});

// ─── Admin: save platform statistics config ────────────────────────────────
router.put("/admin/statistics", requireAdmin, async (req, res): Promise<void> => {
  const allowed = [
    "stats_mode",
    "stats_members", "stats_active_investments", "stats_total_deposits",
    "stats_total_withdrawals", "stats_countries", "stats_completed",
    "stats_anim_members_min", "stats_anim_members_max",
    "stats_anim_investments_min", "stats_anim_investments_max",
    "stats_anim_deposits_min", "stats_anim_deposits_max",
    "stats_anim_withdrawals_min", "stats_anim_withdrawals_max",
    "stats_anim_countries_min", "stats_anim_countries_max",
    "stats_anim_completed_min", "stats_anim_completed_max",
  ];
  const body = req.body as Record<string, string>;

  for (const key of allowed) {
    if (key in body) {
      await db
        .insert(platformSettingsTable)
        .values({ key, value: body[key] ?? "" })
        .onConflictDoUpdate({ target: platformSettingsTable.key, set: { value: body[key] ?? "", updatedAt: sql`now()` } });
    }
  }

  res.json({ success: true });
});

export default router;
