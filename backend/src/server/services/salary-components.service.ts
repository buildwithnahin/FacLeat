import { prisma } from '@/server/db';
import { Prisma, SalaryComponentStatus } from '@prisma/client';
import { SalaryComponentFormValues } from '../validators/salary-components';
import { authorize } from '@/server/auth/authorize';
import { recordAudit } from '@/server/audit/logger';
import type { AppSession } from '@/server/auth/session';

type ApplicabilityRow = {
  kind: 'EMPLOYMENT_TYPE' | 'DEPARTMENT' | 'DESIGNATION';
  value: string;
};

/**
 * MySQL has no scalar array type, so the old `applicableEmploymentTypes/
 * applicableDepartments/applicableDesignations String[]` fields are now one
 * join table (`applicability`, tagged by `kind`). Reshape back to the three
 * flat string[] fields on every read so the API contract (consumed by web/)
 * is unchanged.
 */
function withApplicability<T extends { applicability: ApplicabilityRow[] }>(component: T) {
  const { applicability, ...rest } = component;
  return {
    ...rest,
    applicableEmploymentTypes: applicability.filter((a) => a.kind === 'EMPLOYMENT_TYPE').map((a) => a.value),
    applicableDepartments: applicability.filter((a) => a.kind === 'DEPARTMENT').map((a) => a.value),
    applicableDesignations: applicability.filter((a) => a.kind === 'DESIGNATION').map((a) => a.value),
  };
}

function applicabilityCreateInput(data: {
  applicableEmploymentTypes: string[];
  applicableDepartments: string[];
  applicableDesignations: string[];
}) {
  return [
    ...data.applicableEmploymentTypes.map((value) => ({ kind: 'EMPLOYMENT_TYPE' as const, value })),
    ...data.applicableDepartments.map((value) => ({ kind: 'DEPARTMENT' as const, value })),
    ...data.applicableDesignations.map((value) => ({ kind: 'DESIGNATION' as const, value })),
  ];
}

export class SalaryComponentsService {
  static async getSalaryComponents(
    session: AppSession | null,
    params?: {
      search?: string;
      category?: string;
      type?: string;
      status?: string;
    },
  ) {
    await authorize(session, 'hr:read');
    const where: Prisma.SalaryComponentWhereInput = {};

    if (params?.search) {
      where.OR = [
        { name: { contains: params.search } },
        { code: { contains: params.search } },
      ];
    }

    if (params?.category) {
      where.category = params.category as any;
    }
    if (params?.type) {
      where.type = params.type as any;
    }
    if (params?.status) {
      where.status = params.status as any;
    }

    const components = await prisma.salaryComponent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { applicability: true },
    });
    return components.map(withApplicability);
  }

  static async getSalaryComponentById(session: AppSession | null, id: string) {
    await authorize(session, 'hr:read');
    return withApplicability(await this._getByIdRaw(id));
  }

  private static async _getByIdRaw(id: string) {
    const component = await prisma.salaryComponent.findUnique({
      where: { id },
      include: { applicability: true },
    });

    if (!component) throw new Error('Salary component not found');
    return component;
  }

  static async createSalaryComponent(session: AppSession | null, data: SalaryComponentFormValues) {
    const actor = await authorize(session, 'hr:write');
    const existing = await prisma.salaryComponent.findUnique({
      where: { code: data.code },
    });

    if (existing) {
      throw new Error(`Salary component with code ${data.code} already exists.`);
    }

    return prisma.$transaction(async (tx) => {
      const component = await tx.salaryComponent.create({
        data: {
          name: data.name,
          code: data.code,
          description: data.description,
          category: data.category,
          type: data.type,
          calculationType: data.calculationType,
          value: data.value ? new Prisma.Decimal(data.value) : null,
          formula: data.formula,
          baseComponent: data.baseComponent,
          isTaxable: data.isTaxable,
          includeInGross: data.includeInGross,
          includeInNet: data.includeInNet,
          showInPayslip: data.showInPayslip,
          isSystemGenerated: data.isSystemGenerated,
          isMandatory: data.isMandatory,
          isEditableDuringPayroll: data.isEditableDuringPayroll,
          allowNegativeValue: data.allowNegativeValue,
          maxAmount: data.maxAmount ? new Prisma.Decimal(data.maxAmount) : null,
          minAmount: data.minAmount ? new Prisma.Decimal(data.minAmount) : null,
          status: data.status,
          applicability: { create: applicabilityCreateInput(data) },
        },
        include: { applicability: true },
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: actor.activeBranchId,
          module: 'hr',
          action: 'create-salary-component',
          entityType: 'SalaryComponent',
          entityId: component.id,
          after: { code: component.code, name: component.name, category: component.category },
        },
        tx,
      );

      return withApplicability(component);
    });
  }

  static async updateSalaryComponent(session: AppSession | null, id: string, data: SalaryComponentFormValues) {
    const actor = await authorize(session, 'hr:write');
    const existing = await this._getByIdRaw(id);

    if (data.code !== existing.code) {
      const duplicateCode = await prisma.salaryComponent.findUnique({
        where: { code: data.code },
      });
      if (duplicateCode) {
        throw new Error(`Salary component with code ${data.code} already exists.`);
      }
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.salaryComponent.update({
        where: { id },
        data: {
          name: data.name,
          code: data.code,
          description: data.description,
          category: data.category,
          type: data.type,
          calculationType: data.calculationType,
          value: data.value !== null && data.value !== undefined ? new Prisma.Decimal(data.value) : null,
          formula: data.formula,
          baseComponent: data.baseComponent,
          isTaxable: data.isTaxable,
          includeInGross: data.includeInGross,
          includeInNet: data.includeInNet,
          showInPayslip: data.showInPayslip,
          isSystemGenerated: data.isSystemGenerated,
          isMandatory: data.isMandatory,
          isEditableDuringPayroll: data.isEditableDuringPayroll,
          allowNegativeValue: data.allowNegativeValue,
          maxAmount: data.maxAmount !== null && data.maxAmount !== undefined ? new Prisma.Decimal(data.maxAmount) : null,
          minAmount: data.minAmount !== null && data.minAmount !== undefined ? new Prisma.Decimal(data.minAmount) : null,
          status: data.status,
          applicability: {
            deleteMany: {},
            create: applicabilityCreateInput(data),
          },
        },
        include: { applicability: true },
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: actor.activeBranchId,
          module: 'hr',
          action: 'update-salary-component',
          entityType: 'SalaryComponent',
          entityId: id,
          before: { code: existing.code, name: existing.name, status: existing.status },
          after: { code: updated.code, name: updated.name, status: updated.status },
        },
        tx,
      );

      return withApplicability(updated);
    });
  }

  static async deactivateSalaryComponent(session: AppSession | null, id: string) {
    // According to the prompt, we shouldn't strictly delete if used, but we don't have SalaryStructure logic yet.
    // So we just deactivate.
    const actor = await authorize(session, 'hr:write');
    return prisma.$transaction(async (tx) => {
      const existing = await tx.salaryComponent.findUnique({ where: { id } });
      const updated = await tx.salaryComponent.update({
        where: { id },
        data: { status: SalaryComponentStatus.INACTIVE },
        include: { applicability: true },
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: actor.activeBranchId,
          module: 'hr',
          action: 'deactivate-salary-component',
          entityType: 'SalaryComponent',
          entityId: id,
          before: { status: existing?.status },
          after: { status: updated.status },
        },
        tx,
      );

      return withApplicability(updated);
    });
  }
}
