import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db';
import { MODULES } from '@/constants/navigation';
import type { AppSession } from '@/server/auth/session';

const ZERO = new Prisma.Decimal(0);

export type DashboardRole =
  | 'super-admin'
  | 'admin'
  | 'hr'
  | 'accounts'
  | 'commercial'
  | 'inventory'
  | 'production'
  | 'purchase'
  | 'store'
  | 'sales'
  | 'management';

export interface DashboardData {
  metrics: Record<string, string>;
  notes: string[];
}

function startOfDay(date = new Date()) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function formatCount(value: number) {
  return value.toLocaleString('en-US');
}

export function resolveDashboardRole(session: AppSession): DashboardRole {
  const roleNames = session.roles.map((role) => role.toLowerCase());

  if (roleNames.some((role) => role.includes('super admin'))) return 'super-admin';
  if (roleNames.some((role) => role === 'admin' || role.endsWith(' admin'))) return 'admin';
  if (roleNames.some((role) => role.includes('hr'))) return 'hr';
  if (roleNames.some((role) => role.includes('account'))) return 'accounts';
  if (
    roleNames.some(
      (role) =>
        role.includes('commercial') || role.includes('trade') || role.includes('export') || role.includes('import'),
    )
  )
    return 'commercial';
  if (roleNames.some((role) => role.includes('warehouse') || role.includes('store'))) return 'store';
  if (roleNames.some((role) => role.includes('inventory'))) return 'inventory';
  if (roleNames.some((role) => role.includes('factory') || role.includes('production'))) return 'production';
  if (roleNames.some((role) => role.includes('purchase') || role.includes('procurement'))) return 'purchase';
  if (roleNames.some((role) => role.includes('sales'))) return 'sales';
  if (roleNames.some((role) => role.includes('management'))) return 'management';

  if (session.permissions.includes('trade:read')) return 'commercial';
  if (session.permissions.includes('hr:read')) return 'hr';
  if (session.permissions.includes('accounts:read')) return 'accounts';
  if (session.permissions.includes('factory:read')) return 'production';
  if (session.permissions.includes('purchase:read')) return 'purchase';
  if (session.permissions.includes('warehouse:read')) return 'store';
  if (
    session.permissions.includes('wholesale:read') ||
    session.permissions.includes('corporate-sales:read') ||
    session.permissions.includes('crm:read')
  ) {
    return 'sales';
  }
  return 'admin';
}

export function shouldUseBranchScope(role: DashboardRole) {
  return !['super-admin', 'admin'].includes(role);
}

export async function loadDashboardData(
  role: DashboardRole,
  session: AppSession,
  branchId?: string,
): Promise<DashboardData> {
  switch (role) {
    case 'super-admin':
      return loadSuperAdminData();
    case 'admin':
      return loadAdminData(session, branchId);
    case 'hr':
      return loadHrData(branchId);
    case 'accounts':
      return loadAccountsData(branchId);
    case 'commercial':
      return loadCommercialData(branchId);
    case 'inventory':
      return loadInventoryData(branchId);
    case 'production':
      return loadProductionData(branchId);
    case 'purchase':
      return loadPurchaseData(branchId);
    case 'store':
      return loadStoreData(branchId);
    case 'sales':
      return loadSalesData(branchId);
    case 'management':
      return loadManagementData(branchId);
  }
}

async function loadSuperAdminData(): Promise<DashboardData> {
  const today = startOfDay();
  const [companies, branches, users, todayLoginUsers] = await Promise.all([
    prisma.company.count({ where: { isActive: true } }),
    prisma.branch.count(),
    prisma.user.count(),
    prisma.auditLog.findMany({
      where: {
        module: 'auth',
        action: 'LOGIN_SUCCESS',
        actorId: { not: null },
        createdAt: { gte: today },
      },
      select: { actorId: true },
      distinct: ['actorId'],
    }),
  ]);

  return {
    metrics: {
      totalCompanies: formatCount(companies),
      totalBranches: formatCount(branches),
      totalUsers: formatCount(users),
      activeModules: formatCount(MODULES.length),
      systemHealth: branches > 0 && users > 0 ? 'Healthy' : 'Check',
      todayLoginUsers: formatCount(todayLoginUsers.length),
    },
    notes: [
      'Total Companies uses active records from the dedicated Company table.',
      'Today Login Users counts distinct successful logins recorded in the audit log since midnight.',
    ],
  };
}

