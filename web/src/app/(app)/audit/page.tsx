import Link from 'next/link';
import {
  RotateCcw,
  Shield,
  Clock,
  AlertTriangle,
  Layers,
  ExternalLink,
  Eye,
  Calendar,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/shared/data-table';
import { Pill, PillTone } from '@/components/shared/pill';
import { KpiCard } from '@/components/shared/kpi-card';
import { backendFetch } from '@/lib/backend-client';
import { AuditExportButton } from './audit-export-button';
import { getActionTone, getModuleTone, getEntityUrl } from './audit-utils';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Audit log' };

interface Search {
  branchId?: string;
  module?: string;
  action?: string;
  search?: string;
  from?: string;
  to?: string;
  page?: string;
}

interface BranchDto {
  id: string;
  code: string;
  name: string;
}

interface AuditRow {
  id: string;
  createdAt: string;
  actor: { name: string | null; email: string | null } | null;
  module: string;
  action: string;
  entityType: string;
  entityId: string | null;
  branch: { name: string } | null;
}

interface AuditStats {
  total: number;
  todayCount: number;
  criticalCount: number;
}

const PAGE_SIZE = 50;

function formatDatePresets() {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().slice(0, 10);

  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstDayOfMonthStr = firstDayOfMonth.toISOString().slice(0, 10);

  return {
    today: { from: todayStr, to: todayStr },
    yesterday: { from: yesterdayStr, to: yesterdayStr },
    last7Days: { from: sevenDaysAgoStr, to: todayStr },
    thisMonth: { from: firstDayOfMonthStr, to: todayStr },
  };
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? '1'));

  const listParams = new URLSearchParams({
    limit: String(PAGE_SIZE),
    offset: String((page - 1) * PAGE_SIZE),
  });
  if (sp.branchId && sp.branchId !== 'ALL') listParams.set('branchId', sp.branchId);
  if (sp.module && sp.module !== 'ALL') listParams.set('module', sp.module);
  if (sp.action && sp.action !== 'ALL') listParams.set('action', sp.action);
  if (sp.search) listParams.set('search', sp.search);
  if (sp.from) {
    const fromDate = new Date(sp.from);
    if (!isNaN(fromDate.getTime())) listParams.set('from', fromDate.toISOString());
  }
  if (sp.to) {
    const toDate = new Date(`${sp.to}T23:59:59`);
    if (!isNaN(toDate.getTime())) listParams.set('to', toDate.toISOString());
  }

  const [{ rows, total }, modules, actions, branches, stats] = await Promise.all([
    backendFetch<{ rows: AuditRow[]; total: number }>(`/api/mobile/audit?${listParams.toString()}`).catch(() => ({ rows: [], total: 0 })),
    backendFetch<string[]>('/api/mobile/audit/modules').catch(() => []),
    backendFetch<string[]>('/api/mobile/audit/actions').catch(() => []),
    backendFetch<BranchDto[]>('/api/mobile/branches').catch(() => []),
    backendFetch<AuditStats>(`/api/mobile/audit/stats${sp.branchId && sp.branchId !== 'ALL' ? `?branchId=${sp.branchId}` : ''}`).catch(() => ({
      total: 0,
      todayCount: 0,
      criticalCount: 0,
    })),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(sp.search || (sp.module && sp.module !== 'ALL') || (sp.action && sp.action !== 'ALL') || sp.branchId || sp.from || sp.to);
  const presets = formatDatePresets();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title="Audit Trail & System Log"
          description={`${(stats.total || total).toLocaleString()} immutable events recorded across all system modules`}
        />
        <div className="flex items-center gap-2">
          <AuditExportButton rows={rows} />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Records"
          value={(stats.total || total).toLocaleString()}
          icon={Shield}
          description="Immutable ledger entries"
        />
        <KpiCard
          label="Today's Activity"
          value={stats.todayCount.toLocaleString()}
          icon={Clock}
          tone={stats.todayCount > 0 ? 'primary' : 'default'}
          description="Logged since 00:00 UTC"
        />
        <KpiCard
          label="Critical Operations"
          value={stats.criticalCount.toLocaleString()}
          icon={AlertTriangle}
          tone={stats.criticalCount > 0 ? 'warning' : 'default'}
          description="Deletes, rejects, voids"
        />
        <KpiCard
          label="Active Modules"
          value={modules.length}
          icon={Layers}
          description="Subsystems under monitoring"
        />
      </div>

      {/* Quick Date Presets */}
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <span className="text-muted-foreground flex items-center gap-1 font-medium">
          <Calendar className="h-3.5 w-3.5" /> Quick dates:
        </span>
        <Button
          variant={!sp.from && !sp.to ? 'secondary' : 'outline'}
          size="sm"
          className="h-7 text-xs"
          asChild
        >
          <Link href={`/audit?${new URLSearchParams({ ...sp, from: '', to: '', page: '1' }).toString()}`}>
            All Time
          </Link>
        </Button>
        <Button
          variant={sp.from === presets.today.from && sp.to === presets.today.to ? 'secondary' : 'outline'}
          size="sm"
          className="h-7 text-xs"
          asChild
        >
          <Link href={`/audit?${new URLSearchParams({ ...sp, ...presets.today, page: '1' }).toString()}`}>
            Today
          </Link>
        </Button>
        <Button
          variant={sp.from === presets.yesterday.from && sp.to === presets.yesterday.to ? 'secondary' : 'outline'}
          size="sm"
          className="h-7 text-xs"
          asChild
        >
          <Link href={`/audit?${new URLSearchParams({ ...sp, ...presets.yesterday, page: '1' }).toString()}`}>
            Yesterday
          </Link>
        </Button>
        <Button
          variant={sp.from === presets.last7Days.from && sp.to === presets.last7Days.to ? 'secondary' : 'outline'}
          size="sm"
          className="h-7 text-xs"
          asChild
        >
          <Link href={`/audit?${new URLSearchParams({ ...sp, ...presets.last7Days, page: '1' }).toString()}`}>
            Last 7 Days
          </Link>
        </Button>
        <Button
          variant={sp.from === presets.thisMonth.from && sp.to === presets.thisMonth.to ? 'secondary' : 'outline'}
          size="sm"
          className="h-7 text-xs"
          asChild
        >
          <Link href={`/audit?${new URLSearchParams({ ...sp, ...presets.thisMonth, page: '1' }).toString()}`}>
            This Month
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <form className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Search</label>
            <Input
              name="search"
              placeholder="Actor, entity, note…"
              defaultValue={sp.search ?? ''}
              className="h-9 text-xs"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground block mb-1">Branch</label>
            <select
              name="branchId"
              defaultValue={sp.branchId ?? ''}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code} · {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground block mb-1">Module</label>
            <select
              name="module"
              defaultValue={sp.module ?? 'ALL'}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All modules</option>
              {modules.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground block mb-1">Action</label>
            <select
              name="action"
              defaultValue={sp.action ?? 'ALL'}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All actions</option>
              {actions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground block mb-1">From Date</label>
            <Input type="date" name="from" defaultValue={sp.from ?? ''} className="h-9 text-xs" />
          </div>

          <div>
            <label className="text-xs text-muted-foreground block mb-1">To Date</label>
            <Input type="date" name="to" defaultValue={sp.to ?? ''} className="h-9 text-xs" />
          </div>

          <div className="flex items-center gap-2 lg:col-span-6 justify-end pt-2 border-t border-border">
            <Button type="submit" size="sm" className="h-8 text-xs px-4">
              Apply Filters
            </Button>
            {hasFilters && (
              <Button variant="ghost" size="sm" className="h-8 text-xs" asChild>
                <Link href="/audit">
                  <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset Filters
                </Link>
              </Button>
            )}
          </div>
        </form>
      </Card>

      {/* Main Table */}
      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b text-xs font-medium flex items-center justify-between bg-muted/20">
          <span className="text-muted-foreground">
            Showing <strong className="text-foreground">{rows.length}</strong> of{' '}
            <strong className="text-foreground">{total}</strong> entries · Page{' '}
            <strong className="text-foreground">{page}</strong> of{' '}
            <strong className="text-foreground">{totalPages}</strong>
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                <Link href={`?${new URLSearchParams({ ...sp, page: String(page - 1) }).toString()}`}>
                  Previous
                </Link>
              </Button>
            )}
            {page < totalPages && (
              <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                <Link href={`?${new URLSearchParams({ ...sp, page: String(page + 1) }).toString()}`}>
                  Next
                </Link>
              </Button>
            )}
          </div>
        </div>

        <DataTable
          rows={rows}
          rowKey={(r) => r.id}
          empty="No audit entries match the selected filters."
          columns={[
            {
              key: 'when',
              header: 'Timestamp',
              cell: (r) => {
                const d = new Date(r.createdAt);
                const iso = !isNaN(d.getTime()) ? d.toISOString().replace('T', ' ').slice(0, 19) : '—';
                return (
                  <div className="tabular text-xs">
                    <span className="font-medium text-foreground">{iso}</span>
                    <span className="block text-[10px] text-muted-foreground">UTC</span>
                  </div>
                );
              },
            },
            {
              key: 'who',
              header: 'Actor',
              cell: (r) => (
                <div>
                  <div className="text-xs font-medium text-foreground">
                    {r.actor?.name ?? r.actor?.email ?? <span className="text-muted-foreground italic">System / Automated</span>}
                  </div>
                  {r.actor?.name && r.actor?.email && (
                    <div className="text-[10px] text-muted-foreground truncate max-w-[160px]">
                      {r.actor.email}
                    </div>
                  )}
                </div>
              ),
            },
            {
              key: 'module',
              header: 'Module',
              cell: (r) => (
                <Pill tone={getModuleTone(r.module)} className="font-semibold text-[11px]">
                  {r.module}
                </Pill>
              ),
            },
            {
              key: 'action',
              header: 'Action',
              cell: (r) => (
                <Pill tone={getActionTone(r.action)} className="font-medium text-[11px]">
                  {r.action}
                </Pill>
              ),
            },
            {
              key: 'entity',
              header: 'Target Entity',
              cell: (r) => {
                const targetUrl = getEntityUrl(r.entityType, r.entityId);
                return (
                  <div className="text-xs">
                    <span className="font-medium text-foreground">{r.entityType}</span>
                    {r.entityId && (
                      <div className="mt-0.5">
                        {targetUrl ? (
                          <Link
                            href={targetUrl}
                            className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 hover:underline font-mono"
                            title="Open related record"
                          >
                            <span>#{r.entityId.slice(0, 8)}</span>
                            <ExternalLink className="h-2.5 w-2.5" />
                          </Link>
                        ) : (
                          <span className="font-mono text-[11px] text-muted-foreground">
                            #{r.entityId.slice(0, 8)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              },
            },
            {
              key: 'branch',
              header: 'Branch',
              cell: (r) => (
                <span className="text-xs text-muted-foreground">
                  {r.branch?.name ?? '—'}
                </span>
              ),
            },
            {
              key: 'view',
              header: 'Details',
              cell: (r) => (
                <Button variant="ghost" size="sm" className="h-7 text-xs px-2" asChild>
                  <Link href={`/audit/${r.id}`} className="text-blue-600 hover:text-blue-700 flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    <span>View Diff</span>
                  </Link>
                </Button>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
