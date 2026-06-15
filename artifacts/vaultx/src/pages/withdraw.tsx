import { useState } from "react";
import { Shield, AlertCircle, Clock, Copy, Check, X } from "lucide-react";
import { useGetWallet, getGetWalletQueryKey, useCreateWithdrawal, getGetTransactionsQueryKey } from "@workspace/api-client-react";
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

export default function WithdrawPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [step, setStep] = useState<"form" | "confirm">("form");
  const [wdAmount, setWdAmount] = useState("");
  const [wdNetwork, setWdNetwork] = useState("");
  const [wdAddress, setWdAddress] = useState("");
  const [copiedAddr, setCopiedAddr] = useState(false);

  const { data: wallet } = useGetWallet({ query: { queryKey: getGetWalletQueryKey(), staleTime: 30000 } });
  const { data: platformSettings } = useQuery({
    queryKey: ["public-settings"],
    queryFn: () => fetch("/api/settings/public", { credentials: "include" }).then((r) => r.json()),
    staleTime: 60000,
  });

  const customRules: string[] = (() => {
    const raw = platformSettings?.withdrawal_instructions?.trim();
    if (!raw) return [];
    return raw.split("\n").map((s: string) => s.trim()).filter(Boolean);
  })();
  const withdraw = useCreateWithdrawal();

  const networks = wallet?.addresses ?? [];
  const feePercent = parseFloat(platformSettings?.withdrawal_fee_percent ?? "1.5");
  const minWithdrawal = parseFloat(platformSettings?.min_withdrawal ?? "10");
  const wdAmountNum = parseFloat(wdAmount) || 0;
  const wdFee = wdAmountNum * feePercent / 100;
  const wdNet = Math.max(0, wdAmountNum - wdFee);
  const balance = wallet?.balance ?? 0;

  const hasError = wdAmountNum > 0 && wdAmountNum > balance;
  const belowMin = wdAmountNum > 0 && wdAmountNum < minWithdrawal;
  const canProceed = wdAmount && wdAddress.trim().length > 8 && wdNetwork && !hasError && !belowMin && wdAmountNum > 0;

  const handleSetMax = () => setWdAmount(String(parseFloat(String(balance)).toFixed(2)));

  const handleConfirm = () => {
    withdraw.mutate(
      { data: { amount: wdAmountNum, network: wdNetwork, address: wdAddress } },
      {
        onSuccess: () => {
          toast({ title: "Withdrawal Requested", description: "Your request is being reviewed (within 24h)" });
          queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetTransactionsQueryKey({}) });
          navigate("/wallet");
        },
        onError: (e: any) => {
          setStep("form");
          toast({ title: "Error", description: e?.message, variant: "destructive" });
        },
      },
    );
  };

  return (
    <SubPageLayout title="Withdraw USDT">
      <div className="px-4 pt-5 pb-32 space-y-5">

        {step === "form" ? (
          <>
            {/* Balance card */}
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

            {/* Network selector */}
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

            {/* Amount */}
            <div>
              <Label className="text-sm font-semibold mb-2 block">Amount (USDT)</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={wdAmount}
                onChange={(e) => setWdAmount(e.target.value)}
                placeholder="0.00"
                className={cn("h-12 text-base rounded-xl", hasError && "border-destructive")}
              />
              {hasError && <p className="text-xs text-destructive mt-1.5 px-1">Insufficient balance</p>}
              {belowMin && <p className="text-xs text-destructive mt-1.5 px-1">Minimum withdrawal is {formatUSDT(minWithdrawal)}</p>}
            </div>

            {/* Fee breakdown */}
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

            {/* Wallet address */}
            <div>
              <Label className="text-sm font-semibold mb-2 block">Withdrawal Address</Label>
              <Input
                value={wdAddress}
                onChange={(e) => setWdAddress(e.target.value)}
                placeholder="Your external wallet address"
                className="h-12 rounded-xl font-mono text-xs"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
              <p className="text-[11px] text-muted-foreground mt-1.5 px-1">
                Triple-check this address. Crypto sent to a wrong address is unrecoverable.
              </p>
            </div>

            {/* Info box */}
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
        ) : (
          <>
            {/* Confirm step */}
            <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center">
              <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-3">
                <Shield size={22} className="text-red-500" />
              </div>
              <p className="font-bold text-red-700">Confirm Withdrawal</p>
              <p className="text-xs text-red-500 mt-1">Review all details carefully before proceeding</p>
            </div>

            <div className="bg-white border border-border rounded-2xl divide-y divide-border overflow-hidden shadow-sm">
              {[
                { label: "Network", val: wdNetwork, mono: false },
                { label: "Amount", val: formatUSDT(wdAmountNum), mono: false },
                { label: `Fee (${feePercent}%)`, val: `−${formatUSDT(wdFee)}`, mono: false },
                { label: "You Receive", val: formatUSDT(wdNet), mono: false },
              ].map(({ label, val, mono }) => (
                <div key={label} className="flex justify-between items-center px-4 py-3.5 text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className={cn("font-bold", label === "You Receive" && "text-emerald-600", mono && "font-mono text-xs")}>{val}</span>
                </div>
              ))}
              <div className="px-4 py-3.5">
                <p className="text-xs text-muted-foreground mb-1.5">To Address</p>
                <div className="flex items-start gap-2">
                  <p className="font-mono text-xs text-foreground break-all flex-1 leading-relaxed">{wdAddress}</p>
                  <button onClick={() => { navigator.clipboard.writeText(wdAddress); setCopiedAddr(true); setTimeout(() => setCopiedAddr(false), 2000); }} className="p-1.5 rounded-lg hover:bg-muted shrink-0">
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
      </div>

      {/* Sticky bottom action */}
      <div className="fixed bottom-0 left-0 right-0 z-30 max-w-screen-sm mx-auto px-4 pb-6 pt-3 bg-gradient-to-t from-background via-background to-transparent">
        {step === "form" ? (
          <Button
            className="w-full bg-red-500 hover:bg-red-600 font-bold rounded-2xl shadow-lg"
            style={{ height: 52 }}
            onClick={() => setStep("confirm")}
            disabled={!canProceed}
          >
            Review Withdrawal
          </Button>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" style={{ height: 52 }} className="rounded-2xl font-semibold" onClick={() => setStep("form")}>
              <X size={15} className="mr-1.5" /> Go Back
            </Button>
            <Button
              className="bg-red-500 hover:bg-red-600 font-bold rounded-2xl shadow-lg"
              style={{ height: 52 }}
              onClick={handleConfirm}
              disabled={withdraw.isPending}
            >
              {withdraw.isPending ? (
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
