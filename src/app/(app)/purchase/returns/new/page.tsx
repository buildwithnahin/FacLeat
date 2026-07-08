import { PageHeader } from '@/components/shared/page-header';
import { DebitNoteForm } from '../debit-note-form';
import { prisma } from '@/server/db';

export const metadata = { title: 'New Purchase Return' };

export default async function NewDebitNotePage({
  searchParams,
}: {
  searchParams: Promise<{ supplierId?: string; invoiceId?: string; grnId?: string }>;
}) {
  const sp = await searchParams;
  const [branches, suppliers, warehouses, products] = await Promise.all([
    prisma.branch.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true, currency: true },
    }),
    prisma.supplier.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true, branchId: true, currency: true },
    }),
    prisma.warehouse.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true, branchId: true },
    }),
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { sku: 'asc' },
      select: { id: true, sku: true, name: true, unit: true, costPrice: true },
    }),
  ]);

  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader
        title="Create Purchase Return"
        description="Issue a debit note against a supplier for returned goods"
      />
      <DebitNoteForm
        branches={branches}
        suppliers={suppliers}
        warehouses={warehouses}
        products={products.map((p) => ({
          id: p.id,
          sku: p.sku,
          name: p.name,
          unit: p.unit,
          costPrice: p.costPrice.toString(),
        }))}
        prefill={{
          supplierId: sp.supplierId ?? '',
          invoiceId: sp.invoiceId ?? '',
          grnId: sp.grnId ?? '',
        }}
      />
    </div>
  );
}
