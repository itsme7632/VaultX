import { useState } from "react";
import { BarChart3, TrendingUp, Users, DollarSign, Activity, Zap, ChevronDown, ChevronUp, ArrowLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useGetInvestmentPlans, getGetInvestmentPlansQueryKey } from "@workspace/api-client-react";
import { AppLayout } from "@/components/AppLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatUSDT, formatUSDTCompact } from "@/lib/format";
import { usePlatformMetrics } from "@/hooks/usePlatformMetrics";

const MONTHLY_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function MiniBarChart({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-1 h-16">
      {values.map((v, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
          <div
            className={cn("w-full rounded-t-sm transition-all duration-500", color)}
            style={{ height: `${(v / max) * 56}px`, minHeight: v > 0 ? 2 : 0 }}
          />
        </div>
      ))}
    </div>
  );
}

export default function PerformancePage() {
  const [, navigate] = useLocation();
  const [showMonthly, setShowMonthly] = useState(false);

  const { data: metrics, isLoading: metricsLoading } = usePlatformMetrics();

  const { data: chartData, isLoading: chartLoading } = useQuery({
    queryKey: ["platform-performance"],
    queryFn: async () => {
      const res = await fetch("/api/platform/performance", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 30000,
  });

  const currentMonth = new Date().getMonth();

  // Real monthly investment inflow — reconciled with Platform Capital via backend surplus logic.
  // No fallback arrays: if data is zero that is the true platform state.
  const monthlyDeposits: number[] = chartData?.monthlyDeposits ?? new Array(currentMonth + 1).fill(0);

  // Real monthly distributions paid from earning/reinvest transactions.
  const monthlyEarnings: number[] = chartData?.monthlyEarnings ?? new Array(currentMonth + 1).fill(0);

  // Real new user registrations per month from users.created_at.
  const monthlyNewUsers: number[] = chartData?.monthlyNewUsers ?? new Array(currentMonth + 1).fill(0);

  // Cumulative user totals (running total including users registered before this year).
  const monthlyCumulativeUsers: number[] = chartData?.monthlyCumulativeUsers ?? new Array(currentMonth + 1).fill(0);

  // Slice to current month for chart display
  const monthlyDepositsSlice  = monthlyDeposits.slice(0, currentMonth + 1);
  const monthlyEarningsSlice  = monthlyEarnings.slice(0, currentMonth + 1);

  const isLoading = metricsLoading;

  return (
    <AppLayout title="Performance Center">
      <div className="px-4 pt-5 pb-24 space-y-5">

        <button
          onClick={() => window.history.back()}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>

        {/* Hero */}
        <div className="bg-gradient-to-br from-primary via-blue-600 to-indigo-700 rounded-2xl p-5 text-white shadow-lg">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <BarChart3 size={20} className="text-white" />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight">Performance Center</h2>
              <p className="text-blue-100 text-xs">Real-time platform metrics</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="bg-white/15 rounded-xl py-3 px-3.5">
              {isLoading ? (
                <Skeleton className="h-6 w-20 bg-white/20 mb-1" />
              ) : (
                <p className="text-xl font-bold">{formatUSDTCompact(metrics?.totalRaised ?? 0)}</p>
              )}
              <p className="text-[10px] text-blue-100 mt-0.5">Platform Capital</p>
            </div>
            <div className="bg-white/15 rounded-xl py-3 px-3.5">
              {isLoading ? (
                <Skeleton className="h-6 w-16 bg-white/20 mb-1" />
              ) : (
                <p className="text-xl font-bold">{metrics?.activeOpportunities ?? 0}</p>
              )}
              <p className="text-[10px] text-blue-100 mt-0.5">Active Opportunities</p>
            </div>
          </div>
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-2 gap-3">
          {[
            {
              label: "Total Participants",
              value: isLoading ? null : (metrics?.totalParticipants ?? 0).toLocaleString(),
              icon: Users,
              color: "text-primary",
              bg: "bg-primary/10",
            },
            {
              label: "Capital Deployed",
              value: isLoading ? null : formatUSDTCompact(metrics?.capitalDeployed ?? 0),
              icon: DollarSign,
              color: "text-emerald-600",
              bg: "bg-emerald-50 dark:bg-emerald-950/30",
            },
            {
              label: "Distributions Paid",
              value: isLoading ? null : formatUSDTCompact(metrics?.distributionsPaid ?? 0),
              icon: TrendingUp,
              color: "text-purple-600",
              bg: "bg-purple-50 dark:bg-purple-950/30",
            },
            {
              label: "Active Investments",
              value: isLoading ? null : formatUSDTCompact(metrics?.activeInvestments ?? 0),
              icon: Activity,
              color: "text-amber-600",
              bg: "bg-amber-50 dark:bg-amber-950/30",
            },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-3.5 shadow-sm">
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mb-2.5", bg)}>
                <Icon size={16} className={color} />
              </div>
              {value === null ? (
                <Skeleton className="h-6 w-24 mb-1" />
              ) : (
                <p className="font-bold text-foreground text-base leading-tight">{value}</p>
              )}
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Capital deployment chart */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-semibold text-sm text-foreground">Capital Deployment</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Monthly investment inflow ({new Date().getFullYear()})</p>
            </div>
            <div className="flex items-center gap-1 bg-primary/10 px-2 py-1 rounded-lg">
              <TrendingUp size={11} className="text-primary" />
              <span className="text-[10px] text-primary font-bold">Live</span>
            </div>
          </div>
          {chartLoading ? (
            <Skeleton className="h-16 rounded-lg" />
          ) : (
            <MiniBarChart values={monthlyDepositsSlice} color="bg-primary" />
          )}
          <div className="flex justify-between mt-2">
            {MONTHLY_LABELS.slice(0, currentMonth + 1).map((m) => (
              <span key={m} className="text-[9px] text-muted-foreground flex-1 text-center">{m}</span>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 text-right">
            Total: {formatUSDTCompact(metrics?.totalRaised ?? 0)}
          </p>
        </div>

        {/* Earnings distributed chart */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-semibold text-sm text-foreground">Distributions Paid</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Monthly distributions paid out</p>
            </div>
            <Zap size={16} className="text-amber-500" />
          </div>
          {chartLoading ? (
            <Skeleton className="h-16 rounded-lg" />
          ) : (
            <MiniBarChart values={monthlyEarningsSlice} color="bg-emerald-500" />
          )}
          <div className="flex justify-between mt-2">
            {MONTHLY_LABELS.slice(0, currentMonth + 1).map((m) => (
              <span key={m} className="text-[9px] text-muted-foreground flex-1 text-center">{m}</span>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 text-right">
            Total: {formatUSDTCompact(metrics?.distributionsPaid ?? 0)}
          </p>
        </div>

        {/* Monthly statistics table */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <button
            type="button"
            onClick={() => setShowMonthly((p) => !p)}
            className="w-full flex items-center justify-between px-5 py-4 text-left"
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <BarChart3 size={15} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Monthly Statistics</p>
                <p className="text-[11px] text-muted-foreground">Breakdown by month — {new Date().getFullYear()}</p>
              </div>
            </div>
            {showMonthly ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
          </button>

          {showMonthly && (
            <div className="border-t border-border">
              {/* Column headers */}
              <div className="grid grid-cols-4 bg-muted/40 px-4 py-2.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                <span>Month</span>
                <span className="text-right">Inflow</span>
                <span className="text-right">Distributions</span>
                <span className="text-right">New Users</span>
              </div>

              {chartLoading ? (
                <div className="p-4 space-y-2">
                  {[1,2,3].map(i => <Skeleton key={i} className="h-9 rounded-lg" />)}
                </div>
              ) : (
                <div className="divide-y divide-border max-h-72 overflow-y-auto">
                  {MONTHLY_LABELS.slice(0, currentMonth + 1).map((month, i) => {
                    const inflow   = monthlyDeposits[i] ?? 0;
                    const distrib  = monthlyEarnings[i] ?? 0;
                    const newUsers = monthlyNewUsers[i] ?? 0;
                    return (
                      <div key={month} className="grid grid-cols-4 px-4 py-3 text-sm">
                        <span className="text-foreground font-medium">{month}</span>
                        <span className="text-right text-foreground font-semibold">
                          {inflow > 0 ? formatUSDTCompact(inflow) : "—"}
                        </span>
                        <span className="text-right text-emerald-600 font-semibold">
                          {distrib > 0 ? formatUSDTCompact(distrib) : "—"}
                        </span>
                        <span className="text-right text-muted-foreground">
                          {newUsers > 0 ? `+${newUsers}` : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Totals row */}
              {!chartLoading && (
                <div className="grid grid-cols-4 px-4 py-3 bg-muted/30 border-t border-border text-sm font-bold">
                  <span className="text-foreground">Total</span>
                  <span className="text-right text-foreground">
                    {formatUSDTCompact(metrics?.totalRaised ?? 0)}
                  </span>
                  <span className="text-right text-emerald-600">
                    {formatUSDTCompact(metrics?.distributionsPaid ?? 0)}
                  </span>
                  <span className="text-right text-muted-foreground">
                    {(metrics?.totalParticipants ?? 0).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Opportunity highlights */}
        {(metrics?.mostPopular || metrics?.topFunded || metrics?.fastestGrowing) && (
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
            <p className="font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
              <Activity size={14} className="text-primary" />
              Opportunity Highlights
            </p>
            <div className="space-y-2.5">
              {[
                {
                  icon: "⭐",
                  label: "Most Popular",
                  plan: metrics?.mostPopular,
                  sub: metrics?.mostPopular
                    ? `${(metrics.mostPopular.participants ?? 0).toLocaleString()} participants`
                    : null,
                },
                {
                  icon: "🏆",
                  label: "Top Funded",
                  plan: metrics?.topFunded,
                  sub: metrics?.topFunded
                    ? `${metrics.topFunded.fundingPct ?? 0}% funded`
                    : null,
                },
                {
                  icon: "🚀",
                  label: "Fastest Growing",
                  plan: metrics?.fastestGrowing,
                  sub: null,
                },
              ].filter(({ plan }) => plan != null).map(({ icon, label, plan, sub }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <span>{icon}</span>{label}
                  </span>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-foreground">{plan?.name}</p>
                    {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-3">
              Rankings update automatically from live platform data.
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
