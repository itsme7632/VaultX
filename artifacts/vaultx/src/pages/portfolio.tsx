import {
  TrendingUp, Clock, RefreshCcw, ArrowDownLeft, Calendar, Target,
  Zap, RotateCcw, CheckCircle,
} from "lucide-react";
import {
  useGetUserInvestments, getGetUserInvestmentsQueryKey,
  useClaimEarnings, useToggleAutoCompound,
  useGetDashboardSummary, getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { LiveCounter, PayoutCountdown } from "@/components/LiveCounter";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatUSDT, formatDate } from "@/lib/format";

// ─── Main page ────────────────────────────────────────────────────────────
export default function PortfolioPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [reinvesting, setReinvesting] = useState<number | null>(null);

  const { data: investments, isLoading } = useGetUserInvestments({
    query: { queryKey: getGetUserInvestmentsQueryKey(), staleTime: 15000, refetchInterval: 30000 },
  });

  const { data: summary } = useGetDashboardSummary({
    query: { queryKey: getGetDashboardSummaryQueryKey(), staleTime: 30000 },
  });

  const claim = useClaimEarnings();
  const toggleCompound = useToggleAutoCompound();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetUserInvestmentsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
  };

  const handleClaim = (id: number, amount: number) => {
    if (amount <= 0) {
      toast({ title: "No earnings yet", description: "Daily ROI is credited once every 24 hours", variant: "destructive" });
      return;
    }
    claim.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Profit Claimed!", description: `${formatUSDT(amount)} added to your wallet` });
        invalidate();
      },
      onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
    });
  };

  const handleReinvest = async (id: number, amount: number) => {
    if (amount <= 0) {
      toast({ title: "No earnings yet", description: "Daily ROI is credited once every 24 hours", variant: "destructive" });
      return;
    }
    setReinvesting(id);
    try {
      const res = await fetch(`/api/investments/${id}/reinvest`, { method: "POST", credentials: "include" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? "Failed to reinvest");
      }
      toast({ title: "Profit Reinvested!", description: "Earnings added to your investment principal" });
      invalidate();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setReinvesting(null);
    }
  };

  const handleToggleAutoReinvest = (id: number, current: boolean) => {
    toggleCompound.mutate({ id }, {
      onSuccess: () => {
        toast({
          title: current ? "Auto-Reinvest Disabled" : "Auto-Reinvest Enabled",
          description: current
            ? "Daily profits will accumulate for manual claiming"
            : "Daily profits will automatically reinvest into principal",
        });
        invalidate();
      },
    });
  };

  const activeInvestments = (investments ?? []).filter((i: any) => i.status === "active");
  const completedInvestments = (investments ?? []).filter((i: any) => i.status !== "active");
  const totalValue = activeInvestments.reduce((acc: number, i: any) => acc + i.amount, 0);
  const totalPending = activeInvestments.reduce((acc: number, i: any) => acc + i.pendingEarnings, 0);
  const totalEarned = (investments ?? []).reduce((acc: number, i: any) => acc + i.totalEarned, 0);

  return (
    <AppLayout title="Portfolio">
      <div className="px-4 pt-5 pb-28 space-y-5">

        {/* Summary grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Active Capital", val: formatUSDT(totalValue), sub: `${activeInvestments.length} plan${activeInvestments.length !== 1 ? "s" : ""}`, color: "text-primary", bg: "bg-primary/8" },
            { label: "Claimable Profit", val: formatUSDT(totalPending), sub: "Ready to claim", color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "Total Earned", val: formatUSDT(totalEarned), sub: "All time", color: "text-purple-600", bg: "bg-purple-50" },
            { label: "Est. Daily ROI", val: formatUSDT(summary?.dailyEarnings ?? 0), sub: "Per day", color: "text-amber-600", bg: "bg-amber-50" },
          ].map(({ label, val, sub, color }) => (
            <div key={label} className="bg-white border border-border rounded-xl p-3.5 shadow-sm">
              <p className="text-[11px] text-muted-foreground font-medium">{label}</p>
              <p className={cn("font-bold text-base mt-0.5 leading-tight", color)}>{val}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>
            </div>
          ))}
        </div>

        {/* Active investments */}
        {isLoading ? (
          <div className="space-y-4">{[1, 2].map((i) => <Skeleton key={i} className="h-72 rounded-2xl" />)}</div>
        ) : activeInvestments.length > 0 ? (
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-foreground">Active Plans</h3>
            {activeInvestments.map((inv: any) => {
              const minRoi = inv.minRoiRate ?? 0.025;
              const maxRoi = inv.maxRoiRate ?? 0.030;
              const avgDailyEst = inv.amount * ((minRoi + maxRoi) / 2);
              const hasPending = inv.pendingEarnings > 0;

              return (
                <div key={inv.id} className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm">

                  {/* Plan header strip */}
                  <div className="bg-gradient-to-r from-primary/90 to-blue-600 px-5 py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-white text-base leading-tight">{inv.planName}</h4>
                        <p className="text-blue-100 text-[11px] mt-0.5">
                          Daily ROI {(minRoi * 100).toFixed(1)}%–{(maxRoi * 100).toFixed(1)}% • {inv.daysTotal} days
                        </p>
                      </div>
                      <Badge className="bg-emerald-400/20 text-emerald-100 border-emerald-300/30 text-[11px] font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 mr-1.5 inline-block" />
                        Active
                      </Badge>
                    </div>
                  </div>

                  <div className="p-4 space-y-4">
                    {/* Stats grid */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Principal</p>
                        <p className="font-bold text-foreground text-sm mt-1">{formatUSDT(inv.amount)}</p>
                      </div>
                      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Live Profit</p>
                        <div className="mt-1">
                          <LiveCounter
                            pendingEarnings={inv.pendingEarnings}
                            dailyRate={inv.dailyReturnRate}
                            principal={inv.amount}
                            lastEarningAt={inv.lastEarningAt ?? null}
                            startDate={inv.startDate}
                          />
                        </div>
                      </div>
                      <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Total Earned</p>
                        <p className="font-semibold text-primary text-sm mt-1">{formatUSDT(inv.totalEarned)}</p>
                      </div>
                      <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Est. Daily</p>
                        <p className="font-semibold text-amber-600 text-sm mt-1">{formatUSDT(avgDailyEst)}</p>
                      </div>
                    </div>

                    {/* Next payout countdown */}
                    <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl px-3.5 py-2.5">
                      <div className="flex items-center gap-2">
                        <Clock size={13} className="text-primary shrink-0" />
                        <p className="text-xs text-muted-foreground">Next payout</p>
                      </div>
                      <PayoutCountdown nextPayoutAt={inv.nextPayoutAt} />
                    </div>

                    {/* Dates row */}
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={11} className="text-primary" />
                        <span>Started {formatDate(inv.startDate)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Target size={11} className="text-amber-500" />
                        <span>Matures {formatDate(inv.endDate)}</span>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[11px] text-muted-foreground font-medium">
                          {inv.progressPercent.toFixed(1)}% complete
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          Day {Math.max(0, inv.daysTotal - inv.daysRemaining)} of {inv.daysTotal}
                        </span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary to-blue-400 rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(2, inv.progressPercent)}%` }}
                        />
                      </div>
                    </div>

                    {/* Projected return */}
                    <div className="bg-primary/5 border border-primary/10 rounded-xl p-3 flex justify-between items-center">
                      <div>
                        <p className="text-[10px] text-muted-foreground font-medium">Projected Total Return</p>
                        <p className="text-sm font-bold text-primary mt-0.5">
                          {formatUSDT(inv.projectedTotalMin)} – {formatUSDT(inv.projectedTotalMax)}
                        </p>
                      </div>
                      <Zap size={16} className="text-primary/40" />
                    </div>

                    {/* Auto-reinvest toggle — uses standard headless toggle pattern */}
                    <div className="flex items-center justify-between py-3 px-3.5 bg-slate-50 border border-slate-100 rounded-xl">
                      <div className="flex-1 min-w-0 mr-3">
                        <p className="text-xs font-semibold text-foreground">Auto-Reinvest</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {inv.autoCompound ? "Profits reinvest daily automatically" : "Profits accumulate for manual claiming"}
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={inv.autoCompound}
                        onClick={() => handleToggleAutoReinvest(inv.id, inv.autoCompound)}
                        className={cn(
                          "relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none",
                          inv.autoCompound ? "bg-emerald-500" : "bg-slate-200",
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                            inv.autoCompound ? "translate-x-5" : "translate-x-0",
                          )}
                        />
                      </button>
                    </div>

                    {/* Claim / Reinvest buttons */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className={cn(
                          "h-11 text-xs font-semibold gap-1.5 rounded-xl",
                          hasPending
                            ? "border-emerald-300 text-emerald-600 hover:bg-emerald-50 active:bg-emerald-100"
                            : "border-slate-200 text-muted-foreground opacity-60",
                        )}
                        onClick={() => handleClaim(inv.id, inv.pendingEarnings)}
                        disabled={claim.isPending}
                      >
                        <ArrowDownLeft size={14} />
                        Claim Profit
                      </Button>
                      <Button
                        size="sm"
                        className={cn(
                          "h-11 text-xs font-semibold gap-1.5 rounded-xl",
                          hasPending
                            ? "bg-primary hover:bg-primary/90 active:bg-primary/80"
                            : "bg-slate-200 text-muted-foreground opacity-60",
                        )}
                        onClick={() => handleReinvest(inv.id, inv.pendingEarnings)}
                        disabled={reinvesting === inv.id}
                      >
                        <RefreshCcw size={14} className={reinvesting === inv.id ? "animate-spin" : ""} />
                        {reinvesting === inv.id ? "Reinvesting…" : "Reinvest"}
                      </Button>
                    </div>

                    {!hasPending && (
                      <p className="text-center text-[11px] text-muted-foreground -mt-1">
                        Daily profit credited every 24 hours — keep growing!
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : !isLoading ? (
          <div className="bg-white border border-border rounded-2xl p-10 text-center shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <TrendingUp size={28} className="text-primary" />
            </div>
            <p className="font-semibold text-foreground">No active investments</p>
            <p className="text-xs text-muted-foreground mt-1.5">Start an investment plan to see your portfolio here</p>
          </div>
        ) : null}

        {/* Completed investments */}
        {completedInvestments.length > 0 && (
          <div>
            <h3 className="font-semibold text-sm text-foreground mb-3">Completed</h3>
            <div className="bg-white border border-border rounded-2xl divide-y divide-border shadow-sm overflow-hidden">
              {completedInvestments.map((inv: any) => (
                <div key={inv.id} className="flex items-center gap-3 px-4 py-3.5">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                    <CheckCircle size={16} className="text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{inv.planName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatUSDT(inv.amount)} invested · {formatUSDT(inv.totalEarned)} earned
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {formatDate(inv.startDate)} – {formatDate(inv.endDate)}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs capitalize shrink-0 font-medium">
                    {inv.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty history state */}
        {!isLoading && investments?.length === 0 && (
          <div className="text-center py-6">
            <RotateCcw size={20} className="text-muted-foreground mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">Your investment history will appear here</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
