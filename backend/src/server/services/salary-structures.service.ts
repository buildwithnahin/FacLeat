import { prisma } from '@/server/db';
import { Prisma, SalaryStructureStatus } from '@prisma/client';
import { SalaryStructureFormValues, SalaryStructureAssignmentValues } from '../validators/salary-structures';
import { CurrencyCode } from '@prisma/client';
import { authorize } from '@/server/auth/authorize';
import { recordAudit } from '@/server/audit/logger';
import type { AppSession } from '@/server/auth/session';

type ApplicabilityRow = {
  kind: 'EMPLOYMENT_TYPE' | 'DEPARTMENT' | 'DESIGNATION' | 'BRANCH';
  value: string;
};

/**
 * MySQL has no scalar array type, so the old `employmentTypes/departmentIds/
 * designationIds/branchIds String[]` fields are now one join table
 * (`applicability`, tagged by `kind`). Reshape back to the four flat
 * string[] fields on every read so the API contract (consumed by web/) is
 * unchanged.
 */
function withApplicability<T extends { applicability: ApplicabilityRow[] }>(structure: T) {
  const { applicability, ...rest } = structure;
  return {
    ...rest,
    employmentTypes: applicability.filter((a) => a.kind === 'EMPLOYMENT_TYPE').map((a) => a.value),
    departmentIds: applicability.filter((a) => a.kind === 'DEPARTMENT').map((a) => a.value),
    designationIds: applicability.filter((a) => a.kind === 'DESIGNATION').map((a) => a.value),
    branchIds: applicability.filter((a) => a.kind === 'BRANCH').map((a) => a.value),
  };
}

function applicabilityCreateInput(data: {
  employmentTypes: string[];
  departmentIds: string[];
  designationIds: string[];
  branchIds: string[];
}) {
  return [
    ...data.employmentTypes.map((value) => ({ kind: 'EMPLOYMENT_TYPE' as const, value })),
    ...data.departmentIds.map((value) => ({ kind: 'DEPARTMENT' as const, value })),
    ...data.designationIds.map((value) => ({ kind: 'DESIGNATION' as const, value })),
    ...data.branchIds.map((value) => ({ kind: 'BRANCH' as const, value })),
  ];
}

export class SalaryStructuresService {
  static async getSalaryStructures(
    session: AppSession | null,
    params?: {
      search?: string;
      status?: string;
    },
  ) {
    await authorize(session, 'hr:read');
    const where: Prisma.SalaryStructureWhereInput = {};

    if (params?.search) {
      where.OR = [
        { name: { contains: params.search } },
        { code: { contains: params.search } },
      ];
    }

    if (params?.status) {
      where.status = params.status as any;
    }

    const structures = await prisma.salaryStructure.findMany({
      where,
      include: {
        _count: {
          select: { employeeAssignments: true },
        },
        applicability: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return structures.map(withApplicability);
  }

  static async getSalaryStructureById(session: AppSession | null, id: string) {
    await authorize(session, 'hr:read');
    const structure = await prisma.salaryStructure.findUnique({
      where: { id },
      include: {
        components: {
          include: {
            salaryComponent: true,
          },
        },
        employeeAssignments: {
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                code: true,
                department: true,
              }
            }
          }
        },
        applicability: true,
      },
    });

    if (!structure) throw new Error('Salary structure not found');
    return withApplicability(structure);
  }

