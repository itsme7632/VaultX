import { useState, useCallback } from "react";
import {
  Bell, CheckCheck, Trash2, ArrowLeft, XCircle,
  ArrowDownLeft, ArrowUpRight, ArrowLeftRight,
  TrendingUp, Users, ShieldAlert, Megaphone,
  MessageSquare, Landmark, Receipt, Wrench,
  PartyPopper, AlertTriangle, Info,
} from "lucide-react";
import {
  useGetNotifications, getGetNotificationsQueryKey,
  useMarkNotificationRead, useMarkAllNotificationsRead,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// ── Type config ──────────────────────────────────────────────────────────────

type TypeCfg = { icon: typeof Bell; color: string; bg: string; label: string };

const TYPE_CONFIG: Record<string, TypeCfg> = {
  deposit: {
    icon: ArrowDownLeft,
    color: "text-emerald-500 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
    label: "Deposit",
  },
  withdrawal: {
    icon: ArrowUpRight,
    color: "text-blue-500 dark:text-blue-400",
    bg: "bg-blue-500/10",
    label: "Withdrawal",
  },
  earning: {
    icon: TrendingUp,
    color: "text-amber-500 dark:text-amber-400",
    bg: "bg-amber-500/10",
    label: "Profit",
  },
  referral: {
    icon: Users,
    color: "text-purple-500 dark:text-purple-400",
    bg: "bg-purple-500/10",
    label: "Referral",
  },
  investment: {
    icon: Landmark,
    color: "text-emerald-500 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
    label: "Investment",
  },
  security: {
    icon: ShieldAlert,
    color: "text-red-500 dark:text-red-400",
    bg: "bg-red-500/10",
    label: "Security",
  },
  announcement: {
    icon: Megaphone,
    color: "text-primary",
    bg: "bg-primary/10",
    label: "Announcement",
  },
  community_announcement: {
    icon: MessageSquare,
    color: "text-violet-500 dark:text-violet-400",
    bg: "bg-violet-500/10",
    label: "Community",
  },
  transfer: {
    icon: ArrowLeftRight,
    color: "text-cyan-500 dark:text-cyan-400",
    bg: "bg-cyan-500/10",
    label: "Transfer",
  },
  transaction: {
    icon: Receipt,
    color: "text-sky-500 dark:text-sky-400",
    bg: "bg-sky-500/10",
    label: "Transaction",
  },
  maintenance: {
    icon: Wrench,
    color: "text-orange-500 dark:text-orange-400",
    bg: "bg-orange-500/10",
    label: "Maintenance",
  },
  admin_adjustment: {
    icon: AlertTriangle,
    color: "text-amber-500 dark:text-amber-400",
    bg: "bg-amber-500/10",
    label: "Adjustment",
  },
  info: {
    icon: PartyPopper,
    color: "text-primary",
    bg: "bg-primary/10",
    label: "Info",
  },
};

const DEFAULT_CFG: TypeCfg = {
  icon: Bell,
  color: "text-muted-foreground",
  bg: "bg-muted",
  label: "Notification",
};

function getCfg(type: string): TypeCfg {
  return TYPE_CONFIG[type] ?? DEFAULT_CFG;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(date: string | Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fullDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function groupByDate(items: any[]): Record<string, any[]> {
  const groups: Record<string, any[]> = {};
  items.forEach((item) => {
    const key = new Date(item.createdAt).toDateString();
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });
  return groups;
}

function formatGroupKey(key: string): string {
  const d = new Date(key);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

// ── Type badge pills ─────────────────────────────────────────────────────────
type FilterTab = "all" | "unread";

// ── Main page ────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [filter, setFilter] = useState<FilterTab>("all");

  const { data, isLoading } = useGetNotifications({
    query: { queryKey: getGetNotificationsQueryKey(), staleTime: 20000, refetchInterval: 30000 },
  });

  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const handleMarkRead = useCallback((id: number) => {
    markRead.mutate({ id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetNotificationsQueryKey() }),
    });
  }, [markRead, queryClient]);

  const handleMarkAll = () => {
    markAll.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetNotificationsQueryKey() });
        toast({ title: "All caught up!", description: "All notifications marked as read." });
      },
    });
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/notifications/${id}`, { method: "DELETE", credentials: "include" });
      if (res.ok) queryClient.invalidateQueries({ queryKey: getGetNotificationsQueryKey() });
    } catch {}
  };

  const handleDeleteAll = async () => {
    try {
      const res = await fetch("/api/notifications", { method: "DELETE", credentials: "include" });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: getGetNotificationsQueryKey() });
        toast({ title: "Cleared", description: "All notifications deleted." });
      }
    } catch {}
  };

  const handleBack = () => {
    if (window.history.length > 1) window.history.back();
    else setLocation("/");
  };

  const allItems: any[] = data?.items ?? [];
  const unreadCount = data?.unreadCount ?? 0;
  const displayed = filter === "unread" ? allItems.filter((n) => !n.isRead) : allItems;
  const grouped = groupByDate(displayed);

  return (
    <AppLayout title="Notifications">
      <div className="px-4 pt-4 pb-24">

        {/* ── Page Header ── */}
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={handleBack}
            className="w-9 h-9 rounded-xl flex items-center justify-center bg-muted/50 hover:bg-muted transition-colors shrink-0"
            aria-label="Go back"
          >
            <ArrowLeft size={18} className="text-foreground" />
          </button>

          <div className="flex-1 flex items-center gap-2 min-w-0">
            <h1 className="font-bold text-foreground text-lg">Notifications</h1>
            {unreadCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-white text-[10px] font-bold">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-primary h-8 px-2.5 gap-1 hover:bg-primary/10"
                onClick={handleMarkAll}
                disabled={markAll.isPending}
              >
                <CheckCheck size={13} />
                Mark all read
              </Button>
            )}
            {allItems.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-destructive h-8 px-2.5 gap-1"
                onClick={handleDeleteAll}
              >
                <XCircle size={13} />
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* ── Filter tabs ── */}
        <div className="flex gap-1 mb-5 bg-muted/40 p-1 rounded-xl">
          {(["all", "unread"] as FilterTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={cn(
                "flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all",
                filter === tab
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab === "all" ? `All (${allItems.length})` : `Unread (${unreadCount})`}
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-start gap-3 p-4 bg-card border border-border rounded-2xl">
                <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-3/4 rounded" />
                  <Skeleton className="h-3 w-full rounded" />
                  <Skeleton className="h-2.5 w-1/3 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Bell size={26} className="text-muted-foreground" />
            </div>
            <p className="font-bold text-foreground text-base">
              {filter === "unread" ? "No unread notifications" : "No notifications yet"}
            </p>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-[220px] leading-relaxed">
              {filter === "unread" ? "You're all caught up!" : "Activity will appear here as you use Wexora."}
            </p>
            {filter === "unread" && unreadCount === 0 && allItems.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4 rounded-xl"
                onClick={() => setFilter("all")}
              >
                View all notifications
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([dateKey, notifications]) => (
              <div key={dateKey}>
                {/* Date group header */}
                <div className="flex items-center gap-3 mb-3">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">
                    {formatGroupKey(dateKey)}
                  </p>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {/* Notification cards */}
                <div className="space-y-2">
                  {notifications.map((n: any) => {
                    const cfg = getCfg(n.type);
                    const Icon = cfg.icon;
                    const isUnread = !n.isRead;

                    return (
                      <div
                        key={n.id}
                        className={cn(
                          "group relative flex items-start gap-3 px-4 py-3.5",
                          "bg-card border border-border rounded-2xl",
                          "transition-all duration-150",
                          isUnread
                            ? "border-primary/20 shadow-[0_0_0_1px_hsl(var(--primary)/0.08)] bg-primary/[0.03]"
                            : "hover:border-border/80"
                        )}
                      >
                        {/* Left unread bar */}
                        {isUnread && (
                          <div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full bg-primary" />
                        )}

                        {/* Icon */}
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", cfg.bg)}>
                          <Icon size={16} className={cfg.color} />
                        </div>

                        {/* Body */}
                        <button
                          className="flex-1 text-left min-w-0"
                          onClick={() => {
                            if (isUnread) handleMarkRead(n.id);
                            if (n.type === "community_announcement") setLocation("/community");
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className={cn(
                              "text-sm leading-snug",
                              isUnread ? "font-semibold text-foreground" : "font-medium text-foreground/90"
                            )}>
                              {n.title}
                            </p>
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0 mt-0.5 font-medium">
                              {timeAgo(n.createdAt)}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{n.message}</p>

                          {/* Type + full time */}
                          <div className="flex items-center gap-2 mt-2">
                            <span className={cn("text-[10px] font-semibold uppercase tracking-wide", cfg.color)}>
                              {cfg.label}
                            </span>
                            <span className="text-[10px] text-muted-foreground/60">
                              {new Date(n.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        </button>

                        {/* Actions */}
                        <div className="flex flex-col gap-1 shrink-0">
                          {isUnread && (
                            <button
                              onClick={() => handleMarkRead(n.id)}
                              className="w-7 h-7 flex items-center justify-center rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                              aria-label="Mark as read"
                              title="Mark as read"
                            >
                              <CheckCheck size={13} />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(n.id)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                            aria-label="Delete notification"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
