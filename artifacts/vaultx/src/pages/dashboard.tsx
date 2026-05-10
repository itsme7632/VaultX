import { useEffect, useState, useRef } from "react";
import { TrendingUp, DollarSign, Activity, ArrowUpRight, Zap, Clock, Newspaper, ArrowRight } from "lucide-react";
import {
  useGetDashboardSummary, getGetDashboardSummaryQueryKey,
  useGetMarketPrices, getGetMarketPricesQueryKey,
  useGetEarningsChart, getGetEarningsChartQueryKey,
  useGetDashboardActivity, getGetDashboardActivityQueryKey,
} from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { AppLayout } from "@/components/AppLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatUSDT, formatDateTime } from "@/lib/format";
import { Link } from "wouter";

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
          <div key={coin.symbol} className="flex items-center gap-2 bg-white border border-border rounded-xl px-3 py-2 min-w-[130px]">
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

const activityTypeColor: Record<string, string> = {
  deposit: "text-emerald-500",
  withdrawal: "text-destructive",
  earning: "text-amber-500",
  reinvest: "text-primary",
  investment: "text-primary",
  transfer: "text-blue-400",
  referral: "text-purple-500",
};

const activityTypeBg: Record<string, string> = {
  deposit: "bg-emerald-50",
  withdrawal: "bg-red-50",
  earning: "bg-amber-50",
  reinvest: "bg-primary/10",
  investment: "bg-primary/10",
  transfer: "bg-blue-50",
  referral: "bg-purple-50",
};

