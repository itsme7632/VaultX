import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownLeft, ArrowUpRight, Copy, Check, Clock, CheckCircle, XCircle, AlertCircle,
  Download, Share2,
} from "lucide-react";
import { SubPageLayout } from "@/components/SubPageLayout";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatUSDT, formatDateTime } from "@/lib/format";
import { useState } from "react";

const TX_ICONS: Record<string, React.ElementType> = {
  deposit: ArrowDownLeft,
  earning: ArrowDownLeft,
  referral: ArrowDownLeft,
  reinvest: ArrowDownLeft,
  withdrawal: ArrowUpRight,
  investment: ArrowUpRight,
  transfer: ArrowUpRight,
  admin_adjustment: ArrowDownLeft,
};

const TX_COLORS: Record<string, string> = {
  deposit: "bg-emerald-50 text-emerald-600",
  earning: "bg-amber-50 text-amber-600",
  referral: "bg-purple-50 text-purple-600",
  reinvest: "bg-blue-50 text-blue-600",
  withdrawal: "bg-red-50 text-red-600",
  investment: "bg-primary/10 text-primary",
  transfer: "bg-blue-50 text-blue-600",
  admin_adjustment: "bg-slate-100 text-slate-600",
};

const STATUS_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  completed: { icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200", label: "Completed" },
  pending: { icon: Clock, color: "text-amber-600", bg: "bg-amber-50 border-amber-200", label: "Pending" },
  failed: { icon: XCircle, color: "text-red-600", bg: "bg-red-50 border-red-200", label: "Failed" },
};

