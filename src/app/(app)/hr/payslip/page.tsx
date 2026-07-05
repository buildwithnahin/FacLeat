import { prisma } from '@/server/db';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';
import { PayslipService } from '@/server/services/payslip.service';
import { Prisma } from '@prisma/client';

export default async function PayslipsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  
  const stats = await PayslipService.getDashboardStats();

  const where: Prisma.PayslipWhereInput = {};
  if (sp.status) where.status = sp.status as any;
  if (sp.paymentStatus) where.paymentStatus = sp.paymentStatus as any;
  if (sp.q) {
    where.OR = [
      { employee: { firstName: { contains: sp.q as string, mode: 'insensitive' } } },
      { employee: { code: { contains: sp.q as string, mode: 'insensitive' } } },
      { no: { contains: sp.q as string, mode: 'insensitive' } },
    ];
  }

  const payslips = await PayslipService.getPayslips(where);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payslips"
        description="View and manage employee salary slips."
        breadcrumbs={[
          { label: 'HR', href: '/hr' },
          { label: 'Payroll', href: '/hr/payroll' },
          { label: 'Payslips', href: '/hr/payslip' },
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Payslips</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPayslips}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Published: {stats.published} | Pending: {stats.pending}
            </p>
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Net Payroll ({stats.month})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{formatCurrency(stats.totalPayroll)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Payslips</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">Export Excel</Button>
            <Button variant="outline" size="sm">Publish All</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="flex gap-4 items-end bg-slate-50 dark:bg-slate-900/40 p-4 rounded-md border">
            <div className="space-y-1 flex-1">
              <label className="text-xs font-medium text-muted-foreground">Search</label>
              <Input name="q" placeholder="Employee or PS No..." defaultValue={sp.q as string} />
            </div>
            <div className="space-y-1 flex-1">
              <label className="text-xs font-medium text-muted-foreground">Payment Status</label>
              <Select name="paymentStatus" defaultValue={sp.paymentStatus as string}>
                <SelectTrigger>
                  <SelectValue placeholder="Any Payment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="PAID">Paid</SelectItem>
                  <SelectItem value="FAILED">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 flex-1">
              <label className="text-xs font-medium text-muted-foreground">Payslip Status</label>
              <Select name="status" defaultValue={sp.status as string}>
                <SelectTrigger>
                  <SelectValue placeholder="Any Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GENERATED">Generated</SelectItem>
                  <SelectItem value="PUBLISHED">Published</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button type="submit">Filter</Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/hr/payslip">Reset</Link>
              </Button>
            </div>
          </form>

          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Payslip No</th>
                  <th className="px-4 py-3 text-left font-medium">Employee</th>
                  <th className="px-4 py-3 text-left font-medium">Payroll Month</th>
                  <th className="px-4 py-3 text-right font-medium">Gross</th>
                  <th className="px-4 py-3 text-right font-medium">Net Salary</th>
                  <th className="px-4 py-3 text-center font-medium">Payment</th>
                  <th className="px-4 py-3 text-center font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {payslips.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                      No payslips found.
                    </td>
                  </tr>
                ) : (
                  payslips.map((row) => (
                    <tr key={row.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3 font-medium">{row.no || `PS-${row.id.substring(0, 6)}`}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{row.employee.firstName} {row.employee.lastName}</div>
                        <div className="text-xs text-muted-foreground">{row.employee.code} | {row.employee.designation || 'Staff'}</div>
                      </td>
                      <td className="px-4 py-3">{row.payrollRun.payrollPeriod?.name || row.payrollRun.period}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(Number(row.gross))}</td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-600">{formatCurrency(Number(row.net))}</td>
                      
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold
                          ${row.paymentStatus === 'PAID' ? 'bg-emerald-100 text-emerald-800' : ''}
                          ${row.paymentStatus === 'PENDING' ? 'bg-amber-100 text-amber-800' : ''}
                          ${row.paymentStatus === 'FAILED' ? 'bg-red-100 text-red-800' : ''}
                        `}>
                          {row.paymentStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold
                          ${row.status === 'PUBLISHED' ? 'bg-blue-100 text-blue-800' : ''}
                          ${row.status === 'GENERATED' ? 'bg-slate-100 text-slate-800' : ''}
                          ${row.status === 'CANCELLED' ? 'bg-red-100 text-red-800' : ''}
                        `}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button type="button" size="sm" variant="ghost" asChild>
                          <Link href={`/hr/payslip/${row.id}`}>View</Link>
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
    </div>
  );
}
