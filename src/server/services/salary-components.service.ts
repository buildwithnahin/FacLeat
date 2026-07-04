import { prisma } from '@/server/db';
import { Prisma, SalaryComponentStatus } from '@prisma/client';
import { SalaryComponentFormValues } from '../validators/salary-components';

export class SalaryComponentsService {
  static async getSalaryComponents(params?: {
    search?: string;
    category?: string;
    type?: string;
    status?: string;
  }) {
    const where: Prisma.SalaryComponentWhereInput = {};

    if (params?.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { code: { contains: params.search, mode: 'insensitive' } },
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

    return prisma.salaryComponent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  static async getSalaryComponentById(id: string) {
    const component = await prisma.salaryComponent.findUnique({
      where: { id },
    });
    
    if (!component) throw new Error('Salary component not found');
    return component;
  }

  static async createSalaryComponent(data: SalaryComponentFormValues) {
    const existing = await prisma.salaryComponent.findUnique({
      where: { code: data.code },
    });

    if (existing) {
      throw new Error(`Salary component with code ${data.code} already exists.`);
    }

    return prisma.salaryComponent.create({
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
        applicableEmploymentTypes: data.applicableEmploymentTypes,
        applicableDepartments: data.applicableDepartments,
        applicableDesignations: data.applicableDesignations,
      },
    });
  }

  static async updateSalaryComponent(id: string, data: SalaryComponentFormValues) {
    const existing = await this.getSalaryComponentById(id);

    if (data.code !== existing.code) {
      const duplicateCode = await prisma.salaryComponent.findUnique({
        where: { code: data.code },
      });
      if (duplicateCode) {
        throw new Error(`Salary component with code ${data.code} already exists.`);
      }
    }

    return prisma.salaryComponent.update({
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
        applicableEmploymentTypes: data.applicableEmploymentTypes,
        applicableDepartments: data.applicableDepartments,
        applicableDesignations: data.applicableDesignations,
      },
    });
  }

  static async deactivateSalaryComponent(id: string) {
    // According to the prompt, we shouldn't strictly delete if used, but we don't have SalaryStructure logic yet.
    // So we just deactivate.
    return prisma.salaryComponent.update({
      where: { id },
      data: { status: SalaryComponentStatus.INACTIVE },
    });
  }
}
