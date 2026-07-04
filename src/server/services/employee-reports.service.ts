import 'server-only';

import { Prisma } from '@prisma/client';
import { authorize } from '@/server/auth/authorize';
import type { AppSession } from '@/server/auth/session';
import { prisma } from '@/server/db';

export const EMPLOYEE_REPORT_TYPES = [
  'EMPLOYEE_LIST',
  'EMPLOYEE_DIRECTORY',
  'DEPARTMENT_WISE',
  'DESIGNATION_WISE',
  'BRANCH_WISE',
  'SHIFT_WISE',
  'EMPLOYMENT_TYPE_WISE',
  'JOINING_REPORT',
  'CONTRACT_EXPIRY',
  'EMPLOYEE_STATUS',
] as const;

export type EmployeeReportType = (typeof EMPLOYEE_REPORT_TYPES)[number];

export type EmployeeReportFilters = {
  reportType?: EmployeeReportType;
  branchId?: string;
  department?: string;
  designation?: string;
  shiftId?: string;
  employmentType?: string;
  employeeStatus?: string;
  employeeId?: string;
  joiningFrom?: string;
  joiningTo?: string;
};

type EmployeeWithRelations = Prisma.EmployeeGetPayload<{
  include: {
    branch: { select: { id: true; code: true; name: true } };
    shift: { select: { id: true; code: true; name: true } };
  };
}>;

type ContractWithEmployee = Prisma.ContractGetPayload<{
  include: {
    employee: {
      include: {
        branch: { select: { id: true; code: true; name: true } };
      };
    };
    branch: { select: { id: true; code: true; name: true } };
  };
}>;

function normalizeDateStart(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
}

