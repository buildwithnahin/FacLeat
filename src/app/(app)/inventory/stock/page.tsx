import Link from 'next/link';
import { ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight } from 'lucide-react';
import type { Prisma } from '@prisma/client';
import { getSession } from '@/server/auth/session';
import { stockService } from '@/server/services/stock.service';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/money';
import {
  INVENTORY_SECTION_META,
  INVENTORY_SECTION_SLUGS,
  parseInventorySection,
  type InventorySectionSlug,
} from '@/lib/inventory-sections';

export const metadata = { title: 'Stock balance' };

type Product = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  type: import('@prisma/client').ProductType;
  reorderLevel: Prisma.Decimal;
  costPrice: Prisma.Decimal;
  sellPrice: Prisma.Decimal;
};
type Warehouse = { id: string; name: string; code: string; type: import('@prisma/client').WarehouseType };
type Row = { product: Product; warehouse: Warehouse; qty: Prisma.Decimal };

type StockBalancePageProps = {
  searchParams: Promise<{ section?: string }>;
};

export default async function StockBalancePage({ searchParams }: StockBalancePageProps) {
  const session = await getSession();
  const sp = await searchParams;
  const section = parseInventorySection(sp.section) ?? 'raw-material';
  const branchId = session?.activeBranchId;

  if (!branchId) {
    return (
      <div>
        <PageHeader title="Stock balance" />
        <Card className="p-6 text-sm text-muted-foreground">
          Select an active branch from the topbar first.
        </Card>
      </div>
    );
  }

  const allRows = (await stockService.balanceSnapshotDetailed(session, {
    branchId,
    section,
  })) as Row[];

  return (
    <div>
      <PageHeader
        title={`${INVENTORY_SECTION_META[section].label} Stock Balance`}
        description={INVENTORY_SECTION_META[section].description}
      >
        <Button variant="outline" asChild>
          <Link href="/warehouse/receive">
            <ArrowDownToLine className="h-4 w-4" />
            Receive
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/warehouse/issue">
            <ArrowUpFromLine className="h-4 w-4" />
            Issue
          </Link>
        </Button>
        <Button asChild>
          <Link href="/warehouse/transfer">
            <ArrowLeftRight className="h-4 w-4" />
            Transfer
          </Link>
        </Button>
      </PageHeader>

      <div className="space-y-6">
        <SectionLinks activeSection={section} page="stock" />
        <StockSection
          title={INVENTORY_SECTION_META[section].label}
          description={INVENTORY_SECTION_META[section].description}
          rows={allRows}
          emptyLabel={`No ${INVENTORY_SECTION_META[section].label.toLowerCase()} stock yet.`}
        />
      </div>
    </div>
  );
}

function SectionLinks({
  activeSection,
  page,
}: {
  activeSection: InventorySectionSlug | null;
  page: 'stock' | 'ledger' | 'products';
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {INVENTORY_SECTION_SLUGS.map((slug) => (
        <Button key={slug} variant={activeSection === slug ? 'default' : 'outline'} asChild>
          <Link href={`/inventory/${page}?section=${slug}`}>{INVENTORY_SECTION_META[slug].label}</Link>
        </Button>
      ))}
    </div>
  );
}

function StockSection({
  title,
  description,
  rows,
  emptyLabel,
}: {
  title: string;
  description: string;
  rows: Row[];
  emptyLabel: string;
}) {
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <span className="text-xs text-muted-foreground">
          {rows.length} {rows.length === 1 ? 'row' : 'rows'}
        </span>
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left font-semibold px-4 py-3">SKU</th>
                <th className="text-left font-semibold px-4 py-3">Product</th>
                <th className="text-left font-semibold px-4 py-3">Warehouse</th>
                <th className="text-right font-semibold px-4 py-3">Balance</th>
                <th className="text-left font-semibold px-4 py-3">Unit</th>
                <th className="text-right font-semibold px-4 py-3">Buy / unit</th>
                <th className="text-right font-semibold px-4 py-3">Sell / unit</th>
                <th className="text-right font-semibold px-4 py-3">Total Cost</th>
                <th className="text-right font-semibold px-4 py-3">Total Sell</th>
                <th className="text-right font-semibold px-4 py-3">Reorder level</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                    {emptyLabel}
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                const low =
                  r.product.reorderLevel.gt(0) && r.qty.lte(r.product.reorderLevel)
                    ? 'text-warning'
                    : r.qty.lte(0)
                      ? 'text-destructive'
                      : '';
                const totalCost = r.product.costPrice.mul(r.qty);
                const totalSell = r.product.sellPrice.mul(r.qty);
                return (
                  <tr key={`${r.product.id}-${r.warehouse.id}`} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-xs">{r.product.sku}</td>
                    <td className="px-4 py-3 font-medium">{r.product.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {r.warehouse.name} <span className="text-xs">({r.warehouse.code})</span>
                    </td>
                    <td className={`px-4 py-3 text-right tabular-nums font-semibold ${low}`}>
                      {r.qty.toString()}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.product.unit}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {formatCurrency(r.product.costPrice)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {formatCurrency(r.product.sellPrice)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {formatCurrency(totalCost)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">
                      {formatCurrency(totalSell)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {r.product.reorderLevel.gt(0) ? r.product.reorderLevel.toString() : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}
