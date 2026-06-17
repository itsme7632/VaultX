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

// ─── Public: about page content + real stats ──────────────────────────────
router.get("/about", async (_req, res): Promise<void> => {
  try {
    const rows = await db.select().from(platformSettingsTable);
    const s: Record<string, string> = {};
    for (const r of rows) s[r.key] = r.value;

    const [usersCount] = await db.select({ value: count() }).from(usersTable);
    const [activeInv] = await db.select({ value: count() }).from(userInvestmentsTable).where(eq(userInvestmentsTable.status, "active"));
    const [completedInv] = await db.select({ value: count() }).from(userInvestmentsTable).where(eq(userInvestmentsTable.status, "completed"));
    const [depositsSum] = await db
      .select({ value: sum(transactionsTable.amount) })
      .from(transactionsTable)
      .where(and(eq(transactionsTable.type, "deposit"), eq(transactionsTable.status, "completed")));
    const [withdrawalsSum] = await db
      .select({ value: sum(transactionsTable.amount) })
      .from(transactionsTable)
      .where(and(eq(transactionsTable.type, "withdrawal"), eq(transactionsTable.status, "completed")));
    const countriesRows = await db
      .selectDistinct({ country: usersTable.country })
      .from(usersTable)
      .where(isNotNull(usersTable.country));
    const countriesServed = countriesRows.filter((r) => r.country).length;

    res.json({
      content: {
        hero_title: s.about_hero_title || "About VaultX",
        hero_subtitle: s.about_hero_subtitle || "A Modern Digital Investment Platform Designed for Growth, Transparency, and Security.",
        hero_description: s.about_hero_description || "VaultX is a digital investment platform that provides users with access to carefully structured investment opportunities across global industries. Our goal is to create a simple and transparent environment where members can participate in investment plans, monitor performance, and manage their portfolio through an intuitive dashboard.",
        mission_text: s.about_mission_text || "At VaultX, our mission is to provide a secure, user-friendly, and innovative investment platform that helps members access investment opportunities with confidence. We focus on transparency, reliability, and continuous platform improvement while delivering a seamless user experience.",
        security_text: s.about_security_text || "VaultX prioritizes platform security through account protection measures, encrypted connections, and continuous monitoring. Our team regularly reviews platform performance and security standards to maintain a reliable environment for our users.",
        platform_name: s.platform_name || "VaultX",
        support_email: s.support_email || "",
        support_telegram: s.support_telegram || "",
        support_whatsapp: s.support_whatsapp || "",
      },
      stats: {
        totalUsers: Number(usersCount?.value ?? 0),
        activeInvestments: Number(activeInv?.value ?? 0),
        completedInvestments: Number(completedInv?.value ?? 0),
        totalDeposits: parseFloat(depositsSum?.value ?? "0"),
        totalWithdrawals: parseFloat(withdrawalsSum?.value ?? "0"),
        countriesServed: countriesServed || 1,
      },
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
    about_hero_title: s.about_hero_title || "",
    about_hero_subtitle: s.about_hero_subtitle || "",
    about_hero_description: s.about_hero_description || "",
    about_mission_text: s.about_mission_text || "",
    about_security_text: s.about_security_text || "",
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

export default router;
