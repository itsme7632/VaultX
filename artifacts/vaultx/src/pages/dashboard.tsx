import { useEffect, useState, useRef } from "react";
import { TrendingUp, DollarSign, Activity, Zap, Clock, ArrowRight, Users, Copy, Check, BarChart3, Trophy, Star } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  useGetDashboardSummary, getGetDashboardSummaryQueryKey,
  useGetMarketPrices, getGetMarketPricesQueryKey,
  useGetReferralStats, getGetReferralStatsQueryKey,
  useGetInvestmentPlans, getGetInvestmentPlansQueryKey,
} from "@workspace/api-client-react";
import { usePlatformMetrics } from "@/hooks/usePlatformMetrics";
import { AppLayout } from "@/components/AppLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatUSDT } from "@/lib/format";
import { Link } from "wouter";
import { LiveActivityFeed } from "@/components/LiveActivityFeed";
import { useAuth } from "@/lib/auth";

function LiveEarnings({ base, rate }: { base: number; rate: number }) {
  const [earnings, setEarnings] = useState(base);
  const lastTick = useRef(Date.now());

  useEffect(() => { setEarnings(base); }, [base]);

  useEffect(() => {
    if (rate <= 0) return;
    const perMs = rate / 24 / 3600 / 1000;
    const interval = setInterval(() => {
      const now = Date.now();
      setEarnings((prev) => prev + (now - lastTick.current) * perMs);
      lastTick.current = Date.now();
    }, 1000);
    return () => clearInterval(interval);
  }, [rate]);

  return <span className="tabular-nums">{formatUSDT(earnings)}</span>;
}

