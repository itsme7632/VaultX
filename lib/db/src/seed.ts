import bcrypt from "bcryptjs";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
import {
  usersTable,
  walletsTable,
  walletAddressesTable,
  investmentPlansTable,
  userInvestmentsTable,
  transactionsTable,
  depositNetworksTable,
  platformSettingsTable,
  newsPostsTable,
  notificationsTable,
  communityChannelsTable,
} from "./schema";
import { eq, count, or } from "drizzle-orm";

const { Pool } = pg;

async function getDb() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });
  return { db, pool };
}

function getOpportunities() {
  const now = new Date();
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000);
  const daysFromNow = (d: number) => new Date(now.getTime() + d * 86400000);

  return [
    {
      name: "Digital Asset Allocation",
      description: "A diversified approach to digital asset investment, allocating capital across top-tier crypto assets for steady, low-risk daily returns.",
      minAmount: "100.00000000",
      maxAmount: "9999.00000000",
      dailyReturnRate: "0.015000",
      minRoiRate: "0.013000",
      maxRoiRate: "0.017000",
      durationDays: 30,
      riskLevel: "low",
      features: ["Daily ROI 1.3%–1.7%", "30-day term", "Auto-compounding available", "Instant activation", "24/7 support"],
      isActive: true,
      isFeatured: false,
      category: "DeFi",
      fundingGoal: "500000.00000000",
      currentFunding: "342150.00000000",
      status: "active",
      colorTheme: "blue",
      autoCompoundAvailable: true,
      startDate: daysAgo(30),
      endDate: daysFromNow(90),
      sortOrder: 1,
    },
    {
      name: "AI Infrastructure",
      description: "Capitalise on the AI revolution by investing in infrastructure-backed crypto assets powering next-generation artificial intelligence networks.",
      minAmount: "100.00000000",
      maxAmount: "49999.00000000",
      dailyReturnRate: "0.015000",
      minRoiRate: "0.013000",
      maxRoiRate: "0.017000",
      durationDays: 45,
      riskLevel: "medium",
      features: ["Daily ROI 1.3%–1.7%", "45-day term", "Auto-compounding available", "Priority support", "Referral bonus eligible"],
      isActive: true,
      isFeatured: true,
      category: "Technology",
      fundingGoal: "2000000.00000000",
      currentFunding: "1245000.00000000",
      status: "featured",
      colorTheme: "purple",
      autoCompoundAvailable: true,
      startDate: daysAgo(14),
      endDate: daysFromNow(75),
      sortOrder: 2,
    },
    {
      name: "Technology Expansion",
      description: "High-growth opportunity targeting emerging blockchain technologies and Layer-2 scaling solutions driving the next wave of crypto adoption.",
      minAmount: "100.00000000",
      maxAmount: "99999.00000000",
      dailyReturnRate: "0.015000",
      minRoiRate: "0.013000",
      maxRoiRate: "0.017000",
      durationDays: 60,
      riskLevel: "medium",
      features: ["Daily ROI 1.3%–1.7%", "60-day term", "Auto-compounding available", "Dedicated support", "Performance reports"],
      isActive: true,
      isFeatured: false,
      category: "Growth",
      fundingGoal: null,
      currentFunding: "0.00000000",
      status: "trending",
      colorTheme: "green",
      autoCompoundAvailable: true,
      startDate: null,
      endDate: null,
      sortOrder: 3,
    },
    {
      name: "Market Liquidity Program",
      description: "Earn consistent returns by providing liquidity to top-tier decentralised exchanges and market-making protocols with institutional-grade strategies.",
      minAmount: "100.00000000",
      maxAmount: "24999.00000000",
      dailyReturnRate: "0.015000",
      minRoiRate: "0.013000",
      maxRoiRate: "0.017000",
      durationDays: 30,
      riskLevel: "low",
      features: ["Daily ROI 1.3%–1.7%", "30-day term", "Auto-compounding available", "Flexible entry", "Liquidity rewards"],
      isActive: true,
      isFeatured: false,
      category: "Liquidity",
      fundingGoal: "1000000.00000000",
      currentFunding: "678000.00000000",
      status: "funding",
      colorTheme: "cyan",
      autoCompoundAvailable: true,
      startDate: daysAgo(7),
      endDate: daysFromNow(53),
      sortOrder: 4,
    },
    {
      name: "Strategic Growth Allocation",
      description: "For serious investors seeking maximum returns. Our flagship high-yield strategy combines quant trading with on-chain yield generation.",
      minAmount: "100.00000000",
      maxAmount: "500000.00000000",
      dailyReturnRate: "0.015000",
      minRoiRate: "0.013000",
      maxRoiRate: "0.017000",
      durationDays: 90,
      riskLevel: "high",
      features: ["Daily ROI 1.3%–1.7%", "90-day term", "Auto-compounding available", "Dedicated account manager", "VIP withdrawals", "Weekly performance reports"],
      isActive: true,
      isFeatured: false,
      category: "Premium",
      fundingGoal: "5000000.00000000",
      currentFunding: "2100000.00000000",
      status: "active",
      colorTheme: "gold",
      autoCompoundAvailable: true,
      startDate: daysAgo(60),
      endDate: daysFromNow(120),
      sortOrder: 5,
    },
  ];
}

