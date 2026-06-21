import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SplashScreen } from "@/components/SplashScreen";
import { setBaseUrl } from "@workspace/api-client-react";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Wrench, RefreshCw, MessageCircle, Phone, Clock } from "lucide-react";

import LoginPage from "@/pages/login";
import SignupPage from "@/pages/signup";
import ForgotPasswordPage from "@/pages/forgot-password";
import DashboardPage from "@/pages/dashboard";
import WalletPage from "@/pages/wallet";
import DepositPage from "@/pages/deposit";
import WithdrawPage from "@/pages/withdraw";
import TransferPage from "@/pages/transfer";
import InvestmentsPage from "@/pages/investments";
import InvestPage from "@/pages/invest";
import OpportunityDetailPage from "@/pages/opportunity-detail";
import CapitalAllocationPage from "@/pages/capital-allocation";
import MarketInsightsPage from "@/pages/market-insights";
import PerformancePage from "@/pages/performance";
import PortfolioPage from "@/pages/portfolio";
import ReferralsPage from "@/pages/referrals";
import NotificationsPage from "@/pages/notifications";
import ProfilePage from "@/pages/profile";
import SecurityPage from "@/pages/security";
import Setup2FAPage from "@/pages/setup-2fa";
import KycPage from "@/pages/kyc";
import SettingsPage from "@/pages/settings";
import AdminPage from "@/pages/admin";
import NewsPage, { NewsArticlePage } from "@/pages/news";
import SupportPage, { SupportTicketPage } from "@/pages/support";
import TransactionPage from "@/pages/transaction";
import NotFound from "@/pages/not-found";
import AboutPage from "@/pages/about";
import DownloadAppPage from "@/pages/download-app";
import MorePage from "@/pages/more";
import PrivacyPolicyPage from "@/pages/privacy";
import TermsPage from "@/pages/terms";
import FaqPage from "@/pages/faq";

setBaseUrl(null);

// ─── Detect app mode synchronously (runs once at module load) ─────────────────
function detectIsAppMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const ua = navigator.userAgent || "";
    const isStandalone =
      ("standalone" in navigator && (navigator as any).standalone === true) ||
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches;
    const isWebView =
      /wv/.test(ua) ||
      /WebView/.test(ua) ||
      /AppGeyser/.test(ua) ||
      (/Android/.test(ua) && !/Chrome\/[.0-9]*\s+Mobile/.test(ua) && /Version\//.test(ua)) ||
      (!/Chrome/.test(ua) && /Android/.test(ua));
    return isStandalone || isWebView;
  } catch {
    return false;
  }
}

// Only show splash once per session, never on desktop browser
const IS_APP_MODE = detectIsAppMode();
const SPLASH_ALREADY_SHOWN = (() => {
  try { return !!sessionStorage.getItem("wexora-splash-shown"); } catch { return false; }
})();
const SHOW_SPLASH = IS_APP_MODE && !SPLASH_ALREADY_SHOWN;
if (SHOW_SPLASH) {
  try { sessionStorage.setItem("wexora-splash-shown", "1"); } catch {}
}

// ─── KYC route guard ──────────────────────────────────────────────────────────
function KycGuard({ children }: { children: React.ReactNode }) {
  const [, navigate] = useLocation();
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(true);
  useEffect(() => {
    fetch("/api/settings/public", { credentials: "include" })
      .then((r) => r.json())
      .then((d: any) => {
        const val = Array.isArray(d)
          ? d.find((x: any) => x.key === "kyc_enabled")?.value
          : d?.kyc_enabled;
        if (val === "false") { navigate("/"); setAllowed(false); }
        setReady(true);
      })
      .catch(() => setReady(true));
  }, []);
  if (!ready) return null;
  return allowed ? <>{children}</> : null;
}

// ─── Query client ──────────────────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        if (error?.status === 401 || error?.status === 403) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
  },
});

