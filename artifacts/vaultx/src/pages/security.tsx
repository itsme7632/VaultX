import { useState } from "react";
import {
  Shield, Lock, MapPin, Eye, EyeOff, ChevronRight, Plus, Trash2,
  CheckCircle, AlertTriangle, AlertCircle, X, Key
} from "lucide-react";
import { useChangePassword, getGetMeQueryKey, useSetup2fa, useVerify2fa, useDisable2fa } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const NETWORKS = [
  { value: "TRC20", label: "USDT TRC20" },
  { value: "BEP20", label: "USDT BEP20" },
  { value: "ERC20", label: "USDT ERC20 (ETH)" },
  { value: "BTC", label: "Bitcoin (BTC)" },
];

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(opts?.headers ?? {}) },
    ...opts,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? data.error ?? "Request failed");
  return data;
}

export default function SecurityPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);
  const [showWdPw, setShowWdPw] = useState(false);

  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [wdPwForm, setWdPwForm] = useState({ password: "", confirmPassword: "", currentPassword: "", newPassword: "", newConfirm: "" });
  const [addrForm, setAddrForm] = useState({ network: "TRC20", address: "", label: "", twoFaCode: "" });
  const [addingAddress, setAddingAddress] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [deleteTwoFaCode, setDeleteTwoFaCode] = useState("");
  const [savingWdPw, setSavingWdPw] = useState(false);

  const changePassword = useChangePassword();

  const { data: secStatus, refetch: refetchStatus } = useQuery({
    queryKey: ["security-status"],
    queryFn: () => apiFetch("/security/status"),
    staleTime: 10000,
  });

  const allConfigured = secStatus?.allConfigured ?? false;
  const has2FA = secStatus?.twoFaEnabled ?? user?.twoFaEnabled ?? false;
  const hasWdPw = secStatus?.hasWithdrawalPassword ?? false;
  const savedAddresses: any[] = secStatus?.withdrawalAddresses ?? [];

  const handleChangePassword = () => {
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    changePassword.mutate({ data: pwForm }, {
      onSuccess: () => {
        toast({ title: "Password changed successfully" });
        setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        setActiveSection(null);
      },
      onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
    });
  };

  const handleSetWdPassword = async () => {
    if (wdPwForm.password.length < 6) {
      toast({ title: "Too short", description: "Withdrawal password must be at least 6 characters", variant: "destructive" });
      return;
    }
    if (wdPwForm.password !== wdPwForm.confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    setSavingWdPw(true);
    try {
      await apiFetch("/security/withdrawal-password/set", {
        method: "POST",
        body: JSON.stringify({ password: wdPwForm.password, confirmPassword: wdPwForm.confirmPassword }),
      });
      toast({ title: "Withdrawal password set!" });
      setWdPwForm(f => ({ ...f, password: "", confirmPassword: "" }));
      refetchStatus();
      setActiveSection(null);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSavingWdPw(false);
    }
  };

  const handleChangeWdPassword = async () => {
    if (wdPwForm.newPassword !== wdPwForm.newConfirm) {
      toast({ title: "New passwords don't match", variant: "destructive" });
      return;
    }
    if (wdPwForm.newPassword.length < 6) {
      toast({ title: "Too short", description: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    setSavingWdPw(true);
    try {
      await apiFetch("/security/withdrawal-password/change", {
        method: "POST",
        body: JSON.stringify({ currentPassword: wdPwForm.currentPassword, newPassword: wdPwForm.newPassword, confirmPassword: wdPwForm.newConfirm }),
      });
      toast({ title: "Withdrawal password changed!" });
      setWdPwForm(f => ({ ...f, currentPassword: "", newPassword: "", newConfirm: "" }));
      refetchStatus();
      setActiveSection(null);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSavingWdPw(false);
    }
  };

  const handleAddAddress = async () => {
    if (!addrForm.address.trim() || addrForm.address.trim().length < 10) {
      toast({ title: "Invalid address", description: "Address must be at least 10 characters", variant: "destructive" });
      return;
    }
    if (has2FA && !addrForm.twoFaCode) {
      toast({ title: "2FA required", description: "Enter your authenticator code", variant: "destructive" });
      return;
    }
    setAddingAddress(true);
    try {
      await apiFetch("/security/addresses", {
        method: "POST",
        body: JSON.stringify({ network: addrForm.network, address: addrForm.address, label: addrForm.label, twoFaCode: addrForm.twoFaCode }),
      });
      toast({ title: "Address added!" });
      setAddrForm({ network: "TRC20", address: "", label: "", twoFaCode: "" });
      refetchStatus();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setAddingAddress(false);
    }
  };

  const handleDeleteAddress = async (id: number, twoFaCode?: string) => {
    setDeletingId(id);
    try {
      await apiFetch(`/security/addresses/${id}`, {
        method: "DELETE",
        body: JSON.stringify({ twoFaCode }),
      });
      toast({ title: "Address removed" });
      setDeleteConfirmId(null);
      setDeleteTwoFaCode("");
      refetchStatus();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const StatusBadge = ({ ok }: { ok: boolean }) => (
    <div className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold",
      ok ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"
    )}>
      <div className={cn("w-1.5 h-1.5 rounded-full", ok ? "bg-emerald-500" : "bg-red-400")} />
      {ok ? "Configured" : "Not Set"}
    </div>
  );

  return (
    <AppLayout title="Security">
      <div className="px-4 pt-5 pb-8 space-y-4">

        {/* Security Status Header */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-4 text-white">
          <div className="flex items-center gap-2 mb-3">
            <Shield size={16} className={allConfigured ? "text-emerald-400" : "text-amber-400"} />
            <span className="text-sm font-bold">Security Status</span>
            {allConfigured && <span className="ml-auto text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-semibold">All Clear</span>}
          </div>
          <div className="space-y-2">
            {[
              { label: "Authenticator (2FA)", ok: has2FA },
              { label: "Withdrawal Password", ok: hasWdPw },
              { label: "Withdrawal Address", ok: savedAddresses.length > 0 },
            ].map(({ label, ok }) => (
              <div key={label} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full", ok ? "bg-emerald-400" : "bg-red-400")} />
                  <span className="text-slate-200 text-xs">{label}</span>
                </div>
                <span className={cn("text-xs font-semibold", ok ? "text-emerald-400" : "text-red-400")}>
                  {ok ? "✓ Enabled" : "✗ Missing"}
                </span>
              </div>
            ))}
          </div>
          {!allConfigured && (
            <p className="text-xs text-amber-300 mt-3 leading-relaxed">
              ⚠ Set up all 3 to unlock withdrawals.
            </p>
          )}
        </div>

        {/* Authenticator (2FA) */}
        <div className="bg-white border border-border rounded-2xl shadow-sm overflow-hidden">
          <button
            onClick={() => navigate("/setup-2fa")}
            className="w-full px-4 py-4 flex items-center gap-3"
          >
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", has2FA ? "bg-emerald-50" : "bg-red-50")}>
              <Shield size={18} className={has2FA ? "text-emerald-500" : "text-red-400"} />
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-semibold text-foreground">Authenticator (2FA)</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {has2FA ? "Google Authenticator is active" : "Protect your account with 2FA"}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <StatusBadge ok={has2FA} />
              <ChevronRight size={16} className="text-muted-foreground" />
            </div>
          </button>
        </div>

        {/* Withdrawal Password */}
        <div className="bg-white border border-border rounded-2xl shadow-sm overflow-hidden">
          <button
            onClick={() => setActiveSection(activeSection === "wdpw" ? null : "wdpw")}
            className="w-full px-4 py-4 flex items-center gap-3"
          >
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", hasWdPw ? "bg-emerald-50" : "bg-red-50")}>
              <Key size={18} className={hasWdPw ? "text-emerald-500" : "text-red-400"} />
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-semibold text-foreground">Withdrawal Password</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {hasWdPw ? "Separate password for fund movements" : "Add extra security for withdrawals"}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <StatusBadge ok={hasWdPw} />
              <ChevronRight size={cn("text-muted-foreground", activeSection === "wdpw" && "rotate-90") as any} strokeWidth={2} style={{ width: 16, height: 16, transform: activeSection === "wdpw" ? "rotate(90deg)" : undefined }} />
            </div>
          </button>

          {activeSection === "wdpw" && (
            <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
              {!hasWdPw ? (
                <>
                  <p className="text-xs text-muted-foreground">Set a dedicated password used to authorize withdrawals and transfers.</p>
                  <div>
                    <Label className="text-xs text-muted-foreground">New Withdrawal Password</Label>
                    <div className="relative mt-1">
                      <Input
                        type={showWdPw ? "text" : "password"}
                        value={wdPwForm.password}
                        onChange={e => setWdPwForm(f => ({ ...f, password: e.target.value }))}
                        placeholder="Min. 6 characters"
                        className="h-11 pr-10 text-sm rounded-xl"
                        autoComplete="new-password"
                      />
                      <button type="button" onClick={() => setShowWdPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        {showWdPw ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Confirm Password</Label>
                    <Input
                      type="password"
                      value={wdPwForm.confirmPassword}
                      onChange={e => setWdPwForm(f => ({ ...f, confirmPassword: e.target.value }))}
                      placeholder="Repeat password"
                      className="h-11 text-sm rounded-xl mt-1"
                      autoComplete="new-password"
                    />
                  </div>
                  {wdPwForm.password && wdPwForm.confirmPassword && wdPwForm.password !== wdPwForm.confirmPassword && (
                    <p className="text-xs text-destructive">Passwords do not match</p>
                  )}
                  <Button
                    className="w-full h-11 text-sm font-semibold rounded-xl"
                    onClick={handleSetWdPassword}
                    disabled={savingWdPw || !wdPwForm.password || !wdPwForm.confirmPassword || wdPwForm.password !== wdPwForm.confirmPassword}
                  >
                    {savingWdPw ? "Setting…" : "Set Withdrawal Password"}
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">Enter your current withdrawal password to set a new one.</p>
                  {[
                    { key: "currentPassword" as const, label: "Current Withdrawal Password", autoComplete: "current-password" },
                    { key: "newPassword" as const, label: "New Password", autoComplete: "new-password" },
                    { key: "newConfirm" as const, label: "Confirm New Password", autoComplete: "new-password" },
                  ].map(({ key, label, autoComplete }) => (
                    <div key={key}>
                      <Label className="text-xs text-muted-foreground">{label}</Label>
                      <Input
                        type="password"
                        value={wdPwForm[key]}
                        onChange={e => setWdPwForm(f => ({ ...f, [key]: e.target.value }))}
                        className="h-11 text-sm rounded-xl mt-1"
                        autoComplete={autoComplete}
                      />
                    </div>
                  ))}
                  <Button
                    className="w-full h-11 text-sm font-semibold rounded-xl"
                    onClick={handleChangeWdPassword}
                    disabled={savingWdPw || !wdPwForm.currentPassword || !wdPwForm.newPassword || !wdPwForm.newConfirm}
                  >
                    {savingWdPw ? "Changing…" : "Change Withdrawal Password"}
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Withdrawal Addresses */}
        <div className="bg-white border border-border rounded-2xl shadow-sm overflow-hidden">
          <button
            onClick={() => setActiveSection(activeSection === "addrs" ? null : "addrs")}
            className="w-full px-4 py-4 flex items-center gap-3"
          >
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", savedAddresses.length > 0 ? "bg-emerald-50" : "bg-red-50")}>
              <MapPin size={18} className={savedAddresses.length > 0 ? "text-emerald-500" : "text-red-400"} />
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-semibold text-foreground">Withdrawal Addresses</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {savedAddresses.length > 0 ? `${savedAddresses.length} address${savedAddresses.length > 1 ? "es" : ""} saved` : "No addresses saved yet"}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <StatusBadge ok={savedAddresses.length > 0} />
              <ChevronRight size={16} className="text-muted-foreground" style={{ transform: activeSection === "addrs" ? "rotate(90deg)" : undefined }} />
            </div>
          </button>

          {activeSection === "addrs" && (
            <div className="border-t border-border">
              {savedAddresses.length > 0 && (
                <div className="divide-y divide-border">
                  {savedAddresses.map((addr: any) => (
                    <div key={addr.id} className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{addr.network}</span>
                            {addr.label && <span className="text-xs text-muted-foreground">{addr.label}</span>}
                          </div>
                          <p className="font-mono text-xs text-foreground break-all leading-relaxed">{addr.maskedAddress}</p>
                        </div>
                        <button
                          onClick={() => {
                            if (deleteConfirmId === addr.id) {
                              setDeleteConfirmId(null);
                              setDeleteTwoFaCode("");
                            } else {
                              setDeleteConfirmId(addr.id);
                              setDeleteTwoFaCode("");
                            }
                          }}
                          disabled={deletingId === addr.id}
                          className="p-2 rounded-xl hover:bg-red-50 text-muted-foreground hover:text-red-500 transition-colors shrink-0 mt-0.5"
                        >
                          {deletingId === addr.id
                            ? <div className="w-3.5 h-3.5 border-2 border-red-300 border-t-red-500 rounded-full animate-spin" />
                            : <Trash2 size={14} />}
                        </button>
                      </div>
                      {deleteConfirmId === addr.id && (
                        <div className="mt-2 bg-red-50 border border-red-200 rounded-xl p-3 space-y-2">
                          <p className="text-xs font-semibold text-red-700">Confirm removal</p>
                          {has2FA ? (
                            <>
                              <p className="text-[11px] text-red-600">Enter your authenticator code to remove this address.</p>
                              <Input
                                value={deleteTwoFaCode}
                                onChange={e => setDeleteTwoFaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                placeholder="6-digit code"
                                inputMode="numeric"
                                maxLength={6}
                                className="h-9 text-sm text-center tracking-widest font-mono rounded-lg"
                              />
                            </>
                          ) : (
                            <p className="text-[11px] text-red-600">This will permanently remove the address.</p>
                          )}
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 h-8 text-xs border-red-200 text-red-600"
                              onClick={() => { setDeleteConfirmId(null); setDeleteTwoFaCode(""); }}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              className="flex-1 h-8 text-xs bg-red-600 hover:bg-red-700 text-white"
                              disabled={deletingId === addr.id || (has2FA && deleteTwoFaCode.length !== 6)}
                              onClick={() => handleDeleteAddress(addr.id, deleteTwoFaCode || undefined)}
                            >
                              {deletingId === addr.id ? "Removing…" : "Remove"}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {savedAddresses.length < 5 && (
                <div className="px-4 pb-4 pt-3 space-y-3 border-t border-border">
                  <p className="text-xs font-semibold text-foreground">Add New Address</p>
                  <div>
                    <Label className="text-xs text-muted-foreground">Network</Label>
                    <select
                      value={addrForm.network}
                      onChange={e => setAddrForm(f => ({ ...f, network: e.target.value }))}
                      className="mt-1 w-full h-11 border border-input rounded-xl px-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {NETWORKS.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Wallet Address</Label>
                    <Input
                      value={addrForm.address}
                      onChange={e => setAddrForm(f => ({ ...f, address: e.target.value }))}
                      placeholder="Paste your wallet address"
                      className="h-11 text-xs font-mono rounded-xl mt-1"
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Label <span className="text-muted-foreground/60">(optional)</span></Label>
                    <Input
                      value={addrForm.label}
                      onChange={e => setAddrForm(f => ({ ...f, label: e.target.value }))}
                      placeholder="e.g. My Binance, Personal Wallet"
                      className="h-11 text-sm rounded-xl mt-1"
                    />
                  </div>
                  {has2FA && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Authenticator Code <span className="text-red-500">*</span></Label>
                      <Input
                        value={addrForm.twoFaCode}
                        onChange={e => setAddrForm(f => ({ ...f, twoFaCode: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
                        placeholder="6-digit code from your app"
                        inputMode="numeric"
                        maxLength={6}
                        className="h-11 text-sm text-center tracking-widest font-mono rounded-xl mt-1"
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">Required to protect your withdrawal destinations.</p>
                    </div>
                  )}
                  <Button
                    className="w-full h-11 text-sm font-semibold rounded-xl"
                    onClick={handleAddAddress}
                    disabled={addingAddress || addrForm.address.trim().length < 10 || (has2FA && addrForm.twoFaCode.length !== 6)}
                  >
                    {addingAddress ? "Adding…" : <><Plus size={14} className="mr-1.5" />Add Address</>}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Change Login Password */}
        <div className="bg-white border border-border rounded-2xl shadow-sm overflow-hidden">
          <button
            onClick={() => setActiveSection(activeSection === "loginpw" ? null : "loginpw")}
            className="w-full px-4 py-4 flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
              <Lock size={18} className="text-blue-500" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-foreground">Login Password</p>
              <p className="text-xs text-muted-foreground mt-0.5">Change your account login password</p>
            </div>
            <ChevronRight size={16} className="text-muted-foreground shrink-0" style={{ transform: activeSection === "loginpw" ? "rotate(90deg)" : undefined }} />
          </button>

          {activeSection === "loginpw" && (
            <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
              {[
                { key: "currentPassword" as const, label: "Current Password", autoComplete: "current-password" },
                { key: "newPassword" as const, label: "New Password", autoComplete: "new-password" },
                { key: "confirmPassword" as const, label: "Confirm New Password", autoComplete: "new-password" },
              ].map(({ key, label, autoComplete }) => (
                <div key={key}>
                  <Label className="text-xs text-muted-foreground">{label}</Label>
                  <div className="relative mt-1">
                    <Input
                      type={showPw ? "text" : "password"}
                      value={pwForm[key]}
                      onChange={e => setPwForm(f => ({ ...f, [key]: e.target.value }))}
                      className="h-11 pr-10 text-sm rounded-xl"
                      autoComplete={autoComplete}
                    />
                    {key === "currentPassword" && (
                      <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {pwForm.newPassword && pwForm.confirmPassword && pwForm.newPassword !== pwForm.confirmPassword && (
                <p className="text-xs text-destructive">Passwords do not match</p>
              )}
              <Button
                className="w-full h-11 text-sm font-semibold rounded-xl"
                onClick={handleChangePassword}
                disabled={changePassword.isPending || !pwForm.currentPassword || !pwForm.newPassword || !pwForm.confirmPassword || pwForm.newPassword !== pwForm.confirmPassword}
              >
                {changePassword.isPending ? "Changing…" : "Change Login Password"}
              </Button>
            </div>
          )}
        </div>

        {/* Recovery info */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
          <div className="flex items-start gap-2.5">
            <AlertCircle size={15} className="text-blue-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-blue-700">Lost access to 2FA?</p>
              <p className="text-xs text-blue-600 mt-1 leading-relaxed">
                If you can no longer access your authenticator app, contact support. An admin can reset your 2FA so you can set it up again with a new device.
              </p>
            </div>
          </div>
        </div>

      </div>
    </AppLayout>
  );
}
