import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { backendFetch } from '@/lib/backend-client';
import { ProcessTrackingForm } from './process-tracking-form';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Process Tracking' };

interface Stage {
  id: string;
  sequence: number;
  name: string;
}

interface Order {
  id: string;
  number: string;
  productId: string;
  product: { id: string; name: string; sku: string };
  stages: Stage[];
  isCompleted?: boolean;
}

interface Employee {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
}

interface Tracking {
  id: string;
  trackingNo: string;
  status: string;
  inputQty: string;
  outputQty: string;
  scrapQty: string;
  createdAt?: string;
  order: { id: string; number: string };
  product: { id: string; name: string };
  stage: { id: string; name: string };
  operator: { id: string; firstName: string; lastName: string } | null;
}

export default async function ProcessTrackingPage() {
  const { orders, employees, trackings } = await backendFetch<{
    orders: Order[];
    allOrders?: Order[];
    employees: Employee[];
    trackings: Tracking[];
  }>('/api/mobile/factory/process-tracking?includeCompleted=true');

  const sortedTrackings = [...trackings].sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (timeA !== timeB) return timeB - timeA;
    return b.trackingNo.localeCompare(a.trackingNo, undefined, { numeric: true });
  });

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
          isCompleted: Boolean(order.isCompleted),
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
              {sortedTrackings.map((tracking) => (
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
              {sortedTrackings.length === 0 ? (
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
