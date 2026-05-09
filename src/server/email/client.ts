import 'server-only';
import { Resend } from 'resend';

export const emailConfig = {
  enabled: process.env.EMAIL_NOTIFICATIONS_ENABLED === 'true',
  from: process.env.EMAIL_FROM ?? 'Annex ERP <notifications@annex.local>',
  replyTo: process.env.EMAIL_REPLY_TO,
};

export function getResendClient() {
  if (!emailConfig.enabled || !process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
}
