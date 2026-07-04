import Link from 'next/link';
import { getSession } from '@/server/auth/session';
import { prisma } from '@/server/db';
import { SalaryStructuresService } from '@/server/services/salary-structures.service';
import { SalaryComponentsService } from '@/server/services/salary-components.service';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SalaryStructureForm } from './salary-structure-form';
import { formatCurrency } from '@/lib/utils';

export const metadata = { title: 'Salary Structure' };

const EMPLOYMENT_TYPE_OPTIONS = [
  'PERMANENT',
  'PROBATION',
  'INTERNSHIP',
  'CONTRACTUAL',
  'WORKER',
  'STAFF',
  'MANAGEMENT',
];

type SearchParams = Promise<{ q?: string; status?: string; edit?: string }>;

export default async function SalaryStructuresPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getSession();
  const sp = await searchParams;
  const canWrite = session?.permissions.includes('hr:write') ?? false;
  const q = sp.q ?? '';
  const status = sp.status ?? '';

  const [structures, salaryComponents, departmentRows, designationRows, employees, branches] = await Promise.all([
    SalaryStructuresService.getSalaryStructures({ search: q, status }),
    SalaryComponentsService.getSalaryComponents({ status: 'ACTIVE' }),
    prisma.hrMasterData.findMany({
      where: { type: 'departments', status: 'ACTIVE' },
      select: { name: true, id: true },
      orderBy: [{ name: 'asc' }],
    }),
    prisma.hrMasterData.findMany({
      where: { type: 'designations', status: 'ACTIVE' },
      select: { name: true, id: true },
      orderBy: [{ name: 'asc' }],
    }),
    prisma.employee.findMany({
      where: { status: { in: ['ACTIVE', 'ON_LEAVE'] } },
      select: { employmentType: true, department: true, designation: true },
    }),
    prisma.branch.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true },
    })
  ]);

  const initialId = sp.edit && sp.edit !== 'new' ? sp.edit : null;
  const initial = initialId ? await SalaryStructuresService.getSalaryStructureById(initialId).catch(() => null) : null;
  
  const departments = Array.from(new Set([...departmentRows.map((row) => row.id), ...employees.map((row) => row.department).filter(Boolean) as string[]]));
  const designations = Array.from(new Set([...designationRows.map((row) => row.id), ...employees.map((row) => row.designation).filter(Boolean) as string[]]));
  const employmentTypes = Array.from(new Set([...EMPLOYMENT_TYPE_OPTIONS, ...employees.map((row) => row.employmentType).filter(Boolean) as string[]]));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Salary Structure"
        description="Combine salary components into reusable templates and assign them to employees."
      >
        <Button asChild variant="outline">
          <Link href="/hr/salary-components">Manage Components</Link>
        </Button>
      </PageHeader>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Salary Structures</CardTitle>
          {canWrite && !sp.edit && (
            <Button asChild size="sm">
              <Link href="/hr/salary-structure?edit=new">
                + New Salary Structure
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
                      <td className="px-4 py-3 font-medium">{formatCurrency(row.grossSalary.toNumber(), row.currency)}</td>
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
          departments={departments}
          designations={designations}
          employmentTypes={employmentTypes}
          branches={branches}
          salaryComponents={salaryComponents}
          path="/hr/salary-structure"
        />
      ) : null}
    </div>
  );
}