async function loadAdminData(session: AppSession, branchId?: string): Promise<DashboardData> {
  const today = startOfDay();
  const [totalUsers, activeEmployees, pendingApprovals, todayNotifications, branches, touchedModules] =
    await Promise.all([
      prisma.user.count(),
      prisma.employee.count({ where: { status: 'ACTIVE', ...(branchId ? { branchId } : {}) } }),
      prisma.approvalRequest.count({
        where: { status: 'PENDING', ...(branchId ? { branchId } : {}) },
      }),
      prisma.notification.count({
        where: { recipientId: session.userId, createdAt: { gte: today } },
      }),
      prisma.branch.count({ where: branchId ? { id: branchId } : undefined }),
      prisma.auditLog.findMany({
        where: { createdAt: { gte: today } },
        select: { module: true },
        distinct: ['module'],
      }),
    ]);

  return {
    metrics: {
      totalUsers: formatCount(totalUsers),
      activeEmployees: formatCount(activeEmployees),
      pendingApprovals: formatCount(pendingApprovals),
      todayNotifications: formatCount(todayNotifications),
      branchSummary: formatCount(branches),
      moduleUsage: formatCount(touchedModules.length),
    },
    notes: [],
  };
}

async function loadHrData(branchId?: string): Promise<DashboardData> {
  const today = startOfDay();
  const monthStart = startOfMonth();
  const [totalEmployees, presentToday, absentToday, lateEmployees, leavePending, newJoining] = await Promise.all([
    prisma.employee.count({ where: branchId ? { branchId } : undefined }),
    prisma.attendanceRecord.count({
      where: {
        date: today,
        status: { in: ['PRESENT', 'LATE', 'HALF_DAY'] },
        employee: branchId ? { branchId } : undefined,
      },
    }),
    prisma.attendanceRecord.count({
      where: {
        date: today,
        status: 'ABSENT',
        employee: branchId ? { branchId } : undefined,
      },
    }),
    prisma.attendanceRecord.count({
      where: {
        date: today,
        status: 'LATE',
        employee: branchId ? { branchId } : undefined,
      },
    }),
    prisma.leaveRequest.count({
      where: {
        status: { in: ['PENDING_MANAGER', 'PENDING_HR'] },
        employee: branchId ? { branchId } : undefined,
      },
    }),
    prisma.employee.count({
      where: {
        joinedAt: { gte: monthStart },
        ...(branchId ? { branchId } : {}),
      },
    }),
  ]);

  return {
    metrics: {
      totalEmployees: formatCount(totalEmployees),
      presentToday: formatCount(presentToday),
      absentToday: formatCount(absentToday),
      lateEmployees: formatCount(lateEmployees),
      leavePending: formatCount(leavePending),
      newJoining: formatCount(newJoining),
    },
    notes: [],
  };
}

async function loadAccountsData(branchId?: string): Promise<DashboardData> {
  const today = startOfDay();
  const monthStart = startOfMonth();
  const [cashBalance, bankBalance, sales, purchase, todayReceipts, todayPayments] = await Promise.all([
    getPositiveBalanceByKeyword(branchId, ['cash']),
    getPositiveBalanceByKeyword(branchId, ['bank']),
    getSalesTotals(branchId, monthStart, new Date()),
    getPurchaseTotals(branchId, monthStart, new Date()),
    getTodayReceipts(branchId, today),
    getTodayPayments(branchId, today),
  ]);

  return {
    metrics: {
      cashBalance: formatCurrency(cashBalance),
      bankBalance: formatCurrency(bankBalance),
      todayReceipt: formatCurrency(todayReceipts),
      todayPayment: formatCurrency(todayPayments),
      payable: formatCurrency(purchase.openPayable),
      receivable: formatCurrency(sales.outstanding),
    },
    notes: [
      'Cash and bank balances are derived from posted ledger accounts using account-name matching until dedicated system account mappings are surfaced on the dashboard.',
    ],
  };
}

