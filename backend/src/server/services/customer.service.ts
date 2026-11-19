import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db';
import { authorize } from '@/server/auth/authorize';
import { assertBranchInScope, getScopedBranchIds } from '@/server/auth/data-scope';
import { recordAudit } from '@/server/audit/logger';
import { assertOpenPeriod } from '@/server/periods/guards';
import { accountsService } from '@/server/services/accounts.service';
import type { AppSession } from '@/server/auth/session';
import type {
  CustomerCreateInput,
  CustomerUpdateInput,
  CustomerCategoryInput,
  CustomerInteractionInput,
} from '@/server/validators/crm';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { nextCustomerCode } from '@/lib/document-number';

const CUSTOMER_INCLUDE = {
  branch: { select: { id: true, name: true, code: true, currency: true } },
  category: { select: { id: true, name: true, discountPct: true } },
} as const;

type OutstandingRow = {
  customerId: string;
  totalDue: Prisma.Decimal;
  totalSales: Prisma.Decimal;
};

export const customerService = {
  async list(
    session: AppSession | null,
    filters: { branchId?: string; status?: string; type?: string; search?: string } = {},
  ) {
    await authorize(session, 'crm:read');
    const branchIds = await getScopedBranchIds(session, filters.branchId);
    const customers = await prisma.customer.findMany({
      where: {
        ...(branchIds ? { branchId: { in: branchIds } } : {}),
        status: filters.status as 'ACTIVE' | 'INACTIVE' | 'BLOCKED' | undefined,
        type: filters.type as
          | 'RETAIL'
          | 'WHOLESALE'
          | 'CORPORATE'
          | 'ONLINE'
          | 'EXPORT'
          | undefined,
        OR: filters.search
          ? [
              { name: { contains: filters.search } },
              { code: { contains: filters.search } },
              { email: { contains: filters.search } },
              { phone: { contains: filters.search } },
              { contactPerson: { contains: filters.search } },
            ]
          : undefined,
      },
      orderBy: { code: 'asc' },
      include: CUSTOMER_INCLUDE,
    });

    const outstanding = await this.outstandingByCustomer(session, filters.branchId);
    const dueMap = new Map(outstanding.map((o) => [o.customerId, o]));

    return customers.map((c) => {
      const agg = dueMap.get(c.id);
      return {
        ...c,
        totalSales: agg?.totalSales ?? new Prisma.Decimal(0),
        dueAmount: agg?.totalDue ?? new Prisma.Decimal(0),
      };
    });
  },

  async getById(session: AppSession | null, id: string) {
    await authorize(session, 'crm:read');
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        ...CUSTOMER_INCLUDE,
        interactions: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });
    if (!customer) throw new NotFoundError('Customer not found');
    await assertBranchInScope(session, customer.branchId);
    return customer;
  },

  async create(session: AppSession | null, input: CustomerCreateInput) {
    const actor = await authorize(session, 'crm:write');
    await assertBranchInScope(actor, input.branchId);

    return prisma.$transaction(async (tx) => {
      const count = await tx.customer.count();
      const code = nextCustomerCode(count);
      const customer = await tx.customer.create({
        data: {
          branchId: input.branchId,
          code,
          name: input.name,
          type: input.type,
          categoryId: input.categoryId ? input.categoryId : null,
          contactPerson: input.contactPerson || null,
          phone: input.phone || null,
          email: input.email || null,
          address: input.address || null,
          city: input.city || null,
          country: input.country || null,
          taxId: input.taxId || null,
          creditLimit: new Prisma.Decimal(input.creditLimit),
          creditDays: input.creditDays,
          currency: input.currency,
          openingBalance: new Prisma.Decimal(input.openingBalance),
          status: input.status,
          notes: input.notes || null,
          createdById: actor.userId,
        },
      });

      const openingBalance = new Prisma.Decimal(input.openingBalance);
      if (openingBalance.gt(0)) {
        await assertOpenPeriod(tx, customer.branchId);
        await tx.customerLedger.create({
          data: {
            branchId: customer.branchId,
            customerId: customer.id,
            entryType: 'OPENING',
            refType: 'CUSTOMER',
            refId: customer.id,
            description: 'Opening balance',
            debit: openingBalance,
            credit: new Prisma.Decimal(0),
            createdById: actor.userId,
          },
        });

        const acc = await accountsService.resolveSystemAccounts(
          tx,
          ['AR_CONTROL', 'OPENING_BALANCE_EQUITY'],
          customer.branchId,
        );
        await accountsService.postSystemJournal(tx, {
          branchId: customer.branchId,
          date: new Date(),
          memo: `Opening balance for customer ${customer.name}`,
          sourceModule: 'crm',
          sourceRefType: 'CustomerOpeningBalance',
          sourceRefId: customer.id,
          actorUserId: actor.userId,
          lines: [
            { accountId: acc.AR_CONTROL, debit: openingBalance.toNumber(), credit: 0, currency: customer.currency, fxRate: 1 },
            { accountId: acc.OPENING_BALANCE_EQUITY, debit: 0, credit: openingBalance.toNumber(), currency: customer.currency, fxRate: 1 },
          ],
        });
      }

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: customer.branchId,
          module: 'crm',
          action: 'create',
          entityType: 'Customer',
          entityId: customer.id,
          after: {
            code: customer.code,
            name: customer.name,
            type: customer.type,
            status: customer.status,
          },
        },
        tx,
      );

      return customer;
    });
  },

  async update(session: AppSession | null, input: CustomerUpdateInput) {
    const actor = await authorize(session, 'crm:write');
    const existing = await prisma.customer.findUnique({ where: { id: input.id } });
    if (!existing) throw new NotFoundError('Customer not found');
    await assertBranchInScope(actor, existing.branchId);
    await assertBranchInScope(actor, input.branchId);

    return prisma.$transaction(async (tx) => {
      const customer = await tx.customer.update({
        where: { id: input.id },
        data: {
          branchId: input.branchId,
          name: input.name,
          type: input.type,
          categoryId: input.categoryId ? input.categoryId : null,
          contactPerson: input.contactPerson || null,
          phone: input.phone || null,
          email: input.email || null,
          address: input.address || null,
          city: input.city || null,
          country: input.country || null,
          taxId: input.taxId || null,
          creditLimit: new Prisma.Decimal(input.creditLimit),
          creditDays: input.creditDays,
          currency: input.currency,
          status: input.status,
          notes: input.notes || null,
        },
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: customer.branchId,
          module: 'crm',
          action: 'update',
          entityType: 'Customer',
          entityId: customer.id,
          before: { name: existing.name, status: existing.status, type: existing.type },
          after: { name: customer.name, status: customer.status, type: customer.type },
        },
        tx,
      );

      return customer;
    });
  },

  async remove(session: AppSession | null, id: string) {
    const actor = await authorize(session, 'crm:delete');
    const existing = await prisma.customer.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            ledger: true,
            interactions: true,
            wholesaleInvoices: true,
            corporateQuotes: true,
            corporateOrders: true,
            corporateInvoices: true,
            tradeOrders: true,
          },
        },
      },
    });
    if (!existing) throw new NotFoundError('Customer not found');
    await assertBranchInScope(actor, existing.branchId);
    if (
      existing._count.ledger > 0 ||
      existing._count.wholesaleInvoices > 0 ||
      existing._count.corporateQuotes > 0 ||
      existing._count.corporateOrders > 0 ||
      existing._count.corporateInvoices > 0 ||
      existing._count.tradeOrders > 0
    ) {
      throw new ValidationError(
        'Customer has active transactions or ledger records — please deactivate instead of deleting.',
      );
    }
    return prisma.$transaction(async (tx) => {
      await tx.customerInteraction.deleteMany({ where: { customerId: id } });
      await tx.customer.delete({ where: { id } });
      await recordAudit(
        {
          actorId: actor.userId,
          branchId: existing.branchId,
          module: 'crm',
          action: 'delete',
          entityType: 'Customer',
          entityId: id,
          before: { code: existing.code, name: existing.name },
        },
        tx,
      );
    });
  },

  async outstandingByCustomer(session: AppSession | null, branchId?: string): Promise<OutstandingRow[]> {
    const branchIds = await getScopedBranchIds(session, branchId);
    const rows = branchIds
      ? await prisma.customerLedger.groupBy({
          by: ['customerId'],
          where: { branchId: { in: branchIds } },
          _sum: { debit: true, credit: true },
        })
      : await prisma.customerLedger.groupBy({
          by: ['customerId'],
          _sum: { debit: true, credit: true },
        });
    const salesTotals = branchIds
      ? await prisma.customerLedger.groupBy({
          by: ['customerId'],
          where: { branchId: { in: branchIds } },
          _sum: { debit: true },
        })
      : await prisma.customerLedger.groupBy({
          by: ['customerId'],
          _sum: { debit: true },
        });
    const salesMap = new Map(salesTotals.map((row) => [row.customerId, row._sum.debit ?? new Prisma.Decimal(0)]));
    return rows.map((r) => ({
      customerId: r.customerId,
      totalDue: new Prisma.Decimal(r._sum.debit ?? 0).minus(r._sum.credit ?? 0),
      totalSales: salesMap.get(r.customerId) ?? new Prisma.Decimal(0),
    }));
  },

  async getLedger(session: AppSession | null, customerId: string) {
    await authorize(session, 'crm:read');
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: CUSTOMER_INCLUDE,
    });
    if (!customer) throw new NotFoundError('Customer not found');
    await assertBranchInScope(session, customer.branchId);
    const entries = await prisma.customerLedger.findMany({
      where: { customerId },
      orderBy: { createdAt: 'asc' },
    });
    let running = new Prisma.Decimal(0);
    const enriched = entries.map((e) => {
      running = running.plus(e.debit).minus(e.credit);
      return { ...e, runningBalance: running };
    });
    const totalDebit = entries.reduce(
      (acc, e) => acc.plus(e.debit),
      new Prisma.Decimal(0),
    );
    const totalCredit = entries.reduce(
      (acc, e) => acc.plus(e.credit),
      new Prisma.Decimal(0),
    );
    return { customer, entries: enriched, totalDebit, totalCredit, currentBalance: running };
  },

  async listCategories(session: AppSession | null) {
    await authorize(session, 'crm:read');
    return prisma.customerCategory.findMany({
      where: { companyId: session?.activeCompanyId ?? undefined },
      orderBy: { name: 'asc' },
    });
  },

  async createCategory(session: AppSession | null, input: CustomerCategoryInput) {
    const actor = await authorize(session, 'crm:write');
    if (!actor.activeCompanyId) throw new ValidationError('No active company selected');
    const existing = await prisma.customerCategory.findUnique({
      where: { companyId_name: { companyId: actor.activeCompanyId, name: input.name } },
    });
    if (existing) throw new ValidationError('Category name already exists');
    const category = await prisma.customerCategory.create({
      data: {
        companyId: actor.activeCompanyId,
        name: input.name,
        description: input.description || null,
        discountPct: new Prisma.Decimal(input.discountPct),
        isActive: input.isActive,
      },
    });
    await recordAudit({
      actorId: actor.userId,
      branchId: null,
      module: 'crm',
      action: 'category:create',
      entityType: 'CustomerCategory',
      entityId: category.id,
      after: { name: category.name },
    });
    return category;
  },

  async addInteraction(session: AppSession | null, input: CustomerInteractionInput) {
    const actor = await authorize(session, 'crm:write');
    const customer = await prisma.customer.findUnique({ where: { id: input.customerId } });
    if (!customer) throw new NotFoundError('Customer not found');
    const interaction = await prisma.customerInteraction.create({
      data: {
        customerId: input.customerId,
        type: input.type,
        subject: input.subject,
        body: input.body || null,
        followUpAt: input.followUpAt ?? null,
        createdById: actor.userId,
      },
    });
    await recordAudit({
      actorId: actor.userId,
      branchId: customer.branchId,
      module: 'crm',
      action: 'interaction',
      entityType: 'CustomerInteraction',
      entityId: interaction.id,
      after: { type: interaction.type, subject: interaction.subject },
    });
    return interaction;
  },
};