// ─── Router ───────────────────────────────────────────────────────────────────
function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/signup" component={SignupPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />

      <Route path="/">
        <ProtectedRoute><DashboardPage /></ProtectedRoute>
      </Route>
      <Route path="/wallet">
        <ProtectedRoute><WalletPage /></ProtectedRoute>
      </Route>
      <Route path="/deposit">
        <ProtectedRoute><DepositPage /></ProtectedRoute>
      </Route>
      <Route path="/withdraw">
        <ProtectedRoute><WithdrawPage /></ProtectedRoute>
      </Route>
      <Route path="/transfer">
        <ProtectedRoute><TransferPage /></ProtectedRoute>
      </Route>
      <Route path="/investments">
        <ProtectedRoute><InvestmentsPage /></ProtectedRoute>
      </Route>
      <Route path="/invest/:planId">
        <ProtectedRoute><InvestPage /></ProtectedRoute>
      </Route>
      <Route path="/opportunity/:planId">
        <ProtectedRoute><OpportunityDetailPage /></ProtectedRoute>
      </Route>
      <Route path="/capital-allocation">
        <ProtectedRoute><CapitalAllocationPage /></ProtectedRoute>
      </Route>
      <Route path="/market-insights">
        <ProtectedRoute><MarketInsightsPage /></ProtectedRoute>
      </Route>
      <Route path="/performance">
        <ProtectedRoute><PerformancePage /></ProtectedRoute>
      </Route>
      <Route path="/portfolio">
        <ProtectedRoute><PortfolioPage /></ProtectedRoute>
      </Route>
      <Route path="/referrals">
        <ProtectedRoute><ReferralsPage /></ProtectedRoute>
      </Route>
      <Route path="/notifications">
        <ProtectedRoute><NotificationsPage /></ProtectedRoute>
      </Route>
      <Route path="/profile">
        <ProtectedRoute><ProfilePage /></ProtectedRoute>
      </Route>
      <Route path="/security">
        <ProtectedRoute><SecurityPage /></ProtectedRoute>
      </Route>
      <Route path="/setup-2fa">
        <ProtectedRoute><Setup2FAPage /></ProtectedRoute>
      </Route>
      <Route path="/kyc">
        <ProtectedRoute><KycGuard><KycPage /></KycGuard></ProtectedRoute>
      </Route>
      <Route path="/settings">
        <ProtectedRoute><SettingsPage /></ProtectedRoute>
      </Route>
      <Route path="/admin">
        <ProtectedRoute adminOnly><AdminPage /></ProtectedRoute>
      </Route>
      <Route path="/news">
        <ProtectedRoute><NewsPage /></ProtectedRoute>
      </Route>
      <Route path="/news/:id">
        <ProtectedRoute><NewsArticlePage /></ProtectedRoute>
      </Route>
      <Route path="/support">
        <ProtectedRoute><SupportPage /></ProtectedRoute>
      </Route>
      <Route path="/support/:id">
        <ProtectedRoute><SupportTicketPage /></ProtectedRoute>
      </Route>
      <Route path="/transaction/:id">
        <ProtectedRoute><TransactionPage /></ProtectedRoute>
      </Route>
      <Route path="/about">
        <ProtectedRoute><AboutPage /></ProtectedRoute>
      </Route>
      <Route path="/download-app">
        <ProtectedRoute><DownloadAppPage /></ProtectedRoute>
      </Route>
      <Route path="/more">
        <ProtectedRoute><MorePage /></ProtectedRoute>
      </Route>
      <Route path="/privacy">
        <ProtectedRoute><PrivacyPolicyPage /></ProtectedRoute>
      </Route>
      <Route path="/terms">
        <ProtectedRoute><TermsPage /></ProtectedRoute>
      </Route>
      <Route path="/faq">
        <ProtectedRoute><FaqPage /></ProtectedRoute>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

// ─── Countdown timer hook ──────────────────────────────────────────────────────
function useCountdown(isoEta: string) {
  const [remaining, setRemaining] = useState<{ h: number; m: number; s: number } | null>(null);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!isoEta) return;
    const target = new Date(isoEta).getTime();
    if (isNaN(target)) return;

    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) {
        setRemaining(null);
        setExpired(true);
        return;
      }
      const totalSecs = Math.floor(diff / 1000);
      setRemaining({
        h: Math.floor(totalSecs / 3600),
        m: Math.floor((totalSecs % 3600) / 60),
        s: totalSecs % 60,
      });
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isoEta]);

  return { remaining, expired };
}

