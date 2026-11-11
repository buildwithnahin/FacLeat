import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/server/auth/session';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/money';
import { SalaryStructureAssignmentForm } from './assignment-form';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';

interface SalaryStructureComponentRow {
  id: string;
  value: string;
  isAutoCalculated: boolean;
  salaryComponent: { name: string; category: string; type: string };
}

interface SalaryStructureAssignment {
  id: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  employee: { firstName: string; lastName: string; code: string; department: string | null };
}

interface SalaryStructureDetail {
  id: string;
  name: string;
  code: string;
  status: string;
  effectiveFrom: string;
  payrollFrequency: string;
  employmentTypes: string[];
  currency: string;
  components: SalaryStructureComponentRow[];
  employeeAssignments: SalaryStructureAssignment[];
}

interface AvailableEmployee {
  id: string;
  firstName: string;
  lastName: string;
  code: string;
  department: string | null;
  designation: string | null;
}

export default async function SalaryStructureViewPage({ params }: { params: Promise<{ id: string }> }) {
  const p = await params;
  const session = await getSession();
  const canWrite = session?.permissions.includes('hr:write') ?? false;

  let structure: SalaryStructureDetail;
  try {
    structure = await backendFetch<SalaryStructureDetail>(`/api/mobile/hr/salary-structure/${p.id}`);
  } catch (e) {
    if (e instanceof BackendApiError && e.status === 404) notFound();
    throw e;
  }

  const availableEmployees = await backendFetch<AvailableEmployee[]>(`/api/mobile/hr/salary-structure/${p.id}/available-employees`);

  const activeAssignments = structure.employeeAssignments.filter((a) => !a.effectiveTo || new Date(a.effectiveTo) > new Date());

  let totalEarnings = 0;
  let totalDeductions = 0;
  const earnings = structure.components.filter((c) => c.salaryComponent.category === 'EARNINGS');
  const deductions = structure.components.filter((c) => c.salaryComponent.category === 'DEDUCTION');

  earnings.forEach((c) => (totalEarnings += Number(c.value)));
  deductions.filter((c) => c.salaryComponent.type === 'FIXED').forEach((c) => (totalDeductions += Number(c.value)));

  const currency = structure.currency as 'BDT' | 'INR' | 'USD' | 'EUR';

  return (
    <div className="space-y-6">
      <PageHeader title="Salary Structure Details" description={`View and assign ${structure.name}`}>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/hr/salary-structure">Back to List</Link>
          </Button>
          {canWrite && (
            <Button asChild>
              <Link href={`/hr/salary-structure?edit=${structure.id}`}>Edit Structure</Link>
            </Button>
          )}
        </div>
      </PageHeader>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-6 md:col-span-2">
          <Card>
            <CardHeader className="border-b bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{structure.name}</CardTitle>
                  <CardDescription className="mt-1 font-mono text-xs">{structure.code}</CardDescription>
                </div>
                <Badge variant={structure.status === 'ACTIVE' ? 'default' : 'outline'}>{structure.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-6 border-b">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Effective From</div>
                  <div>{format(new Date(structure.effectiveFrom), 'dd MMM yyyy')}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Payroll Frequency</div>
                  <div>{structure.payrollFrequency}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Employment Types</div>
                  <div>{structure.employmentTypes.length > 0 ? structure.employmentTypes.join(', ') : 'All'}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Active Assignments</div>
                  <div>{activeAssignments.length} Employees</div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-lg text-emerald-600 dark:text-emerald-400 mb-3">Earnings</h4>
                <div className="rounded-md border divide-y">
                  {earnings.length > 0 ? (
                    earnings.map((comp) => (
                      <div key={comp.id} className="flex justify-between p-3 items-center">
                        <div>
                          <div className="font-medium">{comp.salaryComponent.name}</div>
                          <div className="text-xs text-muted-foreground">{comp.isAutoCalculated ? 'Auto-calculated' : 'Fixed'}</div>
                        </div>
                        <div className="font-semibold">{formatCurrency(comp.value, currency)}</div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-muted-foreground text-sm">No earning components</div>
                  )}
                  <div className="flex justify-between p-3 items-center bg-emerald-50 dark:bg-emerald-950/20 font-bold">
                    <div>Gross Earnings</div>
                    <div className="text-emerald-600 dark:text-emerald-400">{formatCurrency(totalEarnings, currency)}</div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-lg text-red-600 dark:text-red-400 mb-3">Deductions</h4>
                <div className="rounded-md border divide-y">
                  {deductions.length > 0 ? (
                    deductions.map((comp) => (
                      <div key={comp.id} className="flex justify-between p-3 items-center">
                        <div>
                          <div className="font-medium">{comp.salaryComponent.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {comp.isAutoCalculated ? 'Variable / Auto-calculated' : 'Fixed'}
                          </div>
                        </div>
                        <div className="font-semibold">
                          {comp.isAutoCalculated && Number(comp.value) === 0 ? 'Calculated at Runtime' : formatCurrency(comp.value, currency)}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-muted-foreground text-sm">No deduction components</div>
                  )}
                  <div className="flex justify-between p-3 items-center bg-red-50 dark:bg-red-950/20 font-bold">
                    <div>Total Fixed Deductions</div>
                    <div className="text-red-600 dark:text-red-400">{formatCurrency(totalDeductions, currency)}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-md border-2 border-blue-100 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/20 p-4 flex justify-between items-center">
                <div className="font-semibold text-lg">Estimated Net Salary</div>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{formatCurrency(totalEarnings - totalDeductions, currency)}</div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {canWrite && <SalaryStructureAssignmentForm structureId={structure.id} employees={availableEmployees} />}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Assigned Employees</CardTitle>
            </CardHeader>
            <CardContent>
              {activeAssignments.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-4">No employees assigned to this structure.</div>
              ) : (
                <div className="space-y-3">
                  {activeAssignments.map((assignment) => (
                    <div key={assignment.id} className="flex flex-col gap-1 border-b pb-2 last:border-0 last:pb-0">
                      <div className="font-medium">
                        {assignment.employee.firstName} {assignment.employee.lastName}
                      </div>
                      <div className="text-xs text-muted-foreground flex justify-between">
                        <span>
                          {assignment.employee.code} • {assignment.employee.department}
                        </span>
                        <span>Since: {format(new Date(assignment.effectiveFrom), 'dd MMM yy')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
