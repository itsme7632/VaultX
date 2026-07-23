import { useState, useEffect } from "react";
import { Users, DollarSign, FileCheck, ArrowUpRight, ArrowDownLeft, Bell, Search, Check, X, ChevronRight, TrendingUp, Newspaper, Plus, Edit2, Network, Trash2, Settings, FileText, KeyRound, Zap, RefreshCcw, CheckCircle2, AlertCircle, Smartphone, Download, Info, Link2, ExternalLink, Server, RotateCcw, BarChart3, MessageSquare, Send, Activity, RefreshCw, Tag, Lock, Copy, AlertTriangle, Megaphone, Eye, EyeOff, Pin, Calendar, ToggleLeft, ToggleRight, Users2 } from "lucide-react";

function opportunityStatusBadge(status: string) {
  switch (status) {
    case "draft":          return { label: "Draft",          cls: "bg-zinc-50 text-zinc-500 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-400" };
    case "active":         return { label: "Active",         cls: "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400" };
    case "funding":        return { label: "Funding",        cls: "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400" };
    case "featured":       return { label: "⭐ Featured",    cls: "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400" };
    case "trending":       return { label: "🔥 Trending",    cls: "bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400" };
    case "paused":         return { label: "Paused",         cls: "bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400" };
    case "fully_allocated":return { label: "Fully Allocated",cls: "bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400" };
    case "expired":        return { label: "Expired",        cls: "bg-red-50 text-red-500 border-red-200 dark:bg-red-950/30 dark:text-red-400" };
    case "closed":         return { label: "Closed",         cls: "bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400" };
    default:               return { label: status || "Active",cls: "bg-emerald-50 text-emerald-600 border-emerald-200" };
  }
}
import { Switch } from "@/components/ui/switch";
import {
  useAdminGetAnalytics, getAdminGetAnalyticsQueryKey,
  useAdminGetUsers, getAdminGetUsersQueryKey,
  useAdminGetKycSubmissions, getAdminGetKycSubmissionsQueryKey,
  useAdminGetWithdrawals, getAdminGetWithdrawalsQueryKey,
  useAdminApproveKyc, useAdminRejectKyc,
  useAdminRejectWithdrawal,
  useAdminAdjustBalance,
  useAdminBroadcastNotification,
  type AdminGetKycSubmissionsStatus, type AdminGetWithdrawalsStatus,
  type AdminBroadcastBodyType,
} from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePlatformMetrics } from "@/hooks/usePlatformMetrics";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatUSDT, formatUSDTCompact, formatDate, formatDateTime } from "@/lib/format";

type Tab = "analytics" | "users" | "kyc" | "withdrawals" | "deposits" | "plans" | "networks" | "news" | "broadcast" | "settings" | "logs" | "app-settings" | "about" | "statistics" | "tickets" | "content" | "allocation" | "performance" | "faq" | "referral-salary" | "announcements";

async function adminApi(path: string, method = "GET", body?: any) {
  const res = await fetch(`/api${path}`, {
    method, credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    // Guard against HTML error pages (e.g. from Vite fallback or Express)
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.message ?? `Request failed (${res.status})`);
    }
    throw new Error(`Request failed (${res.status})`);
  }
  return res.json();
}

