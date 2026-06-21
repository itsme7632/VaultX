import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Copy, Check, Share2, Users, DollarSign, Trophy,
  TrendingUp, Wallet, ChevronDown, ChevronUp, ArrowDownCircle,
  GitBranch, BarChart3, Globe, Star, Zap,
} from "lucide-react";
import {
  useGetReferralStats, getGetReferralStatsQueryKey,
  useGetReferralHistory, getGetReferralHistoryQueryKey,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatUSDT } from "@/lib/format";

// ─── Claim action ─────────────────────────────────────────────────────────────

async function claimReferralEarnings() {
  const res = await fetch("/api/referrals/claim", { method: "POST", credentials: "include" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? data.error ?? "Failed to claim");
  return data as { success: boolean; amountClaimed: number };
}

async function fetchCommunity() {
  const res = await fetch("/api/referrals/community", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load community data");
  return res.json() as Promise<{
    communityReferrals: number;
    activeReferrers: number;
    rewardsDistributed: number;
    weeklyGrowthPct: number;
    monthlyGrowthPct: number;
    leaderboard: { rank: number; username: string; totalReferrals: number; totalEarned: number; isReal: boolean }[];
    dailyChart: number[];
    weeklyChart: number[];
    monthlyChart: number[];
    referralSources: { source: string; count: number; pct: number }[];
    mode: string;
    isHybrid: boolean;
    realStats?: { referrals: number; activeReferrers: number; rewards: number };
  }>;
}

// ─── Mini bar chart ───────────────────────────────────────────────────────────

function MiniBarChart({ data, color = "#8b5cf6", labels }: { data: number[]; color?: string; labels?: string[] }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-1 h-14 w-full">
      {data.map((v, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
          <div
            className="w-full rounded-t-sm transition-all duration-500"
            style={{ height: `${Math.round((v / max) * 100)}%`, background: color, minHeight: v > 0 ? 3 : 1, opacity: v > 0 ? 1 : 0.2 }}
          />
          {labels && (
            <span className="text-[8px] text-muted-foreground leading-none">{labels[i]}</span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Tier badge ───────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
  Diamond: { color: "text-cyan-600", bg: "bg-cyan-50 border-cyan-200", icon: "💎" },
  Gold:    { color: "text-amber-600", bg: "bg-amber-50 border-amber-200", icon: "🥇" },
  Silver:  { color: "text-slate-500", bg: "bg-slate-50 border-slate-200", icon: "🥈" },
  Bronze:  { color: "text-orange-600", bg: "bg-orange-50 border-orange-200", icon: "🥉" },
};

const RANK_COLORS = ["text-amber-500", "text-slate-400", "text-amber-700"];

// ─── Day/Week labels ──────────────────────────────────────────────────────────

function last7DayLabels() {
  const days = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86_400_000);
    return days[d.getDay()];
  });
}

function buildWeekLabels(): string[] {
  return Array.from({ length: 4 }, (_, i) => {
    const d = new Date(Date.now() - (3 - i) * 7 * 86_400_000);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  });
}

function buildMonthLabels(): string[] {
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    return MONTHS[d.getMonth()];
  });
}

const WEEK_LABELS  = buildWeekLabels();
const MONTH_LABELS = buildMonthLabels();

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReferralsPage() {
  const [copied, setCopied]       = useState(false);
  const [tab, setTab]             = useState<"my" | "history" | "community">("my");
  const [chartView, setChartView] = useState<"daily" | "weekly" | "monthly">("daily");
  const [claimMsg, setClaimMsg]   = useState<string | null>(null);
  const [expandedUser, setExpandedUser] = useState<number | null>(null);

  const qc = useQueryClient();

  const { data: stats, isLoading: statsLoading } = useGetReferralStats({
    query: { queryKey: getGetReferralStatsQueryKey(), staleTime: 30000 },
  });

  const { data: historyData } = useGetReferralHistory({
    query: { queryKey: getGetReferralHistoryQueryKey(), staleTime: 30000 },
  });

  const { data: community, isLoading: communityLoading } = useQuery({
    queryKey: ["referrals-community"],
    queryFn: fetchCommunity,
    staleTime: 60000,
  });

  // Client-side consistency audit: log when community stats vs real stats diverge noticeably
  useEffect(() => {
    if (!community || !stats) return;
    const real = community.realStats;
    if (!real) return;
    const personalTotal = (stats as any)?.totalReferrals ?? 0;
    // If personal referrals exceed the community real count, something is wrong
    if (personalTotal > real.referrals) {
      console.warn(
        `[Wexora Referral Audit] Personal referral count (${personalTotal}) exceeds ` +
        `community real referrals (${real.referrals}). Possible data sync issue.`
      );
    }
    if (community.isHybrid) {
      console.info(
        `[Wexora Referral Audit] Hybrid mode active. ` +
        `Real: ${real.referrals} referrals / $${real.rewards.toFixed(2)} rewards | ` +
        `Displayed (incl. demo): ${community.communityReferrals} / $${community.rewardsDistributed.toFixed(2)}`
      );
    }
  }, [community, stats]);

  const history = historyData as any;
  const perUser: any[]      = history?.perUser ?? [];
  const transactions: any[] = history?.transactions ?? [];

  const { mutate: claimEarnings, isPending: claiming } = useMutation({
    mutationFn: claimReferralEarnings,
    onSuccess: (data) => {
      setClaimMsg(`✅ ${formatUSDT(data.amountClaimed)} credited to your wallet!`);
      qc.invalidateQueries({ queryKey: getGetReferralStatsQueryKey() });
      setTimeout(() => setClaimMsg(null), 5000);
    },
    onError: (err: any) => {
      setClaimMsg(`❌ ${err.message}`);
      setTimeout(() => setClaimMsg(null), 4000);
    },
  });

  const referralLink = stats?.code ? `${window.location.origin}/signup?ref=${stats.code}` : null;

  const handleCopy = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    if (!referralLink) return;
    const text = `Join Wexora and start earning crypto! Sign up with my link:\n${referralLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const pendingEarnings = (stats as any)?.pendingEarnings ?? 0;
  const tierLabel       = (stats as any)?.tierLabel ?? "Bronze";
  const tierCfg         = TIER_CONFIG[tierLabel] ?? TIER_CONFIG.Bronze;
  const chartData       = chartView === "daily"   ? community?.dailyChart   ?? []
                        : chartView === "weekly"  ? community?.weeklyChart  ?? []
                        : community?.monthlyChart ?? [];
  const chartLabels     = chartView === "daily"   ? last7DayLabels()
                        : chartView === "weekly"  ? WEEK_LABELS
                        : MONTH_LABELS;

  return (
    <AppLayout title="Referrals">
      <div className="px-4 pt-5 pb-24 space-y-4">

        {/* ── Hero invite card ────────────────────────────────────── */}
        <div className="bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800 rounded-2xl p-5 text-white shadow-lg">
          <div className="flex items-center justify-between mb-1">
            <p className="text-purple-200 text-xs uppercase tracking-widest">Your Invite Code</p>
            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", tierCfg.bg, tierCfg.color)}>
              {tierCfg.icon} {tierLabel}
            </span>
          </div>

          {statsLoading ? (
            <Skeleton className="h-8 w-32 bg-white/20 mb-2" />
          ) : (
            <p className="text-3xl font-bold tracking-widest mb-2">{stats?.code ?? "---"}</p>
          )}

          <div className="bg-white/10 rounded-xl px-3 py-2 mb-4">
            {statsLoading ? (
              <Skeleton className="h-4 w-full bg-white/20" />
            ) : (
              <p className="text-purple-100 text-[11px] font-mono break-all">{referralLink ?? "Loading…"}</p>
            )}
          </div>

          <p className="text-purple-200 text-xs mb-4">
            Earn up to <span className="text-white font-bold">{((stats?.commissionRate ?? 0.05) * 100).toFixed(0)}%</span> on deposits &amp; investment returns across 3 levels
          </p>

          <div className="flex gap-2">
            <Button size="sm" className="bg-white/20 hover:bg-white/30 text-white border-0 h-9 gap-1.5" onClick={handleCopy}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copied!" : "Copy Link"}
            </Button>
            <Button size="sm" className="bg-green-500/80 hover:bg-green-500 text-white border-0 h-9 gap-1.5" onClick={handleShare}>
              <Share2 size={14} />
              Share via WhatsApp
            </Button>
          </div>
        </div>

        {/* ── Tier progress ────────────────────────────────────────── */}
        {!statsLoading && stats?.nextTierAt != null && (
          <div className={cn("rounded-2xl border px-4 py-3 flex items-center gap-3", tierCfg.bg)}>
            <span className="text-xl">{tierCfg.icon}</span>
            <div className="flex-1">
              <p className={cn("text-xs font-semibold", tierCfg.color)}>
                {tierLabel} Tier — {(stats as any)?.totalReferrals ?? 0} referral{(stats as any)?.totalReferrals !== 1 ? "s" : ""}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {stats.nextTierAt! - ((stats as any)?.totalReferrals ?? 0)} more to reach {
                  stats.nextTierAt === 5 ? "Silver" : stats.nextTierAt === 10 ? "Gold" : "Diamond"
                }
              </p>
            </div>
            <div className="flex gap-1">
              {[5, 10, 20].map((t) => (
                <div key={t} className={cn("w-2 h-2 rounded-full", (stats as any)?.totalReferrals >= t ? "bg-purple-500" : "bg-gray-200")} />
              ))}
            </div>
          </div>
        )}

        {/* ── Claimable earnings card ──────────────────────────────── */}
        <div className={cn(
          "rounded-2xl border-2 p-4 transition-all",
          pendingEarnings > 0 ? "bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-300 dark:from-emerald-950/20 dark:to-teal-950/20 dark:border-emerald-800" : "bg-muted/40 border-border"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", pendingEarnings > 0 ? "bg-emerald-100" : "bg-muted")}>
                <Wallet size={18} className={pendingEarnings > 0 ? "text-emerald-600" : "text-muted-foreground"} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Pending Referral Earnings</p>
                {statsLoading ? (
                  <Skeleton className="h-7 w-28 mt-0.5" />
                ) : (
                  <p className={cn("text-2xl font-bold leading-tight", pendingEarnings > 0 ? "text-emerald-700" : "text-foreground")}>
                    {formatUSDT(pendingEarnings)}
                  </p>
                )}
              </div>
            </div>
            <Button
              size="sm"
              disabled={pendingEarnings <= 0 || claiming || statsLoading}
              onClick={() => claimEarnings()}
              className={cn(
                "h-9 px-4 font-semibold transition-all",
                pendingEarnings > 0 ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md" : "bg-muted text-muted-foreground"
              )}
            >
              {claiming ? "Claiming…" : "Claim"}
            </Button>
          </div>
          {claimMsg && (
            <p className="mt-3 text-xs font-medium text-center py-2 rounded-lg bg-white/70 border border-border">
              {claimMsg}
            </p>
          )}
          {pendingEarnings <= 0 && !statsLoading && (
            <p className="text-[11px] text-muted-foreground mt-2">
              Commissions accumulate here as your referrals deposit and earn returns.
            </p>
          )}
        </div>

        {/* ── My stats strip ───────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "My Referrals", value: statsLoading ? "…" : (stats as any)?.totalReferrals ?? 0, icon: Users,      color: "text-primary" },
            { label: "Active",       value: statsLoading ? "…" : (stats as any)?.activeReferrals ?? 0, icon: TrendingUp,  color: "text-accent" },
            { label: "My Earned",   value: statsLoading ? "…" : formatUSDT((stats as any)?.totalEarned ?? 0), icon: DollarSign, color: "text-purple-500" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-3 text-center shadow-sm">
              <Icon size={16} className={cn("mx-auto mb-1.5", color)} />
              <p className="font-bold text-foreground text-sm">{value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{label}</p>
            </div>
          ))}
        </div>

        {/* ── 3-Level commission card ───────────────────────────────── */}
        {(() => {
          const levels: any[] = (stats as any)?.levels ?? [
            { level: 1, depositRate: 5, roiRate: 5 },
            { level: 2, depositRate: 3, roiRate: 3 },
            { level: 3, depositRate: 1, roiRate: 1 },
          ];
          const levelConfig = [
            { label: "Level 1", desc: "Direct Referrals",       icon: "👤", color: "text-purple-600", bg: "bg-purple-50 border-purple-200 dark:bg-purple-950/20 dark:border-purple-800" },
            { label: "Level 2", desc: "Referrals' Referrals",   icon: "👥", color: "text-blue-600",   bg: "bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800" },
            { label: "Level 3", desc: "3rd Degree Network",     icon: "🌐", color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800" },
          ];
          return (
            <div className="border rounded-2xl p-4 shadow-sm space-y-3 bg-card">
              <div className="flex items-center gap-2 mb-1">
                <GitBranch size={16} className="text-purple-500" />
                <p className="font-bold text-sm text-foreground">3-Level Referral Network</p>
              </div>
              <div className="space-y-2">
                {levels.map((lvl, i) => {
                  const lc = levelConfig[i];
                  return (
                    <div key={lvl.level} className={cn("rounded-xl border p-3", lc.bg)}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{lc.icon}</span>
                          <div>
                            <p className={cn("font-bold text-sm leading-tight", lc.color)}>{lc.label}</p>
                            <p className="text-[10px] text-muted-foreground">{lc.desc}</p>
                          </div>
                        </div>
                        <div className="flex gap-3 text-right">
                          <div>
                            <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Deposit</p>
                            <p className={cn("font-bold text-base leading-tight", lc.color)}>{lvl.depositRate.toFixed(1)}%</p>
                          </div>
                          <div>
                            <p className="text-[9px] text-muted-foreground uppercase tracking-wide">ROI</p>
                            <p className={cn("font-bold text-base leading-tight", lc.color)}>{lvl.roiRate.toFixed(1)}%</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground text-center pt-1">
                Earn commission on your network up to 3 levels deep
              </p>
            </div>
          );
        })()}

        {/* ── Tabs ─────────────────────────────────────────────────── */}
        <div className="flex bg-muted rounded-xl p-1">
          {([
            { id: "my",        label: "My Referrals" },
            { id: "history",   label: "History" },
            { id: "community", label: "Community" },
          ] as const).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "flex-1 py-2 rounded-lg text-xs font-semibold transition-all",
                tab === id ? "bg-white shadow-sm text-foreground dark:bg-card" : "text-muted-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════
            Tab: My Referrals
        ═══════════════════════════════════════════════════════════ */}
        {tab === "my" && (
          <div className="space-y-2">
            {perUser.length === 0 ? (
              <div className="text-center py-12 bg-card border border-border rounded-2xl">
                <Users size={32} className="text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm font-semibold text-foreground">No referrals yet</p>
                <p className="text-xs text-muted-foreground mt-1">Share your code to start earning</p>
              </div>
            ) : (
              perUser.map((row: any) => {
                const userTxs       = transactions.filter((t: any) => t.referredUsername === row.referredUsername);
                const fromDeposits  = userTxs.filter((t: any) => t.source === "deposit").reduce((a: number, t: any) => a + t.amount, 0);
                const fromInvestments = userTxs.filter((t: any) => t.source === "investment").reduce((a: number, t: any) => a + t.amount, 0);
                const isExpanded    = expandedUser === row.id;

                return (
                  <div key={row.id} className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                    <button
                      className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
                      onClick={() => setExpandedUser(isExpanded ? null : row.id)}
                    >
                      <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-purple-600">
                          {(row.referredUsername?.[0] ?? "?").toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">@{row.referredUsername}</p>
                        <p className="text-[11px] text-muted-foreground">
                          Joined {new Date(row.joinedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                      </div>
                      <div className="text-right mr-2">
                        <p className="text-base font-bold text-emerald-600">{formatUSDT(row.totalEarned)}</p>
                        <p className="text-[10px] text-muted-foreground">total earned</p>
                      </div>
                      {isExpanded ? <ChevronUp size={14} className="text-muted-foreground flex-shrink-0" /> : <ChevronDown size={14} className="text-muted-foreground flex-shrink-0" />}
                    </button>

                    {isExpanded && (
                      <div className="border-t border-border px-4 py-3 bg-muted/30 space-y-2.5">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-card rounded-xl p-3 border border-border">
                            <div className="flex items-center gap-1.5 mb-1">
                              <ArrowDownCircle size={12} className="text-blue-500" />
                              <p className="text-[10px] text-muted-foreground font-medium">From Deposits</p>
                            </div>
                            <p className="text-sm font-bold text-blue-600">{formatUSDT(fromDeposits)}</p>
                          </div>
                          <div className="bg-card rounded-xl p-3 border border-border">
                            <div className="flex items-center gap-1.5 mb-1">
                              <TrendingUp size={12} className="text-emerald-500" />
                              <p className="text-[10px] text-muted-foreground font-medium">From Investments</p>
                            </div>
                            <p className="text-sm font-bold text-emerald-600">{formatUSDT(fromInvestments)}</p>
                          </div>
                        </div>
                        {userTxs.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Recent payments</p>
                            {userTxs.slice(0, 4).map((t: any) => (
                              <div key={t.id} className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">
                                  {t.source === "deposit" ? "💰" : "📈"}{" "}
                                  {t.source === "deposit" ? "Deposit commission" : `${t.planOrNote ?? "Investment"} ROI`}
                                </span>
                                <span className="font-semibold text-foreground">{formatUSDT(t.amount)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            Tab: History
        ═══════════════════════════════════════════════════════════ */}
        {tab === "history" && (
          <div>
            {transactions.length === 0 ? (
              <div className="text-center py-12 bg-card border border-border rounded-2xl">
                <DollarSign size={32} className="text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm font-semibold text-foreground">No commissions yet</p>
                <p className="text-xs text-muted-foreground mt-1">Your referral payments will appear here</p>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden divide-y divide-border">
                {transactions.map((t: any) => (
                  <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm",
                      t.source === "deposit" ? "bg-blue-100" : "bg-emerald-100"
                    )}>
                      {t.source === "deposit" ? "💰" : "📈"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {t.source === "deposit"
                          ? `Deposit commission${t.referredUsername ? ` from @${t.referredUsername}` : ""}`
                          : `Investment ROI commission`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(t.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-emerald-600 flex-shrink-0">{formatUSDT(t.amount)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            Tab: Community
        ═══════════════════════════════════════════════════════════ */}
        {tab === "community" && (
          <div className="space-y-4">

            {/* Community headline stats */}
            <div className="grid grid-cols-2 gap-3">
              {communityLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-2xl" />
                ))
              ) : (
                <>
                  <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl p-4 text-white shadow-sm">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Globe size={13} className="text-purple-200" />
                      <p className="text-[10px] text-purple-200 uppercase tracking-wide font-medium">Community Referrals</p>
                    </div>
                    <p className="text-2xl font-bold">{(community?.communityReferrals ?? 0).toLocaleString()}</p>
                    <p className="text-[10px] text-purple-200 mt-0.5">Total platform-wide</p>
                  </div>

                  <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-4 text-white shadow-sm">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Users size={13} className="text-emerald-200" />
                      <p className="text-[10px] text-emerald-200 uppercase tracking-wide font-medium">Active Referrers</p>
                    </div>
                    <p className="text-2xl font-bold">{(community?.activeReferrers ?? 0).toLocaleString()}</p>
                    <p className="text-[10px] text-emerald-200 mt-0.5">Earning commissions now</p>
                  </div>

                  <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-4 text-white shadow-sm">
                    <div className="flex items-center gap-1.5 mb-1">
                      <DollarSign size={13} className="text-amber-200" />
                      <p className="text-[10px] text-amber-200 uppercase tracking-wide font-medium">Rewards Distributed</p>
                    </div>
                    <p className="text-2xl font-bold">{formatUSDT(community?.rewardsDistributed ?? 0)}</p>
                    <p className="text-[10px] text-amber-200 mt-0.5">Paid to referrers</p>
                  </div>

                  <div className="bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl p-4 text-white shadow-sm">
                    <div className="flex items-center gap-1.5 mb-1">
                      <TrendingUp size={13} className="text-blue-200" />
                      <p className="text-[10px] text-blue-200 uppercase tracking-wide font-medium">Monthly Growth</p>
                    </div>
                    <p className="text-2xl font-bold">+{community?.monthlyGrowthPct ?? 0}%</p>
                    <p className="text-[10px] text-blue-200 mt-0.5">
                      Weekly: +{community?.weeklyGrowthPct ?? 0}%
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Referral Analytics Charts */}
            <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <BarChart3 size={15} className="text-purple-500" />
                  <p className="text-sm font-bold text-foreground">Referral Growth</p>
                </div>
                <div className="flex bg-muted rounded-lg p-0.5">
                  {(["daily", "weekly", "monthly"] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setChartView(v)}
                      className={cn(
                        "px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all capitalize",
                        chartView === v ? "bg-white shadow-sm text-foreground dark:bg-card" : "text-muted-foreground"
                      )}
                    >
                      {v === "daily" ? "7D" : v === "weekly" ? "4W" : "6M"}
                    </button>
                  ))}
                </div>
              </div>

              {communityLoading ? (
                <Skeleton className="h-14 w-full rounded-lg" />
              ) : chartData.length > 0 ? (
                <MiniBarChart data={chartData} labels={chartLabels} />
              ) : (
                <div className="h-14 flex items-center justify-center">
                  <p className="text-xs text-muted-foreground">No data yet</p>
                </div>
              )}

              <div className="flex justify-between mt-2">
                <p className="text-[10px] text-muted-foreground">
                  {chartView === "daily" ? "New referrals per day (last 7 days)" :
                   chartView === "weekly" ? "New referrals per week (last 4 weeks)" :
                   "New referrals per month (last 6 months)"}
                </p>
                <p className="text-[10px] font-semibold text-purple-600">
                  Total: {chartData.reduce((a, b) => a + b, 0)}
                </p>
              </div>
            </div>

            {/* Top Referral Sources */}
            <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Zap size={14} className="text-amber-500" />
                <p className="text-sm font-bold text-foreground">Top Referral Sources</p>
              </div>
              <div className="space-y-2.5">
                {(() => {
                  const SOURCE_META: Record<string, { label: string; color: string }> = {
                    whatsapp: { label: "WhatsApp Share", color: "bg-green-500" },
                    direct:   { label: "Direct Link",   color: "bg-blue-500" },
                    telegram: { label: "Telegram",      color: "bg-sky-500" },
                    other:    { label: "Other",         color: "bg-gray-400" },
                  };
                  const FALLBACK = [
                    { source: "whatsapp", pct: 44 },
                    { source: "direct",   pct: 31 },
                    { source: "telegram", pct: 18 },
                    { source: "other",    pct:  7 },
                  ];
                  const rows = community?.referralSources?.length
                    ? community.referralSources.map((r) => ({ source: r.source, pct: r.pct }))
                    : FALLBACK;
                  return rows.map(({ source, pct }) => {
                    const meta = SOURCE_META[source] ?? { label: source.charAt(0).toUpperCase() + source.slice(1), color: "bg-purple-500" };
                    return (
                      <div key={source}>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs text-foreground font-medium">{meta.label}</p>
                          <p className="text-xs font-bold text-muted-foreground">{pct}%</p>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full transition-all duration-700", meta.color)} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Community Leaderboard */}
            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <Trophy size={15} className="text-amber-500" />
                <p className="text-sm font-bold text-foreground">Top Referrers Leaderboard</p>
              </div>

              {communityLoading ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
                </div>
              ) : community?.leaderboard && community.leaderboard.length > 0 ? (
                <div className="divide-y divide-border">
                  {community.leaderboard.map((row, i) => (
                    <div key={row.username} className="flex items-center gap-3 px-4 py-3">
                      <div className="w-8 flex-shrink-0 text-center">
                        {i < 3 ? (
                          <Trophy size={16} className={RANK_COLORS[i]} />
                        ) : (
                          <span className="text-sm text-muted-foreground font-bold">#{row.rank}</span>
                        )}
                      </div>
                      <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-purple-600">
                          {row.username[0].toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">
                          {row.username}
                          {row.isReal && (
                            <span className="ml-1.5 text-[9px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-full px-1.5 py-0.5 font-bold">REAL</span>
                          )}
                        </p>
                        <p className="text-[11px] text-muted-foreground">{row.totalReferrals} referrals</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-emerald-600">{formatUSDT(row.totalEarned)}</p>
                        <p className="text-[10px] text-muted-foreground">earned</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Trophy size={32} className="text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No leaderboard data yet</p>
                </div>
              )}
            </div>

            {/* Data transparency notice */}
            {community?.isHybrid && (
              <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl px-3 py-2.5">
                <Star size={12} className="text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-blue-700 dark:text-blue-400 leading-relaxed">
                  Community statistics include platform activity data. Your personal earnings, commissions, and referral counts are always 100% real.
                </p>
              </div>
            )}

          </div>
        )}

      </div>
    </AppLayout>
  );
}
