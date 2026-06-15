import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Copy, Check, Share2, Users, DollarSign, Trophy,
  TrendingUp, Wallet, ChevronDown, ChevronUp, ArrowDownCircle,
} from "lucide-react";
import {
  useGetReferralStats, getGetReferralStatsQueryKey,
  useGetReferralHistory, getGetReferralHistoryQueryKey,
  useGetReferralLeaderboard, getGetReferralLeaderboardQueryKey,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function formatMoney(v: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD",
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(v);
}

async function claimReferralEarnings() {
  const res = await fetch("/api/referrals/claim", { method: "POST", credentials: "include" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? data.error ?? "Failed to claim");
  return data as { success: boolean; amountClaimed: number };
}

export default function ReferralsPage() {
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<"referrals" | "history" | "leaderboard">("referrals");
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

  const history = historyData as any;
  const perUser: any[] = history?.perUser ?? [];
  const transactions: any[] = history?.transactions ?? [];

  const { mutate: claimEarnings, isPending: claiming } = useMutation({
    mutationFn: claimReferralEarnings,
    onSuccess: (data) => {
      setClaimMsg(`✅ ${formatMoney(data.amountClaimed)} credited to your wallet!`);
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
    const text = `Join VaultX and start earning crypto! Sign up with my link:\n${referralLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const pendingEarnings = (stats as any)?.pendingEarnings ?? 0;

  const RANK_COLORS = ["text-amber-500", "text-slate-400", "text-amber-700"];

  const tierConfig: Record<string, { color: string; bg: string; bar: string; icon: string }> = {
    Bronze:  { color: "text-amber-700",  bg: "bg-amber-50  border-amber-200",  bar: "bg-amber-500",  icon: "🥉" },
    Silver:  { color: "text-slate-600",  bg: "bg-slate-50  border-slate-200",  bar: "bg-slate-400",  icon: "🥈" },
    Gold:    { color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-200", bar: "bg-yellow-500", icon: "🥇" },
    Diamond: { color: "text-cyan-600",   bg: "bg-cyan-50   border-cyan-200",   bar: "bg-cyan-500",   icon: "💎" },
  };
  const tierLabel = (stats as any)?.tierLabel ?? "Bronze";
  const cfg = tierConfig[tierLabel] ?? tierConfig.Bronze;

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
            Earn <span className="text-white font-bold">{((stats?.commissionRate ?? 0.05) * 100).toFixed(0)}%</span> on every referral's deposits & investment returns
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
                    {formatMoney(pendingEarnings)}
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
            { label: "Total Earned", value: statsLoading ? "..." : formatMoney(stats?.totalEarned ?? 0), icon: DollarSign, color: "text-purple-500" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white border border-border rounded-xl p-3 text-center shadow-sm">
              <Icon size={16} className={cn("mx-auto mb-1.5", color)} />
              <p className="font-bold text-foreground text-sm">{value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{label}</p>
            </div>
          ))}
        </div>

        {/* Tier card */}
        {(() => {
          const total = stats?.totalReferrals ?? 0;
          const nextTierAt = (stats as any)?.nextTierAt ?? null;
          const rate = stats?.commissionRate ?? 0.05;
          const progressPct = nextTierAt ? Math.min(100, (total / nextTierAt) * 100) : 100;
          const tiers = [
            { label: "Bronze", min: 0, rate: 0.05 },
            { label: "Silver", min: 5, rate: 0.07 },
            { label: "Gold", min: 10, rate: 0.10 },
            { label: "Diamond", min: 20, rate: 0.12 },
          ];
          return (
            <div className={cn("border rounded-2xl p-4 shadow-sm space-y-3", cfg.bg)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{cfg.icon}</span>
                  <div>
                    <p className={cn("font-bold text-base leading-tight", cfg.color)}>{tierLabel} Tier</p>
                    <p className="text-xs text-muted-foreground">{(rate * 100).toFixed(0)}% on deposits &amp; investment returns</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground">Rate</p>
                  <p className={cn("font-bold text-xl", cfg.color)}>{(rate * 100).toFixed(0)}%</p>
                </div>
              </div>
              {nextTierAt !== null && (
                <div>
                  <div className="flex justify-between text-[11px] text-muted-foreground mb-1.5">
                    <span>{total} referral{total !== 1 ? "s" : ""}</span>
                    <span>{nextTierAt - total} more to next tier</span>
                  </div>
                  <div className="h-2 bg-white/70 rounded-full overflow-hidden border border-white">
                    <div className={cn("h-full rounded-full transition-all duration-700", cfg.bar)} style={{ width: `${progressPct}%` }} />
                  </div>
                </div>
              )}
              {nextTierAt === null && (
                <p className="text-[11px] text-cyan-600 font-semibold">🎉 You're at the highest tier!</p>
              )}
              <div className="grid grid-cols-4 gap-1.5 pt-1">
                {tiers.map((t) => {
                  const isActive = tierLabel === t.label;
                  const tc = tierConfig[t.label];
                  return (
                    <div key={t.label} className={cn("rounded-xl p-2 text-center border transition-all", isActive ? tc.bg : "bg-white/50 border-transparent opacity-60")}>
                      <p className="text-base leading-none">{tc.icon}</p>
                      <p className={cn("text-[9px] font-bold mt-1", isActive ? tc.color : "text-muted-foreground")}>{t.label}</p>
                      <p className={cn("text-[9px] font-semibold", isActive ? tc.color : "text-muted-foreground")}>{(t.rate * 100).toFixed(0)}%</p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Tabs */}
        <div className="flex bg-muted rounded-xl p-1">
          {(["referrals", "history", "leaderboard"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn("flex-1 py-2 rounded-lg text-xs font-semibold transition-all capitalize", tab === t ? "bg-white shadow-sm text-foreground" : "text-muted-foreground")}
            >
              {t === "leaderboard" ? "Board" : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Per-referral breakdown tab */}
        {tab === "referrals" && (
          <div className="space-y-2">
            {perUser.length === 0 ? (
              <div className="text-center py-12 bg-white border border-border rounded-2xl">
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
                  <div key={row.id} className="bg-white border border-border rounded-2xl shadow-sm overflow-hidden">
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
                        <p className="text-base font-bold text-emerald-600">{formatMoney(row.totalEarned)}</p>
                        <p className="text-[10px] text-muted-foreground">total earned</p>
                      </div>
                      {isExpanded ? <ChevronUp size={14} className="text-muted-foreground flex-shrink-0" /> : <ChevronDown size={14} className="text-muted-foreground flex-shrink-0" />}
                    </button>

                    {isExpanded && (
                      <div className="border-t border-border px-4 py-3 bg-muted/30 space-y-2.5">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-white rounded-xl p-3 border border-border">
                            <div className="flex items-center gap-1.5 mb-1">
                              <ArrowDownCircle size={12} className="text-blue-500" />
                              <p className="text-[10px] text-muted-foreground font-medium">From Deposits</p>
                            </div>
                            <p className="text-sm font-bold text-blue-600">{formatMoney(fromDeposits)}</p>
                          </div>
                          <div className="bg-white rounded-xl p-3 border border-border">
                            <div className="flex items-center gap-1.5 mb-1">
                              <TrendingUp size={12} className="text-emerald-500" />
                              <p className="text-[10px] text-muted-foreground font-medium">From Investments</p>
                            </div>
                            <p className="text-sm font-bold text-emerald-600">{formatMoney(fromInvestments)}</p>
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
                                <span className="font-semibold text-foreground">{formatMoney(t.amount)}</span>
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

        {/* Transaction history tab */}
        {tab === "history" && (
          <div>
            {transactions.length === 0 ? (
              <div className="text-center py-12 bg-white border border-border rounded-2xl">
                <DollarSign size={32} className="text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm font-semibold text-foreground">No commissions yet</p>
                <p className="text-xs text-muted-foreground mt-1">Your referral payments will appear here</p>
              </div>
            ) : (
              <div className="bg-white border border-border rounded-2xl shadow-sm overflow-hidden divide-y divide-border">
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
                    <p className="text-sm font-bold text-emerald-600 flex-shrink-0">{formatMoney(t.amount)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Leaderboard tab */}
        {tab === "leaderboard" && (
          <div>
            {leaderboard && leaderboard.length > 0 ? (
              <div className="bg-white border border-border rounded-2xl shadow-sm overflow-hidden divide-y divide-border">
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
                    <p className="text-sm font-bold text-accent">{formatMoney(row.totalEarned)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-white border border-border rounded-2xl">
                <Trophy size={32} className="text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No leaderboard data yet</p>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
