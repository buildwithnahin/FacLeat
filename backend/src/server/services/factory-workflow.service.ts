import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db';
import { authorize } from '@/server/auth/authorize';
import { recordAudit } from '@/server/audit/logger';
import { assertOpenPeriod } from '@/server/periods/guards';
import type { AppSession } from '@/server/auth/session';
import type {
  FinishedGoodsReceiveCreateInput,
  ProcessTrackingCreateInput,
  ProductionIssueCreateInput,
  ProductionIssueStatusInput,
  ProductionReceiveCreateInput,
} from '@/server/validators/factory';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { getCostSummary } from '@/server/services/factory.service';
import { accountsService } from '@/server/services/accounts.service';

const D = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value);

async function inventoryBalanceFor(
  tx: Prisma.TransactionClient,
  branchId: string,
  warehouseId: string,
  productId: string,
) {
  const ledgerAgg = await tx.inventoryLedger.groupBy({
    by: ['productId', 'direction'],
    where: { branchId, warehouseId, productId },
    _sum: { quantity: true },
  });
  let balance = new Prisma.Decimal(0);
  for (const row of ledgerAgg) {
    const delta = row._sum.quantity ? new Prisma.Decimal(row._sum.quantity) : new Prisma.Decimal(0);
    balance = row.direction === 'IN' ? balance.plus(delta) : balance.minus(delta);
  }
  return balance;
}

export async function nextVoucherNumber(prefix: string, model: 'productionIssueVoucher' | 'finishedGoodsReceiveVoucher') {
  const year = new Date().getFullYear();
  const where = {
    createdAt: {
      gte: new Date(year, 0, 1),
      lt: new Date(year + 1, 0, 1),
    },
  };
  const counter =
    model === 'productionIssueVoucher'
      ? await prisma.productionIssueVoucher.count({ where })
      : await prisma.finishedGoodsReceiveVoucher.count({ where });
  return `${prefix}-${year}-${String(counter + 1).padStart(5, '0')}`;
}

function parseDateTimeInput(raw?: string | null) {
  if (!raw) return null;
  const value = new Date(raw);
  return Number.isNaN(value.getTime()) ? null : value;
}

