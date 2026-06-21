import { TrendingUp, CheckCircle, ArrowRight, Clock, Star, Users, Target, Info, ChevronDown, ChevronUp, Zap, BarChart3, Calendar, Flame, Minus, TrendingDown } from "lucide-react";
import {
  useGetInvestmentPlans, getGetInvestmentPlansQueryKey,
  useGetUserInvestments, getGetUserInvestmentsQueryKey,
} from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { LiveCounter } from "@/components/LiveCounter";
import { cn } from "@/lib/utils";
import { formatUSDT, formatDate } from "@/lib/format";
import { useState, useEffect, useRef, useMemo } from "react";
import { usePlatformMetrics, type PlanMetricsItem } from "@/hooks/usePlatformMetrics";

/* ─── Shared constants ──────────────────────────────────────────────────── */

const THEME_GRADIENT: Record<string, string> = {
  blue:   "from-blue-600 to-indigo-700",
  purple: "from-purple-600 to-violet-800",
  green:  "from-emerald-500 to-teal-700",
  gold:   "from-amber-500 to-orange-600",
  cyan:   "from-cyan-500 to-blue-700",
  rose:   "from-rose-500 to-pink-700",
};

function planGradient(colorTheme?: string) {
  return THEME_GRADIENT[colorTheme ?? "blue"] ?? "from-blue-600 to-indigo-700";
}

function planStatusBadge(status?: string) {
  switch (status) {
    case "funding":         return { label: "Funding",         cls: "bg-blue-400/30 text-blue-100 border-blue-300/40" };
    case "featured":        return { label: "⭐ Featured",     cls: "bg-amber-400/30 text-amber-100 border-amber-300/40" };
    case "trending":        return { label: "🔥 Trending",     cls: "bg-orange-400/30 text-orange-100 border-orange-300/40" };
    case "paused":          return { label: "Paused",           cls: "bg-gray-400/30 text-gray-200 border-gray-300/40" };
    case "fully_allocated": return { label: "Fully Allocated", cls: "bg-purple-400/30 text-purple-100 border-purple-300/40" };
    case "expired":         return { label: "Expired",         cls: "bg-red-400/30 text-red-100 border-red-300/40" };
    case "closed":          return { label: "Closed",          cls: "bg-slate-400/30 text-slate-200 border-slate-300/40" };
    default:                return { label: "Active",           cls: "bg-emerald-400/30 text-emerald-100 border-emerald-300/40" };
  }
}

type BadgeKey = "trending" | "popular" | "fast-growing" | "top-funded" | "none";