async function loadCommercialData(branchId?: string): Promise<DashboardData> {
  const [importPending, exportPending, lcStatus, shipmentPending, customsPending, documentPending] =
    await Promise.all([
      prisma.tradeOrder.count({
        where: {
          type: 'IMPORT',
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
          ...(branchId ? { branchId } : {}),
        },
      }),
      prisma.tradeOrder.count({
        where: {
          type: 'EXPORT',
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
          ...(branchId ? { branchId } : {}),
        },
      }),
      prisma.letterOfCredit.count({
        where: {
          status: { notIn: ['CLOSED', 'CANCELLED', 'EXPIRED'] },
          ...(branchId ? { branchId } : {}),
        },
      }),
      prisma.tradeShipment.count({
        where: {
          status: { notIn: ['DELIVERED', 'CANCELLED'] },
          tradeOrder: branchId ? { branchId } : undefined,
        },
      }),
      prisma.tradeShipment.count({
        where: {
          status: { in: ['AT_PORT', 'CUSTOMS_CLEARANCE'] },
          tradeOrder: branchId ? { branchId } : undefined,
        },
      }),
      prisma.documentLink.count({
        where: { entityType: { in: ['TradeOrder', 'LetterOfCredit', 'TradeShipment'] } },
      }),
    ]);

  return {
    metrics: {
      importPending: formatCount(importPending),
      exportPending: formatCount(exportPending),
      lcStatus: formatCount(lcStatus),
      shipmentPending: formatCount(shipmentPending),
      customsPending: formatCount(customsPending),
      documentPending: formatCount(documentPending),
    },
    notes: [
      'Document Pending currently reflects linked trade documents because the schema does not yet mark document readiness as a separate workflow state.',
    ],
  };
}

async function loadInventoryData(branchId?: string): Promise<DashboardData> {
  const [inventory, openWip] = await Promise.all([
    getInventorySnapshot(branchId),
    prisma.productionOrder.aggregate({
      where: {
        status: { in: ['PLANNED', 'IN_PROGRESS', 'ON_HOLD'] },
        ...(branchId ? { branchId } : {}),
      },
      _sum: { plannedQty: true, producedQty: true },
    }),
  ]);

  const totalQty = inventory.rows.reduce((sum, row) => sum.plus(row.qty), ZERO);
  const rawQty = inventory.rows
    .filter((row) => row.type === 'RAW_MATERIAL')
    .reduce((sum, row) => sum.plus(row.qty), ZERO);
  const fgQty = inventory.rows
    .filter((row) => row.type === 'FINISHED_GOOD')
    .reduce((sum, row) => sum.plus(row.qty), ZERO);
  const wipQty = (openWip._sum.plannedQty ?? ZERO).minus(openWip._sum.producedQty ?? ZERO);

  return {
    metrics: {
      totalStock: totalQty.toFixed(2),
      lowStockItems: formatCount(inventory.rows.filter((row) => row.belowReorder).length),
      rawMaterialStock: rawQty.toFixed(2),
      wipStock: wipQty.toFixed(2),
      finishedGoodsStock: fgQty.toFixed(2),
      stockValue: formatCurrency(inventory.totals.value),
    },
    notes: [
      'WIP Stock is derived from open production quantities because there is not yet a separate WIP inventory ledger bucket in the schema.',
    ],
  };
}

