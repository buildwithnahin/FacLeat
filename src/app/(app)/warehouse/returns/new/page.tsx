import { getSession } from '@/server/auth/session';
import { warehouseService } from '@/server/services/warehouse.service';
import { prisma } from '@/server/db';
import { createCustomerReturnAction } from '@/server/actions/warehouse-workflows';
import { PageHeader } from '@/components/shared/page-header';
import { ReturnIntakeForm } from '@/components/shared/return-intake-form';
import { Card } from '@/components/ui/card';

export const metadata = { title: 'New Customer Return' };

export default async function NewCustomerReturnPage() {
  const session = await getSession();
  const branchId = session?.activeBranchId;
  if (!branchId) {
    return (
      <div>
        <PageHeader title="New Customer Return" />
        <Card className="p-6 text-sm text-muted-foreground">
          Select an active branch from the topbar first.
        </Card>
      </div>
    );
  }

  const [warehouses, quarantine, products] = await Promise.all([
    warehouseService.listActiveForBranch(session, branchId),
    prisma.warehouse.findFirst({ where: { branchId, type: 'QUARANTINE', isActive: true } }),
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, sku: true, barcode: true, name: true, unit: true },
    }),
  ]);

  if (!quarantine) {
    return (
      <div>
        <PageHeader title="New Customer Return" />
        <Card className="p-6 text-sm text-muted-foreground">
          Create an active `QUARANTINE` warehouse on this branch before using return inspection.
        </Card>
      </div>
    );
  }

  const [posSales, wholesaleInvoices, corporateInvoices, ecommerceOrders] = await Promise.all([
    prisma.posSale.findMany({
      where: { branchId },
      orderBy: { saleDate: 'desc' },
      take: 100,
      select: { number: true, customer: { select: { name: true } }, saleDate: true },
    }),
    prisma.wholesaleInvoice.findMany({
      where: { branchId },
      orderBy: { invoiceDate: 'desc' },
      take: 100,
      select: { number: true, customer: { select: { name: true } }, invoiceDate: true },
    }),
    prisma.corporateInvoice.findMany({
      where: { branchId },
      orderBy: { invoiceDate: 'desc' },
      take: 100,
      select: { number: true, customer: { select: { name: true } }, invoiceDate: true },
    }),
    prisma.ecommerceOrder.findMany({
      where: { branchId },
      orderBy: { orderDate: 'desc' },
      take: 100,
      select: { number: true, customerName: true, orderDate: true },
    }),
  ]);

  const sourceDocuments = {
    POS: posSales.map((sale) => ({
      value: sale.number,
      label: `${sale.number}${sale.customer?.name ? ` - ${sale.customer.name}` : ''}`,
    })),
    WHOLESALE: wholesaleInvoices.map((invoice) => ({
      value: invoice.number,
      label: `${invoice.number}${invoice.customer?.name ? ` - ${invoice.customer.name}` : ''}`,
    })),
    CORPORATE: corporateInvoices.map((invoice) => ({
      value: invoice.number,
      label: `${invoice.number}${invoice.customer?.name ? ` - ${invoice.customer.name}` : ''}`,
    })),
    ECOMMERCE: ecommerceOrders.map((order) => ({
      value: order.number,
      label: `${order.number}${order.customerName ? ` - ${order.customerName}` : ''}`,
    })),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Customer Return"
        description="Receive returned items into inspection, then route them after QC."
      />
      <ReturnIntakeForm
        branchId={branchId}
        warehouses={warehouses.map((warehouse) => ({ id: warehouse.id, name: warehouse.name, code: warehouse.code }))}
        products={products.map((product) => ({
          id: product.id,
          sku: product.sku,
          barcode: product.barcode,
          name: product.name,
          unit: product.unit,
        }))}
        sourceDocuments={sourceDocuments}
        action={createCustomerReturnAction}
      />
    </div>
  );
}