function MarketTicker({ data }: { data: any[] }) {
  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <div className="flex gap-3 pb-1" style={{ width: "max-content" }}>
        {data.map((coin) => (
          <div key={coin.symbol} className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2 min-w-[130px]">
            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
              <img src={coin.iconUrl} alt={coin.symbol} className="w-5 h-5" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-xs text-foreground">{coin.symbol}</p>
              <p className={cn("text-[10px] font-medium", coin.changePercent24h >= 0 ? "text-emerald-500" : "text-destructive")}>
                {coin.changePercent24h >= 0 ? "+" : ""}{coin.changePercent24h.toFixed(2)}%
              </p>
            </div>
            <p className="text-xs font-semibold text-foreground ml-1 shrink-0">
              ${coin.price >= 1000 ? (coin.price / 1000).toFixed(1) + "k" : coin.price >= 1 ? coin.price.toFixed(2) : coin.price.toFixed(4)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}


async function fetchCommunity() {
  const res = await fetch("/api/referrals/community", { credentials: "include" });
  if (!res.ok) return null;
  return res.json() as Promise<{
    communityReferrals: number;
    activeReferrers: number;
    rewardsDistributed: number;
    leaderboard: { rank: number; username: string; totalReferrals: number; isReal: boolean }[];
  }>;
}

function computeRank(userReferrals: number, community: NonNullable<Awaited<ReturnType<typeof fetchCommunity>>>) {
  const lb = community.leaderboard;
  // Check if user is on the leaderboard
  const lbMin = lb[lb.length - 1]?.totalReferrals ?? 0;
  if (userReferrals >= lbMin && lb.length > 0) {
    // Count how many leaderboard entries beat the user
    const above = lb.filter((e) => e.totalReferrals > userReferrals).length;
    return above + 1;
  }
  // Estimate position beyond leaderboard
  // Leaderboard has `lb.length` people; `activeReferrers` total active
  const totalActive = community.activeReferrers;
  const belowLb = Math.max(0, totalActive - lb.length);
  if (lbMin <= 0 || userReferrals <= 0) return totalActive;
  // Linear estimate: rank proportional to where userReferrals sits between 1 and lbMin
  const ratio = Math.min(userReferrals / lbMin, 1);
  return Math.round(lb.length + belowLb * (1 - ratio));
}

function ReferralWidget() {
  const [copied, setCopied] = useState(false);

  const { data: stats, isLoading } = useGetReferralStats({
    query: { queryKey: getGetReferralStatsQueryKey(), staleTime: 30000 },
  });

  const { data: community } = useQuery({
    queryKey: ["referrals-community"],
    queryFn: fetchCommunity,
    staleTime: 120000,
  });

  const pendingEarnings = (stats as any)?.pendingEarnings ?? 0;
  const userReferrals   = (stats as any)?.totalReferrals ?? 0;
  const referralLink    = stats?.code ? `${window.location.origin}/signup?ref=${stats.code}` : null;

  const rank       = community && userReferrals >= 0 ? computeRank(userReferrals, community) : null;
  const totalPool  = community?.activeReferrers ?? null;
  const hasReferred = userReferrals > 0;

  const rankLabel = rank && totalPool
    ? `#${rank.toLocaleString()} of ${totalPool.toLocaleString()} referrers`
    : null;

  // Trophy colour based on rank
  const rankColor = !rank ? "text-purple-200"
    : rank === 1           ? "text-amber-300"
    : rank <= 3            ? "text-slate-300"
    : rank <= 10           ? "text-amber-600"
    : "text-purple-200";

  const handleCopy = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800 rounded-2xl p-4 text-white shadow-md">

      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
            <Users size={15} className="text-white" />
          </div>
          <div>
            <p className="text-[10px] text-purple-200 uppercase tracking-widest font-medium">Referral Earnings</p>
            {isLoading ? (
              <Skeleton className="h-6 w-24 bg-white/20 mt-0.5" />
            ) : (
              <p className={cn("text-xl font-bold leading-tight", pendingEarnings > 0 ? "text-emerald-300" : "text-white")}>
                {formatUSDT(pendingEarnings)}
              </p>
            )}
          </div>
        </div>
        <Link href="/referrals">
          <Button size="sm" variant="ghost" className="text-purple-200 hover:text-white hover:bg-white/10 h-8 px-3 text-xs gap-1">
            View <ArrowRight size={11} />
          </Button>
        </Link>
      </div>

      {/* Rank badge */}
      <Link href="/referrals">
        <div className="bg-white/10 hover:bg-white/15 transition-colors rounded-xl px-3 py-2 mb-3 flex items-center gap-2.5 cursor-pointer">
          <Trophy size={16} className={cn("flex-shrink-0", rankColor)} />
          <div className="flex-1 min-w-0">
            {isLoading || !community ? (
              <Skeleton className="h-3.5 w-36 bg-white/20" />
            ) : hasReferred && rankLabel ? (
              <>
                <p className="text-xs font-bold text-white leading-tight">
                  You're ranked <span className={rankColor}>{rankLabel}</span>
                </p>
                <p className="text-[10px] text-purple-200 mt-0.5">
                  {userReferrals} referral{userReferrals !== 1 ? "s" : ""} · Tap to see leaderboard
                </p>
              </>
            ) : (
              <>
                <p className="text-xs font-bold text-white leading-tight">
                  Join{" "}
                  <span className="text-purple-200">
                    {totalPool ? `${totalPool.toLocaleString()} referrers` : "the community"}
                  </span>{" "}
                  on the leaderboard
                </p>
                <p className="text-[10px] text-purple-200 mt-0.5">
                  Share your link to earn your rank
                </p>
              </>
            )}
          </div>
          <Star size={12} className="text-purple-300 flex-shrink-0" />
        </div>
      </Link>

      {/* Copy link row */}
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-white/10 rounded-lg px-3 py-1.5 min-w-0">
          {isLoading ? (
            <Skeleton className="h-3 w-full bg-white/20" />
          ) : (
            <p className="text-[10px] text-purple-100 font-mono truncate">{referralLink ?? "Loading…"}</p>
          )}
        </div>
        <Button
          size="sm"
          onClick={handleCopy}
          disabled={!referralLink || isLoading}
          className="bg-white/20 hover:bg-white/30 text-white border-0 h-8 px-3 gap-1.5 flex-shrink-0"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          <span className="text-xs">{copied ? "Copied!" : "Copy"}</span>
        </Button>
      </div>

      {pendingEarnings > 0 && (
        <Link href="/referrals">
          <p className="text-[10px] text-emerald-300 mt-2 font-medium text-center animate-pulse">
            💰 Tap "View" to claim your pending distributions →
          </p>
        </Link>
      )}
    </div>
  );
}

function OpportunityInsightsWidget() {
  const { data: metrics, isLoading } = usePlatformMetrics();

  const fmtRaised = metrics
    ? metrics.totalRaised >= 1_000_000
      ? `$${(metrics.totalRaised / 1_000_000).toFixed(1)}M`
      : metrics.totalRaised >= 1_000
        ? `$${(metrics.totalRaised / 1_000).toFixed(0)}K`
        : `$${metrics.totalRaised.toFixed(0)}`
    : "—";

  return (
    <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
          <BarChart3 size={13} className="text-primary" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">Opportunity Insights</p>
          <p className="text-[10px] text-muted-foreground">Live platform investment activity</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          { val: isLoading ? "—" : String(metrics?.activeOpportunities ?? 0), lbl: "Active Funds" },
          { val: isLoading ? "—" : (metrics?.totalParticipants ?? 0).toLocaleString(), lbl: "Participants" },
          { val: isLoading ? "—" : fmtRaised, lbl: "Allocated" },
        ].map(({ val, lbl }) => (
          <div key={lbl} className="bg-muted/40 border border-border rounded-xl p-2 text-center">
            <p className="font-bold text-foreground text-sm">{val}</p>
            <p className="text-[9px] text-muted-foreground mt-0.5">{lbl}</p>
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs py-1 border-b border-border/60">
          <span className="text-muted-foreground flex items-center gap-1"><span>⭐</span>Most Popular</span>
          <span className="font-semibold text-foreground truncate max-w-[55%] text-right">
            {isLoading ? "—" : (metrics?.mostPopular?.name ?? "—")}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs py-1 border-b border-border/60">
          <span className="text-muted-foreground flex items-center gap-1"><span>🏆</span>Top Funded</span>
          <span className="font-semibold text-foreground truncate max-w-[55%] text-right">
            {isLoading ? "—" : (metrics?.topFunded?.name ?? "—")}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs py-1">
          <span className="text-muted-foreground flex items-center gap-1"><span>🚀</span>Fastest Growing</span>
          <span className="font-semibold text-foreground truncate max-w-[55%] text-right">
            {isLoading ? "—" : (metrics?.fastestGrowing?.name ?? "—")}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: summary, isLoading: summaryLoading } = useGetDashboardSummary({
    query: { queryKey: getGetDashboardSummaryQueryKey(), staleTime: 30000 },
  });
  const { data: market } = useGetMarketPrices({
    query: { queryKey: getGetMarketPricesQueryKey(), staleTime: 60000 },
  });
  const { data: plans } = useGetInvestmentPlans({
    query: { queryKey: getGetInvestmentPlansQueryKey(), staleTime: 30000, refetchInterval: 60000 },
  });
  const stats = [
    { label: "Total Balance", value: summary ? formatUSDT(summary.totalBalance) : null, icon: DollarSign, color: "text-primary", bg: "bg-primary/10" },
    { label: "Active Opportunities", value: summary ? `${summary.activeInvestmentsCount}` : null, sub: summary ? formatUSDT(summary.activeInvestmentsValue) : null, icon: Activity, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "Today's Distribution", value: summary ? formatUSDT(summary.dailyEarnings) : null, icon: TrendingUp, color: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "Total Distributions", value: summary ? formatUSDT(summary.totalEarnings) : null, icon: Zap, color: "text-purple-500", bg: "bg-purple-500/10" },
  ];

  return (
    <AppLayout>
      <div className="px-4 pt-5 pb-24 space-y-5">
        {/* Welcome */}
        {(() => {
          const hour = new Date().getHours();
          const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
          const emoji = hour < 12 ? "☀️" : hour < 17 ? "🌤️" : "🌙";
          return (
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                {user ? (
                  <span className="text-white font-bold text-base">
                    {user.username?.[0]?.toUpperCase() ?? "?"}
                  </span>
                ) : (
                  <Skeleton className="w-11 h-11 rounded-full" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-muted-foreground font-medium leading-none mb-0.5">
                  {emoji} {greeting}
                </p>
                {user ? (
                  <h1 className="text-lg font-bold text-foreground leading-tight truncate">
                    @{user.username}
                  </h1>
                ) : (
                  <Skeleton className="h-6 w-32 mt-0.5" />
                )}
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                </p>
              </div>
            </div>
          );
        })()}

        {/* Balance hero */}
        <div className="bg-gradient-to-br from-primary via-blue-500 to-blue-700 rounded-2xl p-5 text-white shadow-lg">
          <p className="text-blue-100 text-xs font-medium uppercase tracking-widest mb-1">Total Balance</p>
          {summaryLoading ? (
            <Skeleton className="h-10 w-48 bg-white/20 mb-2" />
          ) : (
            <p className="text-4xl font-bold tracking-tight mb-1">{formatUSDT(summary?.totalBalance ?? 0)}</p>
          )}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <div className="flex items-center gap-1 bg-white/20 rounded-full px-2.5 py-0.5">
              <TrendingUp size={11} className="text-green-200" />
              <span className="text-xs text-green-100 font-medium">{formatUSDT(summary?.dailyEarnings ?? 0)}/day distribution</span>
            </div>
            {summary && summary.pendingEarnings > 0 && (
              <div className="flex items-center gap-1 bg-white/15 rounded-full px-2.5 py-0.5">
                <Clock size={11} className="text-yellow-200" />
                <span className="text-xs text-yellow-100 font-medium">
                  <LiveEarnings base={summary.pendingEarnings} rate={summary.dailyEarnings} /> pending
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          {stats.map(({ label, value, sub, icon: Icon, color, bg }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-3.5 shadow-sm">
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mb-2.5", bg)}>
                <Icon size={16} className={color} />
              </div>
              {value === null ? <Skeleton className="h-6 w-24 mb-1" /> : <p className="font-bold text-foreground text-base leading-tight">{value}</p>}
              {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Quick links to new pages */}
        <div className="grid grid-cols-3 gap-2.5">
          <Link href="/capital-allocation">
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl p-3 text-white shadow-sm text-center cursor-pointer hover:shadow-md transition-shadow">
              <div className="text-lg mb-1">📊</div>
              <p className="text-[10px] font-semibold leading-tight">Capital Allocation</p>
            </div>
          </Link>
          <Link href="/market-insights">
            <div className="bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl p-3 text-white shadow-sm text-center cursor-pointer hover:shadow-md transition-shadow">
              <div className="text-lg mb-1">📈</div>
              <p className="text-[10px] font-semibold leading-tight">Market Insights</p>
            </div>
          </Link>
          <Link href="/performance">
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-3 text-white shadow-sm text-center cursor-pointer hover:shadow-md transition-shadow">
              <div className="text-lg mb-1">⚡</div>
              <p className="text-[10px] font-semibold leading-tight">Performance</p>
            </div>
          </Link>
        </div>

        {/* Opportunity Insights */}
        <OpportunityInsightsWidget />

        {/* Referral Widget */}
        <ReferralWidget />

        {/* Live Activity Feed */}
        <LiveActivityFeed />

        {/* Market ticker */}
        {market && market.length > 0 && (
          <div>
            <h3 className="font-semibold text-sm text-foreground mb-2.5">Live Market</h3>
            <MarketTicker data={market} />
          </div>
        )}

      </div>
    </AppLayout>
  );
}
