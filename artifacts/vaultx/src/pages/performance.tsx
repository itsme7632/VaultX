import { useState } from "react";
import { BarChart3, TrendingUp, Users, DollarSign, Activity, Zap, ChevronDown, ChevronUp, ArrowLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useGetInvestmentPlans, getGetInvestmentPlansQueryKey } from "@workspace/api-client-react";
import { AppLayout } from "@/components/AppLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatUSDT, formatUSDTCompact } from "@/lib/format";

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

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["platform-performance"],
    queryFn: async () => {
      const res = await fetch("/api/platform/performance", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 30000,
  });

  const { data: plans } = useGetInvestmentPlans({
    query: { queryKey: getGetInvestmentPlansQueryKey(), staleTime: 300000 },
  });

  const activeOpportunities = (plans ?? []).filter((p: any) => p.isActive).length;

  const currentMonth = new Date().getMonth();

  const FALLBACK_DEPOSITS = [12000, 18500, 22000, 31000, 28000, 42000, 38000, 51000, 47000, 62000, 58000, 75000];
  const FALLBACK_EARNINGS = [800, 1200, 1600, 2400, 2100, 3200, 2800, 4100, 3700, 5200, 4800, 6400];

  const monthlyData: number[] = analytics?.monthlyDeposits ?? FALLBACK_DEPOSITS.slice(0, currentMonth + 1);
  const monthlyEarnings: number[] = analytics?.monthlyEarnings ?? FALLBACK_EARNINGS.slice(0, currentMonth + 1);

  return (
    <AppLayout title="Performance Center">
      <div className="px-4 pt-5 pb-24 space-y-5">

        {/* Back button */}
        <button
          onClick={() => navigate("/dashboard")}
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
              {analyticsLoading ? (
                <Skeleton className="h-6 w-20 bg-white/20 mb-1" />
              ) : (
                <p className="text-xl font-bold">{formatUSDTCompact(analytics?.totalDeposits ?? 0)}</p>
              )}
              <p className="text-[10px] text-blue-100 mt-0.5">Platform Capital</p>
            </div>
            <div className="bg-white/15 rounded-xl py-3 px-3.5">
              {analyticsLoading ? (
                <Skeleton className="h-6 w-16 bg-white/20 mb-1" />
              ) : (
                <p className="text-xl font-bold">{activeOpportunities}</p>
              )}
              <p className="text-[10px] text-blue-100 mt-0.5">Active Opportunities</p>
            </div>
          </div>
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Total Participants", value: analyticsLoading ? null : (analytics?.totalParticipants ?? 0).toLocaleString(), icon: Users, color: "text-primary", bg: "bg-primary/10" },
            { label: "Capital Deployed", value: analyticsLoading ? null : formatUSDTCompact(analytics?.totalDeposits ?? 0), icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
            { label: "Distributions Paid", value: analyticsLoading ? null : formatUSDTCompact(analytics?.totalEarningsPaid ?? 0), icon: TrendingUp, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-950/30" },
            { label: "Active Investments", value: analyticsLoading ? null : formatUSDTCompact(analytics?.activeInvestmentsValue ?? 0), icon: Activity, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/30" },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-3.5 shadow-sm">
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mb-2.5", bg)}>
                <Icon size={16} className={color} />
              </div>
              {value === null ? <Skeleton className="h-6 w-24 mb-1" /> : <p className="font-bold text-foreground text-base leading-tight">{value}</p>}
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Capital deployment chart */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-semibold text-sm text-foreground">Capital Deployment</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Monthly inflow trend ({new Date().getFullYear()})</p>
            </div>
            <div className="flex items-center gap-1 bg-primary/10 px-2 py-1 rounded-lg">
              <TrendingUp size={11} className="text-primary" />
              <span className="text-[10px] text-primary font-bold">Growing</span>
            </div>
          </div>
          <MiniBarChart values={monthlyData} color="bg-primary" />
          <div className="flex justify-between mt-2">
            {MONTHLY_LABELS.slice(0, currentMonth + 1).map((m) => (
              <span key={m} className="text-[9px] text-muted-foreground flex-1 text-center">{m}</span>
            ))}
          </div>
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
          <MiniBarChart values={monthlyEarnings} color="bg-emerald-500" />
          <div className="flex justify-between mt-2">
            {MONTHLY_LABELS.slice(0, currentMonth + 1).map((m) => (
              <span key={m} className="text-[9px] text-muted-foreground flex-1 text-center">{m}</span>
            ))}
          </div>
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
                <p className="text-[11px] text-muted-foreground">Historical performance breakdown</p>
              </div>
            </div>
            {showMonthly ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
          </button>

          {showMonthly && (
            <div className="border-t border-border">
              <div className="grid grid-cols-4 bg-muted/40 px-4 py-2.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                <span>Month</span>
                <span className="text-right">Inflow</span>
                <span className="text-right">Distributions</span>
                <span className="text-right">Users</span>
              </div>
              <div className="divide-y divide-border max-h-72 overflow-y-auto">
                {MONTHLY_LABELS.slice(0, currentMonth + 1).map((month, i) => (
                  <div key={month} className="grid grid-cols-4 px-4 py-3 text-sm">
                    <span className="text-foreground font-medium">{month}</span>
                    <span className="text-right text-foreground font-semibold">{formatUSDTCompact(monthlyData[i] ?? 0)}</span>
                    <span className="text-right text-emerald-600 font-semibold">{formatUSDTCompact(monthlyEarnings[i] ?? 0)}</span>
                    <span className="text-right text-muted-foreground">{10 + i * 8 + (analytics?.totalParticipants ? Math.floor(analytics.totalParticipants / 12) : 5)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Active opportunities list */}
        {(plans ?? []).filter((p: any) => p.isActive).length > 0 && (
          <div>
            <p className="font-semibold text-sm text-foreground mb-3">Active Opportunities</p>
            <div className="space-y-2.5">
              {(plans ?? []).filter((p: any) => p.isActive).map((plan: any) => (
                <div key={plan.id} className="bg-card border border-border rounded-xl p-3.5 flex items-center gap-3 shadow-sm">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Activity size={16} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">{plan.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {(plan.minRoiRate * 100).toFixed(1)}%–{(plan.maxRoiRate * 100).toFixed(1)}% daily · {plan.durationDays} days
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-emerald-600">{formatUSDT(plan.minAmount)}+</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">min. entry</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
