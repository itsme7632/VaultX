import { useQuery } from "@tanstack/react-query";
import { FileText, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { SubPageLayout } from "@/components/SubPageLayout";

const DEFAULT_SECTIONS = [
  {
    title: "Account Registration",
    content: `To use VaultX, you must register an account with accurate, current, and complete information. You must be at least 18 years old and legally permitted to use investment platforms in your jurisdiction. You are responsible for maintaining the confidentiality of your login credentials. You agree to notify us immediately of any unauthorized access to your account.`,
  },
  {
    title: "Platform Usage",
    content: `VaultX provides a digital investment platform. You agree to use the platform only for lawful purposes and in accordance with these Terms. You may not use the platform in any way that could damage, disable, or impair its operation. We reserve the right to modify or discontinue any feature with reasonable notice.`,
  },
  {
    title: "Deposits",
    content: `All deposits are made in USDT via supported blockchain networks. Minimum deposit amounts apply as configured on the platform. Deposits are credited after sufficient network confirmations. VaultX is not responsible for lost funds sent to incorrect addresses. Always verify wallet addresses before initiating transactions.`,
  },
  {
    title: "Withdrawals",
    content: `Withdrawals are processed within 24 hours of submission, subject to review. Minimum withdrawal amounts and fees apply as displayed. You must ensure your withdrawal address is correct — VaultX cannot reverse completed blockchain transactions. KYC verification may be required before withdrawals are processed.`,
  },
  {
    title: "Investment Plans",
    content: `Investment plans on VaultX offer structured returns based on defined durations and ROI rates. Returns are credited as described in each plan. Investment performance depends on plan terms. Past performance is not indicative of future results. You should only invest funds you can afford to lock for the plan duration.`,
  },
  {
    title: "Referral Program",
    content: `VaultX offers a multi-level referral program where you earn commissions when users you refer make deposits or investments. Referral rates are set by the platform and may change. Commissions are credited to your wallet automatically. Fraudulent referral activity including self-referrals or fake accounts will result in immediate account suspension.`,
  },
  {
    title: "Security Responsibilities",
    content: `You are responsible for keeping your account secure. Enable two-factor authentication (2FA) for maximum protection. Do not share your password or 2FA codes with anyone, including VaultX support. We will never ask for your password. Report suspicious activity to support immediately. We are not liable for losses resulting from your failure to maintain account security.`,
  },
  {
    title: "Prohibited Activities",
    content: `You may not use VaultX for money laundering, fraud, or any illegal financial activity. Creating multiple accounts is prohibited. Automated access, bots, or scripts without explicit written permission are prohibited. Attempting to manipulate platform mechanics, exploit bugs, or reverse-engineer the platform is prohibited and may result in legal action.`,
  },
  {
    title: "Account Suspension",
    content: `VaultX reserves the right to suspend or terminate accounts that violate these Terms, engage in suspicious activity, fail KYC requirements, or are subject to legal orders. In the event of suspension, pending investment returns may be withheld pending investigation. Decisions on suspensions are at VaultX's sole discretion.`,
  },
  {
    title: "Limitation of Liability",
    content: `VaultX operates as an investment platform and is not a licensed financial advisor. All investments carry risk. VaultX shall not be liable for investment losses, system downtime, or losses resulting from factors outside our reasonable control. Our liability is limited to the amount you deposited in the six months preceding any claim.`,
  },
  {
    title: "Changes to Terms",
    content: `We may update these Terms at any time. Significant changes will be communicated via platform announcements or email. Your continued use of VaultX after changes take effect constitutes acceptance of the updated Terms. If you disagree with any changes, you should stop using the platform and contact support to close your account.`,
  },
  {
    title: "Contact Information",
    content: `For questions about these Terms & Conditions, please contact our support team through the in-app support ticket system or via the contact methods listed on our support page. Legal inquiries should be directed to our legal team via the support system.`,
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

export default function TermsPage() {
  const { data: settings } = useQuery({
    queryKey: ["public-settings"],
    queryFn: () => fetch("/api/settings/public", { credentials: "include" }).then((r) => r.json()),
    staleTime: 60000,
  });

  const customContent = settings?.terms_content?.trim() || "";
  const updatedDate = settings?.terms_updated?.trim() || "";
  const platformName = settings?.platform_name || "VaultX";

  const formattedDate = updatedDate
    ? new Date(updatedDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return (
    <SubPageLayout title="Terms & Conditions">
      <div className="pb-24">
        {/* Hero */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 px-4 pt-6 pb-8">
          <div className="max-w-screen-sm mx-auto text-center">
            <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mx-auto mb-3">
              <FileText size={24} className="text-white" />
            </div>
            <h1 className="text-lg font-black text-white mb-1">Terms &amp; Conditions</h1>
            <p className="text-xs text-white/50">Last Updated: {formattedDate}</p>
          </div>
        </div>

        <div className="px-4 pt-5 max-w-screen-sm mx-auto space-y-4">

          {/* Intro banner */}
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4">
            <p className="text-sm text-foreground font-medium leading-relaxed">
              Please read these Terms &amp; Conditions carefully before using {platformName}. By accessing or using our platform, you agree to be bound by these terms.
            </p>
          </div>

          {/* Custom admin content OR default sections */}
          {customContent ? (
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{customContent}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {DEFAULT_SECTIONS.map((s, i) => (
                <Section key={s.title} title={`${i + 1}. ${s.title}`} content={s.content} />
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="bg-muted/30 border border-border rounded-xl px-4 py-3 text-center">
            <p className="text-xs text-muted-foreground leading-relaxed">
              These terms constitute the entire agreement between you and {platformName}. By using the platform you confirm that you have read, understood, and agree to these Terms &amp; Conditions.
            </p>
          </div>

        </div>
      </div>
    </SubPageLayout>
  );
}
