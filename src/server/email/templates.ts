import 'server-only';

export interface EmailTemplate {
  subject: string;
  text: string;
  html: string;
}

export interface NotificationTemplateInput {
  module: string;
  title: string;
  body?: string | null;
  href?: string | null;
  severity?: string;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function shell(title: string, body: string, href?: string | null) {
  const cta = href
    ? `<p style="margin:20px 0 0"><a href="${escapeHtml(href)}" style="background:#111827;color:#fff;padding:10px 14px;border-radius:6px;text-decoration:none">Open in ERP</a></p>`
    : '';
  return `
    <div style="font-family:Arial,sans-serif;color:#111827;line-height:1.5">
      <h2 style="margin:0 0 12px;font-size:18px">${escapeHtml(title)}</h2>
      <div style="font-size:14px">${body}</div>
      ${cta}
      <p style="margin-top:24px;color:#6b7280;font-size:12px">Annex Leather ERP</p>
    </div>
  `;
}

export function approvalAlertTemplate(input: NotificationTemplateInput): EmailTemplate {
  const body = input.body ?? 'An approval request is waiting for your decision.';
  return {
    subject: input.title,
    text: `${input.title}\n\n${body}${input.href ? `\n\nOpen: ${input.href}` : ''}`,
    html: shell(input.title, `<p>${escapeHtml(body)}</p>`, input.href),
  };
}

export function duePaymentTemplate(input: NotificationTemplateInput): EmailTemplate {
  const body = input.body ?? 'A payment is due or overdue.';
  return {
    subject: input.title,
    text: `${input.title}\n\n${body}${input.href ? `\n\nOpen: ${input.href}` : ''}`,
    html: shell(input.title, `<p>${escapeHtml(body)}</p>`, input.href),
  };
}

export function payrollTemplate(input: NotificationTemplateInput): EmailTemplate {
  const body = input.body ?? 'A payroll workflow needs attention.';
  return {
    subject: input.title,
    text: `${input.title}\n\n${body}${input.href ? `\n\nOpen: ${input.href}` : ''}`,
    html: shell(input.title, `<p>${escapeHtml(body)}</p>`, input.href),
  };
}

export function stockAlertTemplate(input: NotificationTemplateInput): EmailTemplate {
  const body = input.body ?? 'A stock threshold needs attention.';
  return {
    subject: input.title,
    text: `${input.title}\n\n${body}${input.href ? `\n\nOpen: ${input.href}` : ''}`,
    html: shell(input.title, `<p>${escapeHtml(body)}</p>`, input.href),
  };
}

export function notificationTemplate(input: NotificationTemplateInput): EmailTemplate {
  if (input.module === 'approvals') return approvalAlertTemplate(input);
  if (input.module === 'payments' || input.title.toLowerCase().includes('due')) {
    return duePaymentTemplate(input);
  }
  if (input.module === 'hr' || input.title.toLowerCase().includes('payroll')) {
    return payrollTemplate(input);
  }
  if (input.module === 'inventory' || input.title.toLowerCase().includes('stock')) {
    return stockAlertTemplate(input);
  }
  const body = input.body ?? 'You have a new ERP notification.';
  return {
    subject: input.title,
    text: `${input.title}\n\n${body}${input.href ? `\n\nOpen: ${input.href}` : ''}`,
    html: shell(input.title, `<p>${escapeHtml(body)}</p>`, input.href),
  };
}