export default function DashboardPage() {
  const { data: summary, isLoading: summaryLoading } = useGetDashboardSummary({
    query: { queryKey: getGetDashboardSummaryQueryKey(), staleTime: 30000 },
  });
  const { data: market } = useGetMarketPrices({
    query: { queryKey: getGetMarketPricesQueryKey(), staleTime: 60000 },
  });
  const { data: chartData } = useGetEarningsChart(
    { days: 7 },
    { query: { queryKey: getGetEarningsChartQueryKey({ days: 7 }), staleTime: 60000 } }
  );
  const { data: activity } = useGetDashboardActivity({
    query: { queryKey: getGetDashboardActivityQueryKey(), staleTime: 30000 },
  });
  const { data: newsData } = useQuery({
    queryKey: ["news", "dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/news?limit=3", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 120000,
  });

  const stats = [
    { label: "Total Balance", value: summary ? formatUSDT(summary.totalBalance) : null, icon: DollarSign, color: "text-primary", bg: "bg-primary/10" },
    { label: "Active Investments", value: summary ? `${summary.activeInvestmentsCount} plans` : null, sub: summary ? formatUSDT(summary.activeInvestmentsValue) : null, icon: Activity, color: "text-emerald-500", bg: "bg-emerald-50" },
    { label: "Daily Earnings", value: summary ? formatUSDT(summary.dailyEarnings) : null, icon: TrendingUp, color: "text-amber-500", bg: "bg-amber-50" },
    { label: "Total Earned", value: summary ? formatUSDT(summary.totalEarnings) : null, icon: Zap, color: "text-purple-500", bg: "bg-purple-50" },
  ];

  const categoryLabel: Record<string, string> = {
    announcement: "Announcement", investment: "Investment", security: "Security", market: "Market",
  };
  const categoryColor: Record<string, string> = {
    announcement: "bg-primary/10 text-primary", investment: "bg-emerald-50 text-emerald-600",
    security: "bg-amber-50 text-amber-600", market: "bg-purple-50 text-purple-600",
  };

  return (
    <AppLayout>
      <div className="px-4 pt-5 pb-24 space-y-5">
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
              <span className="text-xs text-green-100 font-medium">{formatUSDT(summary?.dailyEarnings ?? 0)}/day</span>
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
            <div key={label} className="bg-white border border-border rounded-xl p-3.5 shadow-sm">
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mb-2.5", bg)}>
                <Icon size={16} className={color} />
              </div>
              {value === null ? <Skeleton className="h-6 w-24 mb-1" /> : <p className="font-bold text-foreground text-base leading-tight">{value}</p>}
              {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Earnings chart */}
        {chartData !== undefined && (
          <div className="bg-white border border-border rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm text-foreground">7-Day Earnings</h3>
              <span className="text-xs text-muted-foreground">Last 7 days</span>
            </div>
            {(() => {
              const points = chartData?.length ? chartData : Array.from({ length: 7 }, (_, i) => ({ date: new Date(Date.now() - (6 - i) * 86400000).toISOString().slice(0, 10), earnings: 0 }));
              const hasEarnings = points.some((d: any) => d.earnings > 0);
              return hasEarnings ? (
                <ResponsiveContainer width="100%" height={100}>
                  <AreaChart data={points}>
                    <defs>
                      <linearGradient id="earningsGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(217,91%,60%)" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="hsl(217,91%,60%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(215,20%,55%)" }} tickLine={false} axisLine={false} tickFormatter={(v: string) => v.slice(5)} />
                    <YAxis hide domain={[0, (dataMax: number) => dataMax * 1.3]} />
                    <Tooltip formatter={(value: number) => [formatUSDT(value), "Earnings"]} labelStyle={{ fontSize: 11 }} contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(214,32%,88%)" }} />
                    <Area type="monotone" dataKey="earnings" stroke="hsl(217,91%,60%)" strokeWidth={2} fill="url(#earningsGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[100px] flex flex-col items-center justify-center gap-1">
                  <TrendingUp size={20} className="text-muted-foreground/40" />
                  <p className="text-xs text-muted-foreground">Earnings will appear after your first payout</p>
                  <div className="flex gap-1 mt-1">
                    {points.map((d: any) => (
                      <div key={d.date} className="flex flex-col items-center gap-1">
                        <div className="w-1.5 h-10 bg-muted rounded-full" />
                        <span className="text-[9px] text-muted-foreground">{d.date.slice(5)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Market ticker */}
        {market && market.length > 0 && (
          <div>
            <h3 className="font-semibold text-sm text-foreground mb-2.5">Live Market</h3>
            <MarketTicker data={market} />
          </div>
        )}

        {/* News section */}
        {newsData && newsData.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                <Newspaper size={14} className="text-primary" />
                Platform News
              </h3>
              <Link href="/news" className="text-xs text-primary font-medium flex items-center gap-0.5">
                View all <ArrowRight size={11} />
              </Link>
            </div>
            <div className="space-y-2.5">
              {newsData.map((post: any) => (
                <Link key={post.id} href={`/news/${post.id}`}>
                  <div className="bg-white border border-border rounded-xl p-3.5 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <p className="font-semibold text-sm text-foreground leading-tight line-clamp-1">{post.title}</p>
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0", categoryColor[post.category] ?? "bg-muted text-muted-foreground")}>
                        {categoryLabel[post.category] ?? post.category}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{post.excerpt}</p>
                    <p className="text-[10px] text-muted-foreground mt-1.5">{formatDateTime(post.publishedAt ?? post.createdAt)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Recent activity */}
        {activity && activity.length > 0 && (
          <div>
            <h3 className="font-semibold text-sm text-foreground mb-2.5">Recent Activity</h3>
            <div className="bg-white border border-border rounded-xl divide-y divide-border shadow-sm overflow-hidden">
              {activity.slice(0, 6).map((item: any) => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0", activityTypeBg[item.type] ?? "bg-muted")}>
                    <ArrowUpRight size={14} className={activityTypeColor[item.type] ?? "text-foreground"} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.description}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</p>
                  </div>
                  <p className={cn("text-sm font-semibold flex-shrink-0", ["withdrawal", "investment", "transfer"].includes(item.type) ? "text-destructive" : "text-emerald-500")}>
                    {["withdrawal", "investment", "transfer"].includes(item.type) ? "-" : "+"}{formatUSDT(item.amount)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