const BADGE_DISPLAY: Record<BadgeKey, { label: string; cls: string }> = {
  trending:       { label: "🔥 Trending",     cls: "bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-300/50" },
  popular:        { label: "⭐ Popular",       cls: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-300/50" },
  "fast-growing": { label: "🚀 Fast Growing", cls: "bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-300/50" },
  "top-funded":   { label: "🏆 Top Funded",   cls: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-300/50" },
  none:           { label: "",                 cls: "" },
};

/* ─── Momentum Indicator ────────────────────────────────────────────────── */

type MomentumLevel = "trending" | "high" | "growing" | "stable";

const MOMENTUM_CONFIG: Record<MomentumLevel, { label: string; icon: typeof Flame; bg: string; text: string; arrow: string }> = {
  trending: { label: "🚀 Trending",         icon: Flame,      bg: "bg-purple-100 dark:bg-purple-950/40",  text: "text-purple-600 dark:text-purple-400",  arrow: "🚀 Trending" },
  high:     { label: "🔥 High Momentum",    icon: Flame,      bg: "bg-orange-100 dark:bg-orange-950/40",  text: "text-orange-600 dark:text-orange-400",  arrow: "🔥 Accelerating" },
  growing:  { label: "📈 Growing Interest", icon: TrendingUp, bg: "bg-emerald-100 dark:bg-emerald-950/40", text: "text-emerald-600 dark:text-emerald-400", arrow: "📈 Growing" },
  stable:   { label: "⭐ Stable Demand",    icon: Minus,      bg: "bg-blue-100 dark:bg-blue-950/40",      text: "text-blue-600 dark:text-blue-400",      arrow: "⭐ Steady" },
};

function computeMomentum(raisedPct: number): MomentumLevel {
  if (raisedPct >= 76) return "trending";
  if (raisedPct >= 51) return "high";
  if (raisedPct >= 26) return "growing";
  return "stable";
}

function MomentumBadge({ level, compact = false }: { level: MomentumLevel; compact?: boolean }) {
  const cfg = MOMENTUM_CONFIG[level];
  if (compact) {
    return (
      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold", cfg.bg, cfg.text)}>
        {cfg.label}
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold", cfg.bg, cfg.text)}>
      {cfg.arrow}
    </span>
  );
}

/* ─── Seeded stat helpers ───────────────────────────────────────────────── */

function seededInt(planId: number, salt: number, min: number, max: number) {
  const seed = (planId * 31 + salt * 17) % 97;
  return min + Math.floor((seed / 97) * (max - min));
}

/**
 * Auto-generate realistic participant count from capital raised.
 * Uses a deterministic fraction per plan so values are stable across renders.
 * Returns 0 when raised ≤ 0 — no participants can exist with zero capital.
 * Scales:  $2K → 1-5,  $100K → 15-60,  $500K → 50-250,  $2M → 150-1000
 */
function autoParticipantsFromRaised(raised: number, planId: number): number {
  if (raised <= 0) return 0;
  const frac = ((planId * 31 + 7) % 97) / 97; // stable 0-1 per plan

  const points = [
    { r: 0,         min: 1,   max: 2 },
    { r: 2000,      min: 1,   max: 5 },
    { r: 100000,    min: 15,  max: 60 },
    { r: 500000,    min: 50,  max: 250 },
    { r: 2000000,   min: 150, max: 1000 },
  ];

  for (let i = 1; i < points.length; i++) {
    if (raised <= points[i].r || i === points.length - 1) {
      const prev = points[i - 1], curr = points[i];
      const t = prev.r === curr.r ? 1 : Math.min(1, Math.max(0, (raised - prev.r) / (curr.r - prev.r)));
      const minV = prev.min + t * (curr.min - prev.min);
      const maxV = prev.max + t * (curr.max - prev.max);
      return Math.max(1, Math.floor(minV + frac * (maxV - minV)));
    }
  }
  return Math.floor(150 + frac * 850);
}

function autoStats(id: number) {
  const raisedPct      = seededInt(id, 2, 30, 90);
  const capitalTargetK = seededInt(id, 1, 80, 300);
  const participants   = seededInt(id, 3, 80, 600);
  // Activity scales with funding level — higher funded = more participant activity
  const activityBase   = Math.max(2, Math.floor(raisedPct / 5));
  const joinedToday    = activityBase + seededInt(id, 5, 1, 8);
  const joinedWeek     = joinedToday * 4 + seededInt(id, 6, 5, 25);
  return { participants, raisedPct, joinedToday, joinedWeek, capitalTargetK };
}

/* ─── Badge auto-assignment (uses canonical platform metrics) ────────────── */

function computeAutoBadges(plans: any[], metricsMap: Record<number, PlanMetricsItem> = {}): Record<number, BadgeKey> {
  if (!plans.length) return {};

  // Use canonical stats from the platform-metrics endpoint (single source of truth)
  const planData = plans.map(p => {
    const m = metricsMap[p.id];
    if (m) {
      return {
        id: p.id,
        raisedPct: m.fundingPct,
        participants: m.participants,
        capitalRaised: m.capitalRaised,
        joinedToday: m.joinedToday,
        joinedWeek: m.joinedWeek,
      };
    }
    // Fallback while metrics load: use real DB fields only
    const fundingGoal   = p.fundingGoal != null ? Number(p.fundingGoal) : null;
    const capitalRaised = p.currentFunding != null ? Number(p.currentFunding) : 0;
    const raisedPct     = fundingGoal && fundingGoal > 0 ? (capitalRaised / fundingGoal) * 100 : 0;
    const participants  = p.displayParticipantCount != null ? Number(p.displayParticipantCount)
      : p.totalParticipants != null ? Number(p.totalParticipants) : 0;
    const activityBase  = Math.max(1, Math.floor(raisedPct / 8));
    const planSeed      = ((p.id * 31 + 7) % 97) / 97;
    const joinedToday   = capitalRaised > 0 ? Math.max(1, Math.round(activityBase * (0.7 + planSeed * 0.6))) : 0;
    const joinedWeek    = capitalRaised > 0 ? joinedToday * 4 + Math.floor(planSeed * 15) : 0;
    return { id: p.id, raisedPct, participants, capitalRaised, joinedToday, joinedWeek };
  });

  const badges: Record<number, BadgeKey> = {};
  const assigned = new Set<number>();

  const assignTop = (sorted: typeof planData, badge: BadgeKey) => {
    const winner = sorted.find(s => !assigned.has(s.id));
    if (winner) { badges[winner.id] = badge; assigned.add(winner.id); }
  };

  // 🏆 Top Funded = highest funding percentage
  assignTop([...planData].sort((a, b) => b.raisedPct - a.raisedPct), "top-funded");
  // 🔥 Trending = most activity today
  assignTop([...planData].sort((a, b) => b.joinedToday - a.joinedToday), "trending");
  // 🚀 Fast Growing = highest growth rate (joinedWeek / participants)
  assignTop([...planData].sort((a, b) => (b.joinedWeek / Math.max(1, b.participants)) - (a.joinedWeek / Math.max(1, a.participants))), "fast-growing");
  // ⭐ Popular = most total participants
  assignTop([...planData].sort((a, b) => b.participants - a.participants), "popular");

  return badges;
}

/* ─── Animated progress bar ─────────────────────────────────────────────── */

function AnimatedBar({ pct, gradient, className }: { pct: number; gradient: string; className?: string }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => { setWidth(pct); }, 80);
    return () => clearTimeout(t);
  }, [pct]);
  return (
    <div className={cn("rounded-full overflow-hidden bg-muted", className ?? "h-2.5")}>
      <div
        className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-1000 ease-out", gradient)}
        style={{ width: `${width}%`, willChange: "width" }}
      />
    </div>
  );
}

