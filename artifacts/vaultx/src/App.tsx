import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { setBaseUrl } from "@workspace/api-client-react";

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

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
