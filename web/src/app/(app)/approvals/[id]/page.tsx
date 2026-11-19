import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink, User } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pill } from '@/components/shared/pill';
import { getSession } from '@/server/auth/session';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import { APPROVAL_STATUS } from '@/server/validators/approvals';
import { ApprovalDecisionPanel } from './decision-panel';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Approval request' };

type PillTone = 'grey' | 'blue' | 'amber' | 'green' | 'red' | 'orange';
const TONE: Record<(typeof APPROVAL_STATUS)[number], PillTone> = {
  PENDING: 'amber',
  APPROVED: 'green',
  REJECTED: 'red',
  CANCELLED: 'grey',
  CHANGES_REQUESTED: 'orange',
  ESCALATED: 'red',
};

const STEP_TONE: Record<string, PillTone> = {
  WAITING: 'grey',
  ACTIVE: 'amber',
  APPROVED: 'green',
  REJECTED: 'red',
  SKIPPED: 'grey',
  CHANGES_REQUESTED: 'orange',
};

function getEntityUrl(entityType: string, entityId: string): string | null {
  switch (entityType) {
    case 'PurchaseRequisition':
      return `/purchase/requisitions/${entityId}`;
    case 'PurchaseOrder':
      return `/purchase/orders/${entityId}`;
    case 'PurchaseInvoice':
      return `/purchase/invoices/${entityId}`;
    case 'EmployeeTransfer':
      return `/hr/transfers`;
    case 'DamageReport':
      return `/warehouse/faulty/${entityId}`;
    case 'ProductionPlan':
      return `/factory/planning`;
    case 'RecruitmentRequest':
      return `/hr/recruitment`;
    case 'LeaveApplication':
      return `/hr/leave-approval`;
    default:
      return null;
  }
}

interface ApprovalStep {
  id: string;
  sequence: number;
  approverRole: string;
  status: string;
  decidedAt: string | null;
  note?: string | null;
}

interface ApprovalDetail {
  id: string;
  title: string;
  module: string;
  action: string;
  status: (typeof APPROVAL_STATUS)[number];
  amount: string | null;
  currency: string | null;
  createdAt: string;
  decidedAt: string | null;
  entityType: string;
  entityId: string;
  summary: string | null;
  note?: string | null;
  requestedById: string;
  requestedBy?: { id: string; name: string; email: string } | null;
  rule: { id: string; name: string } | null;
  steps: ApprovalStep[];
}

export default async function ApprovalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  let req: ApprovalDetail;
  try {
    req = await backendFetch<ApprovalDetail>(`/api/mobile/approvals/${id}`);
  } catch (e) {
    if (e instanceof BackendApiError && e.status === 404) notFound();
    throw e;
  }

  // A CHANGES_REQUESTED request has no ACTIVE step (see approval.service.ts's
  // decide()) — fall back to the CHANGES_REQUESTED step so the same approver can
  // still see the decide controls once the submitter has addressed the feedback.
  const active =
    req.steps.find((s) => s.status === 'ACTIVE') ??
    (req.status === 'CHANGES_REQUESTED'
      ? req.steps.find((s) => s.status === 'CHANGES_REQUESTED')
      : undefined);
  const isSuperAdmin =
    session?.roles.some((r) => r.toLowerCase().includes('super admin')) ?? false;
  const canDecide =
    !!active && !!session && (session.roles.includes(active.approverRole) || isSuperAdmin);
  const canCancel =
    !!session &&
    session.userId === req.requestedById &&
    (req.status === 'PENDING' || req.status === 'CHANGES_REQUESTED');
  const entityUrl = getEntityUrl(req.entityType, req.entityId);

  return (
    <div className="space-y-6">
      <PageHeader title={req.title} description={`${req.module}:${req.action}`}>
        <Button variant="outline" asChild>
          <Link href="/approvals">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
        {entityUrl && (
          <Button variant="outline" asChild>
            <Link href={entityUrl} target="_blank">
              <ExternalLink className="h-4 w-4" /> View {req.entityType}
            </Link>
          </Button>
        )}
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
        <div className="space-y-6">
          <Card className="p-6 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground text-xs">Status</div>
              <div className="mt-1">
                <Pill tone={TONE[req.status]}>{req.status.replace('_', ' ').toLowerCase()}</Pill>
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Amount</div>
              <div className="tabular mt-1 font-medium">
                {req.amount ? `${req.currency ?? ''} ${req.amount}` : '—'}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Submitted</div>
              <div className="tabular mt-1">{new Date(req.createdAt).toISOString().slice(0, 10)}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Requested By</div>
              <div className="mt-1 font-medium flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{req.requestedBy?.name ?? req.requestedById.slice(0, 8)}</span>
              </div>
              {req.requestedBy?.email && (
                <div className="text-xs text-muted-foreground">{req.requestedBy.email}</div>
              )}
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Entity</div>
              <div className="mt-1">
                {entityUrl ? (
                  <Link
                    href={entityUrl}
                    target="_blank"
                    className="tabular text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
                  >
                    {req.entityType} #{req.entityId.slice(0, 8)}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                ) : (
                  <span className="tabular text-xs">
                    {req.entityType} #{req.entityId.slice(0, 8)}
                  </span>
                )}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Rule</div>
              <div className="mt-1">{req.rule?.name ?? '—'}</div>
            </div>
            {req.decidedAt && (
              <div>
                <div className="text-muted-foreground text-xs">Decided</div>
                <div className="tabular mt-1">
                  {new Date(req.decidedAt).toISOString().slice(0, 10)}
                </div>
              </div>
            )}
            {req.note && (
              <div className="md:col-span-3 pt-3 border-t text-sm">
                <span className="text-xs text-muted-foreground block font-medium">Latest decision note:</span>
                <span className="text-foreground">{req.note}</span>
              </div>
            )}
            {req.summary && (
              <div className="md:col-span-3 pt-3 border-t text-muted-foreground text-xs">{req.summary}</div>
            )}
          </Card>

          <Card className="p-4">
            <div className="text-sm font-medium mb-3">Approval chain</div>
            <ol className="space-y-3">
              {req.steps.map((s) => (
                <li key={s.id} className="text-sm border-b last:border-0 pb-2.5 last:pb-0">
                  <div className="flex items-center gap-3">
                    <span className="tabular text-xs text-muted-foreground w-6">
                      #{s.sequence}
                    </span>
                    <span className="flex-1 font-medium">{s.approverRole}</span>
                    <Pill tone={STEP_TONE[s.status] ?? 'grey'}>
                      {s.status.replace('_', ' ').toLowerCase()}
                    </Pill>
                    {s.decidedAt && (
                      <span className="text-xs text-muted-foreground tabular">
                        {new Date(s.decidedAt).toISOString().slice(0, 10)}
                      </span>
                    )}
                  </div>
                  {s.note && (
                    <p className="text-xs text-muted-foreground ml-9 mt-1 bg-muted/40 p-1.5 rounded">
                      <span className="font-semibold text-foreground/80">Note: </span>
                      {s.note}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <ApprovalDecisionPanel
          requestId={req.id}
          canDecide={canDecide}
          canCancel={canCancel}
          activeRole={active?.approverRole ?? null}
        />
      </div>
    </div>
  );
}
