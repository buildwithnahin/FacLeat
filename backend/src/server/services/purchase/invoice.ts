import 'server-only';
import { Prisma, type SystemAccountKey, type ProductType } from '@prisma/client';
import { prisma } from '@/server/db';
import { authorize } from '@/server/auth/authorize';
import { recordAudit } from '@/server/audit/logger';
import { assertOpenPeriod } from '@/server/periods/guards';
import { approvalService } from '@/server/services/approval.service';
import { accountsService } from '@/server/services/accounts.service';
import { getScopedBranchIds } from '@/server/auth/scope';
import type { AppSession } from '@/server/auth/session';
import type { JournalLineInput } from '@/server/validators/accounts';
import type { InvoiceCreateInput } from '@/server/validators/purchase';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { ZERO, isShoesCategory, normalizeSize, INVENTORY_KEY_BY_PRODUCT_TYPE } from './shared';

export const invoiceMethods = {
  async listInvoices(
    session: AppSession | null,
    filters: { branchId?: string; status?: string; supplierId?: string; search?: string } = {},
  ) {
    await authorize(session, 'purchase:read');
    const branchIds = await getScopedBranchIds(session, filters.branchId);
    const search = filters.search?.trim();
    return prisma.purchaseInvoice.findMany({
      where: {
        ...(branchIds ? { branchId: { in: branchIds } } : {}),
        status: filters.status,
        supplierId: filters.supplierId,
        ...(search
          ? {
              OR: [
                { number: { contains: search } },
                { supplier: { name: { contains: search } } },
                { supplier: { code: { contains: search } } },
                { purchaseOrder: { number: { contains: search } } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        purchaseOrder: { select: { id: true, number: true } },
        grn: { select: { id: true, number: true } },
      },
    });
  },

  async getInvoice(session: AppSession | null, id: string) {
    await authorize(session, 'purchase:read');
    const invoice = await prisma.purchaseInvoice.findUnique({
      where: { id },
      include: {
        supplier: true,
        purchaseOrder: true,
        grn: true,
        items: {
          include: { product: { select: { id: true, sku: true, name: true } } },
        },
        payments: { orderBy: { paymentDate: 'desc' } },
      },
    });
    if (!invoice) throw new NotFoundError('Invoice not found');
    return invoice;
  },

  async createInvoice(session: AppSession | null, input: InvoiceCreateInput) {
    const actor = await authorize(session, 'purchase:invoice');

    const supplier = await prisma.supplier.findUnique({ where: { id: input.supplierId } });
    if (!supplier) throw new NotFoundError('Supplier not found');
    const productIds = [...new Set(input.items.map((it) => it.productId))];
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, category: { select: { name: true } }, size: true, type: true },
    });
    const productById = new Map(products.map((p) => [p.id, p]));

    return prisma.$transaction(async (tx) => {
      await assertOpenPeriod(tx, supplier.branchId, input.invoiceDate);

      const year = new Date().getFullYear();
      const yearCount = await tx.purchaseInvoice.count({
        where: { createdAt: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) } },
      });
      const number = `SUPI-${String(yearCount + 1).padStart(3, '0')}-${year}`;

      let subtotal = new Prisma.Decimal(0);
      let taxTotal = new Prisma.Decimal(0);
      const grossByType = new Map<ProductType, Prisma.Decimal>();
      const itemRows = input.items.map((it) => {
        const product = productById.get(it.productId);
        if (!product) throw new ValidationError('Selected product was not found');
        const size = normalizeSize(it.size) ?? product.size;
        if (isShoesCategory(product.category?.name) && !size) {
          throw new ValidationError('Size is required for shoes in purchase invoices');
        }
        const qty = new Prisma.Decimal(it.quantity);
        const price = new Prisma.Decimal(it.unitPrice);
        const tax = new Prisma.Decimal(it.taxRate);
        const gross = qty.mul(price);
        const taxAmount = gross.mul(tax).div(100);
        subtotal = subtotal.plus(gross);
        taxTotal = taxTotal.plus(taxAmount);
        grossByType.set(product.type, (grossByType.get(product.type) ?? new Prisma.Decimal(0)).plus(gross));
        return {
          productId: it.productId,
          size,
          description: it.description || null,
          unit: it.unit,
          quantity: qty,
          unitPrice: price,
          taxRate: tax,
          lineTotal: gross.plus(taxAmount),
        };
      });
      const discountTotal = new Prisma.Decimal(input.discountTotal);
      const grandTotal = subtotal.plus(taxTotal).minus(discountTotal);

      let matching: 'MATCHED' | 'UNMATCHED' = 'UNMATCHED';
      if (input.purchaseOrderId) {
        const po = await tx.purchaseOrder.findUnique({
          where: { id: input.purchaseOrderId },
          select: { grandTotal: true },
        });
        if (po && po.grandTotal.equals(grandTotal)) matching = 'MATCHED';
      }

      const invoice = await tx.purchaseInvoice.create({
        data: {
          branchId: supplier.branchId,
          number,
          supplierId: supplier.id,
          purchaseOrderId: input.purchaseOrderId || null,
          grnId: input.grnId || null,
          status: 'DRAFT',
          matching,
          invoiceDate: input.invoiceDate,
          dueDate: input.dueDate,
          currency: input.currency,
          subtotal,
          taxTotal,
          discountTotal,
          grandTotal,
          paidAmount: new Prisma.Decimal(0),
          notes: input.notes || null,
          createdById: actor.userId,
          items: { create: itemRows },
        },
      });

      // Post supplier payable (ledger debit)
      await tx.supplierLedger.create({
        data: {
          branchId: supplier.branchId,
          supplierId: supplier.id,
          entryType: 'PURCHASE',
          refType: 'INVOICE',
          refId: invoice.id,
          description: `Invoice ${number}${input.purchaseOrderId ? ` (${input.purchaseOrderId})` : ''}`,
          debit: grandTotal,
          credit: new Prisma.Decimal(0),
          entryDate: input.invoiceDate,
          createdById: actor.userId,
        },
      });

      // GL posting — Dr Inventory (routed per product type) + Tax
      // Recoverable, Cr Accounts Payable. Discount is distributed pro-rata
      // across the inventory buckets so the entry always balances.
      if (grandTotal.gt(ZERO)) {
        const typeKeys = [...grossByType.keys()].map((t) => INVENTORY_KEY_BY_PRODUCT_TYPE[t]);
        const keys: SystemAccountKey[] = [...new Set(typeKeys), 'AP_CONTROL'];
        if (taxTotal.gt(ZERO)) keys.push('TAX_RECOVERABLE');
        const acc = await accountsService.resolveSystemAccounts(tx, keys, supplier.branchId);

        const lines: JournalLineInput[] = [];
        for (const [type, gross] of grossByType) {
          const net = subtotal.gt(ZERO) ? gross.minus(gross.div(subtotal).mul(discountTotal)) : gross;
          if (net.lte(ZERO)) continue;
          lines.push({
            accountId: acc[INVENTORY_KEY_BY_PRODUCT_TYPE[type]],
            debit: net.toNumber(),
            credit: 0,
            currency: input.currency,
            fxRate: 1,
          });
        }
        if (taxTotal.gt(ZERO)) {
          lines.push({ accountId: acc.TAX_RECOVERABLE, debit: taxTotal.toNumber(), credit: 0, currency: input.currency, fxRate: 1 });
        }
        lines.push({ accountId: acc.AP_CONTROL, debit: 0, credit: grandTotal.toNumber(), currency: input.currency, fxRate: 1 });

        await accountsService.postSystemJournal(tx, {
          branchId: supplier.branchId,
          date: input.invoiceDate,
          memo: `Purchase invoice ${number}`,
          sourceModule: 'purchase',
          sourceRefType: 'PurchaseInvoice',
          sourceRefId: invoice.id,
          actorUserId: actor.userId,
          lines,
        });
      }

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: supplier.branchId,
          module: 'purchase',
          action: 'invoice.create',
          entityType: 'PurchaseInvoice',
          entityId: invoice.id,
          after: {
            number,
            grandTotal: grandTotal.toString(),
            matching,
            supplierId: supplier.id,
          },
        },
        tx,
      );

      return invoice;
    });
  },

  async approveInvoice(session: AppSession | null, id: string) {
    const actor = await authorize(session, 'purchase:approve');
    const existing = await prisma.purchaseInvoice.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Invoice not found');
    if (existing.status !== 'DRAFT') {
      throw new ValidationError(`Cannot approve invoice in ${existing.status} state`);
    }
    await approvalService.ensureApprovedOrRequest(session, {
      module: 'purchase',
      action: 'invoice-approve',
      entityType: 'PurchaseInvoice',
      entityId: existing.id,
      title: `Purchase invoice ${existing.number}`,
      summary: `Approval required before posting invoice ${existing.number}`,
      amount: existing.grandTotal.toNumber(),
      currency: existing.currency,
      branchId: existing.branchId,
    });
    return prisma.$transaction(async (tx) => {
      const invoice = await tx.purchaseInvoice.update({
        where: { id },
        data: { status: 'PENDING' },
      });
      await recordAudit(
        {
          actorId: actor.userId,
          branchId: invoice.branchId,
          module: 'purchase',
          action: 'invoice.approve',
          entityType: 'PurchaseInvoice',
          entityId: invoice.id,
          before: { status: existing.status },
          after: { status: invoice.status },
        },
        tx,
      );
      return invoice;
    });
  },
};
