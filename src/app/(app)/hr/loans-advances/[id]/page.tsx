import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/server/auth/session';
import { LoansService } from '@/server/services/loans.service';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { CheckCircle2, Circle, Clock, Receipt } from 'lucide-react';
import { LoanApprovalForm } from './approval-form';

export default async function LoanViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const p = await params;
  const session = await getSession();
  const isAdmin = session?.permissions.includes('admin') || session?.systemRole === 'ADMIN';

  const loan = await LoansService.getLoanById(p.id).catch(() => null);

  if (!loan) {
    notFound();
  }

  const workflowSteps = [
    { label: 'Draft', status: 'DRAFT', done: true },
    { label: 'Submitted', status: 'SUBMITTED', done: !['DRAFT'].includes(loan.status) },
    { label: 'HR Review', status: 'PENDING_HR', done: !['DRAFT', 'SUBMITTED', 'PENDING_HR'].includes(loan.status) && loan.status !== 'REJECTED' },
    { label: 'Accounts Verification', status: 'PENDING_ACCOUNTS', done: !['DRAFT', 'SUBMITTED', 'PENDING_HR', 'PENDING_ACCOUNTS'].includes(loan.status) && loan.status !== 'REJECTED' },
    { label: 'Management Approval', status: 'PENDING_MANAGEMENT', done: ['APPROVED', 'DISBURSED', 'ACTIVE', 'COMPLETED'].includes(loan.status) },
    { label: 'Disbursed', status: 'DISBURSED', done: ['DISBURSED', 'ACTIVE', 'COMPLETED'].includes(loan.status) },
    { label: 'Completed', status: 'COMPLETED', done: loan.status === 'COMPLETED' },
  ];

  if (loan.status === 'REJECTED') {
    workflowSteps.push({ label: 'Rejected', status: 'REJECTED', done: true });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Loan / Advance Details"
        description={`${loan.referenceNo} - ${loan.requestType === 'EMPLOYEE_LOAN' ? 'Employee Loan' : 'Salary Advance'}`}
      >
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/hr/loans-advances">Back to List</Link>
          </Button>
          {['DRAFT', 'SUBMITTED'].includes(loan.status) && (
            <Button asChild>
              <Link href={`/hr/loans-advances?edit=${loan.id}`}>Edit</Link>
            </Button>
          )}
        </div>
      </PageHeader>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main Details */}
        <div className="space-y-6 md:col-span-2">
          
          <Card>
            <CardHeader className="border-b bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center justify-between">
                <CardTitle>Loan Summary</CardTitle>
                <Badge 
                  variant={['ACTIVE', 'COMPLETED'].includes(loan.status) ? 'default' : loan.status === 'REJECTED' ? 'destructive' : 'outline'}
                  className={loan.status === 'ACTIVE' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}
                >
                  {loan.status.replace(/_/g, ' ')}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 border-b pb-6">
                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground mb-4">Employee Information</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Name</span>
                      <span className="font-medium">{loan.employee.firstName} {loan.employee.lastName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">ID</span>
                      <span className="font-medium">{loan.employee.code}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Department</span>
                      <span className="font-medium">{loan.employee.department}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Designation</span>
                      <span className="font-medium">{loan.employee.designation}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground mb-4">Request Information</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Purpose</span>
                      <span className="font-medium">{loan.purpose.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Disbursement Date</span>
                      <span className="font-medium">{format(new Date(loan.disbursementDate), 'dd MMM yyyy')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Start Month</span>
                      <span className="font-medium">{loan.repaymentStartMonth}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Created</span>
                      <span className="font-medium">{format(new Date(loan.createdAt), 'dd MMM yyyy')}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-md border bg-slate-50 dark:bg-slate-900/40">
                  <div className="text-sm text-muted-foreground mb-1">Loan Amount</div>
                  <div className="text-xl font-bold">{formatCurrency(loan.loanAmount.toNumber(), 'BDT')}</div>
                </div>
                <div className="p-4 rounded-md border bg-blue-50 dark:bg-blue-950/20">
                  <div className="text-sm text-muted-foreground mb-1">Monthly Deduction</div>
                  <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{formatCurrency(loan.monthlyDeduction.toNumber(), 'BDT')}</div>
                </div>
                <div className="p-4 rounded-md border bg-emerald-50 dark:bg-emerald-950/20">
                  <div className="text-sm text-muted-foreground mb-1">Paid Amount</div>
                  <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(loan.paidAmount.toNumber(), 'BDT')}</div>
                </div>
                <div className="p-4 rounded-md border bg-orange-50 dark:bg-orange-950/20">
                  <div className="text-sm text-muted-foreground mb-1">Outstanding</div>
                  <div className="text-xl font-bold text-orange-600 dark:text-orange-400">{formatCurrency(loan.outstandingBalance.toNumber(), 'BDT')}</div>
                </div>
              </div>

            </CardContent>
          </Card>

          {loan.repaymentSchedules.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Repayment History</CardTitle>
                <Badge variant="outline" className="gap-1"><Receipt className="h-3 w-3"/> {loan.repaymentSchedules.length} Installments</Badge>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-900/60">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Payroll Month</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">Installment</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">Remaining Balance</th>
                        <th className="px-4 py-3 text-center font-medium text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {loan.repaymentSchedules.map((schedule) => (
                        <tr key={schedule.id}>
                          <td className="px-4 py-3 font-medium">{schedule.payrollMonth}</td>
                          <td className="px-4 py-3 text-right text-red-600 dark:text-red-400">-{formatCurrency(schedule.installment.toNumber(), 'BDT')}</td>
                          <td className="px-4 py-3 text-right">{formatCurrency(schedule.remainingBalance.toNumber(), 'BDT')}</td>
                          <td className="px-4 py-3 text-center">
                            <Badge variant={schedule.status === 'PAID' ? 'default' : 'outline'} className={schedule.status === 'PAID' ? 'bg-emerald-500' : ''}>
                              {schedule.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

        </div>

        {/* Sidebar Actions / Progress */}
        <div className="space-y-6">
          <LoanApprovalForm 
            loanId={loan.id} 
            currentStatus={loan.status} 
            isAdmin={isAdmin} 
          />

          <Card className="bg-slate-50 dark:bg-slate-900/50">
            <CardHeader>
              <CardTitle className="text-base">Approval Workflow</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {workflowSteps.map((step, idx) => {
                  let Icon = Circle;
                  let colorClass = 'text-slate-300 dark:text-slate-700';
                  
                  if (step.status === 'REJECTED') {
                    colorClass = 'text-red-500';
                  } else if (step.done) {
                    Icon = CheckCircle2;
                    colorClass = 'text-emerald-500';
                  } else if (loan.status === step.status) {
                    Icon = Clock;
                    colorClass = 'text-orange-500';
                  }

                  return (
                    <div key={idx} className="flex items-center gap-3">
                      <Icon className={`h-5 w-5 ${colorClass}`} />
                      <span className={`font-medium ${step.done || loan.status === step.status ? 'text-slate-900 dark:text-slate-100' : 'text-muted-foreground'}`}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 pt-4 border-t space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">HR Review</span>
                  <span className="font-medium">{loan.hrApprovalStatus || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Accounts Check</span>
                  <span className="font-medium">{loan.accountsVerification || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Management</span>
                  <span className="font-medium">{loan.managementDecision || '-'}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