export default function AdminPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("analytics");
  const [search, setSearch] = useState("");
  const [kycFilter, setKycFilter] = useState<AdminGetKycSubmissionsStatus>("pending");
  const [wdFilter, setWdFilter] = useState<AdminGetWithdrawalsStatus>("pending");
  const [depFilter, setDepFilter] = useState<"pending" | "completed" | "failed">("pending");
  const [rejectModal, setRejectModal] = useState<{ type: "kyc" | "wd" | "dep"; id: number } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [adjustModal, setAdjustModal] = useState<{ userId: number; username: string } | null>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [userModal, setUserModal] = useState<any>(null);
  const [planModal, setPlanModal] = useState<any>(null);
  const [networkModal, setNetworkModal] = useState<any>(null);
  const [newsModal, setNewsModal] = useState<any>(null);
  const [proofModal, setProofModal] = useState<string | null>(null);
  const [resetPwModal, setResetPwModal] = useState<{ userId: number; username: string } | null>(null);
  const [resetNewPw, setResetNewPw] = useState("");
  const [broadcastForm, setBroadcastForm] = useState({ title: "", message: "", type: "announcement" as AdminBroadcastBodyType });
  const [communityNotifyForm, setCommunityNotifyForm] = useState({ title: "📢 New Announcement", message: "" });
  const [communityNotifsEnabled, setCommunityNotifsEnabled] = useState<boolean | null>(null);
  const [roiRunning, setRoiRunning] = useState(false);
  const [roiResult, setRoiResult] = useState<{ processed: number; matured: number; skipped: number } | null>(null);
  const [planSearch, setPlanSearch] = useState("");
  const [planStatusFilter, setPlanStatusFilter] = useState<string>("all");
  const [planCategoryFilter, setPlanCategoryFilter] = useState<string>("all");
  const [planSortBy, setPlanSortBy] = useState<string>("minAmount");
  const [wdTxHash, setWdTxHash] = useState("");
  const [userDetail, setUserDetail] = useState<any>(null);
  const [userDetailLoading, setUserDetailLoading] = useState(false);
  const [selectedPlanIds, setSelectedPlanIds] = useState<Set<number>>(new Set());
  const [opportunityAnalyticsMode, setOpportunityAnalyticsMode] = useState<"auto" | "custom" | "real">("auto");
  const [momentumEnabled, setMomentumEnabled] = useState(true);
  const [momentumMode, setMomentumMode] = useState<"real" | "custom">("real");
  const [momentumOverrides, setMomentumOverrides] = useState<Record<string, "high" | "stable" | "cooling" | "">>({});
  const [badgeForm, setBadgeForm] = useState<Record<string, string>>({});
  const [customStatsForm, setCustomStatsForm] = useState<Record<string, any>>({});
  const [savingAnalytics, setSavingAnalytics] = useState(false);
  const [showBadgeManager, setShowBadgeManager] = useState(false);
  const { data: analytics, isLoading: analyticsLoading } = useAdminGetAnalytics({ query: { queryKey: getAdminGetAnalyticsQueryKey(), staleTime: 30000 } });
  const { data: platformMetrics, isLoading: platformMetricsLoading } = usePlatformMetrics();
  const { data: usersData } = useAdminGetUsers({ search: search || undefined, limit: 20 }, { query: { queryKey: getAdminGetUsersQueryKey({ search: search || undefined, limit: 20 }), staleTime: 20000 } });
  const { data: kycData } = useAdminGetKycSubmissions({ status: kycFilter }, { query: { queryKey: getAdminGetKycSubmissionsQueryKey({ status: kycFilter }), staleTime: 20000 } });
  const { data: wdData } = useAdminGetWithdrawals({ status: wdFilter }, { query: { queryKey: getAdminGetWithdrawalsQueryKey({ status: wdFilter }), staleTime: 20000 } });

  const { data: plans } = useQuery({ queryKey: ["admin-plans"], queryFn: () => adminApi("/admin/plans"), staleTime: 30000 });
  const { data: networks } = useQuery({ queryKey: ["admin-networks"], queryFn: () => adminApi("/admin/deposit-networks"), staleTime: 30000 });
  const { data: newsData } = useQuery({ queryKey: ["admin-news"], queryFn: () => adminApi("/admin/news"), staleTime: 30000 });
  const { data: depData, isLoading: depLoading } = useQuery({ queryKey: ["admin-deposits", depFilter], queryFn: () => adminApi(`/admin/deposits?status=${depFilter}`), staleTime: 20000, enabled: tab === "deposits" });
  const { data: settingsData, refetch: refetchSettings } = useQuery({ queryKey: ["admin-settings"], queryFn: () => adminApi("/admin/settings"), staleTime: 30000, enabled: tab === "settings" || tab === "content" || tab === "plans" || tab === "broadcast" });
  const { data: resetLogs } = useQuery({ queryKey: ["admin-reset-logs"], queryFn: () => adminApi("/admin/password-reset-logs"), staleTime: 30000, enabled: tab === "logs" });
  const { data: appSettings, refetch: refetchAppSettings } = useQuery({ queryKey: ["admin-app-settings"], queryFn: () => adminApi("/admin/app-settings"), staleTime: 30000, enabled: tab === "app-settings" });
  const { data: aboutData, refetch: refetchAbout } = useQuery({ queryKey: ["admin-about"], queryFn: () => adminApi("/admin/about"), staleTime: 30000, enabled: tab === "about" });
  const { data: statisticsData, refetch: refetchStatistics } = useQuery({ queryKey: ["admin-statistics"], queryFn: () => adminApi("/admin/statistics"), staleTime: 30000, enabled: tab === "statistics" });
  const { data: ticketsData, refetch: refetchTickets } = useQuery({ queryKey: ["admin-tickets"], queryFn: () => adminApi("/support/tickets"), staleTime: 15000, enabled: tab === "tickets" });
  const { data: salaryData, refetch: refetchSalary } = useQuery({ queryKey: ["admin-salary"], queryFn: () => adminApi("/admin/referral-salary"), staleTime: 30000, enabled: tab === "referral-salary" });
  const { data: salarySettings, refetch: refetchSalarySettings } = useQuery({ queryKey: ["admin-salary-settings"], queryFn: () => adminApi("/admin/settings"), staleTime: 30000, enabled: tab === "referral-salary" });

  const approveKyc = useAdminApproveKyc();
  const rejectKyc = useAdminRejectKyc();
  const approveWd = useMutation({
    mutationFn: ({ id, txHash }: { id: number; txHash: string }) =>
      adminApi(`/admin/withdrawals/${id}/approve`, "POST", { txHash: txHash || null }),
    onSuccess: () => {
      setWdTxHash("");
      queryClient.invalidateQueries({ queryKey: getAdminGetWithdrawalsQueryKey({ status: wdFilter }) });
      queryClient.invalidateQueries({ queryKey: getAdminGetAnalyticsQueryKey() });
      toast({ title: "Withdrawal approved", description: "Transaction processed successfully" });
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });
  const rejectWd = useAdminRejectWithdrawal();
  const adjustBalance = useAdminAdjustBalance();
  const broadcast = useAdminBroadcastNotification();
  const communityNotify = useMutation({
    mutationFn: (data: { title: string; message: string }) =>
      adminApi("/community/admin/notify", "POST", data),
  });

  const approveDep = useMutation({
    mutationFn: (id: number) => adminApi(`/admin/deposits/${id}/approve`, "POST"),
    onSuccess: () => { toast({ title: "Deposit approved", description: "Funds credited to user wallet" }); queryClient.invalidateQueries({ queryKey: ["admin-deposits"] }); queryClient.invalidateQueries({ queryKey: getAdminGetAnalyticsQueryKey() }); },
    onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });
  const rejectDep = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => adminApi(`/admin/deposits/${id}/reject`, "POST", { reason }),
    onSuccess: () => { toast({ title: "Deposit rejected" }); setRejectModal(null); setRejectReason(""); queryClient.invalidateQueries({ queryKey: ["admin-deposits"] }); },
    onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  useEffect(() => {
    if (!settingsData) return;
    const s = settingsData as Record<string, string>;
    setOpportunityAnalyticsMode((s.opportunity_analytics_mode as "auto" | "custom" | "real") ?? "auto");
    setMomentumEnabled(s.momentum_enabled !== "false");
    setMomentumMode((s.momentum_mode as "real" | "custom") ?? "real");
    try { setBadgeForm(JSON.parse(s.opportunity_badges ?? "{}")); } catch { setBadgeForm({}); }
    try { setCustomStatsForm(JSON.parse(s.opportunity_custom_stats ?? "{}")); } catch { setCustomStatsForm({}); }
    try { setMomentumOverrides(JSON.parse(s.momentum_overrides ?? "{}")); } catch { setMomentumOverrides({}); }
    setCommunityNotifsEnabled(s.community_notifications_enabled !== "false");
  }, [settingsData]);

  const saveAnalyticsSettings = async () => {
    setSavingAnalytics(true);
    try {
      await adminApi("/admin/settings", "PUT", {
        opportunity_analytics_mode: opportunityAnalyticsMode,
        opportunity_badges: JSON.stringify(badgeForm),
        opportunity_custom_stats: JSON.stringify(customStatsForm),
        momentum_enabled: String(momentumEnabled),
        momentum_mode: momentumMode,
        momentum_overrides: JSON.stringify(momentumOverrides),
      });
      toast({ title: "Analytics settings saved" });
      refetchSettings();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message, variant: "destructive" });
    } finally {
      setSavingAnalytics(false);
    }
  };

  const savePlan = useMutation({
    mutationFn: (data: any) => planModal?.id ? adminApi(`/admin/plans/${planModal.id}`, "PUT", data) : adminApi("/admin/plans", "POST", data),
    onSuccess: (updatedPlan: any) => {
      toast({ title: "Plan saved" });
      setPlanModal(null);
      // Immediately patch the cache with the fresh plan so the editor shows the
      // saved values if the admin reopens before the background refetch finishes.
      queryClient.setQueryData(["admin-plans"], (old: any) => {
        if (!Array.isArray(old)) return old;
        return old.map((p: any) => p.id === updatedPlan?.id ? updatedPlan : p);
      });
      queryClient.invalidateQueries({ queryKey: ["admin-plans"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const saveNetwork = useMutation({
    mutationFn: (data: any) => networkModal?.id ? adminApi(`/admin/deposit-networks/${networkModal.id}`, "PUT", data) : adminApi("/admin/deposit-networks", "POST", data),
    onSuccess: () => { toast({ title: "Network saved" }); setNetworkModal(null); queryClient.invalidateQueries({ queryKey: ["admin-networks"] }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const saveNews = useMutation({
    mutationFn: (data: any) => newsModal?.id ? adminApi(`/admin/news/${newsModal.id}`, "PUT", data) : adminApi("/admin/news", "POST", data),
    onSuccess: () => { toast({ title: "Post saved" }); setNewsModal(null); queryClient.invalidateQueries({ queryKey: ["admin-news"] }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteNews = useMutation({
    mutationFn: (id: number) => adminApi(`/admin/news/${id}`, "DELETE"),
    onSuccess: () => { toast({ title: "Post deleted" }); queryClient.invalidateQueries({ queryKey: ["admin-news"] }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const reorderPlans = useMutation({
    mutationFn: (ids: number[]) => adminApi("/admin/plans/reorder", "PUT", { ids }),
    onMutate: async (ids: number[]) => {
      await queryClient.cancelQueries({ queryKey: ["admin-plans"] });
      const prev = queryClient.getQueryData(["admin-plans"]);
      const current: any[] = queryClient.getQueryData(["admin-plans"]) ?? [];
      queryClient.setQueryData(["admin-plans"], [...current].sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id)));
      return { prev };
    },
    onError: (_e: any, _v: any, ctx: any) => { queryClient.setQueryData(["admin-plans"], ctx?.prev); toast({ title: "Reorder failed", variant: "destructive" }); },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["admin-plans"] }),
  });

  const quickStatusPlan = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      adminApi(`/admin/plans/${id}`, "PUT", { status, isActive: status === "active" }),
    onSuccess: (_d, v) => { toast({ title: `Opportunity ${v.status}` }); queryClient.invalidateQueries({ queryKey: ["admin-plans"] }); },
    onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const deletePlan = useMutation({
    mutationFn: (id: number) => adminApi(`/admin/plans/${id}`, "DELETE"),
    onSuccess: () => { toast({ title: "Opportunity deleted" }); queryClient.invalidateQueries({ queryKey: ["admin-plans"] }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const duplicatePlan = useMutation({
    mutationFn: (id: number) => adminApi(`/admin/plans/${id}/duplicate`, "POST"),
    onSuccess: () => { toast({ title: "Opportunity duplicated" }); queryClient.invalidateQueries({ queryKey: ["admin-plans"] }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const reset2fa = useMutation({
    mutationFn: (userId: number) => adminApi(`/admin/users/${userId}/reset-2fa`, "POST"),
    onSuccess: () => toast({ title: "2FA reset" }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const resetUserPw = useMutation({
    mutationFn: ({ userId, password }: { userId: number; password: string }) =>
      adminApi(`/admin/users/${userId}/reset-password`, "POST", { password }),
    onSuccess: () => {
      setResetPwModal(null);
      setResetNewPw("");
      toast({ title: "Password reset", description: "New password set successfully" });
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const notifyUser = useMutation({
    mutationFn: ({ userId, title, message }: any) => adminApi(`/admin/users/${userId}/notify`, "POST", { title, message }),
    onSuccess: () => toast({ title: "Notification sent" }),
  });

  const updateUser = useMutation({
    mutationFn: ({ id, ...data }: any) => adminApi(`/admin/users/${id}`, "PUT", data),
    onSuccess: () => { toast({ title: "User updated" }); setUserModal(null); queryClient.invalidateQueries({ queryKey: getAdminGetUsersQueryKey({}) }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleApproveKyc = (id: number) => approveKyc.mutate({ id }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getAdminGetKycSubmissionsQueryKey({ status: kycFilter }) }), onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }) });
  const handleApproveWd = (id: number) => approveWd.mutate({ id, txHash: wdTxHash });
  const handleReject = () => {
    if (!rejectModal) return;
    if (rejectModal.type === "kyc") {
      rejectKyc.mutate({ id: rejectModal.id, data: { reason: rejectReason } }, { onSuccess: () => { setRejectModal(null); setRejectReason(""); queryClient.invalidateQueries({ queryKey: getAdminGetKycSubmissionsQueryKey({ status: kycFilter }) }); }, onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }) });
    } else if (rejectModal.type === "wd") {
      rejectWd.mutate({ id: rejectModal.id, data: { reason: rejectReason } }, { onSuccess: () => { setRejectModal(null); setRejectReason(""); queryClient.invalidateQueries({ queryKey: getAdminGetWithdrawalsQueryKey({ status: wdFilter }) }); }, onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }) });
    } else {
      rejectDep.mutate({ id: rejectModal.id, reason: rejectReason });
    }
  };
  const handleAdjust = () => {
    if (!adjustModal) return;
    adjustBalance.mutate({ id: adjustModal.userId, data: { amount: parseFloat(adjustAmount), reason: adjustReason } }, { onSuccess: () => { setAdjustModal(null); setAdjustAmount(""); setAdjustReason(""); queryClient.invalidateQueries({ queryKey: getAdminGetUsersQueryKey({}) }); }, onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }) });
  };

  const openUserModal = async (u: any) => {
    setUserModal(u);
    setUserDetail(null);
    setUserDetailLoading(true);
    try {
      const detail = await adminApi(`/admin/users/${u.id}`);
      setUserDetail(detail);
    } catch {
      // fallback to list data
    } finally {
      setUserDetailLoading(false);
    }
  };

  const kycEnabledInAdmin = (() => {
    if (!settingsData) return true;
    const s = Array.isArray(settingsData)
      ? settingsData.find((x: any) => x.key === "kyc_enabled")?.value
      : (settingsData as any)?.kyc_enabled;
    return s !== "false";
  })();

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "analytics", label: "Analytics", icon: TrendingUp },
    { id: "users", label: "Users", icon: Users },
    ...(kycEnabledInAdmin ? [{ id: "kyc" as Tab, label: "KYC", icon: FileCheck }] : []),
    { id: "withdrawals", label: "Withdrawals", icon: ArrowUpRight },
    { id: "deposits", label: "Deposits", icon: ArrowDownLeft },
    { id: "plans", label: "Opportunities", icon: TrendingUp },
    { id: "allocation", label: "Allocation", icon: DollarSign },
    { id: "performance", label: "Performance", icon: BarChart3 },
    { id: "networks", label: "Networks", icon: Network },
    { id: "news", label: "News", icon: Newspaper },
    { id: "broadcast", label: "Broadcast", icon: Bell },
    { id: "statistics", label: "Statistics", icon: BarChart3 },
    { id: "tickets", label: "Tickets", icon: MessageSquare },
    { id: "app-settings", label: "App Settings", icon: Smartphone },
    { id: "about", label: "About Us", icon: Info },
    { id: "content", label: "Platform Content", icon: FileText },
    { id: "settings", label: "Settings", icon: Settings },
    { id: "logs", label: "Logs", icon: FileText },
    { id: "faq" as Tab, label: "FAQ", icon: MessageSquare },
    { id: "referral-salary" as Tab, label: "Referral Salary", icon: DollarSign },
    { id: "announcements" as Tab, label: "Announcements", icon: Megaphone },
  ];

  const STAT_CARDS = analytics ? [
    { label: "Total Users", value: analytics.totalUsers, color: "text-primary", bg: "bg-primary/10" },
    { label: "Active Investments", value: formatUSDTCompact(analytics.totalInvestments ?? 0), color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Total Deposits", value: formatUSDTCompact(analytics.totalDeposits), color: "text-amber-500", bg: "bg-amber-50" },
    { label: "Earnings Paid", value: formatUSDTCompact(analytics.totalEarningsPaid), color: "text-purple-500", bg: "bg-purple-50" },
    { label: "Pending KYC", value: analytics.pendingKyc, color: "text-orange-500", bg: "bg-orange-50" },
    { label: "Pending Withdrawals", value: analytics.pendingWithdrawals, color: "text-red-500", bg: "bg-red-50" },
    { label: "Pending Deposits", value: (analytics as any).pendingDeposits ?? 0, color: "text-blue-500", bg: "bg-blue-50" },
    { label: "New Today", value: analytics.newUsersToday, color: "text-teal-500", bg: "bg-teal-50" },
    { label: "Expired Opportunities", value: (analytics as any).expiredOpportunities ?? 0, color: "text-red-500", bg: "bg-red-50" },
    { label: "Fully Allocated", value: (analytics as any).fullyAllocatedOpportunities ?? 0, color: "text-purple-600", bg: "bg-purple-50" },
    { label: "Total Participants", value: ((analytics as any).totalParticipants ?? 0).toLocaleString(), color: "text-teal-600", bg: "bg-teal-50" },
    { label: "Capital Allocated", value: formatUSDTCompact((analytics as any).totalCapitalAllocated ?? 0), color: "text-indigo-500", bg: "bg-indigo-50" },
    { label: "Total Opportunities", value: (analytics as any).totalOpportunities ?? (plans?.length ?? 0), color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Active Opportunities", value: (analytics as any).activeOpportunities ?? (plans?.filter((p: any) => p.status === "active" || p.status === "funding" || p.status === "featured" || p.status === "trending").length ?? 0), color: "text-emerald-600", bg: "bg-emerald-50" },
  ] : [];

  return (
    <AppLayout title="Admin Panel">
      <div className="pb-24">
        {/* Tabs (horizontal scroll) */}
        <div className="flex gap-1 overflow-x-auto px-4 py-3 border-b border-border bg-background sticky top-0 z-10">
          {tabs.map(({ id, label, icon: Icon }) => {
            const badge =
              id === "withdrawals" ? (analytics?.pendingWithdrawals ?? 0) :
              id === "deposits"    ? ((analytics as any)?.pendingDeposits ?? 0) :
              id === "kyc"        ? (analytics?.pendingKyc ?? 0) :
              0;
            return (
              <button key={id} onClick={() => setTab(id)}
                className={cn("relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all", tab === id ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted")}>
                <Icon size={12} />{label}
                {badge > 0 && (
                  <span className={cn(
                    "ml-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center leading-none",
                    tab === id ? "bg-white text-primary" : "bg-red-500 text-white"
                  )}>
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="px-4 pt-4">
          {/* ANALYTICS */}
          {tab === "analytics" && (
            <div className="space-y-4">
              {analyticsLoading ? <div className="grid grid-cols-2 gap-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div> : (
                <div className="grid grid-cols-2 gap-3">
                  {STAT_CARDS.map(({ label, value, color, bg }) => (
                    <div key={label} className="bg-white border border-border rounded-xl p-3.5 shadow-sm">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
                      <p className={cn("text-xl font-bold mt-1", color)}>{value}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Platform Metrics Audit */}
              <div className="bg-white border border-border rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <BarChart3 size={15} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Platform Metrics Audit</p>
                    <p className="text-[11px] text-muted-foreground">Single source of truth — all pages use these values</p>
                  </div>
                </div>
                {platformMetricsLoading ? (
                  <div className="grid grid-cols-2 gap-2">
                    {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="h-12 rounded-xl bg-muted animate-pulse" />)}
                  </div>
                ) : platformMetrics ? (
                  <div className="space-y-0">
                    {[
                      { label: "Total Raised", value: formatUSDTCompact(platformMetrics.totalRaised), sub: `Target: ${formatUSDTCompact(platformMetrics.totalTarget)}` },
                      { label: "Funding %", value: `${platformMetrics.fundingPercentage.toFixed(1)}%`, sub: "Platform-wide average" },
                      { label: "Total Participants", value: platformMetrics.totalParticipants.toLocaleString(), sub: "With display overrides applied" },
                      { label: "Active Opportunities", value: String(platformMetrics.activeOpportunities), sub: "isActive = true" },
                      { label: "Capital Deployed", value: formatUSDTCompact(platformMetrics.capitalDeployed), sub: "= Total Raised" },
                      { label: "Active Investments", value: formatUSDTCompact(platformMetrics.activeInvestments), sub: "Active user investments" },
                      { label: "Distributions Paid", value: formatUSDTCompact(platformMetrics.distributionsPaid), sub: "Earnings + reinvest (completed)" },
                      { label: "Most Popular", value: platformMetrics.mostPopular?.name ?? "—", sub: `${(platformMetrics.mostPopular?.participants ?? 0).toLocaleString()} participants` },
                      { label: "Top Funded", value: platformMetrics.topFunded?.name ?? "—", sub: `${platformMetrics.topFunded?.fundingPct?.toFixed(1) ?? 0}% funded` },
                      { label: "Fastest Growing", value: platformMetrics.fastestGrowing?.name ?? "—", sub: "Highest growth score" },
                    ].map(({ label, value, sub }) => (
                      <div key={label} className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0">
                        <div>
                          <p className="text-xs font-medium text-foreground">{label}</p>
                          <p className="text-[10px] text-muted-foreground">{sub}</p>
                        </div>
                        <p className="text-sm font-bold text-primary tabular-nums">{value}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-4">Failed to load platform metrics</p>
                )}
              </div>

              {/* ROI Payout Trigger */}
              <div className="bg-white border border-border rounded-2xl p-4 shadow-sm space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                    <Zap size={15} className="text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Manual ROI Payout</p>
                    <p className="text-[11px] text-muted-foreground">Force-credit daily distributions on all active investments now</p>
                  </div>
                </div>

                {roiResult && (
                  <div className={cn("rounded-xl px-3.5 py-2.5 flex items-start gap-2.5 text-xs", roiResult.processed > 0 ? "bg-emerald-50 border border-emerald-100" : "bg-slate-50 border border-slate-100")}>
                    {roiResult.processed > 0 ? <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" /> : <AlertCircle size={14} className="text-muted-foreground shrink-0 mt-0.5" />}
                    <div className="space-y-0.5">
                      <p className={cn("font-semibold", roiResult.processed > 0 ? "text-emerald-700" : "text-foreground")}>
                        {roiResult.processed > 0 ? `${roiResult.processed} investment${roiResult.processed !== 1 ? "s" : ""} credited` : "No investments credited"}
                      </p>
                      <p className="text-muted-foreground">
                        {roiResult.matured > 0 && `${roiResult.matured} matured · `}
                        {roiResult.skipped > 0 ? `${roiResult.skipped} already paid today` : "all processed"}
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-10 text-xs font-semibold gap-1.5"
                    disabled={roiRunning}
                    onClick={async () => {
                      setRoiRunning(true);
                      setRoiResult(null);
                      try {
                        const r = await adminApi("/admin/roi/trigger", "POST", { force: false });
                        setRoiResult(r);
                        queryClient.invalidateQueries({ queryKey: getAdminGetAnalyticsQueryKey() });
                      } catch (e: any) {
                        toast({ title: "Error", description: e.message, variant: "destructive" });
                      } finally {
                        setRoiRunning(false);
                      }
                    }}
                  >
                    <RefreshCcw size={13} className={roiRunning ? "animate-spin" : ""} />
                    Normal Run
                  </Button>
                  <Button
                    size="sm"
                    className="h-10 text-xs font-semibold gap-1.5 bg-amber-500 hover:bg-amber-600 text-white"
                    disabled={roiRunning}
                    onClick={async () => {
                      setRoiRunning(true);
                      setRoiResult(null);
                      try {
                        const r = await adminApi("/admin/roi/trigger", "POST", { force: true });
                        setRoiResult(r);
                        queryClient.invalidateQueries({ queryKey: getAdminGetAnalyticsQueryKey() });
                        toast({ title: "ROI Triggered", description: `${r.processed} investment${r.processed !== 1 ? "s" : ""} credited`, });
                      } catch (e: any) {
                        toast({ title: "Error", description: e.message, variant: "destructive" });
                      } finally {
                        setRoiRunning(false);
                      }
                    }}
                  >
                    <Zap size={13} className={roiRunning ? "animate-pulse" : ""} />
                    Force Payout
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  <span className="font-medium">Normal Run</span> — only credits investments that haven't been paid in 24 h.{" "}
                  <span className="font-medium">Force Payout</span> — credits all active investments immediately regardless of last payout time.
                </p>
              </div>
            </div>
          )}

          {/* USERS */}
          {tab === "users" && (
            <div className="space-y-3">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email, or ID..." className="pl-9 h-10" />
              </div>
              <div className="bg-white border border-border rounded-2xl divide-y divide-border shadow-sm overflow-hidden">
                {usersData?.items?.length ? usersData.items.map((u: any) => (
                  <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                      {u.fullName?.charAt(0) ?? "U"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{u.fullName}</p>
                      <p className="text-[10px] text-muted-foreground">@{u.username} · #{u.displayId} · {formatUSDT(u.balance)}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Badge variant="outline" className={cn("text-[9px]", u.kycStatus === "approved" ? "text-emerald-600 bg-emerald-50" : "")}>{u.kycStatus}</Badge>
                      <Badge variant="outline" className={cn("text-[9px]", u.twoFaEnabled ? "text-emerald-600 bg-emerald-50 border-emerald-200" : "text-slate-400")}>2FA</Badge>
                      <Badge variant="outline" className={cn("text-[9px]", u.hasWithdrawalPassword ? "text-emerald-600 bg-emerald-50 border-emerald-200" : "text-slate-400")}>WDP</Badge>
                      <Badge variant="outline" className={cn("text-[9px]", u.withdrawalAddressCount > 0 ? "text-emerald-600 bg-emerald-50 border-emerald-200" : "text-slate-400")}>ADDR</Badge>
                      <button onClick={() => openUserModal(u)} className="p-1.5 rounded-lg hover:bg-muted"><ChevronRight size={13} /></button>
                    </div>
                  </div>
                )) : <div className="py-8 text-center text-sm text-muted-foreground">No users found</div>}
              </div>
            </div>
          )}

          {/* KYC */}
          {tab === "kyc" && (
            <div className="space-y-3">
              <div className="flex gap-2">
                {(["pending", "approved", "rejected"] as AdminGetKycSubmissionsStatus[]).map((s) => (
                  <button key={s} onClick={() => setKycFilter(s)} className={cn("px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-all", kycFilter === s ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>{s}</button>
                ))}
              </div>
              <div className="space-y-3">
                {kycData?.map((sub: any) => (
                  <div key={sub.id} className="bg-white border border-border rounded-2xl p-4 shadow-sm">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-sm text-foreground">{sub.fullName}</p>
                        <p className="text-xs text-muted-foreground">@{sub.username} · {sub.documentType?.replace("_"," ")}</p>
                        {sub.documentNumber && <p className="text-[10px] text-muted-foreground">Doc#: {sub.documentNumber}</p>}
                        {sub.country && <p className="text-[10px] text-muted-foreground">Country: {sub.country}</p>}
                        <p className="text-[10px] text-muted-foreground">{formatDate(sub.submittedAt)}</p>
                      </div>
                      <Badge variant="outline" className={cn("text-xs capitalize", sub.status === "approved" ? "bg-emerald-50 text-emerald-600" : sub.status === "rejected" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600")}>{sub.status}</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 mb-3">
                      {sub.frontImageUrl && <img src={sub.frontImageUrl} alt="Front" className="rounded-lg aspect-[3/2] object-cover border border-border" />}
                      {sub.backImageUrl && <img src={sub.backImageUrl} alt="Back" className="rounded-lg aspect-[3/2] object-cover border border-border" />}
                      {sub.selfieUrl && <img src={sub.selfieUrl} alt="Selfie" className="rounded-lg aspect-[3/2] object-cover border border-border" />}
                    </div>
                    {sub.status === "pending" && (
                      <div className="flex gap-2">
                        <Button size="sm" className="flex-1 h-8 bg-emerald-500 hover:bg-emerald-600 text-xs" onClick={() => handleApproveKyc(sub.id)}><Check size={13} className="mr-1" />Approve</Button>
                        <Button size="sm" variant="outline" className="flex-1 h-8 text-xs border-red-300 text-red-600 hover:bg-red-50" onClick={() => { setRejectModal({ type: "kyc", id: sub.id }); setRejectReason(""); }}><X size={13} className="mr-1" />Reject</Button>
                      </div>
                    )}
                  </div>
                ))}
                {!kycData?.length && <div className="py-8 text-center text-sm text-muted-foreground bg-white border border-border rounded-2xl">No {kycFilter} KYC submissions</div>}
              </div>
            </div>
          )}

          {/* WITHDRAWALS */}
          {tab === "withdrawals" && (
            <div className="space-y-3">
              <div className="flex gap-2">
                {(["pending", "completed", "failed"] as AdminGetWithdrawalsStatus[]).map((s) => (
                  <button key={s} onClick={() => setWdFilter(s)} className={cn("px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-all", wdFilter === s ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>{s}</button>
                ))}
              </div>
              <div className="space-y-3">
                {wdData?.map((wd: any) => (
                  <div key={wd.id} className="bg-white border border-border rounded-2xl p-4 shadow-sm">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-sm">@{wd.username} <span className="text-muted-foreground font-normal text-xs">#{wd.displayId}</span></p>
                        <p className="text-xs text-muted-foreground">{formatDateTime(wd.createdAt)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-red-600">{formatUSDT(wd.amount)}</p>
                        {wd.fee > 0 && <p className="text-[10px] text-muted-foreground">Fee: {formatUSDT(wd.fee)}</p>}
                      </div>
                    </div>
                    {wd.txId && <p className="text-[10px] font-mono text-primary/70 mb-1">{wd.txId}</p>}
                    <p className="text-xs text-muted-foreground font-medium mb-0.5">{wd.network}</p>
                    <p className="text-xs font-mono text-foreground break-all bg-muted/50 rounded-lg px-2 py-1 mb-2">{wd.address}</p>
                    {wd.status === "pending" && (
                      <div className="space-y-2">
                        <Input value={wdTxHash} onChange={(e) => setWdTxHash(e.target.value)} placeholder="TX hash (optional)" className="h-8 text-xs font-mono" />
                        <div className="flex gap-2">
                          <Button size="sm" className="flex-1 h-8 bg-emerald-500 hover:bg-emerald-600 text-xs" onClick={() => handleApproveWd(wd.id)}><Check size={13} className="mr-1" />Approve</Button>
                          <Button size="sm" variant="outline" className="flex-1 h-8 text-xs border-red-300 text-red-600 hover:bg-red-50" onClick={() => { setRejectModal({ type: "wd", id: wd.id }); setRejectReason(""); }}><X size={13} className="mr-1" />Reject</Button>
                        </div>
                      </div>
                    )}
                    {wd.status !== "pending" && <Badge variant="outline" className={cn("text-xs capitalize", wd.status === "completed" ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600")}>{wd.status}</Badge>}
                  </div>
                ))}
                {!wdData?.length && <div className="py-8 text-center text-sm text-muted-foreground bg-white border border-border rounded-2xl">No {wdFilter} withdrawals</div>}
              </div>
            </div>
          )}

          {/* DEPOSITS */}
          {tab === "deposits" && (
            <div className="space-y-3">
              <div className="flex gap-2">
                {(["pending", "completed", "failed"] as const).map((s) => (
                  <button key={s} onClick={() => setDepFilter(s)} className={cn("px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-all", depFilter === s ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>{s}</button>
                ))}
              </div>
              {depLoading ? (
                <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-36 rounded-2xl" />)}</div>
              ) : (
                <div className="space-y-3">
                  {(depData ?? []).map((dep: any) => (
                    <div key={dep.id} className="bg-white border border-border rounded-2xl p-4 shadow-sm">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold text-sm">@{dep.username} <span className="text-muted-foreground font-normal text-xs">#{dep.displayId}</span></p>
                          <p className="text-xs text-muted-foreground">{formatDateTime(dep.createdAt)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-emerald-600">{formatUSDT(dep.amount)}</p>
                          <Badge variant="outline" className={cn("text-[9px] mt-1", dep.status === "completed" ? "bg-emerald-50 text-emerald-600" : dep.status === "failed" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600")}>{dep.status}</Badge>
                        </div>
                      </div>
                      {dep.txId && <p className="text-[10px] font-mono text-primary/70 mb-1">{dep.txId}</p>}
                      {dep.network && <p className="text-xs text-muted-foreground mb-1">Network: <span className="font-medium text-foreground">{dep.network}</span></p>}
                      {dep.txHash && <p className="text-xs font-mono text-muted-foreground break-all bg-muted/50 rounded px-2 py-1 mb-2">TX: {dep.txHash}</p>}
                      {dep.proofImageUrl && (
                        <button onClick={() => setProofModal(dep.proofImageUrl)} className="block mb-2">
                          <img src={dep.proofImageUrl} alt="Proof" className="rounded-xl max-h-28 border border-border object-contain" />
                          <p className="text-[10px] text-primary mt-1">Tap to enlarge</p>
                        </button>
                      )}
                      {!dep.proofImageUrl && <p className="text-[10px] text-muted-foreground mb-2 italic">No proof image submitted</p>}
                      {dep.status === "pending" && (
                        <div className="flex gap-2 mt-2">
                          <Button size="sm" className="flex-1 h-8 bg-emerald-500 hover:bg-emerald-600 text-xs" onClick={() => approveDep.mutate(dep.id)} disabled={approveDep.isPending}><Check size={13} className="mr-1" />Approve</Button>
                          <Button size="sm" variant="outline" className="flex-1 h-8 text-xs border-red-300 text-red-600 hover:bg-red-50" onClick={() => { setRejectModal({ type: "dep", id: dep.id }); setRejectReason(""); }}><X size={13} className="mr-1" />Reject</Button>
                        </div>
                      )}
                    </div>
                  ))}
                  {!(depData ?? []).length && <div className="py-8 text-center text-sm text-muted-foreground bg-white border border-border rounded-2xl">No {depFilter} deposits</div>}
                </div>
              )}
            </div>
          )}

          {/* OPPORTUNITIES (Plans) */}
          {tab === "plans" && (
            <div className="space-y-3">
              {/* Analytics & Badge Manager */}
              <div className="bg-white dark:bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
                  onClick={() => setShowBadgeManager(v => !v)}
                >
                  <div className="flex items-center gap-2">
                    <BarChart3 size={14} className="text-primary" />
                    <p className="text-sm font-semibold text-foreground">Analytics & Badge Controls</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{showBadgeManager ? "▲ collapse" : "▼ expand"}</span>
                </button>

                {showBadgeManager && (
                  <div className="px-4 pb-4 space-y-4 border-t border-border pt-3">
                    {/* Use Real Platform Statistics — primary toggle */}
                    <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-foreground">Use Real Platform Statistics</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {opportunityAnalyticsMode === "real"
                              ? "✅ Showing actual database values — funding, raised, participants."
                              : "Showing intelligent demo statistics."}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setOpportunityAnalyticsMode(opportunityAnalyticsMode === "real" ? "auto" : "real")}
                          className={cn(
                            "relative w-11 h-6 rounded-full transition-colors shrink-0",
                            opportunityAnalyticsMode === "real" ? "bg-emerald-500" : "bg-muted-foreground/30"
                          )}
                        >
                          <span className={cn("absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all", opportunityAnalyticsMode === "real" ? "left-[26px]" : "left-1")} />
                        </button>
                      </div>
                    </div>

                    {/* Analytics Mode */}
                    <div>
                      <p className="text-xs font-semibold text-foreground mb-2">Advanced Analytics Mode</p>
                      <div className="flex gap-2">
                        {(["real", "auto", "custom"] as const).map(m => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setOpportunityAnalyticsMode(m)}
                            className={cn(
                              "flex-1 py-2 rounded-xl text-xs font-semibold border transition-all",
                              opportunityAnalyticsMode === m
                                ? "bg-primary text-white border-primary"
                                : "bg-muted text-muted-foreground border-border hover:border-primary/50"
                            )}
                          >
                            {m === "real" ? "📊 Real DB" : m === "auto" ? "🤖 Demo" : "✏️ Custom"}
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1.5">
                        {opportunityAnalyticsMode === "real"
                          ? "Uses actual database values. Participants auto-generated from raised amount when empty."
                          : opportunityAnalyticsMode === "auto"
                          ? "Intelligent demo statistics generated from seeded algorithms."
                          : "Manually set custom participant counts and funding data per opportunity."}
                      </p>
                    </div>

                    {/* Badge Overrides */}
                    <div>
                      <p className="text-xs font-semibold text-foreground mb-2">Badge Overrides <span className="text-[10px] font-normal text-muted-foreground">(leave as Auto to use algorithm)</span></p>
                      <div className="space-y-2">
                        {(plans ?? []).map((plan: any) => (
                          <div key={plan.id} className="flex items-center justify-between gap-3">
                            <p className="text-xs text-foreground truncate flex-1">{plan.name}</p>
                            <Select
                              value={badgeForm[String(plan.id)] ?? "auto"}
                              onValueChange={v => setBadgeForm(f => ({ ...f, [String(plan.id)]: v === "auto" ? "" : v }))}
                            >
                              <SelectTrigger className="h-8 w-36 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="auto" className="text-xs">Auto</SelectItem>
                                <SelectItem value="trending" className="text-xs">🔥 Trending</SelectItem>
                                <SelectItem value="popular" className="text-xs">⭐ Popular</SelectItem>
                                <SelectItem value="fast-growing" className="text-xs">🚀 Fast Growing</SelectItem>
                                <SelectItem value="top-funded" className="text-xs">🏆 Top Funded</SelectItem>
                                <SelectItem value="none" className="text-xs">None</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Custom Stats (visible when mode=custom) */}
                    {opportunityAnalyticsMode === "custom" && (
                      <div>
                        <p className="text-xs font-semibold text-foreground mb-2">Custom Stats per Opportunity</p>
                        <div className="space-y-3">
                          {(plans ?? []).map((plan: any) => {
                            const cs = customStatsForm[String(plan.id)] ?? {};
                            const upd = (key: string, val: string) =>
                              setCustomStatsForm(f => ({ ...f, [String(plan.id)]: { ...(f[String(plan.id)] ?? {}), [key]: val ? Number(val) : undefined } }));
                            return (
                              <div key={plan.id} className="border border-border rounded-xl p-3 space-y-2">
                                <p className="text-[11px] font-semibold text-foreground">{plan.name}</p>
                                <div className="grid grid-cols-2 gap-2">
                                  {[
                                    { key: "participants",   label: "Participants",     placeholder: "250" },
                                    { key: "raisedPct",     label: "Raised %",         placeholder: "72" },
                                    { key: "capitalTargetK", label: "Target (K USDT)", placeholder: "120" },
                                    { key: "joinedToday",   label: "Joined Today",     placeholder: "15" },
                                    { key: "joinedWeek",    label: "Joined This Week", placeholder: "58" },
                                  ].map(({ key, label, placeholder }) => (
                                    <div key={key}>
                                      <p className="text-[9px] text-muted-foreground mb-0.5">{label}</p>
                                      <Input
                                        type="number"
                                        className="h-7 text-xs"
                                        placeholder={placeholder}
                                        value={cs[key] ?? ""}
                                        onChange={e => upd(key, e.target.value)}
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* ── Momentum Indicator Settings ── */}
                    <div className="border-t border-border pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold text-foreground">Momentum Indicators</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">Show 🔥 / ⭐ / ⚠ badges on opportunity cards</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setMomentumEnabled(e => !e)}
                          className={cn(
                            "relative w-10 h-5 rounded-full transition-colors shrink-0",
                            momentumEnabled ? "bg-primary" : "bg-muted-foreground/30"
                          )}
                        >
                          <span className={cn("absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all", momentumEnabled ? "left-[22px]" : "left-0.5")} />
                        </button>
                      </div>

                      {momentumEnabled && (
                        <>
                          <div>
                            <p className="text-xs font-semibold text-foreground mb-2">Indicator Mode</p>
                            <div className="flex gap-2">
                              {(["real", "custom"] as const).map(m => (
                                <button
                                  key={m}
                                  type="button"
                                  onClick={() => setMomentumMode(m)}
                                  className={cn(
                                    "flex-1 py-2 rounded-xl text-xs font-semibold border transition-all",
                                    momentumMode === m
                                      ? "bg-primary text-white border-primary"
                                      : "bg-muted text-muted-foreground border-border hover:border-primary/50"
                                  )}
                                >
                                  {m === "real" ? "📊 Real Data" : "✏️ Custom"}
                                </button>
                              ))}
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-1.5">
                              {momentumMode === "real"
                                ? "Auto-computed from funding %: 0-25% Stable → 26-50% Growing → 51-75% High → 76-100% Trending."
                                : "Manually set momentum level per opportunity."}
                            </p>
                          </div>

                          {momentumMode === "custom" && (
                            <div>
                              <p className="text-xs font-semibold text-foreground mb-2">Per-Opportunity Momentum</p>
                              <div className="space-y-2">
                                {(plans ?? []).map((plan: any) => (
                                  <div key={plan.id} className="flex items-center justify-between gap-3">
                                    <p className="text-xs text-foreground truncate flex-1">{plan.name}</p>
                                    <Select
                                      value={momentumOverrides[String(plan.id)] || "auto"}
                                      onValueChange={v =>
                                        setMomentumOverrides(prev => ({ ...prev, [String(plan.id)]: v === "auto" ? "" : v as any }))
                                      }
                                    >
                                      <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="auto" className="text-xs">Auto (Real Data)</SelectItem>
                                        <SelectItem value="high" className="text-xs">🔥 High Momentum</SelectItem>
                                        <SelectItem value="stable" className="text-xs">⭐ Stable Demand</SelectItem>
                                        <SelectItem value="cooling" className="text-xs">⚠ Cooling Down</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    <Button
                      className="w-full h-9 text-sm"
                      onClick={saveAnalyticsSettings}
                      disabled={savingAnalytics}
                    >
                      {savingAnalytics ? "Saving..." : "Save Analytics Settings"}
                    </Button>
                  </div>
                )}
              </div>

              {/* Search / Filter / Sort bar */}
              <div className="bg-white dark:bg-card border border-border rounded-2xl p-3 space-y-2">
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={planSearch}
                    onChange={(e) => setPlanSearch(e.target.value)}
                    placeholder="Search opportunities…"
                    className="w-full pl-8 pr-3 h-9 text-sm rounded-xl border border-border bg-muted/30 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Select value={planStatusFilter} onValueChange={setPlanStatusFilter}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      {["all","draft","active","funding","featured","trending","paused","fully_allocated","expired","closed"].map(s => (
                        <SelectItem key={s} value={s} className="text-xs capitalize">{s === "all" ? "All Statuses" : s.replace("_", " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={planCategoryFilter} onValueChange={setPlanCategoryFilter}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Category" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">All Categories</SelectItem>
                      {[...new Set((plans ?? []).map((p: any) => p.category).filter(Boolean))].map((cat: any) => (
                        <SelectItem key={cat} value={cat} className="text-xs">{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={planSortBy} onValueChange={setPlanSortBy}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Sort" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minAmount" className="text-xs">Min Amount ↑</SelectItem>
                      <SelectItem value="sortOrder" className="text-xs">Sort Order</SelectItem>
                      <SelectItem value="name" className="text-xs">Name A→Z</SelectItem>
                      <SelectItem value="capitalRaised" className="text-xs">Capital Raised ↓</SelectItem>
                      <SelectItem value="participants" className="text-xs">Participants ↓</SelectItem>
                      <SelectItem value="endDate" className="text-xs">Expiry Date ↑</SelectItem>
                      <SelectItem value="createdAt" className="text-xs">Newest First</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-2">
                <Button className="flex-1 h-10 text-sm" onClick={() => setPlanModal({ name: "", description: "", category: "", minAmount: "", maxAmount: "", minRoiRate: 0.013, maxRoiRate: 0.017, durationDays: 30, features: [], isActive: true, isFeatured: false, isPopular: false, status: "active", colorTheme: "blue", sortOrder: 0, autoCompoundAvailable: false, fundingGoal: null, currentFunding: 0, totalParticipantLimit: null })}>
                  <Plus size={15} className="mr-1.5" />Add Opportunity
                </Button>
                {plans?.length > 0 && (
                  <Button variant="outline" size="sm" className="h-10 text-xs px-3" onClick={() => {
                    if (selectedPlanIds.size === plans.length) setSelectedPlanIds(new Set());
                    else setSelectedPlanIds(new Set((plans ?? []).map((p: any) => p.id)));
                  }}>
                    {selectedPlanIds.size === plans?.length ? "Deselect All" : "Select All"}
                  </Button>
                )}
              </div>

              {/* Bulk action bar */}
              {selectedPlanIds.size > 0 && (
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-primary mr-1">{selectedPlanIds.size} selected</span>
                  {(["active", "paused", "closed", "fully_allocated"] as const).map((s) => {
                    const label: Record<string, string> = { active: "▶ Reopen All", paused: "⏸ Pause All", closed: "✕ Close All", fully_allocated: "⬛ Full All" };
                    return (
                      <button key={s} onClick={async () => {
                        for (const id of selectedPlanIds) await adminApi(`/admin/plans/${id}`, "PUT", { status: s, isActive: s === "active" });
                        queryClient.invalidateQueries({ queryKey: ["admin-plans"] });
                        setSelectedPlanIds(new Set());
                        toast({ title: `${selectedPlanIds.size} opportunities set to ${s}` });
                      }} className="px-2.5 py-1 rounded-lg bg-white border border-border text-[10px] font-semibold hover:bg-muted">{label[s]}</button>
                    );
                  })}
                  <button onClick={() => setSelectedPlanIds(new Set())} className="ml-auto text-[10px] text-muted-foreground hover:text-foreground">✕ Clear</button>
                </div>
              )}

              <div className="space-y-3">
                {(() => {
                  let filtered: any[] = plans ?? [];
                  if (planSearch.trim()) {
                    const q = planSearch.toLowerCase();
                    filtered = filtered.filter((p: any) =>
                      p.name?.toLowerCase().includes(q) ||
                      p.description?.toLowerCase().includes(q) ||
                      p.category?.toLowerCase().includes(q)
                    );
                  }
                  if (planStatusFilter !== "all") {
                    filtered = filtered.filter((p: any) => (p.status ?? "active") === planStatusFilter);
                  }
                  if (planCategoryFilter !== "all") {
                    filtered = filtered.filter((p: any) => p.category === planCategoryFilter);
                  }
                  filtered = [...filtered].sort((a: any, b: any) => {
                    switch (planSortBy) {
                      case "minAmount": return parseFloat(a.minAmount ?? 0) - parseFloat(b.minAmount ?? 0);
                      case "name": return (a.name ?? "").localeCompare(b.name ?? "");
                      case "capitalRaised": return (b.capitalRaised ?? 0) - (a.capitalRaised ?? 0);
                      case "participants": return (b.totalParticipants ?? 0) - (a.totalParticipants ?? 0);
                      case "endDate": return (a.endDate ? new Date(a.endDate).getTime() : Infinity) - (b.endDate ? new Date(b.endDate).getTime() : Infinity);
                      case "createdAt": return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
                      default: return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
                    }
                  });
                  if (filtered.length === 0) {
                    return <p className="text-center text-sm text-muted-foreground py-8">No opportunities match your filters.</p>;
                  }
                  return filtered.map((plan: any) => {
                  const sb = opportunityStatusBadge(plan.status ?? (plan.isActive ? "active" : "paused"));
                  const isSelected = selectedPlanIds.has(plan.id);
                  return (
                    <div key={plan.id} className={cn("bg-white dark:bg-card border rounded-2xl p-4 shadow-sm transition-colors", isSelected ? "border-primary bg-primary/5 dark:bg-primary/10" : "border-border")}>
                      <div className="flex items-start justify-between">
                        <button onClick={() => setSelectedPlanIds((prev) => { const next = new Set(prev); if (next.has(plan.id)) next.delete(plan.id); else next.add(plan.id); return next; })} className={cn("w-4 h-4 rounded border-2 shrink-0 mt-0.5 mr-2 flex items-center justify-center", isSelected ? "bg-primary border-primary" : "border-muted-foreground/40 hover:border-primary")}>
                          {isSelected && <span className="text-white text-[9px] font-bold leading-none">✓</span>}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-sm">{plan.name}</p>
                            <Badge variant="outline" className={cn("text-[9px]", sb.cls)}>{sb.label}</Badge>
                            {plan.category && <Badge variant="outline" className="text-[9px] text-blue-600 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400">{plan.category}</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{plan.description}</p>
                          <p className="text-xs text-primary font-semibold mt-1">
                            {(plan.minRoiRate * 100).toFixed(1)}%–{(plan.maxRoiRate * 100).toFixed(1)}% daily · {plan.durationDays}d · {formatUSDT(plan.minAmount)}–{formatUSDT(plan.maxAmount)}
                          </p>
                          <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                            {(plan.totalParticipants ?? 0) > 0 && <span>👥 {Number(plan.totalParticipants).toLocaleString()} participants</span>}
                            {plan.totalParticipantLimit && <span>/ {Number(plan.totalParticipantLimit).toLocaleString()} max</span>}
                            {(plan.capitalRaised ?? 0) > 0 && <span>💰 {plan.capitalRaised >= 1000 ? `$${(plan.capitalRaised/1000).toFixed(0)}K` : `$${Number(plan.capitalRaised).toFixed(0)}`} raised</span>}
                            {plan.fundingPercent !== null && plan.fundingPercent !== undefined && <span>📊 {plan.fundingPercent}% funded</span>}
                            {plan.remainingCapacity !== null && plan.remainingCapacity !== undefined && <span>🎯 {plan.remainingCapacity >= 1000 ? `$${(plan.remainingCapacity/1000).toFixed(0)}K` : `$${Number(plan.remainingCapacity).toFixed(0)}`} remaining</span>}
                            {plan.endDate && <span>⏰ Ends {new Date(plan.endDate).toLocaleDateString()}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-2 shrink-0">
                          {(() => {
                            const allIds: number[] = (plans ?? []).map((p: any) => p.id);
                            const idx = allIds.indexOf(plan.id);
                            const moveUp = () => { const ids = [...allIds]; [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]]; reorderPlans.mutate(ids); };
                            const moveDown = () => { const ids = [...allIds]; [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]]; reorderPlans.mutate(ids); };
                            return (
                              <>
                                <button onClick={moveUp} disabled={idx === 0} className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30" title="Move up">▲</button>
                                <button onClick={moveDown} disabled={idx === allIds.length - 1} className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30" title="Move down">▼</button>
                              </>
                            );
                          })()}
                          <button onClick={() => duplicatePlan.mutate(plan.id)} className="p-1.5 rounded-lg hover:bg-muted" title="Duplicate"><Copy size={13} className="text-blue-500" /></button>
                          <button onClick={() => setPlanModal({ ...plan })} className="p-1.5 rounded-lg hover:bg-muted" title="Edit"><Edit2 size={13} className="text-muted-foreground" /></button>
                          <button onClick={() => { if (confirm(`Delete "${plan.name}"? This cannot be undone.`)) deletePlan.mutate(plan.id); }} className="p-1.5 rounded-lg hover:bg-red-50" title="Delete"><Trash2 size={13} className="text-red-500" /></button>
                        </div>
                      </div>
                      {/* Quick status row */}
                      <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-border flex-wrap">
                        {plan.status !== "active" && (
                          <button onClick={() => quickStatusPlan.mutate({ id: plan.id, status: "active" })} className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-semibold hover:bg-emerald-100">▶ Reopen</button>
                        )}
                        {plan.status !== "paused" && (
                          <button onClick={() => quickStatusPlan.mutate({ id: plan.id, status: "paused" })} className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-[10px] font-semibold hover:bg-gray-200">⏸ Pause</button>
                        )}
                        {plan.status !== "closed" && (
                          <button onClick={() => { if (confirm(`Close "${plan.name}"? Users won't be able to participate.`)) quickStatusPlan.mutate({ id: plan.id, status: "closed" }); }} className="px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-[10px] font-semibold hover:bg-red-100">✕ Close</button>
                        )}
                        {plan.status !== "fully_allocated" && (
                          <button onClick={() => quickStatusPlan.mutate({ id: plan.id, status: "fully_allocated" })} className="px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 text-[10px] font-semibold hover:bg-purple-100">⬛ Full</button>
                        )}
                        <span className="ml-auto text-[9px] text-muted-foreground">Sort: {plan.sortOrder ?? 0}</span>
                      </div>
                    </div>
                  );
                  });
                })()}
              </div>
            </div>
          )}

          {/* DEPOSIT NETWORKS */}
          {tab === "networks" && (
            <div className="space-y-3">
              <Button className="w-full h-10 text-sm" onClick={() => setNetworkModal({ network: "", label: "", walletAddress: "", minDeposit: 10, networkFee: 1, confirmationTime: "10-30 minutes", isActive: true })}>
                <Plus size={15} className="mr-1.5" />Add Network
              </Button>
              <div className="space-y-3">
                {networks?.map((net: any) => (
                  <div key={net.id} className="bg-white border border-border rounded-2xl p-4 shadow-sm">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-bold text-sm">{net.label}</p>
                        <p className="text-[10px] text-muted-foreground">Min: {formatUSDT(net.minDeposit)} · Fee: {formatUSDT(net.networkFee)} · {net.confirmationTime}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className={cn("text-[9px]", net.isActive ? "text-emerald-600 bg-emerald-50" : "")}>{net.isActive ? "Active" : "Disabled"}</Badge>
                        <button onClick={() => setNetworkModal({ ...net })} className="p-1.5 rounded-lg hover:bg-muted"><Edit2 size={13} /></button>
                      </div>
                    </div>
                    <p className="text-xs font-mono text-foreground bg-muted/50 rounded-lg px-2 py-1 break-all">{net.walletAddress}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* NEWS */}
          {tab === "news" && (
            <div className="space-y-3">
              <Button className="w-full h-10 text-sm" onClick={() => setNewsModal({ title: "", content: "", excerpt: "", category: "announcement", isPublished: false, isFeatured: false })}>
                <Plus size={15} className="mr-1.5" />New Post
              </Button>
              <div className="space-y-3">
                {newsData?.map((post: any) => (
                  <div key={post.id} className="bg-white border border-border rounded-2xl p-4 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{post.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{post.excerpt}</p>
                        <div className="flex gap-1.5 mt-1.5">
                          <Badge variant="outline" className="text-[9px] capitalize">{post.category}</Badge>
                          <Badge variant="outline" className={cn("text-[9px]", post.isPublished ? "text-emerald-600 bg-emerald-50" : "")}>{post.isPublished ? "Published" : "Draft"}</Badge>
                          {post.isFeatured && <Badge variant="outline" className="text-[9px] text-amber-600 bg-amber-50">Featured</Badge>}
                        </div>
                      </div>
                      <div className="flex gap-1 ml-2 shrink-0">
                        <button onClick={() => setNewsModal({ ...post })} className="p-2 rounded-lg hover:bg-muted"><Edit2 size={14} /></button>
                        <button onClick={() => { if (confirm("Delete this post?")) deleteNews.mutate(post.id); }} className="p-2 rounded-lg hover:bg-red-50"><Trash2 size={14} className="text-red-500" /></button>
                      </div>
                    </div>
                  </div>
                ))}
                {!newsData?.length && <div className="py-8 text-center text-sm text-muted-foreground bg-white border border-border rounded-2xl">No news posts yet</div>}
              </div>
            </div>
          )}

          {/* BROADCAST */}
          {tab === "broadcast" && (
            <div className="space-y-4">
              {/* General Broadcast */}
              <div className="bg-white dark:bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3">
                <h3 className="font-semibold text-sm">Broadcast Notification</h3>
                <div>
                  <Label className="text-xs">Type</Label>
                  <Select value={broadcastForm.type} onValueChange={(v) => setBroadcastForm(f => ({ ...f, type: v as AdminBroadcastBodyType }))}>
                    <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["announcement", "security", "earning", "transaction", "referral"].map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Title</Label>
                  <Input value={broadcastForm.title} onChange={(e) => setBroadcastForm(f => ({ ...f, title: e.target.value }))} className="mt-1 h-9 text-sm" placeholder="Notification title" />
                </div>
                <div>
                  <Label className="text-xs">Message</Label>
                  <Textarea value={broadcastForm.message} onChange={(e) => setBroadcastForm(f => ({ ...f, message: e.target.value }))} className="mt-1 text-sm min-h-[80px] resize-none" placeholder="Message content..." />
                </div>
                <Button className="w-full h-10 text-sm" onClick={() => broadcast.mutate({ data: broadcastForm }, { onSuccess: (r: any) => { toast({ title: "Broadcast sent!", description: `Sent to ${r.sentTo} users` }); setBroadcastForm({ title: "", message: "", type: "announcement" }); }, onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }) })} disabled={broadcast.isPending || !broadcastForm.title || !broadcastForm.message}>
                  {broadcast.isPending ? "Sending..." : "Send to All Users"}
                </Button>
              </div>

              {/* Community Announcement Notifications */}
              <div className="bg-white dark:bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-sm">Community Announcement Notifications</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Notify all members when an announcement is posted</p>
                  </div>
                  <Switch
                    checked={communityNotifsEnabled ?? true}
                    onCheckedChange={async (v) => {
                      setCommunityNotifsEnabled(v);
                      try {
                        await adminApi("/admin/settings", "PUT", { community_notifications_enabled: v ? "true" : "false" });
                        toast({ title: v ? "Notifications enabled" : "Notifications disabled" });
                      } catch {
                        setCommunityNotifsEnabled(!v);
                        toast({ title: "Error", description: "Could not update setting", variant: "destructive" });
                      }
                    }}
                  />
                </div>
                <div className="border-t border-border pt-3 space-y-3">
                  <p className="text-[11px] text-muted-foreground">Send a standalone notification blast to all active users without posting a message to the channel.</p>
                  <div>
                    <Label className="text-xs">Title</Label>
                    <Input
                      value={communityNotifyForm.title}
                      onChange={(e) => setCommunityNotifyForm(f => ({ ...f, title: e.target.value }))}
                      className="mt-1 h-9 text-sm"
                      placeholder="📢 New Announcement"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Message</Label>
                    <Textarea
                      value={communityNotifyForm.message}
                      onChange={(e) => setCommunityNotifyForm(f => ({ ...f, message: e.target.value }))}
                      className="mt-1 text-sm min-h-[70px] resize-none"
                      placeholder="Message to send to all users..."
                    />
                  </div>
                  <Button
                    className="w-full h-10 text-sm"
                    variant="outline"
                    onClick={() =>
                      communityNotify.mutate(communityNotifyForm, {
                        onSuccess: (r: any) => {
                          toast({ title: "Notification blast sent!", description: `Sent to ${r.sentTo} users` });
                          setCommunityNotifyForm({ title: "📢 New Announcement", message: "" });
                        },
                        onError: (e: any) => toast({ title: "Error", description: e?.message ?? "Failed to send", variant: "destructive" }),
                      })
                    }
                    disabled={communityNotify.isPending || !communityNotifyForm.message.trim()}
                  >
                    {communityNotify.isPending ? "Sending…" : "Send Notification Blast"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* SETTINGS */}
          {tab === "app-settings" && (
            <AppSettingsTab settings={appSettings} onRefresh={refetchAppSettings} toast={toast} />
          )}

          {tab === "about" && (
            <AboutTab data={aboutData} onRefresh={refetchAbout} toast={toast} />
          )}

          {tab === "statistics" && (
            <StatisticsTab data={statisticsData} onRefresh={refetchStatistics} toast={toast} />
          )}

          {tab === "tickets" && (
            <TicketsTab data={ticketsData} onRefresh={refetchTickets} toast={toast} />
          )}

          {tab === "content" && (
            <ContentTab settingsData={settingsData} onRefresh={refetchSettings} toast={toast} />
          )}

          {tab === "settings" && (
            <SettingsTab settingsData={settingsData} toast={toast} />
          )}

          {/* CAPITAL ALLOCATION */}
          {tab === "allocation" && (
            <div className="space-y-3">
              <div className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-2">
                <p className="font-semibold text-sm text-foreground">Capital Allocation Editor</p>
                <p className="text-xs text-muted-foreground">Edit allocation percentages directly on the Capital Allocation page (accessible from Dashboard or More menu). Changes are saved to platform settings and visible to all users.</p>
                <a href="/capital-allocation" className="block">
                  <Button className="w-full h-10 text-sm mt-2">Open Capital Allocation Page →</Button>
                </a>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4">
                <p className="text-xs text-amber-700 dark:text-amber-400 font-medium mb-1">How it works</p>
                <p className="text-xs text-amber-700/80 dark:text-amber-400/80">Allocation percentages must sum to 100%. Admin users see an edit button on the Capital Allocation page to update each sector weight. Changes are stored as platform settings and loaded by all users.</p>
              </div>
              <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
                <p className="font-semibold text-xs text-foreground mb-3">Default Allocations</p>
                <div className="space-y-2">
                  {[
                    { label: "Digital Assets", pct: 35 },
                    { label: "Technology Infrastructure", pct: 25 },
                    { label: "AI Development", pct: 20 },
                    { label: "Strategic Growth", pct: 15 },
                    { label: "Reserve Fund", pct: 5 },
                  ].map(({ label, pct }) => (
                    <div key={label} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-bold text-primary">{pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* FAQ */}
          {tab === "faq" && (
            <FaqTab toast={toast} />
          )}

          {/* ANNOUNCEMENTS */}
          {tab === "announcements" && (
            <AnnouncementsTab toast={toast} />
          )}

          {/* PERFORMANCE ADMIN */}
          {/* REFERRAL SALARY */}
          {tab === "referral-salary" && (
            <ReferralSalaryTab
              salaryData={salaryData as any[]}
              salarySettings={salarySettings as Record<string, string>}
              toast={toast}
              onRefresh={() => { refetchSalary(); refetchSalarySettings(); }}
            />
          )}

          {tab === "performance" && (
            <div className="space-y-3">
              <div className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-2">
                <p className="font-semibold text-sm text-foreground">Performance Center</p>
                <p className="text-xs text-muted-foreground">The Performance Center page displays live analytics from your platform. It uses data from the Analytics and Statistics tabs to show capital deployment, returns distributed, and active opportunities.</p>
                <a href="/performance" className="block">
                  <Button className="w-full h-10 text-sm mt-2">View Performance Center →</Button>
                </a>
              </div>
              <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
                <p className="font-semibold text-xs text-foreground mb-3">Data Sources</p>
                <div className="space-y-2">
                  {[
                    { label: "Total Participants", source: "Users tab → Total Users" },
                    { label: "Capital Deployed", source: "Analytics → Total Deposits" },
                    { label: "Distributions Paid", source: "Analytics → Distributions Paid" },
                    { label: "Active Investments", source: "Analytics → Active Investments" },
                    { label: "Monthly Charts", source: "Statistics → Monthly Data" },
                  ].map(({ label, source }) => (
                    <div key={label} className="flex justify-between items-start text-xs gap-2">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium text-foreground text-right">{source}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* LOGS */}
          {tab === "logs" && (
            <div className="space-y-3">
              <p className="text-sm font-bold text-foreground">Password Reset Logs</p>
              {resetLogs?.length ? (
                <div className="bg-white border border-border rounded-2xl divide-y divide-border shadow-sm overflow-hidden">
                  {resetLogs.map((log: any) => (
                    <div key={log.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-foreground">@{log.targetUsername}</p>
                          <p className="text-[10px] text-muted-foreground">Reset by @{log.adminUsername}</p>
                          {log.details && <p className="text-xs text-muted-foreground mt-0.5">{log.details}</p>}
                        </div>
                        <p className="text-[10px] text-muted-foreground shrink-0">{formatDateTime(log.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-sm text-muted-foreground bg-white border border-border rounded-2xl">
                  No password reset logs yet
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Reject modal (kyc / wd / dep) */}
      <Dialog open={!!rejectModal} onOpenChange={(o) => !o && setRejectModal(null)}>
        <DialogContent className="max-w-sm mx-4">
          <DialogHeader><DialogTitle>Reject {rejectModal?.type === "kyc" ? "KYC" : rejectModal?.type === "dep" ? "Deposit" : "Withdrawal"}</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <Label className="text-sm">Reason</Label>
              <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Explain why you're rejecting..." className="mt-1.5 resize-none" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setRejectModal(null)}>Cancel</Button>
              <Button variant="destructive" className="flex-1" onClick={handleReject} disabled={rejectKyc.isPending || rejectWd.isPending || rejectDep.isPending}>Confirm Reject</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Proof image modal */}
      <Dialog open={!!proofModal} onOpenChange={(o) => !o && setProofModal(null)}>
        <DialogContent className="max-w-sm mx-4">
          <DialogHeader><DialogTitle>Payment Proof</DialogTitle></DialogHeader>
          {proofModal && <img src={proofModal} alt="Proof" className="w-full rounded-xl border border-border" />}
        </DialogContent>
      </Dialog>

      {/* Adjust balance modal */}
      <Dialog open={!!adjustModal} onOpenChange={(o) => !o && setAdjustModal(null)}>
        <DialogContent className="max-w-sm mx-4">
          <DialogHeader><DialogTitle>Adjust Balance — @{adjustModal?.username}</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <Label className="text-sm">Amount (positive to credit, negative to deduct)</Label>
              <Input value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} type="number" placeholder="e.g. 100 or -50" className="mt-1.5 h-10" />
            </div>
            <div>
              <Label className="text-sm">Reason</Label>
              <Input value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder="Admin bonus, correction..." className="mt-1.5 h-10" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setAdjustModal(null)}>Cancel</Button>
              <Button className="flex-1" onClick={handleAdjust} disabled={adjustBalance.isPending || !adjustAmount || !adjustReason}>Apply</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* User modal */}
      <Dialog open={!!userModal} onOpenChange={(o) => { if (!o) { setUserModal(null); setUserDetail(null); } }}>
        <DialogContent className="max-w-sm mx-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                {userModal?.fullName?.charAt(0) ?? "U"}
              </div>
              @{userModal?.username}
            </DialogTitle>
          </DialogHeader>
          {userModal && (
            <div className="space-y-4 pt-1">

              {/* Identity info */}
              <div className="bg-muted/40 rounded-xl p-3 space-y-1.5 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Full Name</span><span className="font-medium">{userModal.fullName}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span className="font-medium truncate max-w-[180px]">{userModal.email}</span></div>
                {userModal.whatsapp && <div className="flex justify-between"><span className="text-muted-foreground">WhatsApp</span><span className="font-medium">{userModal.whatsapp}</span></div>}
                {userModal.country && <div className="flex justify-between"><span className="text-muted-foreground">Country</span><span className="font-medium">{userModal.country}</span></div>}
                <div className="flex justify-between"><span className="text-muted-foreground">Member ID</span><span className="font-mono font-medium">#{userModal.displayId}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Joined</span><span className="font-medium">{formatDate(userModal.createdAt)}</span></div>
                {kycEnabledInAdmin && (
                  <div className="flex justify-between items-center"><span className="text-muted-foreground">KYC</span>
                    <Badge variant="outline" className={cn("text-[9px] capitalize", userModal.kycStatus === "approved" ? "bg-emerald-50 text-emerald-600" : userModal.kycStatus === "rejected" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600")}>{userModal.kycStatus}</Badge>
                  </div>
                )}
                <div className="flex justify-between items-center"><span className="text-muted-foreground">Email Verified</span><Badge variant="outline" className={cn("text-[9px]", userModal.emailVerified ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-red-50 text-red-500 border-red-200")}>{userModal.emailVerified ? "Verified" : "Unverified"}</Badge></div>
                <div className="flex justify-between items-center"><span className="text-muted-foreground">2FA</span><Badge variant="outline" className={cn("text-[9px]", userModal.twoFaEnabled ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-red-50 text-red-500 border-red-200")}>{userModal.twoFaEnabled ? "Enabled" : "Disabled"}</Badge></div>
                <div className="flex justify-between items-center"><span className="text-muted-foreground">Withdrawal Password</span><Badge variant="outline" className={cn("text-[9px]", userModal.hasWithdrawalPassword ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-red-50 text-red-500 border-red-200")}>{userModal.hasWithdrawalPassword ? "Set" : "Not Set"}</Badge></div>
                <div className="flex justify-between items-center"><span className="text-muted-foreground">Withdrawal Addresses</span><Badge variant="outline" className={cn("text-[9px]", userModal.withdrawalAddressCount > 0 ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-red-50 text-red-500 border-red-200")}>{userModal.withdrawalAddressCount > 0 ? `${userModal.withdrawalAddressCount} saved` : "None"}</Badge></div>
              </div>

              {/* KYC verification controls */}
              {kycEnabledInAdmin && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">KYC Verification</p>
                  <div className="flex flex-wrap gap-2">
                    {userModal.kycStatus !== "approved" && (
                      <Button size="sm" className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => handleApproveKyc(userModal.id)}>
                        <Check size={11} className="mr-1" />Approve
                      </Button>
                    )}
                    {userModal.kycStatus !== "rejected" && (
                      <Button size="sm" variant="destructive" className="h-8 text-xs" onClick={() => { setRejectModal({ type: "kyc", id: userModal.id }); setRejectReason(""); setUserModal(null); }}>
                        <X size={11} className="mr-1" />Reject
                      </Button>
                    )}
                    {userModal.kycStatus !== "approved" && (
                      <Button size="sm" variant="outline" className="h-8 text-xs border-emerald-300 text-emerald-600" onClick={() => adminApi(`/admin/kyc/${userModal.id}/mark-verified`, "POST").then(() => { toast({ title: "Marked as verified" }); queryClient.invalidateQueries({ queryKey: ["admin-users"] }); setUserModal(null); }).catch(() => handleApproveKyc(userModal.id))}>
                        Mark Verified
                      </Button>
                    )}
                    {userModal.kycStatus === "approved" && (
                      <Button size="sm" variant="outline" className="h-8 text-xs border-amber-300 text-amber-600" onClick={() => adminApi(`/admin/kyc/${userModal.id}/remove-verification`, "POST").then(() => { toast({ title: "Verification removed" }); queryClient.invalidateQueries({ queryKey: ["admin-users"] }); setUserModal(null); }).catch(() => { toast({ title: "Verification removed" }); queryClient.invalidateQueries({ queryKey: ["admin-users"] }); setUserModal(null); })}>
                        Remove Verification
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Email verification controls */}
              {!userModal.emailVerified && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Email Verification</p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => adminApi(`/admin/users/${userModal.id}/verify-email`, "POST").then(() => { toast({ title: "Email verified" }); queryClient.invalidateQueries({ queryKey: ["admin-users"] }); setUserModal(null); }).catch(() => toast({ title: "Error", variant: "destructive" }))}>
                      Manually Verify
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs border-blue-300 text-blue-600" onClick={() => adminApi(`/admin/users/${userModal.id}/resend-verification`, "POST").then(() => { toast({ title: "Verification email sent" }); }).catch(() => toast({ title: "Error", variant: "destructive" }))}>
                      Resend Email
                    </Button>
                  </div>
                </div>
              )}

              {/* Financial stats */}
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Financial Overview</p>
                {userDetailLoading ? (
                  <div className="grid grid-cols-2 gap-2">{[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Wallet Balance", value: formatUSDT((userDetail ?? userModal).balance), color: "text-primary" },
                      { label: "Total Deposited", value: formatUSDT((userDetail ?? userModal).totalDeposited), color: "text-emerald-600" },
                      { label: "Total Withdrawn", value: formatUSDT((userDetail ?? userModal).totalWithdrawn), color: "text-red-500" },
                      { label: "Total Earnings", value: formatUSDT((userDetail ?? userModal).totalEarnings ?? 0), color: "text-amber-500" },
                      { label: "Total Distributions", value: formatUSDT(userDetail?.totalInvestmentProfit ?? 0), color: "text-purple-500" },
                      { label: "Referral Earnings", value: formatUSDT(userDetail?.referralPendingEarnings ?? 0), color: "text-blue-500" },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="bg-white border border-border rounded-xl p-2.5">
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wide">{label}</p>
                        <p className={cn("text-sm font-bold mt-0.5", color)}>{value}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Investment summary */}
              {userDetail && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Investments</p>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <div className="bg-white border border-border rounded-xl p-2.5 text-center">
                      <p className="text-[9px] text-muted-foreground">Active</p>
                      <p className="text-sm font-bold text-emerald-600">{userDetail.activeInvestmentsCount}</p>
                    </div>
                    <div className="bg-white border border-border rounded-xl p-2.5 text-center">
                      <p className="text-[9px] text-muted-foreground">Total</p>
                      <p className="text-sm font-bold">{userDetail.totalInvestmentsCount}</p>
                    </div>
                    <div className="bg-white border border-border rounded-xl p-2.5 text-center">
                      <p className="text-[9px] text-muted-foreground">Referrals</p>
                      <p className="text-sm font-bold text-blue-500">{userDetail.referralCount}</p>
                    </div>
                  </div>
                  {userDetail.investments?.filter((i: any) => i.status === "active").length > 0 && (
                    <div className="space-y-1.5">
                      {userDetail.investments.filter((i: any) => i.status === "active").map((inv: any) => (
                        <div key={inv.id} className="bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 flex justify-between items-center">
                          <div>
                            <p className="text-xs font-semibold text-emerald-800">{inv.planName}</p>
                            <p className="text-[10px] text-emerald-600">Earned: {formatUSDT(inv.totalEarned)}</p>
                          </div>
                          <p className="text-sm font-bold text-emerald-700">{formatUSDT(inv.amount)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Recent transactions */}
              {userDetail?.recentTransactions?.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Recent Transactions</p>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {userDetail.recentTransactions.map((t: any) => (
                      <div key={t.id} className="flex items-center justify-between bg-muted/30 rounded-xl px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-xs font-medium capitalize text-foreground">{t.type.replace("_", " ")}</p>
                          {t.note && <p className="text-[10px] text-muted-foreground truncate max-w-[160px]">{t.note}</p>}
                          <p className="text-[10px] text-muted-foreground">{formatDateTime(t.createdAt)}</p>
                        </div>
                        <p className={cn("text-xs font-bold shrink-0 ml-2", t.type === "withdrawal" ? "text-red-500" : "text-emerald-600")}>
                          {t.type === "withdrawal" ? "-" : "+"}{formatUSDT(t.amount)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Login / IP info */}
              {(userModal.ipAddress || userModal.lastLoginIp) && (
                <div className="bg-muted/30 rounded-xl p-3 text-xs space-y-1">
                  {userModal.ipAddress && <p><span className="text-muted-foreground">Reg. IP: </span><span className="font-mono">{userModal.ipAddress}</span></p>}
                  {userModal.lastLoginIp && <p><span className="text-muted-foreground">Last IP: </span><span className="font-mono">{userModal.lastLoginIp}</span></p>}
                  {userModal.lastLoginAt && <p><span className="text-muted-foreground">Last Login: </span>{formatDateTime(userModal.lastLoginAt)}</p>}
                </div>
              )}

              {/* Lock controls */}
              <div className="space-y-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Account Controls</p>
                {[
                  { label: "Lock Withdrawals", key: "withdrawalLocked" },
                  { label: "Lock Transfers", key: "transferLocked" },
                  { label: "Lock WhatsApp", key: "whatsappLocked" },
                  { label: "Admin Access", key: "isAdmin" },
                  { label: "Account Active", key: "isActive" },
                ].map(({ label, key }) => (
                  <label key={key} className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-xl">
                    <span className="text-sm">{label}</span>
                    <input type="checkbox" checked={userModal[key] ?? false} onChange={(e) => setUserModal({ ...userModal, [key]: e.target.checked })} className="w-4 h-4" />
                  </label>
                ))}
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" className="text-xs h-8 flex-1" onClick={() => { setAdjustModal({ userId: userModal.id, username: userModal.username }); setUserModal(null); setUserDetail(null); }}>Adjust Balance</Button>
                <Button size="sm" variant="outline" className="text-xs h-8 flex-1" onClick={() => reset2fa.mutate(userModal.id)}>Reset 2FA</Button>
                <Button size="sm" variant="outline" className="text-xs h-8 flex-1 gap-1 text-amber-600 border-amber-300 hover:bg-amber-50" onClick={() => { setResetPwModal({ userId: userModal.id, username: userModal.username }); setUserModal(null); setUserDetail(null); }}><KeyRound size={11} />Reset Password</Button>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => { setUserModal(null); setUserDetail(null); }}>Cancel</Button>
                <Button className="flex-1" onClick={() => updateUser.mutate(userModal)} disabled={updateUser.isPending}>Save Changes</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Opportunity (Plan) modal */}
      <Dialog open={!!planModal} onOpenChange={(o) => !o && setPlanModal(null)}>
        <DialogContent className="max-w-sm mx-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{planModal?.id ? "Edit Opportunity" : "New Opportunity"}</DialogTitle></DialogHeader>
          {planModal && (
            <div className="space-y-3 pt-2">
              {[
                { label: "Name", field: "name", type: "text", placeholder: "e.g. Digital Assets Fund" },
                { label: "Description", field: "description", type: "text", placeholder: "Short description" },
                { label: "Category", field: "category", type: "text", placeholder: "e.g. Digital Assets" },
                { label: "Min Amount (USDT)", field: "minAmount", type: "number", placeholder: "100" },
                { label: "Max Amount (USDT)", field: "maxAmount", type: "number", placeholder: "10000" },
                { label: "Min Daily ROI (e.g. 0.013)", field: "minRoiRate", type: "number", placeholder: "0.013" },
                { label: "Max Daily ROI (e.g. 0.017)", field: "maxRoiRate", type: "number", placeholder: "0.017" },
                { label: "Duration (days)", field: "durationDays", type: "number", placeholder: "30" },
                { label: "Sort Order", field: "sortOrder", type: "number", placeholder: "0" },
                { label: "Banner URL (optional)", field: "bannerImageUrl", type: "text", placeholder: "https://..." },
                { label: "Funding Goal (USDT)", field: "fundingGoal", type: "number", placeholder: "1000000" },
                { label: "Current Funding (USDT)", field: "currentFunding", type: "number", placeholder: "0" },
                { label: "Max Participants (optional)", field: "totalParticipantLimit", type: "number", placeholder: "Leave blank for unlimited" },
                { label: "Participant Count Override (optional)", field: "displayParticipantCount", type: "number", placeholder: "Leave blank to auto-calculate" },
              ].map(({ label, field, type, placeholder }) => (
                <div key={field}>
                  <Label className="text-xs">{label}</Label>
                  <Input type={type} value={planModal[field] ?? ""} onChange={(e) => setPlanModal((p: any) => ({ ...p, [field]: type === "number" ? (e.target.value === "" ? "" : parseFloat(e.target.value)) : e.target.value }))} placeholder={placeholder} className="mt-1 h-9 text-sm" />
                </div>
              ))}

              <div>
                <Label className="text-xs">Status</Label>
                <Select value={planModal.status ?? "active"} onValueChange={(v) => setPlanModal((p: any) => ({ ...p, status: v }))}>
                  <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[
                      { val: "draft", label: "Draft" },
                      { val: "active", label: "Active" },
                      { val: "funding", label: "Funding" },
                      { val: "featured", label: "⭐ Featured" },
                      { val: "trending", label: "🔥 Trending" },
                      { val: "paused", label: "Paused" },
                      { val: "fully_allocated", label: "Fully Allocated" },
                      { val: "expired", label: "Expired" },
                      { val: "closed", label: "Closed" },
                    ].map(({ val, label }) => <SelectItem key={val} value={val}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Color Theme</Label>
                <Select value={planModal.colorTheme ?? "blue"} onValueChange={(v) => setPlanModal((p: any) => ({ ...p, colorTheme: v }))}>
                  <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[
                      { val: "blue",    label: "Blue" },
                      { val: "emerald", label: "Emerald" },
                      { val: "purple",  label: "Purple" },
                      { val: "amber",   label: "Amber" },
                      { val: "rose",    label: "Rose" },
                    ].map(({ val, label }) => <SelectItem key={val} value={val}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Start Date</Label>
                  <Input type="date" value={planModal.startDate ? String(planModal.startDate).slice(0, 10) : ""} onChange={(e) => setPlanModal((p: any) => ({ ...p, startDate: e.target.value || null }))} className="mt-1 h-9 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">End Date</Label>
                  <Input type="date" value={planModal.endDate ? String(planModal.endDate).slice(0, 10) : ""} onChange={(e) => setPlanModal((p: any) => ({ ...p, endDate: e.target.value || null }))} className="mt-1 h-9 text-sm" />
                </div>
              </div>

              <div>
                <Label className="text-xs">Features (one per line)</Label>
                <Textarea value={Array.isArray(planModal.features) ? planModal.features.join("\n") : ""} onChange={(e) => setPlanModal((p: any) => ({ ...p, features: e.target.value.split("\n").filter(Boolean) }))} className="mt-1 text-xs min-h-[80px] resize-none" placeholder="Daily returns&#10;24/7 support&#10;Auto-compound" />
              </div>

              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={!!planModal.isActive} onChange={(e) => setPlanModal((p: any) => ({ ...p, isActive: e.target.checked }))} />Active</label>
                <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={!!planModal.isFeatured} onChange={(e) => setPlanModal((p: any) => ({ ...p, isFeatured: e.target.checked }))} />⭐ Featured</label>
                <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={!!planModal.isPopular} onChange={(e) => setPlanModal((p: any) => ({ ...p, isPopular: e.target.checked }))} />🔥 Popular</label>
                <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={planModal.status === "trending"} onChange={(e) => setPlanModal((p: any) => ({ ...p, status: e.target.checked ? "trending" : (p.status === "trending" ? "active" : p.status) }))} />📈 Trending badge</label>
                <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={!!planModal.autoCompoundAvailable} onChange={(e) => setPlanModal((p: any) => ({ ...p, autoCompoundAvailable: e.target.checked }))} />Auto Compound</label>
              </div>

              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setPlanModal(null)}>Cancel</Button>
                <Button className="flex-1" onClick={() => savePlan.mutate(planModal)} disabled={savePlan.isPending}>Save Opportunity</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Network modal */}
      <Dialog open={!!networkModal} onOpenChange={(o) => !o && setNetworkModal(null)}>
        <DialogContent className="max-w-sm mx-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{networkModal?.id ? "Edit Network" : "Add Network"}</DialogTitle></DialogHeader>
          {networkModal && (
            <div className="space-y-3 pt-2">
              {[
                { label: "Network Code (e.g. TRC20)", field: "network", type: "text" },
                { label: "Label (e.g. USDT TRC20)", field: "label", type: "text" },
                { label: "Wallet Address", field: "walletAddress", type: "text" },
                { label: "Min Deposit (USDT)", field: "minDeposit", type: "number" },
                { label: "Network Fee (USDT)", field: "networkFee", type: "number" },
                { label: "Confirmation Time", field: "confirmationTime", type: "text" },
              ].map(({ label, field, type }) => (
                <div key={field}>
                  <Label className="text-xs">{label}</Label>
                  <Input type={type} value={networkModal[field] ?? ""} onChange={(e) => setNetworkModal((n: any) => ({ ...n, [field]: type === "number" ? parseFloat(e.target.value) : e.target.value }))} className="mt-1 h-9 text-sm" />
                </div>
              ))}
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={networkModal.isActive} onChange={(e) => setNetworkModal((n: any) => ({ ...n, isActive: e.target.checked }))} />Active</label>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setNetworkModal(null)}>Cancel</Button>
                <Button className="flex-1" onClick={() => saveNetwork.mutate(networkModal)} disabled={saveNetwork.isPending}>Save</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reset password modal */}
      <Dialog open={!!resetPwModal} onOpenChange={(o) => { if (!o) { setResetPwModal(null); setResetNewPw(""); } }}>
        <DialogContent className="max-w-sm mx-4">
          <DialogHeader><DialogTitle>Reset Password — @{resetPwModal?.username}</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <Label className="text-sm">New Password</Label>
              <Input
                type="password"
                value={resetNewPw}
                onChange={(e) => setResetNewPw(e.target.value)}
                placeholder="Min. 6 characters"
                className="mt-1.5 h-10"
              />
            </div>
            <p className="text-xs text-muted-foreground">The user will be notified via in-app notification. This action is logged.</p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setResetPwModal(null); setResetNewPw(""); }}>Cancel</Button>
              <Button
                className="flex-1 bg-amber-500 hover:bg-amber-600"
                onClick={() => resetUserPw.mutate({ userId: resetPwModal!.userId, password: resetNewPw })}
                disabled={resetUserPw.isPending || resetNewPw.length < 6}
              >
                {resetUserPw.isPending ? "Resetting..." : "Set New Password"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* News modal */}
      <Dialog open={!!newsModal} onOpenChange={(o) => !o && setNewsModal(null)}>
        <DialogContent className="max-w-sm mx-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{newsModal?.id ? "Edit Post" : "New Post"}</DialogTitle></DialogHeader>
          {newsModal && (
            <div className="space-y-3 pt-2">
              <div>
                <Label className="text-xs">Title</Label>
                <Input value={newsModal.title} onChange={(e) => setNewsModal((n: any) => ({ ...n, title: e.target.value }))} className="mt-1 h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Excerpt</Label>
                <Input value={newsModal.excerpt} onChange={(e) => setNewsModal((n: any) => ({ ...n, excerpt: e.target.value }))} className="mt-1 h-9 text-sm" placeholder="Short summary" />
              </div>
              <div>
                <Label className="text-xs">Content</Label>
                <Textarea value={newsModal.content} onChange={(e) => setNewsModal((n: any) => ({ ...n, content: e.target.value }))} className="mt-1 text-sm min-h-[120px] resize-none" />
              </div>
              <div>
                <Label className="text-xs">Category</Label>
                <Select value={newsModal.category} onValueChange={(v) => setNewsModal((n: any) => ({ ...n, category: v }))}>
                  <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{["announcement", "investment", "security", "market"].map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={newsModal.isPublished} onChange={(e) => setNewsModal((n: any) => ({ ...n, isPublished: e.target.checked }))} />Published</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={newsModal.isFeatured} onChange={(e) => setNewsModal((n: any) => ({ ...n, isFeatured: e.target.checked }))} />Featured</label>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setNewsModal(null)}>Cancel</Button>
                <Button className="flex-1" onClick={() => saveNews.mutate(newsModal)} disabled={saveNews.isPending}>Save</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function AboutTab({ data, onRefresh, toast }: { data: any; onRefresh: () => void; toast: any }) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/about", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Save failed");
      toast({ title: "About Us content saved" });
      onRefresh();
    } catch {
      toast({ title: "Error", description: "Failed to save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const FIELDS = [
    { key: "about_hero_title", label: "Hero Title", placeholder: "About Wexora", multiline: false },
    { key: "about_hero_subtitle", label: "Hero Subtitle", placeholder: "A Modern Digital Investment Platform…", multiline: false },
    { key: "about_hero_description", label: "Hero Description", placeholder: "Wexora is a digital investment platform…", multiline: true },
    { key: "about_mission_text", label: "Mission Text", placeholder: "At Wexora, our mission is to…", multiline: true },
    { key: "about_security_text", label: "Security & Compliance Text", placeholder: "Wexora prioritizes platform security…", multiline: true },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white border border-border rounded-2xl p-4 shadow-sm space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Info size={15} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">About Us Content</p>
            <p className="text-[11px] text-muted-foreground">Edit the text displayed on the public About Us page</p>
          </div>
        </div>

        {FIELDS.map(({ key, label, placeholder, multiline }) => (
          <div key={key}>
            <Label className="text-xs text-muted-foreground">{label}</Label>
            {multiline ? (
              <Textarea
                value={form[key] ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder}
                className="mt-1 text-sm min-h-[80px] resize-none"
              />
            ) : (
              <Input
                value={form[key] ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder}
                className="mt-1 h-9 text-sm"
              />
            )}
          </div>
        ))}

        <Button className="w-full h-10 font-semibold" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save About Us Content"}
        </Button>
      </div>

      <div className="bg-muted/30 border border-border rounded-2xl p-4 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Note</p>
        <p className="text-xs text-muted-foreground">Contact information (email, Telegram, WhatsApp) is pulled from the Settings tab. Platform statistics are always live from the database.</p>
        <button
          className="text-xs text-primary font-semibold flex items-center gap-1 mt-1"
          onClick={() => window.open("/about", "_self")}
        >
          Preview About Page →
        </button>
      </div>
    </div>
  );
}

function AppSettingsTab({ settings, onRefresh, toast }: { settings: any; onRefresh: () => void; toast: any }) {
  const [form, setForm] = useState<Record<string, string>>({
    app_name: "",
    app_version: "",
    apk_size: "",
    app_last_updated: "",
    release_notes: "",
    changelog: "",
    force_update_enabled: "false",
    github_download_url: "",
    mediafire_download_url: "",
    gdrive_download_url: "",
    telegram_download_url: "",
    primary_download_url: "",
    mirror_download_url: "",
    backup_download_url: "",
  });
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState<string | null>(null);
  const [notifying, setNotifying] = useState(false);

  useEffect(() => {
    if (settings && typeof settings === "object") {
      setForm((prev) => ({ ...prev, ...settings }));
    }
  }, [settings]);

  const set = (key: string) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminApi("/admin/app-settings", "PUT", form);
      onRefresh();
      toast({ title: "✓ App settings saved", description: "Download URLs and app info updated successfully." });
    } catch {
      toast({ title: "Save failed", description: "Could not save settings. Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleResetCounter = async (server: string) => {
    setResetting(server);
    try {
      await adminApi(`/admin/app-settings/reset-counter/${server}`, "POST");
      onRefresh();
      toast({ title: "Counter reset", description: `${server} download counter reset to 0.` });
    } catch {
      toast({ title: "Error", description: "Failed to reset counter.", variant: "destructive" });
    } finally {
      setResetting(null);
    }
  };

  const handleNotifyUpdate = async () => {
    if (!form.app_version?.trim()) {
      toast({ title: "No version set", description: "Please set an app version before sending update notifications.", variant: "destructive" });
      return;
    }
    setNotifying(true);
    try {
      const data = await adminApi("/admin/app-settings/notify-update", "POST");
      toast({
        title: "🔔 Notifications sent!",
        description: `Update notification for v${form.app_version} sent to ${data.sentTo ?? 0} users.`,
      });
    } catch {
      toast({ title: "Error", description: "Failed to send notifications. Please try again.", variant: "destructive" });
    } finally {
      setNotifying(false);
    }
  };

  const SERVERS = [
    { key: "github",    label: "GitHub",     urlKey: "github_download_url",    countKey: "github_download_count" },
    { key: "mediafire", label: "MediaFire",  urlKey: "mediafire_download_url", countKey: "mediafire_download_count" },
    { key: "gdrive",    label: "Google Drive", urlKey: "gdrive_download_url",  countKey: "gdrive_download_count" },
    { key: "telegram",  label: "Telegram",   urlKey: "telegram_download_url",  countKey: "telegram_download_count" },
    { key: "primary",   label: "Primary",    urlKey: "primary_download_url",   countKey: "primary_download_count" },
    { key: "mirror",    label: "Mirror",     urlKey: "mirror_download_url",    countKey: "mirror_download_count" },
    { key: "backup",    label: "Backup",     urlKey: "backup_download_url",    countKey: "backup_download_count" },
  ];

  return (
    <div className="space-y-4">
      {/* App Information */}
      <div className="bg-white border border-border rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Smartphone size={15} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">App Information</p>
            <p className="text-[11px] text-muted-foreground">Metadata shown on the Download App page</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">App Name</Label>
            <Input value={form.app_name} onChange={set("app_name")} placeholder="Wexora" className="mt-1 h-9 text-sm" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Version</Label>
            <Input value={form.app_version} onChange={set("app_version")} placeholder="e.g. 2.1.0" className="mt-1 h-9 text-sm" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">APK Size</Label>
            <Input value={form.apk_size} onChange={set("apk_size")} placeholder="e.g. 45.2 MB" className="mt-1 h-9 text-sm" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Last Updated</Label>
            <Input value={form.app_last_updated} onChange={set("app_last_updated")} type="date" className="mt-1 h-9 text-sm" />
          </div>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Release Notes (What's New)</Label>
          <Textarea value={form.release_notes} onChange={set("release_notes")} placeholder="Describe what's new in this version…" className="mt-1 text-sm min-h-[80px] resize-none" />
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Changelog</Label>
          <Textarea value={form.changelog} onChange={set("changelog")} placeholder="Detailed changelog for this release…" className="mt-1 text-sm min-h-[70px] resize-none" />
        </div>
      </div>

      {/* Download URLs */}
      <div className="bg-white border border-border rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <Link2 size={15} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">Download URLs</p>
            <p className="text-[11px] text-muted-foreground">Leave a URL empty to hide that server's button on the Download page</p>
          </div>
        </div>

        {SERVERS.map(({ key, label, urlKey }) => {
          const url = form[urlKey] ?? "";
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs text-muted-foreground">{label} Server URL</Label>
                <div className="flex items-center gap-1">
                  <span className={cn("inline-block w-1.5 h-1.5 rounded-full", url ? "bg-emerald-500" : "bg-muted-foreground/40")} />
                  <span className={cn("text-[10px] font-semibold", url ? "text-emerald-600" : "text-muted-foreground")}>
                    {url ? "Online" : "Offline"}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <Input
                  value={url}
                  onChange={set(urlKey)}
                  placeholder={`https://example.com/wexora-${key}.apk`}
                  className="h-9 text-sm font-mono flex-1"
                />
                {url && (
                  <a href={url} target="_blank" rel="noopener noreferrer" className="h-9 w-9 rounded-lg border border-border flex items-center justify-center shrink-0 hover:bg-muted transition-colors">
                    <ExternalLink size={13} className="text-muted-foreground" />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Download Statistics */}
      <div className="bg-white border border-border rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <Download size={15} className="text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">Download Statistics</p>
            <p className="text-[11px] text-muted-foreground">Counts increment when users click a download button</p>
          </div>
        </div>
        <div className="space-y-2">
          {SERVERS.map(({ key, label, countKey }) => {
            const count = parseInt(settings?.[countKey] ?? "0", 10);
            return (
              <div key={key} className="flex items-center justify-between bg-muted/30 rounded-xl px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <Server size={13} className="text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">{label} Server</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-primary">{count.toLocaleString()}</span>
                  <span className="text-[10px] text-muted-foreground">downloads</span>
                  <button
                    onClick={() => handleResetCounter(key)}
                    disabled={resetting === key || count === 0}
                    className="h-7 px-2 rounded-lg border border-border text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40 flex items-center gap-1"
                  >
                    <RotateCcw size={10} className={resetting === key ? "animate-spin" : ""} />
                    Reset
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Force Update */}
      <div className="bg-white border border-border rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <AlertTriangle size={15} className="text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">Force Update</p>
            <p className="text-[11px] text-muted-foreground">Block app access until users install the latest version</p>
          </div>
        </div>
        <div className={cn(
          "flex items-center justify-between rounded-xl px-4 py-3 border transition-colors",
          form.force_update_enabled === "true"
            ? "bg-amber-500/10 border-amber-500/30"
            : "bg-muted/30 border-border"
        )}>
          <div>
            <p className="text-sm font-semibold text-foreground">Force Update Mode</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {form.force_update_enabled === "true"
                ? "🟠 Active — users with older versions will be blocked"
                : "Disabled — users can use the app with any version"}
            </p>
          </div>
          <Switch
            checked={form.force_update_enabled === "true"}
            onCheckedChange={(checked) =>
              setForm((f) => ({ ...f, force_update_enabled: checked ? "true" : "false" }))
            }
          />
        </div>
      </div>

      {/* Send Update Notification */}
      <div className="bg-white border border-border rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Bell size={15} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">Notify Users of Update</p>
            <p className="text-[11px] text-muted-foreground">Send a push notification to all active users about the new version</p>
          </div>
        </div>
        {form.app_version ? (
          <div className="bg-primary/5 border border-primary/15 rounded-xl px-3 py-2.5">
            <p className="text-xs text-muted-foreground">Notification preview:</p>
            <p className="text-sm font-semibold text-foreground mt-0.5">🔔 New App Update Available</p>
            <p className="text-xs text-muted-foreground mt-0.5">Wexora v{form.app_version} is now available. Tap to download the latest version.</p>
          </div>
        ) : (
          <div className="bg-muted/40 border border-border rounded-xl px-3 py-2.5">
            <p className="text-xs text-muted-foreground">Set a version number above before sending notifications.</p>
          </div>
        )}
        <Button
          className="w-full h-10 font-semibold gap-2 text-sm"
          variant="outline"
          onClick={handleNotifyUpdate}
          disabled={notifying || !form.app_version?.trim()}
        >
          {notifying
            ? <><span className="animate-spin inline-block w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full" /> Sending…</>
            : <><Bell size={15} /> Notify All Users</>
          }
        </Button>
      </div>

      {/* Save */}
      <Button className="w-full h-11 font-semibold gap-2" onClick={handleSave} disabled={saving}>
        {saving
          ? <><span className="animate-spin inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> Saving…</>
          : <>✓ Save App Settings</>
        }
      </Button>

      {/* Preview link */}
      <div className="bg-muted/30 border border-border rounded-xl px-3 py-2.5 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Preview the Download App page</p>
        <a href="/download-app" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
          Open page <ExternalLink size={11} />
        </a>
      </div>
    </div>
  );
}

function SettingsTab({ settingsData, toast }: { settingsData: any; toast: any }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settingsData && typeof settingsData === "object" && !Array.isArray(settingsData)) {
      setForm(settingsData as Record<string, string>);
    } else if (Array.isArray(settingsData)) {
      const obj: Record<string, string> = {};
      for (const s of settingsData) obj[s.key] = s.value;
      setForm(obj);
    }
  }, [settingsData]);

  const TEXT_FIELDS = [
    { key: "platform_name",      label: "Platform Name",              placeholder: "Wexora",                          section: "Branding" },
    { key: "platform_logo_url",  label: "Platform Logo URL",          placeholder: "https://example.com/logo.png",    section: "Branding" },
    { key: "platform_url",       label: "Platform Website URL",       placeholder: "https://wexoraglobal.com",              section: "Branding" },
    { key: "support_email",      label: "Support Email",              placeholder: "support@wexoraglobal.com",              section: "Support" },
    { key: "support_telegram",   label: "Telegram Support Link",      placeholder: "https://t.me/WexoraGlobal",      section: "Support" },
    { key: "support_telegram_group",   label: "Telegram Community Group Link",  placeholder: "https://t.me/WexoraCommunity",    section: "Support" },
    { key: "support_whatsapp",         label: "WhatsApp Support Number",        placeholder: "+1234567890",                     section: "Support" },
    { key: "support_whatsapp_community", label: "WhatsApp Community Link",      placeholder: "https://chat.whatsapp.com/xxxx",  section: "Support" },
    { key: "min_deposit", label: "Min. Deposit (USDT)", placeholder: "10" },
    { key: "min_withdrawal", label: "Min. Withdrawal (USDT)", placeholder: "10" },
    { key: "withdrawal_fee_percent", label: "Withdrawal Fee (%)", placeholder: "1.5" },
    { key: "signup_bonus_amount", label: "Signup Bonus Amount (USDT)", placeholder: "10" },
    { key: "first_deposit_bonus_percent", label: "First Deposit Bonus (%)", placeholder: "10" },
    { key: "app_download_url", label: "App Download Link", placeholder: "https://play.google.com/store/apps/..." },
    { key: "announcement_text", label: "Announcement Banner Text", placeholder: "" },
  ];

  const REFERRAL_FIELDS = [
    { key: "referral_l1_deposit_rate", label: "Level 1 — Deposit Commission (%)", placeholder: "5", desc: "Direct referral's deposit" },
    { key: "referral_l2_deposit_rate", label: "Level 2 — Deposit Commission (%)", placeholder: "3", desc: "Referral's referral deposit" },
    { key: "referral_l3_deposit_rate", label: "Level 3 — Deposit Commission (%)", placeholder: "1", desc: "3rd degree network deposit" },
    { key: "referral_l1_roi_rate", label: "Level 1 — ROI Commission (%)", placeholder: "5", desc: "Direct referral's investment ROI" },
    { key: "referral_l2_roi_rate", label: "Level 2 — ROI Commission (%)", placeholder: "3", desc: "Referral's referral ROI" },
    { key: "referral_l3_roi_rate", label: "Level 3 — ROI Commission (%)", placeholder: "1", desc: "3rd degree network ROI" },
  ];

  const TOGGLE_FIELDS = [
    { key: "kyc_enabled", label: "KYC Verification", description: "Enable identity verification flow for users" },
    { key: "maintenance_mode", label: "Maintenance Mode", description: "Disable access for all non-admin users" },
    { key: "kyc_required_for_withdrawal", label: "KYC Required for Withdrawal", description: "Block withdrawals until KYC is approved" },
    { key: "signup_bonus_enabled", label: "Signup Bonus", description: "Credit a welcome bonus to every new user on registration" },
    { key: "first_deposit_bonus_enabled", label: "First Deposit Bonus", description: "Credit a bonus % when a user makes their first ever deposit" },
  ];

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? "Failed to save settings");
      }
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
      toast({ title: "Settings saved!" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-border rounded-2xl p-4 shadow-sm space-y-3">
        <p className="text-sm font-bold text-foreground">Platform Settings</p>

        {TOGGLE_FIELDS.map(({ key, label, description }) => (
          <div key={key} className="flex items-center justify-between py-2 border-b border-border last:border-0">
            <div>
              <p className="text-sm font-medium text-foreground">{label}</p>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            <Switch
              checked={form[key] === "true"}
              onCheckedChange={(checked) => setForm((f) => ({ ...f, [key]: checked ? "true" : "false" }))}
            />
          </div>
        ))}

        {/* Maintenance options — only shown when maintenance mode is enabled */}
        {form["maintenance_mode"] === "true" && (
          <>
            {/* Custom Message */}
            <div className="pt-2 pb-1 border-b border-border space-y-1.5">
              <p className="text-sm font-medium text-foreground">Maintenance Message</p>
              <p className="text-xs text-muted-foreground">
                Shown to users on the maintenance screen. Leave blank for the default message.
              </p>
              <textarea
                rows={2}
                value={form["maintenance_message"] ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, maintenance_message: e.target.value }))}
                placeholder={`e.g. "Upgrading our trading engine" or "Security enhancements underway"`}
                className="w-full rounded-lg border border-border bg-background text-foreground text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
              />
            </div>

            {/* Return Date & Time */}
            <div className="pt-2 pb-1 border-b border-border space-y-1.5">
              <p className="text-sm font-medium text-foreground">Return Date &amp; Time</p>
              <p className="text-xs text-muted-foreground">
                Set when the platform will be back. A live countdown (Days · Hours · Minutes · Seconds) will display on the maintenance screen.
              </p>
              <input
                type="datetime-local"
                value={form["maintenance_eta"]
                  ? new Date(form["maintenance_eta"]).toISOString().slice(0, 16)
                  : ""}
                onChange={(e) => {
                  const iso = e.target.value ? new Date(e.target.value).toISOString() : "";
                  setForm((f) => ({ ...f, maintenance_eta: iso }));
                }}
                className="w-full rounded-lg border border-border bg-background text-foreground text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              {form["maintenance_eta"] && (() => {
                const d = new Date(form["maintenance_eta"]);
                return (
                  <div className="rounded-lg bg-muted/50 border border-border px-3 py-2">
                    <p className="text-xs text-muted-foreground">
                      Preview — Users will see:
                    </p>
                    <p className="text-xs font-semibold text-foreground mt-0.5">
                      "Back by {d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}"
                    </p>
                  </div>
                );
              })()}
              {form["maintenance_eta"] && (
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, maintenance_eta: "" }))}
                  className="text-xs text-red-500 hover:text-red-400 font-medium"
                >
                  ✕ Clear ETA
                </button>
              )}
            </div>
          </>
        )}

        <div className="pt-1 space-y-3">
          {TEXT_FIELDS.map(({ key, label, placeholder }) => (
            <div key={key}>
              <Label className="text-xs text-muted-foreground">{label}</Label>
              <Input
                value={form[key] ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder}
                className="mt-1 h-9 text-sm"
              />
            </div>
          ))}
        </div>

        <Button className="w-full h-10 font-semibold" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save All Settings"}
        </Button>
      </div>

      <div className="bg-white border border-border rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Network size={14} className="text-purple-500" />
          <p className="text-sm font-bold text-foreground">3-Level Referral Commissions</p>
        </div>
        <p className="text-xs text-muted-foreground -mt-1">Set deposit &amp; ROI commission rates for each referral level independently.</p>

        <div className="grid grid-cols-2 gap-3">
          {REFERRAL_FIELDS.map(({ key, label, placeholder, desc }) => (
            <div key={key}>
              <Label className="text-xs text-muted-foreground">{label}</Label>
              <p className="text-[10px] text-muted-foreground/70 mb-1">{desc}</p>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={form[key] ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder}
                className="h-9 text-sm"
              />
            </div>
          ))}
        </div>

        <Button className="w-full h-10 font-semibold" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save Referral Rates"}
        </Button>
      </div>

      <div className="bg-white border border-border rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Users size={14} className="text-blue-500" />
          <p className="text-sm font-bold text-foreground">Referral Community Data</p>
        </div>
        <p className="text-xs text-muted-foreground -mt-1">
          Control how platform-wide community statistics are shown on the referrals page.
          User-specific earnings, commissions, and referral counts are always real.
        </p>

        <div>
          <Label className="text-xs text-muted-foreground">Community Stats Mode</Label>
          <Select
            value={form["referral_hybrid_mode"] ?? "auto"}
            onValueChange={(v) => setForm((f) => ({ ...f, referral_hybrid_mode: v }))}
          >
            <SelectTrigger className="mt-1 h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto — Hybrid (demo fills gaps when real data is low)</SelectItem>
              <SelectItem value="full_demo">Full Demo — Always show demo community data</SelectItem>
              <SelectItem value="disabled">Disabled — Show only real data (may look sparse)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground mt-1">
            <strong>Auto</strong>: blends real + demo. <strong>Full Demo</strong>: always uses demo values for community metrics. <strong>Disabled</strong>: pure real data only.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-1">
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-center">
            <p className="text-[10px] text-purple-600 font-semibold uppercase tracking-wide mb-1">Community Stats</p>
            <p className="text-[10px] text-muted-foreground">Total referrals, active referrers, rewards distributed</p>
            <p className="text-[10px] font-bold text-purple-600 mt-1">Hybrid ✓</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
            <p className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wide mb-1">Leaderboard</p>
            <p className="text-[10px] text-muted-foreground">Real users first, demo names fill remaining slots</p>
            <p className="text-[10px] font-bold text-emerald-600 mt-1">Hybrid ✓</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
            <p className="text-[10px] text-blue-600 font-semibold uppercase tracking-wide mb-1">User Earnings</p>
            <p className="text-[10px] text-muted-foreground">Personal stats are always real, never inflated</p>
            <p className="text-[10px] font-bold text-blue-600 mt-1">Always Real ✓</p>
          </div>
        </div>

        <Button className="w-full h-10 font-semibold" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save Referral Settings"}
        </Button>
      </div>

      <div className="bg-white border border-border rounded-2xl p-4 shadow-sm space-y-3">
        <p className="text-sm font-bold text-foreground">Instructions &amp; Rules</p>
        <p className="text-xs text-muted-foreground -mt-1">Each line becomes one step. Leave empty to use the default instructions.</p>

        <div>
          <Label className="text-xs text-muted-foreground">Deposit Instructions (one step per line)</Label>
          <Textarea
            value={form["deposit_instructions"] ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, deposit_instructions: e.target.value }))}
            placeholder={"Open your wallet app\nSend USDT to the address shown\nPaste the TX hash\nUpload your screenshot"}
            className="mt-1 text-sm min-h-[100px] resize-none"
          />
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Withdrawal Rules (one rule per line)</Label>
          <Textarea
            value={form["withdrawal_instructions"] ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, withdrawal_instructions: e.target.value }))}
            placeholder={"Withdrawals are reviewed within 24 hours\nA processing fee applies to all withdrawals\nProcessing takes up to 2 business days"}
            className="mt-1 text-sm min-h-[100px] resize-none"
          />
        </div>

        <Button className="w-full h-10 font-semibold" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save Instructions"}
        </Button>
      </div>

      {/* Withdrawal Security Settings */}
      <div className="bg-white border border-border rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Lock size={14} className="text-red-500" />
          <p className="text-sm font-bold text-foreground">Withdrawal Security</p>
        </div>
        <p className="text-xs text-muted-foreground -mt-1">Control whether 2FA (Authenticator) is required when users make a withdrawal.</p>

        <div>
          <Label className="text-xs text-muted-foreground">2FA Mode for Withdrawals</Label>
          <Select
            value={form["withdrawal_2fa_mode"] ?? "optional"}
            onValueChange={(v) => setForm((f) => ({ ...f, withdrawal_2fa_mode: v }))}
          >
            <SelectTrigger className="mt-1 h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="optional">Optional — Password only required; 2FA verified if provided</SelectItem>
              <SelectItem value="always">Always — Both withdrawal password AND 2FA code required</SelectItem>
              <SelectItem value="disabled">Disabled — Password only; 2FA field hidden entirely</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground mt-1.5">
            <strong>Optional</strong>: users can submit with just their withdrawal password. If they have 2FA enabled and enter a code, it is also verified. <strong>Always</strong>: users with 2FA enabled must provide both. <strong>Disabled</strong>: the 2FA field is hidden and never checked.
          </p>
        </div>

        <Button className="w-full h-10 font-semibold" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save Security Settings"}
        </Button>
      </div>

      {/* Activity Feed Settings */}
      <div className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Activity size={14} className="text-green-500" />
          <p className="text-sm font-bold text-foreground">Activity Feed Settings</p>
        </div>
        <p className="text-xs text-muted-foreground -mt-1">Control how the Live Activity Feed works on the dashboard and about page.</p>

        <div className="flex items-center justify-between py-2 border-b border-border">
          <div>
            <p className="text-sm font-medium text-foreground">Real Activity Mode</p>
            <p className="text-xs text-muted-foreground">Show real platform actions instead of simulated activity</p>
          </div>
          <Switch
            checked={form["activity_feed_mode"] === "real"}
            onCheckedChange={(checked) => setForm((f) => ({ ...f, activity_feed_mode: checked ? "real" : "demo" }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { key: "feed_enable_deposits", label: "Show Deposits" },
            { key: "feed_enable_investments", label: "Show Investments" },
            { key: "feed_enable_withdrawals", label: "Show Withdrawals" },
            { key: "feed_enable_earnings", label: "Show Earnings" },
            { key: "feed_enable_referrals", label: "Show Referrals" },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between py-1.5">
              <p className="text-xs text-foreground">{label}</p>
              <Switch
                checked={form[key] !== "false"}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, [key]: checked ? "true" : "false" }))}
              />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">Min Amount (USDT)</Label>
            <Input type="number" value={form["feed_min_amount"] ?? "50"} onChange={(e) => setForm((f) => ({ ...f, feed_min_amount: e.target.value }))} className="mt-1 h-9 text-sm" placeholder="50" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Max Amount (USDT)</Label>
            <Input type="number" value={form["feed_max_amount"] ?? "5000"} onChange={(e) => setForm((f) => ({ ...f, feed_max_amount: e.target.value }))} className="mt-1 h-9 text-sm" placeholder="5000" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Update Frequency (seconds)</Label>
            <Input type="number" value={form["feed_frequency_seconds"] ?? "14"} onChange={(e) => setForm((f) => ({ ...f, feed_frequency_seconds: e.target.value }))} className="mt-1 h-9 text-sm" placeholder="14" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Username Style</Label>
            <select
              value={form["feed_username_style"] ?? "partial"}
              onChange={(e) => setForm((f) => ({ ...f, feed_username_style: e.target.value }))}
              className="mt-1 h-9 text-sm w-full rounded-md border border-input bg-background px-3 text-foreground"
            >
              <option value="partial">Partial (john***)</option>
              <option value="full">Full names</option>
              <option value="anonymous">Anonymous</option>
            </select>
          </div>
        </div>

        <Button className="w-full h-10 font-semibold" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save Feed Settings"}
        </Button>
      </div>
    </div>
  );
}

// ─── Platform Content Tab ─────────────────────────────────────────────────────
function ContentTab({ settingsData, onRefresh, toast }: { settingsData: any; onRefresh: () => void; toast: any }) {
  const [form, setForm] = useState<Record<string, string>>({
    privacy_policy_content: "",
    privacy_policy_updated: "",
    terms_content: "",
    terms_updated: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settingsData && typeof settingsData === "object") {
      setForm((prev) => ({ ...prev, ...settingsData }));
    }
  }, [settingsData]);

  const set = (key: string) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          privacy_policy_content: form.privacy_policy_content,
          privacy_policy_updated: form.privacy_policy_updated,
          terms_content: form.terms_content,
          terms_updated: form.terms_updated,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? "Failed to save");
      onRefresh();
      toast({ title: "✓ Platform content saved", description: "Privacy Policy and Terms updated." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">

      {/* Privacy Policy */}
      <div className="bg-white border border-border rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
            <Lock size={14} className="text-slate-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">Privacy Policy</p>
            <p className="text-[11px] text-muted-foreground">Leave blank to show the default policy sections</p>
          </div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Last Updated Date</Label>
          <Input type="date" value={form.privacy_policy_updated} onChange={set("privacy_policy_updated")} className="mt-1 h-9 text-sm" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Custom Content (optional — replaces default sections)</Label>
          <Textarea
            value={form.privacy_policy_content}
            onChange={set("privacy_policy_content")}
            placeholder="Enter custom privacy policy text here, or leave empty to show the built-in default sections…"
            className="mt-1 text-sm min-h-[140px] resize-none"
          />
        </div>
      </div>

      {/* Terms & Conditions */}
      <div className="bg-white border border-border rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
            <FileText size={14} className="text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">Terms &amp; Conditions</p>
            <p className="text-[11px] text-muted-foreground">Leave blank to show the default T&amp;C sections</p>
          </div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Last Updated Date</Label>
          <Input type="date" value={form.terms_updated} onChange={set("terms_updated")} className="mt-1 h-9 text-sm" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Custom Content (optional — replaces default sections)</Label>
          <Textarea
            value={form.terms_content}
            onChange={set("terms_content")}
            placeholder="Enter custom terms and conditions text here, or leave empty to show the built-in default sections…"
            className="mt-1 text-sm min-h-[140px] resize-none"
          />
        </div>
      </div>

      {/* App Version note */}
      <div className="bg-muted/30 border border-border rounded-xl px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-foreground">App Version</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Manage version number in the App Settings tab</p>
        </div>
        <button
          className="text-xs font-semibold text-primary hover:underline"
          onClick={() => {}}
        >
          → App Settings
        </button>
      </div>

      {/* Save */}
      <Button className="w-full h-11 font-semibold gap-2" onClick={handleSave} disabled={saving}>
        {saving
          ? <><span className="animate-spin inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> Saving…</>
          : <>✓ Save Platform Content</>}
      </Button>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-2">
        <a href="/privacy" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 bg-muted/30 border border-border rounded-xl h-9 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
          <ExternalLink size={11} /> Preview Privacy Policy
        </a>
        <a href="/terms" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 bg-muted/30 border border-border rounded-xl h-9 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
          <ExternalLink size={11} /> Preview Terms &amp; Conditions
        </a>
      </div>
    </div>
  );
}

// ─── Statistics Tab ───────────────────────────────────────────────────────────
function StatisticsTab({ data, onRefresh, toast }: { data: any; onRefresh: () => void; toast: any }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data && typeof data === "object") setForm(data as Record<string, string>);
  }, [data]);

  const mode = form["stats_mode"] ?? "real";

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/statistics", {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Failed to save");
      queryClient.invalidateQueries({ queryKey: ["admin-statistics"] });
      queryClient.invalidateQueries({ queryKey: ["about"] });
      toast({ title: "Statistics settings saved!" });
      onRefresh();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const STAT_FIELDS = [
    { key: "members", label: "Registered Members", placeholder: "5000" },
    { key: "active_investments", label: "Active Investments", placeholder: "387" },
    { key: "total_deposits", label: "Total Deposits (USDT)", placeholder: "2850000" },
    { key: "total_withdrawals", label: "Total Withdrawals (USDT)", placeholder: "1920000" },
    { key: "countries", label: "Countries Served", placeholder: "42" },
    { key: "completed", label: "Completed Opportunities", placeholder: "1056" },
  ];

  const ANIM_FIELDS = [
    { key: "members", label: "Members" },
    { key: "investments", label: "Active Investments" },
    { key: "deposits", label: "Total Deposits" },
    { key: "withdrawals", label: "Total Withdrawals" },
    { key: "countries", label: "Countries" },
    { key: "completed", label: "Completed" },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <BarChart3 size={14} className="text-primary" />
          <p className="text-sm font-bold text-foreground">Platform Statistics Display</p>
        </div>
        <p className="text-xs text-muted-foreground">Choose how platform statistics appear on the About page.</p>

        {/* Mode selector */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: "real", label: "Real Data", desc: "Live database values", icon: Activity },
            { id: "custom", label: "Custom", desc: "Manually set values", icon: Tag },
            { id: "animated", label: "Animated", desc: "Randomised ranges", icon: Zap },
          ].map(({ id, label, desc, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setForm((f) => ({ ...f, stats_mode: id }))}
              className={cn(
                "rounded-xl p-3 text-left border transition-all",
                mode === id
                  ? "bg-primary/10 border-primary text-primary"
                  : "bg-muted/30 border-border text-muted-foreground hover:border-primary/50"
              )}
            >
              <Icon size={14} className="mb-1.5" />
              <p className="text-xs font-semibold">{label}</p>
              <p className="text-[10px] opacity-70">{desc}</p>
            </button>
          ))}
        </div>

        {/* Real mode info */}
        {mode === "real" && (
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">
            <p className="text-xs text-emerald-600 font-medium">Live database values will be shown.</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Users, investments, deposits, and withdrawals are fetched in real-time from the database.</p>
          </div>
        )}

        {/* Custom mode */}
        {mode === "custom" && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-foreground">Custom Values</p>
            <div className="grid grid-cols-2 gap-3">
              {STAT_FIELDS.map(({ key, label, placeholder }) => (
                <div key={key}>
                  <Label className="text-xs text-muted-foreground">{label}</Label>
                  <Input
                    type="number"
                    value={form[`stats_${key}`] ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, [`stats_${key}`]: e.target.value }))}
                    placeholder={placeholder}
                    className="mt-1 h-9 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Animated mode */}
        {mode === "animated" && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-foreground">Animated Ranges</p>
            <p className="text-[10px] text-muted-foreground">Values will smoothly randomise within these ranges every few seconds.</p>
            {ANIM_FIELDS.map(({ key, label }) => (
              <div key={key}>
                <p className="text-xs font-medium text-foreground mb-1.5">{label}</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Min</Label>
                    <Input
                      type="number"
                      value={form[`stats_anim_${key}_min`] ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, [`stats_anim_${key}_min`]: e.target.value }))}
                      className="mt-0.5 h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Max</Label>
                    <Input
                      type="number"
                      value={form[`stats_anim_${key}_max`] ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, [`stats_anim_${key}_max`]: e.target.value }))}
                      className="mt-0.5 h-8 text-xs"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <Button className="w-full h-10 font-semibold" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save Statistics Settings"}
        </Button>
      </div>
    </div>
  );
}

// ─── Tickets Tab ──────────────────────────────────────────────────────────────
function TicketsTab({ data, onRefresh, toast }: { data: any; onRefresh: () => void; toast: any }) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "open" | "answered" | "closed">("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [reply, setReply] = useState("");

  const { data: ticketDetail, isLoading: detailLoading } = useQuery({
    queryKey: ["admin-ticket-detail", selectedId],
    queryFn: () => adminApiTicket(`/api/support/tickets/${selectedId}`),
    enabled: selectedId !== null,
    refetchInterval: 15000,
  });

  const sendReply = useMutation({
    mutationFn: (message: string) => adminApiTicket(`/api/support/tickets/${selectedId}/reply`, "POST", { message }),
    onSuccess: () => {
      setReply("");
      queryClient.invalidateQueries({ queryKey: ["admin-ticket-detail", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
      onRefresh();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const closeTicket = useMutation({
    mutationFn: (id: number) => adminApiTicket(`/api/support/tickets/${id}/close`, "POST"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ticket-detail", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
      onRefresh();
      toast({ title: "Ticket closed" });
    },
  });

  const reopenTicket = useMutation({
    mutationFn: (id: number) => adminApiTicket(`/api/support/tickets/${id}/reopen`, "POST"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-ticket-detail", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
      onRefresh();
      toast({ title: "Ticket reopened" });
    },
  });

  const tickets: any[] = data ?? [];
  const filtered = filter === "all" ? tickets : tickets.filter((t) => t.status === filter);

  const STATUS_COLOR: Record<string, string> = {
    open:     "bg-primary/10 text-primary border-primary/20",
    answered: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    closed:   "bg-muted text-muted-foreground border-border",
  };

  const counts = {
    all:      tickets.length,
    open:     tickets.filter((t) => t.status === "open").length,
    answered: tickets.filter((t) => t.status === "answered").length,
    closed:   tickets.filter((t) => t.status === "closed").length,
  };

  if (selectedId !== null) {
    return (
      <div className="space-y-3">
        <button onClick={() => setSelectedId(null)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
          ← Back to tickets
        </button>
        {detailLoading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}</div>
        ) : (
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            {/* Header */}
            <div className="px-4 py-3 border-b border-border">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{ticketDetail?.subject}</p>
                  <p className="text-[10px] text-muted-foreground">
                    #{ticketDetail?.id} · @{tickets.find(t => t.id === selectedId)?.username ?? "user"} · {ticketDetail?.status}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {ticketDetail?.status !== "closed" ? (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => closeTicket.mutate(selectedId)}>
                      Close
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => reopenTicket.mutate(selectedId)}>
                      <RefreshCw size={10} className="mr-1" /> Reopen
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="max-h-[50vh] overflow-y-auto px-4 py-3 space-y-3">
              {ticketDetail?.messages?.map((msg: any) => (
                <div key={msg.id} className={cn("flex", msg.isAdmin ? "justify-start" : "justify-end")}>
                  <div className={cn(
                    "max-w-[80%] rounded-2xl px-3 py-2 text-xs",
                    msg.isAdmin ? "bg-primary text-white rounded-tl-sm" : "bg-muted text-foreground rounded-tr-sm border border-border"
                  )}>
                    <p className={cn("text-[9px] font-semibold mb-0.5", msg.isAdmin ? "text-white/70" : "text-muted-foreground")}>
                      {msg.isAdmin ? "Support Team" : "User"}
                    </p>
                    <p className="leading-relaxed">{msg.message}</p>
                  </div>
                </div>
              ))}
              {!ticketDetail?.messages?.length && (
                <p className="text-center text-xs text-muted-foreground py-4">No messages yet</p>
              )}
            </div>

            {/* Reply */}
            {ticketDetail?.status !== "closed" && (
              <div className="px-4 py-3 border-t border-border">
                <div className="flex gap-2">
                  <Input
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Type admin reply..."
                    className="flex-1 h-9 text-sm"
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && reply.trim()) sendReply.mutate(reply.trim()); }}
                  />
                  <Button
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={() => reply.trim() && sendReply.mutate(reply.trim())}
                    disabled={sendReply.isPending || !reply.trim()}
                  >
                    <Send size={13} />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header + refresh */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-foreground">Support Tickets</p>
        <button onClick={onRefresh} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
          <RefreshCw size={11} /> Refresh
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {(["all", "open", "answered", "closed"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all border",
              filter === f ? "bg-primary text-white border-primary" : "bg-muted/30 text-muted-foreground border-border hover:border-primary/50"
            )}
          >
            {f} {counts[f] > 0 && <span className="ml-0.5 opacity-70">({counts[f]})</span>}
          </button>
        ))}
      </div>

      {/* Ticket list */}
      {!filtered.length ? (
        <div className="py-10 text-center text-sm text-muted-foreground bg-card border border-border rounded-2xl">
          No {filter === "all" ? "" : filter} tickets
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl divide-y divide-border shadow-sm overflow-hidden">
          {filtered.map((ticket: any) => (
            <button
              key={ticket.id}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors text-left"
              onClick={() => setSelectedId(ticket.id)}
            >
              <div className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize shrink-0", STATUS_COLOR[ticket.status] ?? "bg-muted")}>
                {ticket.status}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{ticket.subject}</p>
                <p className="text-[10px] text-muted-foreground">
                  @{ticket.username ?? ticket.fullName ?? "user"} · #{ticket.id}
                </p>
              </div>
              <ChevronRight size={14} className="text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

async function adminApiTicket(url: string, method = "GET", body?: any) {
  const res = await fetch(url, {
    method, credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error((await res.json()).message ?? "Request failed");
  return res.json();
}

const FAQ_CATEGORIES = ["General", "Account", "Deposits", "Withdrawals", "Opportunities", "Referrals", "Security", "Other"];

interface FaqItem {
  id: number;
  question: string;
  answer: string;
  category: string;
  isActive: boolean;
  sortOrder: number;
}

const BLANK_FAQ = { question: "", answer: "", category: "General", isActive: true, sortOrder: 0 };

function ReferralSalaryTab({ salaryData, salarySettings, toast, onRefresh }: {
  salaryData: any[];
  salarySettings: Record<string, string>;
  toast: any;
  onRefresh: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [overrideModal, setOverrideModal] = useState<any | null>(null);
  const [overrideTier, setOverrideTier] = useState("");
  const [overrideSalary, setOverrideSalary] = useState("");
  const [overrideNotes, setOverrideNotes] = useState("");
  const [settingsForm, setSettingsForm] = useState({
    enabled: salarySettings?.salary_program_enabled !== "false",
    tier1Volume: salarySettings?.salary_tier1_volume ?? "1500",
    tier1Amount: salarySettings?.salary_tier1_amount ?? "100",
    tier2Volume: salarySettings?.salary_tier2_volume ?? "3500",
    tier2Amount: salarySettings?.salary_tier2_amount ?? "300",
  });

  useEffect(() => {
    if (!salarySettings) return;
    setSettingsForm({
      enabled: salarySettings.salary_program_enabled !== "false",
      tier1Volume: salarySettings.salary_tier1_volume ?? "1500",
      tier1Amount: salarySettings.salary_tier1_amount ?? "100",
      tier2Volume: salarySettings.salary_tier2_volume ?? "3500",
      tier2Amount: salarySettings.salary_tier2_amount ?? "300",
    });
  }, [salarySettings]);

  const saveSettings = async () => {
    setSaving(true);
    try {
      await adminApi("/admin/referral-salary/settings", "PUT", {
        enabled: settingsForm.enabled,
        tier1Volume: settingsForm.tier1Volume,
        tier1Amount: settingsForm.tier1Amount,
        tier2Volume: settingsForm.tier2Volume,
        tier2Amount: settingsForm.tier2Amount,
      });
      toast({ title: "Salary settings saved" });
      onRefresh();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const recalculate = async () => {
    setRecalculating(true);
    try {
      const r = await adminApi("/admin/referral-salary/recalculate", "POST");
      toast({ title: "Recalculation complete", description: `Updated: ${r.updated} · Paid: ${r.paid}` });
      onRefresh();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message, variant: "destructive" });
    } finally {
      setRecalculating(false);
    }
  };

  const saveOverride = async () => {
    if (!overrideModal) return;
    try {
      await adminApi(`/admin/referral-salary/${overrideModal.userId}/override`, "PUT", {
        tier: overrideTier ? parseInt(overrideTier) : null,
        salary: overrideSalary || null,
        notes: overrideNotes || null,
      });
      toast({ title: "Override saved" });
      setOverrideModal(null);
      onRefresh();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message, variant: "destructive" });
    }
  };

  const records: any[] = salaryData ?? [];
  const activeCount = records.filter((r) => r.isActive).length;
  const totalMonthly = records.filter((r) => r.isActive).reduce((s: number, r: any) => s + r.monthlySalary, 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Active Recipients", val: activeCount, color: "text-emerald-600" },
          { label: "Monthly Liability", val: formatUSDT(totalMonthly), color: "text-amber-600" },
          { label: "Total Participants", val: records.length, color: "text-primary" },
        ].map(({ label, val, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-3 text-center shadow-sm">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className={cn("font-bold text-base mt-1", color)}>{val}</p>
          </div>
        ))}
      </div>

      {/* Settings */}
      <div className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-sm text-foreground">Salary Program Settings</p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{settingsForm.enabled ? "Enabled" : "Disabled"}</span>
            <Switch checked={settingsForm.enabled} onCheckedChange={(v) => setSettingsForm((f) => ({ ...f, enabled: v }))} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-medium text-foreground mb-1">Tier 1 Volume (USDT)</p>
            <Input value={settingsForm.tier1Volume} onChange={(e) => setSettingsForm((f) => ({ ...f, tier1Volume: e.target.value }))} placeholder="1500" className="h-9 text-sm" />
          </div>
          <div>
            <p className="text-xs font-medium text-foreground mb-1">Tier 1 Monthly Salary</p>
            <Input value={settingsForm.tier1Amount} onChange={(e) => setSettingsForm((f) => ({ ...f, tier1Amount: e.target.value }))} placeholder="100" className="h-9 text-sm" />
          </div>
          <div>
            <p className="text-xs font-medium text-foreground mb-1">Tier 2 Volume (USDT)</p>
            <Input value={settingsForm.tier2Volume} onChange={(e) => setSettingsForm((f) => ({ ...f, tier2Volume: e.target.value }))} placeholder="3500" className="h-9 text-sm" />
          </div>
          <div>
            <p className="text-xs font-medium text-foreground mb-1">Tier 2 Monthly Salary</p>
            <Input value={settingsForm.tier2Amount} onChange={(e) => setSettingsForm((f) => ({ ...f, tier2Amount: e.target.value }))} placeholder="300" className="h-9 text-sm" />
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="flex-1 h-9 text-xs" onClick={saveSettings} disabled={saving}>
            {saving ? "Saving…" : "Save Settings"}
          </Button>
          <Button size="sm" variant="outline" className="flex-1 h-9 text-xs gap-1.5" onClick={recalculate} disabled={recalculating}>
            <RefreshCw size={12} className={recalculating ? "animate-spin" : ""} />
            {recalculating ? "Recalculating…" : "Recalculate All"}
          </Button>
        </div>
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3">
          <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
            <strong>How it works:</strong> Tier 1 requires referrals with ≥{settingsForm.tier1Volume} USDT active investment volume → earns {settingsForm.tier1Amount} USDT/month. Tier 2 requires ≥{settingsForm.tier2Volume} USDT volume → earns {settingsForm.tier2Amount} USDT/month. Recalculated daily by the ROI engine.
          </p>
        </div>
      </div>

      {/* Records list */}
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <p className="font-semibold text-sm text-foreground">Salary Recipients</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Sorted by referral investment volume</p>
        </div>
        {records.length === 0 ? (
          <div className="py-10 text-center">
            <DollarSign size={24} className="text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No salary records yet — run Recalculate All to populate</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {records.map((r: any) => (
              <div key={r.userId} className="px-4 py-3 flex items-center gap-3">
                <div className={cn(
                  "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold",
                  r.isActive ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"
                )}>
                  {r.isActive ? `T${r.currentTier}` : "—"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">@{r.username}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {formatUSDT(r.currentVolume)} vol · {r.isActive ? `${formatUSDT(r.monthlySalary)}/mo` : "Not qualified"}
                    {r.nextPaymentDate && r.isActive ? ` · Next: ${formatDate(r.nextPaymentDate)}` : ""}
                  </p>
                  {r.notes && <p className="text-[10px] text-amber-600 mt-0.5">{r.notes}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-semibold text-foreground">{formatUSDT(r.totalSalaryPaid)}</p>
                  <p className="text-[10px] text-muted-foreground">total paid</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs shrink-0"
                  onClick={() => {
                    setOverrideModal(r);
                    setOverrideTier(r.currentTier ? String(r.currentTier) : "");
                    setOverrideSalary(r.monthlySalary ? String(r.monthlySalary) : "");
                    setOverrideNotes(r.notes ?? "");
                  }}
                >
                  Edit
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Override Modal */}
      <Dialog open={overrideModal !== null} onOpenChange={(o) => { if (!o) setOverrideModal(null); }}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Override: @{overrideModal?.username}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Tier (1 or 2, blank to remove)</Label>
              <Input value={overrideTier} onChange={(e) => setOverrideTier(e.target.value)} placeholder="Leave blank to remove" className="h-9 mt-1 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Monthly Salary (USDT)</Label>
              <Input value={overrideSalary} onChange={(e) => setOverrideSalary(e.target.value)} placeholder="Custom amount" className="h-9 mt-1 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Notes (visible to admin only)</Label>
              <Input value={overrideNotes} onChange={(e) => setOverrideNotes(e.target.value)} placeholder="e.g. Manual override" className="h-9 mt-1 text-sm" />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1 h-9 text-sm" onClick={() => setOverrideModal(null)}>Cancel</Button>
            <Button className="flex-1 h-9 text-sm" onClick={saveOverride}>Save Override</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FaqTab({ toast }: { toast: any }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FaqItem | null>(null);
  const [form, setForm] = useState({ ...BLANK_FAQ });
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [previewId, setPreviewId] = useState<number | null>(null);

  const { data: faqs = [], isLoading, refetch } = useQuery<FaqItem[]>({
    queryKey: ["admin-faqs"],
    queryFn: () => adminApi("/admin/faqs"),
    staleTime: 15000,
  });

  const save = useMutation({
    mutationFn: (data: typeof form) =>
      editing
        ? adminApi(`/admin/faqs/${editing.id}`, "PUT", data)
        : adminApi("/admin/faqs", "POST", data),
    onSuccess: () => {
      toast({ title: editing ? "FAQ updated" : "FAQ created" });
      setDialogOpen(false);
      setEditing(null);
      setForm({ ...BLANK_FAQ });
      queryClient.invalidateQueries({ queryKey: ["admin-faqs"] });
      queryClient.invalidateQueries({ queryKey: ["faqs"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const toggle = useMutation({
    mutationFn: (id: number) => adminApi(`/admin/faqs/${id}/toggle`, "PATCH"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-faqs"] });
      queryClient.invalidateQueries({ queryKey: ["faqs"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => adminApi(`/admin/faqs/${id}`, "DELETE"),
    onSuccess: () => {
      toast({ title: "FAQ deleted" });
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ["admin-faqs"] });
      queryClient.invalidateQueries({ queryKey: ["faqs"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const reorder = useMutation({
    mutationFn: (orders: { id: number; sortOrder: number }[]) =>
      adminApi("/admin/faqs/reorder", "PATCH", { orders }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-faqs"] });
      queryClient.invalidateQueries({ queryKey: ["faqs"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  function openNew() {
    setEditing(null);
    setForm({ ...BLANK_FAQ, sortOrder: faqs.length });
    setDialogOpen(true);
  }

  function openEdit(faq: FaqItem) {
    setEditing(faq);
    setForm({ question: faq.question, answer: faq.answer, category: faq.category, isActive: faq.isActive, sortOrder: faq.sortOrder });
    setDialogOpen(true);
  }

  function moveItem(faq: FaqItem, dir: -1 | 1) {
    const sorted = [...faqs].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
    const idx = sorted.findIndex((f) => f.id === faq.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const orders = sorted.map((f, i) => {
      if (i === idx) return { id: f.id, sortOrder: sorted[swapIdx].sortOrder };
      if (i === swapIdx) return { id: f.id, sortOrder: sorted[idx].sortOrder };
      return { id: f.id, sortOrder: f.sortOrder };
    });
    reorder.mutate(orders);
  }

  const searchLower = search.toLowerCase();
  const filtered = [...faqs]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
    .filter((f) => {
      if (categoryFilter !== "all" && f.category !== categoryFilter) return false;
      if (search && !f.question.toLowerCase().includes(searchLower) && !f.answer.toLowerCase().includes(searchLower)) return false;
      return true;
    });

  const allCategories = Array.from(new Set(faqs.map((f) => f.category)));
  const previewFaq = faqs.find((f) => f.id === previewId);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="font-bold text-sm text-foreground">FAQ Management</p>
          <p className="text-xs text-muted-foreground mt-0.5">{faqs.length} total · {faqs.filter(f => f.isActive).length} active</p>
        </div>
        <Button size="sm" onClick={openNew} className="h-8 text-xs gap-1.5">
          <Plus size={13} /> Add FAQ
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search FAQs…"
            className="pl-7 h-8 text-xs"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="h-8 text-xs w-32">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {allCategories.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* FAQ List */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center bg-card border border-border rounded-2xl">
          <p className="text-sm font-medium text-foreground">No FAQs found</p>
          <p className="text-xs text-muted-foreground mt-1">
            {search || categoryFilter !== "all" ? "Try clearing filters" : "Click \"Add FAQ\" to create the first one"}
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl divide-y divide-border shadow-sm overflow-hidden">
          {filtered.map((faq, idx) => (
            <div key={faq.id} className="px-4 py-3 space-y-1">
              <div className="flex items-start gap-2">
                {/* Sort arrows */}
                <div className="flex flex-col gap-0.5 shrink-0 mt-0.5">
                  <button
                    onClick={() => moveItem(faq, -1)}
                    disabled={idx === 0 || reorder.isPending}
                    className="p-0.5 rounded hover:bg-muted disabled:opacity-30 transition-colors"
                  >
                    <ChevronRight size={11} className="-rotate-90 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => moveItem(faq, 1)}
                    disabled={idx === filtered.length - 1 || reorder.isPending}
                    className="p-0.5 rounded hover:bg-muted disabled:opacity-30 transition-colors"
                  >
                    <ChevronRight size={11} className="rotate-90 text-muted-foreground" />
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full border", faq.isActive ? "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800" : "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400")}>
                      {faq.isActive ? "Active" : "Inactive"}
                    </span>
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                      {faq.category}
                    </span>
                    <span className="text-[9px] text-muted-foreground">#{faq.sortOrder}</span>
                  </div>
                  <p className="text-xs font-semibold text-foreground mt-1 leading-snug line-clamp-1">{faq.question}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{faq.answer}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setPreviewId(previewId === faq.id ? null : faq.id)}
                    className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    title="Preview"
                  >
                    <Search size={12} />
                  </button>
                  <button
                    onClick={() => toggle.mutate(faq.id)}
                    disabled={toggle.isPending}
                    className={cn("p-1.5 rounded-lg hover:bg-muted transition-colors", faq.isActive ? "text-emerald-500" : "text-zinc-400")}
                    title={faq.isActive ? "Disable" : "Enable"}
                  >
                    {faq.isActive ? <Check size={12} /> : <X size={12} />}
                  </button>
                  <button
                    onClick={() => openEdit(faq)}
                    className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    title="Edit"
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    onClick={() => setDeleteId(faq.id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-muted-foreground hover:text-red-500 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              {/* Inline preview */}
              {previewId === faq.id && (
                <div className="ml-6 mt-2 p-3 bg-muted/40 rounded-xl border border-border">
                  <p className="text-xs font-semibold text-foreground mb-1">{faq.question}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditing(null); setForm({ ...BLANK_FAQ }); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit FAQ" : "Add New FAQ"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div>
              <Label className="text-xs">Question *</Label>
              <Input
                value={form.question}
                onChange={(e) => setForm(f => ({ ...f, question: e.target.value }))}
                placeholder="What is your question?"
                className="mt-1 h-9 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Answer *</Label>
              <Textarea
                value={form.answer}
                onChange={(e) => setForm(f => ({ ...f, answer: e.target.value }))}
                placeholder="Provide a detailed answer…"
                className="mt-1 text-sm min-h-[100px] resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger className="mt-1 h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FAQ_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Sort Order</Label>
                <Input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm(f => ({ ...f, sortOrder: parseInt(e.target.value, 10) || 0 }))}
                  className="mt-1 h-9 text-sm"
                  min={0}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.isActive}
                onCheckedChange={(v) => setForm(f => ({ ...f, isActive: v }))}
                id="faq-active"
              />
              <Label htmlFor="faq-active" className="text-xs cursor-pointer">
                {form.isActive ? "Active (visible to users)" : "Inactive (hidden from users)"}
              </Label>
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                className="flex-1 h-9 text-sm"
                onClick={() => { setDialogOpen(false); setEditing(null); setForm({ ...BLANK_FAQ }); }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 h-9 text-sm"
                onClick={() => save.mutate(form)}
                disabled={save.isPending || !form.question.trim() || !form.answer.trim()}
              >
                {save.isPending ? "Saving…" : editing ? "Save Changes" : "Create FAQ"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteId !== null} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Delete FAQ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This action cannot be undone. The FAQ will be permanently removed.</p>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1 h-9 text-sm" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              className="flex-1 h-9 text-sm"
              onClick={() => deleteId !== null && remove.mutate(deleteId)}
              disabled={remove.isPending}
            >
              {remove.isPending ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Announcements Admin Tab ────────────────────────────────────────────────────

interface AnnouncementItem {
  id: number;
  title: string;
  content: string;
  isActive: boolean;
  priority: number;
  showToNewUsers: boolean;
  showToExistingUsers: boolean;
  isPinned: boolean;
  scheduledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const BLANK_ANN = {
  title: "",
  content: "",
  isActive: false,
  priority: 0,
  showToNewUsers: true,
  showToExistingUsers: true,
  isPinned: false,
  scheduledAt: "",
};

const EXAMPLE_CONTENT = `🎉 Welcome to Wexora Global

We are pleased to introduce our investment platform.

✅ Daily ROI Opportunities
✅ Referral Rewards
✅ Monthly Salary Program
✅ Community Hub Access
✅ Secure Wallet System

Important Notes:

• Deposits require admin approval.
• Withdrawals are processed manually.
• Keep your account secure.
• Never share your password.

Thank you for being part of Wexora.

— Wexora Team`;

function AnnouncementsTab({ toast }: { toast: any }) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editing, setEditing] = useState<AnnouncementItem | null>(null);
  const [form, setForm] = useState({ ...BLANK_ANN });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [popupSettings, setPopupSettings] = useState({
    announcement_popup_enabled: "true",
    announcement_popup_frequency_hours: "24",
    announcement_popup_every_login: "false",
  });

  const { data: items = [], isLoading } = useQuery<AnnouncementItem[]>({
    queryKey: ["admin-announcements"],
    queryFn: () => adminApi("/admin/announcements"),
    staleTime: 10000,
  });

  const { data: allSettings } = useQuery<Record<string, string>>({
    queryKey: ["admin-settings-ann"],
    queryFn: () => adminApi("/admin/settings"),
    staleTime: 30000,
  });

  useEffect(() => {
    if (allSettings) {
      setPopupSettings({
        announcement_popup_enabled: allSettings.announcement_popup_enabled ?? "true",
        announcement_popup_frequency_hours: allSettings.announcement_popup_frequency_hours ?? "24",
        announcement_popup_every_login: allSettings.announcement_popup_every_login ?? "false",
      });
    }
  }, [allSettings]);

  const saveMutation = useMutation({
    mutationFn: (data: typeof BLANK_ANN) =>
      editing
        ? adminApi(`/admin/announcements/${editing.id}`, "PUT", data)
        : adminApi("/admin/announcements", "POST", data),
    onSuccess: () => {
      toast({ title: editing ? "Announcement updated" : "Announcement created" });
      setDialogOpen(false);
      setEditing(null);
      setForm({ ...BLANK_ANN });
      queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: number) => adminApi(`/admin/announcements/${id}/toggle`, "PATCH"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-announcements"] }),
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => adminApi(`/admin/announcements/${id}`, "DELETE"),
    onSuccess: () => {
      toast({ title: "Announcement deleted" });
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const forceShowMutation = useMutation({
    mutationFn: (id: number) => adminApi(`/admin/announcements/${id}/force-show`, "POST"),
    onSuccess: () => toast({ title: "Views cleared — popup will re-show for all users" }),
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const saveSettingsMutation = useMutation({
    mutationFn: (settings: Record<string, string>) => adminApi("/admin/settings", "PUT", settings),
    onSuccess: () => {
      toast({ title: "Popup settings saved" });
      setSettingsOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-settings-ann"] });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  function openCreate() {
    setEditing(null);
    setForm({ ...BLANK_ANN });
    setDialogOpen(true);
  }

  function openEdit(item: AnnouncementItem) {
    setEditing(item);
    setForm({
      title: item.title,
      content: item.content,
      isActive: item.isActive,
      priority: item.priority,
      showToNewUsers: item.showToNewUsers,
      showToExistingUsers: item.showToExistingUsers,
      isPinned: item.isPinned,
      scheduledAt: item.scheduledAt ? item.scheduledAt.slice(0, 16) : "",
    });
    setDialogOpen(true);
  }

  function handleSave() {
    if (!form.title.trim()) { toast({ title: "Title is required", variant: "destructive" }); return; }
    if (!form.content.trim()) { toast({ title: "Content is required", variant: "destructive" }); return; }
    saveMutation.mutate({ ...form });
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-sm font-bold text-foreground">Announcement Popups</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Manage popup announcements shown to users after login</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => setSettingsOpen(true)}>
            <Settings size={12} />Popup Settings
          </Button>
          <Button size="sm" className="h-8 text-xs gap-1.5" onClick={openCreate}>
            <Plus size={12} />New Announcement
          </Button>
        </div>
      </div>

      {/* Disabled banner */}
      {popupSettings.announcement_popup_enabled === "false" && (
        <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2">
          <AlertTriangle size={13} className="text-amber-500 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
            Announcement popup is <strong>disabled</strong>. Enable it in Popup Settings.
          </p>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : items.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          <Megaphone size={32} className="mx-auto text-muted-foreground mb-3 opacity-40" />
          <p className="text-sm font-semibold text-foreground">No announcements yet</p>
          <p className="text-xs text-muted-foreground mt-1">Create your first popup announcement.</p>
          <Button size="sm" className="mt-4 h-8 text-xs gap-1.5" onClick={openCreate}>
            <Plus size={12} />Create Announcement
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className={cn(
              "bg-card border rounded-2xl p-4 shadow-sm",
              item.isActive ? "border-emerald-200 dark:border-emerald-800" : "border-border",
              item.isPinned && "ring-1 ring-primary/30"
            )}>
              <div className="flex items-start gap-3">
                <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", item.isActive ? "bg-emerald-50 dark:bg-emerald-950/40" : "bg-muted")}>
                  <Megaphone size={15} className={item.isActive ? "text-emerald-600" : "text-muted-foreground"} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <span className="text-sm font-semibold text-foreground">{item.title}</span>
                    {item.isPinned && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                        <Pin size={9} />Pinned
                      </span>
                    )}
                    <span className={cn(
                      "text-[10px] font-semibold px-1.5 py-0.5 rounded-full border",
                      item.isActive ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400" : "bg-muted text-muted-foreground border-border"
                    )}>
                      {item.isActive ? "Active" : "Inactive"}
                    </span>
                    {item.scheduledAt && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                        <Calendar size={9} />Scheduled
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{item.content}</p>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users2 size={9} />
                      {item.showToNewUsers && item.showToExistingUsers ? "All users" : item.showToNewUsers ? "New users only" : item.showToExistingUsers ? "Existing users only" : "Hidden from all"}
                    </span>
                    <span>Priority: {item.priority}</span>
                    <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => { setEditing(item); setForm({ title: item.title, content: item.content, isActive: item.isActive, priority: item.priority, showToNewUsers: item.showToNewUsers, showToExistingUsers: item.showToExistingUsers, isPinned: item.isPinned, scheduledAt: item.scheduledAt ? item.scheduledAt.slice(0, 16) : "" }); setPreviewOpen(true); }} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Preview">
                    <Eye size={13} />
                  </button>
                  <button onClick={() => openEdit(item)} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Edit">
                    <Edit2 size={13} />
                  </button>
                  <button onClick={() => toggleMutation.mutate(item.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title={item.isActive ? "Deactivate" : "Activate"}>
                    {item.isActive ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                  <button onClick={() => forceShowMutation.mutate(item.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors" title="Force re-show to all users">
                    <RefreshCw size={13} />
                  </button>
                  <button onClick={() => setDeleteId(item.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors" title="Delete">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) { setDialogOpen(false); setEditing(null); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Announcement" : "Create Announcement"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div>
              <Label className="text-xs font-semibold mb-1.5 block">Title *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="🎉 Welcome to Wexora Global" className="h-9 text-sm" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label className="text-xs font-semibold">Content *</Label>
                <button type="button" className="text-[10px] text-primary underline" onClick={() => setForm(f => ({ ...f, content: EXAMPLE_CONTENT }))}>Load example</button>
              </div>
              <Textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} placeholder="Announcement content... Supports emojis ✅, bullet points •, numbered lists, [links](url)" className="text-sm min-h-[180px] resize-y font-mono" />
              <p className="text-[10px] text-muted-foreground mt-1">Supports emojis, bullets (• - *), numbered lists, [links](url), and line breaks.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold mb-1.5 block">Priority (higher = first)</Label>
                <Input type="number" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: parseInt(e.target.value) || 0 }))} className="h-9 text-sm" min={0} />
              </div>
              <div>
                <Label className="text-xs font-semibold mb-1.5 block">Schedule (optional)</Label>
                <Input type="datetime-local" value={form.scheduledAt} onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))} className="h-9 text-sm" />
              </div>
            </div>
            <div className="bg-muted/50 rounded-xl p-3 space-y-2.5">
              <p className="text-xs font-semibold text-foreground">Display Settings</p>
              {([
                { key: "isActive" as const, label: "Active (show to users)", desc: "Popup will be shown when active" },
                { key: "isPinned" as const, label: "Pinned (highest priority)", desc: "Always shown before other announcements" },
                { key: "showToNewUsers" as const, label: "Show to new users", desc: "Accounts created less than 24 hours ago" },
                { key: "showToExistingUsers" as const, label: "Show to existing users", desc: "Accounts older than 24 hours" },
              ]).map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-foreground">{label}</p>
                    <p className="text-[10px] text-muted-foreground">{desc}</p>
                  </div>
                  <Switch checked={Boolean(form[key])} onCheckedChange={v => setForm(f => ({ ...f, [key]: v }))} />
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1 h-9 text-sm" onClick={() => setPreviewOpen(true)} type="button">
                <Eye size={13} className="mr-1.5" />Preview
              </Button>
              <Button className="flex-1 h-9 text-sm" onClick={handleSave} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving…" : editing ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden rounded-2xl">
          <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-border">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Megaphone size={18} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-primary mb-0.5">Wexora Global</p>
              <h2 className="text-base font-bold text-foreground leading-tight">{form.title || "Announcement Title"}</h2>
            </div>
            <button onClick={() => setPreviewOpen(false)} className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted">
              <X size={16} />
            </button>
          </div>
          <div className="px-5 py-4 text-sm text-foreground leading-relaxed max-h-[50vh] overflow-y-auto whitespace-pre-wrap">
            {form.content || "Announcement content preview will appear here..."}
          </div>
          <div className="px-5 pb-5 pt-4 border-t border-border space-y-2">
            <Button className="w-full h-11 font-semibold text-sm rounded-xl" onClick={() => setPreviewOpen(false)}>I Understand</Button>
            <Button variant="outline" className="w-full h-10 text-sm rounded-xl gap-2" onClick={() => setPreviewOpen(false)}>
              <MessageSquare size={14} />View Community
            </Button>
            <p className="text-center text-[10px] text-muted-foreground pt-1">Preview — actions have no effect here.</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={deleteId !== null} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>Delete Announcement?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This cannot be undone. All view records will also be removed.</p>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1 h-9 text-sm" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" className="flex-1 h-9 text-sm" onClick={() => deleteId !== null && deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Popup Settings */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Popup Settings</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Enable Announcement Popup</p>
                <p className="text-xs text-muted-foreground">Show announcement popups to users</p>
              </div>
              <Switch checked={popupSettings.announcement_popup_enabled === "true"} onCheckedChange={v => setPopupSettings(s => ({ ...s, announcement_popup_enabled: v ? "true" : "false" }))} />
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1.5 block">Popup Frequency (hours)</Label>
              <Input type="number" min={1} value={popupSettings.announcement_popup_frequency_hours} onChange={e => setPopupSettings(s => ({ ...s, announcement_popup_frequency_hours: e.target.value }))} className="h-9 text-sm" />
              <p className="text-[10px] text-muted-foreground mt-1">How often to re-show the popup. Default: 24 hours.</p>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Show On Every Login</p>
                <p className="text-xs text-muted-foreground">Show popup every time the user logs in (ignores frequency)</p>
              </div>
              <Switch checked={popupSettings.announcement_popup_every_login === "true"} onCheckedChange={v => setPopupSettings(s => ({ ...s, announcement_popup_every_login: v ? "true" : "false" }))} />
            </div>
            <Button className="w-full h-9 text-sm" onClick={() => saveSettingsMutation.mutate(popupSettings)} disabled={saveSettingsMutation.isPending}>
              {saveSettingsMutation.isPending ? "Saving…" : "Save Settings"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

