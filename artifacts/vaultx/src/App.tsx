import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { setBaseUrl } from "@workspace/api-client-react";
import { Wrench } from "lucide-react";

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

setBaseUrl(null);

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
        <ProtectedRoute><KycPage /></ProtectedRoute>
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

      <Route component={NotFound} />
    </Switch>
  );
}

function MaintenanceBanner() {
  const { user, isLoading: authLoading } = useAuth();
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["public-settings"],
    queryFn: () => fetch("/api/settings/public", { credentials: "include" }).then((r) => r.json()),
    staleTime: 30000,
    refetchInterval: 60000,
  });

  if (authLoading || settingsLoading) return null;

  const isAdmin = (user as any)?.isAdmin;
  const inMaintenance = settings?.maintenance_mode === "true";

  if (!inMaintenance || isAdmin) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900 flex flex-col items-center justify-center px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center mb-6">
        <Wrench size={28} className="text-amber-400" />
      </div>
      <h1 className="text-2xl font-bold text-white mb-2">Under Maintenance</h1>
      <p className="text-slate-400 text-sm leading-relaxed max-w-xs">
        We're currently performing scheduled maintenance. Please check back shortly — we'll be up and running again soon.
      </p>
      <p className="mt-6 text-xs text-slate-500">{settings?.platform_name ?? "VaultX"} Team</p>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AuthProvider>
              <Router />
              <MaintenanceBanner />
            </AuthProvider>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