const OLD_PLAN_NAMES = ["Starter Plan", "Growth Plan", "Elite Plan"];

async function seedInvestmentPlans(db: ReturnType<typeof drizzle<typeof schema>>) {
  const existing = await db.select({ c: count() }).from(investmentPlansTable);
  if ((existing[0]?.c ?? 0) > 0) {
    console.log("[seed] Investment plans already seeded, skipping");
    return;
  }

  await db.insert(investmentPlansTable).values(getOpportunities() as any[]);
  console.log("[seed] Investment plans seeded ✓");
}

/**
 * Always runs. Migrates old Starter/Growth/Elite plans to new opportunity names
 * and inserts any missing new plans.
 */
async function ensureOpportunities(db: ReturnType<typeof drizzle<typeof schema>>) {
  const opportunities = getOpportunities();
  const allPlans = await db.select({ id: investmentPlansTable.id, name: investmentPlansTable.name }).from(investmentPlansTable);
  const nameToId = Object.fromEntries(allPlans.map((p) => [p.name, p.id]));

  const oldPlanMapping: Record<string, ReturnType<typeof getOpportunities>[number]> = {
    "Starter Plan": opportunities[0],
    "Growth Plan": opportunities[1],
    "Elite Plan": opportunities[2],
  };

  for (const [oldName, newPlanData] of Object.entries(oldPlanMapping)) {
    if (nameToId[oldName] !== undefined && nameToId[newPlanData.name] === undefined) {
      const planId = nameToId[oldName];
      await db.update(investmentPlansTable).set(newPlanData as any).where(eq(investmentPlansTable.id, planId));
      console.log(`[seed] Migrated plan "${oldName}" → "${newPlanData.name}" ✓`);
    }
  }

  const refreshedPlans = await db.select({ name: investmentPlansTable.name }).from(investmentPlansTable);
  const existingNames = new Set(refreshedPlans.map((p) => p.name));

  for (const plan of opportunities) {
    if (!existingNames.has(plan.name)) {
      await db.insert(investmentPlansTable).values(plan as any);
      console.log(`[seed] Inserted missing plan "${plan.name}" ✓`);
    }
  }

  console.log("[seed] Opportunities verified ✓");
}

