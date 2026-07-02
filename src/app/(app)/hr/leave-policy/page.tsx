import Link from 'next/link';
import { getSession } from '@/server/auth/session';
import { prisma } from '@/server/db';
import { leavePoliciesService } from '@/server/services/leave-policies.service';
import { generateLeavePolicyAssignmentsAction } from '@/server/actions/leave-policies';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LeavePolicyForm } from './leave-policy-form';

export const metadata = { title: 'Leave Policy' };

const EMPLOYMENT_TYPE_OPTIONS = [
  'PERMANENT',
  'PROBATION',
  'INTERNSHIP',
  'CONTRACTUAL',
  'WORKER',
  'STAFF',
  'MANAGEMENT',
];

type SearchParams = Promise<{ edit?: string }>;

export default async function LeavePolicyPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getSession();
  const sp = await searchParams;
  const canWrite = session?.permissions.includes('hr:write') ?? false;

  const [policies, assignableEmployees, branches, departmentRows, designationRows] = await Promise.all([
    leavePoliciesService.list(session),
    leavePoliciesService.listAssignableEmployees(session),
    prisma.branch.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true },
      orderBy: [{ code: 'asc' }],
    }),
    prisma.hrMasterData.findMany({
      where: { type: 'departments', status: 'ACTIVE' },
      select: { id: true, name: true },
      orderBy: [{ name: 'asc' }],
    }),
    prisma.hrMasterData.findMany({
      where: { type: 'designations', status: 'ACTIVE' },
      select: { id: true, name: true },
      orderBy: [{ name: 'asc' }],
    }),
  ]);

  const initialPolicy = sp.edit ? policies.find((policy) => policy.id === sp.edit) ?? null : null;
  const departments = Array.from(new Set([...departmentRows.map((row) => row.name), ...assignableEmployees.map((employee) => employee.department).filter(Boolean) as string[]])).sort();
  const designations = Array.from(new Set([...designationRows.map((row) => row.name), ...assignableEmployees.map((employee) => employee.designation).filter(Boolean) as string[]])).sort();
  const employmentTypes = Array.from(new Set([...EMPLOYMENT_TYPE_OPTIONS, ...assignableEmployees.map((employee) => employee.employmentType).filter(Boolean) as string[]])).sort();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave Policy Setup"
        description="Create leave policies, define leave-type rules, assign employees, and drive leave balance validation from one setup page."
      >
        <Button asChild variant="outline">
          <Link href="/hr/leaves">Leave Application</Link>
        </Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard title="Saved Policies" value={String(policies.length)} />
        <SummaryCard title="Active Policies" value={String(policies.filter((policy) => policy.status === 'ACTIVE').length)} />
        <SummaryCard title="Draft Policies" value={String(policies.filter((policy) => policy.status === 'DRAFT').length)} />
        <SummaryCard
          title="Assigned Employees"
          value={String(policies.reduce((sum, policy) => sum + policy.assignedEmployees.length, 0))}
        />
        <SummaryCard
          title="Rule Rows"
          value={String(policies.reduce((sum, policy) => sum + policy.rules.length, 0))}
        />
      </div>

      {canWrite ? (
        <LeavePolicyForm
          mode={initialPolicy ? 'edit' : 'create'}
          initial={initialPolicy}
          branches={branches.map((branch) => ({ id: branch.id, label: `${branch.code} · ${branch.name}` }))}
          departments={departments}
          designations={designations}
          employmentTypes={employmentTypes}
          employees={assignableEmployees}
          path="/hr/leave-policy"
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Saved Policy List</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-muted-foreground dark:bg-slate-900/60">
                <tr>
                  <th className="px-4 py-3">Policy Code</th>
                  <th className="px-4 py-3">Policy Name</th>
                  <th className="px-4 py-3">Branch</th>
                  <th className="px-4 py-3">Employee Type</th>
                  <th className="px-4 py-3">Effective From</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Rules</th>
                  <th className="px-4 py-3">Assigned</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {policies.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                      No leave policies saved yet.
                    </td>
                  </tr>
                ) : (
                  policies.map((policy) => (
                    <tr key={policy.id}>
                      <td className="px-4 py-3 font-mono text-xs font-semibold">{policy.policyCode}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold">{policy.policyName}</div>
                        <div className="text-xs text-muted-foreground">
                          {[policy.department, policy.designation].filter(Boolean).join(' · ') || 'All applicable employees'}
                        </div>
                      </td>
                      <td className="px-4 py-3">{policy.branch?.code ?? 'All branches'}</td>
                      <td className="px-4 py-3">{policy.employmentType ?? 'All'}</td>
                      <td className="px-4 py-3">{policy.effectiveFrom ?? '—'}</td>
                      <td className="px-4 py-3">
                        <Badge variant={policy.status === 'ACTIVE' ? 'success' : 'outline'}>{policy.status}</Badge>
                      </td>
                      <td className="px-4 py-3">{policy.rules.length}</td>
                      <td className="px-4 py-3">{policy.assignedEmployees.length}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {canWrite ? (
                            <Button type="button" size="sm" variant="outline" asChild>
                              <Link href={`/hr/leave-policy?edit=${policy.id}`}>Edit</Link>
                            </Button>
                          ) : null}
                          {canWrite ? (
                            <form action={generateLeavePolicyAssignmentsAction}>
                              <input type="hidden" name="policyId" value={policy.id} />
                              <Button type="submit" size="sm" variant="ghost">
                                Assign & Refresh Balance
                              </Button>
                            </form>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
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
