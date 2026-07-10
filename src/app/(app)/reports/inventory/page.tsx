import { Prisma } from '@prisma/client';
import { getSession } from '@/server/auth/session';
import { reportsService } from '@/server/services/reports.service';
import { branchService } from '@/server/services/branch.service';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  INVENTORY_SECTION_META,
  INVENTORY_SECTION_SLUGS,
  parseInventorySection,
} from '@/lib/inventory-sections';

export const metadata = { title: 'Inventory valuation' };

export default async function InventoryReportPage({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string; section?: string }>;
}) {
  const sp = await searchParams;
  const session = await getSession();
  const [data, branches] = await Promise.all([
    reportsService.inventoryValuation(session, { branchId: sp.branchId || undefined }),
    branchService.listAccessible(session),
  ]);

  const activeSection = parseInventorySection(sp.section);
  const rows = activeSection
    ? data.rows.filter((r) => {
        if (activeSection === 'raw-material') return r.type === 'RAW_MATERIAL';
        if (activeSection === 'work-in-progress') return r.type === 'WORK_IN_PROGRESS';
        if (activeSection === 'finished-goods') return r.type === 'FINISHED_GOOD';
        return r.type === 'CONSUMABLE' || r.type === 'SERVICE';
      })
    : data.rows;
  const rowsTotals = rows.reduce(
    (acc, r) => ({ qty: acc.qty.plus(r.qty), value: acc.value.plus(r.value) }),
    { qty: new Prisma.Decimal(0), value: new Prisma.Decimal(0) },
  );

  const sectionQuery = (slug?: string) => {
    const params = new URLSearchParams();
    if (sp.branchId) params.set('branchId', sp.branchId);
    if (slug) params.set('section', slug);
    const qs = params.toString();
    return `/reports/inventory${qs ? `?${qs}` : ''}`;
  };

  const exportParams = new URLSearchParams();
  if (sp.branchId) exportParams.set('branchId', sp.branchId);
  if (activeSection) exportParams.set('section', activeSection);
  const exportQs = exportParams.toString();
  const exportHref = `/api/reports/inventory.csv${exportQs ? `?${exportQs}` : ''}`;

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory valuation" description="On-hand qty × cost price per product">
        <div className="flex items-end gap-2">
          <form className="flex items-end gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Branch</label>
              <select
                name="branchId"
                defaultValue={sp.branchId ?? ''}
                className="flex h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="">All branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.code} · {b.name}</option>
                ))}
              </select>
            </div>
            <Input type="hidden" />
            <Button type="submit">Apply</Button>
          </form>
          <Button variant="outline" asChild>
            <a href={exportHref}>Export CSV</a>
          </Button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Summary label="Products" value={`${rows.length}`} />
        <Summary label="Total on-hand qty" value={rowsTotals.qty.toString()} />
        <Summary label="Stock value" value={rowsTotals.value.toString()} accent />
      </div>

      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
          Stock by production stage
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {data.bySection.map((s) => (
            <Card key={s.section}>
              <div className="p-4">
                <div className="text-xs text-muted-foreground">{s.label}</div>
                <div className="text-lg font-semibold tabular-nums mt-1">{s.value.toString()}</div>
                <div className="text-xs text-muted-foreground tabular-nums">{s.qty.toString()} units</div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant={!activeSection ? 'default' : 'outline'} size="sm" asChild>
          <a href={sectionQuery(undefined)}>All</a>
        </Button>
        {INVENTORY_SECTION_SLUGS.map((slug) => (
          <Button key={slug} variant={activeSection === slug ? 'default' : 'outline'} size="sm" asChild>
            <a href={sectionQuery(slug)}>{INVENTORY_SECTION_META[slug].label}</a>
          </Button>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left font-semibold px-4 py-3">SKU</th>
                <th className="text-left font-semibold px-4 py-3">Product</th>
                <th className="text-left font-semibold px-4 py-3">Type</th>
                <th className="text-left font-semibold px-4 py-3">Unit</th>
                <th className="text-right font-semibold px-4 py-3 tabular-nums">Qty</th>
                <th className="text-right font-semibold px-4 py-3 tabular-nums">Reorder</th>
                <th className="text-right font-semibold px-4 py-3 tabular-nums">Cost</th>
                <th className="text-right font-semibold px-4 py-3 tabular-nums">Value</th>
                <th className="text-left font-semibold px-4 py-3">Flag</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                    No inventory.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.productId} className="hover:bg-muted/30">
                  <td className="px-4 py-2 font-mono text-xs">{r.sku}</td>
                  <td className="px-4 py-2">{r.name}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{r.type.replace('_', ' ')}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{r.unit}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.qty.toString()}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{r.reorderLevel.toString()}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.cost.toString()}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-semibold">{r.value.toString()}</td>
                  <td className="px-4 py-2">
                    {r.belowReorder ? <Badge variant="destructive">Low stock</Badge> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Summary({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card>
      <div className="p-5">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={`text-2xl font-semibold tabular-nums mt-1 ${accent ? 'text-primary' : ''}`}>{value}</div>
      </div>
    </Card>
  );
}
