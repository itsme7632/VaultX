import { useState } from "react";
import { Copy, Check, Share2, Users, DollarSign, Trophy } from "lucide-react";
import {
  useGetReferralStats, getGetReferralStatsQueryKey,
  useGetReferralHistory, getGetReferralHistoryQueryKey,
  useGetReferralLeaderboard, getGetReferralLeaderboardQueryKey,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function formatMoney(v: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}

export default function ReferralsPage() {
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<"stats" | "history" | "leaderboard">("stats");

  const { data: stats, isLoading: statsLoading } = useGetReferralStats({
    query: { queryKey: getGetReferralStatsQueryKey(), staleTime: 60000 },
  });
  const { data: history } = useGetReferralHistory({
    query: { queryKey: getGetReferralHistoryQueryKey(), staleTime: 60000 },
  });
  const { data: leaderboard } = useGetReferralLeaderboard({
    query: { queryKey: getGetReferralLeaderboardQueryKey(), staleTime: 300000 },
  });

  const handleCopy = () => {
    if (!stats?.code) return;
    navigator.clipboard.writeText(stats.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    if (!stats?.code) return;
    const text = `Join VaultX and start earning crypto! Use my referral code: ${stats.code}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  const RANK_COLORS = ["text-amber-500", "text-slate-400", "text-amber-700"];

  return (
    <AppLayout title="Referrals">
      <div className="px-4 pt-5 pb-6 space-y-5">
        {/* Referral code card */}
        <div className="bg-gradient-to-br from-purple-600 to-purple-800 rounded-2xl p-5 text-white shadow-lg">
          <p className="text-purple-200 text-xs uppercase tracking-widest mb-2">Your Referral Code</p>
          {statsLoading ? (
            <Skeleton className="h-10 w-40 bg-white/20 mb-3" />
          ) : (
            <p className="text-4xl font-bold tracking-widest mb-3">{stats?.code ?? "---"}</p>
          )}
          <p className="text-purple-200 text-xs mb-4">
            Earn {((stats?.commissionRate ?? 0.05) * 100).toFixed(0)}% commission on every referred user's investment
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="bg-white/20 hover:bg-white/30 text-white border-0 h-9 gap-1.5"
              onClick={handleCopy}
              data-testid="button-copy-code"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copied!" : "Copy Code"}
            </Button>
            <Button
              size="sm"
              className="bg-green-500/80 hover:bg-green-500 text-white border-0 h-9 gap-1.5"
              onClick={handleShare}
              data-testid="button-share-whatsapp"
            >
              <Share2 size={14} />
              Share on WhatsApp
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total Referred", value: stats?.totalReferrals ?? 0, icon: Users, color: "text-primary" },
            { label: "Active", value: stats?.activeReferrals ?? 0, icon: Users, color: "text-accent" },
            { label: "Total Earned", value: stats ? formatMoney(stats.totalEarned) : "$0.00", icon: DollarSign, color: "text-purple-500" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white border border-border rounded-xl p-3 text-center shadow-sm">
              <Icon size={18} className={cn("mx-auto mb-1.5", color)} />
              <p className="font-bold text-foreground text-base">{statsLoading ? "..." : value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex bg-muted rounded-xl p-1">
          {(["stats", "history", "leaderboard"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn("flex-1 py-2 rounded-lg text-xs font-semibold transition-all capitalize", tab === t ? "bg-white shadow-sm text-foreground" : "text-muted-foreground")}
              data-testid={`tab-${t}`}
            >
              {t === "leaderboard" ? "Board" : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {tab === "history" && (
          <div>
            {history && history.length > 0 ? (
              <div className="bg-white border border-border rounded-xl divide-y divide-border shadow-sm overflow-hidden">
                {history.map((row: any) => (
                  <div key={row.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                      <Users size={13} className="text-purple-500" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">@{row.referredUsername}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(row.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-accent">{formatMoney(row.amount)}</p>
                      <Badge variant="outline" className="text-[9px] h-3.5">{row.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 bg-white border border-border rounded-xl">
                <p className="text-sm text-muted-foreground">No referrals yet</p>
              </div>
            )}
          </div>
        )}

        {tab === "leaderboard" && (
          <div>
            {leaderboard && leaderboard.length > 0 ? (
              <div className="bg-white border border-border rounded-xl divide-y divide-border shadow-sm overflow-hidden">
                {leaderboard.map((row: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-8 flex-shrink-0 text-center">
                      {i < 3 ? (
                        <Trophy size={16} className={RANK_COLORS[i]} />
                      ) : (
                        <span className="text-sm text-muted-foreground font-bold">#{row.rank}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">@{row.username}</p>
                      <p className="text-xs text-muted-foreground">{row.totalReferrals} referrals</p>
                    </div>
                    <p className="text-sm font-bold text-accent">{formatMoney(row.totalEarned)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 bg-white border border-border rounded-xl">
                <p className="text-sm text-muted-foreground">No leaderboard data yet</p>
              </div>
            )}
          </div>
        )}

        {tab === "stats" && (
          <div className="bg-white border border-border rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold text-sm text-foreground mb-4">How It Works</h3>
            <div className="space-y-3">
              {[
                { step: "1", title: "Share your code", desc: "Share your unique referral code with friends and family" },
                { step: "2", title: "They sign up", desc: "Your friend creates an account using your referral code" },
                { step: "3", title: "They invest", desc: "When your referral makes an investment, you earn commission" },
                { step: "4", title: "You earn", desc: `Earn ${((stats?.commissionRate ?? 0.05) * 100).toFixed(0)}% commission on every investment they make` },
              ].map(({ step, title, desc }) => (
                <div key={step} className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {step}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{title}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
