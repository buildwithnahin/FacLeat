import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { prisma } from '@/server/db';
import { getSession } from '@/server/auth/session';
import { authorize } from '@/server/auth/authorize';
import { factoryWorkflowService } from '@/server/services/factory-workflow.service';
import { FinishedGoodsReceiveForm } from './finished-goods-receive-form';

export const metadata = { title: 'Finished Goods Receive' };

export default async function FinishedGoodsReceivePage() {
  const session = await getSession();
  await authorize(session, 'factory:read');
  const branchId = session?.activeBranchId;

  const [orders, warehouses, vouchers] = await Promise.all([
    prisma.productionOrder.findMany({
      where: {
        branchId: branchId || undefined,
        status: { in: ['IN_PROGRESS', 'COMPLETED'] },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        product: { select: { id: true, name: true, sku: true } },
        stages: { orderBy: { sequence: 'asc' } },
      },
    }),
    prisma.warehouse.findMany({
      where: { branchId: branchId || undefined, isActive: true, type: { in: ['MAIN', 'STORE', 'SHOWROOM'] } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true },
    }),
    factoryWorkflowService.listFinishedGoodsReceives(session, branchId),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finished Goods Receive"
        description="Receive completed finished goods into FG warehouse and reduce WIP balance."
      />

      <FinishedGoodsReceiveForm
        orders={orders.map((order) => ({
          id: order.id,
          label: `${order.number} — ${order.product.name} (${order.product.sku})`,
          productId: order.productId,
          unit: order.unit,
          stages: order.stages.map((stage) => ({
            id: stage.id,
            label: `${stage.sequence}. ${stage.name}`,
          })),
        }))}
        warehouses={warehouses.map((warehouse) => ({
          id: warehouse.id,
          label: `${warehouse.name} (${warehouse.code})`,
        }))}
      />

      <Card className="p-0">
        <div className="px-4 py-3 border-b text-sm font-medium">FG Receive Vouchers</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">FG Receive No</th>
                <th className="px-4 py-3 text-left">Production Order</th>
                <th className="px-4 py-3 text-left">FG Warehouse</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Items</th>
              </tr>
            </thead>
            <tbody>
              {vouchers.map((voucher) => (
                <tr key={voucher.id} className="border-t align-top">
                  <td className="px-4 py-3 font-medium">{voucher.receiveNo}</td>
                  <td className="px-4 py-3">
                    <div>{voucher.order.number}</div>
                    <div className="text-xs text-muted-foreground">{voucher.order.product.name}</div>
                  </td>
                  <td className="px-4 py-3">{voucher.warehouse.name}</td>
                  <td className="px-4 py-3">{voucher.date.toISOString().slice(0, 10)}</td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      {voucher.items.map((item) => (
                        <div key={item.id} className="text-xs">
                          {item.product.name} • {item.quantity.toString()} {item.uom} • {item.qualityStatus}
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {vouchers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No finished goods receive vouchers yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
