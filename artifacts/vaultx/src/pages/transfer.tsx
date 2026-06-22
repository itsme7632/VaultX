import { useState } from "react";
import { Search, ArrowRight, X, AlertCircle, User, Check, Lock } from "lucide-react";
import { useGetWallet, getGetWalletQueryKey, getGetTransactionsQueryKey } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { SubPageLayout } from "@/components/SubPageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatUSDT } from "@/lib/format";

type Step = "input" | "confirm" | "security";

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

export default function TransferPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("input");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [resolvedUser, setResolvedUser] = useState<any>(null);
  const [resolving, setResolving] = useState(false);
  const [wdPassword, setWdPassword] = useState("");
  const [twoFaCode, setTwoFaCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: wallet } = useGetWallet({ query: { queryKey: getGetWalletQueryKey(), staleTime: 30000 } });
  const { data: secStatus } = useQuery({
    queryKey: ["security-status"],
    queryFn: () => apiFetch("/security/status"),
    staleTime: 30000,
  });

  const balance = wallet?.balance ?? 0;
  const amountNum = parseFloat(amount) || 0;
  const hasError = amountNum > 0 && amountNum > balance;
  const belowMin = amountNum > 0 && amountNum < 1;

  const needsWdPassword = secStatus?.hasWithdrawalPassword ?? false;
  const needs2FA = secStatus?.twoFaEnabled ?? false;
  const needsSecurity = needsWdPassword || needs2FA;

  const handleResolve = async () => {
    if (!recipient.trim()) return;
    setResolving(true);
    try {
      const res = await fetch(`/api/wallet/resolve-user?query=${encodeURIComponent(recipient)}`, { credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).message ?? "User not found");
      const user = await res.json();
      setResolvedUser(user);
      setStep("confirm");
    } catch (e: any) {
      toast({ title: "User Not Found", description: e.message, variant: "destructive" });
    } finally {
      setResolving(false);
    }
  };

  const handleProceedFromConfirm = () => {
    if (needsSecurity) {
      setStep("security");
    } else {
      handleTransfer();
    }
  };

  const handleTransfer = async () => {
    setSubmitting(true);
    try {
      await apiFetch("/wallet/transfer", {
        method: "POST",
        body: JSON.stringify({
          recipientQuery: recipient,
          amount: amountNum,
          note: note || undefined,
          withdrawalPassword: needsWdPassword ? wdPassword : undefined,
          twoFaCode: needs2FA ? twoFaCode : undefined,
        }),
      });
      toast({ title: "Transfer Sent!", description: `${formatUSDT(amountNum)} sent to ${resolvedUser?.fullName}` });
      queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetTransactionsQueryKey({}) });
      navigate("/wallet");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
      setStep(needsSecurity ? "security" : "input");
    } finally {
      setSubmitting(false);
    }
  };

  const securityValid = (
    (!needsWdPassword || wdPassword.length > 0) &&
    (!needs2FA || twoFaCode.length === 6)
  );

  return (
    <SubPageLayout title="Transfer USDT">
      <div className="px-4 pt-5 pb-32 space-y-5">

        {needsSecurity && (
          <div className="flex items-center gap-1">
            {(["input", "confirm", "security"] as Step[]).map((s, i) => (
              <div key={s} className="flex-1">
                <div className={cn(
                  "h-1 rounded-full transition-colors",
                  step === s ? "bg-primary" : i < (["input", "confirm", "security"] as Step[]).indexOf(step) ? "bg-primary/40" : "bg-muted"
                )} />
              </div>
            ))}
          </div>
        )}

        {step === "input" && (
          <>
            <div className="bg-gradient-to-r from-primary to-blue-600 rounded-2xl p-4">
              <p className="text-blue-100 text-[11px] font-medium uppercase tracking-wide">Available Balance</p>
              <p className="text-white font-bold text-xl mt-0.5">{formatUSDT(balance)}</p>
            </div>

            <div>
              <Label className="text-sm font-semibold mb-2 block">Recipient</Label>
              <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={recipient}
                  onChange={e => { setRecipient(e.target.value); setResolvedUser(null); if (step !== "input") setStep("input"); }}
                  placeholder="Username, email, or display ID"
                  className="h-12 pl-10 rounded-xl text-sm"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5 px-1">Enter the recipient's username (e.g. @john), email, or 6-digit ID</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-semibold">Amount (USDT)</Label>
                <button onClick={() => setAmount(String(parseFloat(String(balance)).toFixed(2)))} className="text-xs text-primary font-bold">MAX</button>
              </div>
              <Input
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className={cn("h-12 text-base rounded-xl", hasError && "border-destructive")}
              />
              {hasError && <p className="text-xs text-destructive mt-1.5 px-1">Insufficient balance</p>}
              {belowMin && <p className="text-xs text-destructive mt-1.5 px-1">Minimum transfer is 1.00 USDT</p>}
            </div>

            <div>
              <Label className="text-sm font-semibold mb-2 block">Note <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="What's this for?"
                className="h-12 rounded-xl text-sm"
              />
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 space-y-1.5">
              <p className="text-xs font-bold text-blue-700 mb-2">Transfer Information</p>
              {[
                "Transfers between Wexora users are instant",
                "No fee is charged for internal transfers",
                needsWdPassword || needs2FA ? "Security verification required before transfer" : "The recipient must have a verified Wexora account",
              ].map(info => (
                <div key={info} className="flex items-start gap-1.5">
                  <div className="w-1 h-1 rounded-full bg-blue-400 mt-2 shrink-0" />
                  <p className="text-[12px] text-blue-700">{info}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {step === "confirm" && (
          <>
            <div className="bg-white border border-border rounded-2xl p-5 text-center shadow-sm">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <User size={26} className="text-primary" />
              </div>
              <p className="font-bold text-foreground text-base">{resolvedUser?.fullName}</p>
              <p className="text-sm text-muted-foreground mt-0.5">@{resolvedUser?.username}</p>
              {resolvedUser?.displayId && <p className="text-xs text-muted-foreground mt-1">ID: #{resolvedUser.displayId}</p>}
              <div className="flex items-center justify-center gap-1.5 mt-2 bg-emerald-50 rounded-xl py-1.5">
                <Check size={12} className="text-emerald-500" />
                <p className="text-xs text-emerald-600 font-medium">Verified recipient</p>
              </div>
            </div>

            <div className="bg-white border border-border rounded-2xl divide-y divide-border overflow-hidden shadow-sm">
              {[
                { label: "To", val: `${resolvedUser?.fullName} (@${resolvedUser?.username})` },
                { label: "Amount", val: formatUSDT(amountNum) },
                { label: "Fee", val: "Free" },
                ...(note ? [{ label: "Note", val: note }] : []),
              ].map(({ label, val }) => (
                <div key={label} className="flex justify-between items-center px-4 py-3.5 text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className={cn("font-semibold max-w-[55%] text-right truncate", label === "Amount" && "text-primary text-base font-bold", label === "Fee" && "text-emerald-600")}>{val}</span>
                </div>
              ))}
            </div>

            <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-2xl p-3.5">
              <AlertCircle size={14} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[12px] text-amber-700 leading-snug">
                Please confirm the recipient details. This transfer cannot be reversed once sent.
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
              <p className="text-xs text-muted-foreground mt-1">Enter your credentials to authorize this transfer</p>
            </div>

            {needsWdPassword && (
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
            )}

            {needs2FA && (
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
            )}

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-1.5">
              <p className="text-xs font-bold text-foreground mb-2">Transfer Summary</p>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Recipient</span>
                <span className="font-semibold">{resolvedUser?.fullName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-bold text-primary">{formatUSDT(amountNum)}</span>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 max-w-screen-sm mx-auto px-4 pb-6 pt-3 bg-gradient-to-t from-background via-background to-transparent">
        {step === "input" ? (
          <Button
            className="w-full font-bold rounded-2xl shadow-lg"
            style={{ height: 52 }}
            onClick={handleResolve}
            disabled={resolving || !recipient.trim() || !amount || hasError || belowMin}
          >
            {resolving ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Finding user…
              </span>
            ) : <>Find Recipient <ArrowRight size={15} className="ml-1.5" /></>}
          </Button>
        ) : step === "confirm" ? (
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" style={{ height: 52 }} className="rounded-2xl font-semibold" onClick={() => setStep("input")}>
              <X size={15} className="mr-1.5" /> Go Back
            </Button>
            <Button
              className="font-bold rounded-2xl shadow-lg"
              style={{ height: 52 }}
              onClick={handleProceedFromConfirm}
              disabled={submitting}
            >
              {needsSecurity ? "Verify Identity →" : submitting ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Sending…
                </span>
              ) : "Confirm Transfer"}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" style={{ height: 52 }} className="rounded-2xl font-semibold" onClick={() => setStep("confirm")}>
              <X size={15} className="mr-1.5" /> Back
            </Button>
            <Button
              className="font-bold rounded-2xl shadow-lg"
              style={{ height: 52 }}
              onClick={handleTransfer}
              disabled={submitting || !securityValid}
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Sending…
                </span>
              ) : "Confirm Transfer"}
            </Button>
          </div>
        )}
      </div>
    </SubPageLayout>
  );
}
