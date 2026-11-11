import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { prisma } from '@/server/db';
import { warehouseWorkflowService } from '@/server/services/warehouse-workflows.service';
import { ApiError, NotFoundError } from '@/lib/errors';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Bundles the supplier / GRN / purchase-invoice picklists (needed by the
 * resolution form's supplier-claim option) alongside the report itself —
 * the root page fetched these with three extra direct Prisma calls scoped
 * to entry.branchId, which web/ can't do without its own round trip.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });

  const { id } = await params;
  try {
    const entry = await warehouseWorkflowService.getDamageReportById(session, id);
    // getDamageReportById destructures a single-element array internally
    // (hydrateDamageReportRelations), which TS types as possibly-undefined
    // under noUncheckedIndexedAccess even though it can't actually be empty
    // here — narrow explicitly rather than touching the shared service.
    if (!entry) throw new NotFoundError('Damage report not found');

    const [suppliers, grns, purchaseInvoices] = await Promise.all([
      entry.branchId
        ? prisma.supplier.findMany({
            where: { branchId: entry.branchId, status: 'ACTIVE' },
            orderBy: { name: 'asc' },
            select: { id: true, name: true, code: true },
          })
        : Promise.resolve([]),
      entry.branchId
        ? prisma.goodsReceiving.findMany({
            where: { branchId: entry.branchId, status: 'COMPLETED' },
            orderBy: { receivedDate: 'desc' },
            take: 100,
            select: { id: true, number: true, supplierId: true },
          })
        : Promise.resolve([]),
      entry.branchId
        ? prisma.purchaseInvoice.findMany({
            where: { branchId: entry.branchId },
            orderBy: { invoiceDate: 'desc' },
            take: 100,
            select: { id: true, number: true, supplierId: true },
          })
        : Promise.resolve([]),
    ]);

    return Response.json(
      apiOk({
        id: entry.id,
        number: entry.number,
        branchId: entry.branchId,
        status: entry.status,
        reason: entry.reason,
        estimatedValue: entry.estimatedValue.toString(),
        resolution: entry.resolution,
        resolutionNote: entry.resolutionNote,
        claimAmount: entry.claimAmount.toString(),
        claimReference: entry.claimReference,
        warehouse: entry.warehouse,
        quarantineWarehouse: entry.quarantineWarehouse,
        supplier: entry.supplier ? { id: entry.supplier.id, name: entry.supplier.name } : null,
        grn: entry.grn ? { id: entry.grn.id, number: entry.grn.number } : null,
        purchaseInvoice: entry.purchaseInvoice
          ? { id: entry.purchaseInvoice.id, number: entry.purchaseInvoice.number }
          : null,
        items: entry.items.map((item) => ({
          id: item.id,
          quantity: item.quantity.toString(),
          product: { name: item.product.name, unit: item.product.unit },
        })),
        suppliers,
        grns,
        purchaseInvoices,
      }),
    );
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/warehouse/damage-reports/[id] failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
