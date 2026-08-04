import { prisma } from '@/server/db';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';
import { PayrollAdjustmentService } from '@/server/services/payroll-adjustment.service';
import { PayrollAdjustmentForm } from './adjustment-form';
import { Prisma } from '@prisma/client';
import { getSession } from '@/server/auth/session';

export default async function PayrollAdjustmentPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const session = await getSession();

  const stats = await PayrollAdjustmentService.getDashboardStats(session);

  const where: Prisma.PayrollAdjustmentWhereInput = {};
  if (sp.status) where.status = sp.status as any;
  if (sp.type) where.type = sp.type as any;
  if (sp.q) {
    where.OR = [
      { employee: { firstName: { contains: sp.q as string, mode: 'insensitive' } } },
      { employee: { code: { contains: sp.q as string, mode: 'insensitive' } } },
      { no: { contains: sp.q as string, mode: 'insensitive' } },
    ];
  }

  const adjustments = await PayrollAdjustmentService.getAdjustments(session, where);

  const isEditing = sp.edit;
  let initial = null;
  if (isEditing && isEditing !== 'new') {
    initial = await PayrollAdjustmentService.getAdjustmentById(session, isEditing as string);
  }

  const employees = await prisma.employee.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, firstName: true, lastName: true, code: true },
    orderBy: [{ firstName: 'asc' }],
  });

  const payrollPeriods = await prisma.payrollPeriod.findMany({
    where: { status: { in: ['OPEN'] } },
    orderBy: [{ startDate: 'desc' }],
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll Adjustment"
        description="Manual corrections and one-time adjustments for payroll."
        breadcrumbs={[
          { label: 'HR', href: '/hr' },
          { label: 'Payroll', href: '/hr/payroll' },
          { label: 'Adjustment', href: '/hr/payroll-adjustment' },
        ]}
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Adjustments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Approved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{stats.approved}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Rejected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Current Month Appr.</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.currentMonthAmount)}</div>
          </CardContent>
        </Card>
      </div>

      {!isEditing ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Adjustments List</CardTitle>
            <Button asChild size="sm">
              <Link href="/hr/payroll-adjustment?edit=new">+ Create Adjustment</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="flex gap-4 items-end bg-slate-50 dark:bg-slate-900/40 p-4 rounded-md border">
              <div className="space-y-1 flex-1">
                <label className="text-xs font-medium text-muted-foreground">Search</label>
                <Input name="q" placeholder="Employee or No..." defaultValue={sp.q as string} />
              </div>
              <div className="space-y-1 flex-1">
                <label className="text-xs font-medium text-muted-foreground">Type</label>
                <Select name="type" defaultValue={sp.type as string}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALLOWANCE">Allowance</SelectItem>
                    <SelectItem value="DEDUCTION">Deduction</SelectItem>
                    <SelectItem value="ATTENDANCE_ADJUSTMENT">Attendance</SelectItem>
                    <SelectItem value="OVERTIME_ADJUSTMENT">Overtime</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 flex-1">
                <label className="text-xs font-medium text-muted-foreground">Status</label>
                <Select name="status" defaultValue={sp.status as string}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="SUBMITTED">Submitted</SelectItem>
                    <SelectItem value="PENDING_HR">Pending HR</SelectItem>
                    <SelectItem value="APPROVED">Approved</SelectItem>
                    <SelectItem value="APPLIED">Applied</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button type="submit">Filter</Button>
                <Button type="button" variant="outline" asChild>
                  <Link href="/hr/payroll-adjustment">Reset</Link>
                </Button>
              </div>
            </form>

            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium">Adj No</th>
                    <th className="px-4 py-3 text-left font-medium">Employee</th>
                    <th className="px-4 py-3 text-left font-medium">Payroll Month</th>
                    <th className="px-4 py-3 text-left font-medium">Type</th>
                    <th className="px-4 py-3 text-right font-medium">Amount</th>
                    <th className="px-4 py-3 text-center font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {adjustments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                        No adjustments found.
                      </td>
                    </tr>
                  ) : (
                    adjustments.map((row) => (
                      <tr key={row.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                        <td className="px-4 py-3 font-medium">{row.no}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{row.employee.firstName} {row.employee.lastName}</div>
                          <div className="text-xs text-muted-foreground">{row.employee.code}</div>
                        </td>
                        <td className="px-4 py-3">{row.payrollPeriod.name}</td>
                        <td className="px-4 py-3">{row.type.replace('_', ' ')}</td>
                        <td className={`px-4 py-3 text-right font-medium ${
                          ['DEDUCTION', 'LOAN_ADJUSTMENT', 'ADVANCE_ADJUSTMENT'].includes(row.type) ? 'text-red-600' : 'text-emerald-600'
                        }`}>
                          {['DEDUCTION', 'LOAN_ADJUSTMENT', 'ADVANCE_ADJUSTMENT'].includes(row.type) ? '-' : '+'}
                          {formatCurrency(Number(row.amount))}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold
                            ${row.status === 'APPROVED' || row.status === 'APPLIED' ? 'bg-emerald-100 text-emerald-800' : ''}
                            ${row.status === 'DRAFT' || row.status === 'SUBMITTED' ? 'bg-slate-100 text-slate-800' : ''}
                            ${row.status === 'PENDING_HR' || row.status === 'PENDING_MANAGEMENT' ? 'bg-amber-100 text-amber-800' : ''}
                            ${row.status === 'REJECTED' ? 'bg-red-100 text-red-800' : ''}
                          `}>
                            {row.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {['DRAFT', 'SUBMITTED'].includes(row.status) ? (
                            <Button type="button" size="sm" variant="outline" asChild>
                              <Link href={`/hr/payroll-adjustment?edit=${row.id}`}>Edit</Link>
                            </Button>
                          ) : (
                            <Button type="button" size="sm" variant="ghost" asChild>
                              <Link href={`/hr/payroll-adjustment/${row.id}`}>View</Link>
                            </Button>
                          )}
                          <Button type="button" size="sm" variant="ghost" className="ml-2" asChild>
                            <Link href={`/hr/payroll-adjustment/${row.id}`}>Review</Link>
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
        <PayrollAdjustmentForm
          mode={sp.edit === 'new' ? 'create' : 'edit'}
          initialData={sp.edit === 'new' ? null : initial}
          employees={employees}
          payrollPeriods={payrollPeriods}
          path="/hr/payroll-adjustment"
        />
      )}
    </div>
  );
}
