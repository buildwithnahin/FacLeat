import { prisma } from '@/server/db';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatCurrency } from '@/lib/utils';
import { Printer, Download, Mail } from 'lucide-react';

export default async function PayslipDetailsPage({ 
  params 
}: { 
  params: Promise<{ id: string, payslipId: string }> 
}) {
  const { id, payslipId } = await params;
  
  const slip = await prisma.payslip.findUnique({
    where: { id: payslipId },
    include: {
      employee: {
        select: {
          firstName: true,
          lastName: true,
          code: true,
          bankName: true,
          bankAccount: true,
          department: true,
          designation: true,
          branch: true,
        },
      },
      payrollRun: {
        include: {
          payrollPeriod: true
        }
      }
    }
  });
  
  if (!slip || slip.payrollRunId !== id) {
    notFound();
  }

  const { employee, payrollRun } = slip;
  const isApproved = ['APPROVED', 'COMPLETED', 'CLOSED'].includes(payrollRun.status);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Payslip: ${employee.firstName} ${employee.lastName}`}
        description={`${payrollRun.payrollPeriod?.name || payrollRun.period} | ${employee.code}`}
        breadcrumbs={[
          { label: 'HR', href: '/hr' },
          { label: 'Payroll Run', href: '/hr/payroll-run' },
          { label: payrollRun.period, href: `/hr/payroll-run/${payrollRun.id}` },
          { label: 'Payslip', href: '#' },
        ]}
        action={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href={`/hr/payroll-run/${payrollRun.id}`}>Back to Payroll</Link>
            </Button>
            {isApproved && (
              <>
                <Button variant="outline" size="icon" title="Print"><Printer className="h-4 w-4" /></Button>
                <Button variant="outline" size="icon" title="Download PDF"><Download className="h-4 w-4" /></Button>
                <Button size="icon" title="Email to Employee"><Mail className="h-4 w-4" /></Button>
              </>
            )}
          </div>
        }
      />

      <Card className="max-w-4xl mx-auto print:shadow-none print:border-none">
        <CardHeader className="text-center border-b pb-6 mb-6">
          <div className="flex justify-between items-start">
            <div className="text-left">
              <h2 className="text-2xl font-bold tracking-tight">Annex Leather Limited</h2>
              <p className="text-muted-foreground text-sm mt-1">{employee.branch?.name || 'Head Office'}</p>
            </div>
            <div className="text-right">
              <h1 className="text-xl font-semibold uppercase text-primary tracking-widest">Payslip</h1>
              <p className="font-medium mt-1">{payrollRun.payrollPeriod?.name || payrollRun.period}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-8">
          
          <div className="grid grid-cols-2 gap-x-12 gap-y-4 text-sm">
            <div className="space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Employee Name:</span> <span className="font-semibold">{employee.firstName} {employee.lastName}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Employee Code:</span> <span>{employee.code}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Designation:</span> <span>{employee.designation || 'N/A'}</span></div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Department:</span> <span>{employee.department || 'N/A'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Bank Name:</span> <span>{employee.bankName || 'N/A'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Account No:</span> <span>{employee.bankAccount || 'N/A'}</span></div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
            <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px bg-border -translate-x-1/2"></div>
            
            {/* Earnings */}
            <div>
              <h3 className="font-semibold mb-4 pb-2 border-b uppercase tracking-wider text-sm text-emerald-700 dark:text-emerald-500">Earnings</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Basic Salary</span> <span>{formatCurrency(Number(slip.basic))}</span></div>
                {Number(slip.houseAllowance) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">House Rent</span> <span>{formatCurrency(Number(slip.houseAllowance))}</span></div>}
                {Number(slip.medicalAllowance) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Medical Allowance</span> <span>{formatCurrency(Number(slip.medicalAllowance))}</span></div>}
                {Number(slip.transportAllowance) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Transport Allowance</span> <span>{formatCurrency(Number(slip.transportAllowance))}</span></div>}
                {Number(slip.otherAllowance) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Other Allowance</span> <span>{formatCurrency(Number(slip.otherAllowance))}</span></div>}
                
                {(Number(slip.attendanceBonus) > 0 || Number(slip.overtimeAmount) > 0 || Number(slip.bonus) > 0) && <div className="pt-2 border-t border-dashed"></div>}
                {Number(slip.attendanceBonus) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Attendance Bonus</span> <span>{formatCurrency(Number(slip.attendanceBonus))}</span></div>}
                {Number(slip.overtimeAmount) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Overtime</span> <span>{formatCurrency(Number(slip.overtimeAmount))}</span></div>}
                {Number(slip.bonus) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Festival/Other Bonus</span> <span>{formatCurrency(Number(slip.bonus))}</span></div>}
                {Number(slip.payrollAdjustmentsAddition) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Adjustments (Add)</span> <span>{formatCurrency(Number(slip.payrollAdjustmentsAddition))}</span></div>}
              </div>
            </div>

            {/* Deductions */}
            <div>
              <h3 className="font-semibold mb-4 pb-2 border-b uppercase tracking-wider text-sm text-red-700 dark:text-red-500">Deductions</h3>
              <div className="space-y-3 text-sm">
                {Number(slip.taxDeduction) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Income Tax</span> <span>{formatCurrency(Number(slip.taxDeduction))}</span></div>}
                {Number(slip.providentFund) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Provident Fund</span> <span>{formatCurrency(Number(slip.providentFund))}</span></div>}
                {Number(slip.loanDeduction) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Loan Installment</span> <span>{formatCurrency(Number(slip.loanDeduction))}</span></div>}
                {Number(slip.advanceDeduction) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Salary Advance</span> <span>{formatCurrency(Number(slip.advanceDeduction))}</span></div>}
                
                {(Number(slip.lateDeduction) > 0 || Number(slip.absentDeduction) > 0 || Number(slip.payrollAdjustmentsDeduction) > 0) && <div className="pt-2 border-t border-dashed"></div>}
                {Number(slip.lateDeduction) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Late Deduction</span> <span>{formatCurrency(Number(slip.lateDeduction))}</span></div>}
                {Number(slip.absentDeduction) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Absent Deduction</span> <span>{formatCurrency(Number(slip.absentDeduction))}</span></div>}
                {Number(slip.payrollAdjustmentsDeduction) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Adjustments (Ded)</span> <span>{formatCurrency(Number(slip.payrollAdjustmentsDeduction))}</span></div>}
                {Number(slip.otherDeduction) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Other Deduction</span> <span>{formatCurrency(Number(slip.otherDeduction))}</span></div>}
                
                {Number(slip.gross) - Number(slip.net) === 0 && <div className="text-muted-foreground italic text-xs">No deductions for this period</div>}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t pt-4">
            <div className="flex justify-between font-bold text-lg">
              <span>Gross Earnings</span>
              <span>{formatCurrency(Number(slip.gross))}</span>
            </div>
            <div className="flex justify-between font-bold text-lg">
              <span>Total Deductions</span>
              <span className="text-red-600">-{formatCurrency(Number(slip.gross) - Number(slip.net))}</span>
            </div>
          </div>
          
          <div className="bg-emerald-50 dark:bg-emerald-900/20 p-6 rounded-lg flex items-center justify-between border border-emerald-100 dark:border-emerald-800/50 mt-8">
            <div className="text-emerald-800 dark:text-emerald-400 font-medium">Net Payable Salary</div>
            <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(Number(slip.net))}</div>
          </div>

          <div className="pt-24 flex justify-between text-sm text-muted-foreground">
            <div className="text-center w-48 border-t pt-2">
              Employer Signature
            </div>
            <div className="text-center w-48 border-t pt-2">
              Employee Signature
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
