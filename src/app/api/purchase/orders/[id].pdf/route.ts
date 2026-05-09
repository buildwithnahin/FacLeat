import { getSession } from '@/server/auth/session';
import { purchaseService } from '@/server/services/purchase.service';
import { createSimplePdf, pdfResponse } from '@/server/pdf/simple-pdf';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const po = await purchaseService.getPurchaseOrder(session, id);

  const bytes = await createSimplePdf({
    title: `Purchase Order ${po.number}`,
    subtitle: `${po.supplier.name} · ${po.status}`,
    sections: [
      {
        title: 'Order Details',
        rows: [
          ['Supplier', po.supplier.name],
          ['Branch', po.branch.name],
          ['Order date', po.orderDate.toISOString().slice(0, 10)],
          ['Delivery date', po.deliveryDate ? po.deliveryDate.toISOString().slice(0, 10) : ''],
          ['Currency', po.currency],
          ['Grand total', po.grandTotal.toString()],
        ],
      },
      {
        title: 'Items',
        table: {
          headers: ['SKU', 'Description', 'Qty', 'Unit', 'Price', 'Line total'],
          rows: po.items.map((it) => [
            it.product.sku,
            it.description || it.product.name,
            it.orderedQty.toString(),
            it.unit,
            it.unitPrice.toString(),
            it.lineTotal.toString(),
          ]),
        },
      },
    ],
  });

  return pdfResponse(`purchase-order-${po.number}.pdf`, bytes);
}
