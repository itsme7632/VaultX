import { useState } from "react";
import { Shield, Eye, EyeOff, Lock, AlertTriangle, ChevronRight } from "lucide-react";
import { useChangePassword, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function SecurityPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [showPw, setShowPw] = useState(false);
  const changePassword = useChangePassword();

  const handleChangePassword = () => {
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    changePassword.mutate({ data: pwForm }, {
      onSuccess: () => {
        toast({ title: "Password changed successfully" });
        setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      },
      onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
    });
  };

  const securityItems = [
    {
      icon: Shield,
      title: "Two-Factor Authentication",
      desc: user?.twoFaEnabled ? "Enabled — your account is protected" : "Not enabled — add extra login security",
      badge: user?.twoFaEnabled ? { label: "Enabled", color: "bg-emerald-50 text-emerald-600" } : { label: "Disabled", color: "bg-amber-50 text-amber-600" },
      href: "/setup-2fa",
    },
  ];

  return (
    <AppLayout title="Security">
      <div className="px-4 pt-5 pb-6 space-y-5">

        {/* 2FA quick status card */}
        {securityItems.map(({ icon: Icon, title, desc, badge, href }) => (
          <button
            key={title}
            onClick={() => navigate(href)}
            className="w-full bg-white border border-border rounded-2xl shadow-sm overflow-hidden"
          >
            <div className="px-4 py-3.5 border-b border-border flex items-center gap-2">
              <Icon size={16} className="text-primary" />
              <h3 className="font-semibold text-sm text-foreground">{title}</h3>
            </div>
            <div className="p-4 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold mb-2", badge.color)}>
                  <div className={cn("w-1.5 h-1.5 rounded-full", user?.twoFaEnabled ? "bg-emerald-500" : "bg-amber-400")} />
                  {badge.label}
                </div>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              <ChevronRight size={18} className="text-muted-foreground shrink-0 ml-3" />
            </div>
          </button>
        ))}

        {/* 2FA warning if not enabled */}
        {!user?.twoFaEnabled && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-700">Secure your account</p>
              <p className="text-xs text-amber-600 mt-0.5">Enable two-factor authentication to protect against unauthorized access.</p>
            </div>
          </div>
        )}

        {/* Change password */}
        <div className="bg-white border border-border rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3.5 border-b border-border flex items-center gap-2">
            <Lock size={16} className="text-primary" />
            <h3 className="font-semibold text-sm text-foreground">Change Password</h3>
          </div>
          <div className="p-4 space-y-3">
            {[
              { key: "currentPassword" as const, label: "Current Password" },
              { key: "newPassword" as const, label: "New Password" },
              { key: "confirmPassword" as const, label: "Confirm New Password" },
            ].map(({ key, label }) => (
              <div key={key}>
                <Label className="text-xs text-muted-foreground">{label}</Label>
                <div className="relative mt-1">
                  <Input
                    type={showPw ? "text" : "password"}
                    value={pwForm[key]}
                    onChange={(e) => setPwForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="h-11 pr-10 text-sm rounded-xl"
                    autoComplete={key === "currentPassword" ? "current-password" : "new-password"}
                  />
                  {key === "currentPassword" && (
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {pwForm.newPassword && pwForm.confirmPassword && pwForm.newPassword !== pwForm.confirmPassword && (
              <p className="text-xs text-destructive">Passwords do not match</p>
            )}
            <Button
              className="w-full h-11 text-sm font-semibold mt-2 rounded-xl"
              onClick={handleChangePassword}
              disabled={
                changePassword.isPending ||
                !pwForm.currentPassword ||
                !pwForm.newPassword ||
                !pwForm.confirmPassword ||
                pwForm.newPassword !== pwForm.confirmPassword
              }
            >
              {changePassword.isPending ? "Changing..." : "Change Password"}
            </Button>
          </div>
        </div>

        {/* Security tips */}
        <div className="bg-white border border-border rounded-2xl shadow-sm p-4">
          <p className="text-sm font-semibold text-foreground mb-3">Security Best Practices</p>
          {[
            "Enable two-factor authentication for extra protection",
            "Use a strong, unique password you don't use elsewhere",
            "Never share your login credentials with anyone",
            "Log out from devices you no longer use",
            "Check your account activity regularly for suspicious transactions",
          ].map((tip) => (
            <div key={tip} className="flex items-start gap-2 mb-2 last:mb-0">
              <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
              <p className="text-xs text-muted-foreground">{tip}</p>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