export default function TransactionPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [copied, setCopied] = useState<string | null>(null);

  const { data: tx, isLoading, error } = useQuery({
    queryKey: ["transaction", id],
    queryFn: async () => {
      const res = await fetch(`/api/wallet/transactions/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).message ?? "Transaction not found");
      return res.json();
    },
    staleTime: 60000,
  });

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
    toast({ title: "Copied!" });
  };

  const isIncoming = tx && ["deposit", "earning", "referral", "reinvest", "admin_adjustment"].includes(tx.type);
  const statusCfg = tx ? (STATUS_CONFIG[tx.status] ?? STATUS_CONFIG.pending) : null;
  const StatusIcon = statusCfg?.icon ?? Clock;
  const TxIcon = tx ? (TX_ICONS[tx.type] ?? ArrowUpRight) : ArrowUpRight;

  const handleShare = () => {
    if (!tx) return;
    const text = `VaultX Transaction\nType: ${tx.type}\nAmount: ${formatUSDT(tx.amount)}\nStatus: ${tx.status}\nDate: ${formatDateTime(tx.createdAt)}${tx.txHash ? `\nTX: ${tx.txHash}` : ""}`;
    if (navigator.share) {
      navigator.share({ title: "Transaction Receipt", text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text).catch(() => {});
      toast({ title: "Copied to clipboard" });
    }
  };

  return (
    <SubPageLayout title="Transaction Receipt" actions={
      <button onClick={handleShare} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center active:scale-90 transition-transform">
        <Share2 size={15} className="text-foreground" />
      </button>
    }>
      {isLoading ? (
        <div className="px-4 pt-6 space-y-4">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      ) : error || !tx ? (
        <div className="px-4 pt-12 text-center">
          <AlertCircle size={32} className="text-muted-foreground mx-auto mb-3" />
          <p className="font-semibold text-foreground">Transaction not found</p>
          <p className="text-xs text-muted-foreground mt-1">This transaction may have been removed or you don't have access.</p>
        </div>
      ) : (
        <div className="px-4 pt-6 pb-10 space-y-5">

          {/* Status hero */}
          <div className={cn("rounded-2xl border p-6 text-center", statusCfg?.bg)}>
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: "rgba(255,255,255,0.7)" }}>
              <StatusIcon size={28} className={statusCfg?.color} />
            </div>
            <p className={cn("font-bold text-xl", statusCfg?.color)}>{statusCfg?.label}</p>
            <p className={cn("text-3xl font-black mt-2", isIncoming ? "text-emerald-600" : "text-red-500")}>
              {isIncoming ? "+" : "−"}{formatUSDT(tx.amount)}
            </p>
            <p className="text-sm text-muted-foreground mt-1 capitalize font-medium">{tx.type.replace("_", " ")}</p>
          </div>

          {/* Transaction details */}
          <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm divide-y divide-border">
            <div className="px-4 py-3 bg-muted/30">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Transaction Details</p>
            </div>

            {[
              ...(tx.txId ? [{ label: "VaultX TxID", val: tx.txId, copyKey: "txid", mono: true }] : []),
              { label: "Internal ID", val: `#${tx.id}`, mono: true },
              { label: "Type", val: tx.type.replace("_", " "), capitalize: true },
              { label: "Amount", val: formatUSDT(tx.amount) },
              ...(tx.fee > 0 ? [{ label: "Fee", val: formatUSDT(tx.fee) }] : []),
              { label: "Status", val: tx.status, capitalize: true, color: tx.status === "completed" ? "text-emerald-600" : tx.status === "failed" ? "text-red-600" : "text-amber-600" },
              { label: "Date & Time", val: formatDateTime(tx.createdAt) },
              ...(tx.network ? [{ label: "Network", val: tx.network }] : []),
              ...(tx.address ? [{ label: "Address", val: tx.address, copyKey: "address", mono: true, truncate: true }] : []),
              ...(tx.txHash ? [{ label: "TX Hash", val: tx.txHash, copyKey: "txhash", mono: true, truncate: true }] : []),
              ...(tx.note ? [{ label: "Note", val: tx.note }] : []),
            ].map(({ label, val, copyKey, mono, capitalize, truncate, color }: any) => (
              <div key={label} className="flex items-start justify-between px-4 py-3 gap-3">
                <span className="text-sm text-muted-foreground shrink-0 w-28">{label}</span>
                <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-end">
                  <span className={cn(
                    "text-sm font-semibold text-right",
                    mono && "font-mono text-xs",
                    capitalize && "capitalize",
                    truncate && "truncate max-w-[140px]",
                    color,
                  )}>
                    {val}
                  </span>
                  {copyKey && (
                    <button onClick={() => handleCopy(val, copyKey)} className="shrink-0 p-1 rounded active:scale-90">
                      {copied === copyKey ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} className="text-muted-foreground" />}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Proof image (for deposits) */}
          {tx.type === "deposit" && tx.metadata?.proofImageUrl && (
            <div>
              <p className="text-sm font-bold text-foreground mb-2.5">Payment Proof</p>
              <div className="rounded-2xl overflow-hidden border border-border bg-slate-50">
                <img src={tx.metadata.proofImageUrl} alt="Payment proof" className="w-full object-contain max-h-72" />
              </div>
            </div>
          )}

          {/* Status timeline */}
          <div className="bg-white border border-border rounded-2xl p-4">
            <p className="text-xs font-bold text-foreground mb-4">Status Timeline</p>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                  <CheckCircle size={14} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Submitted</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(tx.createdAt)}</p>
                </div>
              </div>
              {tx.status === "pending" && (
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                    <Clock size={14} className="text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-amber-600">Pending Review</p>
                    <p className="text-xs text-muted-foreground">Admin is reviewing your request</p>
                  </div>
                </div>
              )}
              {tx.status === "completed" && (
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                    <CheckCircle size={14} className="text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-emerald-600">Confirmed</p>
                    <p className="text-xs text-muted-foreground">Transaction processed successfully</p>
                  </div>
                </div>
              )}
              {tx.status === "failed" && (
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                    <XCircle size={14} className="text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-red-600">Rejected</p>
                    <p className="text-xs text-muted-foreground">Transaction was not approved</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Support note */}
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3.5 flex gap-2.5">
            <AlertCircle size={14} className="text-blue-600 shrink-0 mt-0.5" />
            <p className="text-[12px] text-blue-700 leading-snug">
              If you have any issues with this transaction, please contact support with your Transaction ID: <span className="font-bold">#{tx.id}</span>
            </p>
          </div>

        </div>
      )}
    </SubPageLayout>
  );
}
