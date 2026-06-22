import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Copy, Check, Share2, Users, DollarSign, Trophy,
  TrendingUp, Wallet, ChevronDown, ChevronUp, ArrowDownCircle, GitBranch,
  Globe, Zap, BarChart2,
} from "lucide-react";
import {
  useGetReferralStats, getGetReferralStatsQueryKey,
  useGetReferralHistory, getGetReferralHistoryQueryKey,
  useGetReferralLeaderboard, getGetReferralLeaderboardQueryKey,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatUSDT } from "@/lib/format";

async function claimReferralEarnings() {
  const res = await fetch("/api/referrals/claim", { method: "POST", credentials: "include" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? data.error ?? "Failed to claim");
  return data as { success: boolean; amountClaimed: number };
}

async function fetchPlatformStats() {
  const res = await fetch("/api/referrals/platform-stats", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load community stats");
  return res.json() as Promise<{
    totalReferrals: number;
    activeReferrers: number;
    rewardsDistributed: number;
    monthlyGrowthPct: number;
    thisMonthCount: number;
    lastMonthCount: number;
    chart7D: { label: string; value: number }[];
    chart4W: { label: string; value: number }[];
    chart6M: { label: string; value: number }[];
    sources: { label: string; count: number; pct: number }[];
    leaderboard: { rank: number; username: string; totalReferrals: number; totalEarned: number }[];
  }>;
}

// ── Mini bar chart ────────────────────────────────────────────────────────────
function MiniBarChart({ data }: { data: { label: string; value: number }[] }) {
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div>
      <div className="flex items-end gap-1 h-16">
        {data.map((d, i) => {
          const pct = (d.value / maxVal) * 100;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
              <div
                className="w-full rounded-t-sm transition-all duration-500"
                style={{
                  height: `${Math.max(pct, d.value > 0 ? 8 : 2)}%`,
                  backgroundColor: d.value > 0 ? "hsl(var(--primary))" : "hsl(var(--muted))",
                  opacity: d.value > 0 ? 1 : 0.4,
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-1 mt-1">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-center">
            <span className="text-[9px] text-muted-foreground leading-none">{d.label}</span>
          </div>
        ))}
      </div>
      <p className="text-right text-xs text-muted-foreground mt-1">
        Total: <span className="font-bold text-foreground">{total}</span>
      </p>
    </div>
  );
}

const RANK_COLORS = ["text-amber-500", "text-slate-400", "text-amber-700"];

export default function ReferralsPage() {
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<"mine" | "community">("mine");
  const [subTab, setSubTab] = useState<"referrals" | "history" | "leaderboard">("referrals");
  const [chartPeriod, setChartPeriod] = useState<"7D" | "4W" | "6M">("7D");
  const [claimMsg, setClaimMsg] = useState<string | null>(null);
  const [expandedUser, setExpandedUser] = useState<number | null>(null);

  const qc = useQueryClient();

  const { data: stats, isLoading: statsLoading } = useGetReferralStats({
    query: { queryKey: getGetReferralStatsQueryKey(), staleTime: 30000 },
  });
  const { data: historyData } = useGetReferralHistory({
    query: { queryKey: getGetReferralHistoryQueryKey(), staleTime: 30000 },
  });
  const { data: leaderboard } = useGetReferralLeaderboard({
    query: { queryKey: getGetReferralLeaderboardQueryKey(), staleTime: 300000 },
  });

  // Community stats — single endpoint, all 7 widgets read from the same data
  const { data: platformStats, isLoading: platformLoading } = useQuery({
    queryKey: ["referrals", "platform-stats"],
    queryFn: fetchPlatformStats,
    staleTime: 60000,
  });

  const history = historyData as any;
  const perUser: any[] = history?.perUser ?? [];
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

  const referralLink = stats?.code
    ? `${window.location.origin}/signup?ref=${stats.code}`
    : null;

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

  const chartData =
    chartPeriod === "7D"
      ? platformStats?.chart7D ?? []
      : chartPeriod === "4W"
      ? platformStats?.chart4W ?? []
      : platformStats?.chart6M ?? [];

  const chartSubLabel =
    chartPeriod === "7D"
      ? "New referrals per day (last 7 days)"
      : chartPeriod === "4W"
      ? "New referrals per week (last 4 weeks)"
      : "New referrals per month (last 6 months)";

  return (
    <AppLayout title="Referrals">
      <div className="px-4 pt-5 pb-24 space-y-4">

        {/* Hero invite card */}
        <div className="bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800 rounded-2xl p-5 text-white shadow-lg">
          <p className="text-purple-200 text-xs uppercase tracking-widest mb-1">Your Invite Code</p>
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

        {/* Main tab switcher: Mine / Community */}
        <div className="flex bg-muted rounded-xl p-1">
          {(["mine", "community"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all capitalize gap-1.5 flex items-center justify-center",
                tab === t ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
              )}
            >
              {t === "mine" ? <Users size={12} /> : <Globe size={12} />}
              {t === "mine" ? "My Referrals" : "Community"}
            </button>
          ))}
        </div>

        {/* ═══════ MY REFERRALS TAB ═══════════════════════════════════════════ */}
        {tab === "mine" && (
          <>
            {/* Claimable earnings card */}
            <div className={cn(
              "rounded-2xl border-2 p-4 transition-all",
              pendingEarnings > 0
                ? "bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-300"
                : "bg-muted/40 border-border"
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
                    pendingEarnings > 0
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md"
                      : "bg-muted text-muted-foreground"
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

            {/* Stats strip */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Total Referred", value: statsLoading ? "..." : (stats?.totalReferrals ?? 0), icon: Users, color: "text-primary" },
                { label: "Active", value: statsLoading ? "..." : (stats?.activeReferrals ?? 0), icon: TrendingUp, color: "text-accent" },
                { label: "Total Earned", value: statsLoading ? "..." : formatUSDT(stats?.totalEarned ?? 0), icon: DollarSign, color: "text-purple-500" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="bg-card border border-border rounded-xl p-3 text-center shadow-sm">
                  <Icon size={16} className={cn("mx-auto mb-1.5", color)} />
                  <p className="font-bold text-foreground text-sm">{value}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{label}</p>
                </div>
              ))}
            </div>

            {/* 3-Level commission card */}
            {(() => {
              const levels: any[] = (stats as any)?.levels ?? [
                { level: 1, depositRate: 5, roiRate: 5 },
                { level: 2, depositRate: 3, roiRate: 3 },
                { level: 3, depositRate: 1, roiRate: 1 },
              ];
              const levelConfig = [
                { label: "Level 1", desc: "Direct Referrals", icon: "👤", color: "text-purple-600", bg: "bg-purple-50 border-purple-200" },
                { label: "Level 2", desc: "Referrals' Referrals", icon: "👥", color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
                { label: "Level 3", desc: "3rd Degree Network", icon: "🌐", color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
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

            {/* Sub-tabs */}
            <div className="flex bg-muted rounded-xl p-1">
              {(["referrals", "history", "leaderboard"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setSubTab(t)}
                  className={cn("flex-1 py-2 rounded-lg text-xs font-semibold transition-all capitalize", subTab === t ? "bg-background shadow-sm text-foreground" : "text-muted-foreground")}
                >
                  {t === "leaderboard" ? "Board" : t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            {/* Per-referral breakdown */}
            {subTab === "referrals" && (
              <div className="space-y-2">
                {perUser.length === 0 ? (
                  <div className="text-center py-12 bg-card border border-border rounded-2xl">
                    <Users size={32} className="text-muted-foreground/40 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-foreground">No referrals yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Share your code to start earning</p>
                  </div>
                ) : (
                  perUser.map((row: any) => {
                    const userTxs = transactions.filter((t: any) => t.referredUsername === row.referredUsername);
                    const fromDeposits = userTxs.filter((t: any) => t.source === "deposit").reduce((a: number, t: any) => a + t.amount, 0);
                    const fromInvestments = userTxs.filter((t: any) => t.source === "investment").reduce((a: number, t: any) => a + t.amount, 0);
                    const isExpanded = expandedUser === row.id;
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

            {/* Transaction history */}
            {subTab === "history" && (
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

            {/* Personal leaderboard */}
            {subTab === "leaderboard" && (
              <div>
                {leaderboard && leaderboard.length > 0 ? (
                  <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden divide-y divide-border">
                    {leaderboard.map((row: any, i: number) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-3">
                        <div className="w-8 flex-shrink-0 text-center">
                          {i < 3 ? (
                            <Trophy size={16} className={RANK_COLORS[i]} />
                          ) : (
                            <span className="text-sm text-muted-foreground font-bold">#{row.rank}</span>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">@{row.username}</p>
                          <p className="text-xs text-muted-foreground">{row.totalReferrals} referrals</p>
                        </div>
                        <p className="text-sm font-bold text-accent">{formatUSDT(row.totalEarned)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-card border border-border rounded-2xl">
                    <Trophy size={32} className="text-muted-foreground/40 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No leaderboard data yet</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ═══════ COMMUNITY TAB ══════════════════════════════════════════════ */}
        {/* All 7 widgets read exclusively from /api/referrals/platform-stats   */}
        {tab === "community" && (
          <>
            {/* ── 4 stat cards ────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3">
              {/* Community Referrals */}
              <div className="rounded-2xl p-4 text-white shadow-md" style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)" }}>
                <div className="flex items-center gap-1.5 mb-2">
                  <Globe size={12} className="opacity-80" />
                  <p className="text-[10px] font-semibold uppercase tracking-widest opacity-80">Community Referrals</p>
                </div>
                {platformLoading ? (
                  <Skeleton className="h-8 w-20 bg-white/20" />
                ) : (
                  <p className="text-3xl font-extrabold leading-none">
                    {(platformStats?.totalReferrals ?? 0).toLocaleString()}
                  </p>
                )}
                <p className="text-[10px] opacity-70 mt-1">Total platform-wide</p>
              </div>

              {/* Active Referrers */}
              <div className="rounded-2xl p-4 text-white shadow-md" style={{ background: "linear-gradient(135deg,#059669,#0d9488)" }}>
                <div className="flex items-center gap-1.5 mb-2">
                  <Users size={12} className="opacity-80" />
                  <p className="text-[10px] font-semibold uppercase tracking-widest opacity-80">Active Referrers</p>
                </div>
                {platformLoading ? (
                  <Skeleton className="h-8 w-16 bg-white/20" />
                ) : (
                  <p className="text-3xl font-extrabold leading-none">
                    {(platformStats?.activeReferrers ?? 0).toLocaleString()}
                  </p>
                )}
                <p className="text-[10px] opacity-70 mt-1">Earning commissions now</p>
              </div>

              {/* Rewards Distributed */}
              <div className="rounded-2xl p-4 text-white shadow-md" style={{ background: "linear-gradient(135deg,#ea580c,#d97706)" }}>
                <div className="flex items-center gap-1.5 mb-2">
                  <DollarSign size={12} className="opacity-80" />
                  <p className="text-[10px] font-semibold uppercase tracking-widest opacity-80">Rewards Distributed</p>
                </div>
                {platformLoading ? (
                  <Skeleton className="h-8 w-24 bg-white/20" />
                ) : (
                  <>
                    <p className="text-2xl font-extrabold leading-none">
                      {(platformStats?.rewardsDistributed ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs font-bold opacity-90 mt-0.5">USDT</p>
                  </>
                )}
                <p className="text-[10px] opacity-70 mt-0.5">Paid to referrers</p>
              </div>

              {/* Monthly Growth */}
              <div className="rounded-2xl p-4 text-white shadow-md" style={{ background: "linear-gradient(135deg,#0284c7,#0891b2)" }}>
                <div className="flex items-center gap-1.5 mb-2">
                  <TrendingUp size={12} className="opacity-80" />
                  <p className="text-[10px] font-semibold uppercase tracking-widest opacity-80">Monthly Growth</p>
                </div>
                {platformLoading ? (
                  <Skeleton className="h-8 w-20 bg-white/20" />
                ) : (
                  <p className="text-3xl font-extrabold leading-none">
                    {(platformStats?.monthlyGrowthPct ?? 0) >= 0 ? "+" : ""}
                    {(platformStats?.monthlyGrowthPct ?? 0).toFixed(1)}%
                  </p>
                )}
                <p className="text-[10px] opacity-70 mt-1">
                  {platformStats
                    ? `${platformStats.thisMonthCount} this month vs ${platformStats.lastMonthCount} last`
                    : "vs last month"}
                </p>
              </div>
            </div>

            {/* ── Referral Growth Chart ────────────────────────────────────── */}
            <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <BarChart2 size={15} className="text-primary" />
                  <p className="font-semibold text-sm text-foreground">Referral Growth</p>
                </div>
                <div className="flex gap-1">
                  {(["7D", "4W", "6M"] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setChartPeriod(p)}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all",
                        chartPeriod === p
                          ? "bg-primary text-white shadow-sm"
                          : "text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              {platformLoading ? (
                <div className="h-20 flex items-end gap-1">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <Skeleton key={i} className="flex-1 rounded-t-sm" style={{ height: `${20 + Math.random() * 60}%` }} />
                  ))}
                </div>
              ) : (
                <MiniBarChart data={chartData} />
              )}
              <p className="text-[10px] text-muted-foreground mt-2">{chartSubLabel}</p>
            </div>

            {/* ── Top Referral Sources ─────────────────────────────────────── */}
            <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Zap size={15} className="text-amber-500" />
                <p className="font-semibold text-sm text-foreground">Top Referral Sources</p>
              </div>
              {platformLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : platformStats?.sources.length === 0 ? (
                <p className="text-xs text-muted-foreground py-3 text-center">No referral data yet</p>
              ) : (
                <div className="space-y-3">
                  {platformStats?.sources.map((src) => (
                    <div key={src.label}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-foreground">{src.label}</p>
                        <p className="text-sm font-bold text-foreground">{src.pct.toFixed(0)}%</p>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-700"
                          style={{ width: `${src.pct}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{src.count.toLocaleString()} referral{src.count !== 1 ? "s" : ""}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Top Referrers Leaderboard ────────────────────────────────── */}
            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-border">
                <Trophy size={15} className="text-amber-500" />
                <p className="font-semibold text-sm text-foreground">Top Referrers Leaderboard</p>
              </div>
              {platformLoading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="w-8 h-8 rounded-full" />
                      <div className="flex-1 space-y-1">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-2.5 w-16" />
                      </div>
                      <Skeleton className="h-4 w-20" />
                    </div>
                  ))}
                </div>
              ) : !platformStats?.leaderboard.length ? (
                <div className="text-center py-10">
                  <Trophy size={28} className="text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">No leaderboard data yet</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {platformStats.leaderboard.map((row, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3">
                      <div className="w-8 flex-shrink-0 flex items-center justify-center">
                        {i < 3 ? (
                          <Trophy size={16} className={RANK_COLORS[i]} />
                        ) : (
                          <span className="text-sm font-bold text-muted-foreground">#{row.rank}</span>
                        )}
                      </div>
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-primary">
                          {(row.username?.[0] ?? "?").toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">@{row.username}</p>
                        <p className="text-[11px] text-muted-foreground">{row.totalReferrals} referral{row.totalReferrals !== 1 ? "s" : ""}</p>
                      </div>
                      <p className="text-sm font-bold text-emerald-600 flex-shrink-0">{formatUSDT(row.totalEarned)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

      </div>
    </AppLayout>
  );
}
