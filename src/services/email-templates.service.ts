/**
 * email-templates.service.ts
 *
 * HTML email templates for the Company Admin & Candidate Invitation system.
 * Uses the same SendGrid pattern as the existing sendgrid.service.ts in shell.
 */
import sgMail from "@sendgrid/mail";
import { env } from "../config/env";

if (env.SENDGRID_API_KEY) {
  sgMail.setApiKey(env.SENDGRID_API_KEY);
}

// ─── Shared Styles ────────────────────────────────────────────────────────────

const WRAPPER = `font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;`;
const HEADER = `background: linear-gradient(135deg, #1d4479 0%, #3b6fa6 100%); padding: 24px; text-align: center;`;
const LOGO = `color: #fff; margin: 0; font-size: 28px;`;
const BODY = `padding: 32px 24px; background: #ffffff;`;
const CTA = `display: inline-block; background: #3b6fa6; color: #fff; padding: 14px 36px; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 14px;`;
const FOOTER = `color: #888; font-size: 12px; margin-top: 24px;`;

function wrapEmail(content: string): string {
  return `
    <div style="${WRAPPER}">
      <div style="${HEADER}">
        <h1 style="${LOGO}">Match<span style="color: #a8cbf5;">DB</span></h1>
      </div>
      <div style="${BODY}">
        ${content}
      </div>
    </div>`;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

async function send(to: string, subject: string, html: string): Promise<void> {
  if (!env.SENDGRID_API_KEY) {
    console.log(`[SendGrid] (dev) ${subject} → ${to}`);
    return;
  }
  await sgMail.send({
    to,
    from: { email: env.SENDGRID_FROM_EMAIL, name: env.SENDGRID_FROM_NAME },
    subject,
    html,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMPLOYEE INVITATION
// ═══════════════════════════════════════════════════════════════════════════════

interface EmployeeInviteEmailParams {
  to: string;
  inviteeName: string;
  companyName: string;
  adminName: string;
  role: string;
  registerUrl: string;
}

export async function sendEmployeeInviteEmail(
  p: EmployeeInviteEmailParams,
): Promise<void> {
  const html = wrapEmail(`
    <h2 style="color: #1d4479; margin-top: 0;">You're Invited!</h2>
    <p style="color: #444; line-height: 1.6;">
      Hi${p.inviteeName ? ` ${p.inviteeName}` : ""},
    </p>
    <p style="color: #444; line-height: 1.6;">
      <strong>${p.adminName}</strong> from <strong>${p.companyName}</strong> has invited you to join
      MatchDB as a team member with the <strong>${p.role}</strong> role.
    </p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${p.registerUrl}" style="${CTA}">Accept Invitation</a>
    </div>
    <p style="color: #c00; font-size: 13px; line-height: 1.5;">
      ⏱ This link expires in <strong>48 hours</strong> and can only be used once.
    </p>
    <p style="${FOOTER}">
      If you did not expect this invitation, you can safely ignore this email.
    </p>
  `);

  await send(p.to, `${p.companyName} — You're invited to MatchDB`, html);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CANDIDATE INVITATION
// ═══════════════════════════════════════════════════════════════════════════════

interface CandidateInviteEmailParams {
  to: string;
  candidateName: string;
  companyName: string;
  inviterName: string;
  planName: string;
  personalNote: string;
  registerUrl: string;
}

export async function sendCandidateInviteEmail(
  p: CandidateInviteEmailParams,
): Promise<void> {
  const noteBlock = p.personalNote
    ? `<div style="background: #f5f7fa; border-left: 3px solid #3b6fa6; padding: 12px 16px; margin: 16px 0; font-size: 13px; color: #555;">
         "${p.personalNote}"<br/>— ${p.inviterName}
       </div>`
    : "";

  const html = wrapEmail(`
    <h2 style="color: #1d4479; margin-top: 0;">You're Invited!</h2>
    <p style="color: #444; line-height: 1.6;">
      Hi${p.candidateName ? ` ${p.candidateName}` : ""},
    </p>
    <p style="color: #444; line-height: 1.6;">
      <strong>${p.companyName}</strong> has invited you to join
      <strong>MatchDB</strong> as a candidate.
    </p>
    ${noteBlock}
    <div style="background: #f9f9f9; border: 1px solid #e0e0e0; border-radius: 6px; padding: 16px; margin: 20px 0; font-size: 13px;">
      <strong>Your Plan:</strong> ${p.planName}<br/>
      <strong>Invited by:</strong> ${p.companyName}
    </div>
    <p style="color: #444; line-height: 1.6;">
      Click below to create your account and get started:
    </p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${p.registerUrl}" style="${CTA}">Accept Invitation</a>
    </div>
    <p style="color: #c00; font-size: 13px; line-height: 1.5;">
      ⏱ This link expires in <strong>72 hours</strong> and can only be used once.
    </p>
    <p style="${FOOTER}">
      If you did not expect this invitation, you can safely ignore this email.
    </p>
  `);

  await send(p.to, `${p.companyName} — Candidate Invitation to MatchDB`, html);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CANDIDATE PAYMENT SUCCESS / WELCOME
// ═══════════════════════════════════════════════════════════════════════════════

interface CandidateWelcomeEmailParams {
  to: string;
  candidateName: string;
  companyName: string;
  planName: string;
  dashboardUrl: string;
}

export async function sendCandidateWelcomeEmail(
  p: CandidateWelcomeEmailParams,
): Promise<void> {
  const html = wrapEmail(`
    <h2 style="color: #2e7d32; margin-top: 0;">🎉 Welcome to MatchDB!</h2>
    <p style="color: #444; line-height: 1.6;">
      Hi ${p.candidateName},
    </p>
    <p style="color: #444; line-height: 1.6;">
      Your payment has been received and your account is now <strong>active</strong>.
      You're all set to start using MatchDB under <strong>${p.companyName}</strong>.
    </p>
    <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 6px; padding: 16px; margin: 20px 0; font-size: 13px;">
      <strong>Plan:</strong> ${p.planName}<br/>
      <strong>Status:</strong> ✅ Active<br/>
      <strong>Company:</strong> ${p.companyName}
    </div>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${p.dashboardUrl}" style="${CTA}">Go to Dashboard</a>
    </div>
    <p style="${FOOTER}">
      If you have questions, contact your company administrator.
    </p>
  `);

  await send(p.to, "Welcome to MatchDB — Your Account is Active!", html);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CANDIDATE PAYMENT FAILED
// ═══════════════════════════════════════════════════════════════════════════════

interface CandidatePaymentFailedEmailParams {
  to: string;
  candidateName: string;
  retryUrl: string;
}

export async function sendCandidatePaymentFailedEmail(
  p: CandidatePaymentFailedEmailParams,
): Promise<void> {
  const html = wrapEmail(`
    <h2 style="color: #c62828; margin-top: 0;">Payment Failed</h2>
    <p style="color: #444; line-height: 1.6;">
      Hi ${p.candidateName},
    </p>
    <p style="color: #444; line-height: 1.6;">
      We were unable to process your payment. Your account is on hold until payment
      is completed.
    </p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${p.retryUrl}" style="display: inline-block; background: #c62828; color: #fff; padding: 14px 36px; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 14px;">
        Retry Payment
      </a>
    </div>
    <p style="${FOOTER}">
      If you believe this is an error, please contact your company administrator.
    </p>
  `);

  await send(p.to, "MatchDB — Payment Failed", html);
}
