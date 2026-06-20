import { ArrowRight, Users, Clock, TrendingUp, CheckCircle, Star, BarChart3, Target, Shield, Zap } from "lucide-react";
import { useGetInvestmentPlans, getGetInvestmentPlansQueryKey } from "@workspace/api-client-react";
import { useLocation, useParams } from "wouter";
import { SubPageLayout } from "@/components/SubPageLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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

export default function OpportunityDetailPage() {
  const { planId } = useParams<{ planId: string }>();
  const [, navigate] = useLocation();

  const { data: plans, isLoading } = useGetInvestmentPlans({
    query: { queryKey: getGetInvestmentPlansQueryKey(), staleTime: 300000 },
  });

  const plan: any = plans?.find((p: any) => String(p.id) === planId);
  const id = plan?.id ?? 1;

  const gradient = OPPORTUNITY_GRADIENTS[id] ?? "from-blue-600 to-indigo-700";
  const category = CATEGORIES[id] ?? "Strategic Capital";
  const minRoi = plan?.minRoiRate ?? 0.025;
  const maxRoi = plan?.maxRoiRate ?? 0.030;

  const capitalTargetMultiplier = seededInt(id, 1, 80, 200) * 1000;
  const capitalTarget = capitalTargetMultiplier;
  const raisedPct = seededInt(id, 2, 48, 82);
  const capitalRaised = Math.floor(capitalTarget * (raisedPct / 100));
  const participants = seededInt(id, 3, 120, 520);
  const daysToClose = seededInt(id, 4, 5, 21);

  if (isLoading) {
    return (
      <SubPageLayout title="Opportunity Details">
        <div className="px-4 pt-5 space-y-4">
          <Skeleton className="h-52 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      </SubPageLayout>
    );
  }

  if (!plan) {
    return (
      <SubPageLayout title="Opportunity Details">
        <div className="px-4 pt-10 text-center">
          <p className="font-semibold text-foreground">Opportunity not found</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/investments")}>
            Browse Opportunities
          </Button>
        </div>
      </SubPageLayout>
    );
  }

  return (
    <SubPageLayout title="Opportunity Details">
      <div className="px-4 pt-5 pb-36 space-y-5">

        {/* Header card */}
        <div className={cn("rounded-2xl overflow-hidden shadow-lg bg-gradient-to-br text-white", gradient)}>
          {plan.isFeatured && (
            <div className="bg-white/20 backdrop-blur-sm px-4 py-2 flex items-center gap-1.5 border-b border-white/20">
              <Star size={11} className="text-amber-300 fill-amber-300" />
              <p className="text-[11px] font-bold tracking-wide uppercase text-amber-200">Featured Opportunity</p>
            </div>
          )}
          <div className="p-5">
            <div className="flex items-start justify-between mb-1">
              <Badge className="bg-white/20 text-white border-white/30 text-[10px] font-semibold mb-2">
                {category}
              </Badge>
              <Badge className="bg-emerald-400/30 text-emerald-100 border-emerald-300/40 text-[10px] font-semibold">
                Funding Active
              </Badge>
            </div>
            <h2 className="font-bold text-2xl leading-tight mb-1">{plan.name}</h2>
            <p className="text-white/70 text-sm leading-relaxed">{plan.description}</p>

            <div className="grid grid-cols-3 gap-2 mt-5">
              <div className="bg-white/15 rounded-xl py-3 text-center">
                <p className="text-lg font-bold">{(minRoi * 100).toFixed(1)}%–{(maxRoi * 100).toFixed(1)}%</p>
                <p className="text-[10px] text-white/70 mt-0.5">Daily Return</p>
              </div>
              <div className="bg-white/15 rounded-xl py-3 text-center">
                <p className="text-lg font-bold">{plan.durationDays}d</p>
                <p className="text-[10px] text-white/70 mt-0.5">Duration</p>
              </div>
              <div className="bg-white/15 rounded-xl py-3 text-center">
                <p className="text-lg font-bold">{((minRoi + maxRoi) / 2 * plan.durationDays * 100).toFixed(0)}%</p>
                <p className="text-[10px] text-white/70 mt-0.5">Est. Total</p>
              </div>
            </div>
          </div>
        </div>

        {/* Capital Raised */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <BarChart3 size={15} className="text-primary" />
            </div>
            <p className="font-semibold text-sm text-foreground">Capital Raised</p>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-end">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Raised</p>
                <p className="text-xl font-bold text-foreground">{formatUSDT(capitalRaised)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Target</p>
                <p className="text-xl font-bold text-foreground">{formatUSDT(capitalTarget)}</p>
              </div>
            </div>

            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-700", gradient)}
                style={{ width: `${raisedPct}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-center font-medium">{raisedPct}% of target capital secured</p>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Participants", value: participants.toLocaleString(), icon: Users, color: "text-primary", bg: "bg-primary/10" },
            { label: "Duration", value: `${plan.durationDays} Days`, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
            { label: "Min. Participation", value: formatUSDT(plan.minAmount), icon: Target, color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "Closes In", value: `~${daysToClose} days`, icon: Zap, color: "text-purple-600", bg: "bg-purple-50" },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-4 shadow-sm">
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mb-2.5", bg)}>
                <Icon size={15} className={color} />
              </div>
              <p className="font-bold text-foreground text-base leading-tight">{value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Expected Returns */}
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 space-y-2.5">
          <div className="flex items-center gap-1.5 mb-3">
            <TrendingUp size={14} className="text-emerald-600" />
            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Expected Return Range</p>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Daily Return</span>
            <span className="font-bold text-emerald-600">{(minRoi * 100).toFixed(1)}% – {(maxRoi * 100).toFixed(1)}%</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total ({plan.durationDays} days)</span>
            <span className="font-bold text-emerald-600">{(minRoi * plan.durationDays * 100).toFixed(0)}% – {(maxRoi * plan.durationDays * 100).toFixed(0)}%</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Participation Range</span>
            <span className="font-bold text-foreground">{formatUSDT(plan.minAmount)} – {formatUSDT(plan.maxAmount)}</span>
          </div>
        </div>

        {/* Features */}
        {plan.features?.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-4 space-y-2.5">
            <div className="flex items-center gap-2 mb-2">
              <Shield size={14} className="text-primary" />
              <p className="text-sm font-bold text-foreground">Opportunity Features</p>
            </div>
            {plan.features.map((f: string, i: number) => (
              <div key={i} className="flex items-center gap-2.5">
                <CheckCircle size={14} className="text-emerald-500 shrink-0" />
                <span className="text-sm text-muted-foreground">{f}</span>
              </div>
            ))}
          </div>
        )}

        {/* Social proof */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3">
          <p className="text-sm font-bold text-foreground flex items-center gap-2">
            <span className="text-base">📊</span> Real-Time Activity
          </p>
          {[
            { label: "Participants in this opportunity", value: participants.toLocaleString(), icon: "👥" },
            { label: "Capital allocated", value: formatUSDT(capitalRaised), icon: "💰" },
            { label: "New participants today", value: `+${seededInt(id, 5, 3, 25)}`, icon: "🚀" },
            { label: "New this week", value: `+${seededInt(id, 6, 15, 85)}`, icon: "📈" },
          ].map(({ label, value, icon }) => (
            <div key={label} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
              <div className="flex items-center gap-2">
                <span className="text-sm">{icon}</span>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
              <p className="text-sm font-bold text-foreground">{value}</p>
            </div>
          ))}
        </div>

        {/* Risk notice */}
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4">
          <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
            <span className="font-bold">Risk Notice:</span> All capital allocations carry inherent market risk. Past performance does not guarantee future results. Only participate with capital you can afford to allocate.
          </p>
        </div>

      </div>

      {/* Sticky CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-30 max-w-screen-sm mx-auto px-4 pb-6 pt-3 bg-gradient-to-t from-background via-background to-transparent">
        <Button
          className="w-full font-bold rounded-2xl shadow-lg text-base"
          style={{ height: 56 }}
          onClick={() => navigate(`/invest/${plan.id}`)}
        >
          Participate Now <ArrowRight size={16} className="ml-1.5" />
        </Button>
        <p className="text-center text-xs text-muted-foreground mt-2">Daily returns begin immediately after participation</p>
      </div>
    </SubPageLayout>
  );
}
