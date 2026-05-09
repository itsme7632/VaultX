import { useState, useEffect } from "react";
import { Users, DollarSign, FileCheck, ArrowUpRight, ArrowDownLeft, Bell, Search, Check, X, ChevronRight, TrendingUp, Newspaper, Plus, Edit2, Network, Trash2, Settings } from "lucide-react";
import {
  useAdminGetAnalytics, getAdminGetAnalyticsQueryKey,
  useAdminGetUsers, getAdminGetUsersQueryKey,
  useAdminGetKycSubmissions, getAdminGetKycSubmissionsQueryKey,
  useAdminGetWithdrawals, getAdminGetWithdrawalsQueryKey,
  useAdminApproveKyc, useAdminRejectKyc,
  useAdminApproveWithdrawal, useAdminRejectWithdrawal,
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

type Tab = "analytics" | "users" | "kyc" | "withdrawals" | "deposits" | "plans" | "networks" | "news" | "broadcast" | "settings";

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
  const [broadcastForm, setBroadcastForm] = useState({ title: "", message: "", type: "announcement" as AdminBroadcastBodyType });
  const [wdTxHash, setWdTxHash] = useState("");
  const { data: analytics, isLoading: analyticsLoading } = useAdminGetAnalytics({ query: { queryKey: getAdminGetAnalyticsQueryKey(), staleTime: 30000 } });
  const { data: usersData } = useAdminGetUsers({ search: search || undefined, limit: 20 }, { query: { queryKey: getAdminGetUsersQueryKey({ search: search || undefined, limit: 20 }), staleTime: 20000 } });
  const { data: kycData } = useAdminGetKycSubmissions({ status: kycFilter }, { query: { queryKey: getAdminGetKycSubmissionsQueryKey({ status: kycFilter }), staleTime: 20000 } });
  const { data: wdData } = useAdminGetWithdrawals({ status: wdFilter }, { query: { queryKey: getAdminGetWithdrawalsQueryKey({ status: wdFilter }), staleTime: 20000 } });

  const { data: plans } = useQuery({ queryKey: ["admin-plans"], queryFn: () => adminApi("/admin/plans"), staleTime: 30000 });
  const { data: networks } = useQuery({ queryKey: ["admin-networks"], queryFn: () => adminApi("/admin/deposit-networks"), staleTime: 30000 });
  const { data: newsData } = useQuery({ queryKey: ["admin-news"], queryFn: () => adminApi("/admin/news"), staleTime: 30000 });
  const { data: depData, isLoading: depLoading } = useQuery({ queryKey: ["admin-deposits", depFilter], queryFn: () => adminApi(`/admin/deposits?status=${depFilter}`), staleTime: 20000, enabled: tab === "deposits" });
  const { data: settingsData } = useQuery({ queryKey: ["admin-settings"], queryFn: () => adminApi("/admin/settings"), staleTime: 30000, enabled: tab === "settings" });

  const approveKyc = useAdminApproveKyc();
  const rejectKyc = useAdminRejectKyc();
  const approveWd = useAdminApproveWithdrawal();
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
  const handleApproveWd = (id: number) => approveWd.mutate({ id }, { onSuccess: () => { setWdTxHash(""); queryClient.invalidateQueries({ queryKey: getAdminGetWithdrawalsQueryKey({ status: wdFilter }) }); }, onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }) });
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
    { id: "settings", label: "Settings", icon: Settings },
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
        <div className="flex gap-1 overflow-x-auto px-4 py-3 border-b border-border bg-white sticky top-0 z-10">
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
                      <button onClick={() => setUserModal(u)} className="p-1.5 rounded-lg hover:bg-muted"><ChevronRight size={13} /></button>
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
          {tab === "settings" && (
            <SettingsTab settingsData={settingsData} toast={toast} />
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
      <Dialog open={!!userModal} onOpenChange={(o) => !o && setUserModal(null)}>
        <DialogContent className="max-w-sm mx-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Manage User — @{userModal?.username}</DialogTitle></DialogHeader>
          {userModal && (
            <div className="space-y-3 pt-2">
              <div className="bg-muted/50 rounded-xl p-3 grid grid-cols-2 gap-2 text-xs">
                <div><p className="text-muted-foreground">Balance</p><p className="font-bold text-primary">{formatUSDT(userModal.balance)}</p></div>
                <div><p className="text-muted-foreground">Deposited</p><p className="font-bold">{formatUSDT(userModal.totalDeposited)}</p></div>
                <div><p className="text-muted-foreground">Withdrawn</p><p className="font-bold">{formatUSDT(userModal.totalWithdrawn)}</p></div>
                <div><p className="text-muted-foreground">KYC</p><p className="font-bold capitalize">{userModal.kycStatus}</p></div>
              </div>

              {(userModal.ipAddress || userModal.lastLoginIp) && (
                <div className="bg-muted/30 rounded-xl p-3 text-xs space-y-1">
                  {userModal.ipAddress && <p><span className="text-muted-foreground">Reg. IP: </span><span className="font-mono">{userModal.ipAddress}</span></p>}
                  {userModal.lastLoginIp && <p><span className="text-muted-foreground">Last Login IP: </span><span className="font-mono">{userModal.lastLoginIp}</span></p>}
                  {userModal.lastLoginAt && <p><span className="text-muted-foreground">Last Login: </span>{formatDateTime(userModal.lastLoginAt)}</p>}
                </div>
              )}

              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Lock Controls</p>
                <label className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-xl">
                  <span className="text-sm">Lock Withdrawals</span>
                  <input type="checkbox" checked={userModal.withdrawalLocked} onChange={(e) => setUserModal({ ...userModal, withdrawalLocked: e.target.checked })} className="w-4 h-4" />
                </label>
                <label className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-xl">
                  <span className="text-sm">Lock Transfers</span>
                  <input type="checkbox" checked={userModal.transferLocked} onChange={(e) => setUserModal({ ...userModal, transferLocked: e.target.checked })} className="w-4 h-4" />
                </label>
                <label className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-xl">
                  <span className="text-sm">Lock WhatsApp</span>
                  <input type="checkbox" checked={userModal.whatsappLocked ?? false} onChange={(e) => setUserModal({ ...userModal, whatsappLocked: e.target.checked })} className="w-4 h-4" />
                </label>
                <label className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-xl">
                  <span className="text-sm">Admin Access</span>
                  <input type="checkbox" checked={userModal.isAdmin} onChange={(e) => setUserModal({ ...userModal, isAdmin: e.target.checked })} className="w-4 h-4" />
                </label>
                <label className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-xl">
                  <span className="text-sm">Account Active</span>
                  <input type="checkbox" checked={userModal.isActive} onChange={(e) => setUserModal({ ...userModal, isActive: e.target.checked })} className="w-4 h-4" />
                </label>
              </div>

              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" className="text-xs h-8 flex-1" onClick={() => { setAdjustModal({ userId: userModal.id, username: userModal.username }); setUserModal(null); }}>Adjust Balance</Button>
                <Button size="sm" variant="outline" className="text-xs h-8 flex-1" onClick={() => reset2fa.mutate(userModal.id)}>Reset 2FA</Button>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setUserModal(null)}>Cancel</Button>
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

function SettingsTab({ settingsData, toast }: { settingsData: any; toast: any }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settingsData) {
      const obj: Record<string, string> = {};
      for (const s of settingsData) obj[s.key] = s.value;
      setForm(obj);
    }
  }, [settingsData]);

  const FIELDS = [
    { key: "site_name", label: "Platform Name", placeholder: "VaultX" },
    { key: "support_email", label: "Support Email", placeholder: "support@vaultx.com" },
    { key: "telegram_link", label: "Telegram Link", placeholder: "https://t.me/vaultx" },
    { key: "whatsapp_number", label: "WhatsApp Support Number", placeholder: "+1234567890" },
    { key: "min_deposit", label: "Min. Deposit (USDT)", placeholder: "10" },
    { key: "min_withdrawal", label: "Min. Withdrawal (USDT)", placeholder: "10" },
    { key: "withdrawal_fee_percent", label: "Withdrawal Fee (%)", placeholder: "1.5" },
    { key: "referral_bonus_percent", label: "Referral Bonus (%)", placeholder: "5" },
    { key: "kyc_required", label: "KYC Required for Withdrawal", placeholder: "true" },
    { key: "maintenance_mode", label: "Maintenance Mode", placeholder: "false" },
    { key: "announcement_text", label: "Announcement Banner Text", placeholder: "" },
  ];

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const [key, value] of Object.entries(form)) {
        await fetch("/api/admin/settings", {
          method: "PUT", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, value }),
        });
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
        {FIELDS.map(({ key, label, placeholder }) => (
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
        <Button className="w-full h-10 font-semibold" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save All Settings"}
        </Button>
      </div>
    </div>
  );
}

