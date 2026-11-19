import { backendFetch } from '@/lib/backend-client';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/shared/data-table';
import { formatCurrency } from '@/lib/money';
import { defaultRange, RangeFilter } from '../_components/range-filter';
import { PurchaseExportButton } from './purchase-export-button';
import { Truck, Receipt, CheckCircle2, AlertCircle, Building2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Procurement & Purchase Report | Annex Leather' };

interface PurchaseSummaryDto {
  poCount: number;
  poTotal: string;
  invoiceCount: number;
  invoiceTotal: string;
  invoicePaid: string;
  invoiceOutstanding: string;
  openPayable: string;
  byDepartment: { department: string; count: number; total: string }[];
}

interface Branch {
  id: string;
  name: string;
  code: string;
}

function safeDate(val: string | undefined, fallback: string): string {
  if (!val) return fallback;
  const d = new Date(val);
  return isNaN(d.getTime()) ? fallback : val;
}

export default async function PurchaseReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; branchId?: string }>;
}) {
  const sp = await searchParams;
  const range = defaultRange();
  const from = safeDate(sp.from, range.from);
  const to = safeDate(sp.to, range.to);

  const qs = new URLSearchParams({
    from: new Date(from).toISOString(),
    to: new Date(`${to}T23:59:59.999Z`).toISOString(),
  });
  if (sp.branchId && sp.branchId !== 'ALL') qs.set('branchId', sp.branchId);

  const [data, branches] = await Promise.all([
    backendFetch<PurchaseSummaryDto>(
      `/api/mobile/reports/general/purchase-summary?${qs.toString()}`,
    ).catch(
      () =>
        ({
          poCount: 0,
          poTotal: '0',
          invoiceCount: 0,
          invoiceTotal: '0',
          invoicePaid: '0',
          invoiceOutstanding: '0',
          openPayable: '0',
          byDepartment: [],
        }) as PurchaseSummaryDto,
    ),
    backendFetch<Branch[]>('/api/mobile/branches').catch(() => []),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <PageHeader
          title="Procurement & Supplier Payables"
          description={`PO volumes, vendor invoicing, and disbursement: ${from} → ${to}`}
        />
        <div className="flex items-center gap-2">
          <PurchaseExportButton summary={data} from={from} to={to} />
        </div>
      </div>

      <RangeFilter
        from={from}
        to={to}
        branchId={sp.branchId}
        branches={branches.map((b) => ({ id: b.id, code: b.code, name: b.name }))}
        baseHref="/reports/purchase"
      />

      {/* KPI Performance Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="p-4 shadow-sm border">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Purchase Orders
          </p>
          <p className="text-2xl font-bold mt-1 text-foreground">{data.poCount}</p>
          <p className="text-xs text-muted-foreground mt-0.5">POs issued</p>
        </Card>

        <Card className="p-4 shadow-sm border">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Total PO Value
          </p>
          <p className="text-2xl font-bold mt-1 text-primary">
            {formatCurrency(data.poTotal, 'BDT')}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Committed order value</p>
        </Card>

        <Card className="p-4 shadow-sm border">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Supplier Invoices
          </p>
          <p className="text-2xl font-bold mt-1 text-foreground">{data.invoiceCount}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Bills received</p>
        </Card>

        <Card className="p-4 shadow-sm border">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Invoiced Value
          </p>
          <p className="text-2xl font-bold mt-1 text-foreground">
            {formatCurrency(data.invoiceTotal, 'BDT')}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Total billed amount</p>
        </Card>

        <Card className="p-4 shadow-sm border">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Paid to Suppliers
          </p>
          <p className="text-2xl font-bold mt-1 text-emerald-600">
            {formatCurrency(data.invoicePaid, 'BDT')}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Settled disbursements</p>
        </Card>

        <Card className="p-4 shadow-sm border">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Open Payables
          </p>
          <p className="text-2xl font-bold mt-1 text-red-600">
            {formatCurrency(data.openPayable, 'BDT')}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Pending vendor liabilities</p>
        </Card>
      </div>

      {/* Department Breakdown */}
      <Card className="p-0 overflow-hidden shadow-sm border">
        <div className="px-5 py-3.5 border-b text-sm font-medium flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <span className="font-semibold">Procurement Distribution by Department</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {data.byDepartment.length} Department{data.byDepartment.length === 1 ? '' : 's'}
          </span>
        </div>
        <DataTable
          rows={data.byDepartment}
          rowKey={(r) => r.department}
          empty="No departmental purchase orders found in this date range."
          columns={[
            {
              key: 'department',
              header: 'Department / Unit',
              cell: (r) => <span className="font-semibold text-xs">{r.department}</span>,
            },
            {
              key: 'count',
              header: 'PO Count',
              align: 'right',
              cell: (r) => <span className="tabular text-xs">{r.count}</span>,
            },
            {
              key: 'total',
              header: 'Total Spend (BDT)',
              align: 'right',
              cell: (r) => (
                <span className="tabular text-xs font-semibold text-primary">
                  {formatCurrency(r.total, 'BDT')}
                </span>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
