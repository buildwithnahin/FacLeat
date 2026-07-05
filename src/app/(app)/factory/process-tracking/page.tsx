import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { prisma } from '@/server/db';
import { getSession } from '@/server/auth/session';
import { authorize } from '@/server/auth/authorize';
import { factoryWorkflowService } from '@/server/services/factory-workflow.service';
import { ProcessTrackingForm } from './process-tracking-form';

export const metadata = { title: 'Process Tracking' };

export default async function ProcessTrackingPage() {
  const session = await getSession();
  await authorize(session, 'factory:read');
  const branchId = session?.activeBranchId;

  const [orders, employees, trackings] = await Promise.all([
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
    factoryWorkflowService.listProcessTrackings(session, branchId),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="WIP Process Tracking"
        description="Track stage-by-stage production progress, scrap, rejection, and output."
      />

      <ProcessTrackingForm
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
        <div className="px-4 py-3 border-b text-sm font-medium">Tracking Records</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Tracking No</th>
                <th className="px-4 py-3 text-left">Order</th>
                <th className="px-4 py-3 text-left">Process</th>
                <th className="px-4 py-3 text-left">Operator</th>
                <th className="px-4 py-3 text-right">Input</th>
                <th className="px-4 py-3 text-right">Output</th>
                <th className="px-4 py-3 text-right">Scrap</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {trackings.map((tracking) => (
                <tr key={tracking.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{tracking.trackingNo}</td>
                  <td className="px-4 py-3">
                    <div>{tracking.order.number}</div>
                    <div className="text-xs text-muted-foreground">{tracking.product.name}</div>
                  </td>
                  <td className="px-4 py-3">{tracking.stage.name}</td>
                  <td className="px-4 py-3">
                    {tracking.operator ? `${tracking.operator.firstName} ${tracking.operator.lastName}` : '-'}
                  </td>
                  <td className="px-4 py-3 text-right">{tracking.inputQty.toString()}</td>
                  <td className="px-4 py-3 text-right">{tracking.outputQty.toString()}</td>
                  <td className="px-4 py-3 text-right">{tracking.scrapQty.toString()}</td>
                  <td className="px-4 py-3">{tracking.status}</td>
                </tr>
              ))}
              {trackings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    No process tracking records yet.
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
