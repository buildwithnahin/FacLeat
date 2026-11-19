import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { backendFetch } from '@/lib/backend-client';
import { ProductionIssueForm } from './production-issue-form';
import { updateProductionIssueStatusAction } from '@/server/actions/factory';
import { UNITS } from '@/server/validators/factory';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Production Issue' };

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  REQUESTED: 'Submitted',
  APPROVED: 'Approved',
  ISSUED: 'Issued',
  REJECTED: 'Rejected',
};

interface Material {
  productId: string;
  plannedQty: string;
  consumedQty: string;
  unit: string;
  product: { id: string; name: string; sku: string };
}

interface Order {
  id: string;
  number: string;
  notes: string | null;
  product: { id: string; name: string; sku: string };
  materials: Material[];
  isIssueCompleted?: boolean;
}

interface Warehouse {
  id: string;
  name: string;
  code: string;
  type: string;
}

interface IssueItem {
  id: string;
  issuedQty: string;
  uom: string;
  product: { id: string; name: string; sku: string };
}

interface Issue {
  id: string;
  voucherNo: string;
  status: string;
  date: string;
  createdAt?: string;
  order: { id: string; number: string; product: { name: string; sku: string } };
  warehouse: { id: string; name: string };
  items: IssueItem[];
}

export default async function ProductionIssuePage() {
  const { orders, warehouses, issues } = await backendFetch<{
    orders: Order[];
    allOrders?: Order[];
    warehouses: Warehouse[];
    issues: Issue[];
  }>('/api/mobile/factory/production-issue?includeCompleted=true');

  const sortedIssues = [...issues].sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : new Date(a.date).getTime();
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : new Date(b.date).getTime();
    if (timeA !== timeB) return timeB - timeA;
    return b.voucherNo.localeCompare(a.voucherNo, undefined, { numeric: true });
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="WIP Production Issue"
        description="Issue raw materials from RM warehouse into production against a production order."
      />

      <ProductionIssueForm
        orders={orders.map((order) => ({
          id: order.id,
          number: order.number,
          productLabel: `${order.product.name} (${order.product.sku})`,
          department: order.notes || '-',
          isIssueCompleted: Boolean(order.isIssueCompleted),
          materials: order.materials.map((material) => ({
            productId: material.productId,
            label: `${material.product.name} (${material.product.sku})`,
            plannedQty: material.plannedQty.toString(),
            consumedQty: material.consumedQty.toString(),
            unit: material.unit as (typeof UNITS)[number],
          })),
        }))}
        warehouses={warehouses.map((warehouse) => ({
          id: warehouse.id,
          label: `${warehouse.name} (${warehouse.code})`,
        }))}
      />

      <Card className="p-0">
        <div className="px-4 py-3 border-b text-sm font-medium">Issue Vouchers</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Issue No</th>
                <th className="px-4 py-3 text-left">Production Order</th>
                <th className="px-4 py-3 text-left">Warehouse</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Items</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedIssues.map((issue) => (
                <tr key={issue.id} className="border-t align-top">
                  <td className="px-4 py-3 font-medium">{issue.voucherNo}</td>
                  <td className="px-4 py-3">
                    <div>{issue.order.number}</div>
                    <div className="text-xs text-muted-foreground">{issue.order.product.name}</div>
                  </td>
                  <td className="px-4 py-3">{issue.warehouse.name}</td>
                  <td className="px-4 py-3">{new Date(issue.date).toISOString().slice(0, 10)}</td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      {issue.items.map((item) => (
                        <div key={item.id} className="text-xs">
                          {item.product.name} • {item.issuedQty.toString()} {item.uom}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">{STATUS_LABELS[issue.status] ?? issue.status}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {issue.status === 'DRAFT' ? (
                        <form action={updateProductionIssueStatusAction}>
                          <input type="hidden" name="voucherId" value={issue.id} />
                          <input type="hidden" name="status" value="REQUESTED" />
                          <Button size="sm" variant="outline" type="submit">Submit</Button>
                        </form>
                      ) : null}
                      {issue.status === 'REQUESTED' ? (
                        <form action={updateProductionIssueStatusAction}>
                          <input type="hidden" name="voucherId" value={issue.id} />
                          <input type="hidden" name="status" value="APPROVED" />
                          <Button size="sm" variant="outline" type="submit">Approve</Button>
                        </form>
                      ) : null}
                      {issue.status === 'APPROVED' ? (
                        <form action={updateProductionIssueStatusAction}>
                          <input type="hidden" name="voucherId" value={issue.id} />
                          <input type="hidden" name="status" value="ISSUED" />
                          <Button size="sm" type="submit">Issue</Button>
                        </form>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {sortedIssues.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    No production issue vouchers yet.
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
