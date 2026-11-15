import Link from 'next/link';
import { RotateCcw } from 'lucide-react';
import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/money';
import { NewPayrollRunForm } from './_components/new-run-form';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Payroll' };

const STATUS_VARIANT: Record<string, 'default' | 'outline' | 'success' | 'warning' | 'destructive'> = {
  DRAFT: 'warning',
  APPROVED: 'default',
  PAID: 'success',
  LOCKED: 'outline',
  CANCELLED: 'destructive',
};

interface PayrollRunRow {
  id: string;
  period: string;
  status: string;
  totalGross: string;
  totalDeduction: string;
  totalNet: string;
  branch: { code: string; name: string };
  _count: { payslips: number };
}

interface BranchOption {
  id: string;
  code: string;
  name: string;
}

export default async function PayrollPage({
  searchParams,
}: {
  searchParams?: Promise<{ branchId?: string; status?: string }>;
}) {
  const session = await getSession();
  const sp = (await searchParams) ?? {};
  const branchId = sp.branchId ?? '';
  const status = sp.status ?? '';

  const listParams = new URLSearchParams();
  if (branchId && branchId !== 'ALL') listParams.set('branchId', branchId);
  if (status && status !== 'ALL') listParams.set('status', status);

  const [runs, branches] = await Promise.all([
    backendFetch<PayrollRunRow[]>(`/api/mobile/hr/payroll/runs?${listParams.toString()}`).catch(() => []),
    backendFetch<BranchOption[]>('/api/mobile/branches').catch(() => []),
  ]);
  const canProcess = session?.permissions.includes('hr:process-payroll') ?? false;

  return (
    <div className="space-y-6">
      <PageHeader title="Payroll" description="Monthly payroll runs. Each run generates a payslip per employee." />

      {canProcess && (
        <Card>
          <CardContent className="p-6">
            <div className="text-sm font-semibold mb-3">Start a new payroll run</div>
            <NewPayrollRunForm branches={branches.map((b) => ({ id: b.id, code: b.code, name: b.name }))} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <form method="GET" className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-medium text-muted-foreground">Branch</label>
              <select
                name="branchId"
                defaultValue={branchId}
                aria-label="Filter by branch"
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="ALL">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} — {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-[180px]">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <select
                name="status"
                defaultValue={status}
                aria-label="Filter by status"
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="ALL">All Statuses</option>
                <option value="DRAFT">DRAFT</option>
                <option value="APPROVED">APPROVED</option>
                <option value="PAID">PAID</option>
                <option value="LOCKED">LOCKED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>

            <div className="flex gap-2 self-end">
              <Button type="submit">Filter</Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/hr/payroll">
                  <RotateCcw className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left font-semibold px-4 py-3">Period</th>
                <th className="text-left font-semibold px-4 py-3">Branch</th>
                <th className="text-right font-semibold px-4 py-3">Employees</th>
                <th className="text-right font-semibold px-4 py-3 tabular-nums">Gross</th>
                <th className="text-right font-semibold px-4 py-3 tabular-nums">Deduction</th>
                <th className="text-right font-semibold px-4 py-3 tabular-nums">Net</th>
                <th className="text-left font-semibold px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {runs.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    No payroll runs found.
                  </td>
                </tr>
              )}
              {runs.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs">
                    <Link href={`/hr/payroll/${r.id}`} className="text-primary hover:underline font-medium">
                      {r.period}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{r.branch.code}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{r._count.payslips}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-mono">{formatCurrency(Number(r.totalGross) || 0, 'BDT')}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-mono">{formatCurrency(Number(r.totalDeduction) || 0, 'BDT')}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold font-mono text-primary">{formatCurrency(Number(r.totalNet) || 0, 'BDT')}</td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[r.status] ?? 'outline'}>{r.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
