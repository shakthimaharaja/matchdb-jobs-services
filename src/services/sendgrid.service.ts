import sgMail from "@sendgrid/mail";
import { env } from "../config/env";

if (env.SENDGRID_API_KEY) {
  sgMail.setApiKey(env.SENDGRID_API_KEY);
}

export async function sendPokeEmail(params: {
  to: string;
  toName: string;
  fromName: string;
  fromEmail: string;
  subjectContext: string;
  emailBody?: string; // custom body from Mail Template modal
  pdfAttachment?: string; // base64-encoded PDF (candidate resume attachment)
  pdfFilename?: string;
}): Promise<void> {
  if (!env.SENDGRID_API_KEY) {
    console.log(
      `[SendGrid] (dev) Poke email to ${params.to} from ${params.fromName} about "${params.subjectContext}"`,
    );
    if (params.emailBody)
      console.log(
        `[SendGrid] Custom body preview:\n${params.emailBody.slice(0, 200)}...`,
      );
    if (params.pdfAttachment)
      console.log(
        `[SendGrid] PDF attachment included (${Math.round((params.pdfAttachment.length * 0.75) / 1024)}KB)`,
      );
    return;
  }

  const htmlContent = params.emailBody
    ? `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1d4479 0%, #3b6fa6 100%); padding: 24px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 28px;">Match<span style="color: #a8cbf5;">DB</span></h1>
        </div>
        <div style="padding: 32px 24px; background: #ffffff;">
          <pre style="font-family: Arial, sans-serif; white-space: pre-wrap; line-height: 1.7; color: #333; font-size: 14px; margin: 0;">${params.emailBody.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>
          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 24px 0;" />
          <p style="color: #888; font-size: 12px;">Sent via <a href="${process.env.CLIENT_URL || "http://localhost:3000"}" style="color: #3b6fa6;">MatchDB</a> &mdash; <a href="${process.env.CLIENT_URL || "http://localhost:3000"}/settings" style="color: #3b6fa6;">Manage notifications</a></p>
        </div>
      </div>`
    : `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1d4479 0%, #3b6fa6 100%); padding: 24px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 28px;">Match<span style="color: #a8cbf5;">DB</span></h1>
        </div>
        <div style="padding: 32px 24px; background: #ffffff;">
          <h2 style="color: #1d4479; margin-top: 0;">You've been poked! 👋</h2>
          <p style="color: #444; line-height: 1.6;">Hi <strong>${params.toName}</strong>,</p>
          <p style="color: #444; line-height: 1.6;"><strong>${params.fromName}</strong> is interested in connecting with you regarding <strong>${params.subjectContext}</strong>.</p>
          <div style="background: #f0f4f8; border-left: 4px solid #3b6fa6; padding: 16px; margin: 24px 0;">
            <p style="margin: 0; color: #333;">Reply to this email or log in to MatchDB to respond.</p>
          </div>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${process.env.CLIENT_URL || "http://localhost:3000"}" style="background: #3b6fa6; color: #fff; padding: 12px 32px; text-decoration: none; border-radius: 4px; font-weight: bold;">View on MatchDB</a>
          </div>
          <p style="color: #888; font-size: 12px;">You received this because your profile is visible on MatchDB. <a href="${process.env.CLIENT_URL || "http://localhost:3000"}/settings" style="color: #3b6fa6;">Manage notifications</a></p>
        </div>
      </div>`;

  const msg: Parameters<typeof sgMail.send>[0] = {
    to: params.to,
    from: { email: env.SENDGRID_FROM_EMAIL, name: env.SENDGRID_FROM_NAME },
    replyTo: params.fromEmail,
    subject: params.emailBody
      ? params.subjectContext
      : `${params.fromName} is interested in connecting — ${params.subjectContext}`,
    html: htmlContent,
    ...(params.pdfAttachment
      ? {
          attachments: [
            {
              content: params.pdfAttachment,
              filename: params.pdfFilename || "resume.pdf",
              type: "application/pdf",
              disposition: "attachment" as const,
            },
          ],
        }
      : {}),
  };

  await sgMail.send(msg);
}