async function seedDepositNetworks(db: ReturnType<typeof drizzle<typeof schema>>) {
  const existing = await db.select({ c: count() }).from(depositNetworksTable);
  if ((existing[0]?.c ?? 0) > 0) {
    console.log("[seed] Deposit networks already seeded, skipping");
    return;
  }

  await db.insert(depositNetworksTable).values([
    {
      network: "TRC20",
      label: "USDT (TRC20)",
      walletAddress: "TN3W4H6rK2ce4vX9YnFQHwKx7X8rHBdFW",
      minDeposit: "10.00000000",
      networkFee: "1.00000000",
      confirmationTime: "5–15 minutes",
      isActive: true,
    },
    {
      network: "ERC20",
      label: "USDT (ERC20)",
      walletAddress: "0x742d35Cc6634C0532925a3b8D4C9F7f4b62Ee8E",
      minDeposit: "50.00000000",
      networkFee: "5.00000000",
      confirmationTime: "10–30 minutes",
      isActive: true,
    },
    {
      network: "BTC",
      label: "Bitcoin (BTC)",
      walletAddress: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
      minDeposit: "0.00100000",
      networkFee: "0.00005000",
      confirmationTime: "30–60 minutes",
      isActive: true,
    },
    {
      network: "ETH",
      label: "Ethereum (ETH)",
      walletAddress: "0x742d35Cc6634C0532925a3b8D4C9F7f4b62Ee8E",
      minDeposit: "0.02000000",
      networkFee: "0.00500000",
      confirmationTime: "10–20 minutes",
      isActive: true,
    },
    {
      network: "BSC",
      label: "BNB Smart Chain (BEP20)",
      walletAddress: "0x742d35Cc6634C0532925a3b8D4C9F7f4b62Ee8E",
      minDeposit: "20.00000000",
      networkFee: "0.50000000",
      confirmationTime: "5–10 minutes",
      isActive: true,
    },
  ]);

  console.log("[seed] Deposit networks seeded ✓");
}

async function seedPlatformSettings(db: ReturnType<typeof drizzle<typeof schema>>) {
  const existing = await db.select({ c: count() }).from(platformSettingsTable);
  if ((existing[0]?.c ?? 0) > 0) {
    console.log("[seed] Platform settings already seeded, skipping");

    await db
      .insert(platformSettingsTable)
      .values({ key: "kyc_enabled", value: "true" })
      .onConflictDoNothing();

    return;
  }

  const settings: Array<{ key: string; value: string }> = [
    { key: "platform_name", value: "Wexora" },
    { key: "platform_tagline", value: "Global Opportunities. Smarter Growth." },
    { key: "platform_description", value: "Wexora Global is a secure digital investment platform providing access to capital allocation opportunities across global industries. Join thousands of participants growing their portfolios worldwide." },
    { key: "support_email", value: "support@wexoraglobal.com" },
    { key: "support_whatsapp", value: "+1 (800) 555-0100" },
    { key: "support_telegram", value: "@WexoraGlobal" },
    { key: "support_response_time", value: "Within 24 hours" },
    { key: "min_withdrawal", value: "10" },
    { key: "withdrawal_fee_percent", value: "1.5" },
    { key: "min_deposit", value: "10" },
    { key: "referral_commission_rate", value: "5" },
    { key: "maintenance_mode", value: "false" },
    { key: "registration_enabled", value: "true" },
    { key: "kyc_required_for_withdrawal", value: "false" },
    { key: "kyc_enabled", value: "true" },
    { key: "max_withdrawal_per_day", value: "50000" },
    { key: "admin_email", value: "admin@wexoraglobal.com" },
    { key: "site_url", value: "https://wexoraglobal.com" },
    { key: "withdrawal_processing_time", value: "24–48 hours" },
    { key: "deposit_confirmation_blocks", value: "6" },
    { key: "roi_distribution_time", value: "Daily at 00:00 UTC" },
  ];

  await db.insert(platformSettingsTable).values(settings);
  console.log("[seed] Platform settings seeded ✓");
}