async function loadProductionData(branchId?: string): Promise<DashboardData> {
  const today = startOfDay();
  const monthStart = startOfMonth();
  const [todayOutput, runningOrders, pendingOrders, openOrders, finishedGoods, productionCost] = await Promise.all([
    prisma.productionOutput.aggregate({
      where: {
        createdAt: { gte: today },
        order: branchId ? { branchId } : undefined,
      },
      _sum: { quantity: true },
    }),
    prisma.productionOrder.count({
      where: { status: 'IN_PROGRESS', ...(branchId ? { branchId } : {}) },
    }),
    prisma.productionOrder.count({
      where: {
        status: { in: ['DRAFT', 'PLANNED', 'ON_HOLD'] },
        ...(branchId ? { branchId } : {}),
      },
    }),
    prisma.productionOrder.aggregate({
      where: {
        status: { in: ['PLANNED', 'IN_PROGRESS', 'ON_HOLD'] },
        ...(branchId ? { branchId } : {}),
      },
      _sum: { plannedQty: true, producedQty: true },
    }),
    prisma.productionOutput.aggregate({
      where: {
        createdAt: { gte: monthStart },
        order: branchId ? { branchId } : undefined,
      },
      _sum: { quantity: true },
    }),
    prisma.productionCostEntry.aggregate({
      where: {
        createdAt: { gte: monthStart },
        order: branchId ? { branchId } : undefined,
      },
      _sum: { amount: true },
    }),
  ]);

  const wipQty = (openOrders._sum.plannedQty ?? ZERO).minus(openOrders._sum.producedQty ?? ZERO);

  return {
    metrics: {
      todayProduction: (todayOutput._sum.quantity ?? ZERO).toFixed(2),
      runningWorkOrders: formatCount(runningOrders),
      pendingProduction: formatCount(pendingOrders),
      wipQuantity: wipQty.toFixed(2),
      finishedGoods: (finishedGoods._sum.quantity ?? ZERO).toFixed(2),
      productionCost: formatCurrency(productionCost._sum.amount ?? ZERO),
    },
    notes: [],
  };
}

async function loadPurchaseData(branchId?: string): Promise<DashboardData> {
  const today = startOfDay();
  const [requisitions, orders, goodsReceive, supplierDueAgg, pendingInvoice, todayPurchase] = await Promise.all([
    prisma.purchaseRequisition.count({
      where: {
        status: { in: ['PENDING', 'APPROVED'] },
        ...(branchId ? { branchId } : {}),
      },
    }),
    prisma.purchaseOrder.count({
      where: {
        status: { in: ['PENDING', 'APPROVED', 'PARTIALLY_RECEIVED'] },
        ...(branchId ? { branchId } : {}),
      },
    }),
    prisma.goodsReceiving.count({
      where: {
        status: 'COMPLETED',
        ...(branchId ? { branchId } : {}),
      },
    }),
    prisma.purchaseInvoice.aggregate({
      where: {
        status: { notIn: ['PAID', 'CANCELLED'] },
        ...(branchId ? { branchId } : {}),
      },
      _sum: { grandTotal: true, paidAmount: true },
    }),
    prisma.purchaseInvoice.count({
      where: {
        status: { in: ['PENDING', 'PARTIALLY_PAID'] },
        ...(branchId ? { branchId } : {}),
      },
    }),
    prisma.purchaseInvoice.aggregate({
      where: {
        invoiceDate: { gte: today },
        ...(branchId ? { branchId } : {}),
      },
      _sum: { grandTotal: true },
    }),
  ]);

  const supplierDue = (supplierDueAgg._sum.grandTotal ?? ZERO).minus(supplierDueAgg._sum.paidAmount ?? ZERO);

  return {
    metrics: {
      purchaseRequisition: formatCount(requisitions),
      purchaseOrder: formatCount(orders),
      goodsReceive: formatCount(goodsReceive),
      supplierDue: formatCurrency(supplierDue),
      pendingInvoice: formatCount(pendingInvoice),
      todayPurchase: formatCurrency(todayPurchase._sum.grandTotal ?? ZERO),
    },
    notes: [],
  };
}

async function loadStoreData(branchId?: string): Promise<DashboardData> {
  const inventory = await getInventorySnapshot(branchId);
  const [issuePending, receivePending, transferPending, damageStock] = await Promise.all([
    prisma.approvalRequest.count({
      where: { status: 'PENDING', module: 'warehouse', action: 'issue', ...(branchId ? { branchId } : {}) },
    }),
    prisma.approvalRequest.count({
      where: { status: 'PENDING', module: 'warehouse', action: 'receive', ...(branchId ? { branchId } : {}) },
    }),
    prisma.approvalRequest.count({
      where: { status: 'PENDING', module: 'warehouse', action: 'transfer', ...(branchId ? { branchId } : {}) },
    }),
    prisma.damageReport.count({ where: branchId ? { branchId } : undefined }),
  ]);

  const totalQty = inventory.rows.reduce((sum, row) => sum.plus(row.qty), ZERO);
  const minimumAlerts = inventory.rows.filter((row) => row.belowReorder).length;

  return {
    metrics: {
      storeStock: totalQty.toFixed(2),
      issuePending: formatCount(issuePending),
      receivePending: formatCount(receivePending),
      transferPending: formatCount(transferPending),
      damageStock: formatCount(damageStock),
      minimumStockAlert: formatCount(minimumAlerts),
    },
    notes: [
      'Pending receive, issue, and transfer are currently driven by approval queue volume where warehouse approvals exist.',
    ],
  };
}