export async function sendInterviewInviteEmail(params: {
  to: string;
  toName: string;
  fromName: string;
  fromEmail: string;
  jobTitle: string;
  meetLink: string;
  proposedAt?: string; // ISO string
  message?: string;
}): Promise<void> {
  const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
  const proposedTime = params.proposedAt
    ? new Date(params.proposedAt).toLocaleString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      })
    : "To be confirmed";

  if (!env.SENDGRID_API_KEY) {
    console.log(
      `[SendGrid] (dev) Interview invite to ${params.to} from ${params.fromName} for "${params.jobTitle}" — Meet: ${params.meetLink}`,
    );
    return;
  }

  const html = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background: linear-gradient(135deg, #1d4479 0%, #3b6fa6 100%); padding: 24px; text-align: center;">
      <h1 style="color: #fff; margin: 0; font-size: 28px;">Match<span style="color: #a8cbf5;">DB</span></h1>
    </div>
    <div style="padding: 32px 24px; background: #ffffff;">
      <h2 style="color: #1d4479; margin-top: 0;">📞 Interview Invite</h2>
      <p style="color: #444; line-height: 1.6;">Hi <strong>${params.toName}</strong>,</p>
      <p style="color: #444; line-height: 1.6;">
        <strong>${params.fromName}</strong> has invited you to a screening call for the position of
        <strong>${params.jobTitle}</strong>.
      </p>
      ${
        params.message
          ? `<div style="background: #f0f4f8; border-left: 4px solid #3b6fa6; padding: 16px; margin: 16px 0;">
        <p style="margin: 0; color: #333; white-space: pre-wrap;">${params.message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
      </div>`
          : ""
      }
      <table style="width: 100%; border-collapse: collapse; margin: 24px 0; font-size: 14px;">
        <tr>
          <td style="padding: 10px 12px; background: #f5f7fa; border: 1px solid #e0e0e0; font-weight: 700; width: 35%;">Proposed Time</td>
          <td style="padding: 10px 12px; border: 1px solid #e0e0e0;">${proposedTime}</td>
        </tr>
        <tr>
          <td style="padding: 10px 12px; background: #f5f7fa; border: 1px solid #e0e0e0; font-weight: 700;">Position</td>
          <td style="padding: 10px 12px; border: 1px solid #e0e0e0;">${params.jobTitle}</td>
        </tr>
        <tr>
          <td style="padding: 10px 12px; background: #f5f7fa; border: 1px solid #e0e0e0; font-weight: 700;">Google Meet</td>
          <td style="padding: 10px 12px; border: 1px solid #e0e0e0;"><a href="${params.meetLink}" style="color: #3b6fa6;">${params.meetLink}</a></td>
        </tr>
      </table>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${params.meetLink}" style="background: #1a73e8; color: #fff; padding: 14px 36px; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 15px;">Join Google Meet</a>
      </div>
      <p style="color: #555; font-size: 13px;">
        Please log into MatchDB to confirm or decline this invite.
      </p>
      <div style="text-align: center; margin: 16px 0;">
        <a href="${clientUrl}" style="background: #3b6fa6; color: #fff; padding: 10px 28px; text-decoration: none; border-radius: 4px; font-weight: bold;">View on MatchDB</a>
      </div>
      <p style="color: #888; font-size: 12px; margin-top: 24px;">
        You received this because your profile is visible on MatchDB.
        <a href="${clientUrl}/settings" style="color: #3b6fa6;">Manage notifications</a>
      </p>
    </div>
  </div>`;

  await sgMail.send({
    to: params.to,
    from: { email: env.SENDGRID_FROM_EMAIL, name: env.SENDGRID_FROM_NAME },
    replyTo: params.fromEmail,
    subject: `Interview Invite: ${params.jobTitle} — ${params.fromName}`,
    html,
  });
}
