import { getSession } from '@/server/auth/session';
import { purchaseService } from '@/server/services/purchase.service';
import { createSimplePdf, pdfResponse } from '@/server/pdf/simple-pdf';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const invoice = await purchaseService.getInvoice(session, id);

  const bytes = await createSimplePdf({
    title: `Purchase Invoice ${invoice.number}`,
    subtitle: `${invoice.supplier.name} · ${invoice.status}`,
    sections: [
      {
        title: 'Invoice Details',
        rows: [
          ['Supplier', invoice.supplier.name],
          ['Invoice date', invoice.invoiceDate.toISOString().slice(0, 10)],
          ['Due date', invoice.dueDate ? invoice.dueDate.toISOString().slice(0, 10) : ''],
          ['Currency', invoice.currency],
          ['Grand total', invoice.grandTotal.toString()],
          ['Paid', invoice.paidAmount.toString()],
          ['Matching', invoice.matching],
        ],
      },
      {
        title: 'Items',
        table: {
          headers: ['SKU', 'Description', 'Qty', 'Unit price', 'Tax', 'Line total'],
          rows: invoice.items.map((it) => [
            it.product.sku,
            it.description || it.product.name,
            it.quantity.toString(),
            it.unitPrice.toString(),
            `${it.taxRate.toString()}%`,
            it.lineTotal.toString(),
          ]),
        },
      },
    ],
  });

  return pdfResponse(`purchase-invoice-${invoice.number}.pdf`, bytes);
}
