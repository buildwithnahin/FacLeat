import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/shared/data-table';
import { Pill } from '@/components/shared/pill';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import { d } from '@/lib/money';
import { PRODUCTION_ORDER_STATUS } from '@/server/validators/factory';
import { ProductionControls } from './production-controls';
import { DeleteCostEntryButton } from './delete-cost-entry-button';
import { StageStatusControl } from './stage-status-control';
import { AddMaterialDialog } from './add-material-dialog';
import { AddStageDialog } from './add-stage-dialog';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Production order' };

type PillTone = 'neutral' | 'grey' | 'blue' | 'amber' | 'green' | 'red' | 'orange';

const STATUS_TONE: Record<(typeof PRODUCTION_ORDER_STATUS)[number], PillTone> = {
  DRAFT: 'grey',
  PLANNED: 'blue',
  IN_PROGRESS: 'amber',
  COMPLETED: 'green',
  CANCELLED: 'red',
  ON_HOLD: 'orange',
};

const STAGE_TONE: Record<string, PillTone> = {
  PENDING: 'grey',
  IN_PROGRESS: 'amber',
  COMPLETED: 'green',
  SKIPPED: 'neutral',
};

interface Stage {
  id: string;
  sequence: number;
  name: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
}

interface Material {
  id: string;
  unit: string;
  plannedQty: string;
  consumedQty: string;
  unitCost: string | null;
  fromWarehouseId: string | null;
  product: { id: string; name: string; sku: string; costPrice: string };
  fromWarehouse: { id: string; code: string; name: string } | null;
}

interface Output {
  id: string;
  createdAt: string;
  quantity: string;
  unit: string;
  costPerUnit: string;
  note: string | null;
  toWarehouse: { id: string; code: string; name: string };
}

interface CostEntry {
  id: string;
  type: 'OVERHEAD' | 'WEDGE' | 'LABOUR';
  description: string;
  amount: string;
  hours: string | null;
  rate: string | null;
  note: string | null;
}

interface IssueVoucherItem {
  id: string;
  issuedQty: string;
  uom: string;
  product: { id: string; name: string; sku: string };
}

interface IssueVoucher {
  id: string;
  voucherNo: string;
  status: string;
  date: string;
  warehouse: { id: string; name: string; code: string };
  items: IssueVoucherItem[];
}

interface ProcessTrackingRow {
  id: string;
  trackingNo: string;
  status: string;
  inputQty: string;
  outputQty: string;
  scrapQty: string;
  stage: { id: string; name: string; sequence: number };
  operator: { id: string; firstName: string; lastName: string; code: string } | null;
}

interface FGReceiveItem {
  id: string;
  quantity: string;
  uom: string;
  qualityStatus: string;
  product: { id: string; name: string; sku: string };
}

interface FGReceiveVoucher {
  id: string;
  receiveNo: string;
  date: string;
  warehouse: { id: string; name: string; code: string };
  items: FGReceiveItem[];
}

interface Order {
  id: string;
  number: string;
  status: (typeof PRODUCTION_ORDER_STATUS)[number];
  branchId: string;
  unit: string;
  plannedQty: string;
  producedQty: string;
  plannedStartDate: string;
  plannedEndDate: string;
  actualStartDate: string | null;
  actualEndDate: string | null;
  notes: string | null;
  overheadRate: string | null;
  branch: { id: string; name: string; code: string; currency: string };
  product: { id: string; sku: string; name: string };
  stages: Stage[];
  materials: Material[];
  outputs: Output[];
  costEntries: CostEntry[];
  productionIssueVouchers?: IssueVoucher[];
  finishedGoodsReceiveVouchers?: FGReceiveVoucher[];
  processTrackings?: ProcessTrackingRow[];
}

interface CostSummary {
  materialCost: string;
  isEstimatedMaterialCost: boolean;
  labourCost: string;
  fixedOverheadCost: string;
  percentOverheadCost: string;
  wedgeCost: string;
  totalCost: string;
  costPerUnit: string | null;
  isEstimatedCostPerUnit: boolean;
}

interface Warehouse {
  id: string;
  code: string;
  name: string;
}

interface ProductOption {
  id: string;
  name: string;
  sku: string;
  unit: string;
  costPrice: string;
  type: string;
}

function CostRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums font-medium">{d(value).toFixed(2)}</span>
    </div>
  );
}

export default async function ProductionOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let order: Order;
  let warehouses: Warehouse[];
  let products: ProductOption[];
  let costSummary: CostSummary;
  try {
    const data = await backendFetch<{
      order: Order;
      warehouses: Warehouse[];
      products: ProductOption[];
      costSummary: CostSummary;
    }>(`/api/mobile/factory/${id}`);
    order = data.order;
    warehouses = data.warehouses;
    products = data.products ?? [];
    costSummary = data.costSummary;
  } catch (e) {
    if (e instanceof BackendApiError && e.status === 404) notFound();
    throw e;
  }

  const overheadEntries = order.costEntries.filter((e) => e.type === 'OVERHEAD');
  const wedgeEntries = order.costEntries.filter((e) => e.type === 'WEDGE');
  const labourEntries = order.costEntries.filter((e) => e.type === 'LABOUR');

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Order ${order.number}`}
        description={`${order.product.name} — ${order.product.sku}`}
      >
        <Button variant="outline" asChild>
          <Link href="/factory">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link href={`/factory/${order.id}/costing-sheet`}>
            View Costing Sheet
          </Link>
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
        <div className="space-y-6">
          {/* PRO Cost Summary */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                PRO Cost Summary
              </h3>
              <Pill tone={STATUS_TONE[order.status]}>
                {order.status.replace('_', ' ').toLowerCase()}
              </Pill>
            </div>
            {costSummary.isEstimatedMaterialCost && (
              <div className="mb-3 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
                ⚠️ Estimated cost — no materials consumed yet. Based on planned quantities × unit cost.
              </div>
            )}
            <div className="space-y-2">
              <CostRow
                label={`Material cost${costSummary.isEstimatedMaterialCost ? ' (est.)' : ''}`}
                value={costSummary.materialCost}
              />
              <CostRow label="Labour cost" value={costSummary.labourCost} />
              <CostRow label="Fixed overhead" value={costSummary.fixedOverheadCost} />
              <CostRow
                label={`% Overhead on materials (${order.overheadRate ? d(order.overheadRate).toFixed(2) : '0.00'}%)`}
                value={costSummary.percentOverheadCost}
              />
              <CostRow label="Wedge / sundry" value={costSummary.wedgeCost} />
              <div className="border-t pt-3 mt-3 flex justify-between font-semibold text-sm">
                <span>Total production cost</span>
                <span className="tabular-nums">{d(costSummary.totalCost).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  Cost per unit ({order.unit})
                  {costSummary.isEstimatedCostPerUnit && (
                    <span className="ml-1 text-amber-600 font-medium">[est.]</span>
                  )}
                </span>
                <span className="tabular-nums font-semibold text-foreground">
                  {costSummary.costPerUnit ? d(costSummary.costPerUnit).toFixed(4) : '—'}
                </span>
              </div>
            </div>
          </Card>

          {/* Order info */}
          <Card className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Status</div>
                <Pill tone={STATUS_TONE[order.status]}>
                  {order.status.replace('_', ' ').toLowerCase()}
                </Pill>
              </div>
              <div>
                <div className="text-muted-foreground">Planned</div>
                <div className="tabular-nums font-medium">
                  {order.plannedQty.toString()} {order.unit}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Produced</div>
                <div className="tabular-nums font-medium">
                  {order.producedQty.toString()} {order.unit}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Branch</div>
                <div>{order.branch.name}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Planned start</div>
                <div className="tabular-nums">
                  {new Date(order.plannedStartDate).toISOString().slice(0, 10)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Planned end</div>
                <div className="tabular-nums">
                  {new Date(order.plannedEndDate).toISOString().slice(0, 10)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Actual start</div>
                <div className="tabular-nums">
                  {order.actualStartDate ? new Date(order.actualStartDate).toISOString().slice(0, 10) : '—'}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Actual end</div>
                <div className="tabular-nums">
                  {order.actualEndDate ? new Date(order.actualEndDate).toISOString().slice(0, 10) : '—'}
                </div>
              </div>
            </div>
            {order.notes && (
              <p className="mt-4 text-sm text-muted-foreground border-t pt-4">{order.notes}</p>
            )}
          </Card>

          {/* Stages */}
          <Card className="p-0">
            <div className="px-4 py-3 border-b text-sm font-medium flex items-center justify-between">
              <span>Stages ({order.stages.length})</span>
              <AddStageDialog
                orderId={order.id}
                nextSequence={order.stages.length + 1}
                disabled={order.status === 'COMPLETED' || order.status === 'CANCELLED'}
              />
            </div>
            <DataTable
              rows={order.stages}
              rowKey={(r) => r.id}
              empty="No stages defined."
              columns={[
                { key: 'seq', header: '#', cell: (r) => r.sequence },
                { key: 'name', header: 'Stage', cell: (r) => r.name },
                {
                  key: 'status',
                  header: 'Status',
                  cell: (r) => (
                    <Pill tone={STAGE_TONE[r.status] ?? 'grey'}>
                      {r.status.replace('_', ' ').toLowerCase()}
                    </Pill>
                  ),
                },
                {
                  key: 'started',
                  header: 'Started',
                  cell: (r) => (r.startedAt ? new Date(r.startedAt).toISOString().slice(0, 10) : '—'),
                },
                {
                  key: 'completed',
                  header: 'Completed',
                  cell: (r) => (r.completedAt ? new Date(r.completedAt).toISOString().slice(0, 10) : '—'),
                },
                {
                  key: 'actions',
                  header: 'Update',
                  align: 'right',
                  cell: (r) => (
                    <StageStatusControl
                      stageId={r.id}
                      orderId={order.id}
                      currentStatus={r.status}
                      disabled={order.status === 'COMPLETED' || order.status === 'CANCELLED'}
                    />
                  ),
                },
              ]}
            />
          </Card>

          {/* Materials (BOM) */}
          <Card className="p-0">
            <div className="px-4 py-3 border-b text-sm font-medium flex items-center justify-between">
              <span>Materials (BOM) ({order.materials.length})</span>
              <AddMaterialDialog
                orderId={order.id}
                products={products}
                warehouses={warehouses}
                disabled={order.status === 'COMPLETED' || order.status === 'CANCELLED'}
              />
            </div>
            <DataTable
              rows={order.materials}
              rowKey={(r) => r.id}
              empty="No materials on this order."
              columns={[
                { key: 'product', header: 'Product', cell: (r) => r.product.name },
                { key: 'sku', header: 'SKU', cell: (r) => <span className="tabular-nums">{r.product.sku}</span> },
                {
                  key: 'planned',
                  header: 'Planned',
                  align: 'right',
                  cell: (r) => (
                    <span className="tabular-nums">
                      {r.plannedQty.toString()} {r.unit}
                    </span>
                  ),
                },
                {
                  key: 'consumed',
                  header: 'Consumed',
                  align: 'right',
                  cell: (r) => (
                    <span className="tabular-nums">
                      {r.consumedQty.toString()} {r.unit}
                    </span>
                  ),
                },
                {
                  key: 'wh',
                  header: 'Source WH',
                  cell: (r) => r.fromWarehouse?.name ?? '—',
                },
              ]}
            />
          </Card>

          {/* Finished outputs */}
          <Card className="p-0">
            <div className="px-4 py-3 border-b text-sm font-medium">Finished outputs</div>
            <DataTable
              rows={order.outputs}
              rowKey={(r) => r.id}
              empty="No output recorded yet."
              columns={[
                {
                  key: 'date',
                  header: 'Date',
                  cell: (r) => new Date(r.createdAt).toISOString().slice(0, 10),
                },
                {
                  key: 'qty',
                  header: 'Qty',
                  align: 'right',
                  cell: (r) => (
                    <span className="tabular-nums">
                      {r.quantity.toString()} {r.unit}
                    </span>
                  ),
                },
                {
                  key: 'cost',
                  header: 'Cost/unit',
                  align: 'right',
                  cell: (r) => <span className="tabular-nums">{r.costPerUnit.toString()}</span>,
                },
                { key: 'wh', header: 'To WH', cell: (r) => r.toWarehouse.name },
                { key: 'note', header: 'Note', cell: (r) => r.note ?? '—' },
              ]}
            />
          </Card>

          {/* Issue Vouchers (WIP Material Issues) */}
          <Card className="p-0">
            <div className="px-4 py-3 border-b text-sm font-medium flex items-center justify-between">
              <span>Material Issue Vouchers ({order.productionIssueVouchers?.length ?? 0})</span>
              <Button size="sm" variant="ghost" asChild>
                <Link href="/factory/production-issue" className="text-xs text-blue-600 hover:underline">
                  Open Issue Manager →
                </Link>
              </Button>
            </div>
            <DataTable
              rows={order.productionIssueVouchers ?? []}
              rowKey={(r) => r.id}
              empty="No material issue vouchers on this order."
              columns={[
                {
                  key: 'voucherNo',
                  header: 'Voucher No',
                  cell: (r) => <span className="font-medium tabular-nums">{r.voucherNo}</span>,
                },
                {
                  key: 'date',
                  header: 'Date',
                  cell: (r) => new Date(r.date).toISOString().slice(0, 10),
                },
                { key: 'wh', header: 'Warehouse', cell: (r) => r.warehouse.name },
                {
                  key: 'items',
                  header: 'Issued Items',
                  cell: (r) => (
                    <div className="space-y-0.5 text-xs">
                      {r.items.map((it) => (
                        <div key={it.id}>
                          {it.product.name} • {it.issuedQty.toString()} {it.uom}
                        </div>
                      ))}
                    </div>
                  ),
                },
                {
                  key: 'status',
                  header: 'Status',
                  cell: (r) => (
                    <Pill tone={r.status === 'ISSUED' ? 'green' : r.status === 'APPROVED' ? 'blue' : 'grey'}>
                      {r.status.toLowerCase()}
                    </Pill>
                  ),
                },
              ]}
            />
          </Card>

          {/* Finished Goods Receive Vouchers */}
          <Card className="p-0">
            <div className="px-4 py-3 border-b text-sm font-medium flex items-center justify-between">
              <span>FG Receive Vouchers ({order.finishedGoodsReceiveVouchers?.length ?? 0})</span>
              <Button size="sm" variant="ghost" asChild>
                <Link href="/factory/finished-goods-receive" className="text-xs text-blue-600 hover:underline">
                  Open FG Manager →
                </Link>
              </Button>
            </div>
            <DataTable
              rows={order.finishedGoodsReceiveVouchers ?? []}
              rowKey={(r) => r.id}
              empty="No FG receive vouchers on this order."
              columns={[
                {
                  key: 'receiveNo',
                  header: 'Receive No',
                  cell: (r) => <span className="font-medium tabular-nums">{r.receiveNo}</span>,
                },
                {
                  key: 'date',
                  header: 'Date',
                  cell: (r) => new Date(r.date).toISOString().slice(0, 10),
                },
                { key: 'wh', header: 'FG Warehouse', cell: (r) => r.warehouse.name },
                {
                  key: 'items',
                  header: 'Received Items',
                  cell: (r) => (
                    <div className="space-y-0.5 text-xs">
                      {r.items.map((it) => (
                        <div key={it.id}>
                          {it.product.name} • {it.quantity.toString()} {it.uom} • {it.qualityStatus}
                        </div>
                      ))}
                    </div>
                  ),
                },
              ]}
            />
          </Card>

          {/* Shop-floor Process Tracking */}
          <Card className="p-0">
            <div className="px-4 py-3 border-b text-sm font-medium flex items-center justify-between">
              <span>WIP Process Trackings ({order.processTrackings?.length ?? 0})</span>
              <Button size="sm" variant="ghost" asChild>
                <Link href="/factory/process-tracking" className="text-xs text-blue-600 hover:underline">
                  Open Tracking Manager →
                </Link>
              </Button>
            </div>
            <DataTable
              rows={order.processTrackings ?? []}
              rowKey={(r) => r.id}
              empty="No shop-floor process tracking records yet."
              columns={[
                {
                  key: 'trackingNo',
                  header: 'Tracking No',
                  cell: (r) => <span className="font-medium tabular-nums">{r.trackingNo}</span>,
                },
                {
                  key: 'stage',
                  header: 'Process Stage',
                  cell: (r) => `${r.stage.sequence}. ${r.stage.name}`,
                },
                {
                  key: 'operator',
                  header: 'Operator',
                  cell: (r) => (r.operator ? `${r.operator.firstName} ${r.operator.lastName}` : '—'),
                },
                {
                  key: 'io',
                  header: 'In / Out / Scrap',
                  cell: (r) => (
                    <span className="tabular-nums text-xs">
                      In: {r.inputQty.toString()} | Out: {r.outputQty.toString()} | Scrap: {r.scrapQty.toString()}
                    </span>
                  ),
                },
                {
                  key: 'status',
                  header: 'Status',
                  cell: (r) => (
                    <Pill tone={r.status === 'COMPLETED' ? 'green' : r.status === 'RUNNING' ? 'amber' : 'grey'}>
                      {r.status.toLowerCase()}
                    </Pill>
                  ),
                },
              ]}
            />
          </Card>

          {/* Fixed Overhead Entries */}
          <Card className="p-0">
            <div className="px-4 py-3 border-b text-sm font-medium">Fixed Overhead Entries</div>
            <DataTable
              rows={overheadEntries}
              rowKey={(r) => r.id}
              empty="No overhead entries yet."
              columns={[
                { key: 'desc', header: 'Description', cell: (r) => r.description },
                {
                  key: 'amount',
                  header: 'Amount',
                  align: 'right',
                  cell: (r) => <span className="tabular-nums">{d(r.amount).toFixed(2)}</span>,
                },
                { key: 'note', header: 'Note', cell: (r) => r.note ?? '—' },
                {
                  key: 'actions',
                  header: '',
                  align: 'right',
                  cell: (r) => <DeleteCostEntryButton entryId={r.id} orderId={order.id} />,
                },
              ]}
            />
          </Card>

          {/* Wedge / Sundry Entries */}
          <Card className="p-0">
            <div className="px-4 py-3 border-b text-sm font-medium">Wedge / Sundry Entries</div>
            <DataTable
              rows={wedgeEntries}
              rowKey={(r) => r.id}
              empty="No wedge entries yet."
              columns={[
                { key: 'desc', header: 'Description', cell: (r) => r.description },
                {
                  key: 'amount',
                  header: 'Amount',
                  align: 'right',
                  cell: (r) => <span className="tabular-nums">{d(r.amount).toFixed(2)}</span>,
                },
                { key: 'note', header: 'Note', cell: (r) => r.note ?? '—' },
                {
                  key: 'actions',
                  header: '',
                  align: 'right',
                  cell: (r) => <DeleteCostEntryButton entryId={r.id} orderId={order.id} />,
                },
              ]}
            />
          </Card>

          {/* Labour Entries */}
          <Card className="p-0">
            <div className="px-4 py-3 border-b text-sm font-medium">Labour Entries</div>
            <DataTable
              rows={labourEntries}
              rowKey={(r) => r.id}
              empty="No labour entries yet."
              columns={[
                { key: 'desc', header: 'Task / Worker', cell: (r) => r.description },
                {
                  key: 'amount',
                  header: 'Amount',
                  align: 'right',
                  cell: (r) => <span className="tabular-nums font-medium">{d(r.amount).toFixed(2)}</span>,
                },
                { key: 'note', header: 'Note', cell: (r) => r.note ?? '—' },
                {
                  key: 'actions',
                  header: '',
                  align: 'right',
                  cell: (r) => <DeleteCostEntryButton entryId={r.id} orderId={order.id} />,
                },
              ]}
            />
          </Card>
        </div>

        <ProductionControls
          order={{
            id: order.id,
            status: order.status,
            overheadRate: order.overheadRate ?? '',
            plannedQty: order.plannedQty.toString(),
            producedQty: order.producedQty.toString(),
            unit: order.unit,
            materials: order.materials.map((m) => ({
              id: m.id,
              productName: m.product.name,
              unit: m.unit,
              plannedQty: m.plannedQty.toString(),
              consumedQty: m.consumedQty.toString(),
              fromWarehouseId: m.fromWarehouseId,
              defaultCostPerUnit: m.unitCost ?? m.product.costPrice ?? '0',
            })),
          }}
          warehouses={warehouses}
          suggestedCostPerUnit={costSummary.costPerUnit}
          isEstimatedCostPerUnit={costSummary.isEstimatedCostPerUnit}
        />
      </div>
    </div>
  );
}
