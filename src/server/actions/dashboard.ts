'use server';

import { getSession } from '../auth/session';
import { prisma } from '../db';
import { startOfDay, startOfMonth } from 'date-fns';

export async function getDashboardPendingTasks() {
  const session = await getSession();
  if (!session) return { total: 0, tasks: [] };

  const branchId = session.activeBranchId ?? undefined;
  const tasks: Array<{ module: string; title: string; count: number; url: string }> = [];

  // HR Module
  if (session.permissions.includes('hr:read')) {
    const leavePending = await prisma.leaveRequest.count({
      where: {
        status: { in: ['PENDING_MANAGER', 'PENDING_HR'] },
        employee: branchId ? { branchId } : undefined,
      },
    });
    if (leavePending > 0) {
      tasks.push({ module: 'HR', title: 'Pending Leave', count: leavePending, url: '/hr/leave-approval' });
    }

    const transferPending = await prisma.employeeTransfer.count({
      where: {
        status: { in: ['SUBMITTED', 'PENDING_APPROVAL'] },
        OR: branchId ? [{ branchId }, { newBranchId: branchId }, { tempBranchId: branchId }] : undefined,
      },
    });
    if (transferPending > 0) {
      tasks.push({ module: 'HR', title: 'Pending Transfer', count: transferPending, url: '/hr/transfers' });
    }
    
    const exitPending = await prisma.employeeExitClearance.count({
      where: {
        status: { in: ['PENDING_DEPARTMENT_CLEARANCE', 'PENDING_ACCOUNTS_APPROVAL', 'PENDING_HR_APPROVAL'] },
        employee: branchId ? { branchId } : undefined,
      },
    });
    if (exitPending > 0) {
      tasks.push({ module: 'HR', title: 'Pending Exit Clearance', count: exitPending, url: '/hr/exit-clearance' });
    }
    
    // Attendance Exceptions
    const missingPunchPending = await prisma.attendanceException.count({
      where: { status: 'PENDING', type: 'MISSING_PUNCH', employee: branchId ? { branchId } : undefined }
    });
    if (missingPunchPending > 0) {
      tasks.push({ module: 'HR', title: 'Pending Missing Punch', count: missingPunchPending, url: '/hr/attendance' });
    }

    const lateEntryPending = await prisma.attendanceException.count({
      where: { status: 'PENDING', type: 'LATE_ENTRY', employee: branchId ? { branchId } : undefined }
    });
    if (lateEntryPending > 0) {
      tasks.push({ module: 'HR', title: 'Pending Late Entry', count: lateEntryPending, url: '/hr/attendance' });
    }

    const earlyExitPending = await prisma.attendanceException.count({
      where: { status: 'PENDING', type: 'EARLY_EXIT', employee: branchId ? { branchId } : undefined }
    });
    if (earlyExitPending > 0) {
      tasks.push({ module: 'HR', title: 'Pending Early Exit', count: earlyExitPending, url: '/hr/attendance' });
    }

    const overtimePending = await prisma.overtimeRecord.count({
      where: { status: 'DRAFT', branchId }
    });
    if (overtimePending > 0) {
      tasks.push({ module: 'HR', title: 'Pending Overtime', count: overtimePending, url: '/hr/overtime' });
    }
  }

  // Purchase Module
  if (session.permissions.includes('purchase:read')) {
    const reqPending = await prisma.purchaseRequisition.count({
      where: { status: 'PENDING', branchId },
    });
    if (reqPending > 0) {
      tasks.push({ module: 'Purchase', title: 'Pending Purchase Requisition', count: reqPending, url: '/purchase/requisitions' });
    }

    const poPending = await prisma.purchaseOrder.count({
      where: { status: 'PENDING', branchId },
    });
    if (poPending > 0) {
      tasks.push({ module: 'Purchase', title: 'Pending Purchase Order', count: poPending, url: '/purchase/orders' });
    }
  }

  // Inventory Module
  if (session.permissions.includes('inventory:read')) {
    const transferPending = await prisma.inventoryLedger.count({
      where: {
        direction: 'OUT',
        refType: 'TRANSFER', // This assumes a generic pending logic
        branchId,
      },
    });
    // Let's just mock stock transfer pending if it's complex, or use approvals.
  }

  // Factory Module
  if (session.permissions.includes('factory:read')) {
    const prodPending = await prisma.productionOrder.count({
      where: { status: 'PLANNED', branchId },
    });
    if (prodPending > 0) {
      tasks.push({ module: 'Factory', title: 'Pending Production Order', count: prodPending, url: '/factory/orders' });
    }

    const issuePending = await prisma.productionIssueVoucher.count({
      where: { status: 'REQUESTED', branchId },
    });
    if (issuePending > 0) {
      tasks.push({ module: 'Factory', title: 'Pending Material Issue', count: issuePending, url: '/factory/production-issue' });
    }

    const wipRunning = await prisma.processTracking.count({
      where: { status: 'RUNNING', branchId },
    });
    if (wipRunning > 0) {
      tasks.push({ module: 'Factory', title: 'Running WIP Processes', count: wipRunning, url: '/factory/process-tracking' });
    }

    const planPending = await prisma.productionPlan.count({
      where: { status: 'DRAFT', branchId },
    });
    if (planPending > 0) {
      tasks.push({ module: 'Factory', title: 'Pending Production Plan', count: planPending, url: '/factory/planning' });
    }

    const workOrderPending = await prisma.workOrder.count({
      where: { status: 'PENDING', order: { branchId } },
    });
    if (workOrderPending > 0) {
      tasks.push({ module: 'Factory', title: 'Pending Work Orders', count: workOrderPending, url: '/factory/work-orders' });
    }

    const workOrderPaused = await prisma.workOrder.count({
      where: { status: 'PAUSED', order: { branchId } },
    });
    if (workOrderPaused > 0) {
      tasks.push({ module: 'Factory', title: 'Delayed / Paused Work Orders', count: workOrderPaused, url: '/factory/work-orders' });
    }
  }

  // Accounts Module
  if (session.permissions.includes('accounts:read')) {
    const paymentsPending = await prisma.supplierPayment.count({
      where: { branchId },
      // Assuming a status for payments if they require approval. Currently supplier payments might not have PENDING status in schema.
      // We will skip if no status field.
    });

    const journalPending = await prisma.journalEntry.count({
      where: { status: 'DRAFT', branchId },
    });
    if (journalPending > 0) {
      tasks.push({ module: 'Accounts', title: 'Pending Journal Approval', count: journalPending, url: '/accounts/journals' });
    }
  }

  // Trade Module
  if (session.permissions.includes('trade:read')) {
    const lcPending = await prisma.letterOfCredit.count({
      where: { status: 'DRAFT', branchId },
    });
    if (lcPending > 0) {
      tasks.push({ module: 'Trade', title: 'Pending LC Approval', count: lcPending, url: '/trade/lc' });
    }
    
    const shipmentPending = await prisma.tradeShipment.count({
      where: { status: 'PENDING', tradeOrder: branchId ? { branchId } : undefined },
    });
    if (shipmentPending > 0) {
      tasks.push({ module: 'Trade', title: 'Pending Shipment Approval', count: shipmentPending, url: '/trade/shipments' });
    }
  }

  // Sales Module
  if (session.permissions.includes('sales:read')) {
    const pendingChallans = await prisma.corporateDelivery.count({
      where: { status: 'DRAFT', branchId }
    });
    if (pendingChallans > 0) {
      tasks.push({ module: 'Sales', title: 'Pending Delivery Challans', count: pendingChallans, url: '/warehouse/dispatch' });
    }

    const awaitingDispatch = await prisma.corporateDelivery.count({
      where: { status: 'PACKED', branchId }
    });
    if (awaitingDispatch > 0) {
      tasks.push({ module: 'Sales', title: 'Orders Awaiting Dispatch', count: awaitingDispatch, url: '/warehouse/dispatch' });
    }

    const pendingReturns = await prisma.corporateSalesReturn.count({
      where: { status: 'REQUESTED', branchId }
    });
    if (pendingReturns > 0) {
      tasks.push({ module: 'Sales', title: 'Pending Sales Returns', count: pendingReturns, url: '/sales/returns' });
    }

    const returnsAwaitingQC = await prisma.corporateSalesReturn.count({
      where: { status: 'GOODS_RECEIVED', branchId }
    });
    if (returnsAwaitingQC > 0) {
      tasks.push({ module: 'Sales', title: 'Returns Awaiting QC', count: returnsAwaitingQC, url: '/sales/returns-qc' });
    }
  }

  const total = tasks.reduce((sum, t) => sum + t.count, 0);

  return { total, tasks };
}

export async function getDashboardNotifications() {
  const session = await getSession();
  if (!session) return { unreadCount: 0, groups: [], latest: [] };

  const notifications = await prisma.notification.findMany({
    where: { recipientId: session.userId, readAt: null },
    orderBy: { createdAt: 'desc' },
  });

  const unreadCount = notifications.length;

  const groupsMap = new Map<string, number>();
  notifications.forEach(n => {
    const type = n.module || 'system';
    groupsMap.set(type, (groupsMap.get(type) || 0) + 1);
  });

  const groups = Array.from(groupsMap.entries()).map(([type, count]) => ({ type, count }));

  const latest = notifications.slice(0, 5).map(n => ({
    id: n.id,
    title: n.title,
    message: n.body || '',
    url: n.href || '#',
    priority: n.severity.toLowerCase(),
  }));

  return { unreadCount, groups, latest };
}