async function seedNews(db: ReturnType<typeof drizzle<typeof schema>>) {
  const existing = await db.select({ c: count() }).from(newsPostsTable);
  if ((existing[0]?.c ?? 0) > 0) {
    console.log("[seed] News posts already seeded, skipping");
    return;
  }

  const now = new Date();

  await db.insert(newsPostsTable).values([
    {
      title: "Welcome to Wexora — Your Trusted Crypto Investment Platform",
      content: `We're thrilled to welcome you to Wexora, the next-generation crypto investment platform designed to help you grow your wealth with confidence.

**What is Wexora?**
Wexora is a secure, transparent crypto investment platform that delivers consistent daily returns of 1.3%–1.7% through our proprietary trading algorithms and market strategies.

**Why choose Wexora?**
- **Daily ROI**: Earn 1.3%–1.7% every single day on your invested capital
- **Multiple Opportunities**: Choose from five curated investment opportunities
- **Instant Deposits**: Multiple crypto networks accepted (USDT TRC20, ERC20, BTC, ETH, BNB)
- **Fast Withdrawals**: Processed within 24–48 hours
- **Referral Program**: Earn 5% commission on your referrals' profits
- **24/7 Support**: Our team is always available to assist you

**Getting Started**
1. Create your free account
2. Complete identity verification (KYC)
3. Make your first deposit
4. Choose an investment opportunity
5. Watch your earnings grow daily!

Start your journey to financial freedom with Wexora today.`,
      excerpt: "Welcome to Wexora — the secure crypto investment platform delivering 1.3%–1.7% daily ROI. Learn about our opportunities, features, and how to get started.",
      category: "announcement",
      isFeatured: true,
      isPublished: true,
      publishedAt: now,
    },
    {
      title: "Five New Investment Opportunities Launched — Up to 1.7% Daily ROI",
      content: `We're excited to announce five curated investment opportunities, each designed for a different investor profile.

**Investment Opportunities:**

🔵 **Digital Asset Allocation** (Low Risk)
- Minimum: $100 | Maximum: $9,999
- Daily ROI: 1.3%–1.7%
- Duration: 30 days

🟣 **AI Infrastructure** (Medium Risk) — FEATURED
- Minimum: $100 | Maximum: $49,999
- Daily ROI: 1.3%–1.7%
- Duration: 45 days

🟢 **Technology Expansion** (Medium Risk) — TRENDING
- Minimum: $100 | Maximum: $99,999
- Daily ROI: 1.3%–1.7%
- Duration: 60 days

🩵 **Market Liquidity Program** (Low Risk) — FUNDING
- Minimum: $100 | Maximum: $24,999
- Daily ROI: 1.3%–1.7%
- Duration: 30 days

🏆 **Strategic Growth Allocation** (High Returns)
- Minimum: $100 | Maximum: $500,000
- Daily ROI: 1.3%–1.7%
- Duration: 90 days

Invest wisely, invest with Wexora.`,
      excerpt: "Wexora launches five curated investment opportunities with up to 1.7% daily ROI and auto-compounding support.",
      category: "investment",
      isFeatured: false,
      isPublished: true,
      publishedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
    },
    {
      title: "Crypto Market Update — Bitcoin Surges as Institutional Demand Grows",
      content: `The cryptocurrency market has seen significant positive momentum this week, with Bitcoin leading the charge amid growing institutional interest.

**Market Highlights:**
- Bitcoin (BTC) up 8.3% this week, approaching key resistance levels
- Ethereum (ETH) gains 6.1% following positive network upgrade news
- USDT remains stable, continuing its role as the preferred stable store of value
- BNB up 4.7% as Binance Smart Chain DeFi activity increases

**What This Means for Wexora Investors**
Our trading algorithms are designed to profit from market volatility in both directions. Whether markets are rising or falling, our strategies continue to generate the consistent returns our investors expect.

Stay informed, stay invested. The Wexora team is working around the clock to ensure your investments continue to perform.`,
      excerpt: "Bitcoin surges 8.3% this week as institutional demand grows. See how market movements affect Wexora's investment strategies.",
      category: "market",
      isFeatured: false,
      isPublished: true,
      publishedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
    },
    {
      title: "Security Update: Enhanced 2FA and Account Protection",
      content: `Your security is our top priority. We've implemented several new security features to better protect your Wexora account and funds.

**New Security Features:**

🔐 **Enhanced Two-Factor Authentication**
We now support TOTP-based 2FA via Google Authenticator, Authy, and other compatible apps. Enable it in your Security settings.

🔒 **Withdrawal Lock**
An additional verification step for large withdrawals to prevent unauthorized access.

🌐 **IP Monitoring**
We track and log all login attempts and flag suspicious activity automatically.

**Best Practices to Keep Your Account Safe:**
1. Enable 2FA immediately
2. Use a strong, unique password (12+ characters)
3. Never share your login credentials
4. Always log out on shared devices

If you notice any suspicious activity, contact our support team immediately at support@wexoraglobal.com.`,
      excerpt: "Wexora launches enhanced security features including improved 2FA, withdrawal locks, IP monitoring, and real-time email alerts.",
      category: "security",
      isFeatured: false,
      isPublished: true,
      publishedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    },
  ]);

  console.log("[seed] News posts seeded ✓");
}

