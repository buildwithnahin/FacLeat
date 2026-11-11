import Link from 'next/link';
import { Suspense } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRightLeft,
  Banknote,
  BarChart3,
  Boxes,
  Building2,
  ClipboardCheck,
  ClipboardList,
  Factory,
  FileText,
  GitBranch,
  HandCoins,
  History,
  Landmark,
  LayoutDashboard,
  Package,
  Receipt,
  Ship,
  ShoppingCart,
  Truck,
  UserCog,
  Users,
  UsersRound,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { formatCurrency, type CurrencyCode } from '@/lib/money';
import type { AppSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { KpiCard, type KpiTone } from '@/components/shared/kpi-card';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

export const metadata = { title: 'Dashboard' };

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

type DashboardRow = {
  key: string;
  primary: string;
  secondary: string;
  href: string;
  permission?: string | string[];
};

type DashboardCard = {
  key: string;
  label: string;
  href: string;
  icon?: LucideIcon;
  tone?: KpiTone;
  description?: string;
};

type DashboardDefinition = {
  label: string;
  summary: string;
  modules: string[];
  cards: DashboardCard[];
  tasks: DashboardRow[];
  reports: DashboardRow[];
};

interface DashboardSummaryDto {
  role: DashboardRole;
  metrics: Record<string, string>;
  notes: string[];
  pendingTasks: { total: number; tasks: Array<{ module: string; title: string; count: number; url: string }> };
  notifications: {
    unreadCount: number;
    latest: Array<{ id: string; title: string; message: string; url: string; priority: string }>;
  };
  approvals: Array<{
    id: string;
    title: string;
    module: string;
    action: string;
    amount: string | null;
    currency: CurrencyCode | null;
    status: string;
  }>;
}

const DASHBOARDS: Record<DashboardRole, DashboardDefinition> = {
  'super-admin': {
    label: 'Super Admin Dashboard',
    summary: 'System-wide control, audit visibility, and platform health.',
    modules: ['users', 'roles', 'branches', 'audit', 'notifications', 'documents', 'approvals'],
    cards: [
      { key: 'totalCompanies', label: 'Total Companies', href: '/branches', icon: Building2, description: 'Main operating entities' },
      { key: 'totalBranches', label: 'Total Branches', href: '/branches', icon: GitBranch },
      { key: 'totalUsers', label: 'Total Users', href: '/users', icon: UsersRound },
      { key: 'activeModules', label: 'Active Modules', href: '/dashboard', icon: LayoutDashboard, tone: 'primary' },
      { key: 'systemHealth', label: 'System Health', href: '/audit', icon: Activity, tone: 'success' },
      { key: 'todayLoginUsers', label: 'Today Login Users', href: '/audit', icon: History, description: 'Login audit pending' },
    ],
    tasks: [
      { key: 'company-setup', primary: 'Company Setup', secondary: 'Create and maintain operating entities and branches', href: '/branches' },
      { key: 'role-permissions', primary: 'Role Permission Setup', secondary: 'Maintain access templates and role permissions', href: '/roles' },
      { key: 'backup-check', primary: 'Backup Check', secondary: 'Review storage and document settings before backups', href: '/documents/settings' },
      { key: 'system-audit', primary: 'System Audit Review', secondary: 'Inspect audit trail and system activity', href: '/audit' },
    ],
    reports: [
      { key: 'user-activity', primary: 'User Activity Report', secondary: 'Review audit events by user and module', href: '/audit' },
      { key: 'company-wise', primary: 'Company Wise Report', secondary: 'Compare branch and company-wide activity', href: '/branches' },
      { key: 'permission-audit', primary: 'Permission Audit Report', secondary: 'Review who can access which modules', href: '/roles' },
      { key: 'system-log', primary: 'System Log Report', secondary: 'Inspect system notifications and operational logs', href: '/notifications' },
    ],
  },
  admin: {
    label: 'Admin Dashboard',
    summary: 'User, role, branch, and approval control for daily administration.',
    modules: ['users', 'roles', 'branches', 'approvals', 'audit', 'notifications'],
    cards: [
      { key: 'totalUsers', label: 'Total Users', href: '/users', icon: UsersRound },
      { key: 'activeEmployees', label: 'Active Employees', href: '/hr/employees', icon: Users },
      { key: 'pendingApprovals', label: 'Pending Approvals', href: '/approvals', icon: ClipboardCheck, tone: 'warning' },
      { key: 'todayNotifications', label: 'Today Notifications', href: '/notifications', icon: AlertTriangle },
      { key: 'branchSummary', label: 'Branch Summary', href: '/branches', icon: GitBranch },
      { key: 'moduleUsage', label: 'Module Usage', href: '/audit', icon: BarChart3, description: 'Modules touched today' },
    ],
    tasks: [
      { key: 'user-create', primary: 'User Create / Update', secondary: 'Create and maintain user accounts', href: '/users' },
      { key: 'role-assign', primary: 'Role Assign', secondary: 'Assign roles and ownership to users', href: '/roles' },
      { key: 'permission-update', primary: 'Permission Update', secondary: 'Update role permissions and access coverage', href: '/roles' },
      { key: 'branch-setup', primary: 'Branch Setup', secondary: 'Maintain branch records and default scope', href: '/branches' },
    ],
    reports: [
      { key: 'user-report', primary: 'User Report', secondary: 'User list, status, and assignments', href: '/users' },
      { key: 'role-report', primary: 'Role Report', secondary: 'Role and permission coverage overview', href: '/roles' },
      { key: 'branch-report', primary: 'Branch Report', secondary: 'Branch footprint and activation summary', href: '/branches' },
      { key: 'activity-report', primary: 'Activity Report', secondary: 'Operational activity by day and user', href: '/audit' },
    ],
  },
  hr: {
    label: 'HR Dashboard',
    summary: 'Employee lifecycle, attendance, leave, and payroll operations.',
    modules: ['hr', 'notifications', 'approvals'],
    cards: [
      { key: 'totalEmployees', label: 'Total Employees', href: '/hr/employees', icon: UsersRound },
      { key: 'presentToday', label: 'Present Today', href: '/hr/attendance', icon: ClipboardCheck, tone: 'success' },
      { key: 'absentToday', label: 'Absent Today', href: '/hr/attendance', icon: AlertTriangle, tone: 'warning' },
      { key: 'lateEmployees', label: 'Late Employees', href: '/hr/attendance', icon: History, tone: 'warning' },
      { key: 'leavePending', label: 'Leave Pending', href: '/hr/leaves', icon: ClipboardList },
      { key: 'newJoining', label: 'New Joining', href: '/hr/employees', icon: UserCog },
    ],
    tasks: [
      { key: 'leave-approval', primary: 'Leave Approval', secondary: 'Review and approve pending leave requests', href: '/hr/leave-approval' },
      { key: 'attendance-correction', primary: 'Attendance Correction', secondary: 'Fix late punch, absent, and mismatch records', href: '/hr/attendance-adjustment' },
      { key: 'recruitment', primary: 'Recruitment', secondary: 'Start new hiring and employee onboarding entries', href: '/hr/employees/new' },
      { key: 'joining', primary: 'Joining Process', secondary: 'Create employee profiles and complete joining tasks', href: '/hr/employees/new' },
      { key: 'exit-clearance', primary: 'Exit Clearance', secondary: 'Handle final clearance, settlements, and separation tasks', href: '/hr/exit-clearance' },
    ],
    reports: [
      { key: 'attendance-report', primary: 'Attendance Report', secondary: 'Daily and monthly attendance summary', href: '/reports/hr' },
      { key: 'employee-report', primary: 'Employee Report', secondary: 'Headcount and profile summary', href: '/hr/employees' },
      { key: 'leave-report', primary: 'Leave Report', secondary: 'Leave requests and approval history', href: '/hr/leaves' },
      { key: 'payroll-report', primary: 'Payroll Report', secondary: 'Payroll run and payment coverage', href: '/hr/payroll' },
    ],
  },
  accounts: {
    label: 'Accounts Dashboard',
    summary: 'Cash, bank, receivable, payable, and statutory reporting visibility.',
    modules: ['accounts', 'coa', 'purchase', 'reports'],
    cards: [
      { key: 'cashBalance', label: 'Cash Balance', href: '/accounts/ledger', icon: Wallet, tone: 'primary' },
      { key: 'bankBalance', label: 'Bank Balance', href: '/accounts/ledger', icon: Landmark, tone: 'primary' },
      { key: 'todayReceipt', label: 'Today Receipt', href: '/accounts/cash-flow', icon: Receipt },
      { key: 'todayPayment', label: 'Today Payment', href: '/accounts/cash-flow', icon: Banknote },
      { key: 'payable', label: 'Payable', href: '/reports/purchase', icon: HandCoins, tone: 'warning' },
      { key: 'receivable', label: 'Receivable', href: '/reports/sales', icon: BarChart3, tone: 'warning' },
    ],
    tasks: [
      { key: 'voucher-approval', primary: 'Voucher Approval', secondary: 'Review journal entries and posting readiness', href: '/accounts/journals' },
      { key: 'supplier-payment', primary: 'Supplier Payment', secondary: 'Monitor bills and supplier settlements', href: '/purchase/invoices' },
      { key: 'customer-collection', primary: 'Customer Collection', secondary: 'Review due collections and open invoices', href: '/reports/sales' },
      { key: 'bank-recon', primary: 'Bank Reconciliation', secondary: 'Reconcile posted entries and bank balances', href: '/accounts/ledger' },
    ],
    reports: [
      { key: 'ledger-report', primary: 'Ledger Report', secondary: 'General ledger and account movement', href: '/accounts/ledger' },
      { key: 'trial-balance', primary: 'Trial Balance', secondary: 'Posted balance snapshot by account', href: '/accounts/trial-balance' },
      { key: 'profit-loss', primary: 'Profit & Loss', secondary: 'Income and expense summary', href: '/accounts/income-statement' },
      { key: 'balance-sheet', primary: 'Balance Sheet', secondary: 'Asset, liability, and equity view', href: '/accounts/balance-sheet' },
      { key: 'cash-flow', primary: 'Cash Flow', secondary: 'Movement of cash through the period', href: '/accounts/cash-flow' },
    ],
  },
  commercial: {
    label: 'Commercial Dashboard',
    summary: 'Import/export orders, LC activity, shipment flow, and trade documents.',
    modules: ['trade', 'documents', 'approvals'],
    cards: [
      { key: 'importPending', label: 'Import Pending', href: '/trade/orders', icon: Truck },
      { key: 'exportPending', label: 'Export Pending', href: '/trade/orders', icon: Ship },
      { key: 'lcStatus', label: 'LC Status', href: '/trade/lc', icon: FileText, tone: 'primary' },
      { key: 'shipmentPending', label: 'Shipment Pending', href: '/trade/shipments', icon: ArrowRightLeft, tone: 'warning' },
      { key: 'customsPending', label: 'Customs Pending', href: '/trade/shipments', icon: ClipboardCheck, tone: 'warning' },
      { key: 'documentPending', label: 'Document Pending', href: '/documents', icon: FileText },
    ],
    tasks: [
      { key: 'lc-processing', primary: 'LC Processing', secondary: 'Issue, monitor, and amend active letters of credit', href: '/trade/lc' },
      { key: 'import-doc', primary: 'Import Document', secondary: 'Review import files and related document links', href: '/documents' },
      { key: 'export-doc', primary: 'Export Document', secondary: 'Track export paperwork and shipment files', href: '/documents' },
      { key: 'shipment-track', primary: 'Shipment Tracking', secondary: 'Monitor shipment, customs, and delivery progress', href: '/trade/shipments' },
    ],
    reports: [
      { key: 'lc-report', primary: 'LC Report', secondary: 'LC issuance, amendments, and utilization', href: '/trade/lc' },
      { key: 'import-report', primary: 'Import Report', secondary: 'Import order and arrival overview', href: '/trade/orders' },
      { key: 'export-report', primary: 'Export Report', secondary: 'Export order and delivery overview', href: '/trade/orders' },
      { key: 'shipment-report', primary: 'Shipment Report', secondary: 'Shipment status and customs pipeline', href: '/trade/shipments' },
    ],
  },
  inventory: {
    label: 'Inventory Dashboard',
    summary: 'Stock visibility across raw material, WIP, finished goods, and valuation.',
    modules: ['inventory', 'warehouse', 'barcode', 'reports'],
    cards: [
      { key: 'totalStock', label: 'Total Stock', href: '/inventory/stock', icon: Boxes },
      { key: 'lowStockItems', label: 'Low Stock Items', href: '/reports/inventory', icon: AlertTriangle, tone: 'warning' },
      { key: 'rawMaterialStock', label: 'Raw Material Stock', href: '/inventory/stock', icon: Package },
      { key: 'wipStock', label: 'WIP Stock', href: '/factory', icon: Factory },
      { key: 'finishedGoodsStock', label: 'Finished Goods Stock', href: '/inventory/stock', icon: ShoppingCart },
      { key: 'stockValue', label: 'Stock Value', href: '/reports/inventory', icon: Banknote, tone: 'primary' },
    ],
    tasks: [
      { key: 'stock-transfer', primary: 'Stock Transfer', secondary: 'Move stock between warehouses and branches', href: '/warehouse/transfer' },
      { key: 'stock-adjustment', primary: 'Stock Adjustment', secondary: 'Correct on-hand balance and count variances', href: '/warehouse/count' },
      { key: 'damage-entry', primary: 'Damage Entry', secondary: 'Log and review faulty or damaged inventory', href: '/warehouse/faulty' },
      { key: 'reorder-alert', primary: 'Reorder Alert', secondary: 'Track products below reorder level', href: '/reports/inventory' },
    ],
    reports: [
      { key: 'stock-balance', primary: 'Stock Balance', secondary: 'On-hand balance by product and warehouse', href: '/inventory/stock' },
      { key: 'stock-movement', primary: 'Stock Movement', secondary: 'Ledger-driven movement overview', href: '/inventory/ledger' },
      { key: 'low-stock', primary: 'Low Stock Report', secondary: 'Reorder and shortage watchlist', href: '/reports/inventory' },
      { key: 'stock-valuation', primary: 'Stock Valuation', secondary: 'Current value of on-hand inventory', href: '/reports/inventory' },
    ],
  },
  production: {
    label: 'Production Dashboard',
    summary: 'Factory planning, running work orders, WIP, FG output, and costing.',
    modules: ['factory', 'inventory', 'warehouse'],
    cards: [
      { key: 'todayProduction', label: 'Today Production', href: '/factory', icon: Factory, tone: 'primary' },
      { key: 'runningWorkOrders', label: 'Running Work Orders', href: '/factory', icon: ClipboardList },
      { key: 'pendingProduction', label: 'Pending Production', href: '/factory', icon: AlertTriangle, tone: 'warning' },
      { key: 'wipQuantity', label: 'WIP Quantity', href: '/factory', icon: Boxes },
      { key: 'finishedGoods', label: 'Finished Goods', href: '/factory', icon: Package },
      { key: 'productionCost', label: 'Production Cost', href: '/factory', icon: Banknote },
    ],
    tasks: [
      { key: 'production-plan', primary: 'Production Plan', secondary: 'Create and maintain production plans', href: '/factory/new' },
      { key: 'work-order', primary: 'Work Order', secondary: 'Monitor and progress active work orders', href: '/factory' },
      { key: 'rm-issue', primary: 'RM Issue', secondary: 'Coordinate material issue for production', href: '/factory/production-issue' },
      { key: 'production-receive', primary: 'Production Receive', secondary: 'Move WIP output into the next process', href: '/factory/production-receive' },
      { key: 'quality-check', primary: 'Quality Check', secondary: 'Review finished output before FG receive', href: '/factory/finished-goods-receive' },
    ],
    reports: [
      { key: 'production-report', primary: 'Production Report', secondary: 'Output and work-order summary', href: '/factory' },
      { key: 'wip-report', primary: 'WIP Report', secondary: 'Open production quantity by order', href: '/factory' },
      { key: 'costing-report', primary: 'Costing Report', secondary: 'Labour, overhead, and direct cost view', href: '/factory' },
      { key: 'efficiency-report', primary: 'Efficiency Report', secondary: 'Progress of active and completed orders', href: '/factory' },
    ],
  },
  purchase: {
    label: 'Purchase Dashboard',
    summary: 'Supplier pipeline from requisition to PO, GRN, invoice, and due.',
    modules: ['purchase', 'suppliers', 'warehouse', 'approvals'],
    cards: [
      { key: 'purchaseRequisition', label: 'Purchase Requisition', href: '/purchase/requisitions', icon: ClipboardList },
      { key: 'purchaseOrder', label: 'Purchase Order', href: '/purchase/orders', icon: ShoppingCart },
      { key: 'goodsReceive', label: 'Goods Receive', href: '/purchase/grn', icon: Truck },
      { key: 'supplierDue', label: 'Supplier Due', href: '/suppliers/payments', icon: HandCoins, tone: 'warning' },
      { key: 'pendingInvoice', label: 'Pending Invoice', href: '/purchase/invoices', icon: FileText },
      { key: 'todayPurchase', label: 'Today Purchase', href: '/reports/purchase', icon: Receipt, tone: 'primary' },
    ],
    tasks: [
      { key: 'req-approval', primary: 'Requisition Approval', secondary: 'Review and approve pending requisitions', href: '/purchase/requisitions' },
      { key: 'po-create', primary: 'PO Create', secondary: 'Issue and manage purchase orders', href: '/purchase/orders/new' },
      { key: 'goods-receive', primary: 'Goods Receive', secondary: 'Receive and verify delivered items', href: '/purchase/grn/new' },
      { key: 'purchase-invoice', primary: 'Purchase Invoice', secondary: 'Match PO, GRN, and supplier invoice', href: '/purchase/invoices/new' },
    ],
    reports: [
      { key: 'purchase-report', primary: 'Purchase Report', secondary: 'Purchase order and invoice overview', href: '/reports/purchase' },
      { key: 'supplier-ledger', primary: 'Supplier Ledger', secondary: 'Supplier due and payment movement', href: '/suppliers/payments' },
      { key: 'grn-report', primary: 'GRN Report', secondary: 'Goods received and variance coverage', href: '/purchase/grn' },
      { key: 'purchase-return', primary: 'Purchase Return Report', secondary: 'Track rejections and damaged receipts', href: '/warehouse/faulty' },
    ],
  },
  store: {
    label: 'Store Dashboard',
    summary: 'Material receive, issue, transfer, count, and warehouse watchlist.',
    modules: ['warehouse', 'inventory', 'purchase'],
    cards: [
      { key: 'storeStock', label: 'Store Stock', href: '/warehouse', icon: Boxes },
      { key: 'issuePending', label: 'Issue Pending', href: '/warehouse/issue', icon: ClipboardList },
      { key: 'receivePending', label: 'Receive Pending', href: '/warehouse/receive', icon: Truck },
      { key: 'transferPending', label: 'Transfer Pending', href: '/warehouse/transfer', icon: ArrowRightLeft },
      { key: 'damageStock', label: 'Damage Stock', href: '/warehouse/faulty', icon: AlertTriangle, tone: 'warning' },
      { key: 'minimumStockAlert', label: 'Minimum Stock Alert', href: '/reports/inventory', icon: ClipboardCheck, tone: 'warning' },
    ],
    tasks: [
      { key: 'material-receive', primary: 'Material Receive', secondary: 'Receive stock into warehouse locations', href: '/warehouse/receive' },
      { key: 'material-issue', primary: 'Material Issue', secondary: 'Issue materials for operations and production', href: '/warehouse/issue' },
      { key: 'store-transfer', primary: 'Store Transfer', secondary: 'Transfer materials between store points', href: '/warehouse/transfer' },
      { key: 'stock-count', primary: 'Stock Count', secondary: 'Run physical count and reconcile differences', href: '/warehouse/count' },
    ],
    reports: [
      { key: 'store-stock', primary: 'Store Stock Report', secondary: 'Warehouse balance by store location', href: '/warehouse' },
      { key: 'issue-report', primary: 'Issue Report', secondary: 'Issued material history and trend', href: '/warehouse/issued' },
      { key: 'receive-report', primary: 'Receive Report', secondary: 'Received material and intake records', href: '/warehouse/receive' },
      { key: 'transfer-report', primary: 'Transfer Report', secondary: 'Inter-warehouse movement summary', href: '/warehouse/transfer' },
    ],
  },
  sales: {
    label: 'Sales Dashboard',
    summary: 'Customer, order, delivery, invoice, and due collection workflow.',
    modules: ['crm', 'pos', 'wholesale', 'corporate-sales', 'ecommerce'],
    cards: [
      { key: 'todaySales', label: 'Today Sales', href: '/reports/sales', icon: ShoppingCart, tone: 'primary' },
      { key: 'pendingOrders', label: 'Pending Orders', href: '/corporate-sales/orders', icon: ClipboardList },
      { key: 'deliveryPending', label: 'Delivery Pending', href: '/corporate-sales/orders', icon: Truck },
      { key: 'customerDue', label: 'Customer Due', href: '/reports/sales', icon: HandCoins, tone: 'warning' },
      { key: 'salesReturn', label: 'Sales Return', href: '/wholesale/invoices', icon: ArrowRightLeft },
      { key: 'monthlySales', label: 'Monthly Sales', href: '/reports/sales', icon: BarChart3 },
    ],
    tasks: [
      { key: 'sales-order', primary: 'Sales Order', secondary: 'Capture and manage customer orders', href: '/corporate-sales/orders' },
      { key: 'delivery-challan', primary: 'Delivery Challan', secondary: 'Track delivery execution and dispatch', href: '/corporate-sales/orders' },
      { key: 'invoice-create', primary: 'Invoice Create', secondary: 'Prepare wholesale and corporate invoices', href: '/wholesale/invoices' },
      { key: 'due-collection', primary: 'Due Collection', secondary: 'Follow up outstanding receivables', href: '/crm' },
    ],
    reports: [
      { key: 'sales-report', primary: 'Sales Report', secondary: 'Daily and monthly sales performance', href: '/reports/sales' },
      { key: 'customer-ledger', primary: 'Customer Ledger', secondary: 'Customer balance and activity overview', href: '/crm' },
      { key: 'sales-return-report', primary: 'Sales Return Report', secondary: 'Track returned quantity and value', href: '/wholesale/invoices' },
      { key: 'sales-target', primary: 'Sales Target Report', secondary: 'Pipeline and invoice progress snapshot', href: '/corporate-sales' },
    ],
  },
  management: {
    label: 'Management Dashboard',
    summary: 'Whole-business summary across sales, purchase, finance, production, and stock.',
    modules: ['reports', 'accounts', 'purchase', 'factory', 'inventory', 'approvals'],
    cards: [
      { key: 'totalSales', label: 'Total Sales', href: '/reports/sales', icon: ShoppingCart, tone: 'primary' },
      { key: 'totalPurchase', label: 'Total Purchase', href: '/reports/purchase', icon: Truck },
      { key: 'netProfit', label: 'Net Profit', href: '/accounts/income-statement', icon: Banknote, tone: 'success' },
      { key: 'cashBankBalance', label: 'Cash/Bank Balance', href: '/accounts/ledger', icon: Landmark },
      { key: 'productionStatus', label: 'Production Status', href: '/factory', icon: Factory },
      { key: 'inventoryValue', label: 'Inventory Value', href: '/reports/inventory', icon: Boxes },
      { key: 'payable', label: 'Payable', href: '/reports/purchase', icon: Wallet, tone: 'warning' },
      { key: 'receivable', label: 'Receivable', href: '/reports/sales', icon: HandCoins, tone: 'warning' },
    ],
    tasks: [
      { key: 'approval-review', primary: 'Approval Review', secondary: 'Track cross-functional pending approvals', href: '/approvals' },
      { key: 'budget-review', primary: 'Budget Review', secondary: 'Review spending against operating flow', href: '/accounts/cash-flow' },
      { key: 'performance-review', primary: 'Performance Review', secondary: 'Compare department outputs and results', href: '/reports' },
      { key: 'dept-monitor', primary: 'Department Monitoring', secondary: 'Watch core modules across departments', href: '/dashboard' },
    ],
    reports: [
      { key: 'business-summary', primary: 'Business Summary', secondary: 'Top-line operational snapshot', href: '/reports' },
      { key: 'financial-summary', primary: 'Financial Summary', secondary: 'Balance, profit, and cash overview', href: '/accounts' },
      { key: 'department-wise', primary: 'Department Wise Report', secondary: 'Review each operational area side by side', href: '/reports' },
      { key: 'profit-analysis', primary: 'Profit Analysis', secondary: 'Trend of margin and profitability', href: '/accounts/income-statement' },
      { key: 'budget-vs-actual', primary: 'Budget vs Actual', secondary: 'Cash movement as a proxy until budget module lands', href: '/accounts/cash-flow' },
    ],
  },
};

export async function RoleDashboardPage({ session }: { session: AppSession }) {
  const definition = DASHBOARDS[resolveDashboardRoleClientSide(session)];
  const scopedBranchId = session.activeBranchId ?? undefined;

  const tasks = filterRowsByPermission(definition.tasks, session);
  const reports = filterRowsByPermission(definition.reports, session);
  const scopeText = scopedBranchId ? 'Scoped to the active branch' : 'System-wide view';

  return (
    <div className="space-y-6">
      <PageHeader title={definition.label} description={`${definition.summary} ${scopeText}.`} />

      <Suspense fallback={<DashboardSkeleton cards={definition.cards} tasks={tasks} reports={reports} />}>
        <DashboardContent definition={definition} tasks={tasks} reports={reports} />
      </Suspense>
    </div>
  );
}

async function DashboardContent({
  definition,
  tasks,
  reports,
}: {
  definition: DashboardDefinition;
  tasks: DashboardRow[];
  reports: DashboardRow[];
}) {
  const summary = await backendFetch<DashboardSummaryDto>('/api/mobile/dashboard/role');

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {definition.cards.map((card) => (
          <Link key={card.key} href={card.href} className="block">
            <KpiCard
              label={card.label}
              value={summary.metrics[card.key] ?? '0'}
              description={card.description}
              icon={card.icon}
              tone={card.tone}
              className="h-full transition-colors hover:border-primary"
            />
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <PanelCard title="Tasks" href={tasks[0]?.href ?? '/dashboard'} emptyText="No task shortcuts available." rows={tasks} />
        <PanelCard title="Reports" href={reports[0]?.href ?? '/dashboard'} emptyText="No report shortcuts available." rows={reports} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 mt-6">
        <PanelCard
          title={`My Pending Tasks (${summary.pendingTasks.total})`}
          href="/dashboard"
          emptyText="No pending tasks available."
          rows={summary.pendingTasks.tasks.map((task) => ({
            key: task.title,
            primary: task.title,
            secondary: `${task.module} Module`,
            href: task.url,
            right: <Badge variant="default">{task.count}</Badge>,
          }))}
        />
        <PanelCard
          title={`Unread Notifications (${summary.notifications.unreadCount})`}
          href="/notifications"
          emptyText="No unread notifications."
          rows={summary.notifications.latest.map((n) => ({
            key: n.id,
            primary: n.title,
            secondary: n.message,
            href: n.url,
            right: <Badge variant={n.priority === 'critical' ? 'destructive' : 'secondary'}>{n.priority}</Badge>,
          }))}
        />
      </div>

      <div className="mt-6">
        <PanelCard
          title="Pending Approvals"
          href="/approvals"
          emptyText="No pending approvals in your dashboard scope."
          rows={summary.approvals.map((approval) => ({
            key: approval.id,
            primary: approval.title,
            secondary: `${approval.module} · ${approval.action}${approval.amount ? ` · ${formatCurrency(approval.amount, approval.currency ?? 'BDT')}` : ''}`,
            href: '/approvals',
            right: <Badge variant="warning">{approval.status}</Badge>,
          }))}
        />
      </div>
    </>
  );
}

function DashboardSkeleton({
  cards,
  tasks,
  reports,
}: {
  cards: DashboardDefinition['cards'];
  tasks: DashboardRow[];
  reports: DashboardRow[];
}) {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <KpiCard
            key={card.key}
            label={card.label}
            value="Loading..."
            description={card.description}
            icon={card.icon}
            tone={card.tone}
            className="h-full"
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <PanelCard title="Tasks" href={tasks[0]?.href ?? '/dashboard'} emptyText="No task shortcuts available." rows={tasks} />
        <PanelCard title="Reports" href={reports[0]?.href ?? '/dashboard'} emptyText="No report shortcuts available." rows={reports} />
      </div>

      <PanelCard title="Pending Approvals" href="/approvals" emptyText="Loading approvals..." rows={[]} />
    </>
  );
}

function hasPermission(session: AppSession, permission?: string | string[]) {
  if (!permission) return true;
  const needed = Array.isArray(permission) ? permission : [permission];
  return needed.every((item) => session.permissions.includes(item));
}

function filterRowsByPermission(rows: DashboardRow[], session: AppSession) {
  return rows.filter((row) => hasPermission(session, row.permission));
}

/**
 * Mirrors backend/'s `resolveDashboardRole` (server/services/dashboard-summary.service.ts)
 * so the page picks the same card/task/report layout the backend's metrics respond to.
 * Kept in sync manually — both are small and pure, and duplicating avoids a round trip
 * just to learn which static layout to render.
 */
function resolveDashboardRoleClientSide(session: AppSession): DashboardRole {
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

function PanelCard({
  title,
  href,
  rows,
  emptyText,
}: {
  title: string;
  href: string;
  rows: Array<{
    key: string;
    primary: string;
    secondary?: string;
    href?: string;
    right?: React.ReactNode;
  }>;
  emptyText: string;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Link href={href} className="text-xs text-primary hover:underline">
          View all
        </Link>
      </div>
      {rows.length === 0 ? (
        <CardContent className="p-6 text-center text-sm text-muted-foreground">{emptyText}</CardContent>
      ) : (
        <ul className="divide-y">
          {rows.map((row) => {
            const content = (
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{row.primary}</div>
                  {row.secondary && <div className="truncate text-xs text-muted-foreground">{row.secondary}</div>}
                </div>
                {row.right}
              </div>
            );
            return (
              <li key={row.key}>
                {row.href ? (
                  <Link href={row.href} className="block transition-colors hover:bg-muted/20">
                    {content}
                  </Link>
                ) : (
                  content
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
