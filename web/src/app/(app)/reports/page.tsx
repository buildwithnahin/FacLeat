import Link from 'next/link';
import {
  BarChart3,
  ShoppingCart,
  Truck,
  Package,
  UsersRound,
  Banknote,
  Scale,
  TrendingUp,
  Factory,
  ArrowDownUp,
  ArrowRight,
  DollarSign,
  AlertTriangle,
  Boxes,
  FileSpreadsheet,
  CheckCircle2,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { backendFetch } from '@/lib/backend-client';
import { formatCurrency } from '@/lib/money';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Reports & Analytics Hub | Annex Leather' };

interface DashboardKpiDto {
  salesGross: string;
  salesCount: number;
  salesOutstanding: string;
  purchaseTotal: string;
  purchaseOutstanding: string;
  inventoryValue: string;
  pendingApprovals: number;
  lowStockProducts: number;
  activeProducts: number;
}

interface Branch {
  id: string;
  name: string;
  code: string;
}

const REPORT_SECTIONS = [
  {
    category: 'Sales & Distribution Intelligence',
    description: 'Cross-channel revenue performance, order velocity, and sales channels analysis.',
    items: [
      {
        title: 'Sales Summary',
        subtitle: 'Omnichannel revenue: Retail POS, Wholesale, Corporate, E-commerce, Export',
        href: '/reports/sales',
        icon: ShoppingCart,
        badge: 'Core Revenue',
      },
      {
        title: 'Top Selling Products',
        subtitle: 'Product volume rankings, SKU sales velocity, and unit realization',
        href: '/reports/top-products',
        icon: BarChart3,
        badge: 'Merchandising',
      },
      {
        title: 'Cash Flow Statement',
        subtitle: 'Operational cash inflows from sales vs outflow disbursements',
        href: '/accounts/cash-flow',
        icon: ArrowDownUp,
        badge: 'Liquidity',
      },
    ],
  },
  {
    category: 'Supply Chain, Factory & Inventory',
    description: 'Material procurement, factory production yield, and warehouse valuation.',
    items: [
      {
        title: 'Inventory Valuation',
        subtitle: 'On-hand quantity × unit cost across raw materials, WIP, and finished goods',
        href: '/reports/inventory',
        icon: Package,
        badge: 'Assets',
      },
      {
        title: 'Production Yield & Scrap',
        subtitle: 'Planned vs actual factory output, conversion variance, and scrap cost',
        href: '/reports/production',
        icon: Factory,
        badge: 'Manufacturing',
      },
      {
        title: 'Procurement & Payables',
        subtitle: 'Purchase orders, supplier invoices, payments, and open payables',
        href: '/reports/purchase',
        icon: Truck,
        badge: 'Procurement',
      },
    ],
  },
  {
    category: 'Financial Statements & Accounting',
    description: 'Audit-ready financial statements, general ledger verification, and accounting equation balances.',
    items: [
      {
        title: 'Income Statement (P&L)',
        subtitle: 'Revenues, cost of goods sold (COGS), operating expenses, and net profit',
        href: '/accounts/income-statement',
        icon: TrendingUp,
        badge: 'Profitability',
      },
      {
        title: 'Balance Sheet',
        subtitle: 'Assets, liabilities, and owner equity financial position',
        href: '/accounts/balance-sheet',
        icon: Scale,
        badge: 'Balance Sheet',
      },
      {
        title: 'Trial Balance',
        subtitle: 'General ledger account balances with debit and credit reconciliation',
        href: '/accounts/trial-balance',
        icon: Banknote,
        badge: 'GL Verification',
      },
      {
        title: 'Fixed Asset Register',
        subtitle: 'Asset register, book values, depreciation, and physical audit tags',
        href: '/assets',
        icon: Boxes,
        badge: 'Fixed Assets',
      },
    ],
  },
  {
    category: 'Human Resources & Workforce',
    description: 'Headcount metrics, payroll disbursements, attendance, and employee lifecycle.',
    items: [
      {
        title: 'HR & Payroll Summary',
        subtitle: 'Headcount distribution, active staff, and latest monthly payroll run',
        href: '/reports/hr',
        icon: UsersRound,
        badge: 'Executive HR',
      },
      {
        title: 'Attendance Reports',
        subtitle: 'Daily attendance logs, shift punctuality, late arrivals, and early departures',
        href: '/hr/reports/attendance',
        icon: CheckCircle2,
        badge: 'Operations',
      },
      {
        title: 'Employee Reports',
        subtitle: 'Department staffing, designations, joining cohorts, and salary grades',
        href: '/hr/reports/employee',
        icon: FileSpreadsheet,
        badge: 'Workforce',
      },
    ],
  },
];

export default async function ReportsHubPage({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string }>;
}) {
  const sp = await searchParams;
  const branchParam = sp.branchId && sp.branchId !== 'ALL' ? `?branchId=${sp.branchId}` : '';

  const [kpis, branches] = await Promise.all([
    backendFetch<DashboardKpiDto>(`/api/mobile/reports/general/dashboard-kpis${branchParam}`).catch(
      () => ({
        salesGross: '0',
        salesCount: 0,
        salesOutstanding: '0',
        purchaseTotal: '0',
        purchaseOutstanding: '0',
        inventoryValue: '0',
        pendingApprovals: 0,
        lowStockProducts: 0,
        activeProducts: 0,
      }),
    ),
    backendFetch<Branch[]>('/api/mobile/branches').catch(() => []),
  ]);

  return (
    <div className="space-y-8">
      {/* Page Header with Branch Filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <PageHeader
          title="Reports & Analytics Hub"
          description="Executive business intelligence, financial statements, and cross-module operational audits."
        />
        <form className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground whitespace-nowrap">Branch Scope:</label>
          <select
            name="branchId"
            defaultValue={sp.branchId ?? ''}
            className="flex h-9 rounded-md border border-input bg-background px-3 text-xs shadow-sm"
          >
            <option value="">All Branches (Enterprise)</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.code} · {b.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="h-9 px-3 text-xs bg-primary text-primary-foreground rounded-md shadow-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Apply
          </button>
        </form>
      </div>

      {/* Executive KPI Performance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 shadow-sm border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Sales Revenue
            </span>
            <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-bold mt-2 text-foreground">
            {formatCurrency(kpis.salesGross, 'BDT')}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Across {kpis.salesCount} invoices & transactions
          </p>
        </Card>

        <Card className="p-4 shadow-sm border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Active Inventory Value
            </span>
            <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600">
              <Package className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-bold mt-2 text-foreground">
            {formatCurrency(kpis.inventoryValue, 'BDT')}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {kpis.activeProducts} active catalog products
          </p>
        </Card>

        <Card className="p-4 shadow-sm border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Receivables Outstanding
            </span>
            <div className="h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-bold mt-2 text-amber-600">
            {formatCurrency(kpis.salesOutstanding, 'BDT')}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Uncollected dues from wholesale & corporate
          </p>
        </Card>

        <Card className="p-4 shadow-sm border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Supplier Payables Due
            </span>
            <div className="h-8 w-8 rounded-full bg-red-500/10 flex items-center justify-center text-red-600">
              <Truck className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-bold mt-2 text-red-600">
            {formatCurrency(kpis.purchaseOutstanding, 'BDT')}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Open procurement invoices to suppliers
          </p>
        </Card>
      </div>

      {/* Categorized Reports Directory */}
      <div className="space-y-8">
        {REPORT_SECTIONS.map((sec) => (
          <div key={sec.category} className="space-y-3">
            <div className="border-b pb-2">
              <h3 className="font-semibold text-base text-foreground">{sec.category}</h3>
              <p className="text-xs text-muted-foreground">{sec.description}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sec.items.map((r) => {
                const Icon = r.icon;
                return (
                  <Link key={r.href} href={r.href} className="group">
                    <Card className="hover:border-primary/50 hover:shadow-md transition-all h-full flex flex-col justify-between border bg-card">
                      <CardContent className="p-5 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors text-primary">
                            <Icon className="h-5 w-5" />
                          </div>
                          <Badge variant="secondary" className="text-[10px] font-medium">
                            {r.badge}
                          </Badge>
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                            <span>{r.title}</span>
                            <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
                            {r.subtitle}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