async function ensureAdminAccount(db: ReturnType<typeof drizzle<typeof schema>>) {
  const ADMIN_EMAIL = "admin@wexoraglobal.com";
  const ADMIN_PASSWORD = "Admin123@";

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, ADMIN_EMAIL))
    .limit(1);

  if (existing) {
    await db
      .update(usersTable)
      .set({
        passwordHash,
        isAdmin: true,
        isActive: true,
        isVerified: true,
        kycStatus: "approved",
      })
      .where(eq(usersTable.email, ADMIN_EMAIL));

    await db
      .insert(walletsTable)
      .values({ userId: existing.id })
      .onConflictDoNothing();

    console.log("[seed] Admin account verified/updated ✓ (admin@wexoraglobal.com / Admin123@)");
    return;
  }

  const candidateUsernames = ["admin", "wexoraadmin", "superadmin", "admin_wx"];
  let chosenUsername = "admin_wx";
  for (const candidate of candidateUsernames) {
    const [taken] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.username, candidate))
      .limit(1);
    if (!taken) {
      chosenUsername = candidate;
      break;
    }
  }

  let displayId = "000100";
  for (let n = 100; n < 200; n++) {
    const candidate = String(n).padStart(6, "0");
    const [taken] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.displayId, candidate))
      .limit(1);
    if (!taken) { displayId = candidate; break; }
  }

  let referralCode = "WXADMIN01";
  const [refTaken] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.referralCode, referralCode))
    .limit(1);
  if (refTaken) referralCode = "WXADMIN" + Date.now().toString().slice(-4);

  const [admin] = await db
    .insert(usersTable)
    .values({
      displayId,
      fullName: "Wexora Admin",
      username: chosenUsername,
      email: ADMIN_EMAIL,
      passwordHash,
      referralCode,
      kycStatus: "approved",
      isAdmin: true,
      isVerified: true,
      isActive: true,
      country: "US",
    })
    .returning();

  await db
    .insert(walletsTable)
    .values({ userId: admin.id })
    .onConflictDoNothing();

  console.log(`[seed] Admin account created ✓  email: ${ADMIN_EMAIL}  username: ${chosenUsername}  password: ${ADMIN_PASSWORD}`);
}

