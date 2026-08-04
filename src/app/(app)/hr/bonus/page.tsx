import { prisma } from '@/server/db';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';
import { BonusService } from '@/server/services/bonus.service';
import { BonusForm } from './bonus-form';
import { Prisma } from '@prisma/client';
import { getSession } from '@/server/auth/session';

function serializeEmployee(employee: {
  id: string;
  firstName: string;
  lastName: string;
  code: string;
  basicSalary: Prisma.Decimal | number | null;
}) {
  return {
    ...employee,
    basicSalary: employee.basicSalary ? Number(employee.basicSalary) : 0,
  };
}

function serializeBonusForForm(initial: Awaited<ReturnType<typeof BonusService.getBonusById>>) {
  if (!initial) return null;

  return {
    ...initial,
    amount: initial.amount ? Number(initial.amount) : null,
    percentage: initial.percentage ? Number(initial.percentage) : null,
    employeeBonuses: initial.employeeBonuses.map((employeeBonus) => ({
      ...employeeBonus,
      amount: Number(employeeBonus.amount),
      employee: {
        ...employeeBonus.employee,
        basicSalary: employeeBonus.employee.basicSalary ? Number(employeeBonus.employee.basicSalary) : 0,
        salaryStructureAssignments: employeeBonus.employee.salaryStructureAssignments.map((assignment) => ({
          ...assignment,
          salaryStructure: {
            ...assignment.salaryStructure,
            grossSalary: Number(assignment.salaryStructure.grossSalary),
            netSalary: assignment.salaryStructure.netSalary ? Number(assignment.salaryStructure.netSalary) : null,
          },
        })),
      },
    })),
  };
}

export default async function BonusPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const session = await getSession();

  const stats = await BonusService.getDashboardStats(session);

  const where: Prisma.BonusWhereInput = {};
  if (sp.status) where.status = sp.status as any;
  if (sp.bonusType) where.bonusType = sp.bonusType as any;
  if (sp.q) {
    where.OR = [
      { name: { contains: sp.q as string, mode: 'insensitive' } },
      { code: { contains: sp.q as string, mode: 'insensitive' } },
    ];
  }

  const bonuses = await BonusService.getBonuses(session, where);

  const isEditing = sp.edit;
  let initial = null;
  if (isEditing && isEditing !== 'new') {
    initial = await BonusService.getBonusById(session, isEditing as string);
  }

  // Fetch employees for creation
  const employees = await prisma.employee.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, firstName: true, lastName: true, code: true, basicSalary: true },
    orderBy: [{ firstName: 'asc' }],
  });

  const serializedEmployees = employees.map(serializeEmployee);
  const serializedInitial = serializeBonusForForm(initial);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bonus & Incentives"
        description="Manage employee bonuses, festival bonuses, and incentives."
        breadcrumbs={[
          { label: 'HR', href: '/hr' },
          { label: 'Payroll', href: '/hr/payroll' },
          { label: 'Bonus', href: '/hr/bonus' },
        ]}
      />

      {/* Dashboard Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Bonus</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingBonus}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Approved Bonus</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{stats.approvedBonus}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.thisMonthAmount)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">Employees Eligible</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.eligibleEmployees}</div>
          </CardContent>
        </Card>
      </div>

      {!isEditing ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Bonus List</CardTitle>
            <Button asChild size="sm">
              <Link href="/hr/bonus?edit=new">+ Create Bonus</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="flex gap-4 items-end bg-slate-50 dark:bg-slate-900/40 p-4 rounded-md border">
              <div className="space-y-1 flex-1">
                <label className="text-xs font-medium text-muted-foreground">Search</label>
                <Input name="q" placeholder="Code or Name..." defaultValue={sp.q as string} />
              </div>
              <div className="space-y-1 flex-1">
                <label className="text-xs font-medium text-muted-foreground">Bonus Type</label>
                <Select name="bonusType" defaultValue={sp.bonusType as string}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FESTIVAL">Festival Bonus</SelectItem>
                    <SelectItem value="ATTENDANCE">Attendance Bonus</SelectItem>
                    <SelectItem value="PRODUCTION">Production Bonus</SelectItem>
                    <SelectItem value="PERFORMANCE">Performance Bonus</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 flex-1">
                <label className="text-xs font-medium text-muted-foreground">Status</label>
                <Select name="status" defaultValue={sp.status as string}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="SUBMITTED">Submitted</SelectItem>
                    <SelectItem value="PENDING_HR">Pending HR</SelectItem>
                    <SelectItem value="PENDING_MANAGEMENT">Pending Management</SelectItem>
                    <SelectItem value="APPROVED">Approved</SelectItem>
                    <SelectItem value="PUBLISHED">Published</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button type="submit">Filter</Button>
                <Button type="button" variant="outline" asChild>
                  <Link href="/hr/bonus">Reset</Link>
                </Button>
              </div>
            </form>

            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium">Bonus No</th>
                    <th className="px-4 py-3 text-left font-medium">Bonus Name</th>
                    <th className="px-4 py-3 text-left font-medium">Bonus Type</th>
                    <th className="px-4 py-3 text-left font-medium">Effective Month</th>
                    <th className="px-4 py-3 text-left font-medium">Employees</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {bonuses.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                        No bonuses found.
                      </td>
                    </tr>
                  ) : (
                    bonuses.map((row) => (
                      <tr key={row.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                        <td className="px-4 py-3 font-medium">{row.code}</td>
                        <td className="px-4 py-3">{row.name}</td>
                        <td className="px-4 py-3">{row.bonusType}</td>
                        <td className="px-4 py-3">{row.effectivePayrollMonth}</td>
                        <td className="px-4 py-3">{row._count.employeeBonuses}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold
                            ${row.status === 'APPROVED' || row.status === 'PUBLISHED' || row.status === 'PAID' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' : ''}
                            ${row.status === 'DRAFT' || row.status === 'SUBMITTED' ? 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400' : ''}
                            ${row.status === 'PENDING_HR' || row.status === 'PENDING_MANAGEMENT' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' : ''}
                            ${row.status === 'REJECTED' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' : ''}
                          `}>
                            {row.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {['DRAFT', 'SUBMITTED'].includes(row.status) ? (
                            <Button type="button" size="sm" variant="outline" asChild>
                              <Link href={`/hr/bonus?edit=${row.id}`}>Edit</Link>
                            </Button>
                          ) : (
                            <Button type="button" size="sm" variant="ghost" asChild>
                              <Link href={`/hr/bonus/${row.id}`}>View</Link>
                            </Button>
                          )}
                          <Button type="button" size="sm" variant="ghost" className="ml-2" asChild>
                            <Link href={`/hr/bonus/${row.id}`}>Review</Link>
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
      ) : (
        <BonusForm
          mode={sp.edit === 'new' ? 'create' : 'edit'}
          initialData={sp.edit === 'new' ? null : serializedInitial}
          employees={serializedEmployees}
          path="/hr/bonus"
        />
      )}
    </div>
  );
}
