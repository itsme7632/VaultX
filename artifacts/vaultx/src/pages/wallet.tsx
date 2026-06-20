import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Filter, ChevronRight } from "lucide-react";
import {
  useGetWallet, getGetWalletQueryKey,
  useGetTransactions, getGetTransactionsQueryKey,
  type GetTransactionsType,
} from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/AppLayout";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatUSDT, formatDateTime } from "@/lib/format";
import { useState } from "react";

const TX_TYPE_COLORS: Record<string, string> = {
  deposit: "bg-emerald-50 text-emerald-600",
  withdrawal: "bg-red-50 text-red-600",
  earning: "bg-amber-50 text-amber-600",
  reinvest: "bg-primary/10 text-primary",
  investment: "bg-primary/10 text-primary",
  transfer: "bg-blue-50 text-blue-600",
  referral: "bg-purple-50 text-purple-600",
  admin_adjustment: "bg-slate-100 text-slate-600",
};

const STATUS_BADGE: Record<string, string> = {
  completed: "bg-emerald-50 text-emerald-600 border-emerald-200",
  pending: "bg-amber-50 text-amber-600 border-amber-200",
  failed: "bg-red-50 text-red-600 border-red-200",
};

export default function WalletPage() {
  const [, navigate] = useLocation();
  const [txFilter, setTxFilter] = useState<GetTransactionsType | "all">("all");

  const { data: wallet, isLoading: walletLoading } = useGetWallet({
    query: { queryKey: getGetWalletQueryKey(), staleTime: 30000 },
  });
  const { data: txData, isLoading: txLoading } = useGetTransactions(
    { type: txFilter === "all" ? undefined : txFilter, limit: 40 },
    { query: { queryKey: getGetTransactionsQueryKey({ type: txFilter === "all" ? undefined : txFilter, limit: 40 }), staleTime: 20000 } },
  );

  return (
    <AppLayout title="Wallet">
      <div className="px-4 pt-5 pb-24 space-y-5">

        {/* Balance card */}
        <div className="bg-gradient-to-br from-slate-800 via-slate-800 to-slate-900 rounded-2xl p-5 text-white shadow-lg">
          <p className="text-slate-400 text-[11px] uppercase tracking-widest font-medium mb-1">Available Balance</p>
          {walletLoading ? (
            <Skeleton className="h-10 w-44 bg-white/10 mb-3" />
          ) : (
            <p className="text-3xl font-bold mb-3 tracking-tight">{formatUSDT(wallet?.balance ?? 0)}</p>
          )}
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: "Deposited", val: wallet?.totalDeposited ?? 0, color: "text-emerald-300" },
              { label: "Withdrawn", val: wallet?.totalWithdrawn ?? 0, color: "text-red-300" },
              { label: "Earned", val: wallet?.totalEarnings ?? 0, color: "text-amber-300" },
            ].map(({ label, val, color }) => (
              <div key={label} className="bg-white/8 rounded-xl py-2.5 px-1">
                <p className="text-slate-400 text-[10px] font-medium">{label}</p>
                <p className={cn("font-semibold mt-1 text-[11px]", color)}>
                  {walletLoading ? "…" : formatUSDT(val)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: ArrowDownLeft, label: "Deposit", color: "text-emerald-600", bg: "bg-emerald-50", href: "/deposit" },
            { icon: ArrowUpRight, label: "Withdraw", color: "text-red-500", bg: "bg-red-50", href: "/withdraw" },
            { icon: ArrowLeftRight, label: "Transfer", color: "text-primary", bg: "bg-primary/10", href: "/transfer" },
          ].map(({ icon: Icon, label, color, bg, href }) => (
            <button
              key={label}
              onClick={() => navigate(href)}
              className="bg-white border border-border rounded-xl p-3.5 flex flex-col items-center gap-2 hover:shadow-md active:scale-95 transition-all"
            >
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", bg)}>
                <Icon size={18} className={color} />
              </div>
              <span className="text-xs font-semibold text-foreground">{label}</span>
            </button>
          ))}
        </div>

        {/* Transactions */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm text-foreground">Transactions</h3>
            <Select value={txFilter} onValueChange={(v) => setTxFilter(v as any)}>
              <SelectTrigger className="h-7 text-xs w-28 rounded-lg">
                <Filter size={11} className="mr-1 shrink-0" />
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {(["deposit", "withdrawal", "earning", "reinvest", "investment", "transfer", "referral"] as GetTransactionsType[]).map((t) => (
                  <SelectItem key={t} value={t} className="capitalize">
                    {t === "earning" ? "Distribution" : t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {txLoading ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-[68px] rounded-xl" />)}</div>
          ) : txData?.items?.length ? (
            <div className="bg-white border border-border rounded-xl divide-y divide-border shadow-sm overflow-hidden">
              {txData.items.map((tx: any) => (
                <button
                  key={tx.id}
                  onClick={() => navigate(`/transaction/${tx.id}`)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 active:bg-muted/50 transition-colors text-left"
                >
                  <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-sm", TX_TYPE_COLORS[tx.type] ?? "bg-muted text-foreground")}>
                    {["deposit", "earning", "referral", "reinvest"].includes(tx.type) ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground capitalize truncate">{tx.note || tx.type}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {tx.txId ? <span className="font-mono text-primary/70">{tx.txId}</span> : null}
                      {tx.txId && (tx.network || tx.createdAt) ? " · " : ""}
                      {formatDateTime(tx.createdAt)}{tx.network ? ` · ${tx.network}` : ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0 flex items-center gap-1.5">
                    <div>
                      <p className={cn("text-sm font-bold", ["withdrawal", "investment", "transfer"].includes(tx.type) ? "text-red-500" : "text-emerald-500")}>
                        {["withdrawal", "investment", "transfer"].includes(tx.type) ? "−" : "+"}{formatUSDT(tx.amount)}
                      </p>
                      <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 h-4 font-medium mt-0.5", STATUS_BADGE[tx.status])}>
                        {tx.status}
                      </Badge>
                    </div>
                    <ChevronRight size={13} className="text-muted-foreground" />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="bg-white border border-border rounded-xl p-8 text-center shadow-sm">
              <p className="text-sm font-medium text-foreground">No transactions yet</p>
              <p className="text-xs text-muted-foreground mt-1">Deposit funds to get started</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
