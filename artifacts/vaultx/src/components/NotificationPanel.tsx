import { useEffect, useRef, useCallback, type RefObject } from "react";
import { useLocation } from "wouter";
import {
  Bell, CheckCheck, X, ArrowRight,
  ArrowDownLeft, ArrowUpRight, ArrowLeftRight,
  TrendingUp, Users, ShieldAlert, Megaphone,
  MessageSquare, Landmark, Receipt, Wrench,
  PartyPopper, AlertTriangle,
} from "lucide-react";
import {
  useGetNotifications,
  getGetNotificationsQueryKey,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

// ── Type configuration ───────────────────────────────────────────────────────

type TypeConfig = {
  icon: typeof Bell;
  color: string;
  bg: string;
  gradient: string;
};

const TYPE_CONFIG: Record<string, TypeConfig> = {
  deposit: {
    icon: ArrowDownLeft,
    color: "text-emerald-400",
    bg: "bg-emerald-500/15",
    gradient: "from-emerald-500/20 to-emerald-500/5",
  },
  withdrawal: {
    icon: ArrowUpRight,
    color: "text-blue-400",
    bg: "bg-blue-500/15",
    gradient: "from-blue-500/20 to-blue-500/5",
  },
  earning: {
    icon: TrendingUp,
    color: "text-amber-400",
    bg: "bg-amber-500/15",
    gradient: "from-amber-500/20 to-amber-500/5",
  },
  referral: {
    icon: Users,
    color: "text-purple-400",
    bg: "bg-purple-500/15",
    gradient: "from-purple-500/20 to-purple-500/5",
  },
  investment: {
    icon: Landmark,
    color: "text-emerald-400",
    bg: "bg-emerald-500/15",
    gradient: "from-emerald-500/20 to-emerald-500/5",
  },
  security: {
    icon: ShieldAlert,
    color: "text-red-400",
    bg: "bg-red-500/15",
    gradient: "from-red-500/20 to-red-500/5",
  },
  announcement: {
    icon: Megaphone,
    color: "text-primary",
    bg: "bg-primary/15",
    gradient: "from-primary/20 to-primary/5",
  },
  community_announcement: {
    icon: MessageSquare,
    color: "text-violet-400",
    bg: "bg-violet-500/15",
    gradient: "from-violet-500/20 to-violet-500/5",
  },
  transfer: {
    icon: ArrowLeftRight,
    color: "text-cyan-400",
    bg: "bg-cyan-500/15",
    gradient: "from-cyan-500/20 to-cyan-500/5",
  },
  transaction: {
    icon: Receipt,
    color: "text-sky-400",
    bg: "bg-sky-500/15",
    gradient: "from-sky-500/20 to-sky-500/5",
  },
  maintenance: {
    icon: Wrench,
    color: "text-orange-400",
    bg: "bg-orange-500/15",
    gradient: "from-orange-500/20 to-orange-500/5",
  },
  admin_adjustment: {
    icon: AlertTriangle,
    color: "text-amber-400",
    bg: "bg-amber-500/15",
    gradient: "from-amber-500/20 to-amber-500/5",
  },
  info: {
    icon: PartyPopper,
    color: "text-primary",
    bg: "bg-primary/15",
    gradient: "from-primary/20 to-primary/5",
  },
};

const DEFAULT_CONFIG: TypeConfig = {
  icon: Bell,
  color: "text-muted-foreground",
  bg: "bg-muted",
  gradient: "from-muted/20 to-muted/5",
};

function getConfig(type: string): TypeConfig {
  return TYPE_CONFIG[type] ?? DEFAULT_CONFIG;
}

// ── Relative timestamp ───────────────────────────────────────────────────────

function timeAgo(date: string | Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Panel component ──────────────────────────────────────────────────────────

interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
}

export function NotificationPanel({ open, onClose, anchorRef }: NotificationPanelProps) {
  const [, setLocation] = useLocation();
  const panelRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data } = useGetNotifications({
    query: {
      queryKey: getGetNotificationsQueryKey(),
      staleTime: 20000,
      refetchInterval: 30000,
      enabled: open,
    },
  });

  const markAll = useMarkAllNotificationsRead();
  const markOne = useMarkNotificationRead();

  const items: any[] = data?.items ?? [];
  const unreadCount = data?.unreadCount ?? 0;
  const preview = items.slice(0, 8);

  const handleMarkAll = () => {
    markAll.mutate(undefined, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetNotificationsQueryKey() }),
    });
  };

  const handleMarkOne = useCallback((id: number) => {
    markOne.mutate({ id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetNotificationsQueryKey() }),
    });
  }, [markOne, queryClient]);

  const handleViewAll = () => {
    onClose();
    setLocation("/notifications");
  };

  // Click-outside to close
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current && !panelRef.current.contains(target) && anchorRef.current && !anchorRef.current.contains(target)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, onClose, anchorRef]);

  // Escape key
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      className={cn(
        "absolute right-0 top-full mt-2 z-[9980]",
        "w-[340px] sm:w-[380px]",
        "rounded-2xl border border-border/60",
        "bg-card/95 backdrop-blur-2xl",
        "shadow-[0_8px_40px_rgba(0,0,0,0.35)]",
        "overflow-hidden",
        "animate-in fade-in slide-in-from-top-2 duration-200"
      )}
      style={{ maxHeight: "min(520px, 85dvh)" }}
    >
      {/* Subtle glow accent at top */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border/50">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
            <Bell size={13} className="text-primary" />
          </div>
          <div>
            <span className="font-bold text-sm text-foreground">Notifications</span>
            {unreadCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-[9px] font-bold text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAll}
              disabled={markAll.isPending}
              className="flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary/80 transition-colors px-2 py-1 rounded-lg hover:bg-primary/10"
            >
              <CheckCheck size={12} />
              Mark all read
            </button>
          )}
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Notifications list */}
      <ScrollArea className="flex-1 overflow-y-auto" style={{ maxHeight: "380px" }}>
        {preview.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-6">
            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
              <Bell size={20} className="text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold text-foreground">All caught up</p>
            <p className="text-xs text-muted-foreground mt-1 text-center">No notifications to show</p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {preview.map((n: any) => {
              const config = getConfig(n.type);
              const Icon = config.icon;
              const isUnread = !n.isRead;
              return (
                <button
                  key={n.id}
                  className={cn(
                    "w-full flex items-start gap-3 px-4 py-3.5 text-left",
                    "hover:bg-muted/40 active:bg-muted/60 transition-colors",
                    isUnread && "bg-primary/[0.04]"
                  )}
                  onClick={() => {
                    if (isUnread) handleMarkOne(n.id);
                    if (n.type === "community_announcement") {
                      onClose();
                      setLocation("/community");
                    }
                  }}
                >
                  {/* Icon */}
                  <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5", config.bg)}>
                    <Icon size={15} className={config.color} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn("text-sm leading-snug truncate pr-1", isUnread ? "font-semibold text-foreground" : "font-medium text-foreground/90")}>
                        {n.title}
                      </p>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0 mt-0.5">
                        {timeAgo(n.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug line-clamp-2">{n.message}</p>
                  </div>

                  {/* Unread dot */}
                  {isUnread && (
                    <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      {preview.length > 0 && (
        <div className="border-t border-border/50 px-3 py-2.5">
          <button
            onClick={handleViewAll}
            className={cn(
              "w-full flex items-center justify-center gap-2",
              "py-2 rounded-xl text-xs font-semibold",
              "text-primary hover:text-primary/80",
              "hover:bg-primary/10 active:bg-primary/15 transition-colors"
            )}
          >
            View All Notifications
            <ArrowRight size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
