import 'server-only';
import { revalidateTag, unstable_cache } from 'next/cache';
import { prisma } from '@/server/db';
import { canAccessCompany } from '@/server/auth/company-access';
import { authorize } from '@/server/auth/authorize';
import { recordAudit } from '@/server/audit/logger';
import type { AppSession } from '@/server/auth/session';
import type { CompanyCreateInput, CompanyUpdateInput } from '@/server/validators/companies';
import { NotFoundError, ValidationError } from '@/lib/errors';

const cachedActiveCompanies = unstable_cache(
  () => prisma.company.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
  ['companies-active'],
  { revalidate: 300, tags: ['companies'] },
);

const cachedAllCompanies = unstable_cache(
  () => prisma.company.findMany({ orderBy: [{ isActive: 'desc' }, { name: 'asc' }] }),
  ['companies-all'],
  { revalidate: 300, tags: ['companies'] },
);

export const companyService = {
  async listAccessible(session: AppSession | null) {
    if (!session) return [];

    const companies = await cachedActiveCompanies();
    if (session.branchAccessType === 'ALL_BRANCHES') {
      return companies;
    }

    const allowed = new Set(session.allowedCompanyIds);
    return companies.filter((company) => allowed.has(company.id));
  },

  async listActive(session: AppSession | null) {
    await authorize(session, 'companies:read');
    return this.listAccessible(session);
  },

  async listAll(session: AppSession | null) {
    await authorize(session, 'companies:read');
    const companies = await cachedAllCompanies();
    if (session?.branchAccessType === 'ALL_BRANCHES') return companies;
    const allowed = new Set(session?.allowedCompanyIds ?? []);
    return companies.filter((company) => allowed.has(company.id));
  },

  async getById(session: AppSession | null, id: string) {
    if (!session) {
      await authorize(session, 'companies:read');
    } else if (session.permissions.includes('companies:read')) {
      await authorize(session, 'companies:read');
    } else if (!canAccessCompany(session, id)) {
      throw new ValidationError('Company access denied');
    }
    const company = await prisma.company.findUnique({ where: { id } });
    if (!company) throw new NotFoundError('Company not found');
    if (!canAccessCompany(session, company.id)) throw new ValidationError('Company access denied');
    return company;
  },

  async create(session: AppSession | null, input: CompanyCreateInput) {
    const actor = await authorize(session, 'companies:write');
    const dup = await prisma.company.findUnique({ where: { code: input.code } });
    if (dup) throw new ValidationError('Company code already exists');

    const company = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          code: input.code,
          name: input.name,
          currency: input.currency,
          address: input.address || null,
          phone: input.phone || null,
          email: input.email || null,
          isActive: input.isActive,
        },
      });
      await recordAudit(
        {
          actorId: actor.userId,
          branchId: actor.activeBranchId,
          module: 'companies',
          action: 'create',
          entityType: 'Company',
          entityId: company.id,
          after: { code: company.code, name: company.name },
        },
        tx,
      );
      return company;
    });
    revalidateTag('companies');
    return company;
  },

  async update(session: AppSession | null, input: CompanyUpdateInput) {
    const actor = await authorize(session, 'companies:write');
    const existing = await prisma.company.findUnique({ where: { id: input.id } });
    if (!existing) throw new NotFoundError('Company not found');
    if (input.code !== existing.code) {
      const dup = await prisma.company.findUnique({ where: { code: input.code } });
      if (dup) throw new ValidationError('Company code already exists');
    }

    const company = await prisma.$transaction(async (tx) => {
      const company = await tx.company.update({
        where: { id: input.id },
        data: {
          code: input.code,
          name: input.name,
          currency: input.currency,
          address: input.address || null,
          phone: input.phone || null,
          email: input.email || null,
          isActive: input.isActive,
        },
      });
      await recordAudit(
        {
          actorId: actor.userId,
          branchId: actor.activeBranchId,
          module: 'companies',
          action: 'update',
          entityType: 'Company',
          entityId: company.id,
          before: { code: existing.code, name: existing.name, isActive: existing.isActive },
          after: { code: company.code, name: company.name, isActive: company.isActive },
        },
        tx,
      );
      return company;
    });
    revalidateTag('companies');
    return company;
  },
};
