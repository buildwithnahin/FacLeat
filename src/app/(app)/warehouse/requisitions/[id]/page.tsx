import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/page-header';
import { Pill } from '@/components/shared/pill';
import { getSession } from '@/server/auth/session';
import { stockRequisitionService } from '@/server/services/stock-requisition.service';
import { prisma } from '@/server/db';
import { NotFoundError } from '@/lib/errors';
import { StockRequisitionDecisionForm } from '../decision-form';
import { AssignWarehouseForm } from '../assign-warehouse-form';
import { StockDispatchForm } from '../dispatch-form';
import { StockReceiveForm } from '../receive-form';
import { StockTransferStatusForm } from '../transfer-status-form';

const STATUS_TONE: Record<string, 'blue' | 'orange' | 'green' | 'red' | 'grey' | 'amber'> = {
  DRAFT: 'blue',
  SUBMITTED: 'amber',
  APPROVED: 'green',
  REJECTED: 'red',
  WAREHOUSE_ASSIGNED: 'blue',
  PICKING: 'orange',
  PACKED: 'orange',
  DISPATCHED: 'blue',
  IN_TRANSIT: 'blue',
  RECEIVED: 'green',
  COMPLETED: 'grey',
  CANCELLED: 'grey',
};

function transferActions(status: string) {
  switch (status) {
    case 'PICKING':
      return [
        { status: 'PACKED' as const, label: 'Mark packed', dark: true },
        { status: 'CANCELLED' as const, label: 'Cancel transfer' },
      ];
    case 'PACKED':
      return [
        { status: 'DISPATCHED' as const, label: 'Dispatch', dark: true },
        { status: 'CANCELLED' as const, label: 'Cancel transfer' },
      ];
    case 'DISPATCHED':
      return [
        { status: 'IN_TRANSIT' as const, label: 'Mark in transit', dark: true },
        { status: 'CANCELLED' as const, label: 'Cancel transfer' },
      ];
    case 'RECEIVED':
      return [{ status: 'COMPLETED' as const, label: 'Complete request', dark: true }];
    default:
      return [];
  }
}

