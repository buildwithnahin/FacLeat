import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db';
import { authorize } from '@/server/auth/authorize';
import { assertBranchInScope, getScopedBranchIds } from '@/server/auth/data-scope';
import { recordAudit } from '@/server/audit/logger';
import { assertOpenPeriod } from '@/server/periods/guards';
import { approvalService } from '@/server/services/approval.service';
import { accountsService } from '@/server/services/accounts.service';
import type { AppSession } from '@/server/auth/session';
import type {
  ProductionOrderCreateInput,
  ProductionConsumeInput,
  ProductionOutputInput,
  ProductionStageUpdateInput,
  ProductionOrderStatusInput,
  ProductionCostEntryCreateInput,
  ProductionCostEntryDeleteInput,
  ProductionOverheadRateInput,
  ProductionPlanCreateInput,
  ProductionPlanDecisionInput,
  ProductionMaterialCreateInput,
  ProductionStageCreateInput,
} from '@/server/validators/factory';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { nextProductionNumber, nextDocumentNumber } from '@/lib/document-number';
import { autoCreateProductionOrderForPlan } from '@/server/services/factory-order-sync';
import { nextVoucherNumber } from '@/server/services/factory-workflow.service';

const ORDER_INCLUDE = {
  branch: { select: { id: true, name: true, code: true, currency: true, allowNegativeStock: true } },
  product: { select: { id: true, sku: true, name: true, unit: true } },
  stages: { orderBy: { sequence: 'asc' as const } },
  materials: {
    include: {
      product: { select: { id: true, sku: true, name: true, unit: true, costPrice: true } },
      fromWarehouse: { select: { id: true, code: true, name: true } },
    },
  },
  outputs: {
    include: {
      toWarehouse: { select: { id: true, code: true, name: true } },
    },
    orderBy: { createdAt: 'desc' as const },
  },
  costEntries: { orderBy: { createdAt: 'asc' as const } },
  productionIssueVouchers: {
    include: {
      warehouse: { select: { id: true, name: true, code: true } },
      items: { include: { product: { select: { id: true, name: true, sku: true } } } },
    },
    orderBy: [{ createdAt: 'desc' as const }, { voucherNo: 'desc' as const }],
  },
  finishedGoodsReceiveVouchers: {
    include: {
      warehouse: { select: { id: true, name: true, code: true } },
      items: { include: { product: { select: { id: true, name: true, sku: true } } } },
    },
    orderBy: [{ createdAt: 'desc' as const }, { receiveNo: 'desc' as const }],
  },
  processTrackings: {
    include: {
      stage: { select: { id: true, name: true, sequence: true } },
      operator: { select: { id: true, firstName: true, lastName: true, code: true } },
    },
    orderBy: [{ createdAt: 'desc' as const }, { trackingNo: 'desc' as const }],
  },
} satisfies Prisma.ProductionOrderInclude;

