import { useState, useRef } from "react";
import { Copy, Check, QrCode, ChevronRight, AlertCircle, Upload, X, ImageIcon } from "lucide-react";
import { useGetWallet, getGetWalletQueryKey, getGetTransactionsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { SubPageLayout } from "@/components/SubPageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatUSDT } from "@/lib/format";

export default function DepositPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [depNetwork, setDepNetwork] = useState<any>(null);
  const [depAmount, setDepAmount] = useState("");
  const [depTxHash, setDepTxHash] = useState("");
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);
  const [proofImage, setProofImage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: wallet } = useGetWallet({
    query: { queryKey: getGetWalletQueryKey(), staleTime: 30000 },
  });

  const networks = wallet?.addresses ?? [];
  const depAmountNum = parseFloat(depAmount) || 0;
  const selectedNet = depNetwork ?? networks[0] ?? null;

  const handleCopy = () => {
    if (!selectedNet?.address) return;
    navigator.clipboard.writeText(selectedNet.address).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxSize = 900;
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          if (width > height) { height = Math.round(height * maxSize / width); width = maxSize; }
          else { width = Math.round(width * maxSize / height); height = maxSize; }
        }
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
        setProofImage(canvas.toDataURL("image/jpeg", 0.75));
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!selectedNet) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/wallet/deposit", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: depAmountNum || selectedNet.minDeposit,
          network: selectedNet.network,
          txHash: depTxHash || undefined,
          proofImageUrl: proofImage || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? "Failed");
      toast({ title: "Deposit Submitted!", description: "We'll credit your account once verified." });
      queryClient.invalidateQueries({ queryKey: getGetTransactionsQueryKey({}) });
      navigate("/wallet");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = !!selectedNet && (depAmountNum === 0 || depAmountNum >= selectedNet.minDeposit);

  return (
    <SubPageLayout title="Deposit USDT">
      <div className="px-4 pt-5 pb-32 space-y-5">

        {/* Network selector */}
        <div>
          <Label className="text-sm font-semibold text-foreground mb-3 block">Select Network</Label>
          {networks.length === 0 ? (
            <div className="bg-muted rounded-xl p-4 text-center text-sm text-muted-foreground">Loading networks…</div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {networks.map((n: any) => (
                <button
                  key={n.network}
                  onClick={() => { setDepNetwork(n); setShowQr(false); }}
                  className={cn(
                    "border rounded-2xl p-4 text-left transition-all active:scale-[0.97]",
                    (depNetwork ?? networks[0])?.network === n.network
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "border-border bg-white hover:border-primary/40",
                  )}
                >
                  <p className="text-sm font-bold text-foreground">{n.network}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{n.label}</p>
                  <p className="text-[10px] text-primary font-medium mt-1.5">Min: {formatUSDT(n.minDeposit)}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedNet && (
          <>
            {/* Network info strip */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 grid grid-cols-3 gap-3">
              {[
                { label: "Min. Deposit", val: formatUSDT(selectedNet.minDeposit) },
                { label: "Network Fee", val: formatUSDT(selectedNet.networkFee) },
                { label: "Confirm Time", val: selectedNet.confirmationTime },
              ].map(({ label, val }) => (
                <div key={label} className="text-center">
                  <p className="text-[10px] text-muted-foreground font-medium">{label}</p>
                  <p className="text-xs font-bold text-foreground mt-0.5">{val}</p>
                </div>
              ))}
            </div>

            {/* QR toggle */}
            <button
              onClick={() => setShowQr(s => !s)}
              className="w-full flex items-center justify-between bg-primary/5 border border-primary/15 rounded-2xl px-4 py-3.5 transition-colors active:bg-primary/10"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                  <QrCode size={15} className="text-primary" />
                </div>
                <span className="text-sm font-semibold text-primary">{showQr ? "Hide QR Code" : "Show QR Code"}</span>
              </div>
              <ChevronRight size={15} className={cn("text-primary transition-transform", showQr && "rotate-90")} />
            </button>

            {showQr && (
              <div className="flex flex-col items-center gap-3 py-2">
                <div className="bg-white border-2 border-primary/20 rounded-2xl p-4 shadow-sm">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&format=png&data=${encodeURIComponent(selectedNet.address)}`}
                    alt="Deposit QR"
                    className="w-48 h-48 rounded-xl"
                  />
                </div>
                <p className="text-xs text-muted-foreground font-medium">{selectedNet.network} deposit address</p>
              </div>
            )}

            {/* Deposit address */}
            <div>
              <Label className="text-sm font-semibold mb-2 block">Deposit Address</Label>
              <div className="bg-white border border-border rounded-2xl p-4 flex items-start gap-3">
                <p className="text-xs font-mono text-foreground flex-1 break-all leading-relaxed select-all">{selectedNet.address}</p>
                <button
                  onClick={handleCopy}
                  className="shrink-0 w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center active:scale-90 transition-all"
                >
                  {copied ? <Check size={15} className="text-emerald-500" /> : <Copy size={15} className="text-primary" />}
                </button>
              </div>
              <div className="flex items-start gap-2 mt-2.5 px-1">
                <AlertCircle size={12} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-600 leading-snug">
                  Only send {selectedNet.network} USDT to this address. Sending other assets will result in permanent loss.
                </p>
              </div>
            </div>

            {/* Amount */}
            <div>
              <Label className="text-sm font-semibold mb-2 block">Amount to Deposit (USDT)</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={depAmount}
                onChange={(e) => setDepAmount(e.target.value)}
                placeholder={`Min. ${selectedNet.minDeposit} USDT`}
                className="h-12 text-base rounded-xl"
              />
              {depAmountNum > 0 && depAmountNum < selectedNet.minDeposit && (
                <p className="text-xs text-destructive mt-1.5 px-1">Minimum deposit is {formatUSDT(selectedNet.minDeposit)}</p>
              )}
            </div>

            {/* TX Hash */}
            <div>
              <Label className="text-sm font-semibold mb-2 block">Transaction Hash <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                value={depTxHash}
                onChange={(e) => setDepTxHash(e.target.value)}
                placeholder="Paste TX hash for faster verification"
                className="h-12 rounded-xl font-mono text-xs"
              />
            </div>

            {/* Proof image upload */}
            <div>
              <Label className="text-sm font-semibold mb-2 block">Payment Proof Screenshot <span className="text-muted-foreground font-normal">(recommended)</span></Label>
              {proofImage ? (
                <div className="relative rounded-2xl overflow-hidden border border-border">
                  <img src={proofImage} alt="Proof" className="w-full max-h-56 object-contain bg-slate-50" />
                  <button
                    onClick={() => setProofImage(null)}
                    className="absolute top-2 right-2 w-7 h-7 bg-black/60 rounded-full flex items-center justify-center"
                  >
                    <X size={13} className="text-white" />
                  </button>
                  <div className="px-3 py-2 bg-emerald-50 flex items-center gap-1.5">
                    <Check size={12} className="text-emerald-500" />
                    <p className="text-xs text-emerald-600 font-medium">Proof image attached</p>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full border-2 border-dashed border-border rounded-2xl p-6 flex flex-col items-center gap-2.5 hover:border-primary/40 hover:bg-primary/3 transition-colors active:scale-[0.98]"
                >
                  <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Upload size={18} className="text-primary" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-foreground">Upload screenshot</p>
                    <p className="text-xs text-muted-foreground mt-0.5">JPG, PNG, or WEBP · Max 5MB</p>
                  </div>
                  <div className="flex items-center gap-1.5 bg-primary/10 rounded-full px-3 py-1">
                    <ImageIcon size={11} className="text-primary" />
                    <span className="text-xs text-primary font-medium">Tap to choose file</span>
                  </div>
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
            </div>

            {/* Steps guide */}
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
              <p className="text-xs font-bold text-blue-700 mb-3">How to deposit</p>
              {[
                "Open your crypto wallet or exchange",
                `Select ${selectedNet.network} as the send network`,
                "Paste the deposit address shown above",
                "Enter the amount and send the transaction",
                "Upload your payment screenshot above",
                `Tap "I've Made the Transfer" below`,
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-2.5 mb-2 last:mb-0">
                  <div className="w-5 h-5 rounded-full bg-blue-200 text-blue-700 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                  <p className="text-[12px] text-blue-700 leading-snug">{step}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Sticky bottom button */}
      <div className="fixed bottom-0 left-0 right-0 z-30 max-w-screen-sm mx-auto px-4 pb-6 pt-3 bg-gradient-to-t from-background via-background to-transparent">
        <Button
          onClick={handleSubmit}
          className="w-full h-13 text-sm font-bold rounded-2xl shadow-lg"
          style={{ height: 52 }}
          disabled={submitting || !selectedNet || (depAmountNum > 0 && depAmountNum < (selectedNet?.minDeposit ?? 0))}
        >
          {submitting ? (
            <span className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Submitting…
            </span>
          ) : "I've Made the Transfer"}
        </Button>
      </div>
    </SubPageLayout>
  );
}
