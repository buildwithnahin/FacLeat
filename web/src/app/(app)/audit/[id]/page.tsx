import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  ExternalLink,
  ShieldCheck,
  Globe,
  Monitor,
  User,
  Building2,
  Calendar,
  Layers,
  Activity,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pill } from '@/components/shared/pill';
import { PrintButton } from '@/components/shared/print-button';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import { AuditDiffViewer } from './audit-diff-viewer';
import { getActionTone, getModuleTone, getEntityUrl } from '../audit-utils';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Audit Entry Details' };

interface AuditEntry {
  id: string;
  createdAt: string;
  module: string;
  action: string;
  actor: { id: string; name: string | null; email: string | null } | null;
  branch: { id: string; name: string; code: string } | null;
  entityType: string;
  entityId: string | null;
  ip: string | null;
  userAgent: string | null;
  before: unknown;
  after: unknown;
}

export default async function AuditDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let entry: AuditEntry;
  try {
    entry = await backendFetch<AuditEntry>(`/api/mobile/audit/${id}`);
  } catch (err) {
    if (err instanceof BackendApiError && err.status === 404) notFound();
    throw err;
  }

  const createdDate = new Date(entry.createdAt);
  const formattedUtc = !isNaN(createdDate.getTime())
    ? createdDate.toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
    : '—';

  const targetUrl = getEntityUrl(entry.entityType, entry.entityId);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title="Audit Trail Entry"
          description={`Log ID: ${entry.id}`}
        >
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/audit" className="flex items-center gap-1.5">
                <ArrowLeft className="h-4 w-4" /> Back to Log
              </Link>
            </Button>
            <PrintButton label="Print Entry" className="px-3 py-1.5 bg-background border hover:bg-muted text-xs font-medium rounded-md flex items-center gap-1 shadow-sm transition-colors" />
          </div>
        </PageHeader>
      </div>

      {/* Record Overview Card */}
      <Card className="p-6 divide-y divide-border">
        {/* Top Badges & Actions */}
        <div className="pb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Pill tone={getModuleTone(entry.module)} className="font-semibold text-xs px-3 py-1">
              {entry.module}
            </Pill>
            <Pill tone={getActionTone(entry.action)} className="font-semibold text-xs px-3 py-1">
              {entry.action}
            </Pill>
          </div>
          {targetUrl && (
            <Button size="sm" variant="outline" className="text-xs flex items-center gap-1.5" asChild>
              <Link href={targetUrl}>
                <span>View Live Record ({entry.entityType})</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
            </Button>
          )}
        </div>

        {/* Core Attributes Grid */}
        <div className="py-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div>
            <div className="text-muted-foreground flex items-center gap-1 mb-1">
              <Calendar className="h-3.5 w-3.5" /> Event Timestamp
            </div>
            <div className="font-medium text-foreground text-sm tabular">{formattedUtc}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {createdDate.toLocaleString()} (Local)
            </div>
          </div>

          <div>
            <div className="text-muted-foreground flex items-center gap-1 mb-1">
              <User className="h-3.5 w-3.5" /> Responsible Actor
            </div>
            <div className="font-medium text-foreground text-sm">
              {entry.actor?.name ?? <span className="italic text-muted-foreground">Automated System</span>}
            </div>
            {entry.actor?.email && (
              <div className="text-[11px] text-muted-foreground truncate">{entry.actor.email}</div>
            )}
          </div>

          <div>
            <div className="text-muted-foreground flex items-center gap-1 mb-1">
              <Building2 className="h-3.5 w-3.5" /> Scope / Branch
            </div>
            <div className="font-medium text-foreground text-sm">
              {entry.branch?.name ?? 'System-wide'}
            </div>
            {entry.branch?.code && (
              <div className="text-[11px] text-muted-foreground">Code: {entry.branch.code}</div>
            )}
          </div>

          <div>
            <div className="text-muted-foreground flex items-center gap-1 mb-1">
              <Layers className="h-3.5 w-3.5" /> Affected Entity
            </div>
            <div className="font-medium text-foreground text-sm">
              {entry.entityType}
            </div>
            {entry.entityId ? (
              <div className="font-mono text-[11px] text-muted-foreground truncate">
                #{entry.entityId}
              </div>
            ) : (
              <div className="text-[11px] text-muted-foreground italic">No specific ID</div>
            )}
          </div>
        </div>

        {/* Network & Device Info */}
        <div className="pt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <div className="text-muted-foreground flex items-center gap-1 mb-1">
              <Globe className="h-3.5 w-3.5" /> Client IP Address
            </div>
            <div className="font-mono text-xs text-foreground bg-muted/40 px-2.5 py-1.5 rounded inline-block">
              {entry.ip || 'Internal / Proxy'}
            </div>
          </div>

          <div className="md:col-span-2">
            <div className="text-muted-foreground flex items-center gap-1 mb-1">
              <Monitor className="h-3.5 w-3.5" /> User Agent &amp; Environment
            </div>
            <div className="text-xs text-muted-foreground font-mono bg-muted/30 px-2.5 py-1.5 rounded break-all">
              {entry.userAgent || 'Direct Server Action / API Client'}
            </div>
          </div>
        </div>
      </Card>

      {/* Visual State Diff & Payload Inspection */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">State Delta &amp; Mutation Payload</h2>
        </div>
        <AuditDiffViewer before={entry.before} after={entry.after} />
      </div>

      {/* Compliance & Immutable Ledger Proof */}
      <Card className="p-4 bg-muted/20 border-dashed border-border flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
        <div className="text-xs text-muted-foreground space-y-1">
          <p className="font-semibold text-foreground">Immutable Ledger Verification</p>
          <p>
            This audit record was written at the exact execution time of the transaction.
            It cannot be modified, updated, or purged by any system user or administrator, ensuring strict compliance
            with financial, inventory, and enterprise operational governance.
          </p>
        </div>
      </Card>
    </div>
  );
}