async function loadSalesData(branchId?: string): Promise<DashboardData> {
  const today = startOfDay();
  const monthStart = startOfMonth();
  const [todaySales, monthlySales, pendingOrders, deliveryPending, returns] = await Promise.all([
    getSalesTotals(branchId, today, new Date()),
    getSalesTotals(branchId, monthStart, new Date()),
    prisma.corporateOrder.count({
      where: {
        status: { in: ['DRAFT', 'CONFIRMED', 'PARTIALLY_DELIVERED'] },
        ...(branchId ? { branchId } : {}),
      },
    }),
    prisma.corporateOrder.count({
      where: {
        status: { in: ['CONFIRMED', 'PARTIALLY_DELIVERED'] },
        ...(branchId ? { branchId } : {}),
      },
    }),
    Promise.all([
      prisma.posReturn.count({
        where: { returnDate: { gte: monthStart }, ...(branchId ? { branchId } : {}) },
      }),
      prisma.wholesaleReturn.count({
        where: { returnDate: { gte: monthStart }, ...(branchId ? { branchId } : {}) },
      }),
    ]),
  ]);

  return {
    metrics: {
      todaySales: formatCurrency(todaySales.gross),
      pendingOrders: formatCount(pendingOrders),
      deliveryPending: formatCount(deliveryPending),
      customerDue: formatCurrency(monthlySales.outstanding),
      salesReturn: formatCount(returns[0] + returns[1]),
      monthlySales: formatCurrency(monthlySales.gross),
    },
    notes: [],
  };
}

async function loadManagementData(branchId?: string): Promise<DashboardData> {
  const monthStart = startOfMonth();
  const [sales, purchase, inventory, cashBalance, bankBalance, incomeTotals, activeProduction] = await Promise.all([
    getSalesTotals(branchId, monthStart, new Date()),
    getPurchaseTotals(branchId, monthStart, new Date()),
    getInventorySnapshot(branchId),
    getPositiveBalanceByKeyword(branchId, ['cash']),
    getPositiveBalanceByKeyword(branchId, ['bank']),
    getIncomeTotals(branchId, monthStart, new Date()),
    prisma.productionOrder.count({
      where: {
        status: { in: ['PLANNED', 'IN_PROGRESS', 'ON_HOLD'] },
        ...(branchId ? { branchId } : {}),
      },
    }),
  ]);

  return {
    metrics: {
      totalSales: formatCurrency(sales.gross),
      totalPurchase: formatCurrency(purchase.invoiceTotal),
      netProfit: formatCurrency(incomeTotals.net),
      cashBankBalance: formatCurrency(cashBalance.plus(bankBalance)),
      productionStatus: `${formatCount(activeProduction)} running`,
      inventoryValue: formatCurrency(inventory.totals.value),
      payable: formatCurrency(purchase.openPayable),
      receivable: formatCurrency(sales.outstanding),
    },
    notes: ['Cash/Bank Balance uses posted ledger balances within the current dashboard scope.'],
  };
}

