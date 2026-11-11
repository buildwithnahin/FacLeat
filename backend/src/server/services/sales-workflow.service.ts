import { prisma } from '@/server/db';
import { AppSession, authorize } from '@/server/auth/session';
import { CorporateDeliveryStatus, CorporateReturnStatus, ReturnCondition, RefundType } from '@/generated/prisma';

export const salesWorkflowService = {
  /**
   * 1. Delivery Challan Workflow - Create Delivery (Partial or Full)
   */
  async createDeliveryChallan(session: AppSession, data: any) {
    authorize(session, 'sales:delivery');

    return await prisma.$transaction(async (tx) => {
      // 1. Calculate remaining qty logic inside the transaction based on order items
      const challan = await tx.corporateDelivery.create({
        data: {
          number: data.number || `DC-${Date.now()}`,
          branchId: session.activeBranchId!,
          warehouseId: data.warehouseId,
          orderId: data.orderId,
          expectedDate: new Date(data.expectedDate),
          status: CorporateDeliveryStatus.APPROVED,
          vehicleNo: data.vehicleNo,
          driverName: data.driverName,
          driverPhone: data.driverPhone,
          transportCompany: data.transportCompany,
          createdById: session.userId,
          notes: data.notes,
          items: {
            create: data.items.map((item: any) => ({
              orderItemId: item.orderItemId,
              productId: item.productId,
              quantity: item.quantity,
            }))
          }
        },
        include: { items: true }
      });

      return challan;
    });
  },

  /**
   * 2. Dispatch Workflow
   */
  async dispatchDelivery(session: AppSession, deliveryId: string, trackingNo: string, gatePassNo: string) {
    authorize(session, 'sales:delivery');

    const delivery = await prisma.corporateDelivery.update({
      where: { id: deliveryId },
      data: {
        status: CorporateDeliveryStatus.DISPATCHED,
        trackingNo,
        gatePassNo,
      },
      include: { items: true }
    });

    return delivery;
  },

  /**
   * 3. Proof of Delivery Workflow
   */
  async confirmDelivery(session: AppSession, deliveryId: string, podData: any) {
    authorize(session, 'sales:delivery');

    return await prisma.$transaction(async (tx) => {
      const delivery = await tx.corporateDelivery.update({
        where: { id: deliveryId },
        data: {
          status: CorporateDeliveryStatus.DELIVERED,
          deliveryDate: new Date(),
          customerSignature: podData.customerSignature,
          podAttachment: podData.podAttachment,
          receivedById: session.userId,
        },
        include: { items: true }
      });

      // Update Inventory
      for (const item of delivery.items) {
        await tx.inventoryLedger.create({
          data: {
            branchId: session.activeBranchId!,
            productId: item.productId,
            warehouseId: delivery.warehouseId,
            direction: 'OUT',
            quantity: item.quantity,
            refType: 'SALES_DELIVERY',
            refId: delivery.id,
          }
        });

        // Update Order Item Delivered Qty
        await tx.corporateOrderItem.update({
          where: { id: item.orderItemId },
          data: { deliveredQty: { increment: item.quantity } }
        });
      }

      return delivery;
    });
  },

  /**
   * 4. Sales Return Workflow
   */
  async requestSalesReturn(session: AppSession, data: any) {
    authorize(session, 'sales:return');

    return await prisma.$transaction(async (tx) => {
      const salesReturn = await tx.corporateSalesReturn.create({
        data: {
          returnNo: data.returnNo || `SR-${Date.now()}`,
          branchId: session.activeBranchId!,
          customerId: data.customerId,
          orderId: data.orderId,
          invoiceId: data.invoiceId,
          warehouseId: data.warehouseId,
          status: CorporateReturnStatus.REQUESTED,
          refundType: data.refundType as RefundType,
          reason: data.reason,
          createdById: session.userId,
          items: {
            create: data.items.map((item: any) => ({
              orderItemId: item.orderItemId,
              productId: item.productId,
              soldQty: item.soldQty,
              returnedQty: item.returnedQty,
              condition: item.condition as ReturnCondition,
              damageType: item.damageType
            }))
          }
        }
      });

      return salesReturn;
    });
  },

  /**
   * 5. Return QC & Inventory Adjustment Workflow
   */
  async processReturnQc(session: AppSession, returnId: string, itemsQc: any[]) {
    authorize(session, 'sales:return-qc');

    return await prisma.$transaction(async (tx) => {
      const salesReturn = await tx.corporateSalesReturn.update({
        where: { id: returnId },
        data: {
          status: CorporateReturnStatus.INVENTORY_UPDATED,
          qcOfficerId: session.userId,
        },
        include: { items: true }
      });

      // Update items with QC findings
      for (const qc of itemsQc) {
        await tx.corporateSalesReturnItem.update({
          where: { id: qc.itemId },
          data: {
            condition: qc.condition as ReturnCondition,
            inspectionResult: qc.inspectionResult
          }
        });

        // Inventory logic based on condition
        if (qc.condition === 'RESALABLE') {
          await tx.inventoryLedger.create({
            data: {
              branchId: session.activeBranchId!,
              productId: qc.productId,
              warehouseId: salesReturn.warehouseId,
              direction: 'IN',
              quantity: qc.returnedQty,
              refType: 'SALES_RETURN',
              refId: salesReturn.id,
            }
          });
        } else if (qc.condition === 'DAMAGED' || qc.condition === 'MANUFACTURING_DEFECT') {
          // Send to Scrap
          await tx.scrapLedger.create({
            data: {
              date: new Date(),
              branchId: session.activeBranchId!,
              orderId: salesReturn.orderId,
              scrapType: 'Sales Return Damage',
              qty: qc.returnedQty,
              notes: qc.inspectionResult
            }
          });
        }
      }

      return salesReturn;
    });
  }
};
