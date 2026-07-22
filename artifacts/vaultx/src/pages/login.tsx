import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Lock, Mail, ArrowRight, MailWarning, RefreshCw } from "lucide-react";
import { useLogin, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

const schema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type FormData = z.infer<typeof schema>;

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

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const login = useLogin();

  // Email-not-verified state
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resending, setResending] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  function startCooldown() {
    setResendCooldown(60);
    const iv = setInterval(() => {
      setResendCooldown((c) => {
        if (c <= 1) { clearInterval(iv); return 0; }
        return c - 1;
      });
    }, 1000);
  }

  const onSubmit = (data: FormData) => {
    setUnverifiedEmail(null);
    login.mutate(
      { data },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          setLocation("/");
        },
        onError: (err: any) => {
          if (err?.error === "email_not_verified" && err?.email) {
            setUnverifiedEmail(err.email);
          } else {
            toast({
              title: "Login failed",
              description: err?.message || "Invalid email or password",
              variant: "destructive",
            });
          }
        },
      }
    );
  };

  async function handleResendVerification() {
    if (!unverifiedEmail) return;
    setResending(true);
    try {
      await postJson("/api/auth/resend-verification", { email: unverifiedEmail });
      toast({ title: "Verification email sent", description: "Check your inbox for the 6-digit code." });
      setLocation(`/verify-email?email=${encodeURIComponent(unverifiedEmail)}`);
      startCooldown();
    } catch (err: any) {
      if (err?.status === 429) {
        toast({ title: "Please wait", description: "You can only request a new code once per minute.", variant: "destructive" });
        startCooldown();
      } else {
        toast({ title: "Failed to send", description: err?.message ?? "Something went wrong.", variant: "destructive" });
      }
    } finally {
      setResending(false);
    }
  }

  // ── Unverified email banner ──────────────────────────────────────────────
  if (unverifiedEmail) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <img src="/wx-logo.png" alt="Wexora" className="w-14 h-14 rounded-2xl mx-auto mb-4 shadow-lg object-cover" />
            <h1 className="text-2xl font-bold text-foreground">Verify your email</h1>
            <p className="text-muted-foreground mt-1 text-sm">Your account is not yet verified</p>
          </div>

          <div className="bg-card rounded-2xl shadow-sm border border-border p-6 space-y-5">
            <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <MailWarning className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground mb-1">Email not verified</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Please verify <span className="font-medium text-foreground">{unverifiedEmail}</span> before signing in.
                  Check your inbox for the verification code we sent.
                </p>
              </div>
            </div>

            <Button
              className="w-full h-11 bg-primary hover:bg-primary/90 font-semibold text-sm"
              disabled={resending || resendCooldown > 0}
              onClick={handleResendVerification}
            >
              {resending ? (
                <span className="flex items-center gap-2"><RefreshCw size={15} className="animate-spin" /> Sending…</span>
              ) : resendCooldown > 0 ? (
                `Resend in ${resendCooldown}s`
              ) : (
                <span className="flex items-center gap-2">
                  <Mail size={15} /> Send verification email
                </span>
              )}
            </Button>

            <Button
              variant="ghost"
              className="w-full h-9 text-sm text-muted-foreground"
              onClick={() => setUnverifiedEmail(null)}
            >
              Back to login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Normal login form ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/wx-logo.png" alt="Wexora" className="w-14 h-14 rounded-2xl mx-auto mb-4 shadow-lg object-cover" />
          <h1 className="text-2xl font-bold text-foreground">Welcome back</h1>
          <p className="text-muted-foreground mt-1 text-sm">Sign in to your Wexora account</p>
        </div>

        <div className="bg-card rounded-2xl shadow-sm border border-border p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">Email</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          {...field}
                          type="email"
                          placeholder="you@example.com"
                          className="pl-9 h-11 bg-muted/40 border-border"
                          data-testid="input-email"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-sm font-medium">Password</FormLabel>
                      <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                        Forgot password?
                      </Link>
                    </div>
                    <FormControl>
                      <div className="relative">
                        <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          {...field}
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          className="pl-9 pr-10 h-11 bg-muted/40 border-border"
                          data-testid="input-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full h-11 bg-primary hover:bg-primary/90 font-semibold text-sm"
                disabled={login.isPending}
                data-testid="button-submit"
              >
                {login.isPending ? "Signing in..." : (
                  <span className="flex items-center gap-2">
                    Sign in <ArrowRight size={16} />
                  </span>
                )}
              </Button>
            </form>
          </Form>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-5">
          Don't have an account?{" "}
          <Link href="/signup" className="text-primary font-medium hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
