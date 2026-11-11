import Link from 'next/link';
import { Plus, Eye, Search } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pill } from '@/components/shared/pill';
import { DataTable } from '@/components/shared/data-table';
import { backendFetch } from '@/lib/backend-client';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Purchase Requisitions' };

const PRIORITY_TONE: Record<string, 'red' | 'orange' | 'blue' | 'amber'> = {
  URGENT: 'red',
  HIGH: 'red',
  MEDIUM: 'orange',
  LOW: 'blue',
};

const STATUS_TONE: Record<string, 'amber' | 'green' | 'red' | 'blue' | 'grey'> = {
  PENDING: 'amber',
  APPROVED: 'green',
  REJECTED: 'red',
  DRAFT: 'blue',
  CANCELLED: 'grey',
  CLOSED: 'grey',
};

interface RequisitionRow {
  id: string;
  number: string;
  department: string;
  requestedBy: string;
  items: { id: string }[];
  requiredDate: string;
  priority: string;
  status: string;
  createdAt: string;
}

export default async function RequisitionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string }>;
}) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  if (sp.status && sp.status !== 'ALL') params.set('status', sp.status);
  if (sp.search?.trim()) params.set('search', sp.search.trim());
  const requisitions = await backendFetch<RequisitionRow[]>(
    `/api/mobile/purchase/requisitions?${params.toString()}`,
  );
  const isFiltered = Boolean(sp.search?.trim() || (sp.status && sp.status !== 'ALL'));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Requisition"
        description="Create and manage purchase requisitions"
      >
        <Button variant="dark" asChild>
          <Link href="/purchase/requisitions/new">
            <Plus className="h-4 w-4" />
            Create Requisition
          </Link>
        </Button>
      </PageHeader>

      <Card className="p-4">
        <form className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              name="search"
              placeholder="Search PR #, dept, requester…"
              defaultValue={sp.search ?? ''}
              className="pl-9"
            />
          </div>
          <select
            name="status"
            defaultValue={sp.status ?? 'ALL'}
            className="flex h-9 w-44 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          >
            <option value="ALL">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="DRAFT">Draft</option>
            <option value="CLOSED">Closed</option>
          </select>
          <Button type="submit" variant="outline">
            Filter
          </Button>
          {isFiltered && (
            <Button variant="ghost" asChild>
              <Link href="/purchase/requisitions">Clear</Link>
            </Button>
          )}
        </form>
      </Card>

      <Card className="p-0">
        <div className="px-4 py-3 border-b text-sm font-medium">
          All Requisitions ({requisitions.length})
        </div>
        <DataTable
          rows={requisitions}
          rowKey={(r) => r.id}
          empty="No requisitions yet."
          columns={[
            {
              key: 'number',
              header: 'PR ID',
              cell: (r) => (
                <Link
                  href={`/purchase/requisitions/${r.id}`}
                  className="text-blue-600 hover:underline tabular"
                >
                  {r.number}
                </Link>
              ),
            },
            { key: 'department', header: 'Department', cell: (r) => r.department },
            { key: 'requestedBy', header: 'Requested By', cell: (r) => r.requestedBy },
            {
              key: 'items',
              header: 'Items',
              cell: (r) => `${r.items.length} items`,
            },
            {
              key: 'requiredDate',
              header: 'Required Date',
              cell: (r) => new Date(r.requiredDate).toLocaleDateString(),
            },
            {
              key: 'priority',
              header: 'Priority',
              cell: (r) => (
                <Pill tone={PRIORITY_TONE[r.priority] ?? 'neutral'}>{r.priority.toLowerCase()}</Pill>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              cell: (r) => (
                <Pill tone={STATUS_TONE[r.status] ?? 'neutral'}>
                  {r.status.replace('_', ' ').toLowerCase()}
                </Pill>
              ),
            },
            {
              key: 'created',
              header: 'Created',
              cell: (r) => new Date(r.createdAt).toLocaleDateString(),
            },
            {
              key: 'actions',
              header: 'Actions',
              cell: (r) => (
                <Link
                  href={`/purchase/requisitions/${r.id}`}
                  className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                  <Eye className="h-4 w-4" />
                </Link>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
