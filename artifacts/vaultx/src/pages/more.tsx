import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Info, Lock, FileText, Download, Headphones,
  ChevronRight, Shield, Smartphone, PieChart, TrendingUp, BarChart3, HelpCircle, Users,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { cn } from "@/lib/utils";

export default function MorePage() {
  const [, setLocation] = useLocation();

  const { data: appInfo } = useQuery({
    queryKey: ["app-info"],
    queryFn: () => fetch("/api/app-info", { credentials: "include" }).then((r) => r.json()),
    staleTime: 60000,
  });

  const { data: settings } = useQuery({
    queryKey: ["public-settings"],
    queryFn: () => fetch("/api/settings/public", { credentials: "include" }).then((r) => r.json()),
    staleTime: 60000,
  });

  const platformName = settings?.platform_name || "Wexora";
  const appVersion = appInfo?.version ? `v${appInfo.version}` : "v2.0";

  const communityItems = [
    {
      icon: Users,
      label: "Community Hub",
      description: "Chat, announcements, leaderboards and support",
      href: "/community",
      gradient: "from-violet-500 to-purple-600",
    },
    {
      icon: Users,
      label: "Referral Program",
      description: "Invite friends and earn 5% commission on their profits",
      href: "/referrals",
      gradient: "from-emerald-500 to-teal-600",
    },
  ];

  const platformItems = [
    {
      icon: PieChart,
      label: "Capital Allocation",
      description: "Platform portfolio composition and sector weights",
      href: "/capital-allocation",
      gradient: "from-blue-500 to-indigo-600",
    },
    {
      icon: TrendingUp,
      label: "Market Insights",
      description: "Weekly analysis, trends and opportunity highlights",
      href: "/market-insights",
      gradient: "from-purple-500 to-violet-600",
    },
    {
      icon: BarChart3,
      label: "Performance Center",
      description: "Platform capital, participants and historical data",
      href: "/performance",
      gradient: "from-emerald-500 to-teal-600",
    },
  ];

  const navItems = [
    {
      icon: HelpCircle,
      label: "FAQ",
      description: "Frequently asked questions answered by our team",
      href: "/faq",
      gradient: "from-amber-500 to-orange-600",
    },
    {
      icon: Info,
      label: "About Wexora",
      description: "Mission, features, platform stats and FAQ",
      href: "/about",
      gradient: "from-indigo-500 to-violet-600",
    },
    {
      icon: Lock,
      label: "Privacy Policy",
      description: "How we collect, use and protect your data",
      href: "/privacy",
      gradient: "from-slate-600 to-slate-800",
    },
    {
      icon: FileText,
      label: "Terms & Conditions",
      description: "Platform usage rules and agreements",
      href: "/terms",
      gradient: "from-slate-500 to-gray-700",
    },
    {
      icon: Download,
      label: "Download App",
      description: "Get the latest Android APK",
      href: "/download-app",
      gradient: "from-primary to-blue-600",
    },
    {
      icon: Headphones,
      label: "Contact Support",
      description: "Open a ticket, live chat or community",
      href: "/support",
      gradient: "from-emerald-500 to-teal-600",
    },
  ];

  return (
    <AppLayout title="More">
      <div className="pb-24">

        {/* Hero */}
        <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-primary/80 px-4 pt-7 pb-9 overflow-hidden">
          <div className="absolute inset-0 opacity-[0.07]" style={{
            backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)",
            backgroundSize: "30px 30px",
          }} />
          <div className="relative max-w-screen-sm mx-auto text-center">
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Shield size={28} className="text-white" />
            </div>
            <h1 className="text-xl font-black text-white mb-1.5">{platformName}</h1>
            <p className="text-sm text-white/60">Professional investment platform</p>
          </div>
        </div>

        <div className="px-4 pt-5 max-w-screen-sm mx-auto space-y-5">

          {/* Community section */}
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 px-1">Community & Referrals</p>
            <div className="space-y-3">
              {communityItems.map(({ icon: Icon, label, description, href, gradient }) => (
                <button
                  key={href}
                  onClick={() => setLocation(href)}
                  className="w-full flex items-center gap-4 bg-card border border-border rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-primary/30 active:scale-[0.98] transition-all text-left"
                >
                  <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center bg-gradient-to-br shadow-sm shrink-0", gradient)}>
                    <Icon size={20} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{description}</p>
                  </div>
                  <ChevronRight size={16} className="text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          </div>

          {/* Platform tools section */}
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 px-1">Platform Tools</p>
            <div className="space-y-3">
              {platformItems.map(({ icon: Icon, label, description, href, gradient }) => (
                <button
                  key={href}
                  onClick={() => setLocation(href)}
                  className="w-full flex items-center gap-4 bg-card border border-border rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-primary/30 active:scale-[0.98] transition-all text-left"
                >
                  <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center bg-gradient-to-br shadow-sm shrink-0", gradient)}>
                    <Icon size={20} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{description}</p>
                  </div>
                  <ChevronRight size={16} className="text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          </div>

          {/* Info & legal section */}
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 px-1">Information & Legal</p>
            <div className="space-y-3">
              {navItems.map(({ icon: Icon, label, description, href, gradient }) => (
                <button
                  key={href}
                  onClick={() => setLocation(href)}
                  className="w-full flex items-center gap-4 bg-card border border-border rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-primary/30 active:scale-[0.98] transition-all text-left"
                >
                  <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center bg-gradient-to-br shadow-sm shrink-0", gradient)}>
                    <Icon size={20} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{description}</p>
                  </div>
                  <ChevronRight size={16} className="text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          </div>

          {/* Version card */}
          <div className="flex items-center gap-4 bg-muted/30 border border-border rounded-2xl p-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-muted border border-border shrink-0">
              <Smartphone size={18} className="text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">App Version</p>
              <p className="text-xs text-muted-foreground mt-0.5">{platformName} · Investment Platform</p>
            </div>
            <span className="text-sm font-bold font-mono text-primary">{appVersion}</span>
          </div>

        </div>
      </div>
    </AppLayout>
  );
}
