import { useQuery } from "@tanstack/react-query";
import { Shield, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { SubPageLayout } from "@/components/SubPageLayout";
import { cn } from "@/lib/utils";

const DEFAULT_SECTIONS = [
  {
    title: "Information We Collect",
    content: `We collect information you provide directly when creating an account, making transactions, or contacting support. This includes personal identifiers (name, email address), financial transaction data, device and usage information, and communications with our support team. We only collect information necessary to provide our services.`,
  },
  {
    title: "Account Information",
    content: `When you register for a Wexora account, we collect your full name, email address, username, and password. You may also provide optional profile information. If you complete identity verification (KYC), we collect government-issued identification documents and related personal information as required by applicable regulations.`,
  },
  {
    title: "Transaction Data",
    content: `We record all financial activities on the platform including deposits, withdrawals, investment activities, and referral transactions. This data is retained to provide account history, resolve disputes, and comply with financial regulations. Transaction records include amounts, timestamps, wallet addresses, and transaction identifiers.`,
  },
  {
    title: "Security Practices",
    content: `Wexora employs industry-standard security measures to protect your personal information. All data is transmitted via encrypted HTTPS connections. Passwords are hashed using strong cryptographic algorithms and never stored in plain text. We implement session management, two-factor authentication (2FA), and monitor for suspicious access patterns.`,
  },
  {
    title: "Cookies & Analytics",
    content: `We use session cookies essential for platform authentication and operation. We may use analytics tools to understand platform usage patterns in aggregate. These analytics do not personally identify users. You can control cookie settings through your browser, but disabling essential cookies may affect platform functionality.`,
  },
  {
    title: "Third-Party Services",
    content: `Our platform integrates with blockchain networks for transaction verification and payment processing. We do not sell your personal data to third parties. We may share information with service providers who assist in operating our platform, subject to strict confidentiality agreements. We may disclose information when required by law or to protect our legal rights.`,
  },
  {
    title: "User Rights",
    content: `You have the right to access, correct, or request deletion of your personal information. You may update your profile information at any time through account settings. To request data deletion or a copy of your data, contact our support team. Certain data may be retained as required by law or for legitimate business purposes such as fraud prevention.`,
  },
  {
    title: "Data Retention",
    content: `We retain your personal information for as long as your account is active or as needed to provide services. Financial transaction records are retained for a minimum of 5 years to comply with financial regulations. If you delete your account, we will retain minimal records necessary for legal compliance and fraud prevention.`,
  },
  {
    title: "Contact Information",
    content: `For privacy-related inquiries, requests, or concerns, please contact our support team through the in-app support ticket system or via the contact methods listed on our support page. We will respond to all privacy requests within 30 days.`,
  },
];

function Section({ title, content }: { title: string; content: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3.5 text-left bg-card hover:bg-muted/30 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-sm font-semibold text-foreground pr-2">{title}</span>
        {open
          ? <ChevronUp size={15} className="text-primary shrink-0" />
          : <ChevronDown size={15} className="text-muted-foreground shrink-0" />}
      </button>
      {open && (
        <div className="px-4 py-4 bg-muted/10 border-t border-border">
          <p className="text-sm text-muted-foreground leading-relaxed">{content}</p>
        </div>
      )}
    </div>
  );
}

export default function PrivacyPolicyPage() {
  const { data: settings } = useQuery({
    queryKey: ["public-settings"],
    queryFn: () => fetch("/api/settings/public", { credentials: "include" }).then((r) => r.json()),
    staleTime: 60000,
  });

  const customContent = settings?.privacy_policy_content?.trim() || "";
  const updatedDate = settings?.privacy_policy_updated?.trim() || "";
  const platformName = settings?.platform_name || "Wexora";

  const formattedDate = updatedDate
    ? new Date(updatedDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return (
    <SubPageLayout title="Privacy Policy">
      <div className="pb-24">
        {/* Hero */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 px-4 pt-6 pb-8">
          <div className="max-w-screen-sm mx-auto text-center">
            <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mx-auto mb-3">
              <Shield size={24} className="text-white" />
            </div>
            <h1 className="text-lg font-black text-white mb-1">Privacy Policy</h1>
            <p className="text-xs text-white/50">Last Updated: {formattedDate}</p>
          </div>
        </div>

        <div className="px-4 pt-5 max-w-screen-sm mx-auto space-y-4">

          {/* Intro banner */}
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4">
            <p className="text-sm text-foreground font-medium leading-relaxed">
              {platformName} is committed to protecting your privacy. This policy explains how we collect, use, and safeguard your personal information when you use our platform.
            </p>
          </div>

          {/* Custom admin content OR default sections */}
          {customContent ? (
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{customContent}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {DEFAULT_SECTIONS.map((s) => (
                <Section key={s.title} title={s.title} content={s.content} />
              ))}
            </div>
          )}

          {/* Footer note */}
          <div className="bg-muted/30 border border-border rounded-xl px-4 py-3 text-center">
            <p className="text-xs text-muted-foreground leading-relaxed">
              By using {platformName}, you agree to the collection and use of information as described in this Privacy Policy. We reserve the right to update this policy at any time.
            </p>
          </div>

        </div>
      </div>
    </SubPageLayout>
  );
}
