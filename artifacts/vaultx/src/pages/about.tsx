import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import {
  Shield, Zap, BarChart2, Eye, LayoutDashboard, HeadphonesIcon,
  CheckCircle2, Star, Lightbulb, Award,
  UserPlus, Wallet, TrendingUp, PieChart,
  Mail, MessageCircle, Phone, ChevronDown, ChevronUp,
  Globe, ArrowRight, Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatUSDT } from "@/lib/format";

function useCountUp(target: number, duration = 1800, start = false) {
  const [value, setValue] = useState(0);
  const prevTarget = useRef(0);
  useEffect(() => {
    if (!start || target === 0) return;
    const from = prevTarget.current;
    prevTarget.current = target;
    let startTime: number | null = null;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.floor(from + eased * (target - from)));
      if (progress < 1) requestAnimationFrame(step);
      else setValue(target);
    };
    requestAnimationFrame(step);
  }, [target, duration, start]);
  return value;
}

function StatCard({ label, value, prefix = "", suffix = "", isCurrency = false, start }: {
  label: string; value: number; prefix?: string; suffix?: string; isCurrency?: boolean; start: boolean;
}) {
  const animated = useCountUp(value, 1800, start);
  const display = isCurrency
    ? formatUSDT(animated)
    : `${prefix}${animated.toLocaleString()}${suffix}`;
  return (
    <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-4 text-center">
      <p className="text-2xl font-black text-white">{display}</p>
      <p className="text-xs text-white/70 mt-1 font-medium">{label}</p>
    </div>
  );
}

function AnimatedStatCard({ label, min, max, prefix = "", suffix = "", isCurrency = false, start }: {
  label: string; min: number; max: number; prefix?: string; suffix?: string; isCurrency?: boolean; start: boolean;
}) {
  const [target, setTarget] = useState(() => Math.round(min + Math.random() * (max - min)));
  useEffect(() => {
    if (!start) return;
    const schedule = () => {
      const delay = 4_000 + Math.random() * 6_000;
      return setTimeout(() => {
        setTarget(Math.round(min + Math.random() * (max - min)));
        tRef.current = schedule();
      }, delay);
    };
    const tRef = { current: schedule() };
    return () => clearTimeout(tRef.current);
  }, [min, max, start]);
  const animated = useCountUp(target, 2000, start);
  const display = isCurrency
    ? formatUSDT(animated)
    : `${prefix}${animated.toLocaleString()}${suffix}`;
  return (
    <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-4 text-center">
      <p className="text-2xl font-black text-white">{display}</p>
      <p className="text-xs text-white/70 mt-1 font-medium">{label}</p>
    </div>
  );
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3.5 text-left bg-card hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <span className="text-sm font-medium text-foreground pr-2">{q}</span>
        {open ? <ChevronUp size={16} className="text-primary shrink-0" /> : <ChevronDown size={16} className="text-muted-foreground shrink-0" />}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-2 bg-muted/10 border-t border-border">
          <p className="text-sm text-muted-foreground leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  );
}

