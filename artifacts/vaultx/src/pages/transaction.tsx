import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Copy, Check, Clock, CheckCircle,
  XCircle, AlertCircle, Share2, ImageDown, FileText, X,
} from "lucide-react";
import { SubPageLayout } from "@/components/SubPageLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatUSDT, formatDateTime } from "@/lib/format";
import { useState } from "react";
import {
  downloadReceiptImage,
  downloadReceiptPDF,
  shareReceiptImage,
  type ReceiptTx,
  type ReceiptSettings,
} from "@/lib/receiptGenerator";

const INCOMING_TYPES = ["deposit", "earning", "referral", "reinvest", "admin_adjustment"];

const STATUS_CONFIG: Record<string, { icon: React.ElementType; color: string; ringColor: string; label: string; bg: string }> = {
  completed: { icon: CheckCircle, color: "text-emerald-500", ringColor: "#22c55e", label: "Completed", bg: "bg-emerald-500/10 border-emerald-500/20" },
  pending:   { icon: Clock,        color: "text-amber-500",  ringColor: "#f59e0b", label: "Pending",   bg: "bg-amber-500/10 border-amber-500/20" },
  failed:    { icon: XCircle,      color: "text-red-500",    ringColor: "#ef4444", label: "Rejected",  bg: "bg-red-500/10 border-red-500/20" },
};

const TYPE_LABEL: Record<string, string> = {
  deposit: "DEPOSIT", withdrawal: "WITHDRAWAL", transfer: "TRANSFER",
  earning: "PROFIT", referral: "REFERRAL BONUS", reinvest: "REINVESTMENT",
  investment: "INVESTMENT", admin_adjustment: "ADJUSTMENT",
};

interface ShareSheetProps {
  txId?: string | null;
  txDbId: number;
  onClose: () => void;
  onShare: () => void;
  onSaveImage: () => void;
  onDownloadPdf: () => void;
  loading: boolean;
}

function ShareSheet({ txId, txDbId, onClose, onShare, onSaveImage, onDownloadPdf, loading }: ShareSheetProps) {
  const displayId = txId ?? txDbId;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-screen-sm bg-card border-t border-border rounded-t-3xl px-4 pt-4 pb-10 space-y-2 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-base text-foreground">Export Receipt</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
            <X size={15} />
          </button>
        </div>

        <button
          onClick={onShare}
          disabled={loading}
          className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-colors active:scale-[0.98]"
        >
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Share2 size={18} className="text-primary" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-sm text-foreground">Share Receipt</p>
            <p className="text-[11px] text-muted-foreground">Send via WhatsApp, Telegram, Gmail…</p>
          </div>
        </button>

        <button
          onClick={onSaveImage}
          disabled={loading}
          className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors active:scale-[0.98]"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
            <ImageDown size={18} className="text-emerald-500" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-sm text-foreground">Save as Image</p>
            <p className="text-[11px] text-muted-foreground">VaultX-Receipt-{displayId}.png</p>
          </div>
        </button>

        <button
          onClick={onDownloadPdf}
          disabled={loading}
          className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-colors active:scale-[0.98]"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
            <FileText size={18} className="text-blue-500" />
          </div>
          <div className="text-left">
            <p className="font-semibold text-sm text-foreground">Download PDF</p>
            <p className="text-[11px] text-muted-foreground">VaultX-Receipt-{displayId}.pdf</p>
          </div>
        </button>

        {loading && (
          <p className="text-center text-xs text-muted-foreground py-2 animate-pulse">
            Generating receipt…
          </p>
        )}
      </div>
    </div>
  );
}

