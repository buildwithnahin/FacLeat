import { prisma } from '@/server/db';
import { ProcessTrackingStatus, QualityCheckStatus, ProductionIssueStatus } from '@/generated/prisma';
import { AppSession, authorize } from '@/server/auth/session';
import { ApiError } from '@/lib/errors';

export const wipEngineService = {
  /**
   * 1. Production Issue Workflow
   * Move raw materials from RM Warehouse to WIP.
   */
  async issueMaterialToProduction(session: AppSession, data: any) {
    authorize(session, 'production:issue');
    
    return await prisma.$transaction(async (tx) => {
      const voucher = await tx.productionIssueVoucher.create({
        data: {
          voucherNo: `PI-${Date.now()}`,
          date: new Date(data.date),
          branchId: session.activeBranchId!,
          orderId: data.orderId,
          warehouseId: data.warehouseId,
          status: ProductionIssueStatus.ISSUED,
          requestedById: session.userId,
          issuedById: session.userId,
          remarks: data.remarks,
          items: {
            create: data.items.map((item: any) => ({
              productId: item.productId,
              batchNo: item.batchNo,
              lotNo: item.lotNo,
              requiredQty: item.requiredQty,
              issuedQty: item.issuedQty,
              uom: item.uom,
            }))
          }
        },
        include: { items: true }
      });

      // Update Inventory & WIP Ledger
      for (const item of voucher.items) {
        // Decrease RM Stock
        await tx.inventoryLedger.create({
          data: {
            branchId: session.activeBranchId!,
            productId: item.productId,
            warehouseId: data.warehouseId,
            direction: 'OUT',
            quantity: item.issuedQty,
            refType: 'PRODUCTION_ISSUE',
            refId: voucher.id,
            date: new Date(data.date)
          }
        });

        // Increase WIP Ledger
        await tx.wipLedger.create({
          data: {
            date: new Date(data.date),
            branchId: session.activeBranchId!,
            orderId: data.orderId,
            productId: item.productId,
            voucher: voucher.voucherNo,
            inQty: item.issuedQty,
          }
        });
      }

      return voucher;
    });
  },

  /**
   * 2. Process Tracking Workflow
   * Update stages, quantities, scrap, and costs
   */
  async updateProcessTracking(session: AppSession, data: any) {
    authorize(session, 'production:process-tracking');

    return await prisma.$transaction(async (tx) => {
      const tracking = await tx.processTracking.upsert({
        where: { trackingNo: data.trackingNo || `PT-${Date.now()}` },
        update: {
          status: data.status,
          endTime: data.status === 'COMPLETED' ? new Date() : undefined,
          outputQty: data.outputQty,
          rejectedQty: data.rejectedQty,
          scrapQty: data.scrapQty,
          reworkQty: data.reworkQty,
          remainingQty: data.remainingQty,
        },
        create: {
          trackingNo: `PT-${Date.now()}`,
          orderId: data.orderId,
          branchId: session.activeBranchId!,
          productId: data.productId,
          stageId: data.stageId,
          operatorId: data.operatorId,
          machine: data.machine,
          status: ProcessTrackingStatus.RUNNING,
          startTime: new Date(),
          inputQty: data.inputQty,
        }
      });

      // If scrap is recorded, create a scrap ledger entry
      if (data.scrapQty > 0) {
        await tx.scrapLedger.create({
          data: {
            date: new Date(),
            branchId: session.activeBranchId!,
            orderId: data.orderId,
            stageId: data.stageId,
            scrapType: data.scrapType || 'Production Waste',
            operatorId: data.operatorId,
            qty: data.scrapQty,
          }
        });
      }

      // If process is completed, output is moved to the next WIP stage or waiting for FG receive
      if (data.status === 'COMPLETED') {
        await tx.wipLedger.create({
          data: {
            date: new Date(),
            branchId: session.activeBranchId!,
            orderId: data.orderId,
            stageId: data.stageId,
            productId: data.productId,
            operatorId: data.operatorId,
            outQty: data.outputQty,
          }
        });
      }

      return tracking;
    });
  },

  /**
   * 3. Finished Goods Receive Workflow
   * Move completed products from WIP to FG Warehouse
   */
  async receiveFinishedGoods(session: AppSession, data: any) {
    authorize(session, 'production:receive-fg');

    return await prisma.$transaction(async (tx) => {
      const voucher = await tx.finishedGoodsReceiveVoucher.create({
        data: {
          receiveNo: `FGR-${Date.now()}`,
          date: new Date(data.date),
          branchId: session.activeBranchId!,
          orderId: data.orderId,
          warehouseId: data.warehouseId,
          receivedById: session.userId,
          remarks: data.remarks,
          items: {
            create: data.items.map((item: any) => ({
              productId: item.productId,
              batchNo: item.batchNo,
              quantity: item.quantity,
              uom: item.uom,
              qualityStatus: QualityCheckStatus.PASSED
            }))
          }
        },
        include: { items: true }
      });

      for (const item of voucher.items) {
        // Decrease WIP Ledger
        await tx.wipLedger.create({
          data: {
            date: new Date(data.date),
            branchId: session.activeBranchId!,
            orderId: data.orderId,
            productId: item.productId,
            voucher: voucher.receiveNo,
            outQty: item.quantity, // WIP out
          }
        });

        // Increase Finished Goods Stock
        await tx.inventoryLedger.create({
          data: {
            branchId: session.activeBranchId!,
            productId: item.productId,
            warehouseId: data.warehouseId,
            direction: 'IN',
            quantity: item.quantity,
            refType: 'FINISHED_GOODS_RECEIVE',
            refId: voucher.id,
            date: new Date(data.date)
          }
        });
      }

      return voucher;
    });
  }
};