async function getInventorySnapshot(branchId?: string) {
  const branchFilter = branchId ? Prisma.sql`AND \`branchId\` = ${branchId}` : Prisma.empty;
  const grouped = await prisma.$queryRaw<{ productId: string; balance: string }[]>(
    Prisma.sql`SELECT \`productId\`,
        CAST(SUM(CASE WHEN direction = 'IN' THEN quantity ELSE -quantity END) AS CHAR) AS balance
      FROM \`InventoryLedger\`
      WHERE 1=1 ${branchFilter}
      GROUP BY \`productId\``,
  );

  const productIds = grouped.map((row) => row.productId);
  if (productIds.length === 0) {
    return {
      rows: [] as Array<{ qty: Prisma.Decimal; value: Prisma.Decimal; type: string; belowReorder: boolean }>,
      totals: { qty: ZERO, value: ZERO },
    };
  }

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      sku: true,
      name: true,
      type: true,
      unit: true,
      costPrice: true,
      reorderLevel: true,
    },
  });

  const byId = new Map(products.map((product) => [product.id, product]));
  const rows = grouped
    .map((group) => {
      const product = byId.get(group.productId);
      if (!product) return null;
      const qty = new Prisma.Decimal(group.balance ?? 0);
      const value = qty.mul(product.costPrice);
      return {
        productId: group.productId,
        sku: product.sku,
        name: product.name,
        type: product.type,
        unit: product.unit,
        qty,
        value,
        reorderLevel: product.reorderLevel,
        belowReorder: qty.lte(product.reorderLevel) && product.reorderLevel.gt(0),
      };
    })
    .filter(Boolean) as Array<{
    productId: string;
    sku: string;
    name: string;
    type: string;
    unit: string;
    qty: Prisma.Decimal;
    value: Prisma.Decimal;
    reorderLevel: Prisma.Decimal;
    belowReorder: boolean;
  }>;

  const totals = rows.reduce(
    (sum, row) => ({
      qty: sum.qty.plus(row.qty),
      value: sum.value.plus(row.value),
    }),
    { qty: ZERO, value: ZERO },
  );

  return { rows, totals };
}

async function getSalesTotals(branchId: string | undefined, from: Date, to: Date) {
  const [pos, wholesale, corporate] = await Promise.all([
    prisma.posSale.aggregate({
      where: {
        saleDate: { gte: from, lte: to },
        status: { not: 'VOIDED' },
        ...(branchId ? { branchId } : {}),
      },
      _sum: { grandTotal: true, paidTotal: true, creditAmount: true },
      _count: { _all: true },
    }),
    prisma.wholesaleInvoice.aggregate({
      where: {
        invoiceDate: { gte: from, lte: to },
        status: { notIn: ['VOIDED'] },
        ...(branchId ? { branchId } : {}),
      },
      _sum: { grandTotal: true, paidTotal: true, balanceDue: true },
      _count: { _all: true },
    }),
    prisma.corporateInvoice.aggregate({
      where: {
        invoiceDate: { gte: from, lte: to },
        ...(branchId ? { branchId } : {}),
      },
      _sum: { grandTotal: true, paidTotal: true, balanceDue: true },
      _count: { _all: true },
    }),
  ]);

  return {
    count: pos._count._all + wholesale._count._all + corporate._count._all,
    gross: (pos._sum.grandTotal ?? ZERO).plus(wholesale._sum.grandTotal ?? ZERO).plus(corporate._sum.grandTotal ?? ZERO),
    outstanding: (wholesale._sum.balanceDue ?? ZERO).plus(corporate._sum.balanceDue ?? ZERO),
    paid: (pos._sum.paidTotal ?? ZERO).plus(wholesale._sum.paidTotal ?? ZERO).plus(corporate._sum.paidTotal ?? ZERO),
  };
}

async function getPurchaseTotals(branchId: string | undefined, from: Date, to: Date) {
  const [invoiceAgg, unpaidAgg] = await Promise.all([
    prisma.purchaseInvoice.aggregate({
      where: {
        invoiceDate: { gte: from, lte: to },
        ...(branchId ? { branchId } : {}),
      },
      _sum: { grandTotal: true, paidAmount: true },
      _count: { _all: true },
    }),
    prisma.purchaseInvoice.aggregate({
      where: {
        status: { notIn: ['PAID', 'CANCELLED'] },
        ...(branchId ? { branchId } : {}),
      },
      _sum: { grandTotal: true, paidAmount: true },
    }),
  ]);

  return {
    invoiceCount: invoiceAgg._count._all,
    invoiceTotal: invoiceAgg._sum.grandTotal ?? ZERO,
    openPayable: (unpaidAgg._sum.grandTotal ?? ZERO).minus(unpaidAgg._sum.paidAmount ?? ZERO),
  };
}

