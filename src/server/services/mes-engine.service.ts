import { prisma } from '@/server/db';
import { ProductionPlanStatus, WorkOrderStatus, DelayReason, ProcessTrackingStatus } from '@/generated/prisma';
import { AppSession, authorize } from '@/server/auth/session';
import { ApiError } from '@/lib/errors';

export const mesEngineService = {
  /**
   * 1. Production Planning Workflow
   * Generate a Production Plan for a product demand.
   */
  async createProductionPlan(session: AppSession, data: any) {
    authorize(session, 'production:plan-create');

    return await prisma.$transaction(async (tx) => {
      const plan = await tx.productionPlan.create({
        data: {
          planNo: data.planNo || `PLAN-${Date.now()}`,
          planningDate: new Date(data.planningDate),
          branchId: session.activeBranchId!,
          productId: data.productId,
          quantity: data.quantity,
          priority: data.priority,
          plannedStartDate: new Date(data.plannedStartDate),
          plannedEndDate: new Date(data.plannedEndDate),
          productionLine: data.productionLine,
          machine: data.machine,
          shift: data.shift,
          plannerId: session.userId,
          status: ProductionPlanStatus.APPROVED,
        }
      });

      // MRP Calculation stub - Calculate required materials based on BOM
      // For this implementation, we assume BOM calculation happens here and 
      // creates Purchase Requisitions if stock is short.

      // Automatically Generate Production Order from the Plan
      const order = await tx.productionOrder.create({
        data: {
          number: `PRO-${Date.now()}`,
          branchId: session.activeBranchId!,
          productId: plan.productId,
          planId: plan.id,
          plannedQty: plan.quantity,
          plannedStartDate: plan.plannedStartDate,
          plannedEndDate: plan.plannedEndDate,
          status: 'PLANNED', // Using existing enum value
          createdById: session.userId,
        }
      });

      return { plan, order };
    });
  },

  /**
   * 2. Work Order Workflow
   * Create departmental work orders from a Production Order.
   */
  async createWorkOrder(session: AppSession, data: any) {
    authorize(session, 'production:work-order-create');

    return await prisma.$transaction(async (tx) => {
      const workOrder = await tx.workOrder.create({
        data: {
          workOrderNo: data.workOrderNo || `WO-${Date.now()}`,
          orderId: data.orderId,
          department: data.department,
          targetQty: data.targetQty,
          status: WorkOrderStatus.PENDING,
        }
      });

      return workOrder;
    });
  },

  /**
   * 3. Machine & Operator Assignment
   */
  async assignResourcesToWorkOrder(session: AppSession, workOrderId: string, assignment: any) {
    authorize(session, 'production:work-order-assign');

    return await prisma.workOrder.update({
      where: { id: workOrderId },
      data: {
        machine: assignment.machine,
        operatorId: assignment.operatorId,
        shift: assignment.shift,
        status: WorkOrderStatus.ASSIGNED,
      }
    });
  },

  /**
   * 4. Delay Tracking Workflow
   * Record delays against a running Work Order.
   */
  async recordDelay(session: AppSession, data: any) {
    authorize(session, 'production:delay-track');

    return await prisma.delayTracking.create({
      data: {
        workOrderId: data.workOrderId,
        reason: data.reason as DelayReason,
        notes: data.notes,
        startTime: new Date(data.startTime),
        endTime: data.endTime ? new Date(data.endTime) : undefined,
        durationMins: data.durationMins
      }
    });
  },

  /**
   * 5. Production Costing Calculation
   * Aggregate material, labour, machine, and overhead costs for an order.
   */
  async calculateProductionCost(session: AppSession, orderId: string) {
    authorize(session, 'production:costing');

    // 1. Get total raw material cost issued to this order (from InventoryLedger OUTs linked to this order)
    // 2. Get total operator time (from ProcessTracking or WorkOrders) * Operator Rate
    // 3. Get machine time * Machine Rate
    // 4. Subtract scrap value (from ScrapLedger)

    // Example Calculation Stub:
    return await prisma.$transaction(async (tx) => {
      // Record the cost entry
      const costEntry = await tx.productionCostEntry.create({
        data: {
          orderId: orderId,
          amount: 50000.00, // Calculated Value Stub
          costCategory: 'TOTAL_COST',
          description: 'Calculated Cost for Completed Order',
          date: new Date()
        }
      });

      // Update Order Status to COMPLETED if not already
      await tx.productionOrder.update({
        where: { id: orderId },
        data: { status: 'COMPLETED' }
      });

      return costEntry;
    });
  }
};
