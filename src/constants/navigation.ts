export interface NavItem {
  label: string;
  href?: string;
  iconName?: string;
  permission?: string;
  items?: NavItem[];
}

export interface NavModule {
  number: number;
  label: string;
  href: string;
  iconName: string;
  permission?: string;
  items?: NavItem[];
  section?: string;
}

type NavigationAccess = {
  roles?: string[];
  permissions?: string[];
};

export function resolveDashboardModuleLabel(access: NavigationAccess): string {
  const roleNames = (access.roles ?? []).map((role) => role.toLowerCase());
  const permissions = new Set(access.permissions ?? []);

  if (roleNames.some((role) => role.includes('super admin'))) return 'Super Admin Dashboard';
  if (roleNames.some((role) => role === 'admin' || role.endsWith(' admin'))) return 'Admin Dashboard';
  if (roleNames.some((role) => role.includes('hr'))) return 'HR Dashboard';
  if (roleNames.some((role) => role.includes('account'))) return 'Accounts Dashboard';
  if (roleNames.some((role) => role.includes('commercial') || role.includes('trade') || role.includes('export') || role.includes('import'))) {
    return 'Commercial Dashboard';
  }
  if (roleNames.some((role) => role.includes('warehouse') || role.includes('store'))) return 'Store Dashboard';
  if (roleNames.some((role) => role.includes('inventory'))) return 'Inventory Dashboard';
  if (roleNames.some((role) => role.includes('factory') || role.includes('production'))) return 'Production Dashboard';
  if (roleNames.some((role) => role.includes('purchase') || role.includes('procurement'))) return 'Purchase Dashboard';
  if (roleNames.some((role) => role.includes('sales'))) return 'Sales Dashboard';
  if (roleNames.some((role) => role.includes('management'))) return 'Management Dashboard';

  if (permissions.has('trade:read')) return 'Commercial Dashboard';
  if (permissions.has('hr:read')) return 'HR Dashboard';
  if (permissions.has('accounts:read')) return 'Accounts Dashboard';
  if (permissions.has('factory:read')) return 'Production Dashboard';
  if (permissions.has('purchase:read')) return 'Purchase Dashboard';
  if (permissions.has('warehouse:read')) return 'Store Dashboard';
  if (permissions.has('inventory:read')) return 'Inventory Dashboard';
  if (
    permissions.has('wholesale:read') ||
    permissions.has('corporate-sales:read') ||
    permissions.has('crm:read')
  ) {
    return 'Sales Dashboard';
  }

  return 'Admin Dashboard';
}

export function getModulesForAccess(access: NavigationAccess): NavModule[] {
  const dashboardLabel = resolveDashboardModuleLabel(access);
  return MODULES.map((module) =>
    module.href === '/dashboard' ? { ...module, label: dashboardLabel } : module,
  );
}

