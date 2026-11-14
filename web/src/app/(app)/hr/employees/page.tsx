import Link from 'next/link';
import { Eye, Pencil, Plus, Search, RotateCcw } from 'lucide-react';
import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/money';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Employees' };

const STATUS_VARIANT: Record<string, 'default' | 'outline' | 'success' | 'warning' | 'destructive'> = {
  ACTIVE: 'success',
  ON_LEAVE: 'warning',
  TERMINATED: 'destructive',
  RESIGNED: 'outline',
};

interface EmployeeRow {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  designation: string | null;
  department: string | null;
  status: string;
  basicSalary: string;
  branch: { code: string; name: string };
  systemRole: { name: string } | null;
}

interface BranchRow {
  id: string;
  code: string;
  name: string;
}

interface MasterDataRow {
  id: string;
  name: string;
}

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; branchId?: string; status?: string; department?: string }>;
}) {
  const session = await getSession();
  const canWrite = session?.permissions.includes('hr:write') ?? false;

  const sp = (await searchParams) ?? {};
  const q = sp.q?.trim() || '';
  const branchId = sp.branchId || '';
  const status = sp.status || '';
  const department = sp.department || '';

  const listParams = new URLSearchParams();
  if (q) listParams.set('q', q);
  if (branchId && branchId !== 'ALL') listParams.set('branchId', branchId);
  if (status && status !== 'ALL') listParams.set('status', status);
  if (department && department !== 'ALL') listParams.set('department', department);

  const [branches, departments, employees] = await Promise.all([
    backendFetch<BranchRow[]>('/api/mobile/branches?activeOnly=true').catch(() => []),
    backendFetch<MasterDataRow[]>('/api/mobile/hr/master-data?type=departments').catch(() => []),
    backendFetch<EmployeeRow[]>(`/api/mobile/hr/employees?${listParams.toString()}`).catch(() => []),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader title="Employees" description="All staff on the payroll.">
        {canWrite && (
          <Button asChild>
            <Link href="/hr/employees/new">
              <Plus className="h-4 w-4" />
              New employee
            </Link>
          </Button>
        )}
      </PageHeader>

      <Card>
        <CardContent className="p-4">
          <form method="GET" className="grid grid-cols-1 gap-3 md:grid-cols-5 items-end">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Search</label>
              <div className="relative mt-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  name="q"
                  placeholder="Code, name, phone, email..."
                  defaultValue={q}
                  className="pl-8 text-sm"
                />
              </div>
            </div>

            <div>
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

            <div>
              <label className="text-xs font-medium text-muted-foreground">Department</label>
              <select
                name="department"
                defaultValue={department}
                aria-label="Filter by department"
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="ALL">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <select
                name="status"
                defaultValue={status}
                aria-label="Filter by status"
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="ON_LEAVE">ON_LEAVE</option>
                <option value="RESIGNED">RESIGNED</option>
                <option value="TERMINATED">TERMINATED</option>
              </select>
            </div>

            <div className="flex gap-2">
              <Button type="submit" className="flex-1">
                Filter
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/hr/employees">
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
                <th className="text-left font-semibold px-4 py-3">Code</th>
                <th className="text-left font-semibold px-4 py-3">Name</th>
                <th className="text-left font-semibold px-4 py-3">Designation</th>
                <th className="text-left font-semibold px-4 py-3">Department</th>
                <th className="text-left font-semibold px-4 py-3">Role</th>
                <th className="text-left font-semibold px-4 py-3">Branch</th>
                <th className="text-right font-semibold px-4 py-3 tabular-nums">Basic</th>
                <th className="text-left font-semibold px-4 py-3">Status</th>
                <th className="text-right font-semibold px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {employees.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                    No employees matching the search criteria.
                  </td>
                </tr>
              )}
              {employees.map((e) => (
                <tr key={e.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs">{e.code}</td>
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/hr/employees/${e.id}`} className="hover:text-primary hover:underline">
                      {e.firstName} {e.lastName}
                    </Link>
                    {e.email && <div className="text-xs text-muted-foreground font-normal">{e.email}</div>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{e.designation ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{e.department ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{e.systemRole?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{e.branch?.code ?? '—'}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-mono">
                    {formatCurrency(Number(e.basicSalary) || 0, 'BDT')}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[e.status] ?? 'outline'}>{e.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" asChild>
                        <Link href={`/hr/employees/${e.id}`}>
                          <Eye className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                      {canWrite && (
                        <Button size="sm" variant="ghost" asChild>
                          <Link href={`/hr/employees/${e.id}/edit`}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      )}
                    </div>
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
