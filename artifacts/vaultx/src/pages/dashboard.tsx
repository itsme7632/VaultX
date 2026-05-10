import { useEffect, useState, useRef } from "react";
import { TrendingUp, DollarSign, Activity, ArrowUpRight, Zap, Clock, Newspaper, ArrowRight } from "lucide-react";
import {
  useGetDashboardSummary, getGetDashboardSummaryQueryKey,
  useGetMarketPrices, getGetMarketPricesQueryKey,
  useGetEarningsChart, getGetEarningsChartQueryKey,
  useGetDashboardActivity, getGetDashboardActivityQueryKey,
} from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";
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
        {chartData !== undefined && (() => {
          const points: any[] = chartData?.length
            ? chartData
            : Array.from({ length: 7 }, (_, i) => {
                const d = new Date(Date.now() - (6 - i) * 86400000);
                return {
                  date: d.toISOString().slice(0, 10),
                  label: d.toLocaleDateString("en-US", { weekday: "short" }),
                  earnings: 0,
                };
              });
          const hasEarnings = points.some((d: any) => d.earnings > 0);
          const weekTotal = points.reduce((s: number, d: any) => s + (d.earnings ?? 0), 0);
          const maxVal = Math.max(...points.map((d: any) => d.earnings ?? 0), 0.001);
          const todayLabel = new Date().toLocaleDateString("en-US", { weekday: "short" });

          const CustomTooltip = ({ active, payload, label }: any) => {
            if (!active || !payload?.length) return null;
            return (
              <div className="bg-white border border-border rounded-xl shadow-lg px-3 py-2 text-xs">
                <p className="text-muted-foreground font-medium mb-0.5">{label}</p>
                <p className="font-bold text-emerald-600">{formatUSDT(payload[0]?.value ?? 0)}</p>
              </div>
            );
          };

          return (
            <div className="bg-white border border-border rounded-2xl p-4 shadow-sm overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between mb-1">
                <div>
                  <p className="font-semibold text-sm text-foreground">7-Day Earnings</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Includes ROI, reinvest &amp; referral income</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Weekly total</p>
                  <p className={cn("text-base font-bold", hasEarnings ? "text-emerald-600" : "text-muted-foreground")}>
                    {hasEarnings ? formatUSDT(weekTotal) : "—"}
                  </p>
                </div>
              </div>

              {/* Chart */}
              <div className="relative mt-3">
                <svg width="0" height="0" className="absolute">
                  <defs>
                    <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(142,76%,42%)" stopOpacity={1} />
                      <stop offset="100%" stopColor="hsl(142,76%,42%)" stopOpacity={0.4} />
                    </linearGradient>
                    <linearGradient id="barGradGhost" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(215,20%,88%)" stopOpacity={1} />
                      <stop offset="100%" stopColor="hsl(215,20%,88%)" stopOpacity={0.3} />
                    </linearGradient>
                    <filter id="barGlow">
                      <feGaussianBlur stdDeviation="2" result="blur" />
                      <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                  </defs>
                </svg>

                <ResponsiveContainer width="100%" height={160}>
                  <ComposedChart data={points} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="28%">
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(214,32%,94%)" />
                    <XAxis
                      dataKey="label"
                      tick={({ x, y, payload }: any) => {
                        const isToday = payload.value === todayLabel;
                        return (
                          <text x={x} y={y + 12} textAnchor="middle" fill={isToday ? "hsl(217,91%,55%)" : "hsl(215,20%,55%)"} fontSize={10} fontWeight={isToday ? 700 : 400}>
                            {payload.value}
                          </text>
                        );
                      }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis hide domain={[0, maxVal * 1.4]} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(214,32%,97%)", radius: 6 } as any} />
                    <Bar dataKey="earnings" radius={[6, 6, 3, 3]} maxBarSize={32}>
                      {points.map((entry: any, index: number) => {
                        const isToday = entry.label === todayLabel;
                        return (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.earnings > 0 ? (isToday ? "url(#barGrad)" : "hsl(142,60%,50%)") : "url(#barGradGhost)"}
                            opacity={entry.earnings > 0 ? 1 : 0.6}
                          />
                        );
                      })}
                    </Bar>
                    {hasEarnings && (
                      <Line
                        type="monotone"
                        dataKey="earnings"
                        stroke="hsl(217,91%,60%)"
                        strokeWidth={1.5}
                        dot={{ fill: "hsl(217,91%,60%)", r: 3, strokeWidth: 0 }}
                        activeDot={{ r: 5, fill: "hsl(217,91%,60%)", stroke: "white", strokeWidth: 2 }}
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>

                {!hasEarnings && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-4">
                    <div className="bg-white/90 rounded-xl px-4 py-2 flex items-center gap-2">
                      <TrendingUp size={14} className="text-muted-foreground/50" />
                      <p className="text-xs text-muted-foreground">Earnings appear after first ROI payout</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer legend */}
              <div className="flex items-center gap-4 mt-2 pt-2 border-t border-border">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                  <span className="text-[10px] text-muted-foreground">Daily earnings</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-0.5 bg-primary rounded-full" />
                  <span className="text-[10px] text-muted-foreground">Trend</span>
                </div>
              </div>
            </div>
          );
        })()}

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
