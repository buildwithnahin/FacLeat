import Link from 'next/link';
import { Suspense } from 'react';
import { Plus, PackageMinus, Boxes, DollarSign, FileText } from 'lucide-react';
import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { IssueLogFilters } from './issue-log-filters';
import { d, sumDecimal } from '@/lib/money';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Issued Products' };

interface SearchParams {
  q?: string;
  warehouseId?: string;
  refType?: string;
  from?: string;
  to?: string;
}

interface WarehouseOption {
  id: string;
  name: string;
  code: string;
}

interface MovementRow {
  id: string;
  createdAt: string;
  direction: 'IN' | 'OUT';
  quantity: string;
  costPerUnit: string;
  refType: string;
  refId: string | null;
  note: string | null;
  productId: string;
  product: { sku: string; name: string; unit: string };
  warehouse: { code: string; name: string };
}

function parseDate(val: string | undefined, endOfDay = false): Date | undefined {
  if (!val) return undefined;
  const dt = new Date(val);
  if (isNaN(dt.getTime())) return undefined;
  if (endOfDay) dt.setHours(23, 59, 59, 999);
  return dt;
}

export default async function IssuedProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const session = await getSession();
  const branchId = session?.activeBranchId || session?.defaultBranchId || session?.allowedBranchIds?.[0];

  const qs = new URLSearchParams({ direction: 'OUT', limit: '500' });
  if (branchId) qs.set('branchId', branchId);
  if (params.warehouseId) qs.set('warehouseId', params.warehouseId);
  if (params.refType) qs.set('refType', params.refType);
  const from = parseDate(params.from);
  const to = parseDate(params.to, true);
  if (from) qs.set('from', from.toISOString());
  if (to) qs.set('to', to.toISOString());

  const [warehouses, rawRows] = await Promise.all([
    branchId
      ? backendFetch<WarehouseOption[]>(`/api/mobile/warehouse/warehouses?branchId=${branchId}&activeOnly=true`)
      : Promise.resolve([]),
    backendFetch<MovementRow[]>(`/api/mobile/inventory/movements?${qs.toString()}`),
  ]);

  const q = (params.q ?? '').trim().toLowerCase();
  const rows = q
    ? rawRows.filter(
        (r) =>
          r.product.sku.toLowerCase().includes(q) ||
          r.product.name.toLowerCase().includes(q) ||
          (r.refId && r.refId.toLowerCase().includes(q)) ||
          (r.note && r.note.toLowerCase().includes(q)),
      )
    : rawRows;

  const totalQty = sumDecimal(rows.map((r) => r.quantity));
  const totalValue = sumDecimal(rows.map((r) => d(r.quantity).mul(r.costPerUnit)));
  const uniqueProducts = new Set(rows.map((r) => r.productId)).size;

  return (
    <div>
      <PageHeader
        title="Issued Products"
        description="All outbound stock movements from warehouses."
      >
        <Button asChild>
          <Link href="/warehouse/issue">
            <Plus className="h-4 w-4" />
            New issue
          </Link>
        </Button>
      </PageHeader>

      {/* KPI summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Total records
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-semibold tabular-nums">{rows.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <PackageMinus className="h-3.5 w-3.5" />
              Total qty issued
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-semibold tabular-nums">{totalQty.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Boxes className="h-3.5 w-3.5" />
              Unique products
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-semibold tabular-nums">{uniqueProducts}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5" />
              Total cost value
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-semibold tabular-nums">{totalValue.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="mb-4">
        <Suspense>
          <IssueLogFilters warehouses={warehouses.map((w) => ({ id: w.id, name: w.name, code: w.code }))} />
        </Suspense>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left font-semibold px-4 py-3">Date / Time</th>
                <th className="text-left font-semibold px-4 py-3">SKU</th>
                <th className="text-left font-semibold px-4 py-3">Product</th>
                <th className="text-left font-semibold px-4 py-3">Warehouse</th>
                <th className="text-right font-semibold px-4 py-3">Qty</th>
                <th className="text-right font-semibold px-4 py-3">Cost / unit</th>
                <th className="text-right font-semibold px-4 py-3">Total value</th>
                <th className="text-left font-semibold px-4 py-3">Type</th>
                <th className="text-left font-semibold px-4 py-3">Note / Ref</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                    No issued products found.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                    {r.createdAt.replace('T', ' ').slice(0, 19)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{r.product.sku}</td>
                  <td className="px-4 py-3 font-medium">{r.product.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {r.warehouse.name}{' '}
                    <span className="text-xs">({r.warehouse.code})</span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-red-600">
                    -{d(r.quantity).toFixed(2)}{' '}
                    <span className="text-xs text-muted-foreground">{r.product.unit}</span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {d(r.costPerUnit).toFixed(4)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">
                    {d(r.quantity).mul(r.costPerUnit).toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <RefTypeBadge refType={r.refType} />
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r.refId && (
                      <span className="font-mono text-muted-foreground">{r.refId}</span>
                    )}
                    {r.note && (
                      <p className="text-muted-foreground mt-0.5 max-w-[200px] truncate">
                        {r.note}
                      </p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {rows.length >= 500 && (
        <p className="mt-3 text-xs text-center text-muted-foreground">
          Showing first 500 records. Use filters to narrow the results.
        </p>
      )}
    </div>
  );
}

function RefTypeBadge({ refType }: { refType: string }) {
  const map: Record<string, { label: string; variant: 'destructive' | 'warning' | 'outline' | 'secondary' }> = {
    SALE: { label: 'Sale', variant: 'destructive' },
    DAMAGE: { label: 'Damage', variant: 'warning' },
    CUSTOMER_RETURN: { label: 'Customer Return', variant: 'warning' },
    MANUAL_ADJUST: { label: 'Manual', variant: 'outline' },
    CONSUMPTION: { label: 'Consumption', variant: 'secondary' },
    PRODUCTION: { label: 'Production', variant: 'secondary' },
    TRANSFER: { label: 'Transfer', variant: 'secondary' },
  };
  const cfg = map[refType];
  if (!cfg) return <Badge variant="outline">{refType}</Badge>;
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
