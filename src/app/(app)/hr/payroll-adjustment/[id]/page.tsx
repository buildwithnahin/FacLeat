import { prisma } from '@/server/db';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatCurrency } from '@/lib/utils';
import { PayrollAdjustmentService } from '@/server/services/payroll-adjustment.service';
import { ApprovalForm } from './approval-form';
import { getSession } from '@/server/auth/session';

export default async function PayrollAdjustmentDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();

  const adjustment = await PayrollAdjustmentService.getAdjustmentById(session, id);
  
  if (!adjustment) {
    notFound();
  }

  const isDeduction = ['DEDUCTION', 'LOAN_ADJUSTMENT', 'ADVANCE_ADJUSTMENT'].includes(adjustment.type);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Adjustment: ${adjustment.no}`}
        description={`Details and approvals for ${adjustment.employee.firstName} ${adjustment.employee.lastName}`}
        breadcrumbs={[
          { label: 'HR', href: '/hr' },
          { label: 'Payroll', href: '/hr/payroll' },
          { label: 'Adjustment', href: '/hr/payroll-adjustment' },
          { label: adjustment.no, href: `/hr/payroll-adjustment/${adjustment.id}` },
        ]}
        action={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/hr/payroll-adjustment">Back to List</Link>
            </Button>
            {['DRAFT', 'SUBMITTED'].includes(adjustment.status) && (
              <Button asChild>
                <Link href={`/hr/payroll-adjustment?edit=${adjustment.id}`}>Edit</Link>
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Adjustment Summary</CardTitle>
              <CardDescription>Overview of the manual correction</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-6 text-sm">
                <div className="col-span-2 sm:col-span-3 pb-4 border-b">
                  <dt className="text-muted-foreground font-medium mb-1">Employee</dt>
                  <dd className="font-semibold text-base">
                    {adjustment.employee.firstName} {adjustment.employee.lastName} ({adjustment.employee.code})
                  </dd>
                </div>

                <div>
                  <dt className="text-muted-foreground font-medium mb-1">Payroll Period</dt>
                  <dd className="font-semibold">{adjustment.payrollPeriod.name}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground font-medium mb-1">Adjustment Type</dt>
                  <dd className="font-semibold">{adjustment.type.replace('_', ' ')}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground font-medium mb-1">Amount</dt>
                  <dd className={`font-bold text-lg ${isDeduction ? 'text-red-600' : 'text-emerald-600'}`}>
                    {isDeduction ? '-' : '+'}{formatCurrency(Number(adjustment.amount))}
                  </dd>
                </div>

                <div>
                  <dt className="text-muted-foreground font-medium mb-1">Status</dt>
                  <dd className="font-semibold">
                    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-primary/10 text-primary">
                      {adjustment.status.replace('_', ' ')}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground font-medium mb-1">Reason</dt>
                  <dd className="font-semibold">{adjustment.reason.replace('_', ' ')}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground font-medium mb-1">Category</dt>
                  <dd className="font-semibold">{adjustment.category.replace('_', ' ')}</dd>
                </div>
              </dl>
              
              {adjustment.description && (
                <div className="mt-6 pt-4 border-t">
                  <dt className="text-muted-foreground font-medium mb-1">Description / Notes</dt>
                  <dd className="text-sm bg-muted/50 p-3 rounded-md">{adjustment.description}</dd>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payroll Impact</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="font-medium text-muted-foreground">Include in Gross Salary</span>
                  <span className="font-semibold">{adjustment.includeInGrossSalary ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="font-medium text-muted-foreground">Include in Tax Calculation</span>
                  <span className="font-semibold">{adjustment.includeInTax ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="font-medium text-muted-foreground">Show separately in Payslip</span>
                  <span className="font-semibold">{adjustment.includeInPayslip ? 'Yes' : 'No'}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Approval Actions</CardTitle>
              <CardDescription>Review and process</CardDescription>
            </CardHeader>
            <CardContent>
              <ApprovalForm adjustment={adjustment} />
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
                  <span className={adjustment.hrDecision === 'APPROVED' ? 'text-emerald-600' : 'text-muted-foreground'}>
                    {adjustment.hrDecision || 'Pending'}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="font-medium">Management Decision</span>
                  <span className={adjustment.managementDecision === 'APPROVED' ? 'text-emerald-600' : 'text-muted-foreground'}>
                    {adjustment.managementDecision || 'Pending'}
                  </span>
                </div>
                {adjustment.remarks && (
                  <div className="pt-2">
                    <span className="font-medium block mb-1">Remarks:</span>
                    <span className="text-muted-foreground bg-muted p-2 rounded-md block">
                      {adjustment.remarks}
                    </span>
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
