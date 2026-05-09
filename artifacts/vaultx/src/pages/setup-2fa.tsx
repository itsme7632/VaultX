import { useState } from "react";
import { Shield, Copy, Check, CheckCircle, Eye, EyeOff, Lock } from "lucide-react";
import { useSetup2fa, useVerify2fa, useDisable2fa, getGetMeQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { SubPageLayout } from "@/components/SubPageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type FlowStep = "intro" | "scan" | "verify" | "backup" | "disable";

export default function Setup2FAPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [step, setStep] = useState<FlowStep>(user?.twoFaEnabled ? "disable" : "intro");
  const [setupData, setSetupData] = useState<{ secret: string; qrCodeUrl: string } | null>(null);
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedBackup, setCopiedBackup] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  const setup2fa = useSetup2fa();
  const verify2fa = useVerify2fa();
  const disable2fa = useDisable2fa();

  const handleStart = () => {
    setup2fa.mutate(undefined, {
      onSuccess: (data: any) => {
        setSetupData({ secret: data.secret, qrCodeUrl: data.qrCodeUrl });
        setStep("scan");
      },
      onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
    });
  };

  const handleVerify = () => {
    verify2fa.mutate({ data: { code } }, {
      onSuccess: (data: any) => {
        setBackupCodes(data.backupCodes ?? []);
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        setStep("backup");
      },
      onError: (e: any) => toast({ title: "Invalid Code", description: "Please check your authenticator app and try again.", variant: "destructive" }),
    });
  };

  const handleDisable = () => {
    disable2fa.mutate({ data: { code } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        toast({ title: "2FA Disabled", description: "Two-factor authentication has been removed from your account." });
        navigate("/security");
      },
      onError: (e: any) => toast({ title: "Invalid Code", description: e?.message, variant: "destructive" }),
    });
  };

  const copySecret = () => {
    if (!setupData?.secret) return;
    navigator.clipboard.writeText(setupData.secret);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  const copyBackupCodes = () => {
    const text = backupCodes.join("\n");
    navigator.clipboard.writeText(text);
    setCopiedBackup(true);
    setTimeout(() => setCopiedBackup(false), 2000);
    toast({ title: "Backup codes copied!" });
  };

  const handleCodeInput = (val: string) => setCode(val.replace(/\D/g, "").slice(0, 6));

  return (
    <SubPageLayout title={user?.twoFaEnabled ? "Manage 2FA" : "Set Up 2FA"}>
      <div className="px-4 pt-6 pb-10 space-y-6">

        {/* INTRO */}
        {step === "intro" && (
          <>
            <div className="text-center py-4">
              <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Shield size={36} className="text-primary" />
              </div>
              <h2 className="font-bold text-xl text-foreground">Two-Factor Authentication</h2>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-xs mx-auto">
                Add an extra layer of security. Every time you log in, you'll need your password and a verification code from your phone.
              </p>
            </div>

            <div className="bg-white border border-border rounded-2xl p-4 space-y-4 shadow-sm">
              <p className="text-sm font-bold text-foreground">How it works</p>
              {[
                { icon: "1", text: "Download an authenticator app (Google Authenticator or Authy)" },
                { icon: "2", text: "Scan the QR code we'll show you with the app" },
                { icon: "3", text: "Enter the 6-digit code from the app to confirm setup" },
                { icon: "4", text: "Save your backup codes in a safe place" },
              ].map(({ icon, text }) => (
                <div key={icon} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{icon}</div>
                  <p className="text-sm text-muted-foreground leading-snug">{text}</p>
                </div>
              ))}
            </div>

            <Button
              className="w-full font-bold rounded-2xl"
              style={{ height: 52 }}
              onClick={handleStart}
              disabled={setup2fa.isPending}
            >
              {setup2fa.isPending ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Setting up…
                </span>
              ) : <>
                <Shield size={16} className="mr-2" /> Begin Setup
              </>}
            </Button>
          </>
        )}

        {/* SCAN QR */}
        {step === "scan" && setupData && (
          <>
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
              <p className="text-sm font-bold text-blue-700 mb-1">Step 1 of 2 — Scan QR Code</p>
              <p className="text-xs text-blue-600">Open your authenticator app and scan the QR code below</p>
            </div>

            <div className="flex flex-col items-center gap-4">
              <div className="bg-white border-4 border-primary/20 rounded-3xl p-5 shadow-sm inline-block">
                <img src={setupData.qrCodeUrl} alt="2FA QR" className="w-52 h-52 rounded-xl" />
              </div>
              <p className="text-xs text-muted-foreground text-center">Scan with Google Authenticator or Authy</p>
            </div>

            <div className="bg-white border border-border rounded-2xl p-4 shadow-sm">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Or enter code manually</Label>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1 bg-muted/50 rounded-xl px-3 py-2.5 min-w-0">
                  <p className={cn("font-mono text-sm font-semibold text-foreground break-all", !showSecret && "blur-sm select-none")}>
                    {setupData.secret}
                  </p>
                </div>
                <button onClick={() => setShowSecret(s => !s)} className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
                  {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                <button onClick={copySecret} className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 active:scale-90 transition-transform">
                  {copiedSecret ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} className="text-primary" />}
                </button>
              </div>
            </div>

            <Button
              className="w-full font-bold rounded-2xl"
              style={{ height: 52 }}
              onClick={() => setStep("verify")}
            >
              I've Scanned the QR Code →
            </Button>
          </>
        )}

        {/* VERIFY */}
        {step === "verify" && (
          <>
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
              <p className="text-sm font-bold text-emerald-700 mb-1">Step 2 of 2 — Enter Verification Code</p>
              <p className="text-xs text-emerald-600">Open your authenticator app and enter the 6-digit code</p>
            </div>

            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Lock size={28} className="text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">Enter the code shown in your authenticator app</p>
            </div>

            <div>
              <Input
                value={code}
                onChange={(e) => handleCodeInput(e.target.value)}
                placeholder="000 000"
                className="h-16 text-center text-3xl tracking-[0.5em] font-bold font-mono rounded-2xl border-2 focus:border-primary"
                maxLength={6}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
              />
              <p className="text-xs text-muted-foreground mt-2 text-center">6-digit code from your authenticator app</p>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 rounded-2xl font-semibold" style={{ height: 52 }} onClick={() => setStep("scan")}>
                ← Go Back
              </Button>
              <Button
                className="flex-1 font-bold rounded-2xl"
                style={{ height: 52 }}
                onClick={handleVerify}
                disabled={verify2fa.isPending || code.length !== 6}
              >
                {verify2fa.isPending ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Verifying…
                  </span>
                ) : "Verify & Enable"}
              </Button>
            </div>
          </>
        )}

        {/* BACKUP CODES */}
        {step === "backup" && (
          <>
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
              <CheckCircle size={28} className="text-emerald-500 mx-auto mb-2" />
              <p className="font-bold text-emerald-700">2FA Successfully Enabled!</p>
              <p className="text-xs text-emerald-600 mt-1">Your account is now protected with two-factor authentication</p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <p className="text-sm font-bold text-amber-700 mb-1.5">⚠️ Save Your Backup Codes</p>
              <p className="text-xs text-amber-600 leading-relaxed">
                Store these in a safe place. If you lose your phone, you can use these codes to access your account. Each code can only be used once.
              </p>
            </div>

            <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm">
              <div className="grid grid-cols-2 gap-0 divide-y divide-border">
                {backupCodes.map((code, i) => (
                  <div key={i} className={cn("px-4 py-3 font-mono text-sm font-semibold text-foreground text-center", i % 2 === 0 && "border-r border-border")}>
                    {code}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="rounded-2xl font-semibold" style={{ height: 48 }} onClick={copyBackupCodes}>
                {copiedBackup ? <><Check size={14} className="mr-1.5 text-emerald-500" />Copied!</> : <><Copy size={14} className="mr-1.5" />Copy All</>}
              </Button>
              <Button className="rounded-2xl font-bold" style={{ height: 48 }} onClick={() => navigate("/security")}>
                Done →
              </Button>
            </div>
          </>
        )}

        {/* DISABLE */}
        {step === "disable" && (
          <>
            <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center">
              <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-3">
                <Shield size={24} className="text-red-500" />
              </div>
              <p className="font-bold text-red-700">2FA is Currently Enabled</p>
              <p className="text-xs text-red-500 mt-1.5 leading-relaxed">Disabling 2FA will make your account less secure. Only disable if you no longer have access to your authenticator app.</p>
            </div>

            <div className="bg-white border border-border rounded-2xl p-4 shadow-sm space-y-3">
              <Label className="text-sm font-bold">Enter your current 2FA code to disable</Label>
              <Input
                value={code}
                onChange={(e) => handleCodeInput(e.target.value)}
                placeholder="000 000"
                className="h-14 text-center text-2xl tracking-[0.4em] font-bold font-mono rounded-xl border-2 focus:border-red-400"
                maxLength={6}
                type="text"
                inputMode="numeric"
              />
            </div>

            <Button
              className="w-full bg-destructive hover:bg-destructive/90 font-bold rounded-2xl"
              style={{ height: 52 }}
              onClick={handleDisable}
              disabled={disable2fa.isPending || code.length !== 6}
            >
              {disable2fa.isPending ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Disabling…
                </span>
              ) : "Confirm Disable 2FA"}
            </Button>
          </>
        )}

      </div>
    </SubPageLayout>
  );
}
