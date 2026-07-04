import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/server/auth/session';
import { PayrollPeriodsService } from '@/server/services/payroll-periods.service';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { CheckCircle2, Circle, Clock } from 'lucide-react';
import { PeriodStatusForm } from './status-form';

export default async function PayrollPeriodViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const p = await params;
  const session = await getSession();
  const isAdmin = session?.permissions.includes('admin') || session?.systemRole === 'ADMIN';

  const period = await PayrollPeriodsService.getPayrollPeriodById(p.id).catch(() => null);

  if (!period) {
    notFound();
  }

  // Calculate progress based on related PayrollRuns
  // For simplicity here, we assume one aggregated status
  let overallRunStatus = 'NOT_STARTED';
  if (period.payrollRuns.length > 0) {
    // If all are completed
    if (period.payrollRuns.every(r => r.status === 'COMPLETED')) overallRunStatus = 'COMPLETED';
    else if (period.payrollRuns.some(r => r.status === 'APPROVED')) overallRunStatus = 'APPROVED';
    else if (period.payrollRuns.some(r => r.status === 'GENERATED')) overallRunStatus = 'GENERATED';
    else overallRunStatus = 'PROCESSING';
  }

  const progressSteps = [
    { label: 'Attendance Imported', done: overallRunStatus !== 'NOT_STARTED' },
    { label: 'Leave Processed', done: overallRunStatus !== 'NOT_STARTED' },
    { label: 'Overtime Calculated', done: overallRunStatus !== 'NOT_STARTED' },
    { label: 'Payroll Generated', done: ['GENERATED', 'APPROVED', 'COMPLETED'].includes(overallRunStatus) },
    { label: 'Payroll Approved', done: ['APPROVED', 'COMPLETED'].includes(overallRunStatus) },
    { label: 'Payslips Generated', done: overallRunStatus === 'COMPLETED' },
    { label: 'Payroll Closed', done: period.status === 'CLOSED' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll Period Details"
        description={`${period.name} (${period.code})`}
      >
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/hr/payroll-period">Back to List</Link>
          </Button>
          {period.status === 'DRAFT' && (
            <Button asChild>
              <Link href={`/hr/payroll-period?edit=${period.id}`}>Edit</Link>
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
                <CardTitle>Period Information</CardTitle>
                <div className="flex gap-2">
                  <Badge variant="outline">{overallRunStatus.replace('_', ' ')}</Badge>
                  <Badge 
                    variant={period.status === 'OPEN' ? 'default' : period.status === 'CLOSED' ? 'secondary' : 'outline'}
                    className={period.status === 'OPEN' ? 'bg-blue-500 hover:bg-blue-600 text-white' : period.status === 'CLOSED' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : ''}
                  >
                    {period.status}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Start Date</div>
                  <div className="mt-1 font-medium">{format(new Date(period.startDate), 'dd MMM yyyy')}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">End Date</div>
                  <div className="mt-1 font-medium">{format(new Date(period.endDate), 'dd MMM yyyy')}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Salary Date</div>
                  <div className="mt-1 font-medium">{period.paymentDate ? format(new Date(period.paymentDate), 'dd MMM yyyy') : '-'}</div>
                </div>
                
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Attendance Cut-off</div>
                  <div className="mt-1 font-medium">{period.attendanceCutoffDate ? format(new Date(period.attendanceCutoffDate), 'dd MMM yyyy') : '-'}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Overtime Cut-off</div>
                  <div className="mt-1 font-medium">{period.overtimeCutoffDate ? format(new Date(period.overtimeCutoffDate), 'dd MMM yyyy') : '-'}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Leave Cut-off</div>
                  <div className="mt-1 font-medium">{period.leaveCutoffDate ? format(new Date(period.leaveCutoffDate), 'dd MMM yyyy') : '-'}</div>
                </div>
              </div>
              
              <div className="mt-8 border-t pt-6">
                <h4 className="text-sm font-semibold mb-3">Inclusions</h4>
                <div className="flex flex-wrap gap-2">
                  {period.includeAttendance && <Badge variant="secondary">Attendance</Badge>}
                  {period.includeLeave && <Badge variant="secondary">Leave</Badge>}
                  {period.includeOvertime && <Badge variant="secondary">Overtime</Badge>}
                  {period.includeBonus && <Badge variant="secondary">Bonus</Badge>}
                  {period.includeLoanDeduction && <Badge variant="secondary">Loans</Badge>}
                  {period.includeSalaryAdvance && <Badge variant="secondary">Advances</Badge>}
                  {period.includeTax && <Badge variant="secondary">Tax</Badge>}
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Payroll Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {progressSteps.map((step, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    {step.done ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    ) : (
                      period.status === 'OPEN' && !step.done && idx === progressSteps.findIndex(s => !s.done)
                        ? <Clock className="h-5 w-5 text-orange-500" />
                        : <Circle className="h-5 w-5 text-slate-300 dark:text-slate-700" />
                    )}
                    <span className={`font-medium ${step.done ? 'text-slate-900 dark:text-slate-100' : 'text-muted-foreground'}`}>
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Sidebar Actions / Calendar */}
        <div className="space-y-6">
          <PeriodStatusForm 
            periodId={period.id} 
            currentStatus={period.status} 
            isAdmin={isAdmin} 
          />

          <Card className="bg-slate-50 dark:bg-slate-900/50">
            <CardHeader>
              <CardTitle className="text-base">Payroll Calendar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between border-b pb-2">
                <span className="text-sm text-muted-foreground">Payroll Month</span>
                <span className="font-medium">{period.name}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-sm text-muted-foreground">Attendance Closing</span>
                <span className="font-medium">{period.attendanceCutoffDate ? format(new Date(period.attendanceCutoffDate), 'dd-MMM') : 'N/A'}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-sm text-muted-foreground">Payroll Processing</span>
                <span className="font-medium">{period.processingDate ? format(new Date(period.processingDate), 'dd-MMM') : 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Salary Payment</span>
                <span className="font-medium">{period.paymentDate ? format(new Date(period.paymentDate), 'dd-MMM') : 'N/A'}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
