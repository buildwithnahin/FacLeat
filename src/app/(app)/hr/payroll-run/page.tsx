import { prisma } from '@/server/db';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';
import { PayrollRunService } from '@/server/services/payroll-run.service';
import { CalculatePayrollForm } from './calculate-form';
import { Prisma } from '@prisma/client';
import { getSession } from '@/server/auth/session';

export default async function PayrollRunPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const session = await getSession();

  const stats = await PayrollRunService.getDashboardStats(session);

  const where: Prisma.PayrollRunWhereInput = {};
  if (sp.status) where.status = sp.status as any;
  if (sp.q) {
    where.OR = [
      { period: { contains: sp.q as string, mode: 'insensitive' } },
      { branch: { name: { contains: sp.q as string, mode: 'insensitive' } } },
    ];
  }

  const runs = await PayrollRunService.getPayrollRuns(session, where);
  
  const isEditing = sp.edit === 'new';

  const branches = await prisma.branch.findMany({
    orderBy: { name: 'asc' },
  });

  const payrollPeriods = await prisma.payrollPeriod.findMany({
    where: { status: { in: ['OPEN'] } },
    orderBy: [{ startDate: 'desc' }],
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll Run"
        description="Calculate, validate, and approve monthly payroll."
        breadcrumbs={[
          { label: 'HR', href: '/hr' },
          { label: 'Payroll', href: '/hr/payroll' },
          { label: 'Payroll Run', href: '/hr/payroll-run' },
        ]}
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Payroll Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.month}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Employees</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.employees}</div>
            <p className="text-xs text-muted-foreground mt-1">Completed: {stats.completed} | Pending: {stats.pending}</p>
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Payroll ({stats.month})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{formatCurrency(stats.totalPayroll)}</div>
          </CardContent>
        </Card>
      </div>

      {!isEditing ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Payroll History</CardTitle>
            <Button asChild size="sm">
              <Link href="/hr/payroll-run?edit=new">Calculate Payroll</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="flex gap-4 items-end bg-slate-50 dark:bg-slate-900/40 p-4 rounded-md border">
              <div className="space-y-1 flex-1">
                <label className="text-xs font-medium text-muted-foreground">Search</label>
                <Input name="q" placeholder="Period or Branch..." defaultValue={sp.q as string} />
              </div>
              <div className="space-y-1 flex-1">
                <label className="text-xs font-medium text-muted-foreground">Status</label>
                <Select name="status" defaultValue={sp.status as string}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CALCULATED">Calculated</SelectItem>
                    <SelectItem value="PENDING_HR">Pending HR</SelectItem>
                    <SelectItem value="APPROVED">Approved</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button type="submit">Filter</Button>
                <Button type="button" variant="outline" asChild>
                  <Link href="/hr/payroll-run">Reset</Link>
                </Button>
              </div>
            </form>

            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium">Payroll Month</th>
                    <th className="px-4 py-3 text-left font-medium">Branch</th>
                    <th className="px-4 py-3 text-center font-medium">Employees</th>
                    <th className="px-4 py-3 text-right font-medium">Gross Salary</th>
                    <th className="px-4 py-3 text-right font-medium">Net Salary</th>
                    <th className="px-4 py-3 text-center font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                        No payroll runs found.
                      </td>
                    </tr>
                  ) : (
                    runs.map((row) => (
                      <tr key={row.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                        <td className="px-4 py-3 font-medium">{row.payrollPeriod?.name || row.period}</td>
                        <td className="px-4 py-3">{row.branch.name}</td>
                        <td className="px-4 py-3 text-center">{row.totalEmployees}</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(Number(row.totalGross))}</td>
                        <td className="px-4 py-3 text-right font-semibold text-emerald-600">{formatCurrency(Number(row.totalNet))}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold
                            ${row.status === 'COMPLETED' || row.status === 'CLOSED' || row.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : ''}
                            ${row.status === 'CALCULATED' ? 'bg-blue-100 text-blue-800' : ''}
                            ${row.status === 'PENDING_HR' || row.status === 'PENDING_FINANCE' || row.status === 'PENDING_MANAGEMENT' ? 'bg-amber-100 text-amber-800' : ''}
                            ${row.status === 'CANCELLED' ? 'bg-red-100 text-red-800' : ''}
                          `}>
                            {row.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button type="button" size="sm" variant="ghost" asChild>
                            <Link href={`/hr/payroll-run/${row.id}`}>View Details</Link>
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
      ) : (
        <CalculatePayrollForm
          branches={branches}
          payrollPeriods={payrollPeriods}
        />
      )}
    </div>
  );
}
