import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { prisma } from '@/server/db';
import { getSession } from '@/server/auth/session';
import { authorize } from '@/server/auth/authorize';
import { factoryWorkflowService } from '@/server/services/factory-workflow.service';
import { ProductionReceiveForm } from './production-receive-form';

export const metadata = { title: 'Production Receive' };

export default async function ProductionReceivePage() {
  const session = await getSession();
  await authorize(session, 'factory:read');
  const branchId = session?.activeBranchId;

  const [orders, employees, receives] = await Promise.all([
    prisma.productionOrder.findMany({
      where: {
        branchId: branchId || undefined,
        status: { in: ['PLANNED', 'IN_PROGRESS'] },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        product: { select: { id: true, name: true, sku: true } },
        stages: { orderBy: { sequence: 'asc' } },
      },
    }),
    prisma.employee.findMany({
      where: { branchId: branchId || undefined, status: 'ACTIVE' },
      orderBy: { code: 'asc' },
      select: { id: true, code: true, firstName: true, lastName: true },
    }),
    factoryWorkflowService.listProductionReceives(session, branchId),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="WIP / Production Receive"
        description="Receive stage output into the next process and update the WIP ledger."
      />

      <ProductionReceiveForm
        orders={orders.map((order) => ({
          id: order.id,
          label: `${order.number} — ${order.product.name} (${order.product.sku})`,
          productId: order.productId,
          stages: order.stages.map((stage) => ({
            id: stage.id,
            label: `${stage.sequence}. ${stage.name}`,
          })),
        }))}
        operators={employees.map((employee) => ({
          id: employee.id,
          label: `${employee.code} · ${employee.firstName} ${employee.lastName}`,
        }))}
      />

      <Card className="p-0">
        <div className="px-4 py-3 border-b text-sm font-medium">Recent Production Receives</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Receive No</th>
                <th className="px-4 py-3 text-left">Order</th>
                <th className="px-4 py-3 text-left">Process</th>
                <th className="px-4 py-3 text-left">Product</th>
                <th className="px-4 py-3 text-right">In Qty</th>
                <th className="px-4 py-3 text-right">Out Qty</th>
              </tr>
            </thead>
            <tbody>
              {receives.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{row.voucher ?? '-'}</td>
                  <td className="px-4 py-3">{row.order.number}</td>
                  <td className="px-4 py-3">{row.stage?.name ?? '-'}</td>
                  <td className="px-4 py-3">{row.product.name}</td>
                  <td className="px-4 py-3 text-right">{row.inQty.toString()}</td>
                  <td className="px-4 py-3 text-right">{row.outQty.toString()}</td>
                </tr>
              ))}
              {receives.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No production receive records yet.
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
