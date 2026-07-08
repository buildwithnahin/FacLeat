import Link from 'next/link';
import { AlertBanner } from '@/components/shared/alert-banner';
import { approvalService } from '@/server/services/approval.service';
import type { AppSession } from '@/server/auth/session';

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pending approval',
  CHANGES_REQUESTED: 'Changes requested',
  ESCALATED: 'Escalated for approval',
};

export async function ApprovalStatusBanner({
  session,
  module,
  entityType,
  entityId,
}: {
  session: AppSession | null;
  module: string;
  entityType: string;
  entityId: string;
}) {
  if (!session?.permissions.includes('approvals:read')) return null;

  const request = await approvalService.findLatestForEntity(session, {
    module,
    entityType,
    entityId,
  });
  if (!request) return null;

  return (
    <AlertBanner tone="warning" title={STATUS_LABEL[request.status] ?? request.status}>
      <Link href={`/approvals/${request.id}`} className="text-blue-700 hover:underline font-medium">
        View approval request →
      </Link>
    </AlertBanner>
  );
}
