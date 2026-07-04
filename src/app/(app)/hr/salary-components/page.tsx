import Link from 'next/link';
import { getSession } from '@/server/auth/session';
import { prisma } from '@/server/db';
import { SalaryComponentsService } from '@/server/services/salary-components.service';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SalaryComponentForm } from './salary-component-form';

export const metadata = { title: 'Salary Components' };

const EMPLOYMENT_TYPE_OPTIONS = [
  'PERMANENT',
  'PROBATION',
  'INTERNSHIP',
  'CONTRACTUAL',
  'WORKER',
  'STAFF',
  'MANAGEMENT',
];

type SearchParams = Promise<{ q?: string; category?: string; type?: string; status?: string; edit?: string }>;

export default async function SalaryComponentsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getSession();
  const sp = await searchParams;
  const canWrite = session?.permissions.includes('hr:write') ?? false;
  const q = sp.q ?? '';
  const category = sp.category ?? '';
  const type = sp.type ?? '';
  const status = sp.status ?? '';

  const [components, departmentRows, designationRows, employees] = await Promise.all([
    SalaryComponentsService.getSalaryComponents({ search: q, category, type, status }),
    prisma.hrMasterData.findMany({
      where: { type: 'departments', status: 'ACTIVE' },
      select: { name: true },
      orderBy: [{ name: 'asc' }],
    }),
    prisma.hrMasterData.findMany({
      where: { type: 'designations', status: 'ACTIVE' },
      select: { name: true },
      orderBy: [{ name: 'asc' }],
    }),
    prisma.employee.findMany({
      where: { status: { in: ['ACTIVE', 'ON_LEAVE'] } },
      select: { employmentType: true, department: true, designation: true },
    }),
  ]);

  const initial = sp.edit ? components.find((row) => row.id === sp.edit) ?? null : null;
  const departments = Array.from(new Set([...departmentRows.map((row) => row.name), ...employees.map((row) => row.department).filter(Boolean) as string[]])).sort();
  const designations = Array.from(new Set([...designationRows.map((row) => row.name), ...employees.map((row) => row.designation).filter(Boolean) as string[]])).sort();
  const employmentTypes = Array.from(new Set([...EMPLOYMENT_TYPE_OPTIONS, ...employees.map((row) => row.employmentType).filter(Boolean) as string[]])).sort();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Salary Components"
        description="Define all earnings and deductions that can be used throughout the payroll system."
      >
        <Button asChild variant="outline">
          <Link href="/hr/salary-structure">Salary Structure</Link>
        </Button>
      </PageHeader>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Salary Components</CardTitle>
          {canWrite && !sp.edit && (
            <Button asChild size="sm">
              <Link href="/hr/salary-components?edit=new">
                + New Salary Component
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
            <div className="w-40 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Category</label>
              <Select name="category" defaultValue={category}>
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
                  <SelectItem value="EARNINGS">Earnings</SelectItem>
                  <SelectItem value="DEDUCTION">Deduction</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-40 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Type</label>
              <Select name="type" defaultValue={type}>
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
                  <SelectItem value="FIXED">Fixed</SelectItem>
                  <SelectItem value="VARIABLE">Variable</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-40 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <Select name="status" defaultValue={status}>
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button type="submit">Filter</Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/hr/salary-components">Reset</Link>
              </Button>
            </div>
          </form>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-muted-foreground dark:bg-slate-900/60">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Component Name</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Taxable</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {components.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                      No salary components found.
                    </td>
                  </tr>
                ) : (
                  components.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3 font-mono text-xs font-semibold">{row.code}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold">{row.name}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[200px]">{row.description || 'No description'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={row.category === 'EARNINGS' ? 'success' : 'destructive'}>
                          {row.category}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">{row.type}</td>
                      <td className="px-4 py-3">{row.isTaxable ? 'Yes' : 'No'}</td>
                      <td className="px-4 py-3">
                        <Badge variant={row.status === 'ACTIVE' ? 'default' : 'outline'}>{row.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canWrite ? (
                          <Button type="button" size="sm" variant="outline" asChild>
                            <Link href={`/hr/salary-components?edit=${row.id}`}>Edit</Link>
                          </Button>
                        ) : (
                          <Button type="button" size="sm" variant="ghost" asChild>
                            <Link href={`/hr/salary-components/${row.id}`}>View</Link>
                          </Button>
                        )}
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
        <SalaryComponentForm
          mode={sp.edit === 'new' ? 'create' : 'edit'}
          initial={sp.edit === 'new' ? null : initial}
          departments={departments}
          designations={designations}
          employmentTypes={employmentTypes}
          components={components}
          path="/hr/salary-components"
        />
      ) : null}
    </div>
  );
}
