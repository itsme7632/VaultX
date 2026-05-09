import { useState } from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";
import { useForgotPassword } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const schema = z.object({ email: z.string().email("Invalid email address") });
type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const forgotPassword = useForgotPassword();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const onSubmit = (data: FormData) => {
    forgotPassword.mutate({ data }, { onSuccess: () => setSent(true) });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-white flex flex-col items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-white font-bold text-2xl">V</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Reset password</h1>
          <p className="text-muted-foreground mt-1 text-sm">We'll send you a reset link</p>
        </div>

        {sent ? (
          <div className="bg-white rounded-2xl shadow-sm border border-border p-8 text-center">
            <CheckCircle className="w-12 h-12 text-accent mx-auto mb-3" />
            <h2 className="font-semibold text-foreground">Check your email</h2>
            <p className="text-sm text-muted-foreground mt-2">
              If an account exists for that email, a reset link has been sent.
            </p>
            <Link href="/login">
              <Button variant="outline" className="mt-6 w-full">
                Back to login
              </Button>
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-border p-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email address</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          <Input {...field} type="email" placeholder="you@example.com" className="pl-9 h-11 bg-muted/40" data-testid="input-email" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full h-11 font-semibold" disabled={forgotPassword.isPending} data-testid="button-submit">
                  {forgotPassword.isPending ? "Sending..." : "Send reset link"}
                </Button>
              </form>
            </Form>
          </div>
        )}

        <Link href="/login" className="flex items-center justify-center gap-1 text-sm text-muted-foreground mt-5 hover:text-foreground">
          <ArrowLeft size={14} />
          Back to login
        </Link>
      </div>
    </div>
  );
}
