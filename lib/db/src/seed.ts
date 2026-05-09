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
} from "./schema";
import { eq, count } from "drizzle-orm";

const { Pool } = pg;

async function getDb() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });
  return { db, pool };
}

async function seedInvestmentPlans(db: ReturnType<typeof drizzle<typeof schema>>) {
  const existing = await db.select({ c: count() }).from(investmentPlansTable);
  if ((existing[0]?.c ?? 0) > 0) {
    console.log("[seed] Investment plans already seeded, skipping");
    return;
  }

  await db.insert(investmentPlansTable).values([
    {
      name: "Starter Plan",
      description: "Perfect for beginners. Low risk, steady daily returns to build your portfolio.",
      minAmount: "100.00000000",
      maxAmount: "4999.00000000",
      dailyReturnRate: "0.027500",
      minRoiRate: "0.025000",
      maxRoiRate: "0.030000",
      durationDays: 30,
      riskLevel: "low",
      features: ["Daily ROI 2.5%–3.0%", "30-day term", "Auto-compounding available", "24/7 support", "Instant activation"],
      isActive: true,
      isFeatured: false,
    },
    {
      name: "Growth Plan",
      description: "Our most popular plan. Balanced risk and reward for consistent portfolio growth.",
      minAmount: "5000.00000000",
      maxAmount: "24999.00000000",
      dailyReturnRate: "0.028500",
      minRoiRate: "0.027000",
      maxRoiRate: "0.030000",
      durationDays: 60,
      riskLevel: "medium",
      features: ["Daily ROI 2.7%–3.0%", "60-day term", "Auto-compounding available", "Priority support", "Referral bonus eligible"],
      isActive: true,
      isFeatured: true,
    },
    {
      name: "Elite Plan",
      description: "For serious investors. Maximum returns with our highest-performing strategy.",
      minAmount: "25000.00000000",
      maxAmount: "500000.00000000",
      dailyReturnRate: "0.030000",
      minRoiRate: "0.028000",
      maxRoiRate: "0.035000",
      durationDays: 90,
      riskLevel: "high",
      features: ["Daily ROI 2.8%–3.5%", "90-day term", "Auto-compounding available", "Dedicated account manager", "Weekly performance reports", "VIP withdrawals"],
      isActive: true,
      isFeatured: false,
    },
  ]);

  console.log("[seed] Investment plans seeded ✓");
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
    return;
  }

  const settings: Array<{ key: string; value: string }> = [
    { key: "platform_name", value: "VaultX" },
    { key: "platform_tagline", value: "Secure Crypto Investment Platform" },
    { key: "platform_description", value: "VaultX is a secure, trusted crypto investment platform delivering daily ROI of 2.5%–3.5% to thousands of investors worldwide." },
    { key: "support_email", value: "support@vaultx.io" },
    { key: "support_whatsapp", value: "+1 (800) 555-0100" },
    { key: "support_telegram", value: "@VaultXSupport" },
    { key: "support_response_time", value: "Within 24 hours" },
    { key: "min_withdrawal", value: "10" },
    { key: "withdrawal_fee_percent", value: "1.5" },
    { key: "min_deposit", value: "10" },
    { key: "referral_commission_rate", value: "5" },
    { key: "maintenance_mode", value: "false" },
    { key: "registration_enabled", value: "true" },
    { key: "kyc_required_for_withdrawal", value: "false" },
    { key: "max_withdrawal_per_day", value: "50000" },
    { key: "admin_email", value: "admin@vaultx.io" },
    { key: "site_url", value: "https://vaultx.replit.app" },
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
      title: "Welcome to VaultX — Your Trusted Crypto Investment Platform",
      content: `We're thrilled to welcome you to VaultX, the next-generation crypto investment platform designed to help you grow your wealth with confidence.

**What is VaultX?**
VaultX is a secure, transparent crypto investment platform that delivers consistent daily returns of 2.5%–3.5% through our proprietary trading algorithms and market strategies.

**Why choose VaultX?**
- **Daily ROI**: Earn 2.5%–3.5% every single day on your invested capital
- **Multiple Plans**: Choose from Starter, Growth, and Elite investment plans
- **Instant Deposits**: Multiple crypto networks accepted (USDT TRC20, ERC20, BTC, ETH, BNB)
- **Fast Withdrawals**: Processed within 24–48 hours
- **Referral Program**: Earn 5% commission on your referrals' profits
- **24/7 Support**: Our team is always available to assist you

**Getting Started**
1. Create your free account
2. Complete identity verification (KYC)
3. Make your first deposit
4. Choose an investment plan
5. Watch your earnings grow daily!

Start your journey to financial freedom with VaultX today.`,
      excerpt: "Welcome to VaultX — the secure crypto investment platform delivering 2.5%–3.5% daily ROI. Learn about our plans, features, and how to get started.",
      category: "announcement",
      isFeatured: true,
      isPublished: true,
      publishedAt: now,
    },
    {
      title: "New Investment Plans Launched — Up to 3.5% Daily ROI",
      content: `We're excited to announce the launch of our updated investment plans, now offering even higher daily returns for our valued investors.

**Updated Plan Structure:**

🟢 **Starter Plan** (Low Risk)
- Minimum: $100 | Maximum: $4,999
- Daily ROI: 2.5%–3.0%
- Duration: 30 days
- Best for: New investors building their portfolio

🔵 **Growth Plan** (Medium Risk) — MOST POPULAR
- Minimum: $5,000 | Maximum: $24,999
- Daily ROI: 2.7%–3.0%
- Duration: 60 days
- Best for: Experienced investors seeking steady growth

🔴 **Elite Plan** (Higher Returns)
- Minimum: $25,000 | Maximum: $500,000
- Daily ROI: 2.8%–3.5%
- Duration: 90 days
- Best for: Serious investors maximizing returns

**Auto-Compound Feature**
All plans now support auto-compounding! Enable it to automatically reinvest your daily earnings and maximize your returns through the power of compound interest.

Invest wisely, invest with VaultX.`,
      excerpt: "VaultX launches updated investment plans with up to 3.5% daily ROI. Starter, Growth, and Elite plans now available with auto-compounding.",
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

**What This Means for VaultX Investors**
Our trading algorithms are designed to profit from market volatility in both directions. Whether markets are rising or falling, our strategies continue to generate the consistent returns our investors expect.

**VaultX Platform Stats:**
- Total Users: Growing daily
- Average Daily ROI Delivered: 2.8%
- Total Withdrawals Processed: $0 delays
- Uptime: 99.99%

Stay informed, stay invested. The VaultX team is working around the clock to ensure your investments continue to perform.`,
      excerpt: "Bitcoin surges 8.3% this week as institutional demand grows. See how market movements affect VaultX's investment strategies.",
      category: "market",
      isFeatured: false,
      isPublished: true,
      publishedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
    },
    {
      title: "Security Update: Enhanced 2FA and Account Protection",
      content: `Your security is our top priority. We've implemented several new security features to better protect your VaultX account and funds.

**New Security Features:**

🔐 **Enhanced Two-Factor Authentication**
We now support TOTP-based 2FA via Google Authenticator, Authy, and other compatible apps. Enable it in your Security settings.

🔒 **Withdrawal Lock**
An additional verification step for large withdrawals to prevent unauthorized access.

🌐 **IP Monitoring**
We track and log all login attempts and flag suspicious activity automatically.

📧 **Email Alerts**
Real-time email notifications for logins, deposits, withdrawals, and account changes.

**Best Practices to Keep Your Account Safe:**
1. Enable 2FA immediately
2. Use a strong, unique password (12+ characters)
3. Never share your login credentials
4. Always log out on shared devices
5. Check your login history regularly

If you notice any suspicious activity, contact our support team immediately at support@vaultx.io.`,
      excerpt: "VaultX launches enhanced security features including improved 2FA, withdrawal locks, IP monitoring, and real-time email alerts.",
      category: "security",
      isFeatured: false,
      isPublished: true,
      publishedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    },
  ]);

  console.log("[seed] News posts seeded ✓");
}

async function seedAdminUser(db: ReturnType<typeof drizzle<typeof schema>>) {
  const existing = await db
    .select({ c: count() })
    .from(usersTable)
    .where(eq(usersTable.email, "admin@vaultx.io"));

  if ((existing[0]?.c ?? 0) > 0) {
    console.log("[seed] Admin user already exists, skipping");
    return null;
  }

  const passwordHash = await bcrypt.hash("Admin@12345", 12);

  const [admin] = await db
    .insert(usersTable)
    .values({
      displayId: "000001",
      fullName: "VaultX Admin",
      username: "admin",
      email: "admin@vaultx.io",
      passwordHash,
      referralCode: "ADMIN001",
      kycStatus: "approved",
      isAdmin: true,
      isVerified: true,
      isActive: true,
      country: "US",
    })
    .returning();

  await db.insert(walletsTable).values({ userId: admin.id });

  await db.insert(walletAddressesTable).values([
    { userId: admin.id, network: "TRC20", address: "TN3W4H6rK2ce4vX9YnFQHwKx7X8rHBdFW" },
    { userId: admin.id, network: "ERC20", address: "0x742d35Cc6634C0532925a3b8D4C9F7f4b62Ee8E" },
    { userId: admin.id, network: "BTC", address: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh" },
    { userId: admin.id, network: "ETH", address: "0x742d35Cc6634C0532925a3b8D4C9F7f4b62Ee8E" },
    { userId: admin.id, network: "BSC", address: "0x742d35Cc6634C0532925a3b8D4C9F7f4b62Ee8E" },
  ]);

  console.log("[seed] Admin user seeded ✓ (admin@vaultx.io / Admin@12345)");
  return admin.id;
}

async function seedDemoUser(db: ReturnType<typeof drizzle<typeof schema>>) {
  const existing = await db
    .select({ c: count() })
    .from(usersTable)
    .where(eq(usersTable.email, "demo@vaultx.io"));

  if ((existing[0]?.c ?? 0) > 0) {
    console.log("[seed] Demo user already exists, skipping");
    return;
  }

  const passwordHash = await bcrypt.hash("Demo@12345", 12);

  const [demo] = await db
    .insert(usersTable)
    .values({
      displayId: "100042",
      fullName: "Alex Johnson",
      username: "alexj",
      email: "demo@vaultx.io",
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
    .returning();

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
    .where(eq(investmentPlansTable.name, "Starter Plan"))
    .limit(1);

  const [plan2] = await db
    .select()
    .from(investmentPlansTable)
    .where(eq(investmentPlansTable.name, "Growth Plan"))
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
      note: `Invested 2000 USDT in Starter Plan`,
      createdAt: new Date(thirtyDaysAgo.getTime() + 3 * 24 * 60 * 60 * 1000),
    } as any,
    {
      userId: demo.id,
      type: "investment",
      amount: "5000.00000000",
      status: "completed",
      note: `Invested 5000 USDT in Growth Plan`,
      createdAt: new Date(thirtyDaysAgo.getTime() + 3 * 24 * 60 * 60 * 1000),
    } as any,
    {
      userId: demo.id,
      type: "earning",
      amount: "55.00000000",
      status: "completed",
      note: "Daily ROI 2.75% from Starter Plan",
      createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
    } as any,
    {
      userId: demo.id,
      type: "earning",
      amount: "142.50000000",
      status: "completed",
      note: "Daily ROI 2.85% from Growth Plan",
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
      message: "Your 2000 USDT investment in Starter Plan has started. Expected daily ROI: 2.75%",
      isRead: true,
    },
    {
      userId: demo.id,
      type: "earning",
      title: "Daily ROI Credited",
      message: "+197.50 USDT (2.85% ROI) credited to your Growth Plan investment.",
      isRead: false,
    },
    {
      userId: demo.id,
      type: "announcement",
      title: "Welcome to VaultX!",
      message: "Thank you for joining VaultX. Your account is fully verified. Start investing today and earn daily returns of 2.5%–3.5%.",
      isRead: false,
    },
  ]);

  console.log("[seed] Demo user seeded ✓ (demo@vaultx.io / Demo@12345)");
}

export async function runSeed(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set");
  }

  const { db, pool } = await getDb();

  try {
    await seedInvestmentPlans(db);
    await seedDepositNetworks(db);
    await seedPlatformSettings(db);
    await seedNews(db);
    await seedAdminUser(db);
    await seedDemoUser(db);
    console.log("[seed] Database seeding complete ✓");
  } finally {
    await pool.end();
  }
}