export const factoryWorkflowService = {
  async listProductionIssues(session: AppSession | null, branchId?: string) {
    await authorize(session, 'factory:read');
    return prisma.productionIssueVoucher.findMany({
      where: { branchId },
      orderBy: [{ createdAt: 'desc' }, { voucherNo: 'desc' }],
      include: {
        order: { select: { id: true, number: true, product: { select: { name: true, sku: true } } } },
        warehouse: { select: { id: true, name: true, code: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
          },
        },
        requestedBy: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true, email: true } },
        issuedBy: { select: { id: true, name: true, email: true } },
      },
    });
  },

  async createProductionIssue(session: AppSession | null, input: ProductionIssueCreateInput) {
    const actor = await authorize(session, 'factory:execute');
    const order = await prisma.productionOrder.findUnique({
      where: { id: input.orderId },
      include: {
        branch: { select: { allowNegativeStock: true } },
        materials: true,
      },
    });
    if (!order) throw new NotFoundError('Production order not found');
    if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
      throw new ValidationError(`Cannot create an issue voucher for a ${order.status.toLowerCase()} order`);
    }

    const warehouse = await prisma.warehouse.findUnique({ where: { id: input.warehouseId } });
    if (!warehouse || warehouse.branchId !== order.branchId) {
      throw new ValidationError('Selected RM warehouse does not belong to the order branch');
    }

    return prisma.$transaction(async (tx) => {
      await assertOpenPeriod(tx, order.branchId);
      const voucherNo = await nextVoucherNumber('PI', 'productionIssueVoucher');

      for (const item of input.items) {
        if (!order.branch.allowNegativeStock) {
          const balance = await inventoryBalanceFor(tx, order.branchId, input.warehouseId, item.productId);
          if (balance.lt(item.issuedQty)) {
            throw new ValidationError(`Insufficient RM stock for selected item. Available ${balance.toString()}, need ${item.issuedQty}`);
          }
        }
      }

      const created = await tx.productionIssueVoucher.create({
        data: {
          voucherNo,
          date: input.date,
          branchId: order.branchId,
          orderId: order.id,
          warehouseId: input.warehouseId,
          status: 'DRAFT',
          requestedById: actor.userId,
          remarks: input.remarks || null,
          items: {
            create: input.items.map((item) => ({
              productId: item.productId,
              batchNo: item.batchNo || null,
              lotNo: item.lotNo || null,
              requiredQty: D(item.requiredQty),
              issuedQty: D(item.issuedQty),
              uom: item.uom,
            })),
          },
        },
        include: { items: true },
      });

      await recordAudit({
        actorId: actor.userId,
        branchId: order.branchId,
        module: 'factory',
        action: 'production-issue-create',
        entityType: 'ProductionIssueVoucher',
        entityId: created.id,
        after: { voucherNo: created.voucherNo, items: input.items.length, status: created.status },
      }, tx);

      return created;
    });
  },

  async changeProductionIssueStatus(session: AppSession | null, input: ProductionIssueStatusInput) {
    const actor = await authorize(session, 'factory:execute');
    const voucher = await prisma.productionIssueVoucher.findUnique({
      where: { id: input.voucherId },
      include: {
        items: { include: { product: true } },
        order: { include: { materials: true, branch: true } },
      },
    });
    if (!voucher) throw new NotFoundError('Production issue voucher not found');

    return prisma.$transaction(async (tx) => {
      let updated;
      if (input.status === 'ISSUED') {
        if (!['APPROVED', 'REQUESTED', 'DRAFT'].includes(voucher.status)) {
          throw new ValidationError('Only approved/requested issue vouchers can be marked as issued');
        }
        await assertOpenPeriod(tx, voucher.branchId);

        let totalIssuedValue = D(0);

        for (const item of voucher.items) {
          await tx.inventoryLedger.create({
            data: {
              branchId: voucher.branchId,
              warehouseId: voucher.warehouseId,
              productId: item.productId,
              direction: 'OUT',
              quantity: item.issuedQty,
              costPerUnit: item.product.costPrice ?? D(0),
              refType: 'PRODUCTION_ISSUE',
              refId: voucher.id,
              note: `Production issue ${voucher.voucherNo}`,
              createdById: actor.userId,
            },
          });

          await tx.wipLedger.create({
            data: {
              date: voucher.date,
              branchId: voucher.branchId,
              orderId: voucher.orderId,
              productId: item.productId,
              voucher: voucher.voucherNo,
              inQty: item.issuedQty,
              balance: item.issuedQty,
              cost: item.issuedQty.times(item.product.costPrice ?? D(0)),
              operatorId: null,
            },
          });

          // Sync with order's ProductionMaterial line so single page shows consumed quantities!
          const existingMaterial = voucher.order.materials.find((m) => m.productId === item.productId);
          if (existingMaterial) {
            await tx.productionMaterial.update({
              where: { id: existingMaterial.id },
              data: {
                consumedQty: { increment: item.issuedQty },
                fromWarehouseId: voucher.warehouseId,
              },
            });
          } else {
            await tx.productionMaterial.create({
              data: {
                orderId: voucher.orderId,
                productId: item.productId,
                plannedQty: item.issuedQty,
                consumedQty: item.issuedQty,
                unit: item.uom,
                fromWarehouseId: voucher.warehouseId,
                note: `Issued via ${voucher.voucherNo}`,
              },
            });
          }

          const lineCost = item.issuedQty.times(item.product.costPrice ?? D(0));
          totalIssuedValue = totalIssuedValue.plus(lineCost);
        }

        // Advance order status to IN_PROGRESS if currently PLANNED
        if (voucher.order.status === 'PLANNED') {
          await tx.productionOrder.update({
            where: { id: voucher.orderId },
            data: {
              status: 'IN_PROGRESS',
              actualStartDate: voucher.order.actualStartDate ?? new Date(),
            },
          });
        }

        // Advance first stage to IN_PROGRESS if PENDING
        const firstStage = await tx.productionStage.findFirst({
          where: { orderId: voucher.orderId, sequence: 1 },
        });
        if (firstStage && firstStage.status === 'PENDING') {
          await tx.productionStage.update({
            where: { id: firstStage.id },
            data: { status: 'IN_PROGRESS', startedAt: new Date() },
          });
        }

        // Post accounting GL journal: Debit WIP, Credit INVENTORY_RAW_MATERIAL
        if (totalIssuedValue.gt(0)) {
          const wipAccountId = await accountsService.resolveSystemAccount(tx, 'WIP', voucher.branchId);
          const inventoryAccountId = await accountsService.resolveSystemAccount(
            tx,
            'INVENTORY_RAW_MATERIAL',
            voucher.branchId,
          );
          await accountsService.postSystemJournal(tx, {
            branchId: voucher.branchId,
            date: voucher.date,
            memo: `Production issue ${voucher.voucherNo} for ${voucher.order.number}`,
            sourceModule: 'factory',
            sourceRefType: 'ProductionIssueVoucher',
            sourceRefId: voucher.id,
            actorUserId: actor.userId,
            lines: [
              {
                accountId: wipAccountId,
                debit: totalIssuedValue.toNumber(),
                credit: 0,
                currency: voucher.order.branch.currency,
                fxRate: 1,
              },
              {
                accountId: inventoryAccountId,
                debit: 0,
                credit: totalIssuedValue.toNumber(),
                currency: voucher.order.branch.currency,
                fxRate: 1,
              },
            ],
          });
        }
      }

      updated = await tx.productionIssueVoucher.update({
        where: { id: voucher.id },
        data: {
          status: input.status,
          requestedById: input.status === 'REQUESTED' ? actor.userId : voucher.requestedById,
          approvedById: input.status === 'APPROVED' ? actor.userId : voucher.approvedById,
          issuedById: input.status === 'ISSUED' ? actor.userId : voucher.issuedById,
        },
      });

      await recordAudit({
        actorId: actor.userId,
        branchId: voucher.branchId,
        module: 'factory',
        action: 'production-issue-status',
        entityType: 'ProductionIssueVoucher',
        entityId: voucher.id,
        before: { status: voucher.status },
        after: { status: updated.status },
      }, tx);

      return updated;
    });
  },

  async listProcessTrackings(session: AppSession | null, branchId?: string) {
    await authorize(session, 'factory:read');
    return prisma.processTracking.findMany({
      where: { branchId },
      orderBy: [{ createdAt: 'desc' }, { updatedAt: 'desc' }, { trackingNo: 'desc' }],
      include: {
        order: { select: { id: true, number: true } },
        product: { select: { id: true, name: true, sku: true } },
        stage: { select: { id: true, name: true, sequence: true } },
        operator: { select: { id: true, firstName: true, lastName: true, code: true } },
      },
    });
  },

  async saveProcessTracking(session: AppSession | null, input: ProcessTrackingCreateInput) {
    const actor = await authorize(session, 'factory:execute');
    const order = await prisma.productionOrder.findUnique({
      where: { id: input.orderId },
      include: {
        stages: { orderBy: { sequence: 'asc' } },
      },
    });
    if (!order) throw new NotFoundError('Production order not found');

    const stage = order.stages.find((row) => row.id === input.stageId);
    if (!stage) throw new ValidationError('Selected process does not belong to this production order');

    return prisma.$transaction(async (tx) => {
      const existing = input.trackingId
        ? await tx.processTracking.findUnique({ where: { id: input.trackingId } })
        : null;

      const startTime = parseDateTimeInput(input.startTime) ?? existing?.startTime ?? (input.status === 'RUNNING' && !existing ? new Date() : null);
      const endTime = parseDateTimeInput(input.endTime) ?? (input.status === 'COMPLETED' ? new Date() : existing?.endTime ?? null);
      const durationMinutes = startTime && endTime ? Math.max(0, Math.round((endTime.getTime() - startTime.getTime()) / 60000)) : null;

      const payload = {
        orderId: order.id,
        branchId: order.branchId,
        productId: input.productId,
        stageId: input.stageId,
        batchNo: input.batchNo || null,
        machine: input.machine || null,
        operatorId: input.operatorId || null,
        status: input.status,
        startTime,
        endTime,
        durationMinutes,
        inputQty: D(input.inputQty),
        outputQty: D(input.outputQty),
        rejectedQty: D(input.rejectedQty),
        scrapQty: D(input.scrapQty),
        reworkQty: D(input.reworkQty),
        remainingQty: D(Math.max(0, input.inputQty - input.outputQty - input.rejectedQty - input.scrapQty)),
      };

      const tracking = existing
        ? await tx.processTracking.update({
            where: { id: existing.id },
            data: payload,
          })
        : await tx.processTracking.create({
            data: {
              trackingNo: `PT-${Date.now()}`,
              ...payload,
            },
          });

      await tx.productionStage.update({
        where: { id: stage.id },
        data: {
          status: input.status === 'RUNNING' ? 'IN_PROGRESS' : input.status === 'COMPLETED' ? 'COMPLETED' : stage.status,
          startedAt: stage.startedAt ?? startTime ?? undefined,
          completedAt: input.status === 'COMPLETED' ? (endTime ?? new Date()) : stage.completedAt,
        },
      });

      if (input.scrapQty > 0 && (!existing || D(existing.scrapQty).lt(input.scrapQty))) {
        const delta = existing ? D(input.scrapQty).minus(existing.scrapQty) : D(input.scrapQty);
        if (delta.gt(0)) {
          await tx.scrapLedger.create({
            data: {
              date: new Date(),
              branchId: order.branchId,
              orderId: order.id,
              stageId: stage.id,
              scrapType: 'PROCESS_TRACKING',
              operatorId: input.operatorId || null,
              qty: delta,
              notes: `Tracking ${tracking.trackingNo}`,
            },
          });
        }
      }

      if (order.status === 'PLANNED') {
        await tx.productionOrder.update({
          where: { id: order.id },
          data: { status: 'IN_PROGRESS', actualStartDate: order.actualStartDate ?? new Date() },
        });
      }

      // Update ProductionOrder.producedQty and check if order is completed!
      const totalPassed = voucher.items
        .filter((it) => it.qualityStatus === 'PASSED')
        .reduce((sum, it) => sum.plus(it.quantity), D(0));

      if (totalPassed.gt(0)) {
        const updatedOrder = await tx.productionOrder.update({
          where: { id: order.id },
          data: {
            producedQty: { increment: totalPassed },
            actualStartDate: order.actualStartDate ?? new Date(),
          },
        });

        const isCompleted = updatedOrder.producedQty.gte(updatedOrder.plannedQty);
        if (isCompleted) {
          await tx.productionOrder.update({
            where: { id: order.id },
            data: {
              status: 'COMPLETED',
              actualEndDate: new Date(),
            },
          });
          await tx.productionStage.updateMany({
            where: { orderId: order.id, status: { in: ['PENDING', 'IN_PROGRESS'] } },
            data: { status: 'COMPLETED', completedAt: new Date() },
          });
        }
      }

      await recordAudit({
        actorId: actor.userId,
        branchId: order.branchId,
        module: 'factory',
        action: existing ? 'process-tracking-update' : 'process-tracking-create',
        entityType: 'ProcessTracking',
        entityId: tracking.id,
        after: { trackingNo: tracking.trackingNo, status: tracking.status, stageId: tracking.stageId },
      }, tx);

      return tracking;
    });
  },

  async listProductionReceives(session: AppSession | null, branchId?: string) {
    await authorize(session, 'factory:read');
    const rows = await prisma.wipLedger.findMany({
      where: {
        branchId,
        voucher: { startsWith: 'PRCV-' },
      },
      orderBy: [{ createdAt: 'desc' }, { date: 'desc' }, { id: 'desc' }],
      include: {
        order: { select: { id: true, number: true } },
        product: { select: { id: true, name: true, sku: true } },
        stage: { select: { id: true, name: true, sequence: true } },
        operator: { select: { id: true, firstName: true, lastName: true, code: true } },
      },
    });
    return rows;
  },

  async createProductionReceive(session: AppSession | null, input: ProductionReceiveCreateInput) {
    const actor = await authorize(session, 'factory:execute');
    const order = await prisma.productionOrder.findUnique({
      where: { id: input.orderId },
      include: { stages: { orderBy: { sequence: 'asc' } } },
    });
    if (!order) throw new NotFoundError('Production order not found');

    const fromStage = order.stages.find((stage) => stage.id === input.fromStageId);
    const toStage = order.stages.find((stage) => stage.id === input.toStageId);
    if (!fromStage || !toStage) throw new ValidationError('Selected process stages are invalid');

    const voucherNo = `PRCV-${Date.now()}`;
    const transferQty = D(input.receivedQty).plus(input.rejectedQty).plus(input.scrapQty);

    return prisma.$transaction(async (tx) => {
      await assertOpenPeriod(tx, order.branchId);

      await tx.wipLedger.create({
        data: {
          date: input.date,
          branchId: order.branchId,
          orderId: order.id,
          stageId: fromStage.id,
          productId: input.productId,
          voucher: voucherNo,
          operatorId: input.operatorId || null,
          outQty: transferQty,
          balance: D(0),
          cost: D(0),
        },
      });

      await tx.wipLedger.create({
        data: {
          date: input.date,
          branchId: order.branchId,
          orderId: order.id,
          stageId: toStage.id,
          productId: input.productId,
          voucher: voucherNo,
          operatorId: input.operatorId || null,
          inQty: D(input.receivedQty),
          balance: D(input.receivedQty),
          cost: D(0),
        },
      });

      if (input.rejectedQty > 0 || input.scrapQty > 0) {
        await tx.scrapLedger.create({
          data: {
            date: input.date,
            branchId: order.branchId,
            orderId: order.id,
            stageId: fromStage.id,
            scrapType: 'PRODUCTION_RECEIVE',
            operatorId: input.operatorId || null,
            qty: D(input.rejectedQty).plus(input.scrapQty),
            notes: input.remarks || `Receive voucher ${voucherNo}`,
          },
        });
      }

      await tx.productionStage.update({
        where: { id: fromStage.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      await tx.productionStage.update({
        where: { id: toStage.id },
        data: { status: 'IN_PROGRESS', startedAt: new Date() },
      });

      if (order.status === 'PLANNED') {
        await tx.productionOrder.update({
          where: { id: order.id },
          data: { status: 'IN_PROGRESS', actualStartDate: order.actualStartDate ?? new Date() },
        });
      }

      await recordAudit({
        actorId: actor.userId,
        branchId: order.branchId,
        module: 'factory',
        action: 'production-receive-create',
        entityType: 'WipLedger',
        entityId: voucherNo,
        after: {
          voucherNo,
          orderId: order.id,
          fromStageId: fromStage.id,
          toStageId: toStage.id,
          receivedQty: input.receivedQty,
        },
      }, tx);

      return voucherNo;
    });
  },

  async listFinishedGoodsReceives(session: AppSession | null, branchId?: string) {
    await authorize(session, 'factory:read');
    return prisma.finishedGoodsReceiveVoucher.findMany({
      where: { branchId },
      orderBy: [{ createdAt: 'desc' }, { receiveNo: 'desc' }],
      include: {
        order: { select: { id: true, number: true, product: { select: { name: true, sku: true } } } },
        warehouse: { select: { id: true, name: true, code: true } },
        items: { include: { product: { select: { id: true, name: true, sku: true } } } },
        receivedBy: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true, email: true } },
      },
    });
  },

  async createFinishedGoodsReceive(session: AppSession | null, input: FinishedGoodsReceiveCreateInput) {
    const actor = await authorize(session, 'factory:execute');
    const order = await prisma.productionOrder.findUnique({
      where: { id: input.orderId },
      include: {
        materials: {
          select: {
            consumedQty: true,
            plannedQty: true,
            unitCost: true,
            product: { select: { costPrice: true } },
          },
        },
        costEntries: { select: { type: true, amount: true } },
        outputs: { select: { quantity: true, costPerUnit: true } },
        branch: { select: { currency: true } },
      },
    });
    if (!order) throw new NotFoundError('Production order not found');

    const warehouse = await prisma.warehouse.findUnique({ where: { id: input.warehouseId } });
    if (!warehouse || warehouse.branchId !== order.branchId) {
      throw new ValidationError('Selected FG warehouse does not belong to the order branch');
    }

    const costSummary = getCostSummary({
      outputs: order.outputs,
      materials: order.materials,
      costEntries: order.costEntries,
      overheadRate: order.overheadRate,
      producedQty: order.producedQty,
      plannedQty: order.plannedQty,
    });
    const receiveCostPerUnit = costSummary.costPerUnit ?? D(0);

    return prisma.$transaction(async (tx) => {
      await assertOpenPeriod(tx, order.branchId);
      const receiveNo = await nextVoucherNumber('FGR', 'finishedGoodsReceiveVoucher');

      const voucher = await tx.finishedGoodsReceiveVoucher.create({
        data: {
          receiveNo,
          date: input.date,
          branchId: order.branchId,
          orderId: order.id,
          warehouseId: input.warehouseId,
          receivedById: actor.userId,
          approvedById: input.items.every((item) => item.qualityStatus === 'PASSED') ? actor.userId : null,
          remarks: input.remarks || null,
          items: {
            create: input.items.map((item) => ({
              productId: item.productId,
              batchNo: item.batchNo || null,
              quantity: D(item.quantity),
              uom: item.uom,
              qualityStatus: item.qualityStatus,
            })),
          },
        },
        include: { items: true },
      });

      let receivedValue = D(0);
      for (const item of voucher.items) {
        // Only quality-passed goods enter sellable stock; failed/pending items are
        // logged on the voucher but withheld from inventory until disposition.
        if (item.qualityStatus === 'PASSED') {
          await tx.inventoryLedger.create({
            data: {
              branchId: order.branchId,
              warehouseId: input.warehouseId,
              productId: item.productId,
              direction: 'IN',
              quantity: item.quantity,
              costPerUnit: receiveCostPerUnit,
              refType: 'FINISHED_GOODS_RECEIVE',
              refId: voucher.id,
              note: `Finished goods receive ${voucher.receiveNo}`,
              createdById: actor.userId,
            },
          });
          receivedValue = receivedValue.plus(item.quantity.times(receiveCostPerUnit));

          // Also create ProductionOutput record so single-page outputs table displays this!
          await tx.productionOutput.create({
            data: {
              orderId: order.id,
              productId: item.productId,
              unit: order.unit,
              quantity: item.quantity,
              costPerUnit: receiveCostPerUnit,
              toWarehouseId: input.warehouseId,
              note: input.remarks || `Finished goods receive ${voucher.receiveNo}`,
              createdById: actor.userId,
            },
          });
        }

        await tx.wipLedger.create({
          data: {
            date: input.date,
            branchId: order.branchId,
            orderId: order.id,
            stageId: input.sourceStageId || null,
            productId: item.productId,
            voucher: voucher.receiveNo,
            outQty: item.quantity,
            balance: D(0),
            cost: item.quantity.times(receiveCostPerUnit),
          },
        });
      }

      if (receivedValue.gt(0)) {
        const inventoryAccountId = await accountsService.resolveSystemAccount(
          tx,
          'INVENTORY_FINISHED_GOODS',
          order.branchId,
        );
        const wipAccountId = await accountsService.resolveSystemAccount(tx, 'WIP', order.branchId);
        await accountsService.postSystemJournal(tx, {
          branchId: order.branchId,
          date: input.date,
          memo: `Finished goods receive ${voucher.receiveNo} for ${order.number}`,
          sourceModule: 'factory',
          sourceRefType: 'FinishedGoodsReceiveVoucher',
          sourceRefId: voucher.id,
          actorUserId: actor.userId,
          lines: [
            {
              accountId: inventoryAccountId,
              debit: receivedValue.toNumber(),
              credit: 0,
              currency: order.branch.currency,
              fxRate: 1,
            },
            {
              accountId: wipAccountId,
              debit: 0,
              credit: receivedValue.toNumber(),
              currency: order.branch.currency,
              fxRate: 1,
            },
          ],
        });
      }

      // Update ProductionOrder.producedQty and check if order is completed!
      const totalPassed = voucher.items
        .filter((it) => it.qualityStatus === 'PASSED')
        .reduce((sum, it) => sum.plus(it.quantity), D(0));

      if (totalPassed.gt(0)) {
        const updatedOrder = await tx.productionOrder.update({
          where: { id: order.id },
          data: {
            producedQty: { increment: totalPassed },
            actualStartDate: order.actualStartDate ?? new Date(),
          },
        });

        const isCompleted = updatedOrder.producedQty.gte(updatedOrder.plannedQty);
        if (isCompleted) {
          await tx.productionOrder.update({
            where: { id: order.id },
            data: {
              status: 'COMPLETED',
              actualEndDate: new Date(),
            },
          });
          await tx.productionStage.updateMany({
            where: { orderId: order.id, status: { in: ['PENDING', 'IN_PROGRESS'] } },
            data: { status: 'COMPLETED', completedAt: new Date() },
          });
        }
      }

      await recordAudit({
        actorId: actor.userId,
        branchId: order.branchId,
        module: 'factory',
        action: 'finished-goods-receive-create',
        entityType: 'FinishedGoodsReceiveVoucher',
        entityId: voucher.id,
        after: { receiveNo: voucher.receiveNo, warehouseId: voucher.warehouseId, items: voucher.items.length },
      }, tx);

      return voucher;
    });
  },
};
