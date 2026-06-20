import { useState } from "react";
import { useLocation } from "wouter";
import {
  Shield, FileCheck, User, Bell, BellOff, ChevronRight, LogOut,
  Globe, Moon, Sun, Languages,
} from "lucide-react";
import { useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { isNotificationMuted, setNotificationMuted } from "@/lib/notificationSound";

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={cn(
        "w-10 h-5.5 rounded-full relative transition-colors focus:outline-none shrink-0",
        checked ? "bg-primary" : "bg-muted"
      )}
      role="switch"
      aria-checked={checked}
    >
      <span className={cn(
        "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
        checked ? "translate-x-5" : "translate-x-0.5"
      )} />
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-4 py-2.5 border-b border-border bg-muted/30">
        {title}
      </p>
      <div className="divide-y divide-border">{children}</div>
    </div>
  );
}

function Item({
  icon: Icon,
  label,
  description,
  onClick,
  danger,
  badge,
  testId,
  rightContent,
  iconBg,
  iconColor,
}: {
  icon: React.ElementType;
  label: string;
  description?: string;
  onClick?: () => void;
  danger?: boolean;
  badge?: string;
  testId?: string;
  rightContent?: React.ReactNode;
  iconBg?: string;
  iconColor?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/30 active:bg-muted/50 transition-colors"
      data-testid={testId}
    >
      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0",
        danger ? "bg-destructive/10" : (iconBg ?? "bg-primary/10")
      )}>
        <Icon size={16} className={danger ? "text-destructive" : (iconColor ?? "text-primary")} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-medium", danger ? "text-destructive" : "text-foreground")}>{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {badge && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary text-white">{badge}</span>}
        {rightContent ?? <ChevronRight size={15} className="text-muted-foreground" />}
      </div>
    </button>
  );
}

export default function SettingsPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const logout = useLogout();
  const [notifMuted, setNotifMuted] = useState(() => isNotificationMuted());

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => { queryClient.clear(); setLocation("/login"); },
      onError: () => toast({ title: "Error", description: "Failed to logout", variant: "destructive" }),
    });
  };

  const handleToggleMute = () => {
    const next = !notifMuted;
    setNotifMuted(next);
    setNotificationMuted(next);
    toast({ title: next ? "Notification sound muted" : "Notification sound enabled" });
  };

  return (
    <AppLayout title="Settings">
      <div className="px-4 pt-5 pb-24 space-y-4">

        {/* User card */}
        <div className="bg-gradient-to-r from-primary to-blue-600 rounded-2xl p-4 text-white flex items-center gap-3 shadow-md">
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-xl font-bold">
            {user?.fullName?.charAt(0) ?? user?.username?.charAt(0) ?? "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-base truncate">{user?.fullName ?? user?.username}</p>
            <p className="text-blue-200 text-xs mt-0.5 truncate">@{user?.username} · ID: {(user as any)?.displayId ?? "—"}</p>
          </div>
          <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0",
            user?.kycStatus === "approved" ? "bg-emerald-400/30 text-emerald-100" : "bg-white/20 text-white/70"
          )}>
            {user?.kycStatus === "approved" ? "Verified" : "Unverified"}
          </span>
        </div>

        {/* Account */}
        <Section title="Account">
          <Item icon={User} label="Profile" description="Name, email, avatar" onClick={() => setLocation("/profile")} testId="settings-profile" />
          <Item icon={Shield} label="Security" description="Password, 2FA, sessions" onClick={() => setLocation("/security")} testId="settings-security" />
          <Item
            icon={FileCheck}
            label="KYC Verification"
            description={user?.kycStatus === "approved" ? "Identity verified ✓" : user?.kycStatus === "pending" ? "Under review…" : "Verify your identity"}
            onClick={() => setLocation("/kyc")}
            badge={user?.kycStatus === "pending" ? "Pending" : undefined}
            testId="settings-kyc"
          />
        </Section>

        {/* Notifications */}
        <Section title="Notifications">
          <Item
            icon={Bell}
            label="Notification Center"
            description="View all notifications"
            onClick={() => setLocation("/notifications")}
            iconBg="bg-amber-500/10"
            iconColor="text-amber-500"
          />
          <Item
            icon={notifMuted ? BellOff : Bell}
            label="Notification Sound"
            description={notifMuted ? "Notification sound muted" : "Notification sound enabled"}
            onClick={handleToggleMute}
            iconBg={notifMuted ? "bg-muted" : "bg-primary/10"}
            iconColor={notifMuted ? "text-muted-foreground" : "text-primary"}
            rightContent={<Toggle checked={!notifMuted} onChange={handleToggleMute} />}
          />
        </Section>

        {/* Appearance */}
        <Section title="Appearance">
          <Item
            icon={theme === "dark" ? Sun : Moon}
            label="Dark Mode"
            description={theme === "dark" ? "Currently using dark theme" : "Currently using light theme"}
            onClick={toggleTheme}
            iconBg="bg-slate-500/10"
            iconColor="text-slate-600"
            rightContent={<Toggle checked={theme === "dark"} onChange={toggleTheme} />}
          />
          <Item
            icon={Languages}
            label="Language"
            description="English (more coming soon)"
            iconBg="bg-blue-500/10"
            iconColor="text-blue-500"
            rightContent={
              <span className="text-xs font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">EN</span>
            }
          />
        </Section>

        {/* More */}
        <Section title="Platform">
          <Item
            icon={Globe}
            label="More"
            description="About, legal docs, download & support"
            onClick={() => setLocation("/more")}
            iconBg="bg-slate-500/10"
            iconColor="text-slate-600"
          />
        </Section>

        {/* Sign out */}
        <Section title="Account Actions">
          <Item icon={LogOut} label="Sign Out" description="Sign out of your account" onClick={handleLogout} danger testId="button-logout" />
        </Section>

        {(user as any)?.referralCode && (
          <p className="text-center text-[10px] text-muted-foreground pb-2">
            Referral code: <span className="font-semibold text-primary">{(user as any).referralCode}</span>
          </p>
        )}
      </div>
    </AppLayout>
  );
}
