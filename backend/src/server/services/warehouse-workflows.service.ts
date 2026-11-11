import 'server-only';
import { Prisma, WarehouseType } from '@prisma/client';
import { prisma } from '@/server/db';
import { authorize } from '@/server/auth/authorize';
import { recordAudit } from '@/server/audit/logger';
import { assertOpenPeriod } from '@/server/periods/guards';
import { publishToPermission } from '@/server/notifications/publisher';
import { approvalService } from '@/server/services/approval.service';
import { nextDocumentNumber } from '@/lib/document-number';
import type { AppSession } from '@/server/auth/session';
import type {
  CustomerReturnInspectionInput,
  CustomerReturnIntakeInput,
  DamageRejectInput,
  DamageReportInput,
  DamageResolutionInput,
} from '@/server/validators/warehouse-workflows';
import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/errors';

type BalanceRow = { productId: string; warehouseId: string; balance: Prisma.Decimal };

async function getBalances(
  tx: Prisma.TransactionClient | typeof prisma,
  branchId: string,
  warehouseId: string,
  productIds: string[],
): Promise<BalanceRow[]> {
  if (productIds.length === 0) return [];
  const placeholders = productIds.map(() => '?').join(', ');
  const rows = await tx.$queryRawUnsafe<BalanceRow[]>(
    `SELECT \`productId\`, \`warehouseId\`,
            CAST(SUM(CASE WHEN direction = 'IN' THEN quantity ELSE -quantity END) AS DECIMAL(18,4)) AS balance
       FROM \`InventoryLedger\`
      WHERE \`branchId\` = ?
        AND \`warehouseId\` = ?
        AND \`productId\` IN (${placeholders})
      GROUP BY \`productId\`, \`warehouseId\``,
    branchId,
    warehouseId,
    ...productIds,
  );
  return rows.map((r) => ({
    productId: r.productId,
    warehouseId: r.warehouseId,
    balance: new Prisma.Decimal(r.balance ?? 0),
  }));
}

