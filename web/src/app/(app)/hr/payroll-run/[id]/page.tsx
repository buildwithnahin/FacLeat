import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import { formatCurrency } from '@/lib/money';
import { ApprovalForm } from './approval-form';

export const dynamic = 'force-dynamic';

interface PayslipRow {
  id: string;
  gross: string;
  net: string;
  payrollAdjustmentsAddition: string;
  employee: { firstName: string; lastName: string; code: string; designation: string | null };
}

interface PayrollRunDetail {
  id: string;
  period: string;
  status: string;
  totalEmployees: number;
  totalGross: string;
  totalDeduction: string;
  totalNet: string;
  totalOT: string;
  totalBonus: string;
  totalLoan: string;
  totalAdvance: string;
  totalTax: string;
  hrApproval: string | null;
  financeApproval: string | null;
  managementApproval: string | null;
  notes: string | null;
  branch: { name: string };
  payrollPeriod: { name: string; status: string } | null;
  payslips: PayslipRow[];
}

export default async function PayrollRunDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let run: PayrollRunDetail;
  try {
    run = await backendFetch<PayrollRunDetail>(`/api/mobile/hr/payroll-run/${id}`);
  } catch (e) {
    if (e instanceof BackendApiError && e.status === 404) notFound();
    throw e;
  }

  const totalAdjustmentsAddition = run.payslips.reduce((sum, p) => sum + Number(p.payrollAdjustmentsAddition), 0);

  return (
    <div className="space-y-6">
      <PageHeader title={`Payroll Run: ${run.payrollPeriod?.name || run.period}`} description={`Branch: ${run.branch.name} | Status: ${run.status}`}>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/hr/payroll-run">Back to List</Link>
          </Button>
          {run.status === 'APPROVED' && (
            <Button asChild>
              <Link href={`/hr/payroll-run/${run.id}/payslips`}>Generate Payslips</Link>
            </Button>
          )}
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Payroll Summary</CardTitle>
              <CardDescription>Overview of the generated payroll figures</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pb-6 border-b border-border mb-6">
                <div>
                  <dt className="text-muted-foreground font-medium mb-1 text-xs">Total Employees</dt>
                  <dd className="font-semibold text-xl">{run.totalEmployees}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground font-medium mb-1 text-xs">Gross Salary</dt>
                  <dd className="font-semibold text-xl">{formatCurrency(run.totalGross)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground font-medium mb-1 text-xs">Total Deductions</dt>
                  <dd className="font-semibold text-xl text-red-600">{formatCurrency(run.totalDeduction)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground font-medium mb-1 text-xs">Net Payroll</dt>
                  <dd className="font-bold text-2xl text-emerald-600">{formatCurrency(run.totalNet)}</dd>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8 text-sm">
                <div>
                  <div className="flex justify-between pb-2 border-b border-border/50">
                    <span className="text-muted-foreground">Total Overtime (OT)</span>
                    <span className="font-medium text-emerald-600">+{formatCurrency(run.totalOT)}</span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between pb-2 border-b border-border/50">
                    <span className="text-muted-foreground">Loan Deductions</span>
                    <span className="font-medium text-red-600">-{formatCurrency(run.totalLoan)}</span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between pb-2 border-b border-border/50">
                    <span className="text-muted-foreground">Total Bonus</span>
                    <span className="font-medium text-emerald-600">+{formatCurrency(run.totalBonus)}</span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between pb-2 border-b border-border/50">
                    <span className="text-muted-foreground">Advance Recovery</span>
                    <span className="font-medium text-red-600">-{formatCurrency(run.totalAdvance)}</span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between pb-2 border-b border-border/50">
                    <span className="text-muted-foreground">Total Adjustments (Additions)</span>
                    <span className="font-medium text-emerald-600">+{formatCurrency(totalAdjustmentsAddition)}</span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between pb-2 border-b border-border/50">
                    <span className="text-muted-foreground">Total Tax Deducted</span>
                    <span className="font-medium text-red-600">-{formatCurrency(run.totalTax)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Employee Breakdown</CardTitle>
              <CardDescription>Individual payslip details generated for {run.totalEmployees} employees</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border max-h-[500px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/90 backdrop-blur z-10">
                    <tr className="border-b">
                      <th className="px-4 py-3 text-left font-medium">Employee</th>
                      <th className="px-4 py-3 text-right font-medium">Gross</th>
                      <th className="px-4 py-3 text-right font-medium">Deductions</th>
                      <th className="px-4 py-3 text-right font-medium">Net Salary</th>
                      <th className="px-4 py-3 text-center font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {run.payslips.map((slip) => (
                      <tr key={slip.id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="px-4 py-3">
                          <div className="font-medium">
                            {slip.employee.firstName} {slip.employee.lastName}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {slip.employee.code} | {slip.employee.designation}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">{formatCurrency(slip.gross)}</td>
                        <td className="px-4 py-3 text-right text-red-600">{formatCurrency(Number(slip.gross) - Number(slip.net))}</td>
                        <td className="px-4 py-3 text-right font-semibold text-emerald-600">{formatCurrency(slip.net)}</td>
                        <td className="px-4 py-3 text-center">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/hr/payroll-run/${run.id}/payslips/${slip.id}`}>Details</Link>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Approval Workflow</CardTitle>
              <CardDescription>Multi-level authorization</CardDescription>
            </CardHeader>
            <CardContent>
              <ApprovalForm run={run} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Approval History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 text-sm">
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="font-medium">HR Approval</span>
                  <span className={run.hrApproval === 'APPROVED' ? 'text-emerald-600 font-semibold' : 'text-muted-foreground'}>
                    {run.hrApproval || 'Pending'}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="font-medium">Finance Approval</span>
                  <span className={run.financeApproval === 'APPROVED' ? 'text-emerald-600 font-semibold' : 'text-muted-foreground'}>
                    {run.financeApproval || 'Pending'}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="font-medium">Management Approval</span>
                  <span className={run.managementApproval === 'APPROVED' ? 'text-emerald-600 font-semibold' : 'text-muted-foreground'}>
                    {run.managementApproval || 'Pending'}
                  </span>
                </div>
                {run.notes && (
                  <div className="pt-2">
                    <span className="font-medium block mb-1">Remarks:</span>
                    <span className="text-muted-foreground bg-muted p-2 rounded-md block text-xs">{run.notes}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