export const MODULES: NavModule[] = [
  {
    number: 1,
    label: 'Admin Dashboard',
    href: '/dashboard',
    iconName: 'LayoutDashboard',
    permission: 'dashboard:read',
    section: 'Overview',
  },
  {
    number: 2,
    label: 'Barcode',
    href: '/barcode',
    iconName: 'ScanBarcode',
    permission: 'barcode:read',
    section: 'Operations',
    items: [
      { label: 'Overview', href: '/barcode', permission: 'barcode:read' },
      { label: 'Print labels', href: '/barcode/print', permission: 'barcode:read' },
    ],
  },
  {
    number: 3,
    label: 'Inventory',
    href: '/inventory',
    iconName: 'Boxes',
    permission: 'inventory:read',
    section: 'Operations',
    items: [
      { label: 'Overview', href: '/inventory', permission: 'inventory:read' },
      { label: 'Products', href: '/inventory/products', permission: 'inventory:read' },
      { label: 'Categories', href: '/inventory/categories', permission: 'inventory:read' },
      { label: 'Stock balance', href: '/inventory/stock', permission: 'inventory:read' },
      { label: 'Ledger', href: '/inventory/ledger', permission: 'inventory:read' },
    ],
  },
  {
    number: 4,
    label: 'Warehouse',
    href: '/warehouse',
    iconName: 'Warehouse',
    permission: 'warehouse:read',
    section: 'Operations',
    items: [
      { label: 'Overview', href: '/warehouse', permission: 'warehouse:read' },
      { label: 'Receive', href: '/warehouse/receive', permission: 'warehouse:receive' },
      { label: 'Issue / adjust out', href: '/warehouse/issue', permission: 'warehouse:issue' },
      { label: 'Dispatch', href: '/warehouse/dispatch', permission: 'corporate-sales:deliver' },
      { label: 'Showroom requisitions', href: '/warehouse/requisitions', permission: 'warehouse:transfer' },
      { label: 'Requisition dispatch', href: '/warehouse/requisitions/dispatch', permission: 'warehouse:transfer' },
      { label: 'Showroom receive', href: '/warehouse/requisitions/receive', permission: 'warehouse:transfer' },
      { label: 'Customer returns', href: '/warehouse/returns', permission: 'inventory:return' },
      { label: 'Faulty stock', href: '/warehouse/faulty', permission: 'inventory:damage' },
      { label: 'Transfer', href: '/warehouse/transfer', permission: 'warehouse:transfer' },
      { label: 'Physical count', href: '/warehouse/count', permission: 'warehouse:count' },
    ],
  },
  {
    number: 5,
    label: 'Factory',
    href: '/factory',
    iconName: 'Factory',
    permission: 'factory:read',
    section: 'Operations',
    items: [
      { label: 'Production orders', href: '/factory', permission: 'factory:read' },
      { label: 'New production order', href: '/factory/new', permission: 'factory:plan' },
      { label: 'Production issue', href: '/factory/production-issue', permission: 'factory:execute' },
      { label: 'Process tracking', href: '/factory/process-tracking', permission: 'factory:execute' },
      { label: 'Production receive', href: '/factory/production-receive', permission: 'factory:execute' },
      { label: 'FG receive', href: '/factory/finished-goods-receive', permission: 'factory:execute' },
    ],
  },
  {
    number: 6,
    label: 'POS',
    href: '/pos',
    iconName: 'ShoppingCart',
    permission: 'pos:sell',
    section: 'Sales',
    items: [
      { label: 'Terminal', href: '/pos', permission: 'pos:sell' },
      { label: 'Sales', href: '/pos/sales', permission: 'pos:sell' },
      { label: 'Sessions', href: '/pos/sessions', permission: 'pos:sell' },
    ],
  },
  {
    number: 7,
    label: 'Corporate Sales',
    href: '/corporate-sales',
    iconName: 'Building2',
    permission: 'corporate-sales:read',
    section: 'Sales',
    items: [
      { label: 'Overview', href: '/corporate-sales', permission: 'corporate-sales:read' },
      { label: 'Quotes', href: '/corporate-sales/quotes', permission: 'corporate-sales:read' },
      { label: 'Orders', href: '/corporate-sales/orders', permission: 'corporate-sales:read' },
      { label: 'Invoices', href: '/corporate-sales/invoices', permission: 'corporate-sales:read' },
    ],
  },
  {
    number: 8,
    label: 'Wholesale',
    href: '/wholesale',
    iconName: 'Package',
    permission: 'wholesale:read',
    section: 'Sales',
    items: [
      { label: 'Overview', href: '/wholesale', permission: 'wholesale:read' },
      { label: 'New invoice', href: '/wholesale/new', permission: 'wholesale:write' },
      { label: 'Invoices', href: '/wholesale/invoices', permission: 'wholesale:read' },
    ],
  },
  {
    number: 9,
    label: 'E-commerce',
    href: '/ecommerce',
    iconName: 'Globe',
    permission: 'ecommerce:read',
    section: 'Sales',
  },
  {
    number: 10,
    label: 'Export / Import',
    href: '/trade',
    iconName: 'Ship',
    permission: 'trade:read',
    section: 'Sales',
    items: [
      { label: 'Overview', href: '/trade', permission: 'trade:read' },
      { label: 'Orders', href: '/trade/orders', permission: 'trade:read' },
      { label: 'New order', href: '/trade/orders/new', permission: 'trade:write' },
      { label: 'Letters of Credit', href: '/trade/lc', permission: 'trade:read' },
      { label: 'New LC', href: '/trade/lc/new', permission: 'trade:write' },
      { label: 'Shipments', href: '/trade/shipments', permission: 'trade:read' },
      { label: 'Payments', href: '/trade/payments', permission: 'trade:read' },
    ],
  },
  {
    number: 11,
    label: 'Suppliers',
    href: '/suppliers',
    iconName: 'Truck',
    permission: 'suppliers:read',
    section: 'Procurement',
    items: [
      { label: 'All suppliers', href: '/suppliers', permission: 'suppliers:read' },
      { label: 'Payments', href: '/suppliers/payments', permission: 'suppliers:read' },
    ],
  },
  {
    number: 12,
    label: 'CRM',
    href: '/crm',
    iconName: 'Users',
    permission: 'crm:read',
    section: 'Procurement',
    items: [
      { label: 'Customers', href: '/crm', permission: 'crm:read' },
      { label: 'New customer', href: '/crm/new', permission: 'crm:write' },
    ],
  },
  {
    number: 13,
    label: 'Purchase',
    href: '/purchase',
    iconName: 'Package',
    permission: 'purchase:read',
    section: 'Procurement',
    items: [
      { label: 'Overview', href: '/purchase', permission: 'purchase:read' },
      { label: 'Requisitions', href: '/purchase/requisitions', permission: 'purchase:read' },
      { label: 'Orders', href: '/purchase/orders', permission: 'purchase:read' },
      { label: 'Goods receive', href: '/purchase/grn', permission: 'purchase:receive' },
      { label: 'Invoices', href: '/purchase/invoices', permission: 'purchase:read' },
    ],
  },
  {
    number: 14,
    label: 'Accounts & Finance',
    href: '/accounts',
    iconName: 'Banknote',
    permission: 'accounts:read',
    section: 'Transactions',
    items: [
      { label: 'Overview', href: '/accounts', permission: 'accounts:read' },
      { label: 'Journals', href: '/accounts/journals', permission: 'accounts:read' },
      { label: 'New journal', href: '/accounts/journals/new', permission: 'accounts:post' },
      { label: 'Account ledger', href: '/accounts/ledger', permission: 'accounts:read' },
      { label: 'Trial balance', href: '/accounts/trial-balance', permission: 'accounts:read' },
      { label: 'Recruitment Budget Approval', href: '/hr/recruitment', permission: 'accounts:read' },
      { label: 'Balance sheet', href: '/accounts/balance-sheet', permission: 'accounts:read' },
      { label: 'Income statement', href: '/accounts/income-statement', permission: 'accounts:read' },
      { label: 'Cash flow statement', href: '/accounts/cash-flow', permission: 'accounts:read' },
      { label: 'Changes in equity', href: '/accounts/equity-changes', permission: 'accounts:read' },
      { label: 'Financial notes', href: '/accounts/financial-notes', permission: 'accounts:read' },
      { label: 'Fiscal periods', href: '/accounts/periods', permission: 'accounts:read' },
    ],
  },
  {
    number: 15,
    label: 'Chart of Accounts',
    href: '/coa',
    iconName: 'BookOpen',
    permission: 'coa:read',
    section: 'Transactions',
  },
  {
    number: 16,
    label: 'Assets',
    href: '/assets',
    iconName: 'Building2',
    permission: 'assets:read',
    section: 'Transactions',
    items: [
      { label: 'All assets', href: '/assets', permission: 'assets:read' },
      { label: 'Categories', href: '/assets/categories', permission: 'assets:read' },
    ],
  },
  {
    number: 17,
    label: 'Transactions',
    href: '/transactions',
    iconName: 'Wallet',
    permission: 'accounts:read',
    section: 'Transactions',
  },
  {
    number: 18,
    label: 'Reports & Analytics',
    href: '/reports',
    iconName: 'BarChart3',
    permission: 'reports:read',
    section: 'Analytics',
    items: [
      { label: 'Overview', href: '/reports', permission: 'reports:read' },
      { label: 'Sales', href: '/reports/sales', permission: 'reports:read' },
      { label: 'Top products', href: '/reports/top-products', permission: 'reports:read' },
      { label: 'Purchase', href: '/reports/purchase', permission: 'reports:read' },
      { label: 'Inventory valuation', href: '/reports/inventory', permission: 'reports:read' },
      { label: 'HR summary', href: '/reports/hr', permission: 'reports:read' },
    ],
  },
  {
    number: 19,
    label: 'HR & Payroll',
    href: '/hr',
    iconName: 'UsersRound',
    permission: 'hr:read',
    section: 'HR',
    items: [
      { label: 'Overview', href: '/hr', permission: 'hr:read' },
      {
        label: 'Recruitment',
        permission: 'hr:read',
        items: [
          { label: 'Recruitment Requests', href: '/hr/recruitment', permission: 'hr:write' },
          { label: 'Candidates', href: '/hr/candidates', permission: 'hr:read' },
          { label: 'Interviews', href: '/hr/interviews', permission: 'hr:read' },
          { label: 'Job Offers', href: '/hr/job-offers', permission: 'hr:write' },
          { label: 'Offer Contracts', href: '/hr/offer-contracts', permission: 'hr:write' },
          { label: 'Joining', href: '/hr/joining', permission: 'hr:write' },
        ],
      },
      {
        label: 'Employee Management',
        permission: 'hr:read',
        items: [
          { label: 'Employees', href: '/hr/employees', permission: 'hr:read' },
          { label: 'Departments', href: '/hr/departments', permission: 'hr:read' },
          { label: 'Designations', href: '/hr/designations', permission: 'hr:read' },
          { label: 'Shifts', href: '/hr/shifts', permission: 'hr:read' },
          { label: 'Holiday Calendar', href: '/hr/holidays', permission: 'hr:read' },
          { label: 'Contracts', href: '/hr/contracts', permission: 'hr:write' },
        ],
      },
      {
        label: 'Employee Lifecycle',
        permission: 'hr:read',
        items: [
          { label: 'Transfer', href: '/hr/transfers', permission: 'hr:write' },
          { label: 'Promotion', href: '/hr/promotions', permission: 'hr:write' },
          { label: 'Increment', href: '/hr/increments', permission: 'hr:write' },
          { label: 'Confirmation', href: '/hr/confirmations', permission: 'hr:write' },
          { label: 'Resignation', href: '/hr/resignations', permission: 'hr:read' },
          { label: 'Exit Clearance', href: '/hr/exit-clearance', permission: 'hr:read' },
        ],
      },
      {
        label: 'Attendance',
        permission: 'hr:read',
        items: [
          { label: 'Daily Attendance', href: '/hr/attendance', permission: 'hr:read' },
          { label: 'Attendance Adjustment', href: '/hr/attendance-adjustment', permission: 'hr:attendance' },
          { label: 'Late / Early Report', href: '/hr/late-early-report', permission: 'hr:read' },
          { label: 'Overtime', href: '/hr/overtime', permission: 'hr:read' },
          { label: 'Attendance Summary', href: '/hr/attendance-summary', permission: 'hr:read' },
        ],
      },
      {
        label: 'Leave Management',
        permission: 'hr:read',
        items: [
          { label: 'Leave Types', href: '/hr/leave-types', permission: 'hr:read' },
          { label: 'Leave Policy', href: '/hr/leave-policy', permission: 'hr:read' },
          { label: 'Leave Application', href: '/hr/leaves', permission: 'hr:read' },
          { label: 'Leave Approval', href: '/hr/leave-approval', permission: 'hr:leave-approve' },
          { label: 'Leave Balance', href: '/hr/leave-balance', permission: 'hr:read' },
        ],
      },
      {
        label: 'Payroll',
        permission: 'hr:read',
        items: [
          { label: 'Salary Components', href: '/hr/salary-components', permission: 'hr:read' },
          { label: 'Salary Structure', href: '/hr/salary-structure', permission: 'hr:read' },
          { label: 'Payroll Period', href: '/hr/payroll-period', permission: 'hr:read' },
          { label: 'Payroll Run', href: '/hr/payroll', permission: 'hr:read' },
          { label: 'Payroll Adjustment', href: '/hr/payroll-adjustment', permission: 'hr:read' },
          { label: 'Payslips', href: '/hr/payslip', permission: 'hr:read' },
          { label: 'Bonus', href: '/hr/bonus', permission: 'hr:read' },
          { label: 'Loans & Advances', href: '/hr/loans-advances', permission: 'hr:read' },
          { label: 'Final Settlement', href: '/hr/final-settlement', permission: 'hr:read' },
        ],
      },
      {
        label: 'Reports',
        permission: 'hr:read',
        items: [
          { label: 'Employee Reports', href: '/hr/reports/employee', permission: 'hr:read' },
          { label: 'Recruitment Reports', href: '/hr/reports/recruitment', permission: 'hr:read' },
          { label: 'Attendance Reports', href: '/hr/reports/attendance', permission: 'hr:read' },
          { label: 'Leave Reports', href: '/hr/reports/leave', permission: 'hr:read' },
          { label: 'Payroll Reports', href: '/hr/reports/payroll', permission: 'hr:read' },
          { label: 'Employee Lifecycle Reports', href: '/hr/reports/lifecycle', permission: 'hr:read' },
        ],
      },
    ],
  },
  {
    number: 20,
    label: 'Users & Roles',
    href: '/users',
    iconName: 'UserCog',
    permission: 'users:read',
    section: 'Administration',
    items: [
      { label: 'Users', href: '/users', permission: 'users:read' },
      { label: 'Roles', href: '/roles', permission: 'roles:read' },
    ],
  },
  {
    number: 21,
    label: 'Audit Log',
    href: '/audit',
    iconName: 'History',
    permission: 'audit:read',
    section: 'Administration',
  },
  {
    number: 22,
    label: 'Notifications',
    href: '/notifications',
    iconName: 'Bell',
    permission: 'notifications:read',
    section: 'Administration',
  },
  {
    number: 23,
    label: 'Branches',
    href: '/branches',
    iconName: 'Network',
    permission: 'branches:read',
    section: 'Administration',
  },
  {
    number: 24,
    label: 'Approvals',
    href: '/approvals',
    iconName: 'FileCheck2',
    permission: 'approvals:read',
    section: 'Administration',
    items: [
      { label: 'Queue', href: '/approvals', permission: 'approvals:read' },
      { label: 'Rules', href: '/approvals/rules', permission: 'approvals:read' },
    ],
  },
  {
    number: 25,
    label: 'Documents',
    href: '/documents',
    iconName: 'FolderOpen',
    permission: 'documents:read',
    section: 'Administration',
  },
];
