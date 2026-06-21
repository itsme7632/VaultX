import { useState } from "react";
import { TrendingUp, Newspaper, BarChart3, Globe, Zap, ArrowRight, Calendar, Tag, ArrowLeft, Users, DollarSign, Activity } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/AppLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import { usePlatformMetrics, formatMetricCompact } from "@/hooks/usePlatformMetrics";

const SECTION_TABS = [
  { id: "all", label: "All Insights", icon: Newspaper },
  { id: "market", label: "Market", icon: TrendingUp },
  { id: "investment", label: "Investment", icon: BarChart3 },
  { id: "announcement", label: "Updates", icon: Zap },
];

const CATEGORY_COLORS: Record<string, string> = {
  announcement: "bg-primary/10 text-primary border-primary/20",
  investment: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
  security: "bg-amber-500/10 text-amber-600 border-amber-200",
  market: "bg-purple-500/10 text-purple-600 border-purple-200",
};

const CATEGORY_LABELS: Record<string, string> = {
  announcement: "Update",
  investment: "Investment",
  security: "Security",
  market: "Market",
};

const GROWTH_SECTORS = [
  { name: "Artificial Intelligence", trend: "+42%", icon: "🤖", color: "from-blue-500 to-indigo-600" },
  { name: "Digital Assets", trend: "+28%", icon: "💎", color: "from-purple-500 to-violet-600" },
  { name: "Clean Energy", trend: "+19%", icon: "⚡", color: "from-emerald-500 to-teal-600" },
  { name: "Fintech", trend: "+35%", icon: "📈", color: "from-amber-500 to-orange-600" },
];

