import { prisma } from '@/server/db';
import { authorize } from '@/server/auth/authorize';
import { type AppSession } from '@/server/auth/session';
import { ValidationError, NotFoundError } from '@/lib/errors';
import { recordAudit } from '@/server/services/audit.service';
import { type ContractCreateInput, type ContractUpdateInput } from '../validators/contracts';
import { Prisma } from '@prisma/client';

const CONTRACT_INCLUDE = {
  employee: true,
  branch: true,
  shift: true,
};

function normalizeDate(d: Date | string) {
  const date = new Date(d);
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

export const contractsService = {
  async listAll(
    session: AppSession | null,
    filters: { branchId?: string | null; status?: string; search?: string } = {}
  ) {
    await authorize(session, 'hr:read');

    const where: Prisma.ContractWhereInput = {};

    if (filters.branchId) {
      where.branchId = filters.branchId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.search) {
      where.OR = [
        { contractNo: { contains: filters.search, mode: 'insensitive' } },
        {
          employee: {
            OR: [
              { firstName: { contains: filters.search, mode: 'insensitive' } },
              { lastName: { contains: filters.search, mode: 'insensitive' } },
              { code: { contains: filters.search, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    return prisma.contract.findMany({
      where,
      include: CONTRACT_INCLUDE,
      orderBy: [{ status: 'asc' }, { endDate: 'asc' }, { contractNo: 'asc' }],
    });
  },

  async getById(session: AppSession | null, id: string) {
    await authorize(session, 'hr:read');
    const contract = await prisma.contract.findUnique({
      where: { id },
      include: CONTRACT_INCLUDE,
    });
    if (!contract) throw new NotFoundError('Contract not found');
    return contract;
  },

  async create(session: AppSession | null, input: ContractCreateInput) {
    const actor = await authorize(session, 'hr:write');

    const duplicate = await prisma.contract.findUnique({ where: { contractNo: input.contractNo } });
    if (duplicate) throw new ValidationError('Contract number already exists');

    const emp = await prisma.employee.findUnique({ where: { id: input.employeeId } });
    if (!emp) throw new ValidationError('Employee not found');

    const startDate = normalizeDate(input.startDate);
    const endDate = input.endDate ? normalizeDate(input.endDate) : null;

    return prisma.$transaction(async (tx) => {
      const contract = await tx.contract.create({
        data: {
          contractNo: input.contractNo,
          employeeId: input.employeeId,
          branchId: input.branchId || emp.branchId,
          department: input.department || emp.department,
          designation: input.designation || emp.designation,
          contractType: input.contractType,
          startDate,
          endDate,
          basicSalary: new Prisma.Decimal(input.basicSalary),
          allowances: new Prisma.Decimal(input.allowances),
          shiftId: input.shiftId || emp.shiftId,
          weeklyOff: input.weeklyOff,
          status: input.status,
          attachmentUrl: input.attachmentUrl || null,
          notes: input.notes || null,
          createdById: actor.userId,
          updatedById: actor.userId,
        },
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: contract.branchId,
          module: 'hr',
          action: 'create-contract',
          entityType: 'Contract',
          entityId: contract.id,
          after: {
            contractNo: contract.contractNo,
            employeeId: contract.employeeId,
            type: contract.contractType,
            status: contract.status,
            basicSalary: contract.basicSalary.toString(),
            startDate: contract.startDate.toISOString().slice(0, 10),
            endDate: contract.endDate?.toISOString().slice(0, 10) || null,
          },
        },
        tx
      );

      return contract;
    });
  },

  async update(session: AppSession | null, input: ContractUpdateInput) {
    const actor = await authorize(session, 'hr:write');

    const existing = await prisma.contract.findUnique({ where: { id: input.id } });
    if (!existing) throw new NotFoundError('Contract not found');

    if (input.contractNo !== existing.contractNo) {
      const duplicate = await prisma.contract.findUnique({ where: { contractNo: input.contractNo } });
      if (duplicate && duplicate.id !== input.id) throw new ValidationError('Contract number already exists');
    }

    const startDate = normalizeDate(input.startDate);
    const endDate = input.endDate ? normalizeDate(input.endDate) : null;

    return prisma.$transaction(async (tx) => {
      const contract = await tx.contract.update({
        where: { id: input.id },
        data: {
          contractNo: input.contractNo,
          employeeId: input.employeeId,
          branchId: input.branchId || null,
          department: input.department || null,
          designation: input.designation || null,
          contractType: input.contractType,
          startDate,
          endDate,
          basicSalary: new Prisma.Decimal(input.basicSalary),
          allowances: new Prisma.Decimal(input.allowances),
          shiftId: input.shiftId || null,
          weeklyOff: input.weeklyOff,
          status: input.status,
          attachmentUrl: input.attachmentUrl || null,
          notes: input.notes || null,
          updatedById: actor.userId,
        },
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: contract.branchId,
          module: 'hr',
          action: 'update-contract',
          entityType: 'Contract',
          entityId: contract.id,
          before: {
            contractNo: existing.contractNo,
            status: existing.status,
            type: existing.contractType,
          },
          after: {
            contractNo: contract.contractNo,
            status: contract.status,
            type: contract.contractType,
          },
        },
        tx
      );

      return contract;
    });
  },

  async delete(session: AppSession | null, id: string) {
    const actor = await authorize(session, 'hr:write');
    const existing = await prisma.contract.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Contract not found');

    return prisma.$transaction(async (tx) => {
      await tx.contract.delete({ where: { id } });
      await recordAudit(
        {
          actorId: actor.userId,
          branchId: existing.branchId,
          module: 'hr',
          action: 'delete-contract',
          entityType: 'Contract',
          entityId: existing.id,
          before: {
            contractNo: existing.contractNo,
            employeeId: existing.employeeId,
            status: existing.status,
          },
        },
        tx
      );
      return existing;
    });
  },
};