async function getPositiveBalanceByKeyword(branchId: string | undefined, keywords: string[]) {
  const normalized = keywords.map((keyword) => keyword.toLowerCase());
  const accounts = await prisma.chartAccount.findMany({
    where: {
      OR: normalized.flatMap((keyword) => [
        { name: { contains: keyword } },
        { code: { contains: keyword } },
      ]),
    },
    select: { id: true },
  });

  if (accounts.length === 0) return ZERO;

  const rows = await prisma.journalEntryLine.groupBy({
    by: ['accountId'],
    where: {
      accountId: { in: accounts.map((account) => account.id) },
      entry: {
        status: 'POSTED',
        ...(branchId ? { branchId } : {}),
      },
    },
    _sum: { debit: true, credit: true },
  });

  return rows.reduce((sum, row) => {
    const balance = (row._sum.debit ?? ZERO).minus(row._sum.credit ?? ZERO);
    return balance.greaterThan(0) ? sum.plus(balance) : sum;
  }, ZERO);
}

async function getIncomeTotals(branchId: string | undefined, from: Date, to: Date) {
  const rows = await prisma.journalEntryLine.groupBy({
    by: ['accountId'],
    where: {
      entry: {
        status: 'POSTED',
        date: { gte: from, lte: to },
        ...(branchId ? { branchId } : {}),
      },
    },
    _sum: { debit: true, credit: true },
  });
  const accounts = await prisma.chartAccount.findMany({
    where: { id: { in: rows.map((row) => row.accountId) }, type: { in: ['INCOME', 'EXPENSE'] } },
    select: { id: true, type: true },
  });
  const byId = new Map(accounts.map((account) => [account.id, account.type]));

  const totals = rows.reduce(
    (sum, row) => {
      const type = byId.get(row.accountId);
      const debit = row._sum.debit ?? ZERO;
      const credit = row._sum.credit ?? ZERO;
      if (type === 'INCOME') sum.income = sum.income.plus(credit.minus(debit));
      if (type === 'EXPENSE') sum.expense = sum.expense.plus(debit.minus(credit));
      return sum;
    },
    { income: ZERO, expense: ZERO },
  );
  return { income: totals.income, expense: totals.expense, net: totals.income.minus(totals.expense) };
}

async function getTodayReceipts(branchId: string | undefined, today: Date) {
  const [pos, wholesale, corporate] = await Promise.all([
    prisma.posSale.aggregate({
      where: {
        saleDate: { gte: today },
        status: { not: 'VOIDED' },
        ...(branchId ? { branchId } : {}),
      },
      _sum: { paidTotal: true },
    }),
    prisma.wholesalePayment.aggregate({
      where: {
        paidAt: { gte: today },
        invoice: branchId ? { branchId } : undefined,
      },
      _sum: { amount: true },
    }),
    prisma.corporateInvoicePayment.aggregate({
      where: {
        paidAt: { gte: today },
        invoice: branchId ? { branchId } : undefined,
      },
      _sum: { amount: true },
    }),
  ]);

  return (pos._sum.paidTotal ?? ZERO).plus(wholesale._sum.amount ?? ZERO).plus(corporate._sum.amount ?? ZERO);
}

async function getTodayPayments(branchId: string | undefined, today: Date) {
  const supplierPayments = await prisma.supplierPayment.aggregate({
    where: {
      paymentDate: { gte: today },
      ...(branchId ? { branchId } : {}),
    },
    _sum: { amount: true },
  });
  return supplierPayments._sum.amount ?? ZERO;
}

function formatCurrency(value: Prisma.Decimal) {
  return value.toFixed(2);
}