// ─── Maintenance page ─────────────────────────────────────────────────────────
function MaintenancePage({ settings }: { settings: Record<string, string> | undefined }) {
  const platformName   = settings?.platform_name       ?? "Wexora Global";
  const telegramLink   = settings?.support_telegram_group ?? settings?.support_telegram ?? "";
  const whatsappLink   = settings?.support_whatsapp_community ?? settings?.support_whatsapp ?? "";
  const supportEmail   = settings?.support_email       ?? "";
  const eta            = settings?.maintenance_eta      ?? "";

  const { remaining, expired } = useCountdown(eta);
  const etaDate = eta ? new Date(eta) : null;
  const etaValid = etaDate && !isNaN(etaDate.getTime());

  const handleRefresh = () => window.location.reload();

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center px-6 text-center"
      style={{ background: "#060d1a" }}
    >
      {/* Logo */}
      <div className="mb-8">
        <img
          src="/wx-icon.png"
          alt="Wexora Global"
          className="w-16 h-16 rounded-2xl mx-auto mb-3 shadow-lg"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
        <p className="text-blue-300 text-xs font-semibold tracking-widest uppercase">
          {platformName}
        </p>
      </div>

      {/* Icon */}
      <div className="w-20 h-20 rounded-3xl bg-amber-400/10 border border-amber-400/25 flex items-center justify-center mb-6">
        <Wrench size={36} className="text-amber-400" />
      </div>

      {/* Heading */}
      <h1 className="text-2xl font-bold text-white mb-3 leading-tight">
        Platform Under Maintenance
      </h1>

      {/* Message */}
      <p className="text-slate-400 text-sm leading-relaxed max-w-sm mb-3">
        Thank you for your patience. Wexora Global is currently undergoing scheduled
        maintenance to improve platform performance and security.
      </p>
      <p className="text-slate-500 text-xs leading-relaxed max-w-sm mb-6">
        Your account, investments, and balances remain safe and will be fully
        accessible once maintenance is complete.
      </p>

      {/* Countdown timer */}
      {etaValid && (
        <div className="mb-8 w-full max-w-xs">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
            <div className="flex items-center justify-center gap-1.5 text-slate-400 text-xs mb-3">
              <Clock size={12} />
              <span>
                {expired
                  ? "Expected return time has passed — finalising shortly…"
                  : `Back by ${etaDate!.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}`}
              </span>
            </div>
            {!expired && remaining && (
              <div className="flex items-center justify-center gap-3">
                {[
                  { value: remaining.h, label: "HRS" },
                  { value: remaining.m, label: "MIN" },
                  { value: remaining.s, label: "SEC" },
                ].map(({ value, label }) => (
                  <div key={label} className="flex flex-col items-center">
                    <div className="w-16 h-14 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center">
                      <span className="text-2xl font-bold text-white tabular-nums">
                        {String(value).padStart(2, "0")}
                      </span>
                    </div>
                    <span className="text-slate-500 text-[9px] font-semibold tracking-widest mt-1.5">
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {expired && (
              <p className="text-center text-amber-400 text-xs font-medium">
                Maintenance completing soon — please refresh
              </p>
            )}
          </div>
        </div>
      )}

      {/* No ETA spacer */}
      {!etaValid && <div className="mb-2" />}

      {/* Action buttons */}
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={handleRefresh}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-sm text-white border border-white/20 bg-white/10 hover:bg-white/15 transition-colors"
        >
          <RefreshCw size={15} />
          Refresh Page
        </button>

        {telegramLink && (
          <a
            href={telegramLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-sm text-white bg-sky-600/80 hover:bg-sky-600 transition-colors"
          >
            <MessageCircle size={15} />
            Telegram Community
          </a>
        )}

        {whatsappLink && (
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-sm text-white bg-green-600/80 hover:bg-green-600 transition-colors"
          >
            <Phone size={15} />
            WhatsApp Support
          </a>
        )}

        {supportEmail && !whatsappLink && (
          <a
            href={`mailto:${supportEmail}`}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-sm text-white bg-blue-600/80 hover:bg-blue-600 transition-colors"
          >
            <Phone size={15} />
            Contact Support
          </a>
        )}
      </div>

      {/* Footer */}
      <p className="mt-8 text-xs text-slate-600">
        © {new Date().getFullYear()} {platformName}. All rights reserved.
      </p>
    </div>
  );
}

// ─── Maintenance gate — wraps the entire router ────────────────────────────────
// Renders MaintenancePage INSTEAD of the router for non-admin users when
// maintenance mode is enabled. Routes never mount, so no page can be accessed.
function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["public-settings"],
    queryFn: () =>
      fetch("/api/settings/public", { credentials: "include" }).then((r) => r.json()),
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const inMaintenance = settings?.maintenance_mode === "true";
  const isAdmin       = (user as any)?.isAdmin === true;

  // While settings not yet fetched → render normally (fail-open so platform is accessible)
  if (settingsLoading) return <>{children}</>;

  // Not in maintenance → always render normally
  if (!inMaintenance) return <>{children}</>;

  // In maintenance:
  // – While auth is still loading, show maintenance page (safe conservative default)
  // – Once auth resolves, admins bypass, everyone else sees maintenance
  if (authLoading || !isAdmin) {
    return <MaintenancePage settings={settings} />;
  }

  // Admin — full access during maintenance
  return <>{children}</>;
}

// ─── Main App ──────────────────────────────────────────────────────────────────
function AppContent() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <MaintenanceGate>
              <Router />
            </MaintenanceGate>
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function App() {
  const [showSplash, setShowSplash] = useState(SHOW_SPLASH);
  const [contentVisible, setContentVisible] = useState(!SHOW_SPLASH);

  const handleFadeStart = () => setContentVisible(true);
  const handleSplashComplete = () => setShowSplash(false);

  return (
    <ThemeProvider>
      {showSplash && (
        <SplashScreen
          onFadeStart={handleFadeStart}
          onComplete={handleSplashComplete}
        />
      )}
      <div
        style={{
          opacity: contentVisible ? 1 : 0,
          transition: contentVisible && SHOW_SPLASH ? "opacity 0.4s ease-in" : "none",
        }}
      >
        <AppContent />
      </div>
    </ThemeProvider>
  );
}

export default App;
