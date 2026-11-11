import type { Step } from '@/components/shared/step-indicator';

function buildSteps(
  labels: { key: string; label: string }[],
  completedThrough: number,
  activeIndex: number,
): Step[] {
  return labels.map((s, i) => ({
    key: s.key,
    label: s.label,
    state: i <= completedThrough ? 'completed' : i === activeIndex ? 'active' : 'pending',
  }));
}

const QUOTE_STEPS = [
  { key: 'draft', label: 'Draft' },
  { key: 'sent', label: 'Sent' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'converted', label: 'Converted' },
];

export function quoteSteps(status: string): Step[] {
  switch (status) {
    case 'DRAFT':
      return buildSteps(QUOTE_STEPS, -1, 0);
    case 'SENT':
      return buildSteps(QUOTE_STEPS, 0, 1);
    case 'ACCEPTED':
      return buildSteps(QUOTE_STEPS, 1, 2);
    case 'CONVERTED':
      return buildSteps(QUOTE_STEPS, 3, -1);
    case 'REJECTED':
    case 'EXPIRED':
      // Frozen at Sent-completed — REJECTED/EXPIRED can only occur after SENT.
      // A separate red pill (rejectReason callout) already communicates the terminal state.
      return buildSteps(QUOTE_STEPS, 1, -1);
    default:
      return buildSteps(QUOTE_STEPS, -1, 0);
  }
}

const ORDER_STEPS = [
  { key: 'draft', label: 'Draft' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'invoiced', label: 'Invoiced' },
  { key: 'closed', label: 'Closed' },
];

export function orderSteps(status: string, hasDeliveries: boolean): Step[] {
  switch (status) {
    case 'DRAFT':
      return buildSteps(ORDER_STEPS, -1, 0);
    case 'CONFIRMED':
      return buildSteps(ORDER_STEPS, 0, 1);
    case 'PARTIALLY_DELIVERED':
      return buildSteps(ORDER_STEPS, 1, 2);
    case 'DELIVERED':
      return buildSteps(ORDER_STEPS, 2, 3);
    case 'INVOICED':
      return buildSteps(ORDER_STEPS, 3, 4);
    case 'CLOSED':
      return buildSteps(ORDER_STEPS, 4, -1);
    case 'CANCELED':
      // Frozen — cancelReason callout communicates the terminal state.
      return buildSteps(ORDER_STEPS, hasDeliveries ? 2 : 1, -1);
    default:
      return buildSteps(ORDER_STEPS, -1, 0);
  }
}

const INVOICE_STEPS = [
  { key: 'draft', label: 'Draft' },
  { key: 'issued', label: 'Issued' },
  { key: 'paid', label: 'Paid' },
];

export function invoiceSteps(status: string): Step[] {
  switch (status) {
    case 'DRAFT':
      return buildSteps(INVOICE_STEPS, -1, 0);
    case 'ISSUED':
      return buildSteps(INVOICE_STEPS, 0, 1);
    case 'PARTIALLY_PAID':
    case 'OVERDUE':
      return buildSteps(INVOICE_STEPS, 1, 2);
    case 'PAID':
      return buildSteps(INVOICE_STEPS, 2, -1);
    case 'VOIDED':
      // Frozen at Issued-completed — voiding can only occur after issuance.
      return buildSteps(INVOICE_STEPS, 1, -1);
    default:
      return buildSteps(INVOICE_STEPS, -1, 0);
  }
}