function normalizeDateEnd(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

function formatDate(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : '—';
}

function formatStatusLabel(value: string | null | undefined) {
  if (!value) return 'Unspecified';
  return value.replaceAll('_', ' ');
}

function daysUntil(date: Date) {
  const today = new Date();
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  return Math.ceil((date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

function buildEmployeeWhere(filters: EmployeeReportFilters): Prisma.EmployeeWhereInput {
  const joinedAt: Prisma.DateTimeFilter = {};
  const from = normalizeDateStart(filters.joiningFrom);
  const to = normalizeDateEnd(filters.joiningTo);
  if (from) joinedAt.gte = from;
  if (to) joinedAt.lte = to;

  const employeeWhere: Prisma.EmployeeWhereInput = {
    branchId: filters.branchId || undefined,
    department: filters.department || undefined,
    designation: filters.designation || undefined,
    shiftId: filters.shiftId || undefined,
    employmentType: filters.employmentType || undefined,
    id: filters.employeeId || undefined,
    joinedAt: Object.keys(joinedAt).length ? joinedAt : undefined,
  };

  if (filters.employeeStatus === 'INACTIVE') {
    employeeWhere.status = { in: ['RESIGNED', 'TERMINATED'] };
  } else if (filters.employeeStatus) {
    employeeWhere.status = filters.employeeStatus as never;
  }

  return employeeWhere;
}

function summarizeBy<T extends string>(
  items: T[],
): Array<{ label: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item, (counts.get(item) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function buildReportData(reportType: EmployeeReportType, employees: EmployeeWithRelations[], contracts: ContractWithEmployee[]) {
  switch (reportType) {
    case 'EMPLOYEE_LIST':
      return {
        title: 'Employee List',
        description: 'Complete employee register based on the selected filters.',
        columns: ['Employee ID', 'Employee Name', 'Department', 'Designation', 'Branch', 'Shift', 'Employment Type', 'Status'],
        rows: employees.map((employee) => [
          employee.code,
          `${employee.firstName} ${employee.lastName}`,
          employee.department ?? '—',
          employee.designation ?? '—',
          employee.branch.name,
          employee.shift?.name ?? 'Unassigned',
          employee.employmentType ?? '—',
          formatStatusLabel(employee.status),
        ]),
      };
    case 'EMPLOYEE_DIRECTORY':
      return {
        title: 'Employee Directory',
        description: 'Contact directory based on the selected employee population.',
        columns: ['Employee', 'Department', 'Phone', 'Email'],
        rows: employees.map((employee) => [
          `${employee.code} · ${employee.firstName} ${employee.lastName}`,
          employee.department ?? '—',
          employee.phone ?? '—',
          employee.email ?? '—',
        ]),
      };
    case 'DEPARTMENT_WISE':
      return {
        title: 'Department Wise Report',
        description: 'Headcount grouped by department.',
        columns: ['Department', 'Employees'],
        rows: summarizeBy(employees.map((employee) => employee.department ?? 'Unassigned')).map((row) => [row.label, row.count]),
      };
    case 'DESIGNATION_WISE':
      return {
        title: 'Designation Wise Report',
        description: 'Headcount grouped by designation.',
        columns: ['Designation', 'Employees'],
        rows: summarizeBy(employees.map((employee) => employee.designation ?? 'Unassigned')).map((row) => [row.label, row.count]),
      };
    case 'BRANCH_WISE':
      return {
        title: 'Branch Wise Report',
        description: 'Headcount grouped by branch.',
        columns: ['Branch', 'Employees'],
        rows: summarizeBy(employees.map((employee) => employee.branch.name)).map((row) => [row.label, row.count]),
      };
    case 'SHIFT_WISE':
      return {
        title: 'Shift Wise Report',
        description: 'Headcount grouped by shift assignment.',
        columns: ['Shift', 'Employees'],
        rows: summarizeBy(employees.map((employee) => employee.shift?.name ?? 'Unassigned')).map((row) => [row.label, row.count]),
      };
    case 'EMPLOYMENT_TYPE_WISE':
      return {
        title: 'Employment Type Wise Report',
        description: 'Headcount grouped by employment type.',
        columns: ['Employment Type', 'Employees'],
        rows: summarizeBy(employees.map((employee) => employee.employmentType ?? 'Unspecified')).map((row) => [row.label, row.count]),
      };
    case 'JOINING_REPORT':
      return {
        title: 'Joining Report',
        description: 'Employees with their joining details.',
        columns: ['Employee ID', 'Employee Name', 'Joining Date', 'Department', 'Designation', 'Branch', 'Employment Type', 'Status'],
        rows: employees
          .slice()
          .sort((a, b) => b.joinedAt.getTime() - a.joinedAt.getTime())
          .map((employee) => [
            employee.code,
            `${employee.firstName} ${employee.lastName}`,
            formatDate(employee.joinedAt),
            employee.department ?? '—',
            employee.designation ?? '—',
            employee.branch.name,
            employee.employmentType ?? '—',
            formatStatusLabel(employee.status),
          ]),
      };
    case 'CONTRACT_EXPIRY':
      return {
        title: 'Contract Expiry Report',
        description: 'Employee contracts with an end date, sorted by nearest expiry.',
        columns: ['Contract No', 'Employee', 'Branch', 'Department', 'Designation', 'Contract Type', 'Start Date', 'End Date', 'Days Left', 'Status'],
        rows: contracts
          .filter((contract) => contract.endDate)
          .slice()
          .sort((a, b) => (a.endDate?.getTime() ?? 0) - (b.endDate?.getTime() ?? 0))
          .map((contract) => [
            contract.contractNo,
            contract.employee ? `${contract.employee.code} · ${contract.employee.firstName} ${contract.employee.lastName}` : contract.candidateName ?? '—',
            contract.employee?.branch.name ?? contract.branch?.name ?? '—',
            contract.department ?? contract.employee?.department ?? '—',
            contract.designation ?? contract.employee?.designation ?? '—',
            contract.contractType,
            formatDate(contract.startDate),
            formatDate(contract.endDate),
            contract.endDate ? daysUntil(contract.endDate) : '—',
            contract.status,
          ]),
      };
    case 'EMPLOYEE_STATUS':
    default:
      return {
        title: 'Employee Status Report',
        description: 'Headcount grouped by employee status.',
        columns: ['Status', 'Employees'],
        rows: summarizeBy(employees.map((employee) => formatStatusLabel(employee.status))).map((row) => [row.label, row.count]),
      };
  }
}

export const employeeReportsService = {
  async getReportCenter(session: AppSession | null, filters: EmployeeReportFilters = {}) {
    await authorize(session, 'hr:read');

    const reportType = filters.reportType ?? 'EMPLOYEE_LIST';
    const employeeWhere = buildEmployeeWhere(filters);

    const [branches, shifts, allEmployees, filteredEmployees, filteredContracts, totals] = await Promise.all([
      prisma.branch.findMany({
        where: { isActive: true },
        select: { id: true, code: true, name: true },
        orderBy: [{ code: 'asc' }],
      }),
      prisma.shift.findMany({
        select: { id: true, code: true, name: true },
        orderBy: [{ code: 'asc' }],
      }),
      prisma.employee.findMany({
        include: {
          branch: { select: { id: true, code: true, name: true } },
          shift: { select: { id: true, code: true, name: true } },
        },
        orderBy: [{ code: 'asc' }],
      }),
      prisma.employee.findMany({
        where: employeeWhere,
        include: {
          branch: { select: { id: true, code: true, name: true } },
          shift: { select: { id: true, code: true, name: true } },
        },
        orderBy: [{ code: 'asc' }],
      }),
      prisma.contract.findMany({
        where: {
          employeeId: { not: null },
          employee: { is: employeeWhere },
        },
        include: {
          employee: {
            include: {
              branch: { select: { id: true, code: true, name: true } },
            },
          },
          branch: { select: { id: true, code: true, name: true } },
        },
        orderBy: [{ endDate: 'asc' }, { contractNo: 'asc' }],
      }),
      prisma.employee.groupBy({
        by: ['status', 'employmentType'],
        _count: { _all: true },
      }),
    ]);

    const departmentOptions = Array.from(new Set(allEmployees.map((employee) => employee.department).filter(Boolean) as string[])).sort((a, b) =>
      a.localeCompare(b),
    );
    const designationOptions = Array.from(new Set(allEmployees.map((employee) => employee.designation).filter(Boolean) as string[])).sort((a, b) =>
      a.localeCompare(b),
    );
    const employmentTypeOptions = Array.from(new Set(allEmployees.map((employee) => employee.employmentType).filter(Boolean) as string[])).sort((a, b) =>
      a.localeCompare(b),
    );

    const totalEmployees = allEmployees.length;
    const activeEmployees = totals
      .filter((row) => row.status === 'ACTIVE' || row.status === 'ON_LEAVE')
      .reduce((sum, row) => sum + row._count._all, 0);
    const inactiveEmployees = totals
      .filter((row) => row.status === 'RESIGNED' || row.status === 'TERMINATED')
      .reduce((sum, row) => sum + row._count._all, 0);
    const probationEmployees = totals
      .filter((row) => row.employmentType === 'PROBATION')
      .reduce((sum, row) => sum + row._count._all, 0);
    const contractEmployees = totals
      .filter((row) => row.employmentType === 'CONTRACT')
      .reduce((sum, row) => sum + row._count._all, 0);

    return {
      filters: {
        reportType,
        branchId: filters.branchId ?? '',
        department: filters.department ?? '',
        designation: filters.designation ?? '',
        shiftId: filters.shiftId ?? '',
        employmentType: filters.employmentType ?? '',
        employeeStatus: filters.employeeStatus ?? '',
        employeeId: filters.employeeId ?? '',
        joiningFrom: filters.joiningFrom ?? '',
        joiningTo: filters.joiningTo ?? '',
      },
      options: {
        branches,
        departments: departmentOptions,
        designations: designationOptions,
        shifts: shifts.map((shift) => ({ id: shift.id, label: `${shift.code} · ${shift.name}` })),
        employmentTypes: employmentTypeOptions,
        employees: allEmployees
          .filter((employee) => Boolean(employee.id))
          .map((employee) => ({
            value: employee.id,
            label: `${employee.code} · ${employee.firstName} ${employee.lastName}`,
          })),
      },
      dashboard: {
        totalEmployees,
        activeEmployees,
        inactiveEmployees,
        probationEmployees,
        contractEmployees,
      },
      report: buildReportData(reportType, filteredEmployees, filteredContracts),
      meta: {
        filteredEmployees: filteredEmployees.length,
        filteredContracts: filteredContracts.filter((contract) => contract.endDate).length,
      },
    };
  },
};
