import { useState, useEffect } from "react";
import { Shield, AlertCircle, Clock, Copy, Check, X, Lock, MapPin, AlertTriangle, ChevronRight } from "lucide-react";
import { useGetWallet, getGetWalletQueryKey, getGetTransactionsQueryKey } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { SubPageLayout } from "@/components/SubPageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatUSDT } from "@/lib/format";

type Step = "form" | "confirm" | "security";

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

export default function WithdrawPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("form");
  const [wdAmount, setWdAmount] = useState("");
  const [wdNetwork, setWdNetwork] = useState("");
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [copiedAddr, setCopiedAddr] = useState(false);
  const [wdPassword, setWdPassword] = useState("");
  const [twoFaCode, setTwoFaCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: wallet } = useGetWallet({ query: { queryKey: getGetWalletQueryKey(), staleTime: 30000 } });
  const { data: platformSettings } = useQuery({
    queryKey: ["public-settings"],
    queryFn: () => fetch("/api/settings/public", { credentials: "include" }).then(r => r.json()),
    staleTime: 60000,
  });
  const { data: secStatus } = useQuery({
    queryKey: ["security-status"],
    queryFn: () => apiFetch("/security/status"),
    staleTime: 30000,
  });

  const savedAddresses: any[] = secStatus?.withdrawalAddresses ?? [];
  const allConfigured = secStatus?.allConfigured ?? false;
  const missingItems: string[] = [];
  if (secStatus && !secStatus.twoFaEnabled) missingItems.push("Authenticator (2FA)");
  if (secStatus && !secStatus.hasWithdrawalPassword) missingItems.push("Withdrawal Password");
  if (secStatus && savedAddresses.length === 0) missingItems.push("Withdrawal Address");

  const customRules: string[] = (() => {
    const raw = platformSettings?.withdrawal_instructions?.trim();
    if (!raw) return [];
    return raw.split("\n").map((s: string) => s.trim()).filter(Boolean);
  })();

  const networks = wallet?.addresses ?? [];
  const feePercent = parseFloat(platformSettings?.withdrawal_fee_percent ?? "1.5");
  const minWithdrawal = parseFloat(platformSettings?.min_withdrawal ?? "10");
  const wdAmountNum = parseFloat(wdAmount) || 0;
  const wdFee = wdAmountNum * feePercent / 100;
  const wdNet = Math.max(0, wdAmountNum - wdFee);
  const balance = wallet?.balance ?? 0;

  const selectedAddress = savedAddresses.find(a => a.id === selectedAddressId);
  const hasError = wdAmountNum > 0 && wdAmountNum > balance;
  const belowMin = wdAmountNum > 0 && wdAmountNum < minWithdrawal;
  const canProceed = wdAmount && wdNetwork && selectedAddressId && !hasError && !belowMin && wdAmountNum > 0;

  const handleSetMax = () => setWdAmount(String(parseFloat(String(balance)).toFixed(2)));

  const handleSubmit = async () => {
    if (!selectedAddress) return;
    setSubmitting(true);
    try {
      await apiFetch("/wallet/withdraw", {
        method: "POST",
        body: JSON.stringify({
          amount: wdAmountNum,
          network: wdNetwork,
          address: selectedAddress.address,
          withdrawalPassword: wdPassword,
          twoFaCode,
        }),
      });
      toast({ title: "Withdrawal Requested", description: "Your request is being reviewed (within 24h)" });
      queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetTransactionsQueryKey({}) });
      navigate("/wallet");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
      setStep("security");
    } finally {
      setSubmitting(false);
    }
  };

  if (secStatus && !allConfigured) {
    return (
      <SubPageLayout title="Withdraw USDT">
        <div className="px-4 pt-5 pb-10 space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-3">
              <Shield size={22} className="text-red-500" />
            </div>
            <p className="font-bold text-red-700">Security Setup Required</p>
            <p className="text-xs text-red-500 mt-1.5 leading-relaxed">
              You must complete the following before making a withdrawal:
            </p>
          </div>

          <div className="bg-white border border-border rounded-2xl divide-y divide-border overflow-hidden shadow-sm">
            {[
              { label: "Authenticator (2FA)", ok: secStatus.twoFaEnabled, href: "/setup-2fa" },
              { label: "Withdrawal Password", ok: secStatus.hasWithdrawalPassword, href: "/security" },
              { label: "Withdrawal Address", ok: savedAddresses.length > 0, href: "/security" },
            ].map(({ label, ok, href }) => (
              <button
                key={label}
                onClick={() => navigate(href)}
                className="w-full flex items-center justify-between px-4 py-3.5 text-sm"
              >
                <div className="flex items-center gap-2.5">
                  <div className={cn("w-2 h-2 rounded-full", ok ? "bg-emerald-500" : "bg-red-400")} />
                  <span className={cn("font-medium", ok ? "text-emerald-700 line-through opacity-60" : "text-foreground")}>{label}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={cn("text-xs font-semibold", ok ? "text-emerald-500" : "text-primary")}>
                    {ok ? "Done" : "Set up →"}
                  </span>
                </div>
              </button>
            ))}
          </div>

          <Button className="w-full rounded-2xl font-bold" style={{ height: 52 }} onClick={() => navigate("/security")}>
            Go to Security Settings →
          </Button>
        </div>
      </SubPageLayout>
    );
  }

  return (
    <SubPageLayout title="Withdraw USDT">
      <div className="px-4 pt-5 pb-32 space-y-5">

        {/* Step indicator */}
        <div className="flex items-center gap-1">
          {(["form", "confirm", "security"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-1 flex-1">
              <div className={cn(
                "flex-1 h-1 rounded-full transition-colors",
                step === s ? "bg-primary" : i < ["form", "confirm", "security"].indexOf(step) ? "bg-primary/40" : "bg-muted"
              )} />
            </div>
          ))}
        </div>

        {step === "form" && (
          <>
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-[11px] font-medium uppercase tracking-wide">Available Balance</p>
                <p className="text-white font-bold text-xl mt-0.5">{formatUSDT(balance)}</p>
              </div>
              <button
                onClick={handleSetMax}
                className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors active:scale-95"
              >
                MAX
              </button>
            </div>

            <div>
              <Label className="text-sm font-semibold mb-2 block">Network</Label>
              <Select value={wdNetwork} onValueChange={setWdNetwork}>
                <SelectTrigger className="h-12 rounded-xl text-sm">
                  <SelectValue placeholder="Select withdrawal network" />
                </SelectTrigger>
                <SelectContent>
                  {networks.map((n: any) => (
                    <SelectItem key={n.network} value={n.network}>
                      {n.label} ({n.network})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-semibold mb-2 block">Amount (USDT)</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={wdAmount}
                onChange={e => setWdAmount(e.target.value)}
                placeholder="0.00"
                className={cn("h-12 text-base rounded-xl", hasError && "border-destructive")}
              />
              {hasError && <p className="text-xs text-destructive mt-1.5 px-1">Insufficient balance</p>}
              {belowMin && <p className="text-xs text-destructive mt-1.5 px-1">Minimum withdrawal is {formatUSDT(minWithdrawal)}</p>}
            </div>

            {wdAmountNum > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5">
                <p className="text-xs font-bold text-foreground mb-1">Fee Breakdown</p>
                {[
                  { label: "Withdrawal Amount", val: formatUSDT(wdAmountNum), color: "" },
                  { label: `Processing Fee (${feePercent}%)`, val: `−${formatUSDT(wdFee)}`, color: "text-red-500" },
                ].map(({ label, val, color }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{label}</span>
                    <span className={cn("font-semibold", color)}>{val}</span>
                  </div>
                ))}
                <div className="border-t border-slate-200 pt-2.5 flex justify-between text-sm">
                  <span className="font-bold text-foreground">You Receive</span>
                  <span className="font-bold text-emerald-600">{formatUSDT(wdNet)}</span>
                </div>
              </div>
            )}

            <div>
              <Label className="text-sm font-semibold mb-2 block">Select Withdrawal Address</Label>
              {savedAddresses.length === 0 ? (
                <button onClick={() => navigate("/security")} className="w-full border border-dashed border-border rounded-xl p-4 flex items-center gap-3 text-left">
                  <MapPin size={16} className="text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">No addresses saved</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Go to Security Settings to add one</p>
                  </div>
                  <ChevronRight size={14} className="ml-auto text-muted-foreground" />
                </button>
              ) : (
                <div className="space-y-2">
                  {savedAddresses.map((addr: any) => (
                    <button
                      key={addr.id}
                      onClick={() => setSelectedAddressId(addr.id === selectedAddressId ? null : addr.id)}
                      className={cn(
                        "w-full border rounded-xl p-3.5 text-left transition-colors",
                        selectedAddressId === addr.id ? "border-primary bg-primary/5" : "border-border bg-white hover:bg-muted/30"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{addr.network}</span>
                        {addr.label && <span className="text-xs text-muted-foreground">{addr.label}</span>}
                        {selectedAddressId === addr.id && <Check size={12} className="ml-auto text-primary" />}
                      </div>
                      <p className="font-mono text-xs text-muted-foreground">{addr.maskedAddress}</p>
                    </button>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground mt-2 px-1">
                Address must be pre-saved in Security Settings.
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2 mb-0.5">
                <Clock size={13} className="text-amber-600 shrink-0" />
                <p className="text-xs font-bold text-amber-700">Processing Information</p>
              </div>
              {(customRules.length > 0 ? customRules : [
                "Withdrawals are reviewed within 24 hours",
                `A ${feePercent}% processing fee applies`,
                `Minimum withdrawal is ${formatUSDT(minWithdrawal)}`,
                "Processing takes up to 2 business days",
              ]).map((info: string) => (
                <div key={info} className="flex items-start gap-1.5">
                  <div className="w-1 h-1 rounded-full bg-amber-400 mt-2 shrink-0" />
                  <p className="text-[12px] text-amber-700">{info}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {step === "confirm" && selectedAddress && (
          <>
            <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center">
              <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-3">
                <Shield size={22} className="text-red-500" />
              </div>
              <p className="font-bold text-red-700">Confirm Withdrawal</p>
              <p className="text-xs text-red-500 mt-1">Review all details carefully before proceeding</p>
            </div>

            <div className="bg-white border border-border rounded-2xl divide-y divide-border overflow-hidden shadow-sm">
              {[
                { label: "Network", val: wdNetwork },
                { label: "Amount", val: formatUSDT(wdAmountNum) },
                { label: `Fee (${feePercent}%)`, val: `−${formatUSDT(wdFee)}` },
                { label: "You Receive", val: formatUSDT(wdNet) },
              ].map(({ label, val }) => (
                <div key={label} className="flex justify-between items-center px-4 py-3.5 text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className={cn("font-bold", label === "You Receive" && "text-emerald-600")}>{val}</span>
                </div>
              ))}
              <div className="px-4 py-3.5">
                <p className="text-xs text-muted-foreground mb-1.5">To Address</p>
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <span className="text-xs bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full">{selectedAddress.network}</span>
                    {selectedAddress.label && <span className="ml-2 text-xs text-muted-foreground">{selectedAddress.label}</span>}
                    <p className="font-mono text-xs text-foreground break-all mt-1">{selectedAddress.maskedAddress}</p>
                  </div>
                  <button
                    onClick={() => { navigator.clipboard.writeText(selectedAddress.address); setCopiedAddr(true); setTimeout(() => setCopiedAddr(false), 2000); }}
                    className="p-1.5 rounded-lg hover:bg-muted shrink-0"
                  >
                    {copiedAddr ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} className="text-muted-foreground" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-2xl p-3.5">
              <AlertCircle size={14} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[12px] text-amber-700 leading-snug">
                This action cannot be undone. Ensure the network and address are correct before confirming.
              </p>
            </div>
          </>
        )}

        {step === "security" && (
          <>
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-center">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Lock size={22} className="text-primary" />
              </div>
              <p className="font-bold text-foreground">Security Verification</p>
              <p className="text-xs text-muted-foreground mt-1">Enter your credentials to authorize this withdrawal</p>
            </div>

            <div>
              <Label className="text-sm font-semibold mb-2 block">Withdrawal Password</Label>
              <Input
                type="password"
                value={wdPassword}
                onChange={e => setWdPassword(e.target.value)}
                placeholder="Your withdrawal password"
                className="h-12 rounded-xl text-sm"
                autoComplete="current-password"
              />
            </div>

            <div>
              <Label className="text-sm font-semibold mb-2 block">Authenticator Code</Label>
              <Input
                value={twoFaCode}
                onChange={e => setTwoFaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000 000"
                className="h-14 text-center text-2xl tracking-[0.4em] font-bold font-mono rounded-xl border-2 focus:border-primary"
                maxLength={6}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
              />
              <p className="text-xs text-muted-foreground mt-1.5 px-1 text-center">6-digit code from your authenticator app</p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-1.5">
              <p className="text-xs font-bold text-foreground mb-2">Withdrawal Summary</p>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">You Send</span>
                <span className="font-semibold">{formatUSDT(wdAmountNum)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">You Receive</span>
                <span className="font-bold text-emerald-600">{formatUSDT(wdNet)}</span>
              </div>
              {selectedAddress && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">To</span>
                  <span className="font-mono text-xs">{selectedAddress.maskedAddress}</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 max-w-screen-sm mx-auto px-4 pb-6 pt-3 bg-gradient-to-t from-background via-background to-transparent">
        {step === "form" ? (
          <Button
            className="w-full bg-red-500 hover:bg-red-600 font-bold rounded-2xl shadow-lg"
            style={{ height: 52 }}
            onClick={() => setStep("confirm")}
            disabled={!canProceed}
          >
            Review Withdrawal →
          </Button>
        ) : step === "confirm" ? (
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" style={{ height: 52 }} className="rounded-2xl font-semibold" onClick={() => setStep("form")}>
              <X size={15} className="mr-1.5" /> Go Back
            </Button>
            <Button
              className="bg-red-500 hover:bg-red-600 font-bold rounded-2xl shadow-lg"
              style={{ height: 52 }}
              onClick={() => setStep("security")}
            >
              Verify Identity →
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" style={{ height: 52 }} className="rounded-2xl font-semibold" onClick={() => setStep("confirm")}>
              <X size={15} className="mr-1.5" /> Back
            </Button>
            <Button
              className="bg-red-500 hover:bg-red-600 font-bold rounded-2xl shadow-lg"
              style={{ height: 52 }}
              onClick={handleSubmit}
              disabled={submitting || !wdPassword || twoFaCode.length !== 6}
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Sending…
                </span>
              ) : "Confirm Withdrawal"}
            </Button>
          </div>
        )}
      </div>
    </SubPageLayout>
  );
}