async function requireWarehouseByType(branchId: string, type: WarehouseType) {
  const warehouse = await prisma.warehouse.findFirst({
    where: { branchId, type, isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!warehouse) {
    throw new ValidationError(
      `This branch needs an active ${type.toLowerCase()} warehouse for this workflow`,
    );
  }
  return warehouse;
}

function sumMoney(values: Prisma.Decimal[]) {
  return values.reduce((acc, value) => acc.plus(value), new Prisma.Decimal(0));
}

async function notifyDamageActionPending(
  branchId: string,
  reportId: string,
  reportNumber: string,
  body: string,
) {
  await publishToPermission('inventory:damage', {
    branchId,
    severity: 'WARNING',
    module: 'inventory',
    title: `Action pending: ${reportNumber}`,
    body,
    href: `/warehouse/faulty/${reportId}`,
  });
}

async function hydrateDamageReportRelations<
  T extends {
    supplierId?: string | null;
    grnId?: string | null;
    purchaseInvoiceId?: string | null;
  },
>(reports: T[]) {
  const supplierIds = Array.from(
    new Set(reports.map((report) => report.supplierId).filter((id): id is string => Boolean(id))),
  );
  const grnIds = Array.from(
    new Set(reports.map((report) => report.grnId).filter((id): id is string => Boolean(id))),
  );
  const invoiceIds = Array.from(
    new Set(
      reports
        .map((report) => report.purchaseInvoiceId)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const [suppliers, grns, invoices] = await Promise.all([
    supplierIds.length > 0
      ? prisma.supplier.findMany({
          where: { id: { in: supplierIds } },
          select: { id: true, code: true, name: true },
        })
      : Promise.resolve([]),
    grnIds.length > 0
      ? prisma.goodsReceiving.findMany({
          where: { id: { in: grnIds } },
          select: { id: true, number: true, supplierId: true },
        })
      : Promise.resolve([]),
    invoiceIds.length > 0
      ? prisma.purchaseInvoice.findMany({
          where: { id: { in: invoiceIds } },
          select: { id: true, number: true, supplierId: true },
        })
      : Promise.resolve([]),
  ]);

  const supplierMap = new Map(suppliers.map((supplier) => [supplier.id, supplier]));
  const grnMap = new Map(grns.map((grn) => [grn.id, grn]));
  const invoiceMap = new Map(invoices.map((invoice) => [invoice.id, invoice]));

  return reports.map((report) => ({
    ...report,
    supplier: report.supplierId ? supplierMap.get(report.supplierId) ?? null : null,
    grn: report.grnId ? grnMap.get(report.grnId) ?? null : null,
    purchaseInvoice: report.purchaseInvoiceId
      ? invoiceMap.get(report.purchaseInvoiceId) ?? null
      : null,
  }));
}

export const warehouseWorkflowService = {
  async listCustomerReturns(session: AppSession | null, branchId?: string) {
    await authorize(session, 'inventory:return');
    return prisma.customerReturn.findMany({
      where: { branchId },
      orderBy: { createdAt: 'desc' },
      include: {
        warehouse: { select: { id: true, name: true, code: true } },
        inspectionWarehouse: { select: { id: true, name: true, code: true } },
        items: {
          include: {
            product: { select: { id: true, sku: true, name: true, unit: true } },
          },
        },
      },
    });
  },

  async getCustomerReturnById(session: AppSession | null, id: string) {
    await authorize(session, 'inventory:return');
    const entry = await prisma.customerReturn.findUnique({
      where: { id },
      include: {
        warehouse: { select: { id: true, name: true, code: true } },
        inspectionWarehouse: { select: { id: true, name: true, code: true } },
        items: {
          include: {
            product: {
              select: { id: true, sku: true, name: true, unit: true, costPrice: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!entry) throw new NotFoundError('Customer return not found');
    return entry;
  },

  async intakeCustomerReturn(session: AppSession | null, input: CustomerReturnIntakeInput) {
    const actor = await authorize(session, 'inventory:return', { branchId: input.branchId });
    const [warehouse, inspectionWarehouse] = await Promise.all([
      prisma.warehouse.findUnique({ where: { id: input.warehouseId } }),
      requireWarehouseByType(input.branchId, 'QUARANTINE'),
    ]);
    if (!warehouse || warehouse.branchId !== input.branchId) {
      throw new ValidationError('Destination warehouse does not belong to this branch');
    }

    const products = await prisma.product.findMany({
      where: { id: { in: input.items.map((item) => item.productId) } },
      select: { id: true, sku: true, costPrice: true },
    });
    const productMap = new Map(products.map((product) => [product.id, product]));

    return prisma.$transaction(async (tx) => {
      await assertOpenPeriod(tx, input.branchId);
      const year = new Date().getFullYear();
      const count = await tx.customerReturn.count({ where: { branchId: input.branchId } });
      const number = nextDocumentNumber('CRT', year, count, 6);

      const created = await tx.customerReturn.create({
        data: {
          number,
          branchId: input.branchId,
          warehouseId: input.warehouseId,
          inspectionWarehouseId: inspectionWarehouse.id,
          sourceDocumentType: input.sourceDocumentType || null,
          sourceDocumentNumber: input.sourceDocumentNumber || null,
          customerName: input.customerName || null,
          customerPhone: input.customerPhone || null,
          financeAction: input.financeAction,
          financeNote: input.financeNote || null,
          intakeNote: input.intakeNote || null,
          createdById: actor.userId,
          items: {
            create: input.items.map((item) => ({
              productId: item.productId,
              quantity: new Prisma.Decimal(item.quantity),
            })),
          },
        },
        include: { items: true },
      });

      await Promise.all(
        input.items.map((item) => {
          const product = productMap.get(item.productId);
          if (!product) {
            throw new ValidationError(`Product not found: ${item.productId}`);
          }
          return tx.inventoryLedger.create({
            data: {
              branchId: input.branchId,
              warehouseId: inspectionWarehouse.id,
              productId: item.productId,
              direction: 'IN',
              quantity: new Prisma.Decimal(item.quantity),
              costPerUnit: product.costPrice,
              refType: 'CUSTOMER_RETURN',
              refId: created.id,
              note: input.intakeNote || null,
              createdById: actor.userId,
            },
          });
        }),
      );

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: input.branchId,
          module: 'inventory',
          action: 'return-intake',
          entityType: 'CustomerReturn',
          entityId: created.id,
          after: {
            number: created.number,
            warehouseId: input.warehouseId,
            inspectionWarehouseId: inspectionWarehouse.id,
            items: input.items.length,
          },
        },
        tx,
      );

      return created;
    }).then(async (created) => {
      await publishToPermission('inventory:return', {
        branchId: created.branchId,
        severity: 'INFO',
        module: 'inventory',
        title: `Return inspection needed: ${created.number}`,
        body: 'A customer return has been received and is waiting for inspection.',
        href: `/warehouse/returns/${created.id}`,
      });
      return created;
    });
  },

  async inspectCustomerReturn(session: AppSession | null, input: CustomerReturnInspectionInput) {
    const actor = await authorize(session, 'inventory:return');
    const entry = await prisma.customerReturn.findUnique({
      where: { id: input.id },
      include: {
        items: { include: { product: { select: { costPrice: true } } } },
      },
    });
    if (!entry) throw new NotFoundError('Customer return not found');
    if (entry.status === 'COMPLETED' || entry.status === 'REJECTED') {
      throw new ValidationError('This return has already been completed');
    }

    const wipWarehouse = input.items.some((item) => item.disposition === 'REWORK')
      ? await requireWarehouseByType(entry.branchId, 'WIP')
      : null;
    const damagedWarehouse = input.items.some((item) => item.disposition === 'DAMAGED')
      ? await requireWarehouseByType(entry.branchId, 'DAMAGED')
      : null;

    return prisma.$transaction(async (tx) => {
      await assertOpenPeriod(tx, entry.branchId);

      const itemMap = new Map(entry.items.map((item) => [item.id, item]));

      for (const decision of input.items) {
        const item = itemMap.get(decision.itemId);
        if (!item) throw new ValidationError('Invalid return item');
        const quantity = item.quantity;
        const costPerUnit = item.product.costPrice;

        await tx.inventoryLedger.create({
          data: {
            branchId: entry.branchId,
            warehouseId: entry.inspectionWarehouseId,
            productId: item.productId,
            direction: 'OUT',
            quantity,
            costPerUnit,
            refType: 'CUSTOMER_RETURN',
            refId: entry.id,
            note: decision.note || input.inspectionNote || null,
            createdById: actor.userId,
          },
        });

        if (decision.disposition === 'RESTOCK') {
          await tx.inventoryLedger.create({
            data: {
              branchId: entry.branchId,
              warehouseId: entry.warehouseId,
              productId: item.productId,
              direction: 'IN',
              quantity,
              costPerUnit,
              refType: 'CUSTOMER_RETURN',
              refId: entry.id,
              note: decision.note || input.inspectionNote || null,
              createdById: actor.userId,
            },
          });
        }

        if (decision.disposition === 'REWORK' && wipWarehouse) {
          await tx.inventoryLedger.create({
            data: {
              branchId: entry.branchId,
              warehouseId: wipWarehouse.id,
              productId: item.productId,
              direction: 'IN',
              quantity,
              costPerUnit,
              refType: 'CUSTOMER_RETURN',
              refId: entry.id,
              note: decision.note || input.inspectionNote || null,
              createdById: actor.userId,
            },
          });
        }

        if (decision.disposition === 'DAMAGED' && damagedWarehouse) {
          await tx.inventoryLedger.create({
            data: {
              branchId: entry.branchId,
              warehouseId: damagedWarehouse.id,
              productId: item.productId,
              direction: 'IN',
              quantity,
              costPerUnit,
              refType: 'CUSTOMER_RETURN',
              refId: entry.id,
              note: decision.note || input.inspectionNote || null,
              createdById: actor.userId,
            },
          });
        }
      }

      const everyRejected = input.items.every((item) => item.disposition === 'REJECT');
      const updated = await tx.customerReturn.update({
        where: { id: entry.id },
        data: {
          status: everyRejected ? 'REJECTED' : 'COMPLETED',
          financeAction: input.financeAction,
          financeNote: input.financeNote || null,
          inspectionNote: input.inspectionNote || null,
          inspectedById: actor.userId,
          inspectedAt: new Date(),
          completedAt: new Date(),
          items: {
            update: input.items.map((item) => ({
              where: { id: item.itemId },
              data: {
                disposition: item.disposition,
                note: item.note || null,
              },
            })),
          },
        },
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: entry.branchId,
          module: 'inventory',
          action: 'return-inspect',
          entityType: 'CustomerReturn',
          entityId: entry.id,
          after: {
            status: updated.status,
            financeAction: updated.financeAction,
          },
        },
        tx,
      );

      return updated;
    }).then(async (updated) => {
      await publishToPermission('warehouse:read', {
        branchId: updated.branchId,
        severity: updated.status === 'REJECTED' ? 'WARNING' : 'INFO',
        module: 'inventory',
        title: `Return processed: ${updated.number}`,
        body:
          updated.status === 'REJECTED'
            ? 'The returned items were rejected after inspection.'
            : 'The returned items were routed after inspection.',
        href: `/warehouse/returns/${updated.id}`,
      });
      return updated;
    });
  },

  async listDamageReports(session: AppSession | null, branchId?: string) {
    await authorize(session, 'inventory:damage');
    const reports = await prisma.damageReport.findMany({
      where: { branchId },
      orderBy: { createdAt: 'desc' },
      include: {
        warehouse: { select: { id: true, name: true, code: true } },
        quarantineWarehouse: { select: { id: true, name: true, code: true } },
        items: {
          include: {
            product: { select: { id: true, sku: true, name: true, unit: true } },
          },
        },
      },
    });
    return hydrateDamageReportRelations(reports);
  },

  async getDamageReportById(session: AppSession | null, id: string) {
    await authorize(session, 'inventory:damage');
    const entry = await prisma.damageReport.findUnique({
      where: { id },
      include: {
        warehouse: { select: { id: true, name: true, code: true } },
        quarantineWarehouse: { select: { id: true, name: true, code: true } },
        items: {
          include: {
            product: { select: { id: true, sku: true, name: true, unit: true } },
          },
        },
      },
    });
    if (!entry) throw new NotFoundError('Damage report not found');
    const [hydrated] = await hydrateDamageReportRelations([entry]);
    return hydrated;
  },

  async reportDamage(session: AppSession | null, input: DamageReportInput) {
    const actor = await authorize(session, 'inventory:damage', { branchId: input.branchId });
    const [warehouse, quarantineWarehouse] = await Promise.all([
      prisma.warehouse.findUnique({
        where: { id: input.warehouseId },
        include: { branch: { select: { allowNegativeStock: true } } },
      }),
      requireWarehouseByType(input.branchId, 'QUARANTINE'),
    ]);
    if (!warehouse || warehouse.branchId !== input.branchId) {
      throw new ValidationError('Source warehouse does not belong to this branch');
    }
    const productIds = input.items.map((item) => item.productId);

    const created = await prisma.$transaction(async (tx) => {
      await assertOpenPeriod(tx, input.branchId);
      const balances = await getBalances(tx, input.branchId, input.warehouseId, productIds);
      const balanceByProduct = new Map(balances.map((balance) => [balance.productId, balance.balance]));

      if (!warehouse.branch.allowNegativeStock) {
        for (const item of input.items) {
          const current = balanceByProduct.get(item.productId) ?? new Prisma.Decimal(0);
          const quantity = new Prisma.Decimal(item.quantity);
          if (current.minus(quantity).lt(0)) {
            throw new ValidationError(`Insufficient stock for damage report: ${item.productId}`);
          }
        }
      }

      const year = new Date().getFullYear();
      const count = await tx.damageReport.count({ where: { branchId: input.branchId } });
      const number = nextDocumentNumber('DMG', year, count, 6);
      const estimatedValue = sumMoney(
        input.items.map((item) =>
          new Prisma.Decimal(item.quantity).mul(new Prisma.Decimal(item.costPerUnit || '0')),
        ),
      );

      const report = await tx.damageReport.create({
        data: {
          number,
          branchId: input.branchId,
          warehouseId: input.warehouseId,
          quarantineWarehouseId: quarantineWarehouse.id,
          reason: input.reason,
          note: input.note || null,
          estimatedValue,
          reportedById: actor.userId,
          items: {
            create: input.items.map((item) => ({
              productId: item.productId,
              quantity: new Prisma.Decimal(item.quantity),
              costPerUnit: new Prisma.Decimal(item.costPerUnit || '0'),
            })),
          },
        },
      });

      await Promise.all(
        input.items.flatMap((item) => [
          tx.inventoryLedger.create({
            data: {
              branchId: input.branchId,
              warehouseId: input.warehouseId,
              productId: item.productId,
              direction: 'OUT',
              quantity: new Prisma.Decimal(item.quantity),
              costPerUnit: new Prisma.Decimal(item.costPerUnit || '0'),
              refType: 'DAMAGE',
              refId: report.id,
              note: input.note || input.reason,
              createdById: actor.userId,
            },
          }),
          tx.inventoryLedger.create({
            data: {
              branchId: input.branchId,
              warehouseId: quarantineWarehouse.id,
              productId: item.productId,
              direction: 'IN',
              quantity: new Prisma.Decimal(item.quantity),
              costPerUnit: new Prisma.Decimal(item.costPerUnit || '0'),
              refType: 'DAMAGE',
              refId: report.id,
              note: input.note || input.reason,
              createdById: actor.userId,
            },
          }),
        ]),
      );

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: input.branchId,
          module: 'inventory',
          action: 'damage-report',
          entityType: 'DamageReport',
          entityId: report.id,
          after: {
            number: report.number,
            estimatedValue: estimatedValue.toString(),
            items: input.items.length,
          },
        },
        tx,
      );

      return report;
    });

    const approval = await approvalService.requestIfNeeded(session, {
      module: 'inventory',
      action: 'damage',
      entityType: 'DamageReport',
      entityId: created.id,
      title: `Damage report ${created.number}`,
      summary: input.reason,
      amount: Number(created.estimatedValue),
      branchId: created.branchId,
      currency: 'BDT',
    });

    const updated = await prisma.damageReport.update({
      where: { id: created.id },
      data: approval
        ? { status: 'PENDING_APPROVAL', requiresApproval: true }
        : { status: 'APPROVED', requiresApproval: false },
    });

    if (approval) {
      await publishToPermission('inventory:damage', {
        branchId: updated.branchId,
        severity: 'WARNING',
        module: 'inventory',
        title: `Approval needed: ${updated.number}`,
        body: 'High-value damaged stock is waiting for manager approval before final action.',
        href: `/warehouse/faulty/${updated.id}`,
      });
    } else {
      await notifyDamageActionPending(
        updated.branchId,
        updated.id,
        updated.number,
        'Damaged stock is in quarantine and still needs a final action.',
      );
    }

    return updated;
  },

  async resolveDamageReport(session: AppSession | null, input: DamageResolutionInput) {
    const actor = await authorize(session, 'inventory:damage');
    const report = await prisma.damageReport.findUnique({
      where: { id: input.id },
      include: { items: true },
    });
    if (!report) throw new NotFoundError('Damage report not found');
    if (report.status === 'RESOLVED' || report.status === 'REJECTED') {
      throw new ValidationError('This damage report has already been closed');
    }
    if (report.requiresApproval) {
      const approved = await prisma.approvalRequest.findFirst({
        where: {
          module: 'inventory',
          action: 'damage',
          entityType: 'DamageReport',
          entityId: report.id,
          status: 'APPROVED',
        },
      });
      if (!approved) {
        throw new ForbiddenError('Manager approval is still required before resolution');
      }
    }

    let supplier = null;
    let grn = null;
    let purchaseInvoice = null;
    const claimAmount = new Prisma.Decimal(input.claimAmount || '0');
    if (input.resolution === 'SUPPLIER_CLAIM') {
      supplier = await prisma.supplier.findUnique({ where: { id: input.supplierId || undefined } });
      if (!supplier || supplier.branchId !== report.branchId) {
        throw new ValidationError('Supplier does not belong to this branch');
      }
      if (input.grnId) {
        grn = await prisma.goodsReceiving.findUnique({ where: { id: input.grnId } });
        if (!grn || grn.branchId !== report.branchId || grn.supplierId !== supplier.id) {
          throw new ValidationError('GRN does not match the selected supplier/branch');
        }
      }
      if (input.purchaseInvoiceId) {
        purchaseInvoice = await prisma.purchaseInvoice.findUnique({
          where: { id: input.purchaseInvoiceId },
        });
        if (
          !purchaseInvoice ||
          purchaseInvoice.branchId !== report.branchId ||
          purchaseInvoice.supplierId !== supplier.id
        ) {
          throw new ValidationError('Purchase invoice does not match the selected supplier/branch');
        }
      }
      if (!input.grnId && !input.purchaseInvoiceId) {
        throw new ValidationError('Select a GRN or purchase invoice for supplier claim');
      }
      if (claimAmount.lte(0)) {
        throw new ValidationError('Claim amount must be greater than zero');
      }
    }

    const wipWarehouse = input.resolution === 'REPAIR'
      ? await requireWarehouseByType(report.branchId, 'WIP')
      : null;

    return prisma.$transaction(async (tx) => {
      await assertOpenPeriod(tx, report.branchId);

      for (const item of report.items) {
        await tx.inventoryLedger.create({
          data: {
            branchId: report.branchId,
            warehouseId: report.quarantineWarehouseId,
            productId: item.productId,
            direction: 'OUT',
            quantity: item.quantity,
            costPerUnit: item.costPerUnit,
            refType: 'DAMAGE',
            refId: report.id,
            note: input.resolutionNote || report.reason,
            createdById: actor.userId,
          },
        });

        if (input.resolution === 'REPAIR' && wipWarehouse) {
          await tx.inventoryLedger.create({
            data: {
              branchId: report.branchId,
              warehouseId: wipWarehouse.id,
              productId: item.productId,
              direction: 'IN',
              quantity: item.quantity,
              costPerUnit: item.costPerUnit,
              refType: 'DAMAGE',
              refId: report.id,
              note: input.resolutionNote || report.reason,
              createdById: actor.userId,
            },
          });
        }

        if (input.resolution === 'B_GRADE') {
          await tx.inventoryLedger.create({
            data: {
              branchId: report.branchId,
              warehouseId: report.warehouseId,
              productId: item.productId,
              direction: 'IN',
              quantity: item.quantity,
              costPerUnit: item.costPerUnit,
              refType: 'DAMAGE',
              refId: report.id,
              note: input.resolutionNote || 'Returned as B-grade stock',
              createdById: actor.userId,
            },
          });
        }
      }

      if (input.resolution === 'SUPPLIER_CLAIM' && supplier) {
        await tx.supplierLedger.create({
          data: {
            branchId: report.branchId,
            supplierId: supplier.id,
            entryType: 'ADJUSTMENT',
            refType: 'DAMAGE_SUPPLIER_CLAIM',
            refId: report.id,
            description:
              `Supplier claim ${report.number}` +
              (purchaseInvoice ? ` against invoice ${purchaseInvoice.number}`
              : grn ? ` against GRN ${grn.number}`
              : ''),
            debit: new Prisma.Decimal(0),
            credit: claimAmount,
            createdById: actor.userId,
          },
        });
      }

      const updated = await tx.damageReport.update({
        where: { id: report.id },
        data: {
          status: 'RESOLVED',
          resolution: input.resolution,
          supplierId: supplier?.id ?? null,
          grnId: grn?.id ?? null,
          purchaseInvoiceId: purchaseInvoice?.id ?? null,
          claimAmount: input.resolution === 'SUPPLIER_CLAIM' ? claimAmount : new Prisma.Decimal(0),
          claimReference: input.claimReference || null,
          resolutionNote: input.resolutionNote || null,
          resolvedById: actor.userId,
          resolvedAt: new Date(),
        },
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: report.branchId,
          module: 'inventory',
          action: 'damage-resolve',
          entityType: 'DamageReport',
          entityId: report.id,
          after: {
            resolution: updated.resolution,
            supplierId: updated.supplierId,
            purchaseInvoiceId: updated.purchaseInvoiceId,
            grnId: updated.grnId,
            claimAmount: updated.claimAmount.toString(),
          },
        },
        tx,
      );

      return updated;
    });
  },

  async rejectDamageReport(session: AppSession | null, input: DamageRejectInput) {
    const actor = await authorize(session, 'inventory:damage');
    const report = await prisma.damageReport.findUnique({
      where: { id: input.id },
      include: { items: true },
    });
    if (!report) throw new NotFoundError('Damage report not found');
    if (report.status === 'RESOLVED' || report.status === 'REJECTED') {
      throw new ValidationError('This damage report has already been closed');
    }

    return prisma.$transaction(async (tx) => {
      await assertOpenPeriod(tx, report.branchId);

      for (const item of report.items) {
        await tx.inventoryLedger.create({
          data: {
            branchId: report.branchId,
            warehouseId: report.quarantineWarehouseId,
            productId: item.productId,
            direction: 'OUT',
            quantity: item.quantity,
            costPerUnit: item.costPerUnit,
            refType: 'DAMAGE',
            refId: report.id,
            note: input.resolutionNote || 'Rejected damage report',
            createdById: actor.userId,
          },
        });
        await tx.inventoryLedger.create({
          data: {
            branchId: report.branchId,
            warehouseId: report.warehouseId,
            productId: item.productId,
            direction: 'IN',
            quantity: item.quantity,
            costPerUnit: item.costPerUnit,
            refType: 'DAMAGE',
            refId: report.id,
            note: input.resolutionNote || 'Returned to normal stock',
            createdById: actor.userId,
          },
        });
      }

      const updated = await tx.damageReport.update({
        where: { id: report.id },
        data: {
          status: 'REJECTED',
          resolutionNote: input.resolutionNote || null,
          resolvedById: actor.userId,
          resolvedAt: new Date(),
        },
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: report.branchId,
          module: 'inventory',
          action: 'damage-reject',
          entityType: 'DamageReport',
          entityId: report.id,
          after: { status: updated.status },
        },
        tx,
      );

      return updated;
    });
  },
};
