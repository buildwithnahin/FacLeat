import { prisma } from '@/server/db';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatCurrency } from '@/lib/utils';
import { FinalSettlementService } from '@/server/services/final-settlement.service';
import { ApprovalForm } from './approval-form';
import { Printer, Download } from 'lucide-react';

export default async function FinalSettlementDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const fs = await FinalSettlementService.getSettlementById(id);
  
  if (!fs) {
    notFound();
  }

  const { employee } = fs;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Final Settlement: ${fs.no}`}
        description={`${employee.firstName} ${employee.lastName} (${employee.code}) | ${fs.separationType.replace('_', ' ')}`}
        breadcrumbs={[
          { label: 'HR', href: '/hr' },
          { label: 'Payroll', href: '/hr/payroll' },
          { label: 'Final Settlement', href: '/hr/final-settlement' },
          { label: fs.no, href: '#' },
        ]}
        action={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/hr/final-settlement">Back</Link>
            </Button>
            {['APPROVED', 'PAID', 'CLOSED'].includes(fs.status) && (
              <>
                <Button variant="outline" size="icon" title="Print"><Printer className="h-4 w-4" /></Button>
                <Button variant="outline" size="icon" title="Download PDF"><Download className="h-4 w-4" /></Button>
              </>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          
          <Card>
            <CardHeader>
              <CardTitle>Employee Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground block text-xs">Employee ID</span>
                  <span className="font-medium">{employee.code}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Department</span>
                  <span className="font-medium">{employee.department || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Designation</span>
                  <span className="font-medium">{employee.designation || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Branch</span>
                  <span className="font-medium">{employee.branch?.name || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Last Working Day</span>
                  <span className="font-medium text-amber-600">{new Date(fs.lastWorkingDate).toLocaleDateString()}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs">Reason</span>
                  <span className="font-medium">{fs.reason || 'N/A'}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3 border-b mb-3">
                <CardTitle className="text-emerald-700 dark:text-emerald-500">Earnings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pending Salary</span>
                  <span>{formatCurrency(Number(fs.pendingSalary))}</span>
                </div>
                {Number(fs.leaveEncashment) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Leave Encashment</span>
                    <span>{formatCurrency(Number(fs.leaveEncashment))}</span>
                  </div>
                )}
                {Number(fs.overtimeAmount) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Overtime</span>
                    <span>{formatCurrency(Number(fs.overtimeAmount))}</span>
                  </div>
                )}
                {Number(fs.bonusAmount) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bonus</span>
                    <span>{formatCurrency(Number(fs.bonusAmount))}</span>
                  </div>
                )}
                {Number(fs.otherEarnings) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Other Earnings</span>
                    <span>{formatCurrency(Number(fs.otherEarnings))}</span>
                  </div>
                )}
                
                <div className="flex justify-between pt-3 border-t font-semibold">
                  <span>Total Earnings</span>
                  <span className="text-emerald-600">{formatCurrency(Number(fs.totalEarnings))}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3 border-b mb-3">
                <CardTitle className="text-red-700 dark:text-red-500">Deductions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {Number(fs.loanRecovery) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Loan Recovery</span>
                    <span>{formatCurrency(Number(fs.loanRecovery))}</span>
                  </div>
                )}
                {Number(fs.advanceRecovery) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Advance Recovery</span>
                    <span>{formatCurrency(Number(fs.advanceRecovery))}</span>
                  </div>
                )}
                {Number(fs.incomeTax) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Income Tax</span>
                    <span>{formatCurrency(Number(fs.incomeTax))}</span>
                  </div>
                )}
                {Number(fs.noticePayRecovery) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Notice Pay Recovery</span>
                    <span>{formatCurrency(Number(fs.noticePayRecovery))}</span>
                  </div>
                )}
                {Number(fs.assetRecovery) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Asset Recovery</span>
                    <span>{formatCurrency(Number(fs.assetRecovery))}</span>
                  </div>
                )}
                {Number(fs.otherDeductions) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Other Deductions</span>
                    <span>{formatCurrency(Number(fs.otherDeductions))}</span>
                  </div>
                )}
                
                <div className="flex justify-between pt-3 border-t font-semibold">
                  <span>Total Deductions</span>
                  <span className="text-red-600">-{formatCurrency(Number(fs.totalDeductions))}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-slate-50 dark:bg-slate-900/40 border-primary/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-muted-foreground text-sm uppercase tracking-wider mb-1">Net Settlement</h3>
                  <p className="text-xs text-muted-foreground">Earnings - Deductions</p>
                </div>
                <div className="text-3xl font-bold text-primary">
                  {formatCurrency(Number(fs.netSettlement))}
                </div>
              </div>
            </CardContent>
          </Card>
          
          {fs.paymentDate && (
            <Card>
              <CardHeader>
                <CardTitle>Payment Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground block text-xs">Method</span>
                    <span className="font-medium">{fs.paymentMethod}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">Date</span>
                    <span className="font-medium">{new Date(fs.paymentDate).toLocaleDateString()}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">Reference</span>
                    <span className="font-mono">{fs.transactionRef || 'N/A'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Exit Clearance</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm">
                <li className="flex items-center justify-between">
                  <span className="text-muted-foreground">Clearance Status</span>
                  <span className="font-semibold text-emerald-600">✔ Completed</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-muted-foreground">Clearance ID</span>
                  <span className="font-mono">{fs.resignation?.exitClearance?.clearanceNumber || 'N/A'}</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Approval Workflow</CardTitle>
              <CardDescription>Multi-level authorization</CardDescription>
            </CardHeader>
            <CardContent>
              <ApprovalForm fs={fs} />
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
                  <span className={fs.hrApproval === 'APPROVED' ? 'text-emerald-600 font-semibold' : 'text-muted-foreground'}>
                    {fs.hrApproval || 'Pending'}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="font-medium">Finance Approval</span>
                  <span className={fs.financeApproval === 'APPROVED' ? 'text-emerald-600 font-semibold' : 'text-muted-foreground'}>
                    {fs.financeApproval || 'Pending'}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="font-medium">Management Approval</span>
                  <span className={fs.managementApproval === 'APPROVED' ? 'text-emerald-600 font-semibold' : 'text-muted-foreground'}>
                    {fs.managementApproval || 'Pending'}
                  </span>
                </div>
                {fs.remarks && (
                  <div className="pt-2">
                    <span className="font-medium block mb-1">Remarks:</span>
                    <span className="text-muted-foreground bg-muted p-2 rounded-md block text-xs">
                      {fs.remarks}
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
