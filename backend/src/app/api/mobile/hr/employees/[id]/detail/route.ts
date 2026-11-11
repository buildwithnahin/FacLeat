import { NextRequest } from 'next/server';
import { getMobileSession } from '@/server/auth/mobile-session';
import { apiError, apiOk } from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { hrService } from '@/server/services/hr.service';
import { prisma } from '@/server/db';
import { isConfirmationTableAvailable, isEmployeeConfirmationTableMissingError } from '@/server/services/confirmations.service';
import { isEmployeeIncrementTableMissingError, isIncrementTableAvailable } from '@/server/services/increments.service';
import { isEmployeePromotionTableMissingError, isPromotionTableAvailable } from '@/server/services/promotions.service';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Full employee-profile bundle. Reads across HR sub-domains (leave, payroll,
 * promotions, confirmations, increments, transfers) are read-only here —
 * this route only *displays* that history for context on the employee
 * profile page; the Leave/Payroll/Lifecycle HR sub-areas own the write
 * paths and their own list/detail pages for those records.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await getMobileSession(req);
  if (!session) return Response.json(apiError('Unauthorized'), { status: 401 });
  const { id } = await params;

  try {
    const employee = await hrService.getEmployee(session, id);

    const [promotionsAvailable, confirmationsAvailable, incrementsAvailable] = await Promise.all([
      isPromotionTableAvailable(),
      isConfirmationTableAvailable(),
      isIncrementTableAvailable(),
    ]);

    const [attendance, leaves, payslips, documents, audits, workflowRecords, transfers, promotions, confirmations, increments] =
      await Promise.all([
        hrService.listAttendance(session, { employeeId: id }),
        hrService.listLeaves(session, { employeeId: id }),
        prisma.payslip.findMany({
          where: { employeeId: id },
          include: { payrollRun: { include: { branch: true } } },
          orderBy: { payrollRun: { period: 'desc' } },
          take: 6,
        }),
        prisma.documentLink.findMany({
          where: { entityType: 'Employee', entityId: id },
          include: { document: true },
          orderBy: { createdAt: 'desc' },
          take: 8,
        }),
        prisma.auditLog.findMany({
          where: { entityType: 'Employee', entityId: id },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
        hrService.listWorkflowRecords(session, { employeeId: id }),
        prisma.employeeTransfer.findMany({
          where: { employeeId: id },
          include: {
            newBranch: { select: { name: true } },
            tempBranch: { select: { name: true } },
            newShift: { select: { name: true } },
            tempShift: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 8,
        }),
        promotionsAvailable
          ? prisma.employeePromotion
              .findMany({ where: { employeeId: id }, orderBy: { createdAt: 'desc' }, take: 8 })
              .catch((error) => {
                if (isEmployeePromotionTableMissingError(error)) return [];
                throw error;
              })
          : Promise.resolve([]),
        confirmationsAvailable
          ? prisma.employeeConfirmation
              .findMany({ where: { employeeId: id }, orderBy: { createdAt: 'desc' }, take: 8 })
              .catch((error) => {
                if (isEmployeeConfirmationTableMissingError(error)) return [];
                throw error;
              })
          : Promise.resolve([]),
        incrementsAvailable
          ? prisma.employeeIncrement
              .findMany({ where: { employeeId: id }, orderBy: { createdAt: 'desc' }, take: 8 })
              .catch((error) => {
                if (isEmployeeIncrementTableMissingError(error)) return [];
                throw error;
              })
          : Promise.resolve([]),
      ]);

    return Response.json(
      apiOk({
        employee: {
          id: employee.id,
          code: employee.code,
          firstName: employee.firstName,
          lastName: employee.lastName,
          email: employee.email,
          phone: employee.phone,
          designation: employee.designation,
          department: employee.department,
          employmentType: employee.employmentType,
          status: employee.status,
          joinedAt: employee.joinedAt.toISOString(),
          basicSalary: employee.basicSalary.toString(),
          houseAllowance: employee.houseAllowance.toString(),
          transportAllowance: employee.transportAllowance.toString(),
          medicalAllowance: employee.medicalAllowance.toString(),
          otherAllowance: employee.otherAllowance.toString(),
          providentFund: employee.providentFund.toString(),
          taxDeduction: employee.taxDeduction.toString(),
          branch: { id: employee.branch.id, name: employee.branch.name },
          shift: employee.shift
            ? { name: employee.shift.name, startTime: employee.shift.startTime, endTime: employee.shift.endTime }
            : null,
          reportingManager: employee.reportingManager
            ? { firstName: employee.reportingManager.firstName, lastName: employee.reportingManager.lastName }
            : null,
          systemRole: employee.systemRole ? { name: employee.systemRole.name } : null,
        },
        attendance: attendance.map((r) => ({
          id: r.id,
          date: r.date.toISOString(),
          status: r.status,
          checkIn: r.checkIn ? r.checkIn.toISOString() : null,
          checkOut: r.checkOut ? r.checkOut.toISOString() : null,
        })),
        leaves: leaves.map((l) => ({
          id: l.id,
          type: l.type,
          status: l.status,
          fromDate: l.fromDate.toISOString(),
          toDate: l.toDate.toISOString(),
          days: l.days.toString(),
          createdAt: l.createdAt.toISOString(),
        })),
        payslips: payslips.map((p) => ({
          id: p.id,
          net: p.net.toString(),
          workedDays: p.workedDays.toString(),
          createdAt: p.createdAt.toISOString(),
          payrollRun: { period: p.payrollRun.period, status: p.payrollRun.status, branchName: p.payrollRun.branch.name },
        })),
        documents: documents.map((d) => ({
          id: d.id,
          originalName: d.document.originalName,
          mimeType: d.document.mimeType,
          size: d.document.size,
          category: d.document.category,
        })),
        audits: audits.map((a) => ({ id: a.id, action: a.action, module: a.module, createdAt: a.createdAt.toISOString() })),
        workflowRecords: workflowRecords.map((r) => ({
          id: r.id,
          section: r.section,
          title: r.title,
          subject: r.subject,
          status: r.status,
          priority: r.priority,
          startDate: r.startDate ? r.startDate.toISOString() : null,
          endDate: r.endDate ? r.endDate.toISOString() : null,
          updatedAt: r.updatedAt.toISOString(),
        })),
        transfers: transfers.map((t) => ({
          id: t.id,
          transferNumber: t.transferNumber,
          transferType: t.transferType,
          status: t.status,
          effectiveDate: t.effectiveDate ? t.effectiveDate.toISOString() : null,
          startDate: t.startDate ? t.startDate.toISOString() : null,
          endDate: t.endDate ? t.endDate.toISOString() : null,
          newDepartment: t.newDepartment,
          tempDepartment: t.tempDepartment,
          createdAt: t.createdAt.toISOString(),
          newBranch: t.newBranch ? { name: t.newBranch.name } : null,
          tempBranch: t.tempBranch ? { name: t.tempBranch.name } : null,
          newShift: t.newShift ? { name: t.newShift.name } : null,
          tempShift: t.tempShift ? { name: t.tempShift.name } : null,
        })),
        promotions: promotions.map((p) => ({
          id: p.id,
          promotionNumber: p.promotionNumber,
          promotionType: p.promotionType,
          status: p.status,
          newDesignation: p.newDesignation,
          newSalary: p.newSalary.toString(),
          effectiveDate: p.effectiveDate.toISOString(),
        })),
        confirmations: confirmations.map((c) => ({
          id: c.id,
          confirmationNumber: c.confirmationNumber,
          confirmationType: c.confirmationType,
          status: c.status,
          effectiveDate: c.effectiveDate.toISOString(),
          salaryRevisionRequired: c.salaryRevisionRequired,
          newBasicSalary: c.newBasicSalary.toString(),
        })),
        increments: increments.map((i) => ({
          id: i.id,
          incrementNumber: i.incrementNumber,
          incrementType: i.incrementType,
          status: i.status,
          newBasicSalary: i.newBasicSalary.toString(),
          effectiveDate: i.effectiveDate.toISOString(),
        })),
      }),
    );
  } catch (err) {
    if (err instanceof ApiError) return Response.json(apiError(err), { status: err.status });
    console.error('GET /api/mobile/hr/employees/[id]/detail failed', err);
    return Response.json(apiError('Internal server error'), { status: 500 });
  }
}
