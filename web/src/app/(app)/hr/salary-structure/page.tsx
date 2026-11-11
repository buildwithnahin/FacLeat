import Link from 'next/link';
import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SalaryStructureForm } from './salary-structure-form';
import { formatCurrency } from '@/lib/money';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Salary Structure' };

type SearchParams = Promise<{ q?: string; status?: string; edit?: string }>;

interface SalaryStructureRow {
  id: string;
  name: string;
  code: string;
  status: string;
  grossSalary: string;
  currency: string;
  employmentTypes: string[];
  _count: { employeeAssignments: number };
}

interface SalaryComponentOption {
  id: string;
  name: string;
  code: string;
  category: string;
  type: string;
  calculationType: string;
  value: number | null;
  baseComponent?: string | null;
  includeInGross?: boolean;
  includeInNet?: boolean;
}

interface FormDataResponse {
  salaryComponents: SalaryComponentOption[];
  departments: string[];
  designations: string[];
  employmentTypes: string[];
  branches: { id: string; code: string; name: string }[];
}

interface SalaryStructureDetail {
  id: string;
  name: string;
  code: string;
  description: string | null;
  status: string;
  grossSalary: string;
  netSalary: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  payrollFrequency: string;
  currency: string;
  employmentTypes: string[];
  departmentIds: string[];
  designationIds: string[];
  branchIds: string[];
  notes: string | null;
  components: { salaryComponentId: string; value: string; isAutoCalculated: boolean }[];
}

export default async function SalaryStructuresPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getSession();
  const sp = await searchParams;
  const canWrite = session?.permissions.includes('hr:write') ?? false;
  const q = sp.q ?? '';
  const status = sp.status && sp.status !== 'all' ? sp.status : '';

  const listParams = new URLSearchParams();
  if (q) listParams.set('q', q);
  if (status) listParams.set('status', status);

  const [structures, formData] = await Promise.all([
    backendFetch<SalaryStructureRow[]>(`/api/mobile/hr/salary-structure?${listParams.toString()}`),
    backendFetch<FormDataResponse>('/api/mobile/hr/salary-structure/form-data'),
  ]);

  const initialId = sp.edit && sp.edit !== 'new' ? sp.edit : null;
  const initial = initialId
    ? await backendFetch<SalaryStructureDetail>(`/api/mobile/hr/salary-structure/${initialId}`).catch(() => null)
    : null;

  return (
    <div className="space-y-6">
      <PageHeader title="Salary Structure" description="Combine salary components into reusable templates and assign them to employees.">
        <Button asChild variant="outline">
          <Link href="/hr/salary-components">Manage Components</Link>
        </Button>
      </PageHeader>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Salary Structures</CardTitle>
          {canWrite && !sp.edit && (
            <Button asChild size="sm">
              <Link href="/hr/salary-structure?edit=new">+ New Salary Structure</Link>
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Search</label>
              <Input name="q" defaultValue={q} placeholder="Search by name or code..." />
            </div>
            <div className="w-40 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <Select name="status" defaultValue={status || 'all'}>
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button type="submit">Filter</Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/hr/salary-structure">Reset</Link>
              </Button>
            </div>
          </form>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-muted-foreground dark:bg-slate-900/60">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Structure Name</th>
                  <th className="px-4 py-3">Employee Types</th>
                  <th className="px-4 py-3">Gross Salary</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {structures.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                      No salary structures found.
                    </td>
                  </tr>
                ) : (
                  structures.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3 font-mono text-xs font-semibold">{row.code}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold">{row.name}</div>
                        <div className="text-xs text-muted-foreground">{row._count.employeeAssignments} Employees Assigned</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="max-w-[200px] truncate">
                          {row.employmentTypes.length > 0 ? row.employmentTypes.join(', ') : 'All Types'}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium">{formatCurrency(row.grossSalary, row.currency as 'BDT' | 'INR' | 'USD' | 'EUR')}</td>
                      <td className="px-4 py-3">
                        <Badge variant={row.status === 'ACTIVE' ? 'default' : 'outline'}>{row.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canWrite ? (
                          <Button type="button" size="sm" variant="outline" asChild>
                            <Link href={`/hr/salary-structure?edit=${row.id}`}>Edit</Link>
                          </Button>
                        ) : (
                          <Button type="button" size="sm" variant="ghost" asChild>
                            <Link href={`/hr/salary-structure/${row.id}`}>View</Link>
                          </Button>
                        )}
                        <Button type="button" size="sm" variant="ghost" className="ml-2" asChild>
                          <Link href={`/hr/salary-structure/${row.id}`}>View Details</Link>
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
        <SalaryStructureForm
          mode={sp.edit === 'new' ? 'create' : 'edit'}
          initial={sp.edit === 'new' ? null : initial}
          departments={formData.departments}
          designations={formData.designations}
          employmentTypes={formData.employmentTypes}
          branches={formData.branches}
          salaryComponents={formData.salaryComponents}
          path="/hr/salary-structure"
        />
      ) : null}
    </div>
  );
}
