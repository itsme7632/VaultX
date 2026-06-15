import { TrendingUp, Shield, Zap, CheckCircle, ArrowRight, Clock, Wallet, Star } from "lucide-react";
import {
  useGetInvestmentPlans, getGetInvestmentPlansQueryKey,
  useGetUserInvestments, getGetUserInvestmentsQueryKey,
  useGetWallet, getGetWalletQueryKey,
} from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { LiveCounter } from "@/components/LiveCounter";
import { cn } from "@/lib/utils";
import { formatUSDT, formatDate } from "@/lib/format";
import { useState } from "react";

const RISK_COLORS: Record<string, string> = {
  low: "bg-emerald-50 text-emerald-600 border-emerald-200",
  medium: "bg-amber-50 text-amber-600 border-amber-200",
  high: "bg-red-50 text-red-600 border-red-200",
};

const RISK_ICONS: Record<string, React.ElementType> = {
  low: Shield,
  medium: TrendingUp,
  high: Zap,
};

const PLAN_GRADIENTS: Record<number, string> = {
  1: "from-slate-600 to-slate-800",
  2: "from-blue-500 to-blue-700",
  3: "from-amber-500 to-orange-600",
  4: "from-purple-600 to-purple-800",
};

export default function InvestmentsPage() {
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<"plans" | "active">("plans");

  const { data: plans, isLoading: plansLoading } = useGetInvestmentPlans({
    query: { queryKey: getGetInvestmentPlansQueryKey(), staleTime: 300000 },
  });

  // Same query key + refetchInterval as Portfolio page — they share the cache
  const { data: userInvestments, isLoading: uiLoading } = useGetUserInvestments({
    query: {
      queryKey: getGetUserInvestmentsQueryKey(),
      staleTime: 15000,
      refetchInterval: 30000,
    },
  });

  const { data: wallet } = useGetWallet({
    query: { queryKey: getGetWalletQueryKey(), staleTime: 30000 },
  });

  const activeCount = userInvestments?.filter((i: any) => i.status === "active").length ?? 0;

  return (
    <AppLayout title="Investments">
      <div className="px-4 pt-5 pb-24">
        <div className="flex bg-muted rounded-xl p-1 mb-5">
          <button
            onClick={() => setTab("plans")}
            className={cn("flex-1 py-2 rounded-lg text-sm font-semibold transition-all", tab === "plans" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground")}
          >
            Plans
          </button>
          <button
            onClick={() => setTab("active")}
            className={cn("flex-1 py-2 rounded-lg text-sm font-semibold transition-all relative", tab === "active" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground")}
          >
            My Investments
            {activeCount > 0 && <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-white text-[10px] font-bold">{activeCount}</span>}
          </button>
        </div>

        {tab === "plans" && (
          <div className="space-y-4">
            {plansLoading ? (
              [1, 2, 3].map((i) => <Skeleton key={i} className="h-56 rounded-2xl" />)
            ) : [...(plans ?? [])].sort((a: any, b: any) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0)).map((plan: any) => {
              const RiskIcon = RISK_ICONS[plan.riskLevel] ?? Shield;
              const minRoi = plan.minRoiRate ?? 0.025;
              const maxRoi = plan.maxRoiRate ?? 0.030;
              const gradient = PLAN_GRADIENTS[plan.id] ?? "from-slate-600 to-slate-800";

              return (
                <div key={plan.id} className={cn("bg-white border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow", plan.isFeatured ? "border-amber-300 ring-2 ring-amber-200" : "border-border")}>
                  {plan.isFeatured && (
                    <div className="bg-gradient-to-r from-amber-400 to-orange-400 px-4 py-1.5 flex items-center gap-1.5">
                      <Star size={11} className="text-white fill-white" />
                      <p className="text-white text-[11px] font-bold tracking-wide uppercase">Featured Plan</p>
                    </div>
                  )}
                  <div className={cn("bg-gradient-to-r p-5 text-white", gradient)}>
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-xl">{plan.name}</h3>
                        <p className="text-white/70 text-xs mt-1">{plan.description}</p>
                      </div>
                      <Badge className={cn("text-xs font-medium capitalize border", RISK_COLORS[plan.riskLevel])}>
                        <RiskIcon size={11} className="mr-1" />
                        {plan.riskLevel} risk
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-4">
                      <div className="bg-white/15 rounded-xl py-2.5 text-center">
                        <p className="text-lg font-bold">{(minRoi * 100).toFixed(1)}%–{(maxRoi * 100).toFixed(1)}%</p>
                        <p className="text-[10px] text-white/70 mt-0.5">Daily ROI</p>
                      </div>
                      <div className="bg-white/15 rounded-xl py-2.5 text-center">
                        <p className="text-lg font-bold">{plan.durationDays}d</p>
                        <p className="text-[10px] text-white/70 mt-0.5">Duration</p>
                      </div>
                      <div className="bg-white/15 rounded-xl py-2.5 text-center">
                        <p className="text-lg font-bold">{((minRoi + maxRoi) / 2 * plan.durationDays * 100).toFixed(0)}%</p>
                        <p className="text-[10px] text-white/70 mt-0.5">Est. Total</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="flex justify-between text-xs text-muted-foreground mb-3">
                      <span>Min: <span className="font-semibold text-foreground">{formatUSDT(plan.minAmount)}</span></span>
                      <span>Max: <span className="font-semibold text-foreground">{formatUSDT(plan.maxAmount)}</span></span>
                    </div>

                    {plan.features?.length > 0 && (
                      <div className="grid grid-cols-1 gap-1 mb-4">
                        {plan.features.map((f: string, i: number) => (
                          <div key={i} className="flex items-center gap-1.5">
                            <CheckCircle size={12} className="text-emerald-500 shrink-0" />
                            <span className="text-xs text-muted-foreground">{f}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <Button
                      className="w-full h-10 font-semibold"
                      onClick={() => navigate(`/invest/${plan.id}`)}
                    >
                      Invest Now <ArrowRight size={14} className="ml-1" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === "active" && (
          <div className="space-y-4">
            {uiLoading ? (
              [1, 2].map((i) => <Skeleton key={i} className="h-44 rounded-2xl" />)
            ) : userInvestments?.length ? (
              userInvestments.map((inv: any) => {
                const elapsed = Math.max(0, inv.daysTotal - inv.daysRemaining);
                const progressPct = Math.max(inv.status === "active" ? 2 : 0, inv.progressPercent);

                return (
                  <div key={inv.id} className="bg-white border border-border rounded-2xl p-5 shadow-sm">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-foreground">{inv.planName}</h3>
                        <p className="text-xs text-muted-foreground">{formatDate(inv.startDate)} – {formatDate(inv.endDate)}</p>
                      </div>
                      <Badge variant="outline" className={cn("text-xs capitalize font-medium", inv.status === "active" ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "")}>
                        {inv.status}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Invested</p>
                        <p className="font-bold text-foreground text-sm">{formatUSDT(inv.amount)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Live Profit</p>
                        <p className="font-bold text-sm">
                          {inv.status === "active" ? (
                            <LiveCounter
                              pendingEarnings={inv.pendingEarnings}
                              dailyRate={inv.dailyReturnRate}
                              principal={inv.amount}
                              lastEarningAt={inv.lastEarningAt ?? null}
                              startDate={inv.startDate}
                              decimals={4}
                            />
                          ) : (
                            <span className="text-foreground">{formatUSDT(inv.pendingEarnings)}</span>
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Daily ROI</p>
                        <p className="font-semibold text-primary text-sm">
                          {((inv.minRoiRate ?? 0.025) * 100).toFixed(1)}% – {((inv.maxRoiRate ?? 0.030) * 100).toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Days Left</p>
                        <p className="font-semibold text-foreground text-sm flex items-center gap-1">
                          <Clock size={12} />
                          {inv.daysRemaining}d
                        </p>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div>
                      <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                        <span>{inv.progressPercent.toFixed(1)}% complete</span>
                        <span>Day {elapsed} of {inv.daysTotal}</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary to-blue-400 rounded-full transition-all duration-500"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12 bg-white border border-border rounded-2xl">
                <Wallet size={32} className="text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground">No investments yet</p>
                <p className="text-xs text-muted-foreground mt-1">Choose a plan to start earning daily returns</p>
                <Button variant="outline" className="mt-4 text-sm" onClick={() => setTab("plans")}>Browse Plans</Button>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
