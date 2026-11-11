import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/lib/utils';
import { backendFetch } from '@/lib/backend-client';
import { getSession } from '@/server/auth/session';
import { CalculateForm } from './calculate-form';

export const dynamic = 'force-dynamic';

interface SettlementStats {
  pending: number;
  approved: number;
  paid: number;
  totalAmount: number;
}

interface SettlementRow {
  id: string;
  no: string;
  separationType: string;
  lastWorkingDate: string;
  netSettlement: string;
  status: string;
  employee: { firstName: string; lastName: string; code: string; department: string | null };
}

interface EligibleResignation {
  id: string;
  resignationType: string;
  employee: { firstName: string; lastName: string; code: string };
}

export default async function FinalSettlementPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  await getSession();

  const stats = await backendFetch<SettlementStats>('/api/mobile/hr/final-settlement/stats');

  const listParams = new URLSearchParams();
  if (typeof sp.status === 'string') listParams.set('status', sp.status);

  const settlementsAll = await backendFetch<SettlementRow[]>(`/api/mobile/hr/final-settlement?${listParams.toString()}`);

  const q = typeof sp.q === 'string' ? sp.q.toLowerCase() : '';
  const type = typeof sp.type === 'string' ? sp.type : '';
  const settlements = settlementsAll.filter((row) => {
    if (type && row.separationType !== type) return false;
    if (
      q &&
      !`${row.employee.firstName} ${row.employee.lastName} ${row.employee.code} ${row.no}`.toLowerCase().includes(q)
    ) {
      return false;
    }
    return true;
  });

  const isEditing = sp.edit === 'new';

  const eligibleResignations = isEditing
    ? await backendFetch<EligibleResignation[]>('/api/mobile/hr/final-settlement/eligible-resignations')
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Final Settlement"
        description="Calculate payouts and recover balances for separated employees."
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Settlements</CardTitle>
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Paid & Closed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.paid}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Paid Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(stats.totalAmount)}</div>
          </CardContent>
        </Card>
      </div>

      {!isEditing ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Final Settlements</CardTitle>
            <Button asChild size="sm">
              <Link href="/hr/final-settlement?edit=new">+ Create Settlement</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="flex gap-4 items-end bg-slate-50 dark:bg-slate-900/40 p-4 rounded-md border">
              <div className="space-y-1 flex-1">
                <label className="text-xs font-medium text-muted-foreground">Search</label>
                <Input name="q" placeholder="Employee or FS No..." defaultValue={typeof sp.q === 'string' ? sp.q : ''} />
              </div>
              <div className="space-y-1 flex-1">
                <label className="text-xs font-medium text-muted-foreground">Type</label>
                <Select name="type" defaultValue={typeof sp.type === 'string' ? sp.type : undefined}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RESIGNATION">Resignation</SelectItem>
                    <SelectItem value="TERMINATION">Termination</SelectItem>
                    <SelectItem value="RETIREMENT">Retirement</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 flex-1">
                <label className="text-xs font-medium text-muted-foreground">Status</label>
                <Select name="status" defaultValue={typeof sp.status === 'string' ? sp.status : undefined}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CALCULATED">Pending</SelectItem>
                    <SelectItem value="APPROVED">Approved</SelectItem>
                    <SelectItem value="PAID">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button type="submit">Filter</Button>
                <Button type="button" variant="outline" asChild>
                  <Link href="/hr/final-settlement">Reset</Link>
                </Button>
              </div>
            </form>

            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium">Settlement No</th>
                    <th className="px-4 py-3 text-left font-medium">Employee</th>
                    <th className="px-4 py-3 text-left font-medium">Type</th>
                    <th className="px-4 py-3 text-left font-medium">Last Working Day</th>
                    <th className="px-4 py-3 text-right font-medium">Payable</th>
                    <th className="px-4 py-3 text-center font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {settlements.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                        No settlements found.
                      </td>
                    </tr>
                  ) : (
                    settlements.map((row) => (
                      <tr key={row.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                        <td className="px-4 py-3 font-medium">{row.no}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{row.employee.firstName} {row.employee.lastName}</div>
                          <div className="text-xs text-muted-foreground">{row.employee.code} | {row.employee.department}</div>
                        </td>
                        <td className="px-4 py-3">{row.separationType.replace('_', ' ')}</td>
                        <td className="px-4 py-3">{new Date(row.lastWorkingDate).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-right font-semibold text-emerald-600">{formatCurrency(Number(row.netSettlement))}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold
                            ${row.status === 'PAID' || row.status === 'CLOSED' ? 'bg-blue-100 text-blue-800' : ''}
                            ${row.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : ''}
                            ${['DRAFT', 'CALCULATED', 'PENDING_HR', 'PENDING_FINANCE', 'PENDING_MANAGEMENT'].includes(row.status) ? 'bg-amber-100 text-amber-800' : ''}
                            ${row.status === 'REJECTED' ? 'bg-red-100 text-red-800' : ''}
                          `}>
                            {row.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button type="button" size="sm" variant="ghost" asChild>
                            <Link href={`/hr/final-settlement/${row.id}`}>View</Link>
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
        <CalculateForm
          resignations={eligibleResignations}
        />
      )}
    </div>
  );
}
