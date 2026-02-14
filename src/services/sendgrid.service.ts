import sgMail from '@sendgrid/mail';
import { env } from '../config/env';

if (env.SENDGRID_API_KEY) {
  sgMail.setApiKey(env.SENDGRID_API_KEY);
}

export async function sendPokeEmail(params: {
  to: string;
  toName: string;
  fromName: string;
  fromEmail: string;
  subjectContext: string;
}): Promise<void> {
  if (!env.SENDGRID_API_KEY) {
    console.log(`[SendGrid] (dev) Poke email to ${params.to} from ${params.fromName} about "${params.subjectContext}"`);
    return;
  }

  await sgMail.send({
    to: params.to,
    from: { email: env.SENDGRID_FROM_EMAIL, name: env.SENDGRID_FROM_NAME },
    replyTo: params.fromEmail,
    subject: `${params.fromName} is interested in connecting — ${params.subjectContext}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1d4479 0%, #3b6fa6 100%); padding: 24px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 28px;">Match<span style="color: #a8cbf5;">DB</span></h1>
        </div>
        <div style="padding: 32px 24px; background: #ffffff;">
          <h2 style="color: #1d4479; margin-top: 0;">You've been poked! 👋</h2>
          <p style="color: #444; line-height: 1.6;">
            Hi <strong>${params.toName}</strong>,
          </p>
          <p style="color: #444; line-height: 1.6;">
            <strong>${params.fromName}</strong> is interested in connecting with you
            regarding <strong>${params.subjectContext}</strong>.
          </p>
          <div style="background: #f0f4f8; border-left: 4px solid #3b6fa6; padding: 16px; margin: 24px 0;">
            <p style="margin: 0; color: #333;">
              Reply to this email or log in to MatchDB to respond.
            </p>
          </div>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}"
               style="background: #3b6fa6; color: #fff; padding: 12px 32px; text-decoration: none; border-radius: 4px; font-weight: bold;">
              View on MatchDB
            </a>
          </div>
          <p style="color: #888; font-size: 12px;">
            You received this because your profile is visible on MatchDB.
            <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/settings" style="color: #3b6fa6;">Manage notifications</a>
          </p>
        </div>
      </div>
    `,
  });
}