export async function getDashboardPendingTasks(session: AppSession) {
  const branchId = session.activeBranchId ?? undefined;
  const tasks: Array<{ module: string; title: string; count: number; url: string }> = [];

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

    const missingPunchPending = await prisma.attendanceException.count({
      where: { status: 'PENDING', type: 'MISSING_PUNCH', employee: branchId ? { branchId } : undefined },
    });
    if (missingPunchPending > 0) {
      tasks.push({ module: 'HR', title: 'Pending Missing Punch', count: missingPunchPending, url: '/hr/attendance' });
    }

    const lateEntryPending = await prisma.attendanceException.count({
      where: { status: 'PENDING', type: 'LATE_ENTRY', employee: branchId ? { branchId } : undefined },
    });
    if (lateEntryPending > 0) {
      tasks.push({ module: 'HR', title: 'Pending Late Entry', count: lateEntryPending, url: '/hr/attendance' });
    }

    const earlyExitPending = await prisma.attendanceException.count({
      where: { status: 'PENDING', type: 'EARLY_EXIT', employee: branchId ? { branchId } : undefined },
    });
    if (earlyExitPending > 0) {
      tasks.push({ module: 'HR', title: 'Pending Early Exit', count: earlyExitPending, url: '/hr/attendance' });
    }

    const overtimePending = await prisma.overtimeRecord.count({
      where: { status: 'DRAFT', branchId },
    });
    if (overtimePending > 0) {
      tasks.push({ module: 'HR', title: 'Pending Overtime', count: overtimePending, url: '/hr/overtime' });
    }
  }

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

  if (session.permissions.includes('accounts:read')) {
    const journalPending = await prisma.journalEntry.count({
      where: { status: 'DRAFT', branchId },
    });
    if (journalPending > 0) {
      tasks.push({ module: 'Accounts', title: 'Pending Journal Approval', count: journalPending, url: '/accounts/journals' });
    }
  }

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

  if (session.permissions.includes('sales:read')) {
    const pendingChallans = await prisma.corporateDelivery.count({
      where: { status: 'DRAFT', branchId },
    });
    if (pendingChallans > 0) {
      tasks.push({ module: 'Sales', title: 'Pending Delivery Challans', count: pendingChallans, url: '/warehouse/dispatch' });
    }

    const awaitingDispatch = await prisma.corporateDelivery.count({
      where: { status: 'PACKED', branchId },
    });
    if (awaitingDispatch > 0) {
      tasks.push({ module: 'Sales', title: 'Orders Awaiting Dispatch', count: awaitingDispatch, url: '/warehouse/dispatch' });
    }

    const pendingReturns = await prisma.corporateSalesReturn.count({
      where: { status: 'REQUESTED', branchId },
    });
    if (pendingReturns > 0) {
      tasks.push({ module: 'Sales', title: 'Pending Sales Returns', count: pendingReturns, url: '/sales/returns' });
    }

    const returnsAwaitingQC = await prisma.corporateSalesReturn.count({
      where: { status: 'GOODS_RECEIVED', branchId },
    });
    if (returnsAwaitingQC > 0) {
      tasks.push({ module: 'Sales', title: 'Returns Awaiting QC', count: returnsAwaitingQC, url: '/sales/returns-qc' });
    }
  }

  const total = tasks.reduce((sum, t) => sum + t.count, 0);
  return { total, tasks };
}

export async function getDashboardNotifications(session: AppSession) {
  const notifications = await prisma.notification.findMany({
    where: { recipientId: session.userId, readAt: null },
    orderBy: { createdAt: 'desc' },
  });

  const unreadCount = notifications.length;

  const groupsMap = new Map<string, number>();
  notifications.forEach((n) => {
    const type = n.module || 'system';
    groupsMap.set(type, (groupsMap.get(type) || 0) + 1);
  });

  const groups = Array.from(groupsMap.entries()).map(([type, count]) => ({ type, count }));

  const latest = notifications.slice(0, 5).map((n) => ({
    id: n.id,
    title: n.title,
    message: n.body || '',
    url: n.href || '#',
    priority: n.severity.toLowerCase(),
  }));

  return { unreadCount, groups, latest };
}

export async function getDashboardApprovals(modules: string[], branchId?: string) {
  return prisma.approvalRequest.findMany({
    where: {
      status: 'PENDING',
      module: modules.length > 0 ? { in: modules } : undefined,
      branchId: branchId ?? undefined,
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id: true,
      title: true,
      module: true,
      action: true,
      amount: true,
      currency: true,
      status: true,
    },
  });
}