export default function MarketInsightsPage() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("all");
  const { data: metrics, isLoading: metricsLoading } = usePlatformMetrics();

  const { data: allNews, isLoading } = useQuery({
    queryKey: ["news", "insights"],
    queryFn: async () => {
      const res = await fetch("/api/news?limit=50", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60000,
  });

  const filtered = (allNews ?? []).filter((post: any) => {
    if (activeTab === "all") return true;
    return post.category === activeTab;
  });

  const featured = (allNews ?? []).find((p: any) => p.isFeatured && p.isPublished);

  return (
    <AppLayout title="Market Insights">
      <div className="px-4 pt-5 pb-24 space-y-5">

        {/* Back button */}
        <button
          onClick={() => window.history.back()}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>

        {/* Hero */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-purple-900/60 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.06]" style={{
            backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }} />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <Globe size={16} className="text-purple-300" />
              <span className="text-[11px] text-purple-300 font-semibold uppercase tracking-widest">Market Overview</span>
            </div>
            <h1 className="text-xl font-black text-white mb-2">Market Insights</h1>
            <p className="text-white/60 text-sm leading-relaxed">
              Stay informed with real-time analysis, weekly market updates, and expert insights on emerging investment opportunities.
            </p>
          </div>
        </div>

        {/* Platform Metrics Strip */}
        <div className="grid grid-cols-3 gap-2">
          {[
            {
              icon: DollarSign,
              label: "Capital Raised",
              value: metricsLoading ? "—" : formatMetricCompact(metrics?.totalRaised ?? 0),
              color: "text-emerald-600",
              bg: "bg-emerald-500/10",
            },
            {
              icon: Users,
              label: "Participants",
              value: metricsLoading ? "—" : (metrics?.totalParticipants ?? 0).toLocaleString(),
              color: "text-primary",
              bg: "bg-primary/10",
            },
            {
              icon: Activity,
              label: "Active Funds",
              value: metricsLoading ? "—" : String(metrics?.activeOpportunities ?? 0),
              color: "text-purple-600",
              bg: "bg-purple-500/10",
            },
          ].map(({ icon: Icon, label, value, color, bg }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-3 shadow-sm text-center">
              <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center mx-auto mb-1.5", bg)}>
                <Icon size={13} className={color} />
              </div>
              <p className={cn("font-bold text-sm", color)}>{value}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Growth Sectors */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={14} className="text-primary" />
            <p className="font-semibold text-sm text-foreground">Growth Sectors</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {GROWTH_SECTORS.map(({ name, trend, icon, color }) => (
              <div key={name} className={cn("bg-gradient-to-br rounded-xl p-3.5 text-white shadow-sm", color)}>
                <div className="text-xl mb-1.5">{icon}</div>
                <p className="font-bold text-sm leading-tight">{name}</p>
                <p className="text-white/80 text-xs mt-0.5 font-semibold">{trend} YTD</p>
              </div>
            ))}
          </div>
        </div>

        {/* Featured insight */}
        {featured && (
          <div>
            <p className="font-semibold text-sm text-foreground mb-3 flex items-center gap-1.5">
              <Zap size={13} className="text-amber-500" /> Opportunity Highlight
            </p>
            <button
              onClick={() => navigate(`/news/${featured.id}`)}
              className="w-full text-left bg-gradient-to-br from-primary/10 to-blue-600/10 border border-primary/20 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="font-bold text-foreground text-base leading-tight line-clamp-2">{featured.title}</p>
                <ArrowRight size={16} className="text-primary shrink-0 mt-0.5" />
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{featured.excerpt}</p>
              <div className="flex items-center gap-2 mt-3">
                <Badge className={cn("text-[10px] border", CATEGORY_COLORS[featured.category] ?? "bg-muted text-muted-foreground")}>
                  {CATEGORY_LABELS[featured.category] ?? featured.category}
                </Badge>
                <p className="text-[10px] text-muted-foreground">{formatDateTime(featured.publishedAt ?? featured.createdAt)}</p>
              </div>
            </button>
          </div>
        )}

        {/* Tab filter */}
        <div className="flex gap-1 overflow-x-auto -mx-4 px-4 pb-1">
          {SECTION_TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all shrink-0",
                activeTab === id ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              <Icon size={11} />
              {label}
            </button>
          ))}
        </div>

        {/* Articles */}
        <div className="space-y-3">
          {isLoading ? (
            [1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)
          ) : filtered.length > 0 ? (
            filtered.map((post: any) => (
              <button
                key={post.id}
                onClick={() => navigate(`/news/${post.id}`)}
                className="w-full text-left bg-card border border-border rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <p className="font-semibold text-sm text-foreground leading-tight line-clamp-2">{post.title}</p>
                  <ArrowRight size={14} className="text-muted-foreground shrink-0 mt-0.5" />
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-2.5">{post.excerpt}</p>
                <div className="flex items-center gap-2">
                  <Badge className={cn("text-[10px] border", CATEGORY_COLORS[post.category] ?? "bg-muted text-muted-foreground")}>
                    <Tag size={8} className="mr-1" />
                    {CATEGORY_LABELS[post.category] ?? post.category}
                  </Badge>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Calendar size={9} />
                    {formatDateTime(post.publishedAt ?? post.createdAt)}
                  </div>
                </div>
              </button>
            ))
          ) : (
            <div className="bg-card border border-border rounded-2xl py-12 text-center shadow-sm">
              <Newspaper size={28} className="text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">No insights yet</p>
              <p className="text-xs text-muted-foreground mt-1">Market insights will appear here when published</p>
            </div>
          )}
        </div>

        {/* Market summary */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-3">
          <p className="font-semibold text-sm text-foreground flex items-center gap-2">
            <BarChart3 size={14} className="text-primary" />
            Weekly Summary
          </p>
          {[
            { label: "Global Crypto Market Cap", value: "$2.4T", change: "+3.2%", up: true },
            { label: "DeFi Total Value Locked", value: "$118B", change: "+7.1%", up: true },
            { label: "Institutional Inflows", value: "$4.2B", change: "+12.4%", up: true },
            { label: "Market Volatility Index", value: "42.3", change: "-8.1%", up: false },
          ].map(({ label, value, change, up }) => (
            <div key={label} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <p className="text-sm text-muted-foreground">{label}</p>
              <div className="flex items-center gap-2">
                <p className="font-bold text-sm text-foreground">{value}</p>
                <span className={cn("text-[11px] font-semibold px-1.5 py-0.5 rounded-full", up ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-500")}>
                  {change}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
