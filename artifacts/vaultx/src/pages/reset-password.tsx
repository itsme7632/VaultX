import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Lock, Eye, EyeOff, ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

async function postJson(url: string, body: object) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status, ...data };
  return data;
}

export default function ResetPasswordPage() {
  const [, setLocation] = useLocation();

  const token = (() => {
    try { return new URLSearchParams(window.location.search).get("token") ?? ""; }
    catch { return ""; }
  })();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  // No token in URL
  if (!token) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-5">
        <div className="w-full max-w-sm text-center">
          <div className="w-14 h-14 bg-destructive/10 border border-destructive/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <AlertCircle className="w-7 h-7 text-destructive" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">Invalid Link</h1>
          <p className="text-sm text-muted-foreground mb-6">
            This password reset link is missing or invalid. Please request a new one.
          </p>
          <Link href="/forgot-password">
            <Button className="bg-primary hover:bg-primary/90">Request new link</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-5">
        <div className="w-full max-w-sm text-center">
          <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-7 h-7 text-emerald-500" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">Password Reset!</h1>
          <p className="text-sm text-muted-foreground mb-6">Your password has been updated. You can now sign in.</p>
          <Button onClick={() => setLocation("/login")} className="bg-primary hover:bg-primary/90">
            <span className="flex items-center gap-2">Sign in <ArrowRight size={16} /></span>
          </Button>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await postJson("/api/auth/reset-password", { token, password, confirmPassword: confirm });
      setDone(true);
    } catch (err: any) {
      setError(err?.message ?? "Reset link is invalid or expired. Please request a new one.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/wx-logo.png" alt="Wexora" className="w-14 h-14 rounded-2xl mx-auto mb-4 shadow-lg object-cover" />
          <h1 className="text-2xl font-bold text-foreground">Set new password</h1>
          <p className="text-muted-foreground mt-1 text-sm">Choose a strong password for your account</p>
        </div>

        <div className="bg-card rounded-2xl shadow-sm border border-border p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* New password */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">New password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); if (error) setError(""); }}
                  placeholder="Min. 8 characters"
                  className="pl-9 pr-10 h-11 bg-muted/40 border-border"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Confirm password */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Confirm password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type={showConfirm ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => { setConfirm(e.target.value); if (error) setError(""); }}
                  placeholder="Repeat password"
                  className="pl-9 pr-10 h-11 bg-muted/40 border-border"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2.5">
                <AlertCircle size={14} className="text-destructive mt-0.5 shrink-0" />
                <p className="text-xs text-destructive">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-primary hover:bg-primary/90 font-semibold text-sm"
            >
              {loading ? "Updating…" : (
                <span className="flex items-center gap-2">
                  Reset Password <ArrowRight size={16} />
                </span>
              )}
            </Button>
          </form>
        </div>

        <Link href="/login" className="flex items-center justify-center gap-1 text-sm text-muted-foreground mt-5 hover:text-foreground">
          <ArrowLeft size={14} />
          Back to login
        </Link>
      </div>
    </div>
  );
}
