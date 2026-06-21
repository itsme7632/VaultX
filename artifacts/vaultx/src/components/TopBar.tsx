import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import {
  Bell, User, Shield, Settings, LayoutDashboard, LogOut,
  ChevronRight, Download, HeadphonesIcon, Sun, Moon,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { useLogout, useGetNotifications, getGetNotificationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { playNotificationSound } from "@/lib/notificationSound";
import wxLogo from "/wx-logo.png";

export function TopBar({ title }: { title?: string }) {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const logout = useLogout();
  const prevUnreadRef = useRef<number | null>(null);
  const prevNotifIdsRef = useRef<Set<number>>(new Set());

  const { data: notifications } = useGetNotifications({
    query: {
      queryKey: getGetNotificationsQueryKey(),
      staleTime: 20000,
      refetchInterval: 30000,
    },
  });

  const unreadCount = notifications?.unreadCount ?? 0;
  const notifList: any[] = (notifications as any)?.notifications ?? [];

  useEffect(() => {
    if (prevUnreadRef.current === null) {
      prevUnreadRef.current = unreadCount;
      prevNotifIdsRef.current = new Set(notifList.map((n: any) => n.id));
      return;
    }

    if (unreadCount > (prevUnreadRef.current ?? 0)) {
      // Find newly arrived notifications
      const currentIds = new Set(notifList.map((n: any) => n.id));
      const newNotifs = notifList.filter((n: any) => !prevNotifIdsRef.current.has(n.id));
      prevNotifIdsRef.current = currentIds;

      // Determine sound type from the newest notification
      const newest = newNotifs[0];
      const type = newest?.type as string | undefined;

      if (type === "deposit_approved" || type === "deposit") {
        playNotificationSound("deposit");
      } else if (type === "withdrawal_approved" || type === "withdrawal") {
        playNotificationSound("withdrawal");
      } else if (type === "support_reply" || type === "support") {
        playNotificationSound("support");
      } else if (type === "announcement") {
        playNotificationSound("announcement");
      } else {
        playNotificationSound("notification");
      }
    }

    prevUnreadRef.current = unreadCount;
  }, [unreadCount, notifList]);

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        queryClient.clear();
        setLocation("/login");
      },
    });
  };

  const initials = user?.fullName
    ?.split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() ?? "W";

  const menuItems = [
    { icon: User,            label: "Profile",           href: "/profile" },
    { icon: Shield,          label: "Security",          href: "/security" },
    { icon: HeadphonesIcon,  label: "Customer Support",  href: "/support" },
    { icon: Download,        label: "Download App",      href: "/download-app" },
    { icon: Settings,        label: "Settings",          href: "/settings" },
    ...(user?.isAdmin ? [{ icon: LayoutDashboard, label: "Admin Panel", href: "/admin" }] : []),
  ];

  return (
    <header className="topbar-header sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
      <div className="flex items-center justify-between px-4 py-3 max-w-screen-sm mx-auto">
        <div className="flex items-center gap-2">
          <img
            src={wxLogo}
            alt="Wexora"
            className="w-7 h-7 rounded-lg object-cover"
          />
          <span className="font-bold text-foreground text-base tracking-tight">
            {title || "Wexora"}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <Link href="/notifications">
            <button className="relative p-1.5 rounded-xl hover:bg-muted transition-colors">
              <Bell size={20} className="text-foreground" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive rounded-full flex items-center justify-center text-white text-[9px] font-bold">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="focus:outline-none ml-0.5">
                <Avatar className="w-8 h-8 ring-2 ring-primary/20">
                  <AvatarFallback className="bg-gradient-to-br from-primary to-blue-600 text-white text-xs font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-52 shadow-lg border-border bg-card">
              <div className="px-3 py-2.5">
                <p className="font-semibold text-sm text-foreground truncate">{user?.fullName}</p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">@{user?.username}</p>
              </div>
              <DropdownMenuSeparator />
              {menuItems.map(({ icon: Icon, label, href }) => (
                <DropdownMenuItem
                  key={href}
                  className="cursor-pointer"
                  onClick={() => setLocation(href)}
                >
                  <Icon size={15} className="text-muted-foreground mr-2 shrink-0" />
                  <span className="flex-1">{label}</span>
                  <ChevronRight size={14} className="text-muted-foreground" />
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer text-destructive focus:text-destructive"
                onClick={handleLogout}
              >
                <LogOut size={15} className="mr-2" />
                <span>Logout</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
