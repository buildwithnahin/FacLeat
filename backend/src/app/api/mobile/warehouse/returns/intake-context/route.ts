import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { prisma } from '@/server/db';
import { authorize } from '@/server/auth/authorize';
import { warehouseService } from '@/server/services/warehouse.service';
import { requireWarehouseByType } from '@/server/services/warehouse-workflows.service';
import { ApiError } from '@/lib/errors';

/**
 * Composite read for the "new customer return" screen: destination
 * warehouses, the branch's quarantine warehouse (or null so the page can
 * show its "create one first" message), a product picklist, and the last
 * 100 sale/invoice/order documents per channel for the source-document
 * dropdown — mirrors what the root Server Component fetched directly via
 * Prisma before the web/backend split.
 */
export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const branchId = req.nextUrl.searchParams.get('branchId');
  if (!branchId) return Response.json(apiError('branchId is required'), { status: 400 });

  try {
    await authorize(session, 'inventory:return', { branchId });

    const [warehouses, quarantine, products, posSales, wholesaleInvoices, corporateInvoices, ecommerceOrders] =
      await Promise.all([
        warehouseService.listActiveForBranch(session, branchId),
        requireWarehouseByType(branchId, 'QUARANTINE'),
        prisma.product.findMany({
          where: { isActive: true },
          orderBy: { name: 'asc' },
          select: { id: true, sku: true, barcode: true, name: true, unit: true },
        }),
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

    return Response.json(
      apiOk({
        warehouses: warehouses.map((w) => ({ id: w.id, name: w.name, code: w.code })),
        quarantineWarehouse: quarantine ? { id: quarantine.id, name: quarantine.name, code: quarantine.code } : null,
        products: products.map((p) => ({ id: p.id, sku: p.sku, barcode: p.barcode, name: p.name, unit: p.unit })),
        sourceDocuments: {
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
        },
      }),
    );
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/warehouse/returns/intake-context failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
