import 'server-only';

import { Prisma, StockRequisitionStatus, StockTransferStatus } from '@prisma/client';
import { prisma } from '@/server/db';
import { authorize } from '@/server/auth/authorize';
import { recordAudit } from '@/server/audit/logger';
import { assertOpenPeriod } from '@/server/periods/guards';
import { publishToPermission } from '@/server/notifications/publisher';
import { nextDocumentNumber } from '@/lib/document-number';
import type { AppSession } from '@/server/auth/session';
import type {
  StockDispatchCreateInput,
  StockRequisitionAssignInput,
  StockRequisitionCreateInput,
  StockRequisitionDecisionInput,
  StockTransferReceiveInput,
  StockTransferStatusInput,
} from '@/server/validators/stock-requisitions';
import { NotFoundError, ValidationError } from '@/lib/errors';

const D = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value);
const ZERO = new Prisma.Decimal(0);

type BalanceRow = { productId: string; balance: Prisma.Decimal };

const REQUISITION_INCLUDE = {
  branch: { select: { id: true, name: true, code: true } },
  showroomWarehouse: { select: { id: true, name: true, code: true, branchId: true } },
  sourceWarehouse: { select: { id: true, name: true, code: true, branchId: true } },
  items: {
    include: {
      product: { select: { id: true, sku: true, name: true, unit: true, type: true, costPrice: true } },
    },
    orderBy: { createdAt: 'asc' as const },
  },
  transfers: {
    include: {
      fromBranch: { select: { id: true, name: true, code: true } },
      toBranch: { select: { id: true, name: true, code: true } },
      fromWarehouse: { select: { id: true, name: true, code: true, branchId: true } },
      toWarehouse: { select: { id: true, name: true, code: true, branchId: true } },
      items: {
        include: {
          product: { select: { id: true, sku: true, name: true, unit: true } },
          requisitionItem: true,
        },
        orderBy: { createdAt: 'asc' as const },
      },
    },
    orderBy: { createdAt: 'desc' as const },
  },
} satisfies Prisma.StockRequisitionInclude;

async function getWarehouseBalances(
  tx: Prisma.TransactionClient | typeof prisma,
  branchId: string,
  warehouseId: string,
  productIds: string[],
): Promise<BalanceRow[]> {
  if (productIds.length === 0) return [];
  const placeholders = productIds.map(() => '?').join(', ');
  const rows = await tx.$queryRawUnsafe<BalanceRow[]>(
    `SELECT \`productId\`,
            CAST(COALESCE(SUM(CASE WHEN direction = 'IN' THEN quantity ELSE -quantity END), 0) AS DECIMAL(18,4)) AS balance
       FROM \`InventoryLedger\`
      WHERE \`branchId\` = ?
        AND \`warehouseId\` = ?
        AND \`productId\` IN (${placeholders})
      GROUP BY \`productId\``,
    branchId,
    warehouseId,
    ...productIds,
  );
  return rows.map((row) => ({ productId: row.productId, balance: D(row.balance ?? 0) }));
}

function nextRequisitionStatusFromTransfer(status: StockTransferStatus): StockRequisitionStatus {
  switch (status) {
    case 'PICKING':
      return 'PICKING';
    case 'PACKED':
      return 'PACKED';
    case 'DISPATCHED':
      return 'DISPATCHED';
    case 'IN_TRANSIT':
      return 'IN_TRANSIT';
    case 'RECEIVED':
      return 'RECEIVED';
    case 'COMPLETED':
      return 'COMPLETED';
    case 'CANCELLED':
      return 'WAREHOUSE_ASSIGNED';
    default:
      return 'WAREHOUSE_ASSIGNED';
  }
}

function assertAllowedTransition(current: StockTransferStatus, next: StockTransferStatus) {
  const allowed: Record<StockTransferStatus, StockTransferStatus[]> = {
    DRAFT: ['PICKING', 'CANCELLED'],
    PICKING: ['PACKED', 'CANCELLED'],
    PACKED: ['DISPATCHED', 'CANCELLED'],
    DISPATCHED: ['IN_TRANSIT', 'CANCELLED'],
    IN_TRANSIT: [],
    RECEIVED: ['COMPLETED'],
    COMPLETED: [],
    CANCELLED: [],
  };

  if (!allowed[current].includes(next)) {
    throw new ValidationError(`Cannot move transfer from ${current} to ${next}`);
  }
}

