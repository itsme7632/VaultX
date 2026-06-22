import {
  TrendingUp, Clock, ArrowDownLeft, Calendar, Target,
  Zap, RotateCcw, CheckCircle, ChevronDown, ChevronUp, ArrowDownRight, BarChart2, Sparkles,
} from "lucide-react";
import {
  useGetUserInvestments, getGetUserInvestmentsQueryKey,
  useClaimEarnings,
  useGetDashboardSummary, getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { LiveCounter, PayoutCountdown } from "@/components/LiveCounter";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatUSDT, formatDate } from "@/lib/format";

function EarningsHistory() {
  const [isOpen, setIsOpen] = useState(false);

  const { data: history, isLoading } = useQuery({
    queryKey: ["earnings-history"],
    queryFn: () =>
      fetch("/api/investments/earnings-history?limit=90", { credentials: "include" })
        .then((r) => r.json()),
    enabled: isOpen,
    staleTime: 60000,
  });

  const rows: { id: number; type: string; amount: number; note: string; createdAt: string }[] =
    history ?? [];

  const totalClaimed = rows.reduce((s, r) => s + r.amount, 0);

  const grouped: Record<string, typeof rows> = {};
  rows.forEach((r) => {
    const day = new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    if (!grouped[day]) grouped[day] = [];
    grouped[day].push(r);
  });

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
      <button
        type="button"
        onClick={() => setIsOpen((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-4 text-left"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <BarChart2 size={15} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Profit History</p>
            <p className="text-[11px] text-muted-foreground">Day-by-day claimed profit history</p>
          </div>
        </div>
        {isOpen ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
      </button>

      {isOpen && (
        <div className="border-t border-border">
          <div className="bg-emerald-50 dark:bg-emerald-950/20 px-4 py-3">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Total Profits Claimed</p>
            <p className="font-bold text-emerald-600 text-sm mt-0.5">{formatUSDT(totalClaimed)}</p>
          </div>

          {isLoading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
            </div>
          ) : rows.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <RotateCcw size={20} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No profit history yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border max-h-80 overflow-y-auto">
              {Object.entries(grouped).map(([day, dayRows]) => {
                const dayTotal = dayRows.reduce((s, r) => s + r.amount, 0);
                return (
                  <div key={day} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[11px] font-semibold text-foreground">{day}</p>
                      <p className="text-[11px] font-bold text-primary">+{formatUSDT(dayTotal)}</p>
                    </div>
                    <div className="space-y-1.5">
                      {dayRows.map((r) => (
                        <div key={r.id} className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                            <ArrowDownRight size={10} className="text-emerald-600" />
                          </div>
                          <p className="text-[11px] text-muted-foreground flex-1 min-w-0 truncate">
                            Profit Claimed
                            {r.note ? ` · ${r.note.replace(/Earnings claimed from investment |Earnings claimed from /i, "opp ")}` : ""}
                          </p>
                          <p className="text-[11px] font-semibold shrink-0 text-emerald-600">
                            +{formatUSDT(r.amount)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PortfolioPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: investments, isLoading } = useGetUserInvestments({
    query: { queryKey: getGetUserInvestmentsQueryKey(), staleTime: 15000, refetchInterval: 30000 },
  });

  const { data: summary } = useGetDashboardSummary({
    query: { queryKey: getGetDashboardSummaryQueryKey(), staleTime: 30000 },
  });

  const claim = useClaimEarnings();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetUserInvestmentsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    queryClient.invalidateQueries({ queryKey: ["earnings-history"] });
  };

  const handleClaim = (id: number, amount: number) => {
    if (amount <= 0) {
      toast({ title: "No profit yet", description: "Profits are credited once every 24 hours", variant: "destructive" });
      return;
    }
    claim.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Profit Claimed! 🎉", description: `${formatUSDT(amount)} added to your wallet. Your investment continues compounding.` });
        invalidate();
      },
      onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
    });
  };

  const activeInvestments = (investments ?? []).filter((i: any) => i.status === "active");
  const completedInvestments = (investments ?? []).filter((i: any) => i.status !== "active");
  const totalOriginal = activeInvestments.reduce((acc: number, i: any) => acc + i.amount, 0);
  const totalCurrentValue = activeInvestments.reduce((acc: number, i: any) => acc + (i.currentValue ?? i.amount + i.pendingEarnings), 0);
  const totalPending = activeInvestments.reduce((acc: number, i: any) => acc + i.pendingEarnings, 0);
  const totalEarned = (investments ?? []).reduce((acc: number, i: any) => acc + i.totalEarned, 0);

  return (
    <AppLayout title="Portfolio">
      <div className="px-4 pt-5 pb-28 space-y-5">

        {/* Summary grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Original Capital", val: formatUSDT(totalOriginal), sub: `${activeInvestments.length} opportunit${activeInvestments.length !== 1 ? "ies" : "y"}`, color: "text-primary" },
            { label: "Current Value", val: formatUSDT(totalCurrentValue), sub: "Incl. compounded profits", color: "text-blue-600" },
            { label: "Available Profit", val: formatUSDT(totalPending), sub: "Ready to claim", color: "text-emerald-600" },
            { label: "Total Earned", val: formatUSDT(totalEarned), sub: "All time profits", color: "text-purple-600" },
          ].map(({ label, val, sub, color }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-3.5 shadow-sm">
              <p className="text-[11px] text-muted-foreground font-medium">{label}</p>
              <p className={cn("font-bold text-base mt-0.5 leading-tight", color)}>{val}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>
            </div>
          ))}
        </div>

        {/* Active opportunities */}
        {isLoading ? (
          <div className="space-y-4">{[1, 2].map((i) => <Skeleton key={i} className="h-80 rounded-2xl" />)}</div>
        ) : activeInvestments.length > 0 ? (
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-foreground">Your Active Opportunities</h3>
            {activeInvestments.map((inv: any) => {
              const minRoi = inv.minRoiRate ?? 0.013;
              const maxRoi = inv.maxRoiRate ?? 0.017;
              const currentValue = inv.currentValue ?? (inv.amount + inv.pendingEarnings);
              const avgDailyEst = currentValue * ((minRoi + maxRoi) / 2);
              const hasPending = inv.pendingEarnings > 0;
              const profitGrowth = inv.amount > 0 ? ((currentValue - inv.amount) / inv.amount) * 100 : 0;

              return (
                <div key={inv.id} className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">

                  {/* Opportunity header strip */}
                  <div className="bg-gradient-to-r from-primary/90 to-blue-600 px-5 py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-white text-base leading-tight">{inv.planName}</h4>
                        <p className="text-blue-100 text-[11px] mt-0.5">
                          Daily ROI {(minRoi * 100).toFixed(1)}%–{(maxRoi * 100).toFixed(1)}% · {inv.daysTotal} days
                        </p>
                      </div>
                      <Badge className="bg-emerald-400/20 text-emerald-100 border-emerald-300/30 text-[11px] font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 mr-1.5 inline-block" />
                        Active
                      </Badge>
                    </div>
                  </div>

                  <div className="p-4 space-y-4">

                    {/* Investment value breakdown */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-muted/40 border border-border rounded-xl p-2.5">
                        <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-wide">Original</p>
                        <p className="font-bold text-foreground text-xs mt-1">{formatUSDT(inv.amount)}</p>
                      </div>
                      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-800 rounded-xl p-2.5">
                        <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-wide">Current Value</p>
                        <p className="font-bold text-blue-600 text-xs mt-1">{formatUSDT(currentValue)}</p>
                      </div>
                      <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-800 rounded-xl p-2.5">
                        <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-wide">Available</p>
                        <div className="mt-1">
                          <LiveCounter
                            pendingEarnings={inv.pendingEarnings}
                            dailyRate={inv.dailyReturnRate}
                            principal={currentValue}
                            lastEarningAt={inv.lastEarningAt ?? null}
                            startDate={inv.startDate}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Profit growth banner */}
                    {profitGrowth > 0 && (
                      <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl px-3.5 py-2">
                        <Sparkles size={13} className="text-emerald-500 shrink-0" />
                        <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                          +{profitGrowth.toFixed(2)}% growth · Your profits are compounding automatically
                        </p>
                      </div>
                    )}

                    {/* Stats grid */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="bg-muted/40 border border-border rounded-xl p-3">
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Total Earned</p>
                        <p className="font-semibold text-primary text-sm mt-1">{formatUSDT(inv.totalEarned)}</p>
                      </div>
                      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-800 rounded-xl p-3">
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Est. Daily Profit</p>
                        <p className="font-semibold text-amber-600 text-sm mt-1">{formatUSDT(avgDailyEst)}</p>
                      </div>
                    </div>

                    {/* Next payout countdown */}
                    <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-800 rounded-xl px-3.5 py-2.5">
                      <div className="flex items-center gap-2">
                        <Clock size={13} className="text-primary shrink-0" />
                        <p className="text-xs text-muted-foreground">Next Profit Credit</p>
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
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
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

                    {/* Single Claim Profit button */}
                    <Button
                      className={cn(
                        "w-full h-12 text-sm font-semibold gap-2 rounded-xl",
                        hasPending
                          ? "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white"
                          : "bg-muted text-muted-foreground opacity-60",
                      )}
                      onClick={() => handleClaim(inv.id, inv.pendingEarnings)}
                      disabled={claim.isPending || !hasPending}
                    >
                      <ArrowDownLeft size={16} />
                      {claim.isPending ? "Claiming…" : hasPending ? `Claim ${formatUSDT(inv.pendingEarnings)} Profit` : "Awaiting Next Profit Credit"}
                    </Button>

                    {/* Compounding notice */}
                    <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-800 rounded-xl px-3.5 py-2.5">
                      <div className="flex items-start gap-2">
                        <TrendingUp size={12} className="text-blue-500 mt-0.5 shrink-0" />
                        <p className="text-[11px] text-blue-700 dark:text-blue-400 leading-relaxed">
                          Your unclaimed profits compound daily — the longer you wait to claim, the larger your daily profit grows. Claiming resets your base to the original investment amount.
                        </p>
                      </div>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        ) : !isLoading ? (
          <div className="bg-card border border-border rounded-2xl p-10 text-center shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <TrendingUp size={28} className="text-primary" />
            </div>
            <p className="font-semibold text-foreground">No active opportunities</p>
            <p className="text-xs text-muted-foreground mt-1.5">Participate in an opportunity to see your portfolio here</p>
          </div>
        ) : null}

        {/* Profit History */}
        <EarningsHistory />

        {/* Completed */}
        {completedInvestments.length > 0 && (
          <div>
            <h3 className="font-semibold text-sm text-foreground mb-3">Completed</h3>
            <div className="bg-card border border-border rounded-2xl divide-y divide-border shadow-sm overflow-hidden">
              {completedInvestments.map((inv: any) => (
                <div key={inv.id} className="flex items-center gap-3 px-4 py-3.5">
                  <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
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

        {!isLoading && investments?.length === 0 && (
          <div className="text-center py-6">
            <RotateCcw size={20} className="text-muted-foreground mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">Your opportunity history will appear here</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