async function seedDemoUser(db: ReturnType<typeof drizzle<typeof schema>>) {
  const existing = await db
    .select({ c: count() })
    .from(usersTable)
    .where(
      or(
        eq(usersTable.email, "demo@wexoraglobal.com"),
        eq(usersTable.username, "alexj"),
        eq(usersTable.displayId, "100042"),
        eq(usersTable.referralCode, "ALEXJ42"),
      )
    );

  if ((existing[0]?.c ?? 0) > 0) {
    console.log("[seed] Demo user already exists, skipping");
    return;
  }

  const passwordHash = await bcrypt.hash("Demo@12345", 12);

  const inserted = await db
    .insert(usersTable)
    .values({
      displayId: "100042",
      fullName: "Alex Johnson",
      username: "alexj",
      email: "demo@wexoraglobal.com",
      passwordHash,
      referralCode: "ALEXJ42",
      kycStatus: "approved",
      isAdmin: false,
      isVerified: true,
      isActive: true,
      country: "US",
      whatsapp: "+1 555 010 0000",
      whatsappLocked: true,
    })
    .onConflictDoNothing()
    .returning();

  const demo = inserted[0];
  if (!demo) {
    console.log("[seed] Demo user already exists (conflict), skipping");
    return;
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  await db.insert(walletsTable).values({
    userId: demo.id,
    balance: "4823.45000000",
    totalDeposited: "10000.00000000",
    totalWithdrawn: "1250.00000000",
    totalEarnings: "3567.89000000",
  });

  await db.insert(walletAddressesTable).values([
    { userId: demo.id, network: "TRC20", address: "TN3W4H6rK2ce4vX9YnFQHwKx7X8rHBdFW" },
    { userId: demo.id, network: "ERC20", address: "0x742d35Cc6634C0532925a3b8D4C9F7f4b62Ee8E" },
    { userId: demo.id, network: "BTC", address: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh" },
    { userId: demo.id, network: "ETH", address: "0x742d35Cc6634C0532925a3b8D4C9F7f4b62Ee8E" },
    { userId: demo.id, network: "BSC", address: "0x742d35Cc6634C0532925a3b8D4C9F7f4b62Ee8E" },
  ]);

  const [plan1] = await db
    .select()
    .from(investmentPlansTable)
    .where(eq(investmentPlansTable.name, "Digital Asset Allocation"))
    .limit(1);

  const [plan2] = await db
    .select()
    .from(investmentPlansTable)
    .where(eq(investmentPlansTable.name, "AI Infrastructure"))
    .limit(1);

  if (plan1 && plan2) {
    const end1 = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
    const end2 = new Date(now.getTime() + 35 * 24 * 60 * 60 * 1000);

    await db.insert(userInvestmentsTable).values([
      {
        userId: demo.id,
        planId: plan1.id,
        amount: "2000.00000000",
        pendingEarnings: "142.50000000",
        totalEarned: "1350.00000000",
        dailyReturnRate: "0.027500",
        autoCompound: false,
        status: "active",
        startDate: thirtyDaysAgo,
        endDate: end1,
        lastEarningAt: new Date(now.getTime() - 3 * 60 * 60 * 1000),
      },
      {
        userId: demo.id,
        planId: plan2.id,
        amount: "5000.00000000",
        pendingEarnings: "390.00000000",
        totalEarned: "2217.89000000",
        dailyReturnRate: "0.028500",
        autoCompound: true,
        status: "active",
        startDate: thirtyDaysAgo,
        endDate: end2,
        lastEarningAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      },
    ]);
  }

  await db.insert(transactionsTable).values([
    {
      userId: demo.id,
      type: "deposit",
      amount: "5000.00000000",
      status: "completed",
      network: "TRC20",
      txHash: "abc123def456abc123def456abc123def456abc123def456abc123def456abc1",
      note: "Initial deposit via USDT TRC20",
      createdAt: new Date(thirtyDaysAgo.getTime() + 1 * 60 * 60 * 1000),
    } as any,
    {
      userId: demo.id,
      type: "deposit",
      amount: "5000.00000000",
      status: "completed",
      network: "ERC20",
      txHash: "def789ghi012def789ghi012def789ghi012def789ghi012def789ghi012def7",
      note: "Second deposit via USDT ERC20",
      createdAt: new Date(thirtyDaysAgo.getTime() + 2 * 24 * 60 * 60 * 1000),
    } as any,
    {
      userId: demo.id,
      type: "investment",
      amount: "2000.00000000",
      status: "completed",
      note: `Invested 2000 USDT in Digital Asset Allocation`,
      createdAt: new Date(thirtyDaysAgo.getTime() + 3 * 24 * 60 * 60 * 1000),
    } as any,
    {
      userId: demo.id,
      type: "investment",
      amount: "5000.00000000",
      status: "completed",
      note: `Invested 5000 USDT in AI Infrastructure`,
      createdAt: new Date(thirtyDaysAgo.getTime() + 3 * 24 * 60 * 60 * 1000),
    } as any,
    {
      userId: demo.id,
      type: "earning",
      amount: "55.00000000",
      status: "completed",
      note: "Daily ROI 1.5% from Digital Asset Allocation",
      createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
    } as any,
    {
      userId: demo.id,
      type: "earning",
      amount: "142.50000000",
      status: "completed",
      note: "Daily ROI 1.5% from AI Infrastructure",
      createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
    } as any,
    {
      userId: demo.id,
      type: "withdrawal",
      amount: "1250.00000000",
      fee: "18.75000000",
      status: "completed",
      network: "TRC20",
      address: "TEgkfW7Y8abc123def456",
      note: "Withdrawal via USDT TRC20 (fee: 18.75 USDT)",
      createdAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    } as any,
  ]);

  await db.insert(notificationsTable).values([
    {
      userId: demo.id,
      type: "transaction",
      title: "Deposit Confirmed",
      message: "Your deposit of 5000 USDT via TRC20 has been confirmed and credited to your wallet.",
      isRead: true,
    },
    {
      userId: demo.id,
      type: "investment",
      title: "Investment Started",
      message: "Your 2000 USDT investment in Digital Asset Allocation has started. Expected daily ROI: 1.5%",
      isRead: true,
    },
    {
      userId: demo.id,
      type: "earning",
      title: "Daily ROI Credited",
      message: "+30.00 USDT (1.5% ROI) credited to your AI Infrastructure investment.",
      isRead: false,
    },
    {
      userId: demo.id,
      type: "announcement",
      title: "Welcome to Wexora!",
      message: "Thank you for joining Wexora. Your account is fully verified. Start investing today and earn daily returns of 1.3%–1.7%.",
      isRead: false,
    },
  ]);

  console.log("[seed] Demo user seeded ✓ (demo@wexoraglobal.com / Demo@12345)");
}

async function seedCommunityChannels(db: ReturnType<typeof drizzle<typeof schema>>) {
  const channels = [
    { name: "Announcements", type: "announcement", description: "Official announcements from the Wexora team", isLocked: false, sortOrder: 0 },
    { name: "General Chat", type: "chat", description: "Open discussion for all Wexora members", isLocked: false, sortOrder: 1 },
    { name: "Community Support", type: "support", description: "Get help from fellow community members", isLocked: false, sortOrder: 2 },
  ];

  for (const ch of channels) {
    await db.insert(communityChannelsTable).values(ch as any).onConflictDoNothing();
  }
  console.log("[seed] Community channels verified ✓");
}

async function ensureSalarySettings(db: ReturnType<typeof drizzle<typeof schema>>) {
  const defaults = [
    { key: "salary_program_enabled", value: "true" },
    { key: "salary_tier1_volume", value: "1500" },
    { key: "salary_tier1_amount", value: "100" },
    { key: "salary_tier2_volume", value: "3500" },
    { key: "salary_tier2_amount", value: "300" },
  ];
  for (const s of defaults) {
    await db.insert(platformSettingsTable).values(s).onConflictDoNothing();
  }
  console.log("[seed] Salary settings verified ✓");
}

export async function runSeed(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set");
  }

  const { db, pool } = await getDb();

  try {
    await seedInvestmentPlans(db);
    await ensureOpportunities(db);
    await seedDepositNetworks(db);
    await seedPlatformSettings(db);
    await ensureSalarySettings(db);
    await seedNews(db);
    await ensureAdminAccount(db);
    await seedDemoUser(db);
    await seedCommunityChannels(db);
    console.log("[seed] Database seeding complete ✓");
  } finally {
    await pool.end();
  }
}
