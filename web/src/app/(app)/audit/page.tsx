import Link from 'next/link';
import { RotateCcw } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/shared/data-table';
import { Pill } from '@/components/shared/pill';
import { backendFetch } from '@/lib/backend-client';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Audit log' };

interface Search {
  branchId?: string;
  module?: string;
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

const PAGE_SIZE = 50;

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
  if (sp.branchId) listParams.set('branchId', sp.branchId);
  if (sp.module && sp.module !== 'ALL') listParams.set('module', sp.module);
  if (sp.search) listParams.set('search', sp.search);
  if (sp.from) listParams.set('from', new Date(sp.from).toISOString());
  if (sp.to) listParams.set('to', new Date(`${sp.to}T23:59:59`).toISOString());

  const [{ rows, total }, modules, branches] = await Promise.all([
    backendFetch<{ rows: AuditRow[]; total: number }>(`/api/mobile/audit?${listParams.toString()}`),
    backendFetch<string[]>('/api/mobile/audit/modules'),
    backendFetch<BranchDto[]>('/api/mobile/branches').catch(() => []),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(sp.search || (sp.module && sp.module !== 'ALL') || sp.branchId || sp.from || sp.to);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        description={`${total.toLocaleString()} immutable record${total === 1 ? '' : 's'} across all modules`}
      />

      <Card className="p-4">
        <form className="grid grid-cols-1 md:grid-cols-[1fr_150px_160px_140px_140px_auto] gap-3 items-end">
          <Input
            name="search"
            placeholder="Search by actor, entity, action…"
            defaultValue={sp.search ?? ''}
          />
          {branches.length > 0 && (
            <select
              name="branchId"
              defaultValue={sp.branchId ?? ''}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              <option value="">All branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code} · {b.name}
                </option>
              ))}
            </select>
          )}
          <select
            name="module"
            defaultValue={sp.module ?? 'ALL'}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          >
            <option value="ALL">All modules</option>
            {modules.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <Input type="date" name="from" defaultValue={sp.from ?? ''} />
          <Input type="date" name="to" defaultValue={sp.to ?? ''} />
          <div className="flex items-center gap-2">
            <Button type="submit" variant="outline">
              Filter
            </Button>
            {hasFilters && (
              <Button variant="ghost" size="sm" asChild>
                <Link href="/audit">
                  <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
                </Link>
              </Button>
            )}
          </div>
        </form>
      </Card>

      <Card className="p-0">
        <div className="px-4 py-3 border-b text-sm font-medium flex items-center justify-between">
          <span>
            {rows.length} of {total} entries — page {page} / {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Button variant="ghost" size="sm" asChild>
                <Link href={`?${new URLSearchParams({ ...sp, page: String(page - 1) }).toString()}`}>
                  Previous
                </Link>
              </Button>
            )}
            {page < totalPages && (
              <Button variant="ghost" size="sm" asChild>
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
          empty="No audit entries match the filters."
          columns={[
            {
              key: 'when',
              header: 'When',
              cell: (r) => (
                <span className="tabular text-xs">
                  {new Date(r.createdAt).toISOString().replace('T', ' ').slice(0, 19)}
                </span>
              ),
            },
            {
              key: 'who',
              header: 'Actor',
              cell: (r) => r.actor?.name ?? r.actor?.email ?? <span className="text-muted-foreground">—</span>,
            },
            { key: 'module', header: 'Module', cell: (r) => <Pill tone="blue">{r.module}</Pill> },
            { key: 'action', header: 'Action', cell: (r) => r.action },
            {
              key: 'entity',
              header: 'Entity',
              cell: (r) => (
                <span className="tabular text-xs">
                  {r.entityType}
                  {r.entityId && <span className="text-muted-foreground"> #{r.entityId.slice(0, 8)}</span>}
                </span>
              ),
            },
            { key: 'branch', header: 'Branch', cell: (r) => r.branch?.name ?? '—' },
            {
              key: 'view',
              header: '',
              cell: (r) => (
                <Link href={`/audit/${r.id}`} className="text-blue-600 text-xs hover:underline">
                  View
                </Link>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
