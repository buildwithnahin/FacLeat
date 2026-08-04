import { prisma } from '@/server/db';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatCurrency } from '@/lib/utils';
import { BonusService } from '@/server/services/bonus.service';
import { ApprovalForm } from './approval-form';
import { getSession } from '@/server/auth/session';

export default async function BonusDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();

  const bonus = await BonusService.getBonusById(session, id);
  
  if (!bonus) {
    notFound();
  }

  const totalAmount = bonus.employeeBonuses.reduce((acc, eb) => acc + Number(eb.amount), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Bonus: ${bonus.name}`}
        description={`Details and approvals for ${bonus.code}`}
        breadcrumbs={[
          { label: 'HR', href: '/hr' },
          { label: 'Payroll', href: '/hr/payroll' },
          { label: 'Bonus', href: '/hr/bonus' },
          { label: bonus.code, href: `/hr/bonus/${bonus.id}` },
        ]}
        action={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/hr/bonus">Back to List</Link>
            </Button>
            {['DRAFT', 'SUBMITTED'].includes(bonus.status) && (
              <Button asChild>
                <Link href={`/hr/bonus?edit=${bonus.id}`}>Edit</Link>
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Bonus Summary</CardTitle>
              <CardDescription>Overview of the bonus calculation and settings</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <dt className="text-muted-foreground font-medium">Type</dt>
                  <dd className="mt-1 font-semibold">{bonus.bonusType.replace('_', ' ')}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground font-medium">Payroll Month</dt>
                  <dd className="mt-1 font-semibold">{bonus.effectivePayrollMonth}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground font-medium">Status</dt>
                  <dd className="mt-1 font-semibold">
                    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-primary/10 text-primary">
                      {bonus.status.replace('_', ' ')}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground font-medium">Calculation Method</dt>
                  <dd className="mt-1 font-semibold">
                    {bonus.calculationMethod === 'FIXED_AMOUNT' && `Fixed: ${formatCurrency(Number(bonus.amount))}`}
                    {bonus.calculationMethod === 'PERCENTAGE' && `${bonus.percentage}% of ${bonus.basedOn}`}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground font-medium">Payment Method</dt>
                  <dd className="mt-1 font-semibold">{bonus.paymentMethod.replace('_', ' ')}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground font-medium">Include in Payslip</dt>
                  <dd className="mt-1 font-semibold">{bonus.includeInPayslip ? 'Yes' : 'No'}</dd>
                </div>
              </dl>
              {bonus.description && (
                <div className="mt-4 pt-4 border-t">
                  <dt className="text-muted-foreground font-medium mb-1">Description</dt>
                  <dd className="text-sm">{bonus.description}</dd>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Employee Preview ({bonus.employeeBonuses.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/90 backdrop-blur">
                    <tr className="border-b">
                      <th className="px-4 py-3 text-left font-medium">Employee</th>
                      <th className="px-4 py-3 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bonus.employeeBonuses.map((eb) => (
                      <tr key={eb.id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="px-4 py-3">
                          <div className="font-medium">{eb.employee.firstName} {eb.employee.lastName}</div>
                          <div className="text-xs text-muted-foreground">{eb.employee.code}</div>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-emerald-600">
                          {formatCurrency(Number(eb.amount))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="sticky bottom-0 bg-muted/90 backdrop-blur font-bold">
                    <tr className="border-t">
                      <td className="px-4 py-3 text-right">Total Cost:</td>
                      <td className="px-4 py-3 text-right text-emerald-700">{formatCurrency(totalAmount)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Approval Actions</CardTitle>
              <CardDescription>Review and update status</CardDescription>
            </CardHeader>
            <CardContent>
              <ApprovalForm bonus={bonus} />
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
                  <span className={bonus.hrApprovalStatus === 'APPROVED' ? 'text-emerald-600' : 'text-muted-foreground'}>
                    {bonus.hrApprovalStatus || 'Pending'}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b">
                  <span className="font-medium">Management Decision</span>
                  <span className={bonus.managementDecision === 'APPROVED' ? 'text-emerald-600' : 'text-muted-foreground'}>
                    {bonus.managementDecision || 'Pending'}
                  </span>
                </div>
                {bonus.remarks && (
                  <div className="pt-2">
                    <span className="font-medium block mb-1">Remarks:</span>
                    <span className="text-muted-foreground bg-muted p-2 rounded-md block">
                      {bonus.remarks}
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