async function balanceFor(
  tx: Prisma.TransactionClient,
  branchId: string,
  warehouseId: string,
  productId: string,
): Promise<Prisma.Decimal> {
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

export interface ProductionCostSummary {
  /** Actual consumed material cost (or planned estimate if not yet consumed) */
  materialCost: Prisma.Decimal;
  /** True if materialCost is based on planned qty (no actual consumption recorded yet) */
  isEstimatedMaterialCost: boolean;
  labourCost: Prisma.Decimal;
  fixedOverheadCost: Prisma.Decimal;
  percentOverheadCost: Prisma.Decimal;
  wedgeCost: Prisma.Decimal;
  totalCost: Prisma.Decimal;
  /**
   * costPerUnit based on producedQty (actual); if not yet produced, based on plannedQty.
   * Always populated as long as there is a planned qty > 0.
   */
  costPerUnit: Prisma.Decimal | null;
  /** Whether costPerUnit is estimated (order not yet completed / no outputs) */
  isEstimatedCostPerUnit: boolean;
}

export function getCostSummary(params: {
  outputs: { quantity: Prisma.Decimal; costPerUnit: Prisma.Decimal }[];
  materials: {
    consumedQty: Prisma.Decimal;
    plannedQty: Prisma.Decimal;
    unitCost: Prisma.Decimal | null;
    product: { costPrice: Prisma.Decimal };
  }[];
  costEntries: { type: string; amount: Prisma.Decimal }[];
  overheadRate: Prisma.Decimal | null;
  producedQty: Prisma.Decimal;
  plannedQty: Prisma.Decimal;
}): ProductionCostSummary {
  const ZERO = new Prisma.Decimal(0);

  // ── Material cost ─────────────────────────────────────────────────────────
  // Priority 1: if finished-goods outputs have already been costed, use those.
  const outputCost = params.outputs.reduce(
    (s, o) => s.plus(o.quantity.times(o.costPerUnit)),
    ZERO,
  );

  // Priority 2: use actual consumed quantities × effective unit cost.
  const actualConsumedCost = params.materials.reduce((s, m) => {
    if (m.consumedQty.gt(0)) {
      const unitCost = m.unitCost ?? m.product.costPrice;
      return s.plus(m.consumedQty.times(unitCost));
    }
    return s;
  }, ZERO);

  // Priority 3 (estimation): when nothing consumed yet, use planned qty × effective unit cost.
  const estimatedMaterialCost = params.materials.reduce((s, m) => {
    const unitCost = m.unitCost ?? m.product.costPrice;
    return s.plus(m.plannedQty.times(unitCost));
  }, ZERO);

  let materialCost: Prisma.Decimal;
  let isEstimatedMaterialCost: boolean;

  if (outputCost.gt(0)) {
    // Order already has costed output records — most accurate
    materialCost = outputCost;
    isEstimatedMaterialCost = false;
  } else if (actualConsumedCost.gt(0)) {
    // Materials have been issued / consumed
    materialCost = actualConsumedCost;
    isEstimatedMaterialCost = false;
  } else {
    // Nothing consumed yet — show planned / standard cost as an estimate
    materialCost = estimatedMaterialCost;
    isEstimatedMaterialCost = true;
  }

  // ── Labour, overhead, wedge ───────────────────────────────────────────────
  const labourCost = params.costEntries
    .filter((e) => e.type === 'LABOUR')
    .reduce((s, e) => s.plus(e.amount), ZERO);

  const fixedOverheadCost = params.costEntries
    .filter((e) => e.type === 'OVERHEAD')
    .reduce((s, e) => s.plus(e.amount), ZERO);

  const wedgeCost = params.costEntries
    .filter((e) => e.type === 'WEDGE')
    .reduce((s, e) => s.plus(e.amount), ZERO);

  // % overhead applied on material cost
  const percentOverheadCost = params.overheadRate
    ? materialCost.times(params.overheadRate).dividedBy(100)
    : ZERO;

  const totalCost = materialCost
    .plus(labourCost)
    .plus(fixedOverheadCost)
    .plus(percentOverheadCost)
    .plus(wedgeCost);

  // ── Cost per unit ─────────────────────────────────────────────────────────
  // Use actual produced qty if available; otherwise fall back to planned qty for estimation.
  let costPerUnit: Prisma.Decimal | null = null;
  let isEstimatedCostPerUnit = false;

  if (params.producedQty.gt(0)) {
    costPerUnit = totalCost.dividedBy(params.producedQty).toDecimalPlaces(4);
    isEstimatedCostPerUnit = false;
  } else if (params.plannedQty.gt(0)) {
    costPerUnit = totalCost.dividedBy(params.plannedQty).toDecimalPlaces(4);
    isEstimatedCostPerUnit = true;
  }

  return {
    materialCost,
    isEstimatedMaterialCost,
    labourCost,
    fixedOverheadCost,
    percentOverheadCost,
    wedgeCost,
    totalCost,
    costPerUnit,
    isEstimatedCostPerUnit,
  };
}

export const factoryService = {
  async list(
    session: AppSession | null,
    filters: { branchId?: string; status?: string; search?: string } = {},
  ) {
    await authorize(session, 'factory:read');
    const branchIds = await getScopedBranchIds(session, filters.branchId);

    // Auto-sync any approved production plans that don't have a production order yet
    try {
      const approvedPlansWithoutOrders = await prisma.productionPlan.findMany({
        where: {
          status: 'APPROVED',
          ...(branchIds ? { branchId: { in: branchIds } } : {}),
          orders: { none: {} },
        },
        select: { id: true },
      });
      for (const p of approvedPlansWithoutOrders) {
        await autoCreateProductionOrderForPlan(p.id);
      }
    } catch (e) {
      console.error('Failed to auto-sync approved plans to orders', e);
    }

    return prisma.productionOrder.findMany({
      where: {
        ...(branchIds ? { branchId: { in: branchIds } } : {}),
        status: filters.status as Prisma.ProductionOrderWhereInput['status'],
        OR: filters.search
          ? [
              { number: { contains: filters.search } },
              { product: { name: { contains: filters.search } } },
              { product: { sku: { contains: filters.search } } },
            ]
          : undefined,
      },
      orderBy: [{ createdAt: 'desc' }, { number: 'desc' }, { id: 'desc' }],
      include: {
        branch: { select: { id: true, name: true, code: true } },
        product: { select: { id: true, sku: true, name: true } },
      },
      take: 200,
    });
  },

  async getById(session: AppSession | null, id: string) {
    await authorize(session, 'factory:read');
    const order = await prisma.productionOrder.findUnique({
      where: { id },
      include: ORDER_INCLUDE,
    });
    if (!order) throw new NotFoundError('Production order not found');
    await assertBranchInScope(session, order.branchId);
    return order;
  },

  async create(session: AppSession | null, input: ProductionOrderCreateInput) {
    const actor = await authorize(session, 'factory:plan');
    if (input.plannedEndDate < input.plannedStartDate) {
      throw new ValidationError('Planned end date cannot be before planned start date');
    }

    let plan: { id: string; status: string; branchId: string } | null = null;
    if (input.planId) {
      plan = await prisma.productionPlan.findUnique({
        where: { id: input.planId },
        select: { id: true, status: true, branchId: true },
      });
      if (!plan) throw new NotFoundError('Production plan not found');
      if (plan.branchId !== input.branchId) {
        throw new ValidationError('Plan belongs to a different branch');
      }
      if (plan.status !== 'APPROVED' && plan.status !== 'SCHEDULED') {
        throw new ValidationError(`Cannot create an order from a ${plan.status.toLowerCase()} plan`);
      }
    }

    return prisma.$transaction(async (tx) => {
      const year = input.plannedStartDate.getFullYear();
      const count = await tx.productionOrder.count({
        where: { createdAt: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) } },
      });
      const number = nextProductionNumber(year, count);

      let resolvedMaterials = input.materials;
      if (resolvedMaterials.length === 0) {
        const templateOrder = await tx.productionOrder.findFirst({
          where: { productId: input.productId, materials: { some: {} } },
          include: { materials: true },
          orderBy: { createdAt: 'desc' },
        });
        if (templateOrder && templateOrder.materials.length > 0 && templateOrder.plannedQty.gt(0)) {
          const scale = new Prisma.Decimal(input.plannedQty).dividedBy(templateOrder.plannedQty);
          resolvedMaterials = templateOrder.materials.map((m) => ({
            productId: m.productId,
            unit: m.unit,
            plannedQty: m.plannedQty.times(scale).toDecimalPlaces(4).toNumber(),
            unitCost: m.unitCost ? m.unitCost.toNumber() : undefined,
            materialType: m.materialType,
            fromWarehouseId: m.fromWarehouseId || undefined,
            note: `Auto-BOM from ${templateOrder.number}`,
          }));
        }
      }

      const order = await tx.productionOrder.create({
        data: {
          branchId: input.branchId,
          number,
          productId: input.productId,
          planId: plan?.id ?? null,
          plannedQty: new Prisma.Decimal(input.plannedQty),
          unit: input.unit,
          status: 'PLANNED',
          plannedStartDate: input.plannedStartDate,
          plannedEndDate: input.plannedEndDate,
          notes: input.notes || null,
          buyerName: input.buyerName || null,
          batchName: input.batchName || null,
          saleAmount: input.saleAmount != null ? new Prisma.Decimal(input.saleAmount) : null,
          createdById: actor.userId,
          stages: {
            create: input.stages.map((s) => ({
              sequence: s.sequence,
              name: s.name,
              notes: s.notes || null,
            })),
          },
          materials: {
            create: resolvedMaterials.map((m) => ({
              productId: m.productId,
              unit: m.unit,
              plannedQty: new Prisma.Decimal(m.plannedQty),
              unitCost: m.unitCost != null ? new Prisma.Decimal(m.unitCost) : null,
              materialType: m.materialType,
              fromWarehouseId: m.fromWarehouseId || null,
              note: m.note || null,
            })),
          },
        },
      });

      if (plan && plan.status === 'APPROVED') {
        await tx.productionPlan.update({
          where: { id: plan.id },
          data: { status: 'SCHEDULED' },
        });
      }

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: order.branchId,
          module: 'factory',
          action: 'create',
          entityType: 'ProductionOrder',
          entityId: order.id,
          after: {
            number: order.number,
            productId: order.productId,
            plannedQty: order.plannedQty.toString(),
            materials: input.materials.length,
            stages: input.stages.length,
            planId: plan?.id ?? null,
          },
        },
        tx,
      );

      return order;
    });
  },

  // ─── Production Plan ───────────────────────────────────────────────────────
  async listPlans(
    session: AppSession | null,
    filters: { branchId?: string; status?: string; search?: string } = {},
  ) {
    await authorize(session, 'factory:read');
    const branchIds = await getScopedBranchIds(session, filters.branchId);
    return prisma.productionPlan.findMany({
      where: {
        ...(branchIds ? { branchId: { in: branchIds } } : {}),
        status: filters.status as Prisma.ProductionPlanWhereInput['status'],
        OR: filters.search
          ? [
              { planNo: { contains: filters.search } },
              { product: { name: { contains: filters.search } } },
              { product: { sku: { contains: filters.search } } },
            ]
          : undefined,
      },
      orderBy: [{ createdAt: 'desc' }, { planNo: 'desc' }, { id: 'desc' }],
      include: {
        branch: { select: { id: true, name: true, code: true } },
        product: { select: { id: true, sku: true, name: true } },
        orders: { select: { id: true, number: true, status: true } },
      },
      take: 200,
    });
  },

  async getPlan(session: AppSession | null, id: string) {
    await authorize(session, 'factory:read');
    const plan = await prisma.productionPlan.findUnique({
      where: { id },
      include: {
        branch: { select: { id: true, name: true, currency: true } },
        product: { select: { id: true, sku: true, name: true, unit: true } },
        orders: {
          select: { id: true, number: true, status: true, plannedQty: true, producedQty: true },
        },
      },
    });
    if (!plan) throw new NotFoundError('Production plan not found');
    await assertBranchInScope(session, plan.branchId);
    return plan;
  },

  async createPlan(session: AppSession | null, input: ProductionPlanCreateInput) {
    const actor = await authorize(session, 'factory:plan');
    if (input.plannedEndDate < input.plannedStartDate) {
      throw new ValidationError('Planned end date cannot be before planned start date');
    }

    return prisma.$transaction(async (tx) => {
      const year = input.planningDate.getFullYear();
      const count = await tx.productionPlan.count({
        where: { createdAt: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) } },
      });
      const planNo = nextDocumentNumber('PLN', year, count);

      const plan = await tx.productionPlan.create({
        data: {
          planNo,
          branchId: input.branchId,
          productId: input.productId,
          quantity: new Prisma.Decimal(input.quantity),
          planningDate: input.planningDate,
          plannedStartDate: input.plannedStartDate,
          plannedEndDate: input.plannedEndDate,
          priority: input.priority,
          productionLine: input.productionLine || null,
          machine: input.machine || null,
          shift: input.shift || null,
          plannerId: actor.userId,
          status: 'DRAFT',
        },
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: plan.branchId,
          module: 'factory',
          action: 'plan-create',
          entityType: 'ProductionPlan',
          entityId: plan.id,
          after: { planNo, productId: plan.productId, quantity: plan.quantity.toString() },
        },
        tx,
      );

      return plan;
    });
  },

  async decidePlan(session: AppSession | null, input: ProductionPlanDecisionInput) {
    const actor = await authorize(session, 'factory:approve');
    const existing = await prisma.productionPlan.findUnique({
      where: { id: input.id },
      include: { branch: { select: { currency: true } } },
    });
    if (!existing) throw new NotFoundError('Production plan not found');
    if (existing.status !== 'DRAFT') {
      throw new ValidationError(`Cannot ${input.decision.toLowerCase()} a ${existing.status.toLowerCase()} plan`);
    }

    if (input.decision === 'APPROVE') {
      await approvalService.ensureApprovedOrRequest(session, {
        module: 'factory',
        action: 'plan-approve',
        entityType: 'ProductionPlan',
        entityId: existing.id,
        title: `Production plan ${existing.planNo}`,
        summary: `Approval required before scheduling plan ${existing.planNo}`,
        amount: existing.quantity.toNumber(),
        currency: existing.branch.currency,
        branchId: existing.branchId,
      });
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.productionPlan.update({
        where: { id: input.id },
        data: { status: input.decision === 'APPROVE' ? 'APPROVED' : 'CANCELLED' },
      });

      if (input.decision === 'APPROVE') {
        await autoCreateProductionOrderForPlan(input.id, tx, actor.userId);
      }

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: existing.branchId,
          module: 'factory',
          action: `plan-${input.decision.toLowerCase()}`,
          entityType: 'ProductionPlan',
          entityId: updated.id,
          before: { status: existing.status },
          after: { status: updated.status },
        },
        tx,
      );

      return updated;
    });
  },

  async consumeMaterials(session: AppSession | null, input: ProductionConsumeInput) {
    const actor = await authorize(session, 'factory:execute');
    const order = await prisma.productionOrder.findUnique({
      where: { id: input.orderId },
      include: {
        materials: {
          include: {
            product: { select: { id: true, name: true, sku: true, unit: true } },
            fromWarehouse: { select: { id: true, name: true, code: true } },
          },
        },
        branch: { select: { id: true, name: true, allowNegativeStock: true, currency: true } },
      },
    });
    if (!order) throw new NotFoundError('Production order not found');
    if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
      throw new ValidationError(`Cannot consume materials on ${order.status.toLowerCase()} order`);
    }

    return prisma.$transaction(async (tx) => {
      await assertOpenPeriod(tx, order.branchId);
      let consumptionValue = new Prisma.Decimal(0);

      const branchWarehouses = await tx.warehouse.findMany({
        where: { branchId: order.branchId, isActive: true },
        select: { id: true, name: true, code: true },
      });

      const voucherNo = await nextVoucherNumber('PI', 'productionIssueVoucher');
      const primaryWarehouseId =
        input.items[0]?.warehouseId ||
        order.materials[0]?.fromWarehouseId ||
        branchWarehouses[0]?.id;

      if (!primaryWarehouseId) {
        throw new ValidationError('No active warehouse found in branch to issue materials from');
      }

      const issueVoucher = await tx.productionIssueVoucher.create({
        data: {
          voucherNo,
          date: new Date(),
          branchId: order.branchId,
          orderId: order.id,
          warehouseId: primaryWarehouseId,
          status: 'ISSUED',
          requestedById: actor.userId,
          approvedById: actor.userId,
          issuedById: actor.userId,
          remarks: `Direct consumption from Production Order ${order.number}`,
          items: {
            create: input.items.map((it) => {
              const mat = order.materials.find((m) => m.id === it.materialId);
              return {
                productId: mat ? mat.productId : it.materialId,
                requiredQty: new Prisma.Decimal(it.quantity),
                issuedQty: new Prisma.Decimal(it.quantity),
                uom: mat?.unit ?? 'PCS',
              };
            }),
          },
        },
      });

      for (const item of input.items) {
        const material = order.materials.find((m) => m.id === item.materialId);
        if (!material) throw new ValidationError('Unknown material line');

        let targetWarehouseId = item.warehouseId || material.fromWarehouseId;
        const qty = new Prisma.Decimal(item.quantity);

        if (!order.branch.allowNegativeStock) {
          let current = targetWarehouseId
            ? await balanceFor(tx, order.branchId, targetWarehouseId, material.productId)
            : new Prisma.Decimal(0);

          // If target warehouse doesn't have sufficient stock, auto-search other branch warehouses with available stock
          if (current.lt(qty)) {
            let foundAlternate = false;
            for (const wh of branchWarehouses) {
              if (wh.id === targetWarehouseId) continue;
              const whBal = await balanceFor(tx, order.branchId, wh.id, material.productId);
              if (whBal.gte(qty)) {
                targetWarehouseId = wh.id;
                current = whBal;
                foundAlternate = true;
                break;
              }
            }

            if (!foundAlternate && current.lt(qty)) {
              // Gather available stock details in this branch
              let totalInBranch = new Prisma.Decimal(0);
              const whStocks: string[] = [];
              for (const wh of branchWarehouses) {
                const bal = await balanceFor(tx, order.branchId, wh.id, material.productId);
                if (bal.gt(0)) {
                  totalInBranch = totalInBranch.plus(bal);
                  whStocks.push(`${wh.name}: ${bal}`);
                }
              }

              // Also check company-wide stock across all branches
              const companyLedgerAgg = await tx.inventoryLedger.groupBy({
                by: ['direction'],
                where: { productId: material.productId },
                _sum: { quantity: true },
              });
              let companyTotal = new Prisma.Decimal(0);
              for (const r of companyLedgerAgg) {
                if (r.direction === 'IN') companyTotal = companyTotal.plus(r._sum.quantity ?? 0);
                else if (r.direction === 'OUT') companyTotal = companyTotal.minus(r._sum.quantity ?? 0);
              }

              const prodName = material.product.name;
              const unit = material.unit || 'units';

              if (totalInBranch.lt(qty) && companyTotal.gte(qty)) {
                throw new ValidationError(
                  `Insufficient stock for "${prodName}" in branch ${order.branch.name} (have ${totalInBranch} ${unit}, need ${qty} ${unit}). Total company-wide stock is ${companyTotal} ${unit} — please transfer stock to branch warehouse before consumption.`,
                );
              }

              throw new ValidationError(
                `Insufficient stock for "${prodName}": available in this branch: ${totalInBranch} ${unit} (need ${qty} ${unit}). ${whStocks.length > 0 ? `In warehouses: [${whStocks.join(', ')}]` : 'No stock found in this branch'}.`,
              );
            }
          }
        }

        if (!targetWarehouseId) {
          throw new ValidationError(
            `Material "${material.product.name}" has no source warehouse. Please select a warehouse.`,
          );
        }

        const costPerUnit = new Prisma.Decimal(item.costPerUnit ?? 0);
        await tx.inventoryLedger.create({
          data: {
            branchId: order.branchId,
            warehouseId: targetWarehouseId,
            productId: material.productId,
            direction: 'OUT',
            quantity: qty,
            costPerUnit,
            refType: 'PRODUCTION_ISSUE',
            refId: issueVoucher.id,
            note: `Consumption for ${order.number} (${voucherNo})`,
            createdById: actor.userId,
          },
        });

        await tx.wipLedger.create({
          data: {
            date: new Date(),
            branchId: order.branchId,
            orderId: order.id,
            productId: material.productId,
            voucher: voucherNo,
            inQty: qty,
            balance: qty,
            cost: qty.times(costPerUnit),
            operatorId: null,
          },
        });

        await tx.productionMaterial.update({
          where: { id: material.id },
          data: {
            consumedQty: { increment: qty },
            fromWarehouseId: targetWarehouseId,
          },
        });

        consumptionValue = consumptionValue.plus(qty.times(costPerUnit));
      }

      if (order.status === 'PLANNED') {
        await tx.productionOrder.update({
          where: { id: order.id },
          data: { status: 'IN_PROGRESS', actualStartDate: new Date() },
        });
      }

      // Advance stage 1 to IN_PROGRESS if currently PENDING
      const firstStage = await tx.productionStage.findFirst({
        where: { orderId: order.id, sequence: 1 },
      });
      if (firstStage && firstStage.status === 'PENDING') {
        await tx.productionStage.update({
          where: { id: firstStage.id },
          data: { status: 'IN_PROGRESS', startedAt: new Date() },
        });
      }

      if (consumptionValue.gt(0)) {
        const wipAccountId = await accountsService.resolveSystemAccount(tx, 'WIP', order.branchId);
        const inventoryAccountId = await accountsService.resolveSystemAccount(
          tx,
          'INVENTORY_RAW_MATERIAL',
          order.branchId,
        );
        await accountsService.postSystemJournal(tx, {
          branchId: order.branchId,
          date: new Date(),
          memo: `Material consumption for ${order.number}`,
          sourceModule: 'factory',
          sourceRefType: 'ProductionConsumption',
          sourceRefId: `${order.id}-${Date.now()}`,
          actorUserId: actor.userId,
          lines: [
            {
              accountId: wipAccountId,
              debit: consumptionValue.toNumber(),
              credit: 0,
              currency: order.branch.currency,
              fxRate: 1,
            },
            {
              accountId: inventoryAccountId,
              debit: 0,
              credit: consumptionValue.toNumber(),
              currency: order.branch.currency,
              fxRate: 1,
            },
          ],
        });
      }

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: order.branchId,
          module: 'factory',
          action: 'consume',
          entityType: 'ProductionOrder',
          entityId: order.id,
          after: { items: input.items.length, consumptionValue: consumptionValue.toString() },
        },
        tx,
      );

      return { count: input.items.length };
    });
  },

  async recordOutput(session: AppSession | null, input: ProductionOutputInput) {
    const actor = await authorize(session, 'factory:execute');
    const order = await prisma.productionOrder.findUnique({
      where: { id: input.orderId },
    });
    if (!order) throw new NotFoundError('Production order not found');
    if (order.status === 'CANCELLED') {
      throw new ValidationError('Cannot record output on a cancelled order');
    }

    const qty = new Prisma.Decimal(input.quantity);

    return prisma.$transaction(async (tx) => {
      await assertOpenPeriod(tx, order.branchId);

      const warehouse = await tx.warehouse.findUnique({ where: { id: input.toWarehouseId } });
      if (!warehouse || warehouse.branchId !== order.branchId) {
        throw new ValidationError('Target warehouse does not belong to this branch');
      }

      const receiveNo = await nextVoucherNumber('FGR', 'finishedGoodsReceiveVoucher');
      const unitCost = new Prisma.Decimal(input.costPerUnit ?? 0);

      const fgVoucher = await tx.finishedGoodsReceiveVoucher.create({
        data: {
          receiveNo,
          date: new Date(),
          branchId: order.branchId,
          orderId: order.id,
          warehouseId: input.toWarehouseId,
          receivedById: actor.userId,
          approvedById: actor.userId,
          remarks: input.note || `Output recorded from Order ${order.number}`,
          items: {
            create: [
              {
                productId: order.productId,
                quantity: qty,
                uom: order.unit,
                qualityStatus: 'PASSED',
              },
            ],
          },
        },
      });

      const output = await tx.productionOutput.create({
        data: {
          orderId: order.id,
          productId: order.productId,
          unit: order.unit,
          quantity: qty,
          costPerUnit: unitCost,
          toWarehouseId: input.toWarehouseId,
          note: input.note || null,
          createdById: actor.userId,
        },
      });

      await tx.inventoryLedger.create({
        data: {
          branchId: order.branchId,
          warehouseId: input.toWarehouseId,
          productId: order.productId,
          direction: 'IN',
          quantity: qty,
          costPerUnit: unitCost,
          refType: 'FINISHED_GOODS_RECEIVE',
          refId: fgVoucher.id,
          note: `Output for ${order.number} (${receiveNo})`,
          createdById: actor.userId,
        },
      });

      await tx.wipLedger.create({
        data: {
          date: new Date(),
          branchId: order.branchId,
          orderId: order.id,
          productId: order.productId,
          voucher: receiveNo,
          outQty: qty,
          balance: new Prisma.Decimal(0),
          cost: qty.times(unitCost),
        },
      });

      const updated = await tx.productionOrder.update({
        where: { id: order.id },
        data: {
          producedQty: { increment: qty },
          actualStartDate: order.actualStartDate ?? new Date(),
        },
      });
      const completed = updated.producedQty.gte(updated.plannedQty);
      const desiredStatus = completed ? 'COMPLETED' : 'IN_PROGRESS';
      if (updated.status !== desiredStatus) {
        await tx.productionOrder.update({
          where: { id: order.id },
          data: {
            status: desiredStatus,
            actualEndDate: completed ? new Date() : null,
          },
        });
      }

      if (completed) {
        await tx.productionStage.updateMany({
          where: { orderId: order.id, status: { in: ['PENDING', 'IN_PROGRESS'] } },
          data: { status: 'COMPLETED', completedAt: new Date() },
        });
      }

      const outputValue = qty.times(unitCost);
      if (outputValue.gt(0)) {
        const inventoryAccountId = await accountsService.resolveSystemAccount(
          tx,
          'INVENTORY_FINISHED_GOODS',
          order.branchId,
        );
        const wipAccountId = await accountsService.resolveSystemAccount(tx, 'WIP', order.branchId);
        await accountsService.postSystemJournal(tx, {
          branchId: order.branchId,
          date: new Date(),
          memo: `Finished goods receive ${receiveNo} for ${order.number}`,
          sourceModule: 'factory',
          sourceRefType: 'FinishedGoodsReceiveVoucher',
          sourceRefId: fgVoucher.id,
          actorUserId: actor.userId,
          lines: [
            {
              accountId: inventoryAccountId,
              debit: outputValue.toNumber(),
              credit: 0,
              currency: order.branch.currency,
              fxRate: 1,
            },
            {
              accountId: wipAccountId,
              debit: 0,
              credit: outputValue.toNumber(),
              currency: order.branch.currency,
              fxRate: 1,
            },
          ],
        });
      }

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: order.branchId,
          module: 'factory',
          action: 'output',
          entityType: 'ProductionOrder',
          entityId: order.id,
          after: {
            outputId: output.id,
            qty: qty.toString(),
            toWarehouseId: input.toWarehouseId,
            completed,
          },
        },
        tx,
      );

      return output;
    });
  },

  async updateStage(session: AppSession | null, input: ProductionStageUpdateInput) {
    const actor = await authorize(session, 'factory:execute');
    const stage = await prisma.productionStage.findUnique({
      where: { id: input.stageId },
      include: { order: { select: { id: true, branchId: true, number: true } } },
    });
    if (!stage) throw new NotFoundError('Stage not found');

    const now = new Date();
    return prisma.$transaction(async (tx) => {
      const updated = await tx.productionStage.update({
        where: { id: stage.id },
        data: {
          status: input.status,
          notes: input.notes || null,
          startedAt:
            input.status === 'IN_PROGRESS' && !stage.startedAt ? now : stage.startedAt,
          completedAt:
            input.status === 'COMPLETED' ? now : stage.completedAt,
        },
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: stage.order.branchId,
          module: 'factory',
          action: 'stage-update',
          entityType: 'ProductionStage',
          entityId: stage.id,
          before: { status: stage.status },
          after: { status: updated.status, orderNumber: stage.order.number },
        },
        tx,
      );

      return updated;
    });
  },

  async addMaterial(session: AppSession | null, input: ProductionMaterialCreateInput) {
    const actor = await authorize(session, 'factory:plan');
    const order = await prisma.productionOrder.findUnique({
      where: { id: input.orderId },
      select: { id: true, branchId: true, status: true, number: true },
    });
    if (!order) throw new NotFoundError('Production order not found');
    await assertBranchInScope(session, order.branchId);

    if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
      throw new ValidationError(`Cannot add materials to a ${order.status.toLowerCase()} order`);
    }

    const product = await prisma.product.findUnique({
      where: { id: input.productId },
      select: { id: true, costPrice: true },
    });
    if (!product) throw new NotFoundError('Product not found');

    const unitCost = input.unitCost != null ? new Prisma.Decimal(input.unitCost) : product.costPrice;

    return prisma.$transaction(async (tx) => {
      const material = await tx.productionMaterial.create({
        data: {
          orderId: input.orderId,
          productId: input.productId,
          unit: input.unit,
          plannedQty: new Prisma.Decimal(input.plannedQty),
          consumedQty: new Prisma.Decimal(0),
          unitCost,
          fromWarehouseId: input.fromWarehouseId || null,
          materialType: input.materialType,
          note: input.note || null,
        },
        include: {
          product: { select: { id: true, sku: true, name: true, unit: true, costPrice: true } },
          fromWarehouse: { select: { id: true, code: true, name: true } },
        },
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: order.branchId,
          module: 'factory',
          action: 'material-add',
          entityType: 'ProductionMaterial',
          entityId: material.id,
          after: {
            orderNumber: order.number,
            productId: material.productId,
            plannedQty: material.plannedQty.toString(),
          },
        },
        tx,
      );

      return material;
    });
  },

  async addStage(session: AppSession | null, input: ProductionStageCreateInput) {
    const actor = await authorize(session, 'factory:plan');
    const order = await prisma.productionOrder.findUnique({
      where: { id: input.orderId },
      include: { stages: { select: { sequence: true } } },
    });
    if (!order) throw new NotFoundError('Production order not found');
    await assertBranchInScope(session, order.branchId);

    if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
      throw new ValidationError(`Cannot add stages to a ${order.status.toLowerCase()} order`);
    }

    let sequence = input.sequence;
    const existingSeqs = new Set(order.stages.map((s) => s.sequence));
    if (existingSeqs.has(sequence)) {
      sequence = Math.max(...order.stages.map((s) => s.sequence), 0) + 1;
    }

    return prisma.$transaction(async (tx) => {
      const stage = await tx.productionStage.create({
        data: {
          orderId: input.orderId,
          sequence,
          name: input.name,
          notes: input.notes || null,
          status: 'PENDING',
        },
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: order.branchId,
          module: 'factory',
          action: 'stage-add',
          entityType: 'ProductionStage',
          entityId: stage.id,
          after: {
            orderNumber: order.number,
            sequence: stage.sequence,
            name: stage.name,
          },
        },
        tx,
      );

      return stage;
    });
  },

  async updateStatus(session: AppSession | null, input: ProductionOrderStatusInput) {
    const actor = await authorize(session, 'factory:close');
    const order = await prisma.productionOrder.findUnique({ where: { id: input.orderId } });
    if (!order) throw new NotFoundError('Production order not found');

    return prisma.$transaction(async (tx) => {
      const updated = await tx.productionOrder.update({
        where: { id: order.id },
        data: {
          status: input.status,
          actualEndDate:
            input.status === 'COMPLETED' || input.status === 'CANCELLED'
              ? order.actualEndDate ?? new Date()
              : order.actualEndDate,
        },
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: order.branchId,
          module: 'factory',
          action: 'status',
          entityType: 'ProductionOrder',
          entityId: order.id,
          before: { status: order.status },
          after: { status: updated.status },
        },
        tx,
      );

      return updated;
    });
  },

  async summary(session: AppSession | null, branchId?: string) {
    await authorize(session, 'factory:read');
    const branchIds = await getScopedBranchIds(session, branchId);
    const where: Prisma.ProductionOrderWhereInput = branchIds ? { branchId: { in: branchIds } } : {};
    const [planned, inProgress, completed, overdue] = await Promise.all([
      prisma.productionOrder.count({ where: { ...where, status: 'PLANNED' } }),
      prisma.productionOrder.count({ where: { ...where, status: 'IN_PROGRESS' } }),
      prisma.productionOrder.count({ where: { ...where, status: 'COMPLETED' } }),
      prisma.productionOrder.count({
        where: {
          ...where,
          status: { in: ['PLANNED', 'IN_PROGRESS'] },
          plannedEndDate: { lt: new Date() },
        },
      }),
    ]);
    return { planned, inProgress, completed, overdue };
  },

  async addCostEntry(session: AppSession | null, input: ProductionCostEntryCreateInput) {
    const actor = await authorize(session, 'factory:execute');
    const order = await prisma.productionOrder.findUnique({ where: { id: input.orderId } });
    if (!order) throw new NotFoundError('Production order not found');
    if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
      throw new ValidationError(`Cannot add cost entries to a ${order.status.toLowerCase()} order`);
    }

    return prisma.$transaction(async (tx) => {
      await assertOpenPeriod(tx, order.branchId);

      let amount: Prisma.Decimal;
      let hours: Prisma.Decimal | null = null;
      let rate: Prisma.Decimal | null = null;

      if (input.type === 'LABOUR' && input.hours != null && input.rate != null) {
        hours = new Prisma.Decimal(input.hours);
        rate = new Prisma.Decimal(input.rate);
        amount = hours.times(rate);
      } else {
        if (input.amount == null) {
          throw new ValidationError('Amount is required');
        }
        amount = new Prisma.Decimal(input.amount);
      }

      const entry = await tx.productionCostEntry.create({
        data: {
          orderId: input.orderId,
          type: input.type,
          description: input.description,
          hours,
          rate,
          amount,
          note: input.note || null,
          createdById: actor.userId,
        },
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: order.branchId,
          module: 'factory',
          action: 'cost-entry-add',
          entityType: 'ProductionCostEntry',
          entityId: entry.id,
          after: {
            orderId: order.id,
            type: input.type,
            description: input.description,
            amount: amount.toString(),
          },
        },
        tx,
      );

      return entry;
    });
  },

  async deleteCostEntry(session: AppSession | null, input: ProductionCostEntryDeleteInput) {
    const actor = await authorize(session, 'factory:execute');
    const entry = await prisma.productionCostEntry.findUnique({
      where: { id: input.entryId },
      include: { order: { select: { id: true, branchId: true, status: true } } },
    });
    if (!entry) throw new NotFoundError('Cost entry not found');
    if (entry.orderId !== input.orderId) throw new ValidationError('Entry does not belong to this order');
    if (entry.order.status === 'COMPLETED' || entry.order.status === 'CANCELLED') {
      throw new ValidationError('Cannot delete cost entries on a closed order');
    }

    return prisma.$transaction(async (tx) => {
      await tx.productionCostEntry.delete({ where: { id: entry.id } });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: entry.order.branchId,
          module: 'factory',
          action: 'cost-entry-delete',
          entityType: 'ProductionCostEntry',
          entityId: entry.id,
          before: {
            type: entry.type,
            description: entry.description,
            amount: entry.amount.toString(),
          },
        },
        tx,
      );

      return { deleted: true };
    });
  },

  async updateOverheadRate(session: AppSession | null, input: ProductionOverheadRateInput) {
    const actor = await authorize(session, 'factory:execute');
    const order = await prisma.productionOrder.findUnique({ where: { id: input.orderId } });
    if (!order) throw new NotFoundError('Production order not found');
    if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
      throw new ValidationError('Cannot update overhead rate on a closed order');
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.productionOrder.update({
        where: { id: order.id },
        data: { overheadRate: new Prisma.Decimal(input.overheadRate) },
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: order.branchId,
          module: 'factory',
          action: 'overhead-rate-update',
          entityType: 'ProductionOrder',
          entityId: order.id,
          before: { overheadRate: order.overheadRate?.toString() ?? null },
          after: { overheadRate: input.overheadRate.toString() },
        },
        tx,
      );

      return updated;
    });
  },

  async getCostingSheetData(session: AppSession | null, orderId: string) {
    await authorize(session, 'factory:read');

    const order = await prisma.productionOrder.findUnique({
      where: { id: orderId },
      include: {
        branch: { select: { id: true, name: true, address: true, currency: true } },
        product: { select: { id: true, sku: true, name: true } },
        materials: {
          include: {
            product: { select: { id: true, name: true, sku: true, costPrice: true } },
          },
          orderBy: { materialType: 'asc' },
        },
        costEntries: { orderBy: { createdAt: 'asc' } },
        outputs: true,
      },
    });

    if (!order) throw new NotFoundError('Production order not found');

    const ZERO = new Prisma.Decimal(0);

    const leatherRows = order.materials.filter((m) => m.materialType === 'LEATHER').map((m) => ({
      description: m.product.name,
      quantitySF: m.consumedQty.gt(0) ? m.consumedQty : m.plannedQty,
      sfPrice: m.unitCost ?? m.product.costPrice,
      total: (m.consumedQty.gt(0) ? m.consumedQty : m.plannedQty).times(
        m.unitCost ?? m.product.costPrice,
      ),
    }));

    const accessoryRows = order.materials.filter((m) => m.materialType === 'ACCESSORY').map((m) => ({
      name: m.product.name,
      quantity: m.consumedQty.gt(0) ? m.consumedQty : m.plannedQty,
      price: m.unitCost ?? m.product.costPrice,
      total: (m.consumedQty.gt(0) ? m.consumedQty : m.plannedQty).times(
        m.unitCost ?? m.product.costPrice,
      ),
    }));

    const otherMaterialRows = order.materials.filter((m) => m.materialType === 'OTHER').map((m) => ({
      name: m.product.name,
      quantity: m.consumedQty.gt(0) ? m.consumedQty : m.plannedQty,
      price: m.unitCost ?? m.product.costPrice,
      total: (m.consumedQty.gt(0) ? m.consumedQty : m.plannedQty).times(
        m.unitCost ?? m.product.costPrice,
      ),
    }));

    const leatherTotal = leatherRows.reduce((s, r) => s.plus(r.total), ZERO);
    const accessoriesTotal = accessoryRows.reduce((s, r) => s.plus(r.total), ZERO);
    const otherMaterialsTotal = otherMaterialRows.reduce((s, r) => s.plus(r.total), ZERO);

    const labourEntries = order.costEntries.filter((e) => e.type === 'LABOUR');
    const otherEntries = order.costEntries.filter((e) => e.type !== 'LABOUR');
    const wagesTotal = labourEntries.reduce((s, e) => s.plus(e.amount), ZERO);
    const otherTotal = otherEntries.reduce((s, e) => s.plus(e.amount), ZERO);

    const totalCost = leatherTotal
      .plus(accessoriesTotal)
      .plus(otherMaterialsTotal)
      .plus(wagesTotal)
      .plus(otherTotal);
    const quantity = order.producedQty.gt(0) ? order.producedQty : order.plannedQty;
    const perUnitCost = quantity.gt(0) ? totalCost.dividedBy(quantity).toDecimalPlaces(2) : ZERO;
    const profit = order.saleAmount ? order.saleAmount.minus(totalCost) : null;

    return {
      header: {
        serialNo: order.number,
        date: order.actualEndDate ?? order.plannedEndDate,
        buyerName: order.buyerName ?? '',
        batchName: order.batchName ?? '',
        branchName: order.branch.name,
      },
      costSummary: {
        leather: leatherTotal,
        accessories: accessoriesTotal,
        otherMaterials: otherMaterialsTotal,
        wages: wagesTotal,
        otherEntries: otherEntries.map((e) => ({ description: e.description, amount: e.amount })),
        totalCost,
        quantity,
        perUnitCost,
        saleAmount: order.saleAmount,
        profit,
      },
      leatherTable: { rows: leatherRows, grandTotal: leatherTotal },
      accessoriesTable: { rows: accessoryRows, grandTotal: accessoriesTotal },
      otherMaterialsTable: { rows: otherMaterialRows, grandTotal: otherMaterialsTotal },
    };
  },
};