export const stockRequisitionService = {
  async listRequisitions(
    session: AppSession | null,
    filters: {
      branchId?: string;
      status?: StockRequisitionStatus;
      sourceBranchId?: string;
      destinationBranchId?: string;
      direction?: 'ALL' | 'INCOMING' | 'OUTGOING';
      allBranches?: boolean;
    } = {},
  ) {
    await authorize(session, 'warehouse:transfer');

    const where: Prisma.StockRequisitionWhereInput = {};
    if (filters.status) where.status = filters.status;

    if (filters.destinationBranchId) {
      where.branchId = filters.destinationBranchId;
    }

    if (filters.sourceBranchId) {
      where.sourceWarehouse = { branchId: filters.sourceBranchId };
    }

    if (filters.branchId && !filters.destinationBranchId && !filters.sourceBranchId && !filters.allBranches) {
      if (filters.direction === 'INCOMING') {
        where.branchId = filters.branchId;
      } else if (filters.direction === 'OUTGOING') {
        where.sourceWarehouse = { branchId: filters.branchId };
      } else {
        where.OR = [
          { branchId: filters.branchId },
          { sourceWarehouse: { branchId: filters.branchId } },
          { transfers: { some: { fromBranchId: filters.branchId } } },
          { transfers: { some: { toBranchId: filters.branchId } } },
        ];
      }
    }

    return prisma.stockRequisition.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: REQUISITION_INCLUDE,
    });
  },

  async listReceiptTransfers(session: AppSession | null, branchId?: string, allBranches?: boolean) {
    await authorize(session, 'warehouse:transfer');

    const isAdmin = session?.roles.some((r) => r.toLowerCase().includes('admin'));
    const where: Prisma.StockTransferWhereInput = {
      status: { in: ['DISPATCHED', 'IN_TRANSIT', 'RECEIVED'] },
    };

    if (branchId && !allBranches && !isAdmin) {
      where.toBranchId = branchId;
    }

    return prisma.stockTransfer.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        requisition: {
          select: {
            id: true,
            number: true,
            status: true,
            showroomWarehouse: { select: { id: true, name: true, code: true } },
          },
        },
        fromWarehouse: { select: { id: true, name: true, code: true } },
        toWarehouse: { select: { id: true, name: true, code: true } },
        items: {
          include: { product: { select: { id: true, sku: true, name: true, unit: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  },

  async getRequisition(session: AppSession | null, id: string) {
    await authorize(session, 'warehouse:transfer');
    const row = await prisma.stockRequisition.findUnique({
      where: { id },
      include: REQUISITION_INCLUDE,
    });
    if (!row) throw new NotFoundError('Stock requisition not found');
    return row;
  },

  async create(session: AppSession | null, input: StockRequisitionCreateInput) {
    const actor = await authorize(session, 'warehouse:transfer', { branchId: input.branchId });
    const showroomWarehouse = await prisma.warehouse.findUnique({ where: { id: input.showroomWarehouseId } });
    if (!showroomWarehouse || showroomWarehouse.branchId !== input.branchId) {
      throw new ValidationError('Selected showroom does not belong to this branch');
    }
    if (showroomWarehouse.type !== 'SHOWROOM') {
      throw new ValidationError('Destination warehouse must be a showroom warehouse');
    }

    return prisma.$transaction(async (tx) => {
      const year = new Date().getFullYear();
      const count = await tx.stockRequisition.count({ where: { branchId: input.branchId } });
      const number = nextDocumentNumber('SRQ', year, count, 6);

      const requisition = await tx.stockRequisition.create({
        data: {
          number,
          branchId: input.branchId,
          showroomWarehouseId: input.showroomWarehouseId,
          priority: input.priority,
          requiredDate: input.requiredDate,
          remarks: input.remarks || null,
          requestedById: actor.userId,
          status: 'SUBMITTED',
          items: {
            create: input.items.map((item) => ({
              productId: item.productId,
              unit: item.unit,
              requestedQty: D(item.requestedQty),
              note: item.note || null,
            })),
          },
        },
        include: { items: true },
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: input.branchId,
          module: 'warehouse',
          action: 'stock-requisition-create',
          entityType: 'StockRequisition',
          entityId: requisition.id,
          after: { number: requisition.number, items: requisition.items.length, status: requisition.status },
        },
        tx,
      );

      return requisition;
    }).then(async (requisition) => {
      await publishToPermission('approvals:read', {
        branchId: input.branchId,
        severity: 'INFO',
        module: 'warehouse',
        title: `Stock requisition submitted: ${requisition.number}`,
        body: 'A showroom requisition is waiting for approval.',
        href: `/warehouse/requisitions/${requisition.id}`,
      });
      return requisition;
    });
  },

  async decide(session: AppSession | null, input: StockRequisitionDecisionInput) {
    const permission = input.decision === 'REJECT' ? 'approvals:reject' : 'approvals:approve';
    const actor = await authorize(session, permission);
    const requisition = await prisma.stockRequisition.findUnique({
      where: { id: input.requisitionId },
      include: { items: true, showroomWarehouse: true },
    });
    if (!requisition) throw new NotFoundError('Stock requisition not found');
    if (!['SUBMITTED', 'APPROVED', 'WAREHOUSE_ASSIGNED'].includes(requisition.status)) {
      throw new ValidationError('Only submitted requisitions can be decided');
    }

    return prisma.$transaction(async (tx) => {
      if (input.decision === 'REJECT') {
        const updated = await tx.stockRequisition.update({
          where: { id: requisition.id },
          data: {
            status: 'REJECTED',
            rejectionReason: input.rejectionReason || 'Rejected by approver',
            rejectedById: actor.userId,
            rejectedAt: new Date(),
          },
        });
        await recordAudit(
          {
            actorId: actor.userId,
            branchId: requisition.branchId,
            module: 'warehouse',
            action: 'stock-requisition-reject',
            entityType: 'StockRequisition',
            entityId: requisition.id,
            after: { status: updated.status },
          },
          tx,
        );
        return updated;
      }

      const byItemId = new Map(input.items.map((item) => [item.itemId, D(item.approvedQty)]));
      let approvedLineCount = 0;
      for (const item of requisition.items) {
        const approvedQty = byItemId.get(item.id) ?? ZERO;
        if (approvedQty.gt(item.requestedQty)) {
          throw new ValidationError(`Approved quantity cannot exceed requested quantity for ${item.productId}`);
        }
        if (approvedQty.gt(0)) approvedLineCount += 1;
      }
      if (approvedLineCount === 0) {
        throw new ValidationError('Approve at least one line quantity');
      }

      let sourceWarehouseId: string | undefined;
      if (input.sourceWarehouseId) {
        const source = await tx.warehouse.findUnique({ where: { id: input.sourceWarehouseId } });
        if (!source) throw new ValidationError('Selected source warehouse was not found');
        if (!source.isActive) throw new ValidationError('Selected source warehouse is inactive');
        sourceWarehouseId = source.id;
      }

      await Promise.all(
        requisition.items.map((item) =>
          tx.stockRequisitionItem.update({
            where: { id: item.id },
            data: { approvedQty: byItemId.get(item.id) ?? ZERO },
          }),
        ),
      );

      const updated = await tx.stockRequisition.update({
        where: { id: requisition.id },
        data: {
          status: sourceWarehouseId ? 'WAREHOUSE_ASSIGNED' : 'APPROVED',
          sourceWarehouseId: sourceWarehouseId ?? requisition.sourceWarehouseId,
          approvalNote: input.approvalNote || null,
          approvedById: actor.userId,
          approvedAt: new Date(),
          rejectedById: null,
          rejectedAt: null,
          rejectionReason: null,
        },
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: requisition.branchId,
          module: 'warehouse',
          action: 'stock-requisition-approve',
          entityType: 'StockRequisition',
          entityId: requisition.id,
          after: { status: updated.status, sourceWarehouseId: updated.sourceWarehouseId },
        },
        tx,
      );

      return updated;
    }).then(async (updated) => {
      await publishToPermission('warehouse:transfer', {
        branchId: requisition.branchId,
        severity: 'INFO',
        module: 'warehouse',
        title: `Stock requisition approved: ${requisition.number}`,
        body: updated.sourceWarehouseId
          ? 'The requisition is approved and assigned to a warehouse.'
          : 'The requisition is approved and waiting for warehouse assignment.',
        href: `/warehouse/requisitions/${requisition.id}`,
      });
      return updated;
    });
  },

  async assignSourceWarehouse(session: AppSession | null, input: StockRequisitionAssignInput) {
    const actor = await authorize(session, 'approvals:approve');
    const requisition = await prisma.stockRequisition.findUnique({
      where: { id: input.requisitionId },
      include: { showroomWarehouse: true },
    });
    if (!requisition) throw new NotFoundError('Stock requisition not found');
    if (!['APPROVED', 'WAREHOUSE_ASSIGNED'].includes(requisition.status)) {
      throw new ValidationError('Only approved requisitions can be assigned');
    }

    const sourceWarehouse = await prisma.warehouse.findUnique({ where: { id: input.sourceWarehouseId } });
    if (!sourceWarehouse || !sourceWarehouse.isActive) {
      throw new ValidationError('Selected source warehouse is not active');
    }
    if (sourceWarehouse.id === requisition.showroomWarehouseId) {
      throw new ValidationError('Source and destination warehouses must be different');
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.stockRequisition.update({
        where: { id: requisition.id },
        data: {
          sourceWarehouseId: sourceWarehouse.id,
          status: 'WAREHOUSE_ASSIGNED',
        },
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: requisition.branchId,
          module: 'warehouse',
          action: 'stock-requisition-assign-warehouse',
          entityType: 'StockRequisition',
          entityId: requisition.id,
          after: { status: updated.status, sourceWarehouseId: sourceWarehouse.id },
        },
        tx,
      );

      return updated;
    }).then(async (updated) => {
      await publishToPermission('warehouse:transfer', {
        branchId: sourceWarehouse.branchId,
        severity: 'INFO',
        module: 'warehouse',
        title: `Warehouse assigned: ${requisition.number}`,
        body: `${sourceWarehouse.name} has been assigned to fulfill this showroom request.`,
        href: `/warehouse/requisitions/${requisition.id}`,
      });
      return updated;
    });
  },

  async createDispatch(session: AppSession | null, input: StockDispatchCreateInput) {
    const requisition = await prisma.stockRequisition.findUnique({
      where: { id: input.requisitionId },
      include: { items: true, showroomWarehouse: true, sourceWarehouse: true, transfers: true },
    });
    if (!requisition) throw new NotFoundError('Stock requisition not found');
    if (!requisition.sourceWarehouse) {
      throw new ValidationError('Assign a source warehouse before creating a dispatch');
    }
    const actor = await authorize(session, 'warehouse:transfer', {
      branchId: requisition.sourceWarehouse.branchId,
    });

    if (!['WAREHOUSE_ASSIGNED', 'PICKING', 'PACKED'].includes(requisition.status)) {
      throw new ValidationError('This requisition is not ready for dispatch');
    }

    const activeTransfer = requisition.transfers.find((transfer) =>
      !['RECEIVED', 'COMPLETED', 'CANCELLED'].includes(transfer.status),
    );
    if (activeTransfer) {
      throw new ValidationError('An active transfer already exists for this requisition');
    }

    const itemMap = new Map(requisition.items.map((item) => [item.id, item]));
    const productIds = Array.from(new Set(input.items.map((item) => item.productId)));

    return prisma.$transaction(async (tx) => {
      await assertOpenPeriod(tx, requisition.sourceWarehouse!.branchId);
      const balances = await getWarehouseBalances(
        tx,
        requisition.sourceWarehouse!.branchId,
        requisition.sourceWarehouseId!,
        productIds,
      );
      const balanceMap = new Map(balances.map((row) => [row.productId, row.balance]));

      for (const item of input.items) {
        const reqItem = itemMap.get(item.requisitionItemId);
        if (!reqItem) throw new ValidationError('Dispatch item does not belong to this requisition');
        if (reqItem.productId !== item.productId) {
          throw new ValidationError('Dispatch item product mismatch');
        }

        const quantity = D(item.quantity);
        const remainingApproved = reqItem.approvedQty.minus(reqItem.dispatchedQty);
        if (quantity.gt(remainingApproved)) {
          throw new ValidationError(`Dispatch qty exceeds approved remainder for ${reqItem.productId}`);
        }

        const balance = balanceMap.get(item.productId) ?? ZERO;
        if (balance.lt(quantity)) {
          throw new ValidationError(`Insufficient stock for product ${reqItem.productId}: available ${balance.toString()}`);
        }
      }

      const year = new Date().getFullYear();
      const count = await tx.stockTransfer.count({ where: { fromBranchId: requisition.sourceWarehouse!.branchId } });
      const number = nextDocumentNumber('STR', year, count, 6);

      const transfer = await tx.stockTransfer.create({
        data: {
          number,
          requisitionId: requisition.id,
          fromBranchId: requisition.sourceWarehouse!.branchId,
          toBranchId: requisition.showroomWarehouse.branchId,
          fromWarehouseId: requisition.sourceWarehouseId!,
          toWarehouseId: requisition.showroomWarehouseId,
          status: 'PICKING',
          expectedDate: input.expectedDate ?? null,
          packedBy: input.packedBy || null,
          vehicle: input.vehicle || null,
          driverName: input.driverName || null,
          driverPhone: input.driverPhone || null,
          gatePassNo: input.gatePassNo || null,
          trackingNo: input.trackingNo || null,
          remarks: input.remarks || null,
          createdById: actor.userId,
          items: {
            create: input.items.map((item) => ({
              requisitionItemId: item.requisitionItemId,
              productId: item.productId,
              quantity: D(item.quantity),
              note: item.note || null,
            })),
          },
        },
        include: { items: true },
      });

      await Promise.all(
        input.items.map((item) => {
          const reqItem = itemMap.get(item.requisitionItemId)!;
          return tx.stockRequisitionItem.update({
            where: { id: item.requisitionItemId },
            data: { dispatchedQty: reqItem.dispatchedQty.plus(D(item.quantity)) },
          });
        }),
      );

      await tx.stockRequisition.update({
        where: { id: requisition.id },
        data: { status: 'PICKING' },
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: requisition.sourceWarehouse!.branchId,
          module: 'warehouse',
          action: 'stock-transfer-create',
          entityType: 'StockTransfer',
          entityId: transfer.id,
          after: { number: transfer.number, requisitionNumber: requisition.number, items: transfer.items.length },
        },
        tx,
      );

      return transfer;
    }).then(async (transfer) => {
      await publishToPermission('warehouse:transfer', {
        branchId: requisition.showroomWarehouse.branchId,
        severity: 'INFO',
        module: 'warehouse',
        title: `Dispatch started: ${transfer.number}`,
        body: `${requisition.number} is now in picking.`,
        href: `/warehouse/requisitions/${requisition.id}`,
      });
      return transfer;
    });
  },

  async updateTransferStatus(session: AppSession | null, input: StockTransferStatusInput) {
    const transfer = await prisma.stockTransfer.findUnique({
      where: { id: input.transferId },
      include: {
        requisition: true,
        items: true,
      },
    });
    if (!transfer) throw new NotFoundError('Transfer not found');
    const actor = await authorize(session, 'warehouse:transfer', { branchId: transfer.fromBranchId });

    const nextStatus = input.status as StockTransferStatus;
    assertAllowedTransition(transfer.status, nextStatus);

    return prisma.$transaction(async (tx) => {
      if (nextStatus === 'CANCELLED') {
        await Promise.all(
          transfer.items.map(async (item) => {
            if (!item.requisitionItemId) return;
            const reqItem = await tx.stockRequisitionItem.findUnique({ where: { id: item.requisitionItemId } });
            if (!reqItem) return;
            const nextQty = reqItem.dispatchedQty.minus(item.quantity);
            await tx.stockRequisitionItem.update({
              where: { id: reqItem.id },
              data: { dispatchedQty: nextQty.lt(0) ? ZERO : nextQty },
            });
          }),
        );
      }

      const updated = await tx.stockTransfer.update({
        where: { id: transfer.id },
        data: {
          status: nextStatus,
          dispatchNote: input.dispatchNote || transfer.dispatchNote || null,
          dispatchedById:
            nextStatus === 'DISPATCHED' || nextStatus === 'IN_TRANSIT'
              ? transfer.dispatchedById ?? actor.userId
              : transfer.dispatchedById,
          dispatchDate:
            nextStatus === 'DISPATCHED' || nextStatus === 'IN_TRANSIT'
              ? transfer.dispatchDate ?? new Date()
              : transfer.dispatchDate,
        },
      });

      await tx.stockRequisition.update({
        where: { id: transfer.requisitionId },
        data: {
          status: nextRequisitionStatusFromTransfer(nextStatus),
          completedAt: nextStatus === 'COMPLETED' ? new Date() : transfer.requisition.completedAt,
        },
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: transfer.fromBranchId,
          module: 'warehouse',
          action: `stock-transfer-${nextStatus.toLowerCase()}`,
          entityType: 'StockTransfer',
          entityId: transfer.id,
          before: { status: transfer.status },
          after: { status: nextStatus },
        },
        tx,
      );

      return updated;
    });
  },

  async receiveTransfer(session: AppSession | null, input: StockTransferReceiveInput) {
    const transfer = await prisma.stockTransfer.findUnique({
      where: { id: input.transferId },
      include: {
        requisition: true,
        items: true,
      },
    });
    if (!transfer) throw new NotFoundError('Transfer not found');
    const actor = await authorize(session, 'warehouse:transfer', { branchId: transfer.toBranchId });

    if (!['DISPATCHED', 'IN_TRANSIT'].includes(transfer.status)) {
      throw new ValidationError('Only dispatched or in-transit transfers can be received');
    }

    return prisma.$transaction(async (tx) => {
      await assertOpenPeriod(tx, transfer.fromBranchId);
      await assertOpenPeriod(tx, transfer.toBranchId);

      const itemMap = new Map(transfer.items.map((item) => [item.id, item]));
      const requisitionItems = await tx.stockRequisitionItem.findMany({
        where: { requisitionId: transfer.requisitionId },
      });
      const reqItemMap = new Map(requisitionItems.map((item) => [item.id, item]));
      const products = await tx.product.findMany({
        where: { id: { in: transfer.items.map((item) => item.productId) } },
        select: { id: true, costPrice: true },
      });
      const productMap = new Map(products.map((product) => [product.id, product]));

      for (const inputItem of input.items) {
        const transferItem = itemMap.get(inputItem.itemId);
        if (!transferItem) throw new ValidationError('Receive item does not belong to this transfer');
        const receivedQty = D(inputItem.receivedQty);
        const damagedQty = D(inputItem.damagedQty);
        const missingQty = D(inputItem.missingQty);
        const total = receivedQty.plus(damagedQty).plus(missingQty);
        if (!total.eq(transferItem.quantity)) {
          throw new ValidationError('Received, damaged, and missing quantities must equal the dispatched quantity');
        }
      }

      for (const transferItem of transfer.items) {
        const inputItem = input.items.find((item) => item.itemId === transferItem.id);
        if (!inputItem) {
          throw new ValidationError('All transfer items must be acknowledged on receipt');
        }
        const receivedQty = D(inputItem.receivedQty);
        const damagedQty = D(inputItem.damagedQty);
        const missingQty = D(inputItem.missingQty);
        const product = productMap.get(transferItem.productId);
        const reqItem = transferItem.requisitionItemId
          ? reqItemMap.get(transferItem.requisitionItemId)
          : null;

        await tx.stockTransferItem.update({
          where: { id: transferItem.id },
          data: {
            receivedQty,
            damagedQty,
            missingQty,
          },
        });

        if (reqItem) {
          await tx.stockRequisitionItem.update({
            where: { id: reqItem.id },
            data: { receivedQty: reqItem.receivedQty.plus(receivedQty) },
          });
        }

        await tx.inventoryLedger.create({
          data: {
            branchId: transfer.fromBranchId,
            warehouseId: transfer.fromWarehouseId,
            productId: transferItem.productId,
            direction: 'OUT',
            quantity: transferItem.quantity,
            costPerUnit: product?.costPrice ?? ZERO,
            refType: 'STOCK_TRANSFER_OUT',
            refId: transfer.id,
            note: `Showroom transfer ${transfer.number}`,
            createdById: actor.userId,
          },
        });

        if (receivedQty.gt(0)) {
          await tx.inventoryLedger.create({
            data: {
              branchId: transfer.toBranchId,
              warehouseId: transfer.toWarehouseId,
              productId: transferItem.productId,
              direction: 'IN',
              quantity: receivedQty,
              costPerUnit: product?.costPrice ?? ZERO,
              refType: 'STOCK_TRANSFER_IN',
              refId: transfer.id,
              note: `Showroom transfer ${transfer.number}`,
              createdById: actor.userId,
            },
          });
        }
      }

      const updated = await tx.stockTransfer.update({
        where: { id: transfer.id },
        data: {
          status: 'RECEIVED',
          receiveRemarks: input.receiveRemarks || null,
          receivedDate: new Date(),
          receivedById: actor.userId,
        },
      });

      await tx.stockRequisition.update({
        where: { id: transfer.requisitionId },
        data: { status: 'RECEIVED' },
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: transfer.toBranchId,
          module: 'warehouse',
          action: 'stock-transfer-receive',
          entityType: 'StockTransfer',
          entityId: transfer.id,
          after: { status: 'RECEIVED' },
        },
        tx,
      );

      return updated;
    });
  },
};
