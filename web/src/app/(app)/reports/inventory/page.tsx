import Link from 'next/link';
import { backendFetch } from '@/lib/backend-client';
import { d, formatCurrency } from '@/lib/money';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  INVENTORY_SECTION_META,
  INVENTORY_SECTION_SLUGS,
} from '@/lib/inventory-sections';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Inventory valuation' };

interface InventoryRow {
  productId: string;
  sku: string;
  name: string;
  unit: string;
  type: string;
  qty: string;
  cost: string;
  value: string;
  reorderLevel: string;
  belowReorder: boolean;
}

interface InventoryValuationDto {
  rows: InventoryRow[];
  totals: { qty: string; value: string };
  bySection: { section: string; label: string; qty: string; value: string }[];
}

interface Branch {
  id: string;
  name: string;
  code: string;
}

export default async function InventoryReportPage({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string; section?: string }>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams(sp.branchId && sp.branchId !== 'ALL' ? { branchId: sp.branchId } : {});
  const [data, branches] = await Promise.all([
    backendFetch<InventoryValuationDto>(`/api/mobile/reports/general/inventory-valuation?${qs.toString()}`),
    backendFetch<Branch[]>('/api/mobile/branches').catch(() => []),
  ]);

  const activeSection = INVENTORY_SECTION_SLUGS.includes(sp.section as (typeof INVENTORY_SECTION_SLUGS)[number])
    ? (sp.section as (typeof INVENTORY_SECTION_SLUGS)[number])
    : null;
  const rows = activeSection
    ? data.rows.filter((r) => {
        if (activeSection === 'raw-material') return r.type === 'RAW_MATERIAL';
        if (activeSection === 'work-in-progress') return r.type === 'WORK_IN_PROGRESS';
        if (activeSection === 'finished-goods') return r.type === 'FINISHED_GOOD';
        return r.type === 'CONSUMABLE' || r.type === 'SERVICE';
      })
    : data.rows;
  const rowsTotals = rows.reduce(
    (acc, r) => ({ qty: acc.qty.plus(d(r.qty)), value: acc.value.plus(d(r.value)) }),
    { qty: d(0), value: d(0) },
  );

  const sectionQuery = (slug?: string) => {
    const params = new URLSearchParams();
    if (sp.branchId && sp.branchId !== 'ALL') params.set('branchId', sp.branchId);
    if (slug) params.set('section', slug);
    const qsStr = params.toString();
    return `/reports/inventory${qsStr ? `?${qsStr}` : ''}`;
  };

  const exportParams = new URLSearchParams();
  if (sp.branchId && sp.branchId !== 'ALL') exportParams.set('branchId', sp.branchId);
  if (activeSection) exportParams.set('section', activeSection);
  const exportQs = exportParams.toString();
  const exportHref = `/api/reports/inventory.csv${exportQs ? `?${exportQs}` : ''}`;

  const isFiltered = Boolean(sp.branchId || sp.section);

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
            {activeSection && <input type="hidden" name="section" value={activeSection} />}
            <Button type="submit">Apply</Button>
            {isFiltered && (
              <Button variant="ghost" asChild>
                <Link href="/reports/inventory">Reset</Link>
              </Button>
            )}
          </form>
          <Button variant="outline" asChild>
            <a href={exportHref}>Export CSV</a>
          </Button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Summary label="Products" value={`${rows.length}`} />
        <Summary label="Total on-hand qty" value={Number(rowsTotals.qty.toString()).toLocaleString()} />
        <Summary label="Stock value" value={formatCurrency(rowsTotals.value.toString(), 'BDT')} accent />
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
                <div className="text-lg font-semibold tabular-nums mt-1">{formatCurrency(s.value, 'BDT')}</div>
                <div className="text-xs text-muted-foreground tabular-nums">{Number(s.qty).toLocaleString()} units</div>
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
                  <td className="px-4 py-2 text-right tabular-nums font-medium">{Number(r.qty).toLocaleString()}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{Number(r.reorderLevel).toLocaleString()}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(r.cost, 'BDT')}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-semibold text-emerald-600">{formatCurrency(r.value, 'BDT')}</td>
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
