import { useState, useEffect } from "react";
import { Users, DollarSign, FileCheck, ArrowUpRight, ArrowDownLeft, Bell, Search, Check, X, ChevronRight, TrendingUp, Newspaper, Plus, Edit2, Network, Trash2, Settings, FileText, KeyRound, Zap, RefreshCcw, CheckCircle2, AlertCircle, Smartphone, Download, Info, Link2, ExternalLink, Server, RotateCcw, BarChart3, MessageSquare, Send, Activity, RefreshCw, Tag } from "lucide-react";
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

type Tab = "analytics" | "users" | "kyc" | "withdrawals" | "deposits" | "plans" | "networks" | "news" | "broadcast" | "settings" | "logs" | "app-settings" | "about" | "statistics" | "tickets";

async function adminApi(path: string, method = "GET", body?: any) {
  const res = await fetch(`/api${path}`, {
    method, credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error((await res.json()).message ?? "Request failed");
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
  const [roiRunning, setRoiRunning] = useState(false);
  const [roiResult, setRoiResult] = useState<{ processed: number; matured: number; skipped: number } | null>(null);
  const [wdTxHash, setWdTxHash] = useState("");
  const [userDetail, setUserDetail] = useState<any>(null);
  const [userDetailLoading, setUserDetailLoading] = useState(false);
  const { data: analytics, isLoading: analyticsLoading } = useAdminGetAnalytics({ query: { queryKey: getAdminGetAnalyticsQueryKey(), staleTime: 30000 } });
  const { data: usersData } = useAdminGetUsers({ search: search || undefined, limit: 20 }, { query: { queryKey: getAdminGetUsersQueryKey({ search: search || undefined, limit: 20 }), staleTime: 20000 } });
  const { data: kycData } = useAdminGetKycSubmissions({ status: kycFilter }, { query: { queryKey: getAdminGetKycSubmissionsQueryKey({ status: kycFilter }), staleTime: 20000 } });
  const { data: wdData } = useAdminGetWithdrawals({ status: wdFilter }, { query: { queryKey: getAdminGetWithdrawalsQueryKey({ status: wdFilter }), staleTime: 20000 } });

  const { data: plans } = useQuery({ queryKey: ["admin-plans"], queryFn: () => adminApi("/admin/plans"), staleTime: 30000 });
  const { data: networks } = useQuery({ queryKey: ["admin-networks"], queryFn: () => adminApi("/admin/deposit-networks"), staleTime: 30000 });
  const { data: newsData } = useQuery({ queryKey: ["admin-news"], queryFn: () => adminApi("/admin/news"), staleTime: 30000 });
  const { data: depData, isLoading: depLoading } = useQuery({ queryKey: ["admin-deposits", depFilter], queryFn: () => adminApi(`/admin/deposits?status=${depFilter}`), staleTime: 20000, enabled: tab === "deposits" });
  const { data: settingsData } = useQuery({ queryKey: ["admin-settings"], queryFn: () => adminApi("/admin/settings"), staleTime: 30000, enabled: tab === "settings" });
  const { data: resetLogs } = useQuery({ queryKey: ["admin-reset-logs"], queryFn: () => adminApi("/admin/password-reset-logs"), staleTime: 30000, enabled: tab === "logs" });
  const { data: appSettings, refetch: refetchAppSettings } = useQuery({ queryKey: ["admin-app-settings"], queryFn: () => adminApi("/admin/app-settings"), staleTime: 30000, enabled: tab === "app-settings" });
  const { data: aboutData, refetch: refetchAbout } = useQuery({ queryKey: ["admin-about"], queryFn: () => adminApi("/admin/about"), staleTime: 30000, enabled: tab === "about" });
  const { data: statisticsData, refetch: refetchStatistics } = useQuery({ queryKey: ["admin-statistics"], queryFn: () => adminApi("/admin/statistics"), staleTime: 30000, enabled: tab === "statistics" });
  const { data: ticketsData, refetch: refetchTickets } = useQuery({ queryKey: ["admin-tickets"], queryFn: () => adminApi("/support/tickets"), staleTime: 15000, enabled: tab === "tickets" });

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

  const savePlan = useMutation({
    mutationFn: (data: any) => planModal?.id ? adminApi(`/admin/plans/${planModal.id}`, "PUT", data) : adminApi("/admin/plans", "POST", data),
    onSuccess: () => { toast({ title: "Plan saved" }); setPlanModal(null); queryClient.invalidateQueries({ queryKey: ["admin-plans"] }); },
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

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "analytics", label: "Analytics", icon: TrendingUp },
    { id: "users", label: "Users", icon: Users },
    { id: "kyc", label: "KYC", icon: FileCheck },
    { id: "withdrawals", label: "Withdrawals", icon: ArrowUpRight },
    { id: "deposits", label: "Deposits", icon: ArrowDownLeft },
    { id: "plans", label: "Plans", icon: DollarSign },
    { id: "networks", label: "Networks", icon: Network },
    { id: "news", label: "News", icon: Newspaper },
    { id: "broadcast", label: "Broadcast", icon: Bell },
    { id: "statistics", label: "Statistics", icon: BarChart3 },
    { id: "tickets", label: "Tickets", icon: MessageSquare },
    { id: "app-settings", label: "App Settings", icon: Smartphone },
    { id: "about", label: "About Us", icon: Info },
    { id: "settings", label: "Settings", icon: Settings },
    { id: "logs", label: "Logs", icon: FileText },
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
  ] : [];

  return (
    <AppLayout title="Admin Panel">
      <div className="pb-24">
        {/* Tabs (horizontal scroll) */}
        <div className="flex gap-1 overflow-x-auto px-4 py-3 border-b border-border bg-background sticky top-0 z-10">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all", tab === id ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted")}>
              <Icon size={12} />{label}
            </button>
          ))}
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

              {/* ROI Payout Trigger */}
              <div className="bg-white border border-border rounded-2xl p-4 shadow-sm space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                    <Zap size={15} className="text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Manual ROI Payout</p>
                    <p className="text-[11px] text-muted-foreground">Force-credit daily earnings on all active investments now</p>
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
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge variant="outline" className={cn("text-[9px]", u.kycStatus === "approved" ? "text-emerald-600 bg-emerald-50" : "")}>{u.kycStatus}</Badge>
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

          {/* PLANS */}
          {tab === "plans" && (
            <div className="space-y-3">
              <Button className="w-full h-10 text-sm" onClick={() => setPlanModal({ name: "", description: "", minAmount: "", maxAmount: "", minRoiRate: 0.025, maxRoiRate: 0.030, durationDays: 30, riskLevel: "medium", features: [], isActive: true })}>
                <Plus size={15} className="mr-1.5" />Add Plan
              </Button>
              <div className="space-y-3">
                {plans?.map((plan: any) => (
                  <div key={plan.id} className="bg-white border border-border rounded-2xl p-4 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm">{plan.name}</p>
                          <Badge variant="outline" className={cn("text-[9px]", plan.isActive ? "text-emerald-600 bg-emerald-50" : "text-muted-foreground")}>{plan.isActive ? "Active" : "Disabled"}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{plan.description}</p>
                        <p className="text-xs text-primary font-semibold mt-1">
                          {(plan.minRoiRate * 100).toFixed(1)}%–{(plan.maxRoiRate * 100).toFixed(1)}% daily · {plan.durationDays}d · {formatUSDT(plan.minAmount)}–{formatUSDT(plan.maxAmount)}
                        </p>
                      </div>
                      <button onClick={() => setPlanModal({ ...plan })} className="p-2 rounded-lg hover:bg-muted ml-2"><Edit2 size={14} className="text-muted-foreground" /></button>
                    </div>
                  </div>
                ))}
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
            <div className="bg-white border border-border rounded-2xl p-4 shadow-sm space-y-3">
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

          {tab === "settings" && (
            <SettingsTab settingsData={settingsData} toast={toast} />
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
                <div className="flex justify-between items-center"><span className="text-muted-foreground">KYC</span>
                  <Badge variant="outline" className={cn("text-[9px] capitalize", userModal.kycStatus === "approved" ? "bg-emerald-50 text-emerald-600" : userModal.kycStatus === "rejected" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600")}>{userModal.kycStatus}</Badge>
                </div>
              </div>

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
                      { label: "Investment Profit", value: formatUSDT(userDetail?.totalInvestmentProfit ?? 0), color: "text-purple-500" },
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

      {/* Plan modal */}
      <Dialog open={!!planModal} onOpenChange={(o) => !o && setPlanModal(null)}>
        <DialogContent className="max-w-sm mx-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{planModal?.id ? "Edit Plan" : "New Plan"}</DialogTitle></DialogHeader>
          {planModal && (
            <div className="space-y-3 pt-2">
              {[
                { label: "Name", field: "name", type: "text", placeholder: "e.g. Gold Plan" },
                { label: "Description", field: "description", type: "text", placeholder: "Short description" },
                { label: "Min Amount (USDT)", field: "minAmount", type: "number", placeholder: "100" },
                { label: "Max Amount (USDT)", field: "maxAmount", type: "number", placeholder: "10000" },
                { label: "Min Daily ROI (e.g. 0.025)", field: "minRoiRate", type: "number", placeholder: "0.025" },
                { label: "Max Daily ROI (e.g. 0.030)", field: "maxRoiRate", type: "number", placeholder: "0.030" },
                { label: "Duration (days)", field: "durationDays", type: "number", placeholder: "30" },
              ].map(({ label, field, type, placeholder }) => (
                <div key={field}>
                  <Label className="text-xs">{label}</Label>
                  <Input type={type} value={planModal[field] ?? ""} onChange={(e) => setPlanModal((p: any) => ({ ...p, [field]: type === "number" ? parseFloat(e.target.value) : e.target.value }))} placeholder={placeholder} className="mt-1 h-9 text-sm" />
                </div>
              ))}
              <div>
                <Label className="text-xs">Risk Level</Label>
                <Select value={planModal.riskLevel} onValueChange={(v) => setPlanModal((p: any) => ({ ...p, riskLevel: v }))}>
                  <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{["low", "medium", "high"].map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Features (one per line)</Label>
                <Textarea value={Array.isArray(planModal.features) ? planModal.features.join("\n") : ""} onChange={(e) => setPlanModal((p: any) => ({ ...p, features: e.target.value.split("\n").filter(Boolean) }))} className="mt-1 text-xs min-h-[80px] resize-none" placeholder="Daily returns&#10;24/7 support&#10;Auto-compound" />
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={planModal.isActive} onChange={(e) => setPlanModal((p: any) => ({ ...p, isActive: e.target.checked }))} />Active</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={planModal.isFeatured} onChange={(e) => setPlanModal((p: any) => ({ ...p, isFeatured: e.target.checked }))} />Featured</label>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setPlanModal(null)}>Cancel</Button>
                <Button className="flex-1" onClick={() => savePlan.mutate(planModal)} disabled={savePlan.isPending}>Save Plan</Button>
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
    { key: "about_hero_title", label: "Hero Title", placeholder: "About VaultX", multiline: false },
    { key: "about_hero_subtitle", label: "Hero Subtitle", placeholder: "A Modern Digital Investment Platform…", multiline: false },
    { key: "about_hero_description", label: "Hero Description", placeholder: "VaultX is a digital investment platform…", multiline: true },
    { key: "about_mission_text", label: "Mission Text", placeholder: "At VaultX, our mission is to…", multiline: true },
    { key: "about_security_text", label: "Security & Compliance Text", placeholder: "VaultX prioritizes platform security…", multiline: true },
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
    primary_download_url: "",
    mirror_download_url: "",
    backup_download_url: "",
  });
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState<string | null>(null);

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

  const SERVERS = [
    { key: "primary", label: "Primary", urlKey: "primary_download_url", countKey: "primary_download_count" },
    { key: "mirror", label: "Mirror", urlKey: "mirror_download_url", countKey: "mirror_download_count" },
    { key: "backup", label: "Backup", urlKey: "backup_download_url", countKey: "backup_download_count" },
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
            <Input value={form.app_name} onChange={set("app_name")} placeholder="VaultX" className="mt-1 h-9 text-sm" />
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
                  placeholder={`https://example.com/vaultx-${key}.apk`}
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
    { key: "platform_name", label: "Platform Name", placeholder: "VaultX" },
    { key: "support_email", label: "Support Email", placeholder: "support@vaultx.com" },
    { key: "support_telegram", label: "Telegram Link", placeholder: "https://t.me/vaultx" },
    { key: "support_whatsapp", label: "WhatsApp Support Number", placeholder: "+1234567890" },
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

