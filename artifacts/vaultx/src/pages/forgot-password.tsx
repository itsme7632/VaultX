import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Mail, ArrowRight, CheckCircle2 } from "lucide-react";
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

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setError("Email is required"); return; }
    setLoading(true);
    setError("");
    try {
      await postJson("/api/auth/forgot-password", { email: email.trim() });
      setSent(true);
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/wx-logo.png" alt="Wexora" className="w-14 h-14 rounded-2xl mx-auto mb-4 shadow-lg object-cover" />
          <h1 className="text-2xl font-bold text-foreground">Forgot password?</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {sent ? "Check your inbox" : "Enter your email and we'll send a reset link"}
          </p>
        </div>

        <div className="bg-card rounded-2xl shadow-sm border border-border p-6">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground mb-1">Reset link sent</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  If an account exists for <span className="font-medium text-foreground">{email}</span>,
                  you'll receive a password reset link shortly. The link expires in 30 minutes.
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Didn't get it? Check your spam folder or{" "}
                <button
                  onClick={() => setSent(false)}
                  className="text-primary hover:underline font-medium"
                >
                  try again
                </button>
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Email address</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); if (error) setError(""); }}
                    placeholder="you@example.com"
                    className="pl-9 h-11 bg-muted/40 border-border"
                    autoFocus
                    required
                  />
                </div>
                {error && <p className="text-xs text-destructive mt-1.5">{error}</p>}
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-primary hover:bg-primary/90 font-semibold text-sm"
              >
                {loading ? "Sending…" : (
                  <span className="flex items-center gap-2">
                    Send reset link <ArrowRight size={16} />
                  </span>
                )}
              </Button>
            </form>
          )}
        </div>

        <Link href="/login" className="flex items-center justify-center gap-1 text-sm text-muted-foreground mt-5 hover:text-foreground">
          <ArrowLeft size={14} />
          Back to login
        </Link>
      </div>
    </div>
  );
}
