import { Bell, CheckCheck, Info, Shield, DollarSign, Users, Trash2, ArrowLeft, TrendingUp, Megaphone, XCircle } from "lucide-react";
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

const TYPE_ICON: Record<string, typeof Bell> = {
  announcement: Megaphone,
  community_announcement: Megaphone,
  transaction: DollarSign,
  security: Shield,
  referral: Users,
  investment: TrendingUp,
  info: Info,
};

const TYPE_COLOR: Record<string, string> = {
  announcement: "bg-primary/10 text-primary",
  community_announcement: "bg-violet-500/10 text-violet-600",
  transaction: "bg-accent/10 text-accent",
  security: "bg-amber-500/10 text-amber-600",
  referral: "bg-purple-500/10 text-purple-500",
  investment: "bg-emerald-500/10 text-emerald-600",
  info: "bg-muted text-muted-foreground",
};

function groupByDate(items: any[]) {
  const groups: Record<string, any[]> = {};
  items.forEach((item) => {
    const date = new Date(item.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    if (!groups[date]) groups[date] = [];
    groups[date].push(item);
  });
  return groups;
}

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data, isLoading } = useGetNotifications({
    query: { queryKey: getGetNotificationsQueryKey(), staleTime: 20000, refetchInterval: 30000 },
  });

  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const handleMarkRead = (id: number) => {
    markRead.mutate({ id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetNotificationsQueryKey() }),
    });
  };

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
    if (window.history.length > 1) {
      window.history.back();
    } else {
      setLocation("/");
    }
  };

  const items = data?.items ?? [];
  const unreadCount = data?.unreadCount ?? 0;
  const grouped = groupByDate(items);

  return (
    <AppLayout title="Notifications">
      <div className="px-4 pt-4 pb-6">

        {/* Header row */}
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={handleBack}
            className="w-9 h-9 rounded-xl flex items-center justify-center bg-muted/50 hover:bg-muted active:bg-muted/80 transition-colors flex-shrink-0"
            aria-label="Go back"
          >
            <ArrowLeft size={18} className="text-foreground" />
          </button>

          <div className="flex-1 flex items-center gap-2">
            <h1 className="font-bold text-foreground text-base">Notifications</h1>
            {unreadCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-destructive text-white text-[10px] font-bold">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-primary h-8 px-2.5 gap-1"
                onClick={handleMarkAll}
                disabled={markAll.isPending}
                data-testid="button-mark-all-read"
              >
                <CheckCheck size={13} />
                Mark all read
              </Button>
            )}
            {items.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-destructive hover:text-destructive h-8 px-2.5 gap-1"
                onClick={handleDeleteAll}
              >
                <XCircle size={13} />
                Clear all
              </Button>
            )}
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 bg-card border border-border rounded-2xl">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
              <Bell size={24} className="text-muted-foreground" />
            </div>
            <p className="font-semibold text-foreground text-sm">No notifications</p>
            <p className="text-xs text-muted-foreground mt-1">You're all caught up!</p>
          </div>
        ) : (
          <div className="space-y-5">
            {Object.entries(grouped).map(([date, notifications]) => (
              <div key={date}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">{date}</p>
                <div className="bg-card border border-border rounded-2xl divide-y divide-border shadow-sm overflow-hidden">
                  {notifications.map((n: any) => {
                    const Icon = TYPE_ICON[n.type] ?? Bell;
                    return (
                      <div
                        key={n.id}
                        className={cn(
                          "flex items-start gap-3 px-4 py-3.5 transition-colors",
                          !n.isRead && "bg-primary/5"
                        )}
                        data-testid={`notification-${n.id}`}
                      >
                        <button
                          className="flex items-start gap-3 flex-1 text-left min-w-0"
                          onClick={() => {
                            if (!n.isRead) handleMarkRead(n.id);
                            if (n.type === "community_announcement") setLocation("/community");
                          }}
                        >
                          <div className={cn(
                            "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5",
                            TYPE_COLOR[n.type] ?? "bg-muted text-foreground"
                          )}>
                            <Icon size={15} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-foreground">{n.title}</p>
                              {!n.isRead && <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.message}</p>
                            <p className="text-[10px] text-muted-foreground/70 mt-1">
                              {new Date(n.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        </button>
                        <button
                          onClick={() => handleDelete(n.id)}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0 mt-0.5"
                          aria-label="Delete notification"
                        >
                          <Trash2 size={13} />
                        </button>
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
