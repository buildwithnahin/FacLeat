import { getSession } from '@/server/auth/session';
import { wholesaleService } from '@/server/services/wholesale.service';
import { createSimplePdf, pdfResponse } from '@/server/pdf/simple-pdf';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const invoice = await wholesaleService.getInvoice(session, id);

  const bytes = await createSimplePdf({
    title: `Wholesale Invoice ${invoice.number}`,
    subtitle: `${invoice.customer.name} · ${invoice.status}`,
    sections: [
      {
        title: 'Invoice Details',
        rows: [
          ['Customer', invoice.customer.name],
          ['Warehouse', invoice.warehouse.name],
          ['Invoice date', invoice.invoiceDate.toISOString().slice(0, 10)],
          ['Due date', invoice.dueDate ? invoice.dueDate.toISOString().slice(0, 10) : ''],
          ['Grand total', invoice.grandTotal.toString()],
          ['Paid', invoice.paidTotal.toString()],
          ['Balance due', invoice.balanceDue.toString()],
        ],
      },
      {
        title: 'Items',
        table: {
          headers: ['SKU', 'Description', 'Qty', 'Unit price', 'Discount', 'Line total'],
          rows: invoice.items.map((it) => [
            it.product.sku,
            it.description || it.product.name,
            it.quantity.toString(),
            it.unitPrice.toString(),
            `${it.discountRate.toString()}%`,
            it.lineTotal.toString(),
          ]),
        },
      },
    ],
  });

  return pdfResponse(`wholesale-invoice-${invoice.number}.pdf`, bytes);
}