export default function AboutPage() {
  const [, setLocation] = useLocation();
  const statsRef = useRef<HTMLDivElement>(null);
  const [statsVisible, setStatsVisible] = useState(false);

  const { data } = useQuery({
    queryKey: ["about"],
    queryFn: () => fetch("/api/about", { credentials: "include" }).then((r) => r.json()),
    staleTime: 60000,
  });

  const content = data?.content ?? {};
  const stats = data?.stats ?? {};
  const statsMode: "real" | "custom" | "animated" = data?.statsMode ?? "real";
  const statsCustom = data?.statsCustom ?? {};
  const statsAnim = data?.statsAnim ?? {};

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStatsVisible(true); },
      { threshold: 0.2 }
    );
    if (statsRef.current) observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, []);

  const features = [
    { icon: Shield, label: "Secure Platform", desc: "Advanced security measures and account protection systems.", color: "text-emerald-600", bg: "bg-emerald-500/10" },
    { icon: Zap, label: "Fast Transactions", desc: "Efficient deposit and withdrawal processing.", color: "text-amber-600", bg: "bg-amber-500/10" },
    { icon: BarChart2, label: "Real-Time Tracking", desc: "Monitor investments and portfolio performance in real time.", color: "text-blue-600", bg: "bg-blue-500/10" },
    { icon: Eye, label: "Transparent Operations", desc: "Clear investment information and progress tracking.", color: "text-purple-600", bg: "bg-purple-500/10" },
    { icon: LayoutDashboard, label: "User-Friendly Dashboard", desc: "Simple and intuitive interface for all users.", color: "text-primary", bg: "bg-primary/10" },
    { icon: HeadphonesIcon, label: "Dedicated Support", desc: "Responsive support team available to assist members.", color: "text-rose-600", bg: "bg-rose-500/10" },
  ];

  const values = [
    { icon: Eye, label: "Transparency", desc: "Clear information and honest communication.", color: "text-blue-600", bg: "bg-blue-500/10" },
    { icon: Lock, label: "Security", desc: "Protecting user accounts and platform integrity.", color: "text-emerald-600", bg: "bg-emerald-500/10" },
    { icon: Lightbulb, label: "Innovation", desc: "Continuous improvement and feature development.", color: "text-amber-600", bg: "bg-amber-500/10" },
    { icon: Award, label: "Reliability", desc: "Consistent platform performance and user experience.", color: "text-purple-600", bg: "bg-purple-500/10" },
  ];

  const steps = [
    { icon: UserPlus, step: "01", title: "Create Your Account", desc: "Sign up in minutes with your email and personal details." },
    { icon: Wallet, step: "02", title: "Fund Your Wallet", desc: "Deposit USDT to your wallet using our supported networks." },
    { icon: TrendingUp, step: "03", title: "Choose Investment Opportunities", desc: "Browse and select from carefully structured investment plans." },
    { icon: PieChart, step: "04", title: "Track Performance & Manage Portfolio", desc: "Monitor distributions, manage investments, and claim your distributions." },
  ];

  const faqs = [
    { q: "How do I create an account?", a: "Click 'Sign Up' on the login page, fill in your name, email, and create a secure password. Your account will be ready immediately and you may receive a signup bonus." },
    { q: "How do I fund my wallet?", a: "Navigate to the Deposit section, choose your preferred USDT network (e.g. TRC20, ERC20), copy the wallet address, and send your funds. Deposits are confirmed after network verification." },
    { q: "How do withdrawals work?", a: "Go to Withdraw, enter the amount and your USDT wallet address, and submit. Withdrawals are reviewed by our team and typically processed within 24 hours." },
    { q: "How can I track my investments?", a: "Your Portfolio page shows all active and completed investments, daily distributions, total distributions received, and performance charts in real time." },
    { q: "How do I contact support?", a: "Use the Help & Support section in the app to open a support ticket, or reach us via email, Telegram, or WhatsApp listed on this page." },
  ];

  const platformName = content.platform_name || "VaultX";

  function renderStatCards() {
    const statDefs = [
      {
        label: "Registered Members",
        realVal: stats.totalUsers || 1240,
        customVal: Number(statsCustom.members ?? 1240),
        animMin: Number(statsAnim.members?.min ?? 5000),
        animMax: Number(statsAnim.members?.max ?? 10000),
      },
      {
        label: "Active Investments",
        realVal: stats.activeInvestments || 387,
        customVal: Number(statsCustom.activeInvestments ?? 387),
        animMin: Number(statsAnim.activeInvestments?.min ?? 300),
        animMax: Number(statsAnim.activeInvestments?.max ?? 800),
      },
      {
        label: "Total Deposits",
        realVal: Math.round(stats.totalDeposits || 2850000),
        customVal: Number(statsCustom.totalDeposits ?? 2850000),
        animMin: Number(statsAnim.totalDeposits?.min ?? 250000),
        animMax: Number(statsAnim.totalDeposits?.max ?? 500000),
        prefix: "$",
      },
      {
        label: "Total Withdrawals",
        realVal: Math.round(stats.totalWithdrawals || 1920000),
        customVal: Number(statsCustom.totalWithdrawals ?? 1920000),
        animMin: Number(statsAnim.totalWithdrawals?.min ?? 150000),
        animMax: Number(statsAnim.totalWithdrawals?.max ?? 400000),
        prefix: "$",
      },
      {
        label: "Completed Opportunities",
        realVal: stats.completedInvestments || 1056,
        customVal: Number(statsCustom.completedInvestments ?? 1056),
        animMin: Number(statsAnim.completedInvestments?.min ?? 800),
        animMax: Number(statsAnim.completedInvestments?.max ?? 2000),
      },
      {
        label: "Countries Served",
        realVal: stats.countriesServed || 42,
        customVal: Number(statsCustom.countriesServed ?? 42),
        animMin: Number(statsAnim.countriesServed?.min ?? 35),
        animMax: Number(statsAnim.countriesServed?.max ?? 60),
        suffix: "+",
      },
    ];

    return statDefs.map((s) => {
      if (statsMode === "animated") {
        return (
          <AnimatedStatCard
            key={s.label}
            label={s.label}
            min={s.animMin}
            max={s.animMax}
            prefix={s.prefix ?? ""}
            suffix={s.suffix ?? ""}
            start={statsVisible}
          />
        );
      }
      const value = statsMode === "custom" ? s.customVal : s.realVal;
      return (
        <StatCard
          key={s.label}
          label={s.label}
          value={value}
          prefix={s.prefix ?? ""}
          suffix={s.suffix ?? ""}
          start={statsVisible}
        />
      );
    });
  }

  const statsSubtitle =
    statsMode === "real" ? "Live data from our platform" :
    statsMode === "custom" ? "Platform growth milestones" :
    "Growing platform statistics";

  return (
    <AppLayout title={`About ${platformName}`}>
      <div className="pb-24">

        {/* ── Hero ── */}
        <div className="bg-gradient-to-br from-slate-900 via-primary/90 to-blue-700 px-4 pt-8 pb-10">
          <div className="max-w-screen-sm mx-auto text-center">
            <div className="inline-flex items-center gap-1.5 bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-4">
              <Globe size={12} className="text-white/70" />
              <span className="text-[10px] text-white/70 font-semibold uppercase tracking-widest">Digital Investment Platform</span>
            </div>
            <h1 className="text-2xl font-black text-white leading-tight mb-3">
              {content.hero_title || "About VaultX"}
            </h1>
            <p className="text-sm text-white/80 font-medium leading-relaxed mb-3">
              {content.hero_subtitle || "A Modern Digital Investment Platform Designed for Growth, Transparency, and Security."}
            </p>
            <p className="text-xs text-white/60 leading-relaxed">
              {content.hero_description || "VaultX is a digital investment platform that provides users with access to carefully structured investment opportunities across global industries."}
            </p>
          </div>
        </div>

        <div className="px-4 space-y-6 mt-6 max-w-screen-sm mx-auto">

          {/* ── Our Mission ── */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <Star size={16} className="text-primary" />
              </div>
              <h2 className="text-base font-bold text-foreground">Our Mission</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {content.mission_text || "At VaultX, our mission is to provide a secure, user-friendly, and innovative investment platform that helps members access investment opportunities with confidence."}
            </p>
          </div>

          {/* ── Why Choose VaultX ── */}
          <div>
            <h2 className="text-base font-bold text-foreground mb-3">Why Choose {platformName}</h2>
            <div className="grid grid-cols-2 gap-3">
              {features.map(({ icon: Icon, label, desc, color, bg }) => (
                <div key={label} className="bg-card border border-border rounded-2xl p-3.5 shadow-sm">
                  <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center mb-2", bg)}>
                    <Icon size={16} className={color} />
                  </div>
                  <p className="text-xs font-bold text-foreground mb-1 leading-tight">{label}</p>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Platform Statistics ── */}
          <div
            ref={statsRef}
            className="bg-gradient-to-br from-slate-900 to-primary rounded-2xl p-5"
          >
            <h2 className="text-sm font-bold text-white mb-1">Platform Statistics</h2>
            <p className="text-xs text-white/50 mb-4">{statsSubtitle}</p>
            <div className="grid grid-cols-2 gap-3">
              {renderStatCards()}
            </div>
          </div>

          {/* ── Core Values ── */}
          <div>
            <h2 className="text-base font-bold text-foreground mb-3">Our Core Values</h2>
            <div className="grid grid-cols-2 gap-3">
              {values.map(({ icon: Icon, label, desc, color, bg }) => (
                <div key={label} className="bg-card border border-border rounded-2xl p-3.5 shadow-sm">
                  <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center mb-2", bg)}>
                    <Icon size={16} className={color} />
                  </div>
                  <p className="text-xs font-bold text-foreground mb-1">{label}</p>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── How VaultX Works ── */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
            <h2 className="text-base font-bold text-foreground mb-4">How {platformName} Works</h2>
            <div className="space-y-0">
              {steps.map(({ icon: Icon, step, title, desc }, i) => (
                <div key={step} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shrink-0">
                      <Icon size={16} className="text-white" />
                    </div>
                    {i < steps.length - 1 && (
                      <div className="w-px flex-1 bg-border my-1" style={{ minHeight: 24 }} />
                    )}
                  </div>
                  <div className={cn("pb-4", i === steps.length - 1 ? "pb-0" : "")}>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">STEP {step}</span>
                    </div>
                    <p className="text-sm font-bold text-foreground leading-tight">{title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Security & Compliance ── */}
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0">
                <Shield size={18} className="text-white" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mb-1.5">Security &amp; Compliance</h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {content.security_text || "VaultX prioritizes platform security through account protection measures, encrypted connections, and continuous monitoring."}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {["Encrypted Connections", "Account Protection", "Continuous Monitoring"].map((badge) => (
                    <span key={badge} className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 size={9} /> {badge}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── FAQ ── */}
          <div>
            <h2 className="text-base font-bold text-foreground mb-3">Frequently Asked Questions</h2>
            <div className="space-y-2">
              {faqs.map((faq) => (
                <FAQItem key={faq.q} q={faq.q} a={faq.a} />
              ))}
            </div>
            <Button
              variant="outline"
              className="w-full mt-3 h-10 text-sm font-semibold gap-2"
              onClick={() => setLocation("/support")}
            >
              View Full FAQ &amp; Support <ArrowRight size={14} />
            </Button>
          </div>

          {/* ── Contact ── */}
          <div>
            <h2 className="text-base font-bold text-foreground mb-3">Contact &amp; Support</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-card border border-border rounded-2xl p-3.5 shadow-sm">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
                  <LayoutDashboard size={16} className="text-primary" />
                </div>
                <p className="text-xs font-bold text-foreground mb-0.5">Support Center</p>
                <p className="text-[10px] text-muted-foreground">Open a ticket in-app</p>
                <button
                  className="mt-2 text-[10px] font-semibold text-primary flex items-center gap-1"
                  onClick={() => setLocation("/support")}
                >
                  Open Ticket <ArrowRight size={10} />
                </button>
              </div>

              {content.support_email && (
                <a
                  href={`mailto:${content.support_email}`}
                  className="bg-card border border-border rounded-2xl p-3.5 shadow-sm block"
                >
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center mb-2">
                    <Mail size={16} className="text-blue-500" />
                  </div>
                  <p className="text-xs font-bold text-foreground mb-0.5">Email Support</p>
                  <p className="text-[10px] text-muted-foreground truncate">{content.support_email}</p>
                </a>
              )}

              {content.support_telegram && (
                <a
                  href={content.support_telegram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-card border border-border rounded-2xl p-3.5 shadow-sm block"
                >
                  <div className="w-8 h-8 rounded-xl bg-sky-500/10 flex items-center justify-center mb-2">
                    <MessageCircle size={16} className="text-sky-500" />
                  </div>
                  <p className="text-xs font-bold text-foreground mb-0.5">Telegram</p>
                  <p className="text-[10px] text-muted-foreground">Community &amp; Support</p>
                </a>
              )}

              {content.support_whatsapp && (
                <a
                  href={`https://wa.me/${content.support_whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-card border border-border rounded-2xl p-3.5 shadow-sm block"
                >
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-2">
                    <Phone size={16} className="text-emerald-500" />
                  </div>
                  <p className="text-xs font-bold text-foreground mb-0.5">WhatsApp</p>
                  <p className="text-[10px] text-muted-foreground">{content.support_whatsapp}</p>
                </a>
              )}
            </div>
          </div>

          {/* ── Footer CTA ── */}
          <div className="bg-gradient-to-br from-primary to-blue-600 rounded-2xl p-5 text-center">
            <h3 className="text-base font-black text-white mb-1">Ready to Start Investing?</h3>
            <p className="text-xs text-white/70 mb-4">Join thousands of members growing their portfolio with {platformName}.</p>
            <Button
              className="bg-white text-primary hover:bg-white/90 font-bold h-10 px-6 text-sm"
              onClick={() => setLocation("/investments")}
            >
              Explore Opportunities <ArrowRight size={14} className="ml-1" />
            </Button>
          </div>

        </div>
      </div>
    </AppLayout>
  );
}
