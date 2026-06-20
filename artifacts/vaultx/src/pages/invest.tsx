import { useState } from "react";
import { CheckCircle, Info, Wallet, Clock, ArrowRight } from "lucide-react";
import {
  useGetInvestmentPlans, getGetInvestmentPlansQueryKey,
  useGetWallet, getGetWalletQueryKey,
  useCreateInvestment, getGetUserInvestmentsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { SubPageLayout } from "@/components/SubPageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatUSDT } from "@/lib/format";

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

export default function InvestPage() {
  const { planId } = useParams<{ planId: string }>();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [amount, setAmount] = useState("");

  const { data: plans, isLoading: plansLoading } = useGetInvestmentPlans({
    query: { queryKey: getGetInvestmentPlansQueryKey(), staleTime: 300000 },
  });
  const { data: wallet } = useGetWallet({ query: { queryKey: getGetWalletQueryKey(), staleTime: 30000 } });
  const createInvestment = useCreateInvestment();

  const plan: any = plans?.find((p: any) => String(p.id) === planId);
  const balance = wallet?.balance ?? 0;
  const amountNum = parseFloat(amount) || 0;

  const minRoi = (plan?.minRoiRate as number) ?? 0.025;
  const maxRoi = (plan?.maxRoiRate as number) ?? 0.030;
  const avgRoi = (minRoi + maxRoi) / 2;
  const dailyMin = plan ? amountNum * minRoi : 0;
  const dailyMax = plan ? amountNum * maxRoi : 0;
  const dailyAvg = plan ? amountNum * avgRoi : 0;
  const totalMin = plan ? dailyMin * plan.durationDays : 0;
  const totalMax = plan ? dailyMax * plan.durationDays : 0;

  const hasError = amountNum > balance && amountNum > 0;
  const belowMin = plan && amountNum > 0 && amountNum < plan.minAmount;
  const aboveMax = plan && amountNum > plan.maxAmount;
  const canInvest = plan && amountNum >= plan.minAmount && amountNum <= plan.maxAmount && !hasError && amountNum > 0;

  const handleInvest = () => {
    if (!plan) return;
    createInvestment.mutate(
      { data: { planId: plan.id, amount: amountNum } },
      {
        onSuccess: () => {
          toast({ title: "Participation Confirmed! 🎉", description: `${formatUSDT(amountNum)} allocated to ${plan.name}. Daily returns begin now.` });
          queryClient.invalidateQueries({ queryKey: getGetUserInvestmentsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
          navigate("/portfolio");
        },
        onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
      },
    );
  };

  const gradient = OPPORTUNITY_GRADIENTS[plan?.id as number] ?? "from-blue-600 to-indigo-700";

  if (plansLoading) {
    return (
      <SubPageLayout title="Participate">
        <div className="px-4 pt-5 space-y-4">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      </SubPageLayout>
    );
  }

  if (!plan) {
    return (
      <SubPageLayout title="Participate">
        <div className="px-4 pt-10 text-center">
          <p className="font-semibold text-foreground">Opportunity not found</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/investments")}>Go Back</Button>
        </div>
      </SubPageLayout>
    );
  }

  return (
    <SubPageLayout title={`Participate in ${plan.name}`}>
      <div className="px-4 pt-5 pb-36 space-y-5">

        {/* Opportunity header card */}
        <div className={cn("rounded-2xl overflow-hidden shadow-md")}>
          <div className={cn("bg-gradient-to-br p-5 text-white", gradient)}>
            <div className="mb-4">
              <h2 className="font-bold text-2xl">{plan.name}</h2>
              <p className="text-white/70 text-sm mt-1">{plan.description}</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white/15 rounded-xl py-3 text-center">
                <p className="text-lg font-bold">{(minRoi * 100).toFixed(1)}%–{(maxRoi * 100).toFixed(1)}%</p>
                <p className="text-[10px] text-white/70 mt-0.5">Daily Return</p>
              </div>
              <div className="bg-white/15 rounded-xl py-3 text-center">
                <p className="text-lg font-bold">{plan.durationDays}d</p>
                <p className="text-[10px] text-white/70 mt-0.5">Duration</p>
              </div>
              <div className="bg-white/15 rounded-xl py-3 text-center">
                <p className="text-lg font-bold">{(avgRoi * plan.durationDays * 100).toFixed(0)}%</p>
                <p className="text-[10px] text-white/70 mt-0.5">Est. Total</p>
              </div>
            </div>
          </div>
        </div>

        {/* Balance & range info */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card border border-border rounded-2xl p-3.5 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Wallet size={14} className="text-primary" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Your Balance</p>
              <p className="font-bold text-primary text-sm">{formatUSDT(balance)}</p>
            </div>
          </div>
          <div className="bg-card border border-border rounded-2xl p-3.5 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
              <Clock size={14} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Range (USDT)</p>
              <p className="font-bold text-foreground text-sm">{formatUSDT(plan.minAmount)}–{formatUSDT(plan.maxAmount)}</p>
            </div>
          </div>
        </div>

        {/* Amount input */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-bold text-foreground">Capital Amount (USDT)</p>
            <button
              onClick={() => setAmount(String(Math.min(parseFloat(String(balance)), plan.maxAmount).toFixed(2)))}
              className="text-xs text-primary font-bold bg-primary/10 px-2.5 py-1 rounded-lg"
            >
              MAX
            </button>
          </div>
          <Input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={`${plan.minAmount} – ${plan.maxAmount}`}
            className={cn("h-14 text-xl font-bold text-center rounded-2xl tracking-wide", (hasError || belowMin || aboveMax) && "border-destructive ring-destructive")}
          />
          {hasError && <p className="text-xs text-destructive mt-1.5 text-center">Insufficient balance</p>}
          {belowMin && <p className="text-xs text-destructive mt-1.5 text-center">Minimum is {formatUSDT(plan.minAmount)}</p>}
          {aboveMax && <p className="text-xs text-destructive mt-1.5 text-center">Maximum is {formatUSDT(plan.maxAmount)}</p>}
        </div>

        {/* Live projections */}
        {amountNum >= plan.minAmount && !hasError && !aboveMax && (
          <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 space-y-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <Info size={13} className="text-emerald-600" />
              <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Projected Returns</p>
            </div>
            {[
              { label: "Daily Distribution", val: `${formatUSDT(dailyMin)} – ${formatUSDT(dailyMax)}`, color: "text-emerald-600" },
              { label: `Total Return (${plan.durationDays} days)`, val: `${formatUSDT(totalMin)} – ${formatUSDT(totalMax)}`, color: "text-emerald-600 font-bold" },
              { label: "Est. Final Value", val: `~${formatUSDT(amountNum + dailyAvg * plan.durationDays)}`, color: "text-primary font-bold" },
            ].map(({ label, val, color }) => (
              <div key={label} className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className={cn("font-semibold", color)}>{val}</span>
              </div>
            ))}
          </div>
        )}

        {/* Features */}
        {plan.features?.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-xs font-bold text-foreground mb-3">Opportunity Features</p>
            <div className="space-y-2">
              {plan.features.map((f: string, i: number) => (
                <div key={i} className="flex items-center gap-2.5">
                  <CheckCircle size={14} className="text-emerald-500 shrink-0" />
                  <span className="text-sm text-muted-foreground">{f}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Sticky bottom button */}
      <div className="fixed bottom-0 left-0 right-0 z-30 max-w-screen-sm mx-auto px-4 pb-6 pt-3 bg-gradient-to-t from-background via-background to-transparent">
        <Button
          className="w-full font-bold rounded-2xl shadow-lg text-base"
          style={{ height: 56 }}
          onClick={handleInvest}
          disabled={createInvestment.isPending || !canInvest}
        >
          {createInvestment.isPending ? (
            <span className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Processing…
            </span>
          ) : canInvest ? (
            <span className="flex items-center gap-2">
              Participate Now — {formatUSDT(amountNum)} <ArrowRight size={16} />
            </span>
          ) : "Enter Amount to Participate"}
        </Button>
        {canInvest && <p className="text-center text-xs text-muted-foreground mt-2">Daily returns begin immediately after participation</p>}
      </div>
    </SubPageLayout>
  );
}
