import Link from 'next/link';
import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { LeaveTypeForm } from './leave-type-form';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Leave Types' };

type SearchParams = Promise<{ q?: string; edit?: string }>;

interface LeaveTypeRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: string;
  paidLeave: boolean;
  annualEntitlement: number | null;
  maxConsecutiveDays: number | null;
  minimumLeaveDays: number | null;
  applyBeforeDays: number | null;
  unit: string;
  applicableEmploymentTypes: string[];
  genderApplicability: string;
  applicableDepartment: string | null;
  applicableDesignation: string | null;
  applicableBranchId: string | null;
  attachmentRequired: boolean;
  medicalCertificateRequired: boolean;
  allowHalfDay: boolean;
  allowBackdatedApplication: boolean;
  allowFutureApplication: boolean;
  approvalRequired: boolean;
  autoApprove: boolean;
  holidayIncluded: boolean;
  weekendIncluded: boolean;
  carryForwardAllowed: boolean;
  maximumCarryForwardDays: number | null;
  carryForwardExpiryMonths: number | null;
  requiredAttachmentTypes: string[];
  allowNegativeBalance: boolean;
  displayOrder: number;
}

interface LeaveTypesResponse {
  leaveTypes: LeaveTypeRow[];
  branches: Array<{ id: string; code: string; name: string }>;
  departments: string[];
  designations: string[];
  employmentTypes: string[];
}

export default async function LeaveTypesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getSession();
  const sp = await searchParams;
  const canWrite = session?.permissions.includes('hr:write') ?? false;
  const q = sp.q ?? '';

  const { leaveTypes, branches, departments, designations, employmentTypes } = await backendFetch<LeaveTypesResponse>(
    `/api/mobile/hr/leave-types${q ? `?q=${encodeURIComponent(q)}` : ''}`,
  );

  const initial = sp.edit ? leaveTypes.find((row) => row.id === sp.edit) ?? null : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave Types"
        description="Maintain the master leave catalog used by leave policy, leave application, balance, approval, payroll, and reporting flows."
      >
        <Button asChild variant="outline">
          <Link href="/hr/leave-policy">Leave Policy</Link>
        </Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SummaryCard title="Total Leave Types" value={String(leaveTypes.length)} />
        <SummaryCard title="Active" value={String(leaveTypes.filter((row) => row.status === 'ACTIVE').length)} />
        <SummaryCard title="Paid Types" value={String(leaveTypes.filter((row) => row.paidLeave).length)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Leave Type Registry</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="flex flex-col gap-3 md:flex-row">
            <Input name="q" defaultValue={q} placeholder="Search by code or leave type name" />
            <div className="flex gap-2">
              <Button type="submit">Search</Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/hr/leave-types">Reset</Link>
              </Button>
            </div>
          </form>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-muted-foreground dark:bg-slate-900/60">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Leave Type</th>
                  <th className="px-4 py-3">Paid</th>
                  <th className="px-4 py-3">Annual Limit</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {leaveTypes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                      No leave types found.
                    </td>
                  </tr>
                ) : (
                  leaveTypes.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3 font-mono text-xs font-semibold">{row.code}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold">{row.name}</div>
                        <div className="text-xs text-muted-foreground">{row.description || 'No description added yet.'}</div>
                      </td>
                      <td className="px-4 py-3">{row.paidLeave ? 'Yes' : 'No'}</td>
                      <td className="px-4 py-3">
                        {row.annualEntitlement == null ? 'Unlimited / policy driven' : `${row.annualEntitlement} Days`}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={row.status === 'ACTIVE' ? 'success' : 'outline'}>{row.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canWrite ? (
                          <Button type="button" size="sm" variant="outline" asChild>
                            <Link href={`/hr/leave-types?edit=${row.id}`}>Edit</Link>
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {canWrite ? (
        <LeaveTypeForm
          mode={initial ? 'edit' : 'create'}
          initial={initial}
          branches={branches.map((branch) => ({ value: branch.id, label: `${branch.code} · ${branch.name}` }))}
          departments={departments}
          designations={designations}
          employmentTypes={employmentTypes}
          path="/hr/leave-types"
        />
      ) : null}
    </div>
  );
}

function SummaryCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="space-y-1 p-4">
        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</div>
        <div className="text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}
