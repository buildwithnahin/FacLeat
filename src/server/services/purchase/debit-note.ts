import 'server-only';
import { Prisma, type SystemAccountKey, type ProductType } from '@prisma/client';
import { prisma } from '@/server/db';
import { authorize } from '@/server/auth/authorize';
import { recordAudit } from '@/server/audit/logger';
import { assertOpenPeriod } from '@/server/periods/guards';
import { accountsService } from '@/server/services/accounts.service';
import type { AppSession } from '@/server/auth/session';
import type { JournalLineInput } from '@/server/validators/accounts';
import type { DebitNoteCreateInput } from '@/server/validators/purchase';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { nextDocumentNumber } from '@/lib/document-number';
import { ZERO, INVENTORY_KEY_BY_PRODUCT_TYPE } from './shared';

export const debitNoteMethods = {
  async listDebitNotes(session: AppSession | null, filters: { supplierId?: string } = {}) {
    await authorize(session, 'purchase:read');
    return prisma.debitNote.findMany({
      where: { supplierId: filters.supplierId },
      orderBy: { createdAt: 'desc' },
      include: {
        supplier: { select: { id: true, code: true, name: true, currency: true } },
        items: { select: { id: true } },
      },
    });
  },

  async getDebitNote(session: AppSession | null, id: string) {
    await authorize(session, 'purchase:read');
    const debitNote = await prisma.debitNote.findUnique({
      where: { id },
      include: {
        supplier: true,
        invoice: { select: { id: true, number: true } },
        grn: { select: { id: true, number: true } },
        items: { include: { product: { select: { id: true, sku: true, name: true } } } },
      },
    });
    if (!debitNote) throw new NotFoundError('Debit note not found');
    return debitNote;
  },

  async createDebitNote(session: AppSession | null, input: DebitNoteCreateInput) {
    const actor = await authorize(session, 'purchase:return');

    const supplier = await prisma.supplier.findUnique({ where: { id: input.supplierId } });
    if (!supplier) throw new NotFoundError('Supplier not found');
    const warehouse = await prisma.warehouse.findUnique({ where: { id: input.warehouseId } });
    if (!warehouse || warehouse.branchId !== supplier.branchId) {
      throw new ValidationError('Warehouse does not belong to this branch');
    }

    return prisma.$transaction(async (tx) => {
      await assertOpenPeriod(tx, supplier.branchId, input.returnDate);

      const year = new Date().getFullYear();
      const yearCount = await tx.debitNote.count({
        where: { createdAt: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) } },
      });
      const number = nextDocumentNumber('DN', year, yearCount);

      const products = await tx.product.findMany({
        where: { id: { in: [...new Set(input.items.map((it) => it.productId))] } },
        select: { id: true, type: true },
      });
      const typeByProduct = new Map(products.map((p) => [p.id, p.type]));

      let totalAmount = new Prisma.Decimal(0);
      const amountByType = new Map<ProductType, Prisma.Decimal>();
      const itemRows = input.items.map((it) => {
        const qty = new Prisma.Decimal(it.returnedQty);
        const price = new Prisma.Decimal(it.unitPrice);
        const total = qty.mul(price);
        totalAmount = totalAmount.plus(total);
        const type = typeByProduct.get(it.productId) ?? 'CONSUMABLE';
        amountByType.set(type, (amountByType.get(type) ?? ZERO).plus(total));
        return {
          productId: it.productId,
          returnedQty: qty,
          unitPrice: price,
          total,
          reason: it.reason || null,
          condition: it.condition || null,
        };
      });
      const vatAdjustment = new Prisma.Decimal(input.vatAdjustment);
      const grandTotal = totalAmount.plus(vatAdjustment);

      const debitNote = await tx.debitNote.create({
        data: {
          branchId: supplier.branchId,
          number,
          supplierId: supplier.id,
          invoiceId: input.invoiceId || null,
          grnId: input.grnId || null,
          returnDate: input.returnDate,
          status: 'POSTED',
          totalAmount: grandTotal,
          vatAdjustment,
          reason: input.reason || null,
          createdById: actor.userId,
          items: { create: itemRows },
        },
        include: { items: true },
      });

      await tx.supplierLedger.create({
        data: {
          branchId: supplier.branchId,
          supplierId: supplier.id,
          entryType: 'ADJUSTMENT',
          refType: 'DEBIT_NOTE',
          refId: debitNote.id,
          description: `Purchase return ${number}`,
          debit: new Prisma.Decimal(0),
          credit: grandTotal,
          entryDate: input.returnDate,
          createdById: actor.userId,
        },
      });

      for (const item of debitNote.items) {
        await tx.inventoryLedger.create({
          data: {
            branchId: supplier.branchId,
            warehouseId: input.warehouseId,
            productId: item.productId,
            direction: 'OUT',
            quantity: item.returnedQty,
            costPerUnit: item.unitPrice,
            refType: 'DEBIT_NOTE',
            refId: debitNote.id,
            note: `${number} (return)`,
            createdById: actor.userId,
          },
        });
      }

      // GL posting — Dr Accounts Payable (reduces what's owed), Cr Inventory
      // (routed per product type) + Cr Tax Recoverable (reversing the input
      // tax credit taken on the original purchase).
      if (grandTotal.gt(ZERO)) {
        const typeKeys = [...amountByType.keys()].map((t) => INVENTORY_KEY_BY_PRODUCT_TYPE[t]);
        const keys: SystemAccountKey[] = ['AP_CONTROL', ...new Set(typeKeys)];
        if (vatAdjustment.gt(ZERO)) keys.push('TAX_RECOVERABLE');
        const acc = await accountsService.resolveSystemAccounts(tx, keys, supplier.branchId);

        const lines: JournalLineInput[] = [
          { accountId: acc.AP_CONTROL, debit: grandTotal.toNumber(), credit: 0, currency: supplier.currency, fxRate: 1 },
        ];
        for (const [type, amount] of amountByType) {
          if (amount.lte(ZERO)) continue;
          lines.push({
            accountId: acc[INVENTORY_KEY_BY_PRODUCT_TYPE[type]],
            debit: 0,
            credit: amount.toNumber(),
            currency: supplier.currency,
            fxRate: 1,
          });
        }
        if (vatAdjustment.gt(ZERO)) {
          lines.push({ accountId: acc.TAX_RECOVERABLE, debit: 0, credit: vatAdjustment.toNumber(), currency: supplier.currency, fxRate: 1 });
        }

        await accountsService.postSystemJournal(tx, {
          branchId: supplier.branchId,
          date: input.returnDate,
          memo: `Purchase return ${number}`,
          sourceModule: 'purchase',
          sourceRefType: 'DebitNote',
          sourceRefId: debitNote.id,
          actorUserId: actor.userId,
          lines,
        });
      }

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: supplier.branchId,
          module: 'purchase',
          action: 'debitnote.create',
          entityType: 'DebitNote',
          entityId: debitNote.id,
          after: {
            number,
            supplierId: supplier.id,
            totalAmount: grandTotal.toString(),
            itemCount: itemRows.length,
          },
        },
        tx,
      );

      return debitNote;
    });
  },
};
