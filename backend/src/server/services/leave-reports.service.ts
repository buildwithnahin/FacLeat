import 'server-only';

import type { Prisma } from '@prisma/client';
import { authorize } from '@/server/auth/authorize';
import type { AppSession } from '@/server/auth/session';
import { prisma } from '@/server/db';
import { leaveBalanceService, type BalanceRow } from '@/server/services/leave-balance.service';

export const LEAVE_REPORT_TYPES = [
  'LEAVE_APPLICATION',
  'LEAVE_APPROVAL',
  'LEAVE_BALANCE',
  'LEAVE_UTILIZATION',
  'LEAVE_ENCASHMENT',
  'LEAVE_SUMMARY',
  'EMPLOYEE_LEAVE_HISTORY',
  'LEAVE_TYPE_ANALYSIS',
  'LEAVE_TREND',
] as const;

export type LeaveReportType = (typeof LEAVE_REPORT_TYPES)[number];

export type LeaveReportFilters = {
  reportType?: LeaveReportType;
  branchId?: string;
  department?: string;
  designation?: string;
  employeeId?: string;
  employmentType?: string;
  leaveType?: string;
  leaveStatus?: string;
  dateFrom?: string;
  dateTo?: string;
  payrollYear?: string;
};

type LeaveRequestRecord = Prisma.LeaveRequestGetPayload<{
  include: {
    employee: {
      select: {
        id: true;
        code: true;
        firstName: true;
        lastName: true;
        department: true;
        designation: true;
        employmentType: true;
        branchId: true;
        branch: { select: { id: true; code: true; name: true } };
      };
    };
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

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function currentYearString() {
  return String(new Date().getUTCFullYear());
}

function matchesRequestFilters(record: LeaveRequestRecord, filters: LeaveReportFilters, from: Date | null, to: Date | null) {
  if (filters.branchId && record.employee.branchId !== filters.branchId) return false;
  if (filters.department && record.employee.department !== filters.department) return false;
  if (filters.designation && record.employee.designation !== filters.designation) return false;
  if (filters.employeeId && record.employeeId !== filters.employeeId) return false;
  if (filters.employmentType && record.employee.employmentType !== filters.employmentType) return false;
  if (filters.leaveType && record.type !== filters.leaveType) return false;
  if (filters.leaveStatus && record.status !== filters.leaveStatus) return false;
  if (from && record.toDate < from) return false;
  if (to && record.fromDate > to) return false;
  return true;
}

function buildReportRows(args: {
  reportType: LeaveReportType;
  requests: LeaveRequestRecord[];
  balanceRows: BalanceRow[];
  approverNames: Map<string, string>;
  payrollYear: number;
}) {
  const { reportType, requests, balanceRows, approverNames, payrollYear } = args;

  switch (reportType) {
    case 'LEAVE_APPLICATION':
      return {
        title: 'Leave Application Report',
        description: 'All leave applications submitted through the Leave Management module.',
        columns: ['Application No', 'Employee', 'Leave Type', 'From', 'To', 'Days', 'Status', 'Applied Date'],
        rows: requests.map((record) => [
          record.leaveRequestNo,
          `${record.employee.code} · ${record.employee.firstName} ${record.employee.lastName}`,
          record.type,
          formatDate(record.fromDate),
          formatDate(record.toDate),
          Number(record.days),
          record.status,
          formatDate(record.createdAt),
        ]),
      };
    case 'LEAVE_APPROVAL':
      return {
        title: 'Leave Approval Report',
        description: 'Approval-stage view using manager and HR approval records from the leave workflow.',
        columns: ['Application No', 'Employee', 'Approver', 'Approval Date', 'Decision', 'Remarks'],
        rows: requests.map((record) => {
          const useHrStage = Boolean(record.hrId || record.hrApprovedAt || record.hrStatus !== 'PENDING');
          const approverId = useHrStage ? record.hrId : record.managerId;
          const approverName = approverId ? approverNames.get(approverId) ?? 'Workflow User' : 'Pending Workflow';
          const approvalDate = useHrStage ? record.hrApprovedAt : record.managerApprovedAt;
          const decision = useHrStage ? record.hrStatus : record.managerStatus;
          const remarks = useHrStage ? record.hrRemarks : record.managerRemarks;
          return [
            record.leaveRequestNo,
            `${record.employee.code} · ${record.employee.firstName} ${record.employee.lastName}`,
            approverName,
            formatDate(approvalDate),
            decision,
            remarks || '—',
          ];
        }),
      };
    case 'LEAVE_BALANCE':
      return {
        title: 'Leave Balance Report',
        description: 'Employee-wise leave balances generated from leave policy, approvals, carry forward, and adjustments.',
        columns: ['Employee', 'Leave Type', 'Entitled', 'Used', 'Pending', 'Available', 'Carry Forward'],
        rows: balanceRows.map((row) => [
          `${row.employeeCode} · ${row.employeeName}`,
          row.leaveType,
          row.openingBalance,
          row.approvedTakenDays,
          row.pendingLeaveDays,
          row.isUnlimited ? 'Unlimited' : row.availableBalance,
          row.carryForwardDays,
        ]),
      };
    case 'LEAVE_UTILIZATION': {
      const grouped = new Map<string, { employees: Set<string>; taken: number; entitled: number }>();
      for (const row of balanceRows) {
        const current = grouped.get(row.department ?? 'Unassigned') ?? { employees: new Set<string>(), taken: 0, entitled: 0 };
        current.employees.add(row.employeeId);
        current.taken += row.approvedTakenDays;
        if (!row.isUnlimited) current.entitled += row.openingBalance;
        grouped.set(row.department ?? 'Unassigned', current);
      }

      return {
        title: 'Leave Utilization Report',
        description: 'Department-wise leave usage based on approved leave days and generated balances.',
        columns: ['Department', 'Employees', 'Leave Taken', 'Average Days', 'Utilization %'],
        rows: Array.from(grouped.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([department, row]) => [
            department,
            row.employees.size,
            row.taken,
            row.employees.size > 0 ? (row.taken / row.employees.size).toFixed(2) : '0.00',
            row.entitled > 0 ? formatPercent((row.taken / row.entitled) * 100) : '0.0%',
          ]),
      };
    }
    case 'LEAVE_ENCASHMENT':
      return {
        title: 'Leave Encashment Report',
        description: 'Balance-based leave encashment view using encashed and encashable days from the leave balance engine.',
        columns: ['Employee', 'Leave Type', 'Encashed', 'Encashable', 'Available', 'Payroll Year'],
        rows: balanceRows.map((row) => [
          `${row.employeeCode} · ${row.employeeName}`,
          row.leaveType,
          row.encashedDays,
          row.encashableDays,
          row.isUnlimited ? 'Unlimited' : row.availableBalance,
          payrollYear,
        ]),
      };
    case 'LEAVE_SUMMARY': {
      const grouped = new Map<string, { applications: number; approvedDays: number; pending: number; rejected: number }>();
      for (const record of requests) {
        const current = grouped.get(record.type) ?? { applications: 0, approvedDays: 0, pending: 0, rejected: 0 };
        current.applications += 1;
        if (record.status === 'APPROVED') current.approvedDays += Number(record.days);
        if (record.status === 'PENDING_MANAGER' || record.status === 'PENDING_HR') current.pending += 1;
        if (record.status === 'REJECTED') current.rejected += 1;
        grouped.set(record.type, current);
      }

      return {
        title: 'Leave Summary Report',
        description: 'High-level leave request summary grouped by leave type.',
        columns: ['Leave Type', 'Applications', 'Approved Days', 'Pending', 'Rejected'],
        rows: Array.from(grouped.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([leaveType, row]) => [leaveType, row.applications, row.approvedDays, row.pending, row.rejected]),
      };
    }
    case 'EMPLOYEE_LEAVE_HISTORY':
      return {
        title: 'Employee Leave History',
        description: 'Chronological employee-wise leave history for the selected period.',
        columns: ['Employee', 'Application No', 'Leave Type', 'From', 'To', 'Days', 'Status', 'Applied Date'],
        rows: requests.map((record) => [
          `${record.employee.code} · ${record.employee.firstName} ${record.employee.lastName}`,
          record.leaveRequestNo,
          record.type,
          formatDate(record.fromDate),
          formatDate(record.toDate),
          Number(record.days),
          record.status,
          formatDate(record.createdAt),
        ]),
      };
    case 'LEAVE_TYPE_ANALYSIS': {
      const grouped = new Map<string, { applications: number; employees: Set<string>; approvedDays: number; pending: number }>();
      for (const record of requests) {
        const current = grouped.get(record.type) ?? { applications: 0, employees: new Set<string>(), approvedDays: 0, pending: 0 };
        current.applications += 1;
        current.employees.add(record.employeeId);
        if (record.status === 'APPROVED') current.approvedDays += Number(record.days);
        if (record.status === 'PENDING_MANAGER' || record.status === 'PENDING_HR') current.pending += 1;
        grouped.set(record.type, current);
      }

      return {
        title: 'Leave Type Analysis',
        description: 'Leave type usage and reach across the workforce.',
        columns: ['Leave Type', 'Applications', 'Employees', 'Approved Days', 'Pending'],
        rows: Array.from(grouped.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([leaveType, row]) => [leaveType, row.applications, row.employees.size, row.approvedDays, row.pending]),
      };
    }
    case 'LEAVE_TREND':
    default: {
      const grouped = new Map<string, { applications: number; approved: number; rejected: number; approvedDays: number }>();
      for (const record of requests) {
        const month = record.fromDate.toISOString().slice(0, 7);
        const current = grouped.get(month) ?? { applications: 0, approved: 0, rejected: 0, approvedDays: 0 };
        current.applications += 1;
        if (record.status === 'APPROVED') {
          current.approved += 1;
          current.approvedDays += Number(record.days);
        }
        if (record.status === 'REJECTED') current.rejected += 1;
        grouped.set(month, current);
      }

      return {
        title: 'Leave Trend Report',
        description: 'Month-wise leave request trend over the selected time range.',
        columns: ['Month', 'Applications', 'Approved', 'Rejected', 'Approved Days'],
        rows: Array.from(grouped.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([month, row]) => [month, row.applications, row.approved, row.rejected, row.approvedDays]),
      };
    }
  }
}

export const leaveReportsService = {
  async getReportCenter(session: AppSession | null, filters: LeaveReportFilters = {}) {
    await authorize(session, 'hr:read');

    const reportType = filters.reportType ?? 'LEAVE_APPLICATION';
    const payrollYear = Number(filters.payrollYear || currentYearString());
    const dateFrom = filters.dateFrom ?? '';
    const dateTo = filters.dateTo ?? '';
    const from = normalizeDateStart(filters.dateFrom);
    const to = normalizeDateEnd(filters.dateTo);
    const today = normalizeDateStart(new Date().toISOString().slice(0, 10))!;

    const [branches, employees, leaveTypes, requestsRaw, balanceRowsRaw] = await Promise.all([
      prisma.branch.findMany({
        where: { isActive: true },
        select: { id: true, code: true, name: true },
        orderBy: [{ code: 'asc' }],
      }),
      prisma.employee.findMany({
        where: { status: { in: ['ACTIVE', 'ON_LEAVE'] } },
        select: {
          id: true,
          code: true,
          firstName: true,
          lastName: true,
          department: true,
          designation: true,
          employmentType: true,
          branchId: true,
          branch: { select: { id: true, code: true, name: true } },
        },
        orderBy: [{ code: 'asc' }],
      }),
      prisma.leaveType.findMany({
        where: { status: 'ACTIVE' },
        select: { code: true, name: true },
        orderBy: [{ displayOrder: 'asc' }, { code: 'asc' }],
      }),
      prisma.leaveRequest.findMany({
        include: {
          employee: {
            select: {
              id: true,
              code: true,
              firstName: true,
              lastName: true,
              department: true,
              designation: true,
              employmentType: true,
              branchId: true,
              branch: { select: { id: true, code: true, name: true } },
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }],
      }),
      leaveBalanceService.listBalances(session, {
        year: payrollYear,
        branchId: filters.branchId || undefined,
        department: filters.department || undefined,
        designation: filters.designation || undefined,
        employeeId: filters.employeeId || undefined,
        leaveType: filters.leaveType || undefined,
      }),
    ]);

    const requests = requestsRaw.filter((record) => matchesRequestFilters(record, filters, from, to));
    const balanceRows = balanceRowsRaw.filter((row) => {
      if (filters.employmentType && row.employmentType !== filters.employmentType) return false;
      return true;
    });

    const approverIds = Array.from(
      new Set(
        requestsRaw
          .flatMap((record) => [record.managerId, record.hrId])
          .filter((value): value is string => Boolean(value)),
      ),
    );
    const approverNames = new Map(
      approverIds.length > 0
        ? (
            await prisma.user.findMany({
              where: { id: { in: approverIds } },
              select: { id: true, name: true },
            })
          ).map((user) => [user.id, user.name])
        : [],
    );

    const applications = requestsRaw.length;
    const pendingApproval = requestsRaw.filter((record) => record.status === 'PENDING_MANAGER' || record.status === 'PENDING_HR').length;
    const approved = requestsRaw.filter((record) => record.status === 'APPROVED').length;
    const rejected = requestsRaw.filter((record) => record.status === 'REJECTED').length;
    const employeesOnLeaveToday = requestsRaw.filter((record) => record.status === 'APPROVED' && record.fromDate <= today && record.toDate >= today).length;

    const finiteBalanceRows = balanceRowsRaw.filter((row) => !row.isUnlimited);
    const totalEntitled = finiteBalanceRows.reduce((sum, row) => sum + row.openingBalance, 0);
    const totalUsed = finiteBalanceRows.reduce((sum, row) => sum + row.approvedTakenDays, 0);
    const leaveUtilization = totalEntitled > 0 ? formatPercent((totalUsed / totalEntitled) * 100) : '0.0%';

    const report = buildReportRows({
      reportType,
      requests,
      balanceRows,
      approverNames,
      payrollYear,
    });

    return {
      filters: {
        reportType,
        branchId: filters.branchId ?? '',
        department: filters.department ?? '',
        designation: filters.designation ?? '',
        employeeId: filters.employeeId ?? '',
        employmentType: filters.employmentType ?? '',
        leaveType: filters.leaveType ?? '',
        leaveStatus: filters.leaveStatus ?? '',
        dateFrom,
        dateTo,
        payrollYear: String(payrollYear),
      },
      options: {
        branches,
        departments: Array.from(new Set(employees.map((employee) => employee.department).filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b)),
        designations: Array.from(new Set(employees.map((employee) => employee.designation).filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b)),
        employees: employees.map((employee) => ({ value: employee.id, label: `${employee.code} · ${employee.firstName} ${employee.lastName}` })),
        employmentTypes: Array.from(new Set(employees.map((employee) => employee.employmentType).filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b)),
        leaveTypes: leaveTypes.map((leaveType) => ({ value: leaveType.code, label: leaveType.name })),
        leaveStatuses: ['PENDING_MANAGER', 'PENDING_HR', 'APPROVED', 'REJECTED', 'RETURNED', 'CANCELLED', 'WITHDRAWN'],
      },
      dashboard: {
        leaveApplications: applications,
        pendingApproval,
        approved,
        rejected,
        employeesOnLeaveToday,
        leaveUtilization,
      },
      report,
      meta: {
        rowCount: report.rows.length,
      },
    };
  },
};
