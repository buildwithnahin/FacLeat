import Link from 'next/link';
import { AlertBanner } from '@/components/shared/alert-banner';
import type { EntityApprovalRequest } from '@/lib/approval-status';

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pending approval',
  CHANGES_REQUESTED: 'Changes requested',
  ESCALATED: 'Escalated for approval',
};

export function ApprovalStatusBanner({ request }: { request: EntityApprovalRequest | null }) {
  if (!request) return null;

  return (
    <AlertBanner tone="warning" title={STATUS_LABEL[request.status] ?? request.status}>
      <Link href={`/approvals/${request.id}`} className="text-blue-700 hover:underline font-medium">
        View approval request →
      </Link>
    </AlertBanner>
  );
}
