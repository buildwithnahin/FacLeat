import Link from 'next/link';
import { getSession } from '@/server/auth/session';
import { PayrollPeriodsService } from '@/server/services/payroll-periods.service';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PayrollPeriodForm } from './payroll-period-form';
import { format } from 'date-fns';

export const metadata = { title: 'Payroll Period' };

type SearchParams = Promise<{ q?: string; edit?: string }>;

export default async function PayrollPeriodsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getSession();
  const sp = await searchParams;
  const canWrite = session?.permissions.includes('hr:write') ?? false;
  const q = sp.q ?? '';

  const periods = await PayrollPeriodsService.getPayrollPeriods({ search: q });

  const initialId = sp.edit && sp.edit !== 'new' ? sp.edit : null;
  const initial = initialId ? await PayrollPeriodsService.getPayrollPeriodById(initialId).catch(() => null) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll Period"
        description="Control center for monthly payroll cycles. Manage open and closed periods."
      >
        <Button asChild variant="outline">
          <Link href="/hr/payroll">Payroll Runs</Link>
        </Button>
      </PageHeader>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Payroll Periods</CardTitle>
          {canWrite && !sp.edit && (
            <Button asChild size="sm">
              <Link href="/hr/payroll-period?edit=new">
                + New Payroll Period
              </Link>
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Search</label>
              <Input name="q" defaultValue={q} placeholder="Search by name or code..." />
            </div>
            <div className="flex gap-2">
              <Button type="submit">Filter</Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/hr/payroll-period">Reset</Link>
              </Button>
            </div>
          </form>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-muted-foreground dark:bg-slate-900/60">
                <tr>
                  <th className="px-4 py-3">Period Code</th>
                  <th className="px-4 py-3">Payroll Month</th>
                  <th className="px-4 py-3">Start Date</th>
                  <th className="px-4 py-3">End Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Runs</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {periods.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                      No payroll periods found.
                    </td>
                  </tr>
                ) : (
                  periods.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3 font-mono text-xs font-semibold">{row.code}</td>
                      <td className="px-4 py-3 font-medium">{row.name}</td>
                      <td className="px-4 py-3">{format(new Date(row.startDate), 'dd-MMM-yy')}</td>
                      <td className="px-4 py-3">{format(new Date(row.endDate), 'dd-MMM-yy')}</td>
                      <td className="px-4 py-3">
                        <Badge 
                          variant={row.status === 'OPEN' ? 'default' : row.status === 'CLOSED' ? 'secondary' : 'outline'}
                          className={row.status === 'OPEN' ? 'bg-blue-500 hover:bg-blue-600' : row.status === 'CLOSED' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : ''}
                        >
                          {row.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {row.payrollRuns.length > 0 ? (
                          <span className="text-xs text-muted-foreground">{row.payrollRuns.length} Run(s)</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canWrite && row.status === 'DRAFT' ? (
                          <Button type="button" size="sm" variant="outline" asChild>
                            <Link href={`/hr/payroll-period?edit=${row.id}`}>Edit</Link>
                          </Button>
                        ) : (
                          <Button type="button" size="sm" variant="ghost" asChild>
                            <Link href={`/hr/payroll-period/${row.id}`}>View</Link>
                          </Button>
                        )}
                        <Button type="button" size="sm" variant="ghost" className="ml-2" asChild>
                          <Link href={`/hr/payroll-period/${row.id}`}>Details</Link>
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

      {canWrite && sp.edit ? (
        <PayrollPeriodForm
          mode={sp.edit === 'new' ? 'create' : 'edit'}
          initial={sp.edit === 'new' ? null : initial}
          path="/hr/payroll-period"
        />
      ) : null}
    </div>
  );
}
