import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Bell, User, Shield, FileCheck, Settings, LifeBuoy, LogOut, ChevronRight, LayoutDashboard, Info } from "lucide-react";
import { useAuth } from "@/lib/auth";
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
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function TopBar({ title }: { title?: string }) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const logout = useLogout();

  const { data: notifications } = useGetNotifications({
    query: { queryKey: getGetNotificationsQueryKey(), staleTime: 30000 },
  });

  const unreadCount = notifications?.unreadCount ?? 0;

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
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() ?? "V";

  const menuItems = [
    { icon: User, label: "Profile", href: "/profile" },
    { icon: Shield, label: "Security", href: "/security" },
    { icon: FileCheck, label: "KYC Verification", href: "/kyc" },
    { icon: Settings, label: "Settings", href: "/settings" },
    { icon: Bell, label: "Notifications", href: "/notifications", badge: unreadCount },
    { icon: Info, label: "About Us", href: "/about" },
    ...(user?.isAdmin ? [{ icon: LayoutDashboard, label: "Admin Panel", href: "/admin" }] : []),
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-border">
      <div className="flex items-center justify-between px-4 py-3 max-w-screen-sm mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center">
            <span className="text-white font-bold text-xs">V</span>
          </div>
          <span className="font-bold text-foreground text-base tracking-tight">
            {title || "VaultX"}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/notifications" data-testid="link-notifications">
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
              <button className="focus:outline-none" data-testid="button-profile-menu">
                <Avatar className="w-8 h-8 ring-2 ring-primary/20">
                  <AvatarFallback className="bg-gradient-to-br from-primary to-blue-600 text-white text-xs font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 shadow-lg border-border">
              <div className="px-3 py-2.5">
                <p className="font-semibold text-sm text-foreground">{user?.fullName}</p>
                <p className="text-xs text-muted-foreground mt-0.5">@{user?.username}</p>
              </div>
              <DropdownMenuSeparator />
              {menuItems.map(({ icon: Icon, label, href, badge }) => (
                <DropdownMenuItem
                  key={href}
                  className="cursor-pointer"
                  onClick={() => setLocation(href)}
                  data-testid={`menu-${label.toLowerCase().replace(/\s/g, "-")}`}
                >
                  <Icon size={15} className="text-muted-foreground mr-2" />
                  <span className="flex-1">{label}</span>
                  {badge && badge > 0 ? (
                    <Badge variant="destructive" className="text-xs px-1.5 py-0 h-4">
                      {badge}
                    </Badge>
                  ) : (
                    <ChevronRight size={14} className="text-muted-foreground" />
                  )}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer text-destructive focus:text-destructive"
                onClick={handleLogout}
                data-testid="button-logout"
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
