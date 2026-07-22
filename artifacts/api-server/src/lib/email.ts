/**
 * EmailService — Wexora Global transactional email via Resend.
 *
 * All emails are sent from:  Wexora Global <noreply@mail.wexoraglobal.com>
 *
 * If RESEND_API_KEY is absent the service logs a warning and no-ops every send,
 * so the app starts cleanly in environments without email configured.
 */

import { Resend } from "resend";
import { logger } from "./logger";

// ── Resend client ─────────────────────────────────────────────────────────────
const apiKey = process.env.RESEND_API_KEY;
let resend: Resend | null = null;
if (apiKey) {
  resend = new Resend(apiKey);
} else {
  logger.warn("RESEND_API_KEY is not set — emails will be skipped");
}

const FROM = process.env.EMAIL_FROM ?? "noreply@mail.wexoraglobal.com";
const FROM_DISPLAY = `Wexora Global <${FROM}>`;
const SUPPORT_EMAIL = "support@mail.wexoraglobal.com";
const APP_URL = process.env.APP_URL ?? "https://wexoraglobal.com";
const YEAR = new Date().getFullYear();

// ── Base HTML template ────────────────────────────────────────────────────────
function baseTemplate(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#060d1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#060d1a;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

          <!-- Logo / header -->
          <tr>
            <td align="center" style="padding-bottom:28px;">
              <div style="display:inline-block;background:linear-gradient(135deg,#1d4ed8 0%,#7c3aed 100%);border-radius:18px;width:60px;height:60px;line-height:60px;text-align:center;margin-bottom:14px;">
                <span style="color:#ffffff;font-size:28px;font-weight:800;line-height:60px;">W</span>
              </div>
              <div style="color:#94a3b8;font-size:12px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;">Wexora Global</div>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color:#0d1829;border:1px solid #1e2d47;border-radius:20px;padding:40px 36px;">
              ${body}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:28px 0 8px;color:#475569;font-size:12px;line-height:1.8;">
              <p style="margin:0 0 4px 0;">&copy; ${YEAR} Wexora Global. All rights reserved.</p>
              <p style="margin:0 0 4px 0;">Need help? <a href="mailto:${SUPPORT_EMAIL}" style="color:#3b82f6;text-decoration:none;">${SUPPORT_EMAIL}</a></p>
              <p style="margin:0;color:#374151;font-size:11px;">This is an automated message &mdash; please do not reply to this email.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Heading helpers ───────────────────────────────────────────────────────────
function h1(text: string) {
  return `<h1 style="margin:0 0 8px 0;font-size:24px;font-weight:700;color:#f1f5f9;letter-spacing:-0.02em;">${text}</h1>`;
}
function subtitle(text: string) {
  return `<p style="margin:0 0 28px 0;font-size:15px;color:#94a3b8;line-height:1.6;">${text}</p>`;
}
function paragraph(text: string) {
  return `<p style="margin:0 0 20px 0;font-size:15px;color:#cbd5e1;line-height:1.7;">${text}</p>`;
}
function primaryButton(label: string, href: string) {
  return `<div style="margin:28px 0;">
    <a href="${href}" style="display:inline-block;background:linear-gradient(135deg,#1d4ed8,#7c3aed);color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:12px;letter-spacing:0.01em;">${label}</a>
  </div>`;
}
function divider() {
  return `<hr style="border:none;border-top:1px solid #1e2d47;margin:24px 0;" />`;
}
function smallNote(text: string) {
  return `<p style="margin:0;font-size:12px;color:#64748b;line-height:1.6;">${text}</p>`;
}

// ── Big OTP code box ──────────────────────────────────────────────────────────
function codeBox(code: string) {
  return `<div style="margin:28px 0;text-align:center;">
    <div style="display:inline-block;background:linear-gradient(135deg,#0f172a,#1e293b);border:1.5px solid #3b82f6;border-radius:16px;padding:24px 48px;">
      <div style="font-size:40px;font-weight:800;letter-spacing:0.18em;color:#f1f5f9;font-variant-numeric:tabular-nums;">${code}</div>
    </div>
    <p style="margin:10px 0 0;font-size:13px;color:#64748b;">Valid for <strong style="color:#94a3b8;">10 minutes</strong></p>
  </div>`;
}

// ── Info table row ────────────────────────────────────────────────────────────
function infoRow(label: string, value: string) {
  return `<tr>
    <td style="padding:10px 16px;font-size:13px;color:#94a3b8;white-space:nowrap;">${label}</td>
    <td style="padding:10px 16px;font-size:13px;color:#f1f5f9;font-weight:500;">${value}</td>
  </tr>`;
}
function infoTable(rows: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a1628;border:1px solid #1e2d47;border-radius:12px;margin:20px 0;">
    ${rows}
  </table>`;
}

// ── Alert box ────────────────────────────────────────────────────────────────
function alertBox(emoji: string, text: string, color = "#1d4ed8") {
  return `<div style="display:flex;gap:12px;align-items:flex-start;background:${color}18;border:1px solid ${color}44;border-radius:12px;padding:14px 16px;margin:20px 0;">
    <span style="font-size:18px;line-height:1;">${emoji}</span>
    <span style="font-size:13px;color:#cbd5e1;line-height:1.6;">${text}</span>
  </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core send helper
// ─────────────────────────────────────────────────────────────────────────────
async function send(to: string, subject: string, html: string): Promise<void> {
  if (!resend) {
    logger.info({ to, subject }, "Email skipped (no RESEND_API_KEY)");
    return;
  }
  try {
    const { error } = await resend.emails.send({ from: FROM_DISPLAY, to, subject, html });
    if (error) {
      logger.error({ error, to, subject }, "Resend error");
    } else {
      logger.info({ to, subject }, "Email sent");
    }
  } catch (err) {
    logger.error({ err, to, subject }, "Failed to send email");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public EmailService methods
// ─────────────────────────────────────────────────────────────────────────────
export const EmailService = {
  // ── 1. Email verification ──────────────────────────────────────────────────
  async sendVerificationEmail(to: string, name: string, code: string): Promise<void> {
    const subject = "Verify your Wexora Global account";
    const body = `
      ${h1("Verify your email")}
      ${subtitle(`Hi ${name.split(" ")[0]}, welcome to Wexora Global! Enter the code below to verify your account.`)}
      ${codeBox(code)}
      ${alertBox("🔒", "For your security, this code expires in 10 minutes and can only be used once. Never share this code with anyone.")}
      ${divider()}
      ${smallNote("If you didn't create a Wexora Global account, you can safely ignore this email.")}
    `;
    await send(to, subject, baseTemplate(subject, body));
  },

  // ── 2. Password reset ──────────────────────────────────────────────────────
  async sendPasswordReset(to: string, name: string, token: string): Promise<void> {
    const subject = "Reset your Wexora Global password";
    const resetUrl = `${APP_URL}/reset-password?token=${token}`;
    const body = `
      ${h1("Reset your password")}
      ${subtitle(`Hi ${name.split(" ")[0]}, we received a request to reset your Wexora Global password.`)}
      ${paragraph("Click the button below to choose a new password. This link is valid for <strong style='color:#f1f5f9;'>30 minutes</strong>.")}
      ${primaryButton("Reset Password", resetUrl)}
      ${divider()}
      ${paragraph(`Or copy and paste this URL into your browser:`)}
      <div style="background:#0a1628;border:1px solid #1e2d47;border-radius:10px;padding:12px 16px;margin:0 0 20px;word-break:break-all;">
        <a href="${resetUrl}" style="color:#3b82f6;font-size:13px;text-decoration:none;">${resetUrl}</a>
      </div>
      ${alertBox("🔒", "If you didn't request a password reset, your account is safe. This link will expire automatically.", "#ef4444")}
    `;
    await send(to, subject, baseTemplate(subject, body));
  },

  // ── 3. Welcome ─────────────────────────────────────────────────────────────
  async sendWelcome(to: string, name: string, referralCode: string): Promise<void> {
    const subject = "Welcome to Wexora Global 🎉";
    const body = `
      ${h1("Welcome to Wexora Global!")}
      ${subtitle(`Hi ${name.split(" ")[0]}, your account is verified and ready to go.`)}
      ${paragraph("You now have access to our full suite of smart investment tools, real-time portfolio tracking, and global market insights.")}
      ${primaryButton("Go to Dashboard", `${APP_URL}/`)}
      ${divider()}
      ${infoTable(`
        ${infoRow("Your Referral Code", `<span style='font-family:monospace;letter-spacing:0.1em;color:#3b82f6;'>${referralCode}</span>`)}
        ${infoRow("Referral Reward", "Earn commissions on every referral")}
        ${infoRow("Support", `<a href="mailto:${SUPPORT_EMAIL}" style="color:#3b82f6;text-decoration:none;">${SUPPORT_EMAIL}</a>`)}
      `)}
      ${smallNote("Share your referral code with friends to earn ongoing commissions on their activity.")}
    `;
    await send(to, subject, baseTemplate(subject, body));
  },

  // ── 4. Investment created ──────────────────────────────────────────────────
  async sendInvestmentCreated(to: string, name: string, planName: string, amount: number, dailyRate: number, durationDays: number): Promise<void> {
    const subject = "Investment confirmed — Wexora Global";
    const body = `
      ${h1("Investment Confirmed ✅")}
      ${subtitle(`Hi ${name.split(" ")[0]}, your investment is now active and earning.`)}
      ${infoTable(`
        ${infoRow("Plan", planName)}
        ${infoRow("Amount", `$${amount.toFixed(2)} USDT`)}
        ${infoRow("Daily Return", `${(dailyRate * 100).toFixed(2)}%`)}
        ${infoRow("Duration", `${durationDays} days`)}
        ${infoRow("Est. Total Return", `$${(amount * dailyRate * durationDays).toFixed(2)} USDT`)}
      `)}
      ${primaryButton("View Portfolio", `${APP_URL}/portfolio`)}
      ${divider()}
      ${smallNote("Returns are calculated daily. You can track your earnings in real time from your portfolio dashboard.")}
    `;
    await send(to, subject, baseTemplate(subject, body));
  },

  // ── 5. Investment matured ──────────────────────────────────────────────────
  async sendInvestmentMatured(to: string, name: string, planName: string, totalEarned: number): Promise<void> {
    const subject = "Your investment has matured — Wexora Global";
    const body = `
      ${h1("Investment Matured 🎯")}
      ${subtitle(`Hi ${name.split(" ")[0]}, your investment in <strong style='color:#f1f5f9;'>${planName}</strong> has reached maturity.`)}
      ${infoTable(`
        ${infoRow("Plan", planName)}
        ${infoRow("Total Earned", `<span style='color:#10b981;font-weight:700;'>$${totalEarned.toFixed(2)} USDT</span>`)}
        ${infoRow("Status", "<span style='color:#10b981;'>Matured</span>")}
      `)}
      ${paragraph("Your earnings are available in your wallet. You can withdraw, reinvest, or hold — it's your choice.")}
      ${primaryButton("Go to Wallet", `${APP_URL}/wallet`)}
    `;
    await send(to, subject, baseTemplate(subject, body));
  },

  // ── 6. Deposit approved ────────────────────────────────────────────────────
  async sendDepositApproved(to: string, name: string, amount: number, network: string): Promise<void> {
    const subject = "Deposit approved — Wexora Global";
    const body = `
      ${h1("Deposit Approved ✅")}
      ${subtitle(`Hi ${name.split(" ")[0]}, your deposit has been confirmed and credited to your wallet.`)}
      ${infoTable(`
        ${infoRow("Amount", `<span style='color:#10b981;font-weight:700;'>+$${amount.toFixed(2)} USDT</span>`)}
        ${infoRow("Network", network)}
        ${infoRow("Status", "<span style='color:#10b981;'>Approved</span>")}
      `)}
      ${primaryButton("View Wallet", `${APP_URL}/wallet`)}
    `;
    await send(to, subject, baseTemplate(subject, body));
  },

  // ── 7. Withdrawal approved ─────────────────────────────────────────────────
  async sendWithdrawalApproved(to: string, name: string, amount: number, address: string): Promise<void> {
    const subject = "Withdrawal approved — Wexora Global";
    const body = `
      ${h1("Withdrawal Approved ✅")}
      ${subtitle(`Hi ${name.split(" ")[0]}, your withdrawal request has been approved and is being processed.`)}
      ${infoTable(`
        ${infoRow("Amount", `$${amount.toFixed(2)} USDT`)}
        ${infoRow("Destination", `<span style='font-family:monospace;font-size:12px;'>${address.slice(0, 10)}…${address.slice(-8)}</span>`)}
        ${infoRow("Status", "<span style='color:#10b981;'>Approved</span>")}
      `)}
      ${alertBox("⏱️", "Funds typically arrive within 1–3 business days depending on network conditions.")}
      ${primaryButton("View Transactions", `${APP_URL}/wallet`)}
    `;
    await send(to, subject, baseTemplate(subject, body));
  },

  // ── 8. Withdrawal rejected ─────────────────────────────────────────────────
  async sendWithdrawalRejected(to: string, name: string, amount: number, reason?: string): Promise<void> {
    const subject = "Withdrawal request declined — Wexora Global";
    const body = `
      ${h1("Withdrawal Declined")}
      ${subtitle(`Hi ${name.split(" ")[0]}, unfortunately your withdrawal request could not be processed.`)}
      ${infoTable(`
        ${infoRow("Amount", `$${amount.toFixed(2)} USDT`)}
        ${infoRow("Status", "<span style='color:#ef4444;'>Declined</span>")}
        ${reason ? infoRow("Reason", reason) : ""}
      `)}
      ${paragraph("Your funds have been returned to your wallet balance. If you believe this is an error, please contact our support team.")}
      ${primaryButton("Contact Support", `mailto:${SUPPORT_EMAIL}`)}
    `;
    await send(to, subject, baseTemplate(subject, body));
  },

  // ── 9. Security alert ──────────────────────────────────────────────────────
  async sendSecurityAlert(to: string, name: string, event: "password_changed" | "email_changed" | "new_login", detail?: string): Promise<void> {
    const events: Record<string, { title: string; desc: string }> = {
      password_changed: { title: "Password Changed", desc: "Your account password was recently changed." },
      email_changed: { title: "Email Address Changed", desc: "The email address on your account was recently changed." },
      new_login: { title: "New Sign-in Detected", desc: `A new sign-in to your account was detected${detail ? ` from ${detail}` : ""}.` },
    };
    const { title, desc } = events[event];
    const subject = `Security alert: ${title} — Wexora Global`;
    const body = `
      ${h1(`⚠️ ${title}`)}
      ${subtitle(`Hi ${name.split(" ")[0]}, we noticed activity on your account.`)}
      ${alertBox("🔒", `${desc} If this was you, no action is needed. If you didn't make this change, please secure your account immediately.`, "#f59e0b")}
      ${primaryButton("Secure My Account", `${APP_URL}/security`)}
      ${divider()}
      ${smallNote(`If you have questions or concerns, contact us at ${SUPPORT_EMAIL}.`)}
    `;
    await send(to, subject, baseTemplate(subject, body));
  },

  // ── 10. KYC approved ──────────────────────────────────────────────────────
  async sendKycApproved(to: string, name: string): Promise<void> {
    const subject = "KYC Verified — Wexora Global";
    const body = `
      ${h1("Identity Verified ✅")}
      ${subtitle(`Hi ${name.split(" ")[0]}, your identity has been successfully verified.`)}
      ${paragraph("You now have full access to all Wexora Global features including increased withdrawal limits and exclusive investment plans.")}
      ${primaryButton("Explore Opportunities", `${APP_URL}/investments`)}
    `;
    await send(to, subject, baseTemplate(subject, body));
  },

  // ── 11. KYC rejected ──────────────────────────────────────────────────────
  async sendKycRejected(to: string, name: string, reason?: string): Promise<void> {
    const subject = "KYC Verification Update — Wexora Global";
    const body = `
      ${h1("Verification Unsuccessful")}
      ${subtitle(`Hi ${name.split(" ")[0]}, we were unable to verify your identity at this time.`)}
      ${reason ? alertBox("📋", `Reason: ${reason}`, "#ef4444") : ""}
      ${paragraph("Please ensure your documents are clear, valid, and match your account information, then resubmit.")}
      ${primaryButton("Resubmit KYC", `${APP_URL}/kyc`)}
      ${divider()}
      ${smallNote(`Need help? Contact us at ${SUPPORT_EMAIL}.`)}
    `;
    await send(to, subject, baseTemplate(subject, body));
  },

  // ── 12. Referral commission ────────────────────────────────────────────────
  async sendReferralCommission(to: string, name: string, referredName: string, commission: number): Promise<void> {
    const subject = "Referral commission earned — Wexora Global";
    const body = `
      ${h1("Referral Commission 💰")}
      ${subtitle(`Hi ${name.split(" ")[0]}, you've earned a referral commission!`)}
      ${infoTable(`
        ${infoRow("From", referredName)}
        ${infoRow("Commission", `<span style='color:#10b981;font-weight:700;'>+$${commission.toFixed(2)} USDT</span>`)}
        ${infoRow("Status", "<span style='color:#10b981;'>Credited to wallet</span>")}
      `)}
      ${paragraph("Keep sharing your referral code to earn more commissions on your network's activity.")}
      ${primaryButton("View Referrals", `${APP_URL}/referrals`)}
    `;
    await send(to, subject, baseTemplate(subject, body));
  },
};