function TimelineStep({
  icon: Icon,
  label,
  time,
  color,
  connector,
  active,
}: {
  icon: React.ElementType;
  label: string;
  time?: string;
  color: string;
  connector?: "active" | "inactive" | "none";
  active: boolean;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 transition-all",
          active ? `${color} border-current` : "bg-muted border-border text-muted-foreground"
        )}>
          <Icon size={14} />
        </div>
        {connector !== "none" && (
          <div className={cn("w-0.5 flex-1 min-h-[20px] mt-1", connector === "active" ? "bg-emerald-500/50" : "bg-border")} />
        )}
      </div>
      <div className="pb-5">
        <p className={cn("text-sm font-semibold", active ? "text-foreground" : "text-muted-foreground")}>
          {label}
        </p>
        {time ? (
          <p className="text-xs text-muted-foreground mt-0.5">{time}</p>
        ) : (
          <p className="text-xs text-muted-foreground/60 mt-0.5 italic">Awaiting admin review</p>
        )}
      </div>
    </div>
  );
}

export default function TransactionPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [copied, setCopied] = useState<string | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);

  const { data: tx, isLoading, error } = useQuery({
    queryKey: ["transaction", id],
    queryFn: async () => {
      const res = await fetch(`/api/wallet/transactions/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).message ?? "Transaction not found");
      return res.json();
    },
    staleTime: 60000,
  });

  const { data: settings } = useQuery({
    queryKey: ["public-settings"],
    queryFn: () => fetch("/api/settings/public", { credentials: "include" }).then((r) => r.json()),
    staleTime: 120000,
  });

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
    toast({ title: "Copied!" });
  };

  const receiptSettings: ReceiptSettings = {
    platformName: settings?.platform_name ?? "VaultX",
    platformLogoUrl: settings?.platform_logo_url ?? undefined,
    platformUrl: settings?.platform_url ?? undefined,
  };

  const receiptTx: ReceiptTx | undefined = tx
    ? {
        txId: tx.txId,
        id: tx.id,
        type: tx.type,
        amount: tx.amount,
        fee: tx.fee,
        network: tx.network,
        address: tx.address,
        txHash: tx.txHash,
        status: tx.status,
        createdAt: tx.createdAt,
        updatedAt: tx.updatedAt,
      }
    : undefined;

  const handleShare = async () => {
    if (!receiptTx) return;
    setShareLoading(true);
    try {
      const shared = await shareReceiptImage(receiptTx, receiptSettings);
      if (shared) {
        toast({ title: "Receipt shared!" });
      } else {
        // No native share available — download image as fallback
        await downloadReceiptImage(receiptTx, receiptSettings);
        toast({ title: "Receipt downloaded", description: "Native sharing not available on this browser." });
      }
    } catch (e: any) {
      toast({ title: "Could not share", description: e.message, variant: "destructive" });
    } finally {
      setShareLoading(false);
      setShowShare(false);
    }
  };

  const handleSaveImage = async () => {
    if (!receiptTx) return;
    setShareLoading(true);
    try {
      await downloadReceiptImage(receiptTx, receiptSettings);
      toast({ title: "Receipt downloaded!", description: `VaultX-Receipt-${receiptTx.txId ?? receiptTx.id}.png saved.` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setShareLoading(false);
      setShowShare(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!receiptTx) return;
    setShareLoading(true);
    try {
      await downloadReceiptPDF(receiptTx, receiptSettings);
      toast({ title: "PDF downloaded!", description: `VaultX-Receipt-${receiptTx.txId ?? receiptTx.id}.pdf saved.` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setShareLoading(false);
      setShowShare(false);
    }
  };

  const isIncoming = tx && INCOMING_TYPES.includes(tx.type);
  const statusCfg = tx ? (STATUS_CONFIG[tx.status] ?? STATUS_CONFIG.pending) : null;
  const StatusIcon = statusCfg?.icon ?? Clock;

  const hasProcessingTime =
    tx?.updatedAt && tx?.createdAt &&
    new Date(tx.updatedAt).getTime() - new Date(tx.createdAt).getTime() > 30000;

  const processedAt = hasProcessingTime ? tx.updatedAt : undefined;

  return (
    <>
      <SubPageLayout
        title="Transaction Receipt"
        actions={
          <button
            onClick={() => setShowShare(true)}
            className="w-9 h-9 rounded-full bg-muted flex items-center justify-center active:scale-90 transition-transform"
          >
            <Share2 size={15} className="text-foreground" />
          </button>
        }
      >
        {isLoading ? (
          <div className="px-4 pt-6 space-y-4">
            <Skeleton className="h-48 rounded-2xl" />
            <Skeleton className="h-72 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
          </div>
        ) : error || !tx ? (
          <div className="px-4 pt-12 text-center">
            <AlertCircle size={32} className="text-muted-foreground mx-auto mb-3" />
            <p className="font-semibold text-foreground">Transaction not found</p>
            <p className="text-xs text-muted-foreground mt-1">This transaction may have been removed or you don't have access.</p>
          </div>
        ) : (
          <div className="px-4 pt-5 pb-12 space-y-4">

            {/* ── Hero status card ── */}
            <div className={cn("rounded-2xl border p-6 text-center", statusCfg?.bg)}>
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 ring-4"
                style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
              >
                <StatusIcon size={28} className={statusCfg?.color} />
              </div>
              <p className={cn("text-sm font-bold uppercase tracking-widest mb-1", statusCfg?.color)}>
                {statusCfg?.label}
              </p>
              <p className={cn("text-4xl font-black tracking-tight", isIncoming ? "text-emerald-500" : "text-red-500")}>
                {isIncoming ? "+" : "−"}{formatUSDT(tx.amount)}
              </p>
              <p className="text-xs text-muted-foreground mt-1.5 font-semibold uppercase tracking-wider">
                {TYPE_LABEL[tx.type] ?? tx.type.replace(/_/g, " ")}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">{formatDateTime(tx.createdAt)}</p>
            </div>

            {/* ── Transaction Details ── */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b border-border bg-muted/30">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Transaction Details</p>
              </div>
              {[
                ...(tx.txId ? [{ label: "VaultX TxID", val: tx.txId, copyKey: "txid", mono: true, highlight: true }] : []),
                { label: "Type",        val: tx.type.replace(/_/g, " "),   capitalize: true },
                { label: "Amount",      val: formatUSDT(tx.amount) },
                ...(tx.fee > 0 ? [{ label: "Fee", val: formatUSDT(tx.fee) }] : []),
                {
                  label: "Status", val: statusCfg?.label ?? tx.status,
                  color: tx.status === "completed" ? "text-emerald-500" : tx.status === "failed" ? "text-red-500" : "text-amber-500",
                },
                { label: "Submitted",   val: formatDateTime(tx.createdAt) },
                ...(processedAt ? [{ label: "Processed", val: formatDateTime(processedAt) }] : []),
                ...(tx.network  ? [{ label: "Network",  val: tx.network }] : []),
                ...(tx.address  ? [{ label: "Address",  val: tx.address,  copyKey: "address", mono: true, truncate: true }] : []),
                ...(tx.txHash   ? [{ label: "TX Hash",  val: tx.txHash,   copyKey: "txhash",  mono: true, truncate: true }] : []),
                ...(tx.note     ? [{ label: "Note",     val: tx.note }] : []),
              ].map(({ label, val, copyKey, mono, capitalize, truncate, color, highlight }: any) => (
                <div key={label} className="flex items-start justify-between px-4 py-3 border-b border-border last:border-0 gap-3">
                  <span className="text-sm text-muted-foreground shrink-0 w-24 leading-relaxed">{label}</span>
                  <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-end">
                    <span className={cn(
                      "text-sm font-semibold text-right leading-relaxed",
                      mono && "font-mono text-xs",
                      capitalize && "capitalize",
                      truncate && "truncate max-w-[150px]",
                      color,
                      highlight && "text-primary",
                    )}>
                      {val}
                    </span>
                    {copyKey && (
                      <button onClick={() => handleCopy(val, copyKey)} className="shrink-0 p-1 rounded active:scale-90">
                        {copied === copyKey
                          ? <Check size={12} className="text-emerald-500" />
                          : <Copy size={12} className="text-muted-foreground" />}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* ── Proof image ── */}
            {tx.type === "deposit" && tx.metadata?.proofImageUrl && (
              <div>
                <p className="text-sm font-bold text-foreground mb-2.5">Payment Proof</p>
                <div className="rounded-2xl overflow-hidden border border-border bg-muted">
                  <img src={tx.metadata.proofImageUrl} alt="Payment proof" className="w-full object-contain max-h-72" />
                </div>
              </div>
            )}

            {/* ── Status Timeline ── */}
            <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
              <p className="text-xs font-bold text-foreground mb-4 uppercase tracking-wide">Status Timeline</p>
              <div>
                <TimelineStep
                  icon={CheckCircle}
                  label="Submitted"
                  time={formatDateTime(tx.createdAt)}
                  color="bg-emerald-500/15 text-emerald-500 border-emerald-500"
                  connector={tx.status !== "pending" ? "active" : "inactive"}
                  active={true}
                />
                {tx.status === "pending" ? (
                  <TimelineStep
                    icon={Clock}
                    label="Awaiting Review"
                    color="bg-amber-500/15 text-amber-500 border-amber-500"
                    connector="none"
                    active={true}
                  />
                ) : (
                  <>
                    {processedAt && (
                      <TimelineStep
                        icon={Clock}
                        label="Processing"
                        time={formatDateTime(processedAt)}
                        color="bg-blue-500/15 text-blue-500 border-blue-500"
                        connector="active"
                        active={true}
                      />
                    )}
                    <TimelineStep
                      icon={tx.status === "completed" ? CheckCircle : XCircle}
                      label={tx.status === "completed" ? "Completed" : "Rejected"}
                      time={processedAt ? formatDateTime(processedAt) : formatDateTime(tx.updatedAt ?? tx.createdAt)}
                      color={tx.status === "completed"
                        ? "bg-emerald-500/15 text-emerald-500 border-emerald-500"
                        : "bg-red-500/15 text-red-500 border-red-500"}
                      connector="none"
                      active={true}
                    />
                  </>
                )}
              </div>
            </div>

            {/* ── Support note ── */}
            <div className="bg-blue-500/8 border border-blue-500/20 rounded-2xl p-3.5 flex gap-2.5">
              <AlertCircle size={14} className="text-blue-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-[12px] text-blue-600 dark:text-blue-400 leading-snug">
                  For assistance regarding this transaction, please contact support and provide your VaultX Transaction ID.
                </p>
                {tx.txId && (
                  <button
                    onClick={() => handleCopy(tx.txId, "support-txid")}
                    className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-blue-500 dark:text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded-full"
                  >
                    <span className="font-mono">{tx.txId}</span>
                    {copied === "support-txid"
                      ? <Check size={10} className="text-emerald-500" />
                      : <Copy size={10} className="opacity-70" />}
                  </button>
                )}
              </div>
            </div>

            {/* ── Export actions ── */}
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                className="flex-col h-16 gap-1 text-xs"
                onClick={() => setShowShare(true)}
              >
                <Share2 size={16} />
                Share
              </Button>
              <Button
                variant="outline"
                className="flex-col h-16 gap-1 text-xs"
                onClick={handleSaveImage}
                disabled={shareLoading}
              >
                <ImageDown size={16} />
                Save Image
              </Button>
              <Button
                variant="outline"
                className="flex-col h-16 gap-1 text-xs"
                onClick={handleDownloadPdf}
                disabled={shareLoading}
              >
                <FileText size={16} />
                PDF
              </Button>
            </div>

          </div>
        )}
      </SubPageLayout>

      {showShare && receiptTx && (
        <ShareSheet
          txId={tx?.txId}
          txDbId={tx?.id}
          onClose={() => setShowShare(false)}
          onShare={handleShare}
          onSaveImage={handleSaveImage}
          onDownloadPdf={handleDownloadPdf}
          loading={shareLoading}
        />
      )}
    </>
  );
}