  static async createSalaryStructure(session: AppSession | null, data: SalaryStructureFormValues) {
    const actor = await authorize(session, 'hr:write');
    const existing = await prisma.salaryStructure.findUnique({
      where: { code: data.code },
    });

    if (existing) {
      throw new Error(`Salary structure with code ${data.code} already exists.`);
    }

    return prisma.$transaction(async (tx) => {
      const structure = await tx.salaryStructure.create({
        data: {
          name: data.name,
          code: data.code,
          description: data.description,
          status: data.status,
          grossSalary: new Prisma.Decimal(data.grossSalary),
          netSalary: data.netSalary ? new Prisma.Decimal(data.netSalary) : null,
          effectiveFrom: data.effectiveFrom,
          effectiveTo: data.effectiveTo,
          payrollFrequency: data.payrollFrequency,
          currency: data.currency as CurrencyCode,
          applicability: { create: applicabilityCreateInput(data) },
          notes: data.notes,
        },
        include: { applicability: true },
      });

      if (data.components.length > 0) {
        await tx.salaryStructureComponent.createMany({
          data: data.components.map((comp) => ({
            salaryStructureId: structure.id,
            salaryComponentId: comp.salaryComponentId,
            value: new Prisma.Decimal(comp.value),
            isAutoCalculated: comp.isAutoCalculated,
          })),
        });
      }

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: actor.activeBranchId,
          module: 'hr',
          action: 'create-salary-structure',
          entityType: 'SalaryStructure',
          entityId: structure.id,
          after: { code: structure.code, name: structure.name, grossSalary: structure.grossSalary },
        },
        tx,
      );

      return withApplicability(structure);
    });
  }

  static async updateSalaryStructure(session: AppSession | null, id: string, data: SalaryStructureFormValues) {
    const actor = await authorize(session, 'hr:write');
    const existing = await prisma.salaryStructure.findUnique({
      where: { id },
    });

    if (!existing) throw new Error('Salary structure not found');

    if (data.code !== existing.code) {
      const duplicateCode = await prisma.salaryStructure.findUnique({
        where: { code: data.code },
      });
      if (duplicateCode) {
        throw new Error(`Salary structure with code ${data.code} already exists.`);
      }
    }

    return prisma.$transaction(async (tx) => {
      const structure = await tx.salaryStructure.update({
        where: { id },
        data: {
          name: data.name,
          code: data.code,
          description: data.description,
          status: data.status,
          grossSalary: new Prisma.Decimal(data.grossSalary),
          netSalary: data.netSalary ? new Prisma.Decimal(data.netSalary) : null,
          effectiveFrom: data.effectiveFrom,
          effectiveTo: data.effectiveTo,
          payrollFrequency: data.payrollFrequency,
          currency: data.currency as CurrencyCode,
          applicability: {
            deleteMany: {},
            create: applicabilityCreateInput(data),
          },
          notes: data.notes,
        },
        include: { applicability: true },
      });

      // Simple approach: delete existing components and recreate
      await tx.salaryStructureComponent.deleteMany({
        where: { salaryStructureId: id },
      });

      if (data.components.length > 0) {
        await tx.salaryStructureComponent.createMany({
          data: data.components.map((comp) => ({
            salaryStructureId: structure.id,
            salaryComponentId: comp.salaryComponentId,
            value: new Prisma.Decimal(comp.value),
            isAutoCalculated: comp.isAutoCalculated,
          })),
        });
      }

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: actor.activeBranchId,
          module: 'hr',
          action: 'update-salary-structure',
          entityType: 'SalaryStructure',
          entityId: id,
          before: { code: existing.code, name: existing.name, grossSalary: existing.grossSalary },
          after: { code: structure.code, name: structure.name, grossSalary: structure.grossSalary },
        },
        tx,
      );

      return withApplicability(structure);
    });
  }

  static async assignEmployees(
    session: AppSession | null,
    salaryStructureId: string,
    data: SalaryStructureAssignmentValues,
  ) {
    const actor = await authorize(session, 'hr:write');
    const structure = await prisma.salaryStructure.findUnique({
      where: { id: salaryStructureId },
    });

    if (!structure) throw new Error('Salary structure not found');

    return prisma.$transaction(async (tx) => {
      const assignments = [];

      for (const employeeId of data.employeeIds) {
        // Find existing assignments that overlap or just close them
        const existingAssignments = await tx.employeeSalaryStructureAssignment.findMany({
          where: {
            employeeId,
            effectiveTo: null,
          },
        });

        // Close existing open assignments
        if (existingAssignments.length > 0) {
          await tx.employeeSalaryStructureAssignment.updateMany({
            where: {
              id: { in: existingAssignments.map(a => a.id) },
            },
            data: {
              effectiveTo: data.effectiveFrom, // Close it as of the new assignment's start date
            },
          });
        }

        // Create new assignment
        const newAssignment = await tx.employeeSalaryStructureAssignment.create({
          data: {
            employeeId,
            salaryStructureId,
            effectiveFrom: data.effectiveFrom,
            effectiveTo: data.effectiveTo,
          },
        });
        assignments.push(newAssignment);
      }

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: actor.activeBranchId,
          module: 'hr',
          action: 'assign-salary-structure',
          entityType: 'SalaryStructure',
          entityId: salaryStructureId,
          after: { employeeIds: data.employeeIds, effectiveFrom: data.effectiveFrom },
        },
        tx,
      );

      return assignments;
    });
  }

  static async deactivateSalaryStructure(session: AppSession | null, id: string) {
    const actor = await authorize(session, 'hr:write');
    const structure = await prisma.salaryStructure.findUnique({
      where: { id },
      include: {
        _count: {
          select: { employeeAssignments: { where: { effectiveTo: null } } }
        }
      }
    });

    if (!structure) throw new Error('Salary structure not found');

    // Soft delete / deactivate
    return prisma.$transaction(async (tx) => {
      const updated = await tx.salaryStructure.update({
        where: { id },
        data: { status: SalaryStructureStatus.INACTIVE },
        include: { applicability: true },
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: actor.activeBranchId,
          module: 'hr',
          action: 'deactivate-salary-structure',
          entityType: 'SalaryStructure',
          entityId: id,
          before: { status: structure.status },
          after: { status: updated.status },
        },
        tx,
      );

      return withApplicability(updated);
    });
  }
}
