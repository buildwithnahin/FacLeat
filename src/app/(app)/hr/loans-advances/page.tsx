import Link from 'next/link';
import { getSession } from '@/server/auth/session';
import { prisma } from '@/server/db';
import { LoansService } from '@/server/services/loans.service';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoanForm } from './loan-form';
import { formatCurrency } from '@/lib/utils';
import { LoanStatus, LoanType } from '@prisma/client';

export const metadata = { title: 'Loans & Advances' };

type SearchParams = Promise<{ q?: string; type?: string; status?: string; edit?: string }>;

function serializeEmployee(employee: {
  id: string;
  firstName: string;
  lastName: string;
  code: string;
  basicSalary: number | { toString(): string } | null;
}) {
  return {
    ...employee,
    basicSalary: employee.basicSalary ? Number(employee.basicSalary) : 0,
  };
}

function serializeLoanForForm(initial: Awaited<ReturnType<typeof LoansService.getLoanById>>) {
  if (!initial) return null;

  return {
    ...initial,
    loanAmount: Number(initial.loanAmount),
    monthlyDeduction: Number(initial.monthlyDeduction),
    outstandingBalance: Number(initial.outstandingBalance),
    disbursementDate: initial.disbursementDate.toISOString(),
    createdAt: initial.createdAt.toISOString(),
    updatedAt: initial.updatedAt.toISOString(),
    employee: initial.employee
      ? {
          ...initial.employee,
          basicSalary: initial.employee.basicSalary ? Number(initial.employee.basicSalary) : 0,
          houseAllowance: initial.employee.houseAllowance ? Number(initial.employee.houseAllowance) : 0,
          joinedAt: initial.employee.joinedAt?.toISOString() ?? null,
        }
      : null,
    repaymentSchedules: initial.repaymentSchedules.map((schedule) => ({
      ...schedule,
      installment: Number(schedule.installment),
      remainingBalance: Number(schedule.remainingBalance),
      createdAt: schedule.createdAt.toISOString(),
      updatedAt: schedule.updatedAt.toISOString(),
    })),
  };
}

export default async function LoansPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getSession();
  const sp = await searchParams;
  const canWrite = session?.permissions.includes('hr:write') ?? false;
  const q = sp.q ?? '';
  const type = sp.type ?? '';
  const status = sp.status ?? '';

  const [loans, stats, employees] = await Promise.all([
    LoansService.getLoans({ search: q, type, status }),
    LoansService.getDashboardStats(),
    prisma.employee.findMany({
      where: { status: { in: ['ACTIVE'] } },
      select: { id: true, firstName: true, lastName: true, code: true, basicSalary: true },
      orderBy: [{ firstName: 'asc' }],
    }),
  ]);

  const initialId = sp.edit && sp.edit !== 'new' ? sp.edit : null;
  const initial = initialId ? await LoansService.getLoanById(initialId).catch(() => null) : null;
  const serializedEmployees = employees.map(serializeEmployee);
  const serializedInitial = serializeLoanForForm(initial);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Loans & Advances"
        description="Manage employee loans and salary advances integrated with payroll."
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.pendingRequests}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Loans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{stats.activeLoans}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Salary Advances</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.salaryAdvances}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Deduction</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.monthlyDeduction, 'BDT')}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-700">{formatCurrency(stats.outstandingBalance, 'BDT')}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Requests List</CardTitle>
          {canWrite && !sp.edit && (
            <Button asChild size="sm">
              <Link href="/hr/loans-advances?edit=new">
                + New Request
              </Link>
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Search</label>
              <Input name="q" defaultValue={q} placeholder="Search by reference or employee..." />
            </div>
            <div className="w-40 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Request Type</label>
              <Select name="type" defaultValue={type}>
                <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
                  <SelectItem value="EMPLOYEE_LOAN">Employee Loan</SelectItem>
                  <SelectItem value="SALARY_ADVANCE">Salary Advance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-40 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <Select name="status" defaultValue={status}>
                <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
                  {Object.keys(LoanStatus).map(s => (
                    <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button type="submit">Filter</Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/hr/loans-advances">Reset</Link>
              </Button>
            </div>
          </form>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-muted-foreground dark:bg-slate-900/60">
                <tr>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                  <th className="px-4 py-3 text-right">Installment</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loans.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                      No loan requests found.
                    </td>
                  </tr>
                ) : (
                  loans.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3 font-mono text-xs font-semibold">{row.referenceNo}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold">{row.employee.firstName} {row.employee.lastName}</div>
                        <div className="text-xs text-muted-foreground">{row.employee.code}</div>
                      </td>
                      <td className="px-4 py-3">
                        {row.requestType === 'EMPLOYEE_LOAN' ? 'Employee Loan' : 'Salary Advance'}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{formatCurrency(row.loanAmount.toNumber(), 'BDT')}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{formatCurrency(row.outstandingBalance.toNumber(), 'BDT')}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{formatCurrency(row.monthlyDeduction.toNumber(), 'BDT')}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge 
                          variant={row.status === 'ACTIVE' ? 'default' : row.status === 'COMPLETED' ? 'secondary' : row.status === 'REJECTED' ? 'destructive' : 'outline'}
                          className={row.status === 'ACTIVE' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                        >
                          {row.status.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canWrite && ['DRAFT', 'SUBMITTED'].includes(row.status) ? (
                          <Button type="button" size="sm" variant="outline" asChild>
                            <Link href={`/hr/loans-advances?edit=${row.id}`}>Edit</Link>
                          </Button>
                        ) : (
                          <Button type="button" size="sm" variant="ghost" asChild>
                            <Link href={`/hr/loans-advances/${row.id}`}>View</Link>
                          </Button>
                        )}
                        <Button type="button" size="sm" variant="ghost" className="ml-2" asChild>
                          <Link href={`/hr/loans-advances/${row.id}`}>Review</Link>
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {canWrite && sp.edit ? (
        <LoanForm
          mode={sp.edit === 'new' ? 'create' : 'edit'}
          initial={sp.edit === 'new' ? null : serializedInitial}
          employees={serializedEmployees}
          path="/hr/loans-advances"
        />
      ) : null}
    </div>
  );
}
