import Link from 'next/link';
import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SalaryComponentForm, type SalaryComponentFormInitial } from './salary-component-form';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Salary Components' };

type SearchParams = Promise<{ q?: string; category?: string; type?: string; status?: string; edit?: string }>;

interface FormDataResponse {
  departments: string[];
  designations: string[];
  employmentTypes: string[];
}

export default async function SalaryComponentsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getSession();
  const sp = await searchParams;
  const canWrite = session?.permissions.includes('hr:write') ?? false;
  const q = sp.q ?? '';
  const category = sp.category && sp.category !== 'all' ? sp.category : '';
  const type = sp.type && sp.type !== 'all' ? sp.type : '';
  const status = sp.status && sp.status !== 'all' ? sp.status : '';

  const listParams = new URLSearchParams();
  if (q) listParams.set('q', q);
  if (category) listParams.set('category', category);
  if (type) listParams.set('type', type);
  if (status) listParams.set('status', status);

  const [components, formData] = await Promise.all([
    backendFetch<SalaryComponentFormInitial[]>(`/api/mobile/hr/salary-components?${listParams.toString()}`),
    backendFetch<FormDataResponse>('/api/mobile/hr/salary-components/form-data'),
  ]);

  const initial = sp.edit ? components.find((row) => row.id === sp.edit) ?? null : null;

  return (
    <div className="space-y-6">
      <PageHeader title="Salary Components" description="Define all earnings and deductions that can be used throughout the payroll system." />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Salary Components</CardTitle>
          {canWrite && !sp.edit && (
            <Button asChild size="sm">
              <Link href="/hr/salary-components?edit=new">+ New Salary Component</Link>
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
              <Select name="category" defaultValue={category || 'all'}>
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="EARNINGS">Earnings</SelectItem>
                  <SelectItem value="DEDUCTION">Deduction</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-40 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Type</label>
              <Select name="type" defaultValue={type || 'all'}>
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="FIXED">Fixed</SelectItem>
                  <SelectItem value="VARIABLE">Variable</SelectItem>
                </SelectContent>
              </Select>
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
                        <Badge variant={row.category === 'EARNINGS' ? 'success' : 'destructive'}>{row.category}</Badge>
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
          departments={formData.departments}
          designations={formData.designations}
          employmentTypes={formData.employmentTypes}
          components={components}
          path="/hr/salary-components"
        />
      ) : null}
    </div>
  );
}
