import Link from 'next/link';
import { backendFetch } from '@/lib/backend-client';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/money';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'HR report' };

interface HrSummaryDto {
  headcount: { active: number; onLeave: number; terminated: number };
  lastPayroll: {
    id: string;
    period: string;
    branch: string;
    status: string;
    gross: string;
    deduction: string;
    net: string;
  } | null;
}

interface Branch {
  id: string;
  name: string;
  code: string;
}

export default async function HrReportPage({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string }>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams(sp.branchId && sp.branchId !== 'ALL' ? { branchId: sp.branchId } : {});
  const [data, branches] = await Promise.all([
    backendFetch<HrSummaryDto>(`/api/mobile/reports/general/hr-summary?${qs.toString()}`),
    backendFetch<Branch[]>('/api/mobile/branches').catch(() => []),
  ]);

  const isFiltered = Boolean(sp.branchId && sp.branchId !== 'ALL');

  return (
    <div className="space-y-6">
      <PageHeader title="HR summary" description="Headcount and latest payroll run.">
        <form className="flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Branch</label>
            <select
              name="branchId"
              defaultValue={sp.branchId ?? ''}
              className="flex h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="">All branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.code} · {b.name}</option>
              ))}
            </select>
          </div>
          <Button type="submit">Apply</Button>
          {isFiltered && (
            <Button variant="ghost" asChild>
              <Link href="/reports/hr">Reset</Link>
            </Button>
          )}
        </form>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Kpi label="Active" value={`${data.headcount.active}`} accent />
        <Kpi label="On leave" value={`${data.headcount.onLeave}`} />
        <Kpi label="Terminated" value={`${data.headcount.terminated}`} />
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="text-sm font-semibold mb-4">Last payroll run</div>
          {data.lastPayroll ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <Field label="Period" value={
                <Link href={`/hr/payroll/${data.lastPayroll.id}`} className="text-primary hover:underline">
                  {data.lastPayroll.period}
                </Link>
              } />
              <Field label="Branch" value={<Badge variant="outline">{data.lastPayroll.branch}</Badge>} />
              <Field label="Status" value={<Badge variant="success">{data.lastPayroll.status}</Badge>} />
              <div />
              <Field label="Total gross" value={formatCurrency(data.lastPayroll.gross, 'BDT')} />
              <Field label="Total deduction" value={formatCurrency(data.lastPayroll.deduction, 'BDT')} />
              <Field label="Total net paid" value={<span className="font-semibold text-primary">{formatCurrency(data.lastPayroll.net, 'BDT')}</span>} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No approved payroll runs yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={`text-2xl font-semibold tabular-nums mt-1 ${accent ? 'text-primary' : ''}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 tabular-nums">{value}</div>
    </div>
  );
}
