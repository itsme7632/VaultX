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
const SUPPORT_EMAIL = "support@wexoraglobal.com";
const APP_URL = process.env.APP_URL ?? "https://wexoraglobal.com";
const LOGO_URL = "https://wexoraglobal.com/wx-logo.png";

// ── Base HTML template ────────────────────────────────────────────────────────
function baseTemplate(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${title}</title>
  <!--[if mso]>
  <noscript>
    <xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#060d1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;mso-line-height-rule:exactly;">
  <!-- Outer wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#060d1a;">
    <tr>
      <td align="center" style="padding:40px 16px 48px;">

        <!-- Container -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <a href="${APP_URL}" style="display:inline-block;text-decoration:none;">
                <img src="${LOGO_URL}" alt="Wexora Global" width="160" height="auto"
                  style="display:block;border:0;max-width:160px;height:auto;" />
              </a>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color:#0d1829;border:1px solid #1e2d47;border-radius:20px;padding:44px 40px;">
              ${body}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:36px 0 8px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:480px;">
                <tr>
                  <td align="center" style="padding-bottom:20px;">
                    <div style="border-top:1px solid #1e2d47;width:100%;"></div>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom:4px;">
                    <span style="font-size:14px;font-weight:700;color:#cbd5e1;letter-spacing:0.04em;">Wexora Global</span>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom:16px;">
                    <span style="font-size:12px;color:#64748b;line-height:1.8;">Global Opportunities. Smarter Growth.</span>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom:8px;">
                    <a href="${APP_URL}" style="font-size:12px;color:#3b82f6;text-decoration:none;">${APP_URL}</a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom:16px;">
                    <span style="font-size:12px;color:#64748b;">Support: </span>
                    <a href="mailto:${SUPPORT_EMAIL}" style="font-size:12px;color:#3b82f6;text-decoration:none;">${SUPPORT_EMAIL}</a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom:8px;">
                    <span style="font-size:11px;color:#475569;line-height:1.7;">
                      This is an automated email. Please do not reply.<br />
                      If you did not perform this action, you may safely ignore this email.
                    </span>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom:20px;">
                    <div style="border-top:1px solid #1e2d47;width:100%;margin-top:16px;"></div>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <span style="font-size:11px;color:#374151;">&copy; Wexora Global. All rights reserved.</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Typography helpers ────────────────────────────────────────────────────────
function h1(text: string) {
  return `<h1 style="margin:0 0 10px 0;font-size:26px;font-weight:700;color:#f1f5f9;letter-spacing:-0.02em;line-height:1.3;">${text}</h1>`;
}
function subtitle(text: string) {
  return `<p style="margin:0 0 28px 0;font-size:15px;color:#94a3b8;line-height:1.65;">${text}</p>`;
}
function paragraph(text: string) {
  return `<p style="margin:0 0 20px 0;font-size:15px;color:#cbd5e1;line-height:1.7;">${text}</p>`;
}
function divider() {
  return `<div style="border-top:1px solid #1e2d47;margin:28px 0;"></div>`;
}
function smallNote(text: string) {
  return `<p style="margin:0;font-size:12px;color:#64748b;line-height:1.65;">${text}</p>`;
}

// ── Primary button ────────────────────────────────────────────────────────────
function primaryButton(label: string, href: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0;">
    <tr>
      <td align="center" style="border-radius:12px;background:linear-gradient(135deg,#1d4ed8,#7c3aed);">
        <a href="${href}"
           style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:12px;letter-spacing:0.01em;mso-padding-alt:14px 36px;">
          <!--[if mso]>&nbsp;<![endif]-->${label}<!--[if mso]>&nbsp;<![endif]-->
        </a>
      </td>
    </tr>
  </table>`;
}

// ── Big OTP code box ──────────────────────────────────────────────────────────
function codeBox(code: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:28px 0;">
    <tr>
      <td align="center">
        <div style="display:inline-block;background:#0a1628;border:2px solid #3b82f6;border-radius:16px;padding:24px 56px;text-align:center;">
          <div style="font-size:42px;font-weight:800;letter-spacing:0.2em;color:#f1f5f9;font-variant-numeric:tabular-nums;font-family:'Courier New',Courier,monospace;">${code}</div>
          <div style="margin-top:10px;font-size:13px;color:#64748b;">Valid for <strong style="color:#94a3b8;">10 minutes</strong></div>
        </div>
      </td>
    </tr>
  </table>`;
}

// ── Info table ────────────────────────────────────────────────────────────────
function infoRow(label: string, value: string) {
  return `<tr>
    <td style="padding:11px 16px;font-size:13px;color:#64748b;white-space:nowrap;border-bottom:1px solid #1a2640;">${label}</td>
    <td style="padding:11px 16px;font-size:13px;color:#f1f5f9;font-weight:500;border-bottom:1px solid #1a2640;">${value}</td>
  </tr>`;
}
function infoTable(rows: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
    style="background:#080f1e;border:1px solid #1e2d47;border-radius:12px;margin:20px 0;overflow:hidden;">
    ${rows}
  </table>`;
}

// ── Alert / notice box ────────────────────────────────────────────────────────
function alertBox(emoji: string, text: string, color = "#1d4ed8") {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
    style="background:${color}18;border:1px solid ${color}44;border-radius:12px;margin:20px 0;">
    <tr>
      <td style="padding:14px 16px;font-size:18px;line-height:1;vertical-align:top;width:28px;">${emoji}</td>
      <td style="padding:14px 16px 14px 4px;font-size:13px;color:#cbd5e1;line-height:1.65;">${text}</td>
    </tr>
  </table>`;
}

// ── Feature list (for welcome email) ─────────────────────────────────────────
function featureItem(icon: string, title: string, desc: string) {
  return `<tr>
    <td style="padding:10px 0;vertical-align:top;width:36px;font-size:20px;line-height:1;">${icon}</td>
    <td style="padding:10px 0 10px 12px;vertical-align:top;">
      <div style="font-size:14px;font-weight:600;color:#f1f5f9;margin-bottom:2px;">${title}</div>
      <div style="font-size:13px;color:#64748b;line-height:1.5;">${desc}</div>
    </td>
  </tr>`;
}

// ── Status badge ──────────────────────────────────────────────────────────────
function badge(text: string, color: string, bg: string) {
  return `<span style="display:inline-block;background:${bg};color:${color};font-size:12px;font-weight:600;padding:3px 10px;border-radius:20px;letter-spacing:0.03em;">${text}</span>`;
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

  // ── 1. Email Verification (OTP) ───────────────────────────────────────────
  async sendVerificationEmail(to: string, name: string, code: string): Promise<void> {
    const subject = "Verify your Wexora Global account";
    const firstName = name.split(" ")[0];
    const body = `
      ${h1("Verify your email address")}
      ${subtitle(`Hi ${firstName}, welcome to Wexora Global! Use the verification code below to confirm your account.`)}
      ${codeBox(code)}
      ${alertBox("🔒", "For your security, this code expires in <strong>10 minutes</strong> and can only be used once. Never share this code with anyone — Wexora Global will never ask for it.")}
      ${divider()}
      ${smallNote("If you did not create a Wexora Global account, you can safely ignore this email.")}
    `;
    await send(to, subject, baseTemplate(subject, body));
  },

  // ── 2. Welcome Email ──────────────────────────────────────────────────────
  async sendWelcome(to: string, name: string, referralCode: string): Promise<void> {
    const subject = "Welcome to Wexora Global — Your account is ready";
    const firstName = name.split(" ")[0];
    const body = `
      ${h1("Welcome to Wexora Global! 🎉")}
      ${subtitle(`Hi ${firstName}, your account is verified and you're ready to start investing.`)}
      ${paragraph("You now have full access to our complete suite of investment tools and features:")}
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
        style="background:#080f1e;border:1px solid #1e2d47;border-radius:14px;padding:8px 16px;margin:20px 0;">
        ${featureItem("💼", "Smart Investing", "Browse curated investment plans with competitive daily ROI.")}
        ${featureItem("📊", "Live Dashboard", "Track your portfolio, earnings, and performance in real time.")}
        ${featureItem("💳", "Deposits", "Fund your account instantly via crypto networks.")}
        ${featureItem("💸", "Withdrawals", "Withdraw your earnings securely to your wallet.")}
        ${featureItem("👥", "Referral Program", "Earn multi-level commissions by inviting friends.")}
        ${featureItem("💬", "Community", "Connect with other investors in our members-only community.")}
        ${featureItem("🌍", "Global Opportunities", "Access exclusive investment opportunities worldwide.")}
      </table>
      ${primaryButton("Go to Dashboard", `${APP_URL}/`)}
      ${divider()}
      ${infoTable(`
        ${infoRow("Your Referral Code", `<span style="font-family:'Courier New',monospace;letter-spacing:0.1em;color:#3b82f6;font-size:14px;">${referralCode}</span>`)}
        ${infoRow("Referral Reward", "Earn L1/L2/L3 commissions on your network's activity")}
        ${infoRow("Support", `<a href="mailto:${SUPPORT_EMAIL}" style="color:#3b82f6;text-decoration:none;">${SUPPORT_EMAIL}</a>`)}
      `)}
      ${smallNote("Share your referral code with friends and family to start earning ongoing commissions.")}
    `;
    await send(to, subject, baseTemplate(subject, body));
  },

  // ── 3. Forgot Password ────────────────────────────────────────────────────
  async sendPasswordReset(to: string, name: string, token: string): Promise<void> {
    const subject = "Reset your Wexora Global password";
    const firstName = name.split(" ")[0];
    const resetUrl = `${APP_URL}/reset-password?token=${token}`;
    const body = `
      ${h1("Reset your password")}
      ${subtitle(`Hi ${firstName}, we received a request to reset the password on your Wexora Global account.`)}
      ${paragraph("Click the button below to set a new password. This link is valid for <strong style='color:#f1f5f9;'>30 minutes</strong> and can only be used once.")}
      ${primaryButton("Reset Password", resetUrl)}
      ${paragraph(`Or copy and paste this link into your browser:`)}
      <div style="background:#080f1e;border:1px solid #1e2d47;border-radius:10px;padding:12px 16px;margin:0 0 20px;word-break:break-all;">
        <a href="${resetUrl}" style="color:#3b82f6;font-size:13px;text-decoration:none;line-height:1.6;">${resetUrl}</a>
      </div>
      ${alertBox("🔒", "If you did not request a password reset, your account is safe. This link will expire automatically in 30 minutes — no action needed.", "#ef4444")}
    `;
    await send(to, subject, baseTemplate(subject, body));
  },

  // ── 4. Password Changed ───────────────────────────────────────────────────
  async sendPasswordChanged(to: string, name: string, time: string, browser?: string, ip?: string): Promise<void> {
    const subject = "Your Wexora Global password was changed";
    const firstName = name.split(" ")[0];
    const rows = [
      infoRow("Event", "Password changed"),
      infoRow("Time", time),
      browser ? infoRow("Browser", browser) : "",
      ip ? infoRow("IP Address", ip) : "",
    ].filter(Boolean).join("");
    const body = `
      ${h1("Password changed")}
      ${subtitle(`Hi ${firstName}, your account password was successfully changed.`)}
      ${infoTable(rows)}
      ${alertBox("⚠️", "If this was <strong>not you</strong>, your account may be at risk. Contact our support team immediately and secure your account.", "#ef4444")}
      ${primaryButton("Secure My Account", `${APP_URL}/security`)}
      ${divider()}
      ${smallNote(`If this change was made by you, no further action is required. Contact us at <a href="mailto:${SUPPORT_EMAIL}" style="color:#3b82f6;text-decoration:none;">${SUPPORT_EMAIL}</a> if you have concerns.`)}
    `;
    await send(to, subject, baseTemplate(subject, body));
  },

  // ── 5. Deposit Submitted ──────────────────────────────────────────────────
  async sendDepositSubmitted(to: string, name: string, amount: number, currency: string, network: string, txId: string): Promise<void> {
    const subject = "Deposit received — pending review";
    const firstName = name.split(" ")[0];
    const body = `
      ${h1("Deposit Submitted ✅")}
      ${subtitle(`Hi ${firstName}, we've received your deposit and it's currently under review.`)}
      ${infoTable(`
        ${infoRow("Amount", `<strong style="color:#f1f5f9;">${amount.toFixed(2)} ${currency}</strong>`)}
        ${infoRow("Network", network)}
        ${infoRow("Reference ID", `<span style="font-family:'Courier New',monospace;font-size:12px;color:#94a3b8;">${txId}</span>`)}
        ${infoRow("Status", badge("Pending Review", "#fbbf24", "#fbbf2420"))}
      `)}
      ${paragraph("Our team will review and confirm your deposit shortly. You'll receive another email once it's approved and credited to your wallet.")}
      ${alertBox("ℹ️", "Processing typically takes a few hours. If your deposit is not reflected after 24 hours, please contact support with your Reference ID.")}
      ${primaryButton("View Wallet", `${APP_URL}/wallet`)}
    `;
    await send(to, subject, baseTemplate(subject, body));
  },

  // ── 6. Deposit Approved ───────────────────────────────────────────────────
  async sendDepositApproved(to: string, name: string, amount: number, network: string, planName?: string, date?: string): Promise<void> {
    const subject = "Deposit approved — funds credited";
    const firstName = name.split(" ")[0];
    const rows = [
      infoRow("Amount", `<strong style="color:#10b981;">+${amount.toFixed(2)} USDT</strong>`),
      infoRow("Network", network),
      planName ? infoRow("Plan", planName) : "",
      date ? infoRow("Date", date) : infoRow("Date", new Date().toUTCString()),
      infoRow("Status", badge("Approved", "#10b981", "#10b98120")),
    ].filter(Boolean).join("");
    const body = `
      ${h1("Deposit Approved 🎉")}
      ${subtitle(`Hi ${firstName}, great news — your deposit has been verified and credited to your wallet.`)}
      ${infoTable(rows)}
      ${paragraph("Your funds are now available in your wallet. You can invest, withdraw, or hold your balance.")}
      ${primaryButton("View Dashboard", `${APP_URL}/`)}
    `;
    await send(to, subject, baseTemplate(subject, body));
  },

  // ── 7. Withdrawal Requested ───────────────────────────────────────────────
  async sendWithdrawalRequested(to: string, name: string, amount: number, address: string, network: string): Promise<void> {
    const subject = "Withdrawal request received";
    const firstName = name.split(" ")[0];
    const shortAddr = `${address.slice(0, 10)}…${address.slice(-8)}`;
    const body = `
      ${h1("Withdrawal Requested")}
      ${subtitle(`Hi ${firstName}, your withdrawal request has been submitted and is pending review.`)}
      ${infoTable(`
        ${infoRow("Amount", `<strong style="color:#f1f5f9;">${amount.toFixed(2)} USDT</strong>`)}
        ${infoRow("Destination Wallet", `<span style="font-family:'Courier New',monospace;font-size:12px;color:#94a3b8;">${shortAddr}</span>`)}
        ${infoRow("Network", network)}
        ${infoRow("Status", badge("Pending Review", "#fbbf24", "#fbbf2420"))}
      `)}
      ${paragraph("Our team will review your request. You'll receive a confirmation email once your withdrawal is approved and processed.")}
      ${alertBox("🔒", "If you did not initiate this withdrawal, please contact our support team immediately.")}
      ${primaryButton("View Wallet", `${APP_URL}/wallet`)}
    `;
    await send(to, subject, baseTemplate(subject, body));
  },

  // ── 8. Withdrawal Approved ────────────────────────────────────────────────
  async sendWithdrawalApproved(to: string, name: string, amount: number, address: string, txId?: string): Promise<void> {
    const subject = "Withdrawal approved — payment sent";
    const firstName = name.split(" ")[0];
    const shortAddr = `${address.slice(0, 10)}…${address.slice(-8)}`;
    const rows = [
      infoRow("Amount", `<strong style="color:#10b981;">${amount.toFixed(2)} USDT</strong>`),
      infoRow("Destination Wallet", `<span style="font-family:'Courier New',monospace;font-size:12px;color:#94a3b8;">${shortAddr}</span>`),
      txId ? infoRow("Transaction ID", `<span style="font-family:'Courier New',monospace;font-size:12px;color:#94a3b8;">${txId}</span>`) : "",
      infoRow("Status", badge("Approved", "#10b981", "#10b98120")),
    ].filter(Boolean).join("");
    const body = `
      ${h1("Withdrawal Approved ✅")}
      ${subtitle(`Hi ${firstName}, your withdrawal has been approved and the payment has been sent.`)}
      ${infoTable(rows)}
      ${alertBox("⏱️", "Funds typically arrive within 1–3 business days depending on network conditions and blockchain congestion.")}
      ${primaryButton("View Transactions", `${APP_URL}/wallet`)}
    `;
    await send(to, subject, baseTemplate(subject, body));
  },

  // ── 9. Withdrawal Rejected ────────────────────────────────────────────────
  async sendWithdrawalRejected(to: string, name: string, amount: number, reason?: string): Promise<void> {
    const subject = "Withdrawal request declined";
    const firstName = name.split(" ")[0];
    const body = `
      ${h1("Withdrawal Declined")}
      ${subtitle(`Hi ${firstName}, unfortunately your withdrawal request could not be processed at this time.`)}
      ${infoTable(`
        ${infoRow("Amount", `${amount.toFixed(2)} USDT`)}
        ${infoRow("Status", badge("Declined", "#ef4444", "#ef444420"))}
        ${reason ? infoRow("Reason", `<span style="color:#fca5a5;">${reason}</span>`) : ""}
      `)}
      ${paragraph("Your funds have been returned to your wallet balance in full. If you believe this is an error or need clarification, please reach out to our support team.")}
      ${primaryButton("Contact Support", `mailto:${SUPPORT_EMAIL}`)}
    `;
    await send(to, subject, baseTemplate(subject, body));
  },

  // ── 10. ROI Credited ──────────────────────────────────────────────────────
  async sendRoiCredited(to: string, name: string, planName: string, todayRoi: number, currentBalance: number): Promise<void> {
    const subject = "Daily ROI credited to your wallet";
    const firstName = name.split(" ")[0];
    const body = `
      ${h1("ROI Credited 💰")}
      ${subtitle(`Hi ${firstName}, your daily return on investment has been credited to your wallet.`)}
      ${infoTable(`
        ${infoRow("Investment Plan", planName)}
        ${infoRow("Today's ROI", `<strong style="color:#10b981;">+${todayRoi.toFixed(2)} USDT</strong>`)}
        ${infoRow("Current Balance", `<strong style="color:#f1f5f9;">${currentBalance.toFixed(2)} USDT</strong>`)}
      `)}
      ${paragraph("Your earnings are compounding daily. Keep growing your portfolio by reinvesting or exploring additional plans.")}
      ${primaryButton("View Portfolio", `${APP_URL}/portfolio`)}
    `;
    await send(to, subject, baseTemplate(subject, body));
  },

  // ── 11. Investment Completed ──────────────────────────────────────────────
  async sendInvestmentCompleted(to: string, name: string, planName: string, principal: number, totalRoi: number, totalReturned: number): Promise<void> {
    const subject = "Your investment has matured — Wexora Global";
    const firstName = name.split(" ")[0];
    const body = `
      ${h1("Investment Matured 🎯")}
      ${subtitle(`Hi ${firstName}, your investment in <strong style='color:#f1f5f9;'>${planName}</strong> has reached maturity. Congratulations!`)}
      ${infoTable(`
        ${infoRow("Plan", planName)}
        ${infoRow("Principal", `${principal.toFixed(2)} USDT`)}
        ${infoRow("Total ROI Earned", `<strong style="color:#10b981;">+${totalRoi.toFixed(2)} USDT</strong>`)}
        ${infoRow("Total Returned", `<strong style="color:#f1f5f9;">${totalReturned.toFixed(2)} USDT</strong>`)}
        ${infoRow("Status", badge("Matured", "#10b981", "#10b98120"))}
      `)}
      ${paragraph("Your earnings are ready in your wallet. Withdraw, reinvest, or explore new opportunities — the choice is yours.")}
      ${primaryButton("View Wallet", `${APP_URL}/wallet`)}
    `;
    await send(to, subject, baseTemplate(subject, body));
  },

  // ── 12. Referral Reward ───────────────────────────────────────────────────
  async sendReferralReward(to: string, name: string, referralName: string, amount: number, level: number): Promise<void> {
    const subject = "Referral commission earned — Wexora Global";
    const firstName = name.split(" ")[0];
    const levelLabel = level === 1 ? "Level 1 (Direct)" : level === 2 ? "Level 2" : `Level ${level}`;
    const body = `
      ${h1("Referral Commission Earned 💸")}
      ${subtitle(`Hi ${firstName}, you just earned a referral commission from your network!`)}
      ${infoTable(`
        ${infoRow("From", referralName)}
        ${infoRow("Commission", `<strong style="color:#10b981;">+${amount.toFixed(2)} USDT</strong>`)}
        ${infoRow("Commission Level", levelLabel)}
        ${infoRow("Status", badge("Credited to Wallet", "#10b981", "#10b98120"))}
      `)}
      ${paragraph("Keep sharing your referral code to earn more commissions on your network's investments and deposits.")}
      ${primaryButton("View Referrals", `${APP_URL}/referrals`)}
    `;
    await send(to, subject, baseTemplate(subject, body));
  },

  // ── 13. Admin Announcement ────────────────────────────────────────────────
  async sendAdminAnnouncement(to: string, name: string, title: string, content: string): Promise<void> {
    const subject = `${title} — Wexora Global`;
    const firstName = name.split(" ")[0];
    const body = `
      ${h1(title)}
      ${subtitle(`Hi ${firstName}, you have an important announcement from the Wexora Global team.`)}
      <div style="background:#080f1e;border:1px solid #1e2d47;border-radius:14px;padding:24px 28px;margin:20px 0;">
        <p style="margin:0;font-size:15px;color:#cbd5e1;line-height:1.75;">${content.replace(/\n/g, "<br />")}</p>
      </div>
      ${primaryButton("Go to Dashboard", `${APP_URL}/`)}
      ${divider()}
      ${smallNote("This announcement was sent to all active Wexora Global members.")}
    `;
    await send(to, subject, baseTemplate(subject, body));
  },

  // ── 14. Security Alert — New Login ────────────────────────────────────────
  async sendNewLogin(to: string, name: string, opts: {
    device?: string;
    browser?: string;
    country?: string;
    ip?: string;
    time?: string;
  }): Promise<void> {
    const subject = "New sign-in detected — Wexora Global";
    const firstName = name.split(" ")[0];
    const rows = [
      opts.time ? infoRow("Time", opts.time) : infoRow("Time", new Date().toUTCString()),
      opts.device ? infoRow("Device", opts.device) : "",
      opts.browser ? infoRow("Browser", opts.browser) : "",
      opts.country ? infoRow("Country", opts.country) : "",
      opts.ip ? infoRow("IP Address", opts.ip) : "",
    ].filter(Boolean).join("");
    const body = `
      ${h1("New sign-in detected")}
      ${subtitle(`Hi ${firstName}, a new sign-in to your Wexora Global account was detected.`)}
      ${infoTable(rows)}
      ${alertBox("⚠️", "If this was <strong>you</strong>, no action is needed. If you do not recognize this activity, secure your account immediately — change your password and enable two-factor authentication.", "#f59e0b")}
      ${primaryButton("Secure My Account", `${APP_URL}/security`)}
      ${divider()}
      ${smallNote(`Questions? Contact us at <a href="mailto:${SUPPORT_EMAIL}" style="color:#3b82f6;text-decoration:none;">${SUPPORT_EMAIL}</a>`)}
    `;
    await send(to, subject, baseTemplate(subject, body));
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Additional existing methods kept for compatibility
  // ─────────────────────────────────────────────────────────────────────────

  // Investment created (active notification)
  async sendInvestmentCreated(to: string, name: string, planName: string, amount: number, dailyRate: number, durationDays: number): Promise<void> {
    const subject = "Investment confirmed — Wexora Global";
    const firstName = name.split(" ")[0];
    const body = `
      ${h1("Investment Confirmed ✅")}
      ${subtitle(`Hi ${firstName}, your investment is now active and earning daily returns.`)}
      ${infoTable(`
        ${infoRow("Plan", planName)}
        ${infoRow("Amount", `${amount.toFixed(2)} USDT`)}
        ${infoRow("Daily Return", `${(dailyRate * 100).toFixed(2)}%`)}
        ${infoRow("Duration", `${durationDays} days`)}
        ${infoRow("Est. Total Return", `${(amount * dailyRate * durationDays).toFixed(2)} USDT`)}
        ${infoRow("Status", badge("Active", "#10b981", "#10b98120"))}
      `)}
      ${primaryButton("View Portfolio", `${APP_URL}/portfolio`)}
      ${divider()}
      ${smallNote("Returns are calculated daily. Track your live earnings from the portfolio dashboard.")}
    `;
    await send(to, subject, baseTemplate(subject, body));
  },

  // KYC approved
  async sendKycApproved(to: string, name: string): Promise<void> {
    const subject = "Identity verified — Wexora Global";
    const firstName = name.split(" ")[0];
    const body = `
      ${h1("Identity Verified ✅")}
      ${subtitle(`Hi ${firstName}, your identity has been successfully verified.`)}
      ${paragraph("You now have full access to all Wexora Global features including increased withdrawal limits and exclusive investment plans.")}
      ${primaryButton("Explore Opportunities", `${APP_URL}/investments`)}
    `;
    await send(to, subject, baseTemplate(subject, body));
  },

  // KYC rejected
  async sendKycRejected(to: string, name: string, reason?: string): Promise<void> {
    const subject = "KYC verification update — Wexora Global";
    const firstName = name.split(" ")[0];
    const body = `
      ${h1("Verification Unsuccessful")}
      ${subtitle(`Hi ${firstName}, we were unable to verify your identity at this time.`)}
      ${reason ? alertBox("📋", `Reason: ${reason}`, "#ef4444") : ""}
      ${paragraph("Please ensure your documents are clear, valid, and match your account information exactly, then resubmit.")}
      ${primaryButton("Resubmit KYC", `${APP_URL}/kyc`)}
      ${divider()}
      ${smallNote(`Need help? Contact us at <a href="mailto:${SUPPORT_EMAIL}" style="color:#3b82f6;text-decoration:none;">${SUPPORT_EMAIL}</a>`)}
    `;
    await send(to, subject, baseTemplate(subject, body));
  },

  // Generic referral commission (backward compat — prefer sendReferralReward)
  async sendReferralCommission(to: string, name: string, referredName: string, commission: number): Promise<void> {
    return EmailService.sendReferralReward(to, name, referredName, commission, 1);
  },

  // Investment matured (backward compat — prefer sendInvestmentCompleted)
  async sendInvestmentMatured(to: string, name: string, planName: string, totalEarned: number): Promise<void> {
    return EmailService.sendInvestmentCompleted(to, name, planName, 0, totalEarned, totalEarned);
  },

  // Generic security alert
  async sendSecurityAlert(to: string, name: string, event: "password_changed" | "email_changed" | "new_login", detail?: string): Promise<void> {
    if (event === "password_changed") {
      return EmailService.sendPasswordChanged(to, name, new Date().toUTCString());
    }
    if (event === "new_login") {
      return EmailService.sendNewLogin(to, name, { ip: detail });
    }
    // email_changed — generic security alert
    const subject = `Security alert: Email address changed — Wexora Global`;
    const firstName = name.split(" ")[0];
    const body = `
      ${h1("⚠️ Email Address Changed")}
      ${subtitle(`Hi ${firstName}, the email address on your account was recently changed.`)}
      ${alertBox("🔒", "If this was you, no action is needed. If you didn't make this change, please secure your account immediately and contact support.", "#f59e0b")}
      ${primaryButton("Secure My Account", `${APP_URL}/security`)}
    `;
    await send(to, subject, baseTemplate(subject, body));
  },
};
