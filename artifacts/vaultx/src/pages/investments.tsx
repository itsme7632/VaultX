import { TrendingUp, CheckCircle, ArrowRight, Clock, Wallet, Star, Users, Target, Info } from "lucide-react";
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

const OPPORTUNITY_GRADIENTS: Record<number, string> = {
  1: "from-blue-600 to-indigo-700",
  2: "from-emerald-500 to-teal-700",
  3: "from-amber-500 to-orange-600",
  4: "from-purple-600 to-violet-800",
  5: "from-rose-500 to-pink-700",
  6: "from-cyan-500 to-blue-700",
  7: "from-lime-500 to-green-700",
  8: "from-fuchsia-600 to-purple-800",
};

const CATEGORIES: Record<number, string> = {
  1: "Digital Assets",
  2: "Technology Infrastructure",
  3: "Artificial Intelligence",
  4: "Renewable Energy",
  5: "Global Commerce",
  6: "Financial Technology",
  7: "Blockchain Innovation",
  8: "Strategic Capital",
};

function seededInt(planId: number, salt: number, min: number, max: number) {
  const seed = (planId * 31 + salt * 17) % 97;
  return min + Math.floor((seed / 97) * (max - min));
}

export default function InvestmentsPage() {
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<"opportunities" | "active">("opportunities");

  const { data: plans, isLoading: plansLoading } = useGetInvestmentPlans({
    query: { queryKey: getGetInvestmentPlansQueryKey(), staleTime: 300000 },
  });

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
    <AppLayout title="Opportunities">
      <div className="px-4 pt-5 pb-24">

        {/* Tab switcher */}
        <div className="flex bg-muted rounded-xl p-1 mb-5">
          <button
            onClick={() => setTab("opportunities")}
            className={cn("flex-1 py-2 rounded-lg text-sm font-semibold transition-all", tab === "opportunities" ? "bg-white dark:bg-slate-800 shadow-sm text-foreground" : "text-muted-foreground")}
          >
            Available Opportunities
          </button>
          <button
            onClick={() => setTab("active")}
            className={cn("flex-1 py-2 rounded-lg text-sm font-semibold transition-all relative", tab === "active" ? "bg-white dark:bg-slate-800 shadow-sm text-foreground" : "text-muted-foreground")}
          >
            My Active Opportunities
            {activeCount > 0 && <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-white text-[10px] font-bold">{activeCount}</span>}
          </button>
        </div>

        {tab === "opportunities" && (
          <div className="space-y-4">
            {plansLoading ? (
              [1, 2, 3].map((i) => <Skeleton key={i} className="h-64 rounded-2xl" />)
            ) : [...(plans ?? [])].sort((a: any, b: any) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0)).map((plan: any) => {
              const minRoi = plan.minRoiRate ?? 0.025;
              const maxRoi = plan.maxRoiRate ?? 0.030;
              const gradient = OPPORTUNITY_GRADIENTS[plan.id] ?? "from-blue-600 to-indigo-700";
              const category = CATEGORIES[plan.id] ?? "Strategic Capital";
              const participants = seededInt(plan.id, 3, 120, 520);
              const raisedPct = seededInt(plan.id, 2, 48, 82);

              return (
                <div
                  key={plan.id}
                  className={cn(
                    "bg-card border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow",
                    plan.isFeatured ? "border-amber-300 ring-2 ring-amber-200" : "border-border"
                  )}
                >
                  {plan.isFeatured && (
                    <div className="bg-gradient-to-r from-amber-400 to-orange-400 px-4 py-1.5 flex items-center gap-1.5">
                      <Star size={11} className="text-white fill-white" />
                      <p className="text-white text-[11px] font-bold tracking-wide uppercase">Featured Opportunity</p>
                    </div>
                  )}
                  <div className={cn("bg-gradient-to-r p-5 text-white", gradient)}>
                    <div className="flex items-start justify-between mb-1">
                      <Badge className="bg-white/20 text-white border-white/30 text-[10px] font-semibold mb-2">
                        {category}
                      </Badge>
                      <Badge className="bg-emerald-400/30 text-emerald-100 border-emerald-300/40 text-[10px]">
                        Funding Active
                      </Badge>
                    </div>
                    <div className="mb-4">
                      <h3 className="font-bold text-xl">{plan.name}</h3>
                      <p className="text-white/70 text-xs mt-1">{plan.description}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-4">
                      <div className="bg-white/15 rounded-xl py-2.5 text-center">
                        <p className="text-lg font-bold">{(minRoi * 100).toFixed(1)}%–{(maxRoi * 100).toFixed(1)}%</p>
                        <p className="text-[10px] text-white/70 mt-0.5">Daily Return</p>
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
                    {/* Participants & funding progress */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                      <div className="flex items-center gap-1">
                        <Users size={11} />
                        <span>{participants.toLocaleString()} participants</span>
                      </div>
                      <span className="font-semibold text-foreground">{raisedPct}% funded</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-4">
                      <div
                        className={cn("h-full rounded-full bg-gradient-to-r", OPPORTUNITY_GRADIENTS[plan.id] ?? "from-blue-600 to-indigo-700")}
                        style={{ width: `${raisedPct}%` }}
                      />
                    </div>

                    <div className="flex justify-between text-xs text-muted-foreground mb-4">
                      <div className="flex items-center gap-1">
                        <Target size={10} />
                        <span>Min: <span className="font-semibold text-foreground">{formatUSDT(plan.minAmount)}</span></span>
                      </div>
                      <span>Max: <span className="font-semibold text-foreground">{formatUSDT(plan.maxAmount)}</span></span>
                    </div>

                    {plan.features?.length > 0 && (
                      <div className="grid grid-cols-1 gap-1 mb-4">
                        {plan.features.slice(0, 3).map((f: string, i: number) => (
                          <div key={i} className="flex items-center gap-1.5">
                            <CheckCircle size={12} className="text-emerald-500 shrink-0" />
                            <span className="text-xs text-muted-foreground">{f}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 text-xs h-9"
                        onClick={() => navigate(`/opportunity/${plan.id}`)}
                      >
                        <Info size={12} />
                        Details
                      </Button>
                      <Button
                        className="flex-1 h-9 font-semibold text-sm"
                        onClick={() => navigate(`/invest/${plan.id}`)}
                      >
                        Participate Now <ArrowRight size={13} className="ml-1" />
                      </Button>
                    </div>
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
                  <div key={inv.id} className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-foreground">{inv.planName}</h3>
                        <p className="text-xs text-muted-foreground">{formatDate(inv.startDate)} – {formatDate(inv.endDate)}</p>
                      </div>
                      <Badge variant="outline" className={cn("text-xs capitalize font-medium", inv.status === "active" ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "")}>
                        {inv.status === "active" ? "Active" : inv.status}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Allocated Capital</p>
                        <p className="font-bold text-foreground text-sm">{formatUSDT(inv.amount)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Live Returns</p>
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
                        <p className="text-xs text-muted-foreground">Days Remaining</p>
                        <p className="font-semibold text-foreground text-sm flex items-center gap-1">
                          <Clock size={12} />
                          {inv.daysRemaining}d
                        </p>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                        <span>{inv.progressPercent.toFixed(1)}% complete</span>
                        <span>Day {elapsed} of {inv.daysTotal}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
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
              <div className="text-center py-12 bg-card border border-border rounded-2xl">
                <TrendingUp size={32} className="text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground">No active opportunities</p>
                <p className="text-xs text-muted-foreground mt-1">Participate in an opportunity to start earning daily returns</p>
                <Button variant="outline" className="mt-4 text-sm" onClick={() => setTab("opportunities")}>Browse Opportunities</Button>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
