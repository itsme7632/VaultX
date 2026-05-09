import { useLocation } from "wouter";
import { Shield, FileCheck, User, Bell, ChevronRight, HelpCircle, LogOut, Newspaper, MessageCircle, Info } from "lucide-react";
import { useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

function SettingsItem({
  icon: Icon,
  label,
  description,
  onClick,
  danger,
  badge,
  testId,
}: {
  icon: React.ElementType;
  label: string;
  description?: string;
  onClick: () => void;
  danger?: boolean;
  badge?: string;
  testId?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/30 active:bg-muted/50 transition-colors"
      data-testid={testId}
    >
      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", danger ? "bg-destructive/10" : "bg-primary/10")}>
        <Icon size={16} className={danger ? "text-destructive" : "text-primary"} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-medium", danger ? "text-destructive" : "text-foreground")}>{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {badge && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary text-white">{badge}</span>}
        <ChevronRight size={15} className="text-muted-foreground" />
      </div>
    </button>
  );
}

export default function SettingsPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const logout = useLogout();

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => { queryClient.clear(); setLocation("/login"); },
      onError: () => toast({ title: "Error", description: "Failed to logout", variant: "destructive" }),
    });
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
            <p className="text-blue-200 text-xs mt-0.5 truncate">@{user?.username} • ID: {(user as any)?.displayId ?? "—"}</p>
          </div>
          <div className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold", user?.kycStatus === "approved" ? "bg-emerald-400/30 text-emerald-100" : "bg-white/20 text-white/70")}>
            {user?.kycStatus === "approved" ? "Verified" : "Unverified"}
          </div>
        </div>

        {/* Account */}
        <div className="bg-white border border-border rounded-2xl shadow-sm overflow-hidden">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-4 py-2.5 border-b border-border bg-muted/30">Account</p>
          <div className="divide-y divide-border">
            <SettingsItem icon={User} label="Profile" description="Update personal info & photo" onClick={() => setLocation("/profile")} testId="settings-profile" />
            <SettingsItem icon={Shield} label="Security" description="Password, 2FA, login sessions" onClick={() => setLocation("/security")} testId="settings-security" />
            <SettingsItem icon={FileCheck} label="KYC Verification" description={user?.kycStatus === "approved" ? "Identity verified ✓" : user?.kycStatus === "pending" ? "Under review..." : "Verify your identity"} onClick={() => setLocation("/kyc")} badge={user?.kycStatus === "pending" ? "Pending" : undefined} testId="settings-kyc" />
            <SettingsItem icon={Bell} label="Notifications" description="Alerts and messages" onClick={() => setLocation("/notifications")} testId="settings-notifications" />
          </div>
        </div>

        {/* Platform */}
        <div className="bg-white border border-border rounded-2xl shadow-sm overflow-hidden">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-4 py-2.5 border-b border-border bg-muted/30">Platform</p>
          <div className="divide-y divide-border">
            <SettingsItem icon={Newspaper} label="News & Updates" description="Platform announcements" onClick={() => setLocation("/news")} />
            <SettingsItem icon={MessageCircle} label="Help & Support" description="Support tickets and FAQ" onClick={() => setLocation("/support")} />
          </div>
        </div>

        {/* Sign out */}
        <div className="bg-white border border-border rounded-2xl shadow-sm overflow-hidden">
          <div className="divide-y divide-border">
            <SettingsItem icon={LogOut} label="Sign Out" description="Sign out of your account" onClick={handleLogout} danger testId="button-logout" />
          </div>
        </div>

        {/* Version + referral info */}
        <div className="text-center space-y-1 pb-2">
          <p className="text-xs text-muted-foreground">VaultX v2.0 · Premium Crypto Investment Platform</p>
          {(user as any)?.referralCode && (
            <p className="text-[10px] text-muted-foreground">Referral code: <span className="font-semibold text-primary">{(user as any).referralCode}</span></p>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
