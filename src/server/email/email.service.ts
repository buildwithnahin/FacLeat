import 'server-only';
import { emailConfig, getResendClient } from './client';
import { notificationTemplate, type NotificationTemplateInput } from './templates';

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  text: string;
  html: string;
}

async function send(input: SendEmailInput) {
  const resend = getResendClient();
  if (!resend) return { skipped: true };

  await resend.emails.send({
    from: emailConfig.from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    replyTo: emailConfig.replyTo,
  });
  return { skipped: false };
}

export const emailService = {
  send,

  async sendNotificationEmail(
    recipientEmail: string | null | undefined,
    input: NotificationTemplateInput,
  ) {
    if (!recipientEmail) return { skipped: true };
    const template = notificationTemplate(input);
    return send({ to: recipientEmail, ...template });
  },

  async sendApprovalAlert(to: string | string[], input: NotificationTemplateInput) {
    const template = notificationTemplate({ ...input, module: 'approvals' });
    return send({ to, ...template });
  },

  async sendDuePaymentAlert(to: string | string[], input: NotificationTemplateInput) {
    const template = notificationTemplate({ ...input, module: 'payments' });
    return send({ to, ...template });
  },

  async sendPayrollAlert(to: string | string[], input: NotificationTemplateInput) {
    const template = notificationTemplate({ ...input, module: 'hr' });
    return send({ to, ...template });
  },
};
