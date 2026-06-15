import { useState, useRef } from "react";
import { Copy, Check, QrCode, AlertCircle, Upload, X, ImageIcon, ChevronDown } from "lucide-react";
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

  const { data: wallet } = useGetWallet({ query: { queryKey: getGetWalletQueryKey(), staleTime: 30000 } });
  const { data: platformSettings } = useQuery({
    queryKey: ["public-settings"],
    queryFn: () => fetch("/api/settings/public", { credentials: "include" }).then((r) => r.json()),
    staleTime: 60000,
  });

  const networks = wallet?.addresses ?? [];
  const depAmountNum = parseFloat(depAmount) || 0;
  const selectedNet = depNetwork ?? networks[0] ?? null;

  const customInstructions: string[] = (() => {
    const raw = platformSettings?.deposit_instructions?.trim();
    if (!raw) return [];
    return raw.split("\n").map((s: string) => s.trim()).filter(Boolean);
  })();

  const defaultInstructions = selectedNet ? [
    "Open your crypto wallet or exchange",
    `Select ${selectedNet.network} as the send network`,
    "Copy the deposit address and send the exact amount",
    "Paste the transaction hash below",
    "Upload your payment screenshot",
    `Tap "I've Made the Transfer"`,
  ] : [];

  const instructions = customInstructions.length > 0 ? customInstructions : defaultInstructions;

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
    if (!depTxHash.trim()) {
      toast({ title: "Transaction hash required", description: "Please paste your TX hash to continue.", variant: "destructive" });
      return;
    }
    if (!proofImage) {
      toast({ title: "Screenshot required", description: "Please upload your payment screenshot to continue.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/wallet/deposit", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: depAmountNum || selectedNet.minDeposit,
          network: selectedNet.network,
          txHash: depTxHash.trim(),
          proofImageUrl: proofImage,
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

  const belowMin = selectedNet && depAmountNum > 0 && depAmountNum < selectedNet.minDeposit;
  const canSubmit = !!selectedNet && !belowMin && !!depTxHash.trim() && !!proofImage;

  return (
    <SubPageLayout title="Deposit USDT">
      <div className="px-4 pt-4 pb-28 space-y-4">

        {/* Network selector */}
        <div>
          <Label className="text-sm font-semibold text-foreground mb-2.5 block">Select Network</Label>
          <div className="grid grid-cols-2 gap-2">
            {networks.length === 0 ? (
              <div className="col-span-2 bg-muted rounded-xl p-4 text-center text-sm text-muted-foreground">Loading…</div>
            ) : networks.map((n: any) => (
              <button
                key={n.network}
                onClick={() => { setDepNetwork(n); setShowQr(false); }}
                className={cn(
                  "border rounded-xl p-3 text-left transition-all active:scale-[0.97]",
                  (depNetwork ?? networks[0])?.network === n.network
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                    : "border-border bg-white hover:border-primary/40",
                )}
              >
                <p className="text-sm font-bold text-foreground">{n.network}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{n.label}</p>
                <p className="text-[10px] text-primary font-semibold mt-1">Min: {formatUSDT(n.minDeposit)}</p>
              </button>
            ))}
          </div>
        </div>

        {selectedNet && (
          <>
            {/* Address + QR combined card */}
            <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm">
              <div className="px-4 pt-3.5 pb-3">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Deposit Address</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowQr(s => !s)}
                      className="flex items-center gap-1 text-primary text-[11px] font-medium bg-primary/8 rounded-lg px-2 py-1"
                    >
                      <QrCode size={11} />
                      QR
                      <ChevronDown size={10} className={cn("transition-transform", showQr && "rotate-180")} />
                    </button>
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1 text-primary text-[11px] font-medium bg-primary/8 rounded-lg px-2 py-1"
                    >
                      {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>
                <p className="text-xs font-mono text-foreground break-all leading-relaxed select-all">{selectedNet.address}</p>
              </div>

              {showQr && (
                <div className="border-t border-border bg-slate-50 flex justify-center py-4">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&format=png&data=${encodeURIComponent(selectedNet.address)}`}
                    alt="QR"
                    className="w-44 h-44 rounded-xl"
                  />
                </div>
              )}

              <div className="border-t border-border px-4 py-2.5 grid grid-cols-3 text-center gap-2">
                <div>
                  <p className="text-[9px] text-muted-foreground font-medium uppercase">Min Deposit</p>
                  <p className="text-xs font-bold text-foreground mt-0.5">{formatUSDT(selectedNet.minDeposit)}</p>
                </div>
                <div>
                  <p className="text-[9px] text-muted-foreground font-medium uppercase">Network Fee</p>
                  <p className="text-xs font-bold text-foreground mt-0.5">{formatUSDT(selectedNet.networkFee)}</p>
                </div>
                <div>
                  <p className="text-[9px] text-muted-foreground font-medium uppercase">Confirm Time</p>
                  <p className="text-xs font-bold text-foreground mt-0.5">{selectedNet.confirmationTime}</p>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2 -mt-1 px-1">
              <AlertCircle size={11} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-600 leading-snug">
                Only send {selectedNet.network} USDT to this address. Sending other assets will result in permanent loss.
              </p>
            </div>

            {/* Amount */}
            <div>
              <Label className="text-sm font-semibold mb-1.5 block">Amount (USDT)</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={depAmount}
                onChange={(e) => setDepAmount(e.target.value)}
                placeholder={`Min. ${selectedNet.minDeposit} USDT`}
                className="h-11 text-base rounded-xl"
              />
              {belowMin && (
                <p className="text-xs text-destructive mt-1 px-1">Minimum deposit is {formatUSDT(selectedNet.minDeposit)}</p>
              )}
            </div>

            {/* TX Hash — required */}
            <div>
              <Label className="text-sm font-semibold mb-1.5 block">
                Transaction Hash <span className="text-destructive text-xs font-normal">*required</span>
              </Label>
              <Input
                value={depTxHash}
                onChange={(e) => setDepTxHash(e.target.value)}
                placeholder="Paste your TX hash here"
                className={cn("h-11 rounded-xl font-mono text-xs", !depTxHash.trim() && "border-amber-300")}
              />
              <p className="text-[11px] text-muted-foreground mt-1 px-1">Find it in your wallet's transaction history after sending.</p>
            </div>

            {/* Screenshot — required */}
            <div>
              <Label className="text-sm font-semibold mb-1.5 block">
                Payment Screenshot <span className="text-destructive text-xs font-normal">*required</span>
              </Label>
              {proofImage ? (
                <div className="relative rounded-2xl overflow-hidden border border-border">
                  <img src={proofImage} alt="Proof" className="w-full max-h-48 object-contain bg-slate-50" />
                  <button
                    onClick={() => setProofImage(null)}
                    className="absolute top-2 right-2 w-7 h-7 bg-black/60 rounded-full flex items-center justify-center"
                  >
                    <X size={13} className="text-white" />
                  </button>
                  <div className="px-3 py-2 bg-emerald-50 flex items-center gap-1.5">
                    <Check size={12} className="text-emerald-500" />
                    <p className="text-xs text-emerald-600 font-medium">Screenshot attached</p>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  className={cn(
                    "w-full border-2 border-dashed rounded-xl p-4 flex items-center gap-3 hover:bg-primary/3 transition-colors active:scale-[0.98]",
                    "border-amber-300 bg-amber-50/40"
                  )}
                >
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Upload size={16} className="text-primary" />
                  </div>
                  <div className="text-left flex-1">
                    <p className="text-sm font-semibold text-foreground">Upload screenshot</p>
                    <p className="text-xs text-muted-foreground mt-0.5">JPG, PNG, or WEBP · Max 5MB</p>
                  </div>
                  <div className="flex items-center gap-1 bg-primary/10 rounded-lg px-2.5 py-1.5 shrink-0">
                    <ImageIcon size={11} className="text-primary" />
                    <span className="text-xs text-primary font-medium">Choose</span>
                  </div>
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
            </div>

            {/* Instructions */}
            {instructions.length > 0 && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3.5">
                <p className="text-xs font-bold text-blue-700 mb-2">How to deposit</p>
                <div className="space-y-1.5">
                  {instructions.map((step: string, i: number) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="w-4 h-4 rounded-full bg-blue-200 text-blue-700 text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {i + 1}
                      </div>
                      <p className="text-[11px] text-blue-700 leading-snug">{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Sticky bottom button */}
      <div className="fixed bottom-0 left-0 right-0 z-30 max-w-screen-sm mx-auto px-4 pb-6 pt-3 bg-gradient-to-t from-background via-background to-transparent">
        {selectedNet && (!depTxHash.trim() || !proofImage) && (
          <p className="text-center text-xs text-amber-600 mb-2 font-medium">
            {!depTxHash.trim() && !proofImage ? "TX hash & screenshot required" : !depTxHash.trim() ? "TX hash required" : "Screenshot required"}
          </p>
        )}
        <Button
          onClick={handleSubmit}
          className="w-full font-bold rounded-2xl shadow-lg"
          style={{ height: 52 }}
          disabled={submitting || !canSubmit}
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
