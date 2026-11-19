import Link from 'next/link';
import { Plus, Wrench, Package, CheckCircle2, Ban } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/shared/data-table';
import { Pill } from '@/components/shared/pill';
import { KpiCard } from '@/components/shared/kpi-card';
import { backendFetch } from '@/lib/backend-client';
import { formatCurrency } from '@/lib/money';
import type { CurrencyCode } from '@/lib/money';
import { ASSET_STATUS } from '@/server/validators/assets';
import { AssetExportButton } from './asset-export-button';
import { BulkDepreciationModal } from './bulk-depreciation-modal';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Assets' };

type PillTone = 'neutral' | 'grey' | 'blue' | 'amber' | 'green' | 'red' | 'orange';

const STATUS_TONE: Record<(typeof ASSET_STATUS)[number], PillTone> = {
  IN_USE: 'green',
  IN_STORAGE: 'blue',
  UNDER_MAINTENANCE: 'amber',
  DISPOSED: 'red',
  LOST: 'red',
};

interface AssetRow {
  id: string;
  code: string;
  name: string;
  category: { id: string; name: string } | null;
  branch: { id: string; name: string; currency: string };
  location: string | null;
  assignedTo: string | null;
  purchaseCost: string;
  bookValue: string;
  status: (typeof ASSET_STATUS)[number];
}

interface AssetSummary {
  inUse: number;
  storage: number;
  maintenance: number;
  disposed: number;
  totalPurchase: string;
  totalAccumulated: string;
  netBookValue: string;
}

interface Search {
  status?: string;
  search?: string;
  branchId?: string;
  categoryId?: string;
}

interface BranchOption {
  id: string;
  name: string;
  code: string;
}

interface CategoryOption {
  id: string;
  name: string;
}

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;

  const listParams = new URLSearchParams();
  if (sp.status && sp.status !== 'ALL') listParams.set('status', sp.status);
  if (sp.search) listParams.set('search', sp.search);
  if (sp.branchId && sp.branchId !== 'ALL') listParams.set('branchId', sp.branchId);
  if (sp.categoryId && sp.categoryId !== 'ALL') listParams.set('categoryId', sp.categoryId);

  const summaryParams = new URLSearchParams();
  if (sp.branchId && sp.branchId !== 'ALL') summaryParams.set('branchId', sp.branchId);
  const summaryQs = summaryParams.toString() ? `?${summaryParams.toString()}` : '';

  const [assets, summary, branches, categories] = await Promise.all([
    backendFetch<AssetRow[]>(`/api/mobile/assets?${listParams.toString()}`),
    backendFetch<AssetSummary>(`/api/mobile/assets/summary${summaryQs}`),
    backendFetch<BranchOption[]>('/api/mobile/branches').catch(() => []),
    backendFetch<CategoryOption[]>('/api/mobile/assets/categories').catch(() => []),
  ]);

  const hasFilter = Boolean(sp.search || (sp.status && sp.status !== 'ALL') || (sp.branchId && sp.branchId !== 'ALL') || (sp.categoryId && sp.categoryId !== 'ALL'));

  const exportData = assets.map((a) => ({
    code: a.code,
    name: a.name,
    category: a.category?.name,
    branch: a.branch.name,
    location: a.location ?? undefined,
    assignedTo: a.assignedTo ?? undefined,
    purchaseCost: a.purchaseCost,
    bookValue: a.bookValue,
    status: a.status,
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Fixed Assets" description="Enterprise asset lifecycle: register, tag, transfer, maintain, depreciate, and dispose.">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/assets/categories">Categories</Link>
          </Button>
          <AssetExportButton assets={exportData} />
          <BulkDepreciationModal
            branches={branches}
            currentBranchId={sp.branchId && sp.branchId !== 'ALL' ? sp.branchId : undefined}
          />
          <Button variant="dark" size="sm" asChild>
            <Link href="/assets/new">
              <Plus className="h-4 w-4" /> Add Asset
            </Link>
          </Button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard label="In use" value={summary.inUse} icon={CheckCircle2} tone="success" />
        <KpiCard label="In storage" value={summary.storage} icon={Package} tone="primary" />
        <KpiCard label="Maintenance" value={summary.maintenance} icon={Wrench} tone="warning" />
        <KpiCard label="Disposed" value={summary.disposed} icon={Ban} tone="danger" />
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground text-xs">Total purchase</div>
            <div className="tabular font-semibold">
              {formatCurrency(summary.totalPurchase, 'BDT')}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Accumulated depreciation</div>
            <div className="tabular font-semibold text-red-600">
              {formatCurrency(summary.totalAccumulated, 'BDT')}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Net book value</div>
            <div className="tabular font-semibold text-emerald-600">
              {formatCurrency(summary.netBookValue, 'BDT')}
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <form className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-end">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Search</label>
            <Input
              name="search"
              placeholder="Code, name, serial…"
              defaultValue={sp.search ?? ''}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Branch</label>
            <select
              name="branchId"
              defaultValue={sp.branchId ?? 'ALL'}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              <option value="ALL">All branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code} · {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Category</label>
            <select
              name="categoryId"
              defaultValue={sp.categoryId ?? 'ALL'}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              <option value="ALL">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Status</label>
            <select
              name="status"
              defaultValue={sp.status ?? 'ALL'}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              <option value="ALL">All statuses</option>
              {ASSET_STATUS.map((s) => (
                <option key={s} value={s}>
                  {s.replace('_', ' ').toLowerCase()}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="outline" className="flex-1">
              Filter
            </Button>
            {hasFilter && (
              <Button variant="ghost" asChild>
                <Link href="/assets">Reset</Link>
              </Button>
            )}
          </div>
        </form>
      </Card>

      <Card className="p-0">
        <div className="px-4 py-3 border-b text-sm font-medium">
          {assets.length} Asset{assets.length === 1 ? '' : 's'}
        </div>
        <DataTable
          rows={assets}
          rowKey={(r) => r.id}
          empty="No assets yet."
          columns={[
            { key: 'code', header: 'Code', cell: (r) => <span className="tabular">{r.code}</span> },
            {
              key: 'name',
              header: 'Name',
              cell: (r) => (
                <Link href={`/assets/${r.id}`} className="text-blue-600 hover:underline">
                  {r.name}
                </Link>
              ),
            },
            { key: 'category', header: 'Category', cell: (r) => r.category?.name ?? '—' },
            { key: 'branch', header: 'Branch', cell: (r) => r.branch.name },
            { key: 'location', header: 'Location', cell: (r) => r.location ?? '—' },
            { key: 'assignee', header: 'Assigned to', cell: (r) => r.assignedTo ?? '—' },
            {
              key: 'cost',
              header: 'Purchase',
              align: 'right',
              cell: (r) => (
                <span className="tabular">
                  {formatCurrency(r.purchaseCost, r.branch.currency as CurrencyCode)}
                </span>
              ),
            },
            {
              key: 'nbv',
              header: 'Book value',
              align: 'right',
              cell: (r) => (
                <span className="tabular font-medium">
                  {formatCurrency(r.bookValue, r.branch.currency as CurrencyCode)}
                </span>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              cell: (r) => (
                <Pill tone={STATUS_TONE[r.status]}>
                  {r.status.replace('_', ' ').toLowerCase()}
                </Pill>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