/* ─── Opportunity Insights summary (top of page) ───────────────────────── */

function OpportunityInsightsSummary() {
  const { data: metrics, isLoading } = usePlatformMetrics();

  const overallPct = Math.round(metrics?.fundingPercentage ?? 0);
  const totalRaised = metrics?.totalRaised ?? 0;
  const totalTarget = metrics?.totalTarget ?? 0;
  const fmtRaised = totalRaised >= 1_000_000 ? `$${(totalRaised / 1_000_000).toFixed(1)}M` : totalRaised >= 1_000 ? `$${(totalRaised / 1_000).toFixed(0)}K` : `$${totalRaised}`;
  const fmtTarget = totalTarget >= 1_000_000 ? `$${(totalTarget / 1_000_000).toFixed(1)}M` : totalTarget >= 1_000 ? `$${(totalTarget / 1_000).toFixed(0)}K` : `$${totalTarget}`;

  return (
    <div className="bg-gradient-to-br from-slate-800 via-slate-700 to-primary/60 rounded-2xl p-4 text-white shadow-lg mb-4">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 size={14} className="text-blue-200" />
        <p className="text-[11px] font-bold text-blue-100 uppercase tracking-widest">Opportunity Insights</p>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-white/10 rounded-xl py-2.5 text-center">
          <p className="font-bold text-base">{isLoading ? "—" : String(metrics?.activeOpportunities ?? 0)}</p>
          <p className="text-[9px] text-white/60 mt-0.5">Active</p>
        </div>
        <div className="bg-white/10 rounded-xl py-2.5 text-center">
          <p className="font-bold text-base">{isLoading ? "—" : (metrics?.totalParticipants ?? 0).toLocaleString()}</p>
          <p className="text-[9px] text-white/60 mt-0.5">Participants</p>
        </div>
        <div className="bg-white/10 rounded-xl py-2.5 text-center">
          <p className="font-bold text-base">{isLoading ? "—" : `${overallPct}%`}</p>
          <p className="text-[9px] text-white/60 mt-0.5">Avg Funded</p>
        </div>
      </div>
      <div className="flex items-center justify-between text-[10px] text-white/60 mb-1">
        <span>Platform Capital Raised</span>
        <span className="text-white font-semibold">
          {isLoading ? "—" : `${fmtRaised} / ${fmtTarget}`}
        </span>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-blue-400 to-emerald-400 rounded-full transition-all duration-1000" style={{ width: `${overallPct}%` }} />
      </div>
    </div>
  );
}