export default async function StockRequisitionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();

  let requisition;
  try {
    requisition = await stockRequisitionService.getRequisition(session, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const warehouses = await prisma.warehouse.findMany({
    where: {
      isActive: true,
      id: { not: requisition.showroomWarehouseId },
    },
    orderBy: [{ branch: { name: 'asc' } }, { name: 'asc' }],
    include: { branch: { select: { name: true } } },
  });

  const canApprove = session?.permissions.includes('approvals:approve') ?? false;
  const activeBranchId = session?.activeBranchId ?? session?.defaultBranchId ?? null;
  const remainingDispatchItems = requisition.items
    .map((item) => ({
      requisitionItemId: item.id,
      productId: item.productId,
      productName: `${item.product.name}${item.product.sku ? ` (${item.product.sku})` : ''}`,
      approvedRemainingQty: item.approvedQty.minus(item.dispatchedQty).toString(),
    }))
    .filter((item) => Number(item.approvedRemainingQty) > 0);

  const latestTransfer = requisition.transfers[0] ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href="/warehouse/requisitions">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>

      <PageHeader
        title={requisition.number}
        description={`${requisition.showroomWarehouse.name} · required ${new Date(requisition.requiredDate).toLocaleDateString()}`}
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-5">
          <p className="text-xs text-muted-foreground">Status</p>
          <div className="mt-2">
            <Pill tone={STATUS_TONE[requisition.status] ?? 'neutral'}>
              {requisition.status.replaceAll('_', ' ').toLowerCase()}
            </Pill>
          </div>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-muted-foreground">Priority</p>
          <p className="mt-2 text-lg font-semibold">{requisition.priority}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-muted-foreground">Showroom</p>
          <p className="mt-2 text-lg font-semibold">{requisition.showroomWarehouse.name}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-muted-foreground">Source warehouse</p>
          <p className="mt-2 text-lg font-semibold">
            {requisition.sourceWarehouse
              ? requisition.sourceWarehouse.name
              : 'Pending assignment'}
          </p>
        </Card>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="mb-4 text-sm font-semibold">Items</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-2">Product</th>
                  <th className="py-2 text-right">Requested</th>
                  <th className="py-2 text-right">Approved</th>
                  <th className="py-2 text-right">Dispatched</th>
                  <th className="py-2 text-right">Received</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {requisition.items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-3">
                      <div className="font-medium">{item.product.name}</div>
                      <div className="text-xs text-muted-foreground">{item.product.sku}</div>
                    </td>
                    <td className="py-3 text-right">{item.requestedQty.toString()}</td>
                    <td className="py-3 text-right">{item.approvedQty.toString()}</td>
                    <td className="py-3 text-right">{item.dispatchedQty.toString()}</td>
                    <td className="py-3 text-right">{item.receivedQty.toString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {requisition.remarks && (
        <Card>
          <CardContent className="p-6">
            <div className="text-sm font-semibold">Remarks</div>
            <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
              {requisition.remarks}
            </p>
          </CardContent>
        </Card>
      )}

      {canApprove && requisition.status === 'SUBMITTED' && (
        <Card>
          <CardContent className="p-6">
            <div className="mb-4 text-sm font-semibold">Approval</div>
            <StockRequisitionDecisionForm
              requisitionId={requisition.id}
              sourceWarehouseId={requisition.sourceWarehouseId}
              warehouses={warehouses.map((warehouse) => ({
                id: warehouse.id,
                name: warehouse.name,
                code: warehouse.code,
                branchName: warehouse.branch.name,
              }))}
              items={requisition.items.map((item) => ({
                id: item.id,
                productName: item.product.name,
                requestedQty: item.requestedQty.toString(),
                approvedQty: item.approvedQty.toString(),
              }))}
            />
          </CardContent>
        </Card>
      )}

      {canApprove && requisition.status === 'APPROVED' && !requisition.sourceWarehouseId && (
        <Card>
          <CardContent className="p-6">
            <div className="mb-4 text-sm font-semibold">Assign warehouse</div>
            <AssignWarehouseForm
              requisitionId={requisition.id}
              warehouses={warehouses.map((warehouse) => ({
                id: warehouse.id,
                name: warehouse.name,
                code: warehouse.code,
                branchName: warehouse.branch.name,
              }))}
            />
          </CardContent>
        </Card>
      )}

      {requisition.sourceWarehouseId &&
        ['WAREHOUSE_ASSIGNED', 'PICKING', 'PACKED'].includes(requisition.status) &&
        remainingDispatchItems.length > 0 &&
        (!latestTransfer || ['RECEIVED', 'COMPLETED', 'CANCELLED'].includes(latestTransfer.status)) && (
          <Card>
            <CardContent className="p-6">
              <div className="mb-4 text-sm font-semibold">Warehouse dispatch</div>
              <StockDispatchForm requisitionId={requisition.id} items={remainingDispatchItems} />
            </CardContent>
          </Card>
        )}

      {requisition.transfers.length > 0 && (
        <Card>
          <CardContent className="space-y-6 p-6">
            <div className="text-sm font-semibold">Transfers</div>
            {requisition.transfers.map((transfer) => {
              const actions = transferActions(transfer.status);
              const allowReceive =
                ['DISPATCHED', 'IN_TRANSIT'].includes(transfer.status) &&
                activeBranchId &&
                activeBranchId === transfer.toBranchId;
              return (
                <div key={transfer.id} className="rounded-xl border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">{transfer.number}</div>
                      <div className="text-xs text-muted-foreground">
                        {transfer.fromWarehouse.name} to {transfer.toWarehouse.name}
                      </div>
                    </div>
                    <Pill tone={STATUS_TONE[transfer.status] ?? 'neutral'}>
                      {transfer.status.replaceAll('_', ' ').toLowerCase()}
                    </Pill>
                  </div>

                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                        <tr>
                          <th className="py-2">Product</th>
                          <th className="py-2 text-right">Qty</th>
                          <th className="py-2 text-right">Received</th>
                          <th className="py-2 text-right">Damaged</th>
                          <th className="py-2 text-right">Missing</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {transfer.items.map((item) => (
                          <tr key={item.id}>
                            <td className="py-3">
                              {item.product.name}
                              <span className="ml-2 text-xs text-muted-foreground">{item.product.sku}</span>
                            </td>
                            <td className="py-3 text-right">{item.quantity.toString()}</td>
                            <td className="py-3 text-right">{item.receivedQty.toString()}</td>
                            <td className="py-3 text-right">{item.damagedQty.toString()}</td>
                            <td className="py-3 text-right">{item.missingQty.toString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {allowReceive && (
                    <div className="mt-4">
                      <div className="mb-2 text-sm font-medium">Showroom receive</div>
                      <StockReceiveForm
                        transferId={transfer.id}
                        items={transfer.items.map((item) => ({
                          id: item.id,
                          productName: item.product.name,
                          quantity: item.quantity.toString(),
                        }))}
                      />
                    </div>
                  )}

                  {!allowReceive && actions.length > 0 && (
                    <div className="mt-4">
                      <StockTransferStatusForm transferId={transfer.id} actions={actions} />
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
