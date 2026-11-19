import Link from 'next/link';
import { backendFetch } from '@/lib/backend-client';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/money';
import { Users, CalendarCheck, FileText, ArrowRight, Banknote, ShieldAlert } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'HR & Workforce Report | Annex Leather' };

interface HrSummaryDto {
  headcount: { active: number; onLeave: number; terminated: number };
  lastPayroll: {
    id: string;
    period: string;
    branch: string;
    status: string;
    gross: string;
    deduction: string;
    net: string;
  } | null;
}

interface Branch {
  id: string;
  name: string;
  code: string;
}

export default async function HrReportPage({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string }>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams(
    sp.branchId && sp.branchId !== 'ALL' ? { branchId: sp.branchId } : {},
  );
  const [data, branches] = await Promise.all([
    backendFetch<HrSummaryDto>(`/api/mobile/reports/general/hr-summary?${qs.toString()}`).catch(
      () =>
        ({
          headcount: { active: 0, onLeave: 0, terminated: 0 },
          lastPayroll: null,
        }) as HrSummaryDto,
    ),
    backendFetch<Branch[]>('/api/mobile/branches').catch(() => []),
  ]);

  const totalHeadcount =
    data.headcount.active + data.headcount.onLeave + data.headcount.terminated;
  const activeRate =
    totalHeadcount > 0 ? ((data.headcount.active / totalHeadcount) * 100).toFixed(0) : '100';

  const isFiltered = Boolean(sp.branchId && sp.branchId !== 'ALL');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <PageHeader
          title="HR & Workforce Analytics"
          description="Enterprise headcount distribution, latest payroll reconciliation, and HR registers."
        />
        <form className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground whitespace-nowrap">Branch:</label>
          <select
            name="branchId"
            defaultValue={sp.branchId ?? ''}
            className="flex h-9 rounded-md border border-input bg-background px-3 text-xs shadow-sm"
          >
            <option value="">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.code} · {b.name}
              </option>
            ))}
          </select>
          <Button size="sm" type="submit" className="h-9 text-xs">
            Apply
          </Button>
          {isFiltered && (
            <Button variant="ghost" size="sm" asChild className="h-9 text-xs">
              <Link href="/reports/hr">Reset</Link>
            </Button>
          )}
        </form>
      </div>

      {/* Headcount Performance Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 shadow-sm border">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Active Workforce
          </p>
          <p className="text-2xl font-bold mt-1 text-emerald-600">{data.headcount.active}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {activeRate}% of total employee records
          </p>
        </Card>

        <Card className="p-4 shadow-sm border">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            On Approved Leave
          </p>
          <p className="text-2xl font-bold mt-1 text-amber-600">{data.headcount.onLeave}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Authorized leave of absence</p>
        </Card>

        <Card className="p-4 shadow-sm border">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Separated / Terminated
          </p>
          <p className="text-2xl font-bold mt-1 text-neutral-500">{data.headcount.terminated}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Archived or resigned</p>
        </Card>

        <Card className="p-4 shadow-sm border">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Total Database Records
          </p>
          <p className="text-2xl font-bold mt-1 text-foreground">{totalHeadcount}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Cumulative staff files</p>
        </Card>
      </div>

      {/* Last Payroll Run Card */}
      <Card className="overflow-hidden shadow-sm border">
        <div className="px-5 py-3.5 border-b flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2">
            <Banknote className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">Latest Payroll Run Reconciliation</span>
          </div>
          {data.lastPayroll && (
            <Badge variant="success" className="text-xs">
              {data.lastPayroll.status}
            </Badge>
          )}
        </div>
        <CardContent className="p-6">
          {data.lastPayroll ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                  Payroll Period
                </span>
                <p className="mt-1 font-bold">
                  <Link
                    href={`/hr/payroll/${data.lastPayroll.id}`}
                    className="text-primary hover:underline"
                  >
                    {data.lastPayroll.period}
                  </Link>
                </p>
              </div>

              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                  Operating Branch
                </span>
                <p className="mt-1 font-medium">{data.lastPayroll.branch}</p>
              </div>

              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                  Gross Earnings
                </span>
                <p className="mt-1 font-mono font-semibold">
                  {formatCurrency(data.lastPayroll.gross, 'BDT')}
                </p>
              </div>

              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                  Deductions (Tax/PF)
                </span>
                <p className="mt-1 font-mono text-red-600 font-semibold">
                  −{formatCurrency(data.lastPayroll.deduction, 'BDT')}
                </p>
              </div>

              <div className="col-span-2 md:col-span-4 border-t pt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-muted/20 p-4 rounded-lg">
                <div>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">
                    Net Bank Disbursement
                  </span>
                  <p className="text-2xl font-black text-primary font-mono mt-0.5">
                    {formatCurrency(data.lastPayroll.net, 'BDT')}
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs">
                  <Link href={`/hr/payroll/${data.lastPayroll.id}`}>
                    <span>View Payroll Journal</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-muted-foreground">
              <ShieldAlert className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="font-medium text-foreground">No approved payroll runs found</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Run and approve monthly payroll in the HR module to view disbursement analytics.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Direct Deep-Links to HR Report Registers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/hr/reports/attendance" className="group">
          <Card className="p-5 hover:border-primary/50 transition-all shadow-sm border h-full flex flex-col justify-between">
            <div className="space-y-2">
              <div className="h-8 w-8 rounded-md bg-blue-500/10 flex items-center justify-center text-blue-600 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <CalendarCheck className="h-4 w-4" />
              </div>
              <h4 className="font-semibold text-sm group-hover:text-primary transition-colors flex items-center justify-between">
                <span>Attendance & Shifts</span>
                <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Biometric punch logs, shift late entries, overtime hours, and absence summaries.
              </p>
            </div>
          </Card>
        </Link>

        <Link href="/hr/reports/employee" className="group">
          <Card className="p-5 hover:border-primary/50 transition-all shadow-sm border h-full flex flex-col justify-between">
            <div className="space-y-2">
              <div className="h-8 w-8 rounded-md bg-emerald-500/10 flex items-center justify-center text-emerald-600 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <Users className="h-4 w-4" />
              </div>
              <h4 className="font-semibold text-sm group-hover:text-primary transition-colors flex items-center justify-between">
                <span>Workforce Roster</span>
                <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Departmental employee lists, designations, tenure analysis, and salary structures.
              </p>
            </div>
          </Card>
        </Link>

        <Link href="/hr/reports/payroll" className="group">
          <Card className="p-5 hover:border-primary/50 transition-all shadow-sm border h-full flex flex-col justify-between">
            <div className="space-y-2">
              <div className="h-8 w-8 rounded-md bg-amber-500/10 flex items-center justify-center text-amber-600 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <FileText className="h-4 w-4" />
              </div>
              <h4 className="font-semibold text-sm group-hover:text-primary transition-colors flex items-center justify-between">
                <span>Payroll Registers</span>
                <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Salary sheet breakdowns, allowances, tax deductions, bonuses, and loan repayments.
              </p>
            </div>
          </Card>
        </Link>
      </div>
    </div>
  );
}
