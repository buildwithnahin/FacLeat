import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { backendFetch } from '@/lib/backend-client';
import { ProductionReceiveForm } from './production-receive-form';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Production Receive' };

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

interface ReceiveRow {
  id: string;
  voucher: string | null;
  inQty: string;
  outQty: string;
  createdAt?: string;
  date?: string;
  order: { id: string; number: string };
  stage: { id: string; name: string } | null;
  product: { id: string; name: string };
}

export default async function ProductionReceivePage() {
  const { orders, employees, receives } = await backendFetch<{
    orders: Order[];
    allOrders?: Order[];
    employees: Employee[];
    receives: ReceiveRow[];
  }>('/api/mobile/factory/production-receive?includeCompleted=true');

  const sortedReceives = [...receives].sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (timeA !== timeB) return timeB - timeA;
    return (b.voucher ?? '').localeCompare(a.voucher ?? '', undefined, { numeric: true });
  });

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
              {sortedReceives.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{row.voucher ?? '-'}</td>
                  <td className="px-4 py-3">{row.order.number}</td>
                  <td className="px-4 py-3">{row.stage?.name ?? '-'}</td>
                  <td className="px-4 py-3">{row.product.name}</td>
                  <td className="px-4 py-3 text-right">{row.inQty.toString()}</td>
                  <td className="px-4 py-3 text-right">{row.outQty.toString()}</td>
                </tr>
              ))}
              {sortedReceives.length === 0 ? (
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
