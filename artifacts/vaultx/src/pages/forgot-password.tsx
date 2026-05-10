import { Link } from "wouter";
import { ArrowLeft, MessageCircle, Phone, HeadphonesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ForgotPasswordPage() {
  const telegram = "https://t.me/vaultxsupport";
  const whatsapp = "https://wa.me/vaultxsupport";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-white flex flex-col items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-white font-bold text-2xl">V</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Forgot password?</h1>
          <p className="text-muted-foreground mt-1 text-sm">Contact our support team to reset your password</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-border p-6 space-y-4">
          <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
            <HeadphonesIcon className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <p className="text-sm text-foreground leading-relaxed">
              For security reasons, password resets are handled by our support team. Please reach out via the channels below and we'll help you regain access to your account.
            </p>
          </div>

          <div className="space-y-3 pt-1">
            <a href={telegram.startsWith("http") ? telegram : `https://t.me/${telegram.replace("@", "")}`} target="_blank" rel="noopener noreferrer" className="block">
              <Button variant="outline" className="w-full h-12 gap-3 border-[1.5px] hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors">
                <MessageCircle size={18} className="text-sky-500 shrink-0" />
                <span className="font-semibold">Message us on Telegram</span>
              </Button>
            </a>

            <a href={whatsapp.startsWith("http") ? whatsapp : `https://wa.me/${whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="block">
              <Button variant="outline" className="w-full h-12 gap-3 border-[1.5px] hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors">
                <Phone size={18} className="text-emerald-500 shrink-0" />
                <span className="font-semibold">Contact us on WhatsApp</span>
              </Button>
            </a>
          </div>

          <p className="text-[11px] text-muted-foreground text-center pt-1">
            Please have your registered email address ready when contacting support.
          </p>
        </div>

        <Link href="/login" className="flex items-center justify-center gap-1 text-sm text-muted-foreground mt-5 hover:text-foreground">
          <ArrowLeft size={14} />
          Back to login
        </Link>
      </div>
    </div>
  );
}
