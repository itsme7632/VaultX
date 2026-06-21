import { useState } from "react";
import { Camera, Edit3, Check, X, Shield, FileCheck, Copy, CheckCircle } from "lucide-react";
import { useUpdateUserProfile, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

function kycBadge(status: string) {
  switch (status) {
    case "approved": return { label: "Verified", color: "bg-accent/10 text-accent border-accent/20" };
    case "pending": return { label: "Pending", color: "bg-amber-50 text-amber-600 border-amber-200" };
    case "rejected": return { label: "Rejected", color: "bg-destructive/10 text-destructive border-destructive/20" };
    default: return { label: "Unverified", color: "bg-muted text-muted-foreground border-border" };
  }
}

export default function ProfilePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateProfile = useUpdateUserProfile();
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: publicSettings } = useQuery({
    queryKey: ["public-settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings/public", { credentials: "include" });
      if (!res.ok) return {};
      return res.json();
    },
    staleTime: 300000,
  });
  const kycEnabled = !publicSettings || publicSettings?.kyc_enabled !== "false";

  const [form, setForm] = useState({
    fullName: user?.fullName ?? "",
    whatsapp: user?.whatsapp ?? "",
    country: user?.country ?? "",
    avatarUrl: user?.avatarUrl ?? "",
  });

  const handleSave = () => {
    updateProfile.mutate(
      { data: form },
      {
        onSuccess: () => {
          toast({ title: "Profile updated" });
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          setEditing(false);
        },
        onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
      }
    );
  };

  const handleCopyCode = () => {
    if (!user?.referralCode) return;
    navigator.clipboard.writeText(user.referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const initials = user?.fullName?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() ?? "V";
  const kyc = kycBadge(user?.kycStatus ?? "none");

  const fields = kycEnabled ? [
    { label: "Full Name", key: "fullName" as const },
    { label: "WhatsApp", key: "whatsapp" as const },
    { label: "Country", key: "country" as const },
  ] : [
    { label: "Full Name", key: "fullName" as const },
  ];

  return (
    <AppLayout title="Profile">
      <div className="px-4 pt-5 pb-6 space-y-5">
        {/* Avatar & name */}
        <div className="bg-white border border-border rounded-2xl p-6 text-center shadow-sm">
          <div className="relative inline-block mb-3">
            <Avatar className="w-20 h-20 ring-4 ring-primary/10">
              <AvatarFallback className="bg-gradient-to-br from-primary to-blue-600 text-white text-2xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>
          <h2 className="font-bold text-foreground text-xl">{user?.fullName}</h2>
          <p className="text-muted-foreground text-sm">@{user?.username}</p>
          <div className="flex items-center justify-center gap-2 mt-2">
            {kycEnabled && (
              <Badge variant="outline" className={cn("text-xs font-medium", kyc.color)}>
                {user?.kycStatus === "approved" ? <CheckCircle size={10} className="mr-1" /> : <Shield size={10} className="mr-1" />}
                {kyc.label}
              </Badge>
            )}
            {user?.twoFaEnabled && (
              <Badge variant="outline" className="text-xs bg-accent/10 text-accent border-accent/20 font-medium">
                <Shield size={10} className="mr-1" />
                2FA
              </Badge>
            )}
            {user?.isAdmin && (
              <Badge className="text-xs bg-primary text-primary-foreground font-medium">Admin</Badge>
            )}
          </div>
        </div>

        {/* Referral code */}
        <div className="bg-white border border-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Referral Code</p>
              <p className="font-bold text-foreground tracking-widest">{user?.referralCode}</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleCopyCode} className="h-8 text-xs gap-1">
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>

        {/* Info fields */}
        <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-sm text-foreground">Personal Information</h3>
            {!editing ? (
              <Button variant="ghost" size="sm" className="h-7 text-xs text-primary gap-1" onClick={() => setEditing(true)} data-testid="button-edit-profile">
                <Edit3 size={12} /> Edit
              </Button>
            ) : (
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => setEditing(false)}>
                  <X size={12} />
                </Button>
                <Button size="sm" className="h-7 text-xs gap-1" onClick={handleSave} disabled={updateProfile.isPending} data-testid="button-save-profile">
                  <Check size={12} /> Save
                </Button>
              </div>
            )}
          </div>
          <div className="divide-y divide-border">
            {fields.map(({ label, key }) => (
              <div key={key} className="px-4 py-3">
                <p className="text-xs text-muted-foreground mb-1">{label}</p>
                {editing ? (
                  <Input
                    value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="h-9 text-sm"
                    data-testid={`input-${key}`}
                  />
                ) : (
                  <p className="text-sm font-medium text-foreground">{(user as any)?.[key] || "—"}</p>
                )}
              </div>
            ))}
            {kycEnabled && (
              <div className="px-4 py-3">
                <p className="text-xs text-muted-foreground mb-1">Email</p>
                <p className="text-sm font-medium text-foreground">{user?.email}</p>
              </div>
            )}
            {kycEnabled && (
              <div className="px-4 py-3">
                <p className="text-xs text-muted-foreground mb-1">Member since</p>
                <p className="text-sm font-medium text-foreground">
                  {user?.createdAt ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "—"}
                </p>
              </div>
            )}
            <div className="px-4 py-3">
              <p className="text-xs text-muted-foreground mb-1">User ID</p>
              <p className="text-sm font-medium text-foreground font-mono">#{user?.id}</p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