/* ─── Main page ─────────────────────────────────────────────────────────── */

export default function InvestmentsPage() {
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<"opportunities" | "active">("opportunities");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: plans, isLoading: plansLoading } = useGetInvestmentPlans({
    query: { queryKey: getGetInvestmentPlansQueryKey(), staleTime: 30000, refetchInterval: 60000 },
  });

  const { data: userInvestments, isLoading: uiLoading } = useGetUserInvestments({
    query: { queryKey: getGetUserInvestmentsQueryKey(), staleTime: 15000, refetchInterval: 30000 },
  });

  const { data: settings } = useQuery({
    queryKey: ["public-settings"],
    queryFn: () => fetch("/api/settings/public", { credentials: "include" }).then(r => r.json()),
    staleTime: 60000,
  });

  // Canonical per-plan stats — single source of truth shared with Opportunity Insights
  const { data: metrics } = usePlatformMetrics();
  const metricsPlansMap = useMemo<Record<number, PlanMetricsItem>>(() => {
    const m: Record<number, PlanMetricsItem> = {};
    for (const p of (metrics?.plans ?? [])) m[p.id] = p;
    return m;
  }, [metrics]);

  const analyticsMode: string = settings?.opportunity_analytics_mode ?? "auto";
  const badgeOverrides: Record<string, BadgeKey> = (() => {
    try { return JSON.parse(settings?.opportunity_badges ?? "{}"); } catch { return {}; }
  })();
  const customStatsMap: Record<string, any> = (() => {
    try { return JSON.parse(settings?.opportunity_custom_stats ?? "{}"); } catch { return {}; }
  })();
  const momentumEnabled: boolean = settings?.momentum_enabled !== "false";
  const momentumMode: string = settings?.momentum_mode ?? "real";
  const momentumOverrides: Record<string, MomentumLevel> = (() => {
    try { return JSON.parse(settings?.momentum_overrides ?? "{}"); } catch { return {}; }
  })();

  const activeCount = userInvestments?.filter((i: any) => i.status === "active").length ?? 0;
  const activePlans = (plans ?? []).filter((p: any) => p.isActive);

  // Compute auto badges using canonical metrics (single source of truth)
  const autoBadges = computeAutoBadges(activePlans, metricsPlansMap);
  const badges: Record<number, BadgeKey> = { ...autoBadges };
  Object.entries(badgeOverrides).forEach(([planId, badge]) => {
    if (badge) badges[Number(planId)] = badge;
  });

  const getPlanStats = (plan: any) => {
    // Always use canonical backend stats — single source of truth
    const canonical = metricsPlansMap[plan.id];
    if (canonical) {
      return {
        participants:     canonical.participants,
        raisedPct:        Math.round(canonical.fundingPct),
        raisedPctRaw:     canonical.fundingPct,
        fundingDisplay:   canonical.fundingDisplay,
        barPct:           canonical.barPct,
        capitalTarget:    canonical.fundingGoal,
        capitalRaised:    canonical.capitalRaised,
        capitalRemaining: canonical.capitalRemaining,
        joinedToday:      canonical.joinedToday,
        joinedWeek:       canonical.joinedWeek,
      };
    }

    // Fallback while metrics endpoint first loads
    const capitalTarget   = plan.fundingGoal != null ? Number(plan.fundingGoal) : 0;
    const capitalRaised   = plan.currentFunding != null ? Number(plan.currentFunding) : 0;
    const displayOverride = plan.displayParticipantCount != null ? Number(plan.displayParticipantCount) : null;

    let participants: number;
    if (displayOverride !== null)  participants = displayOverride;
    else if (capitalRaised <= 0)   participants = 0;
    else                           participants = autoParticipantsFromRaised(capitalRaised, plan.id);

    const raisedPctRaw   = capitalTarget > 0 ? Math.min(100, (capitalRaised / capitalTarget) * 100) : 0;
    const raisedPct      = Math.round(raisedPctRaw);
    const fundingDisplay = capitalRaised > 0 && raisedPct === 0 ? "< 1%" : `${raisedPct}%`;
    const barPct         = capitalRaised > 0 ? Math.max(0.5, raisedPctRaw) : 0;
    const capitalRemaining = Math.max(0, capitalTarget - capitalRaised);
    const planSeed       = ((plan.id * 31 + 7) % 97) / 97;
    const activityBase   = capitalRaised > 0 ? Math.max(1, Math.floor(raisedPctRaw / 8)) : 0;
    const joinedToday    = capitalRaised > 0 ? Math.max(1, Math.round(activityBase * (0.7 + planSeed * 0.6))) : 0;
    const joinedWeek     = capitalRaised > 0 ? joinedToday * 4 + Math.floor(planSeed * 15) : 0;

    return { participants, raisedPct, raisedPctRaw, fundingDisplay, barPct, capitalTarget, capitalRaised, capitalRemaining, joinedToday, joinedWeek };
  };

  const getPlanMomentum = (plan: any, s: ReturnType<typeof getPlanStats>): MomentumLevel | null => {
    if (!momentumEnabled) return null;
    const override = momentumOverrides[String(plan.id)];
    if (momentumMode === "custom" && override) return override;
    return computeMomentum(s.raisedPct);
  };

  return (
    <AppLayout title="Opportunities">
      <div className="px-4 pt-5 pb-24">
        {/* Tab switcher */}
        <div className="flex bg-muted rounded-xl p-1 mb-5">
          <button
            onClick={() => setTab("opportunities")}
            className={cn("flex-1 py-2 rounded-lg text-sm font-semibold transition-all", tab === "opportunities" ? "bg-white dark:bg-slate-800 shadow-sm text-foreground" : "text-muted-foreground")}
          >
            Available
          </button>
          <button
            onClick={() => setTab("active")}
            className={cn("flex-1 py-2 rounded-lg text-sm font-semibold transition-all", tab === "active" ? "bg-white dark:bg-slate-800 shadow-sm text-foreground" : "text-muted-foreground")}
          >
            My Active{activeCount > 0 && <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-white text-[10px] font-bold">{activeCount}</span>}
          </button>
        </div>

        {tab === "opportunities" && (
          <div>
            {/* Platform-wide insights summary */}
            {!plansLoading && (plans ?? []).length > 0 && (
              <OpportunityInsightsSummary />
            )}

            <div className="space-y-4">
              {plansLoading ? (
                [1, 2, 3].map((i) => <Skeleton key={i} className="h-64 rounded-2xl" />)
              ) : [...(plans ?? [])].sort((a: any, b: any) => {
                // 1. Featured plans first
                const statusScore = (p: any) => {
                  if (p.status === "featured" || p.isFeatured) return 4;
                  if (p.status === "trending") return 3;
                  if (p.status === "active" || p.status === "funding") return 2;
                  return 0;
                };
                const scoreDiff = statusScore(b) - statusScore(a);
                if (scoreDiff !== 0) return scoreDiff;
                // 2. Highest funding %
                const aStats = getPlanStats(a), bStats = getPlanStats(b);
                if (bStats.raisedPct !== aStats.raisedPct) return bStats.raisedPct - aStats.raisedPct;
                // 3. Highest capital raised
                if (bStats.capitalRaised !== aStats.capitalRaised) return bStats.capitalRaised - aStats.capitalRaised;
                // 4. Highest participant count
                if (bStats.participants !== aStats.participants) return bStats.participants - aStats.participants;
                // 5. Newest first
                return b.id - a.id;
              }).map((plan: any) => {
                const minRoi = plan.minRoiRate ?? 0.025;
                const maxRoi = plan.maxRoiRate ?? 0.030;
                const gradient = planGradient(plan.colorTheme);
                const category = plan.category ?? "Strategic Capital";
                const rawBadge = badges[plan.id] ?? null;
                // Suppress auto-badge when it duplicates the status badge to avoid showing "🔥 Trending" twice
                const statusExpressesBadge =
                  (rawBadge === "trending" && plan.status === "trending") ||
                  (rawBadge === "popular"  && plan.isPopular) ||
                  (rawBadge === "top-funded" && plan.status === "featured");
                const badge = statusExpressesBadge ? null : rawBadge;
                const s = getPlanStats(plan);
                const momentum = getPlanMomentum(plan, s);
                const isExpanded = expandedId === plan.id;
                const sb = planStatusBadge(plan.status);

                return (
                  <div
                    key={plan.id}
                    className={cn(
                      "bg-card border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow",
                      plan.isFeatured ? "border-amber-300 ring-2 ring-amber-200 dark:ring-amber-800" : "border-border"
                    )}
                  >
                    {/* Featured strip */}
                    {plan.isFeatured && (
                      <div className="bg-gradient-to-r from-amber-400 to-orange-400 px-4 py-1.5 flex items-center gap-1.5">
                        <Star size={11} className="text-white fill-white" />
                        <p className="text-white text-[11px] font-bold tracking-wide uppercase">Featured Opportunity</p>
                      </div>
                    )}

                    {/* Gradient header */}
                    <div className={cn("bg-gradient-to-br p-5 text-white", gradient)}>
                      <div className="flex items-center justify-between mb-2">
                        <Badge className="bg-white/20 text-white border-white/30 text-[10px] font-semibold no-default-hover-elevate">
                          {category}
                        </Badge>
                        <div className="flex items-center gap-1.5">
                          {badge && badge !== "none" && (
                            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border bg-white/20 text-white border-white/30")}>
                              {BADGE_DISPLAY[badge].label}
                            </span>
                          )}
                          <Badge className={cn("text-[10px] border no-default-hover-elevate", sb.cls)}>
                            {sb.label}
                          </Badge>
                        </div>
                      </div>
                      <h3 className="font-bold text-xl mb-1">{plan.name}</h3>
                      <p className="text-white/70 text-xs">{plan.description}</p>
                      {plan.endDate && (() => {
                        const diff = new Date(plan.endDate).getTime() - Date.now();
                        if (diff <= 0) return <p className="text-[10px] text-red-300 mt-1 font-medium">Funding period ended</p>;
                        const d = Math.floor(diff / 86400000);
                        const h = Math.floor((diff % 86400000) / 3600000);
                        const m = Math.floor((diff % 3600000) / 60000);
                        const t = d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
                        return <p className="text-[10px] text-white/60 mt-1 flex items-center gap-1"><Clock size={9} />Closes in {t}</p>;
                      })()}

                      {/* ROI stats */}
                      <div className="grid grid-cols-3 gap-2 mt-4">
                        <div className="bg-white/15 rounded-xl py-2.5 text-center">
                          <p className="text-base font-bold">{(minRoi * 100).toFixed(1)}%–{(maxRoi * 100).toFixed(1)}%</p>
                          <p className="text-[10px] text-white/70 mt-0.5">Daily Return</p>
                        </div>
                        <div className="bg-white/15 rounded-xl py-2.5 text-center">
                          <p className="text-base font-bold">{plan.durationDays}d</p>
                          <p className="text-[10px] text-white/70 mt-0.5">Duration</p>
                        </div>
                        <div className="bg-white/15 rounded-xl py-2.5 text-center">
                          <p className="text-base font-bold">{((minRoi + maxRoi) / 2 * plan.durationDays * 100).toFixed(0)}%</p>
                          <p className="text-[10px] text-white/70 mt-0.5">Est. Total</p>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 space-y-3">
                      {/* Social proof strip */}
                      <div className="bg-muted/40 border border-border rounded-xl px-3 py-2 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs text-foreground font-semibold">
                            <Users size={12} className="text-primary" />
                            <span>{s.participants.toLocaleString()} participants</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="flex items-center gap-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                              <Zap size={9} />
                              <span className="text-[10px] font-bold">+{s.joinedToday} today</span>
                            </div>
                            <div className="flex items-center gap-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
                              <Calendar size={9} />
                              <span className="text-[10px] font-bold">+{s.joinedWeek} this week</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Funding progress */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground font-medium">{s.fundingDisplay} funded</span>
                            {/* Momentum badge — single instance, shown here only */}
                            {momentum && <MomentumBadge level={momentum} />}
                          </div>
                          <span className="text-xs font-bold text-foreground">{formatUSDT(s.capitalRaised)} / {formatUSDT(s.capitalTarget)}</span>
                        </div>
                        <AnimatedBar pct={s.barPct} gradient={planGradient(plan.colorTheme)} />
                        <p className="text-[10px] text-muted-foreground mt-1">{formatUSDT(s.capitalRemaining)} remaining to target</p>
                      </div>

                      {/* Analytics grid */}
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : plan.id)}
                        className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors py-0.5"
                      >
                        <span className="font-semibold">Full Analytics</span>
                        {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>

                      {isExpanded && (
                        <div className="grid grid-cols-3 gap-2 pt-1">
                          {[
                            { label: "Participants", value: s.participants.toLocaleString(), icon: Users },
                            { label: "Capital Target", value: formatUSDT(s.capitalTarget), icon: Target },
                            { label: "Capital Raised", value: formatUSDT(s.capitalRaised), icon: TrendingUp },
                            { label: "Funding %", value: s.fundingDisplay, icon: BarChart3 },
                            { label: "Min. Entry", value: formatUSDT(plan.minAmount), icon: Target },
                            { label: "Status", value: sb.label, icon: Zap },
                          ].map(({ label, value, icon: Icon }) => (
                            <div key={label} className="bg-muted/40 border border-border rounded-xl p-2.5 text-center">
                              <Icon size={12} className="text-primary mx-auto mb-1" />
                              <p className="text-xs font-bold text-foreground leading-tight">{value}</p>
                              <p className="text-[9px] text-muted-foreground mt-0.5">{label}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Entry range */}
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Target size={10} />
                          <span>Min: <span className="font-semibold text-foreground">{formatUSDT(plan.minAmount)}</span></span>
                        </div>
                        <span>Max: <span className="font-semibold text-foreground">{formatUSDT(plan.maxAmount)}</span></span>
                      </div>

                      {/* Features */}
                      {plan.features?.length > 0 && (
                        <div className="grid grid-cols-1 gap-1">
                          {plan.features.slice(0, 3).map((f: string, i: number) => (
                            <div key={i} className="flex items-center gap-1.5">
                              <CheckCircle size={11} className="text-emerald-500 shrink-0" />
                              <span className="text-xs text-muted-foreground">{f}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Action buttons */}
                      {(() => {
                        const BLOCKED = ["paused", "expired", "closed", "fully_allocated"];
                        const ended = plan.endDate && new Date(plan.endDate).getTime() < Date.now();
                        const isBlocked = BLOCKED.includes(plan.status ?? "") || ended;
                        const blockedMsg = plan.status === "fully_allocated" ? "Fully Allocated"
                          : plan.status === "paused" ? "Paused"
                          : plan.status === "closed" || plan.status === "expired" || ended ? "Closed"
                          : null;
                        return (
                          <div className="flex gap-2 pt-1">
                            <Button variant="outline" size="sm" className="gap-1 text-xs h-9" onClick={() => navigate(`/opportunity/${plan.id}`)}>
                              <Info size={12} /> Details
                            </Button>
                            {isBlocked ? (
                              <Button className="flex-1 h-9 font-semibold text-sm opacity-50 cursor-not-allowed" disabled>
                                {blockedMsg}
                              </Button>
                            ) : (
                              <Button className="flex-1 h-9 font-semibold text-sm" onClick={() => navigate(`/invest/${plan.id}`)}>
                                Participate Now <ArrowRight size={13} className="ml-1" />
                              </Button>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
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
                        <p className="text-xs text-muted-foreground">Live Distribution</p>
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
                      <AnimatedBar pct={progressPct} gradient="from-primary to-blue-400" />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12 bg-card border border-border rounded-2xl">
                <TrendingUp size={32} className="text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground">No active opportunities</p>
                <p className="text-xs text-muted-foreground mt-1">Participate in an opportunity to start receiving daily distributions</p>
                <Button variant="outline" className="mt-4 text-sm" onClick={() => setTab("opportunities")}>Browse Opportunities</Button>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
