import Link from 'next/link';
import { Plus, PackagePlus, PackageMinus, Boxes, Layers, AlertTriangle } from 'lucide-react';
import { getSession } from '@/server/auth/session';
import { reportsService } from '@/server/services/reports.service';
import { stockService } from '@/server/services/stock.service';
import { productService } from '@/server/services/product.service';
import { PageHeader } from '@/components/shared/page-header';
import { KpiCard } from '@/components/shared/kpi-card';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/money';

export const metadata = { title: 'Inventory Overview' };

export default async function InventoryOverviewPage() {
  const session = await getSession();
  const branchId = session?.activeBranchId ?? undefined;

  const [valuation, movements, products] = await Promise.all([
    reportsService.inventoryValuation(session, { branchId }),
    stockService.listMovements(session, { branchId, limit: 8 }),
    productService.list(session),
  ]);

  const lowStock = valuation.rows.filter((r) => r.belowReorder);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Overview"
        description="Stock health across raw material, WIP, finished goods, and consumables"
      >
        <Button variant="outline" asChild>
          <Link href="/warehouse/receive">
            <PackagePlus className="h-4 w-4" />
            Stock in
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/warehouse/issue">
            <PackageMinus className="h-4 w-4" />
            Stock out
          </Link>
        </Button>
        <Button variant="dark" asChild>
          <Link href="/inventory/products/new">
            <Plus className="h-4 w-4" />
            New product
          </Link>
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard label="Products tracked" value={products.length} icon={Boxes} />
        <KpiCard
          label="Total stock value"
          value={formatCurrency(valuation.totals.value, 'BDT')}
          icon={Layers}
          tone="primary"
        />
        <KpiCard
          label="Low stock alerts"
          value={lowStock.length}
          icon={AlertTriangle}
          tone={lowStock.length > 0 ? 'danger' : 'default'}
          description="Below reorder level"
        />
      </div>

      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
          Stock by production stage
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {valuation.bySection.map((s) => (
            <Card key={s.section}>
              <div className="p-4">
                <div className="text-xs text-muted-foreground">{s.label}</div>
                <div className="text-lg font-semibold tabular-nums mt-1">
                  {formatCurrency(s.value, 'BDT')}
                </div>
                <div className="text-xs text-muted-foreground tabular-nums">
                  {s.qty.toString()} units
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="text-sm font-semibold">Low stock alerts</h3>
            <Link href="/reports/inventory" className="text-xs text-primary hover:underline">
              View all
            </Link>
          </div>
          <ul className="divide-y max-h-96 overflow-y-auto">
            {lowStock.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                Nothing below reorder level.
              </li>
            )}
            {lowStock.slice(0, 8).map((r) => (
              <li key={r.productId} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{r.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{r.sku}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm tabular-nums font-medium">{r.qty.toString()}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    reorder at {r.reorderLevel.toString()}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="text-sm font-semibold">Recent stock movements</h3>
            <Link href="/inventory/ledger" className="text-xs text-primary hover:underline">
              View ledger
            </Link>
          </div>
          <ul className="divide-y max-h-96 overflow-y-auto">
            {movements.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                No movements yet.
              </li>
            )}
            {movements.map((m) => (
              <li key={m.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{m.product.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{m.product.sku}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm tabular-nums">{m.quantity.toString()}</span>
                  <Badge variant={m.direction === 'IN' ? 'success' : 'destructive'}>
                    {m.direction}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
