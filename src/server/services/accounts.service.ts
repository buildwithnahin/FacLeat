import 'server-only';
import { Prisma, type SystemAccountKey } from '@prisma/client';
import { prisma } from '@/server/db';
import { authorize } from '@/server/auth/authorize';
import { recordAudit } from '@/server/audit/logger';
import type { AppSession } from '@/server/auth/session';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { nextDocumentNumber } from '@/lib/document-number';
import type {
  JournalCreateInput,
  JournalLineInput,
  JournalVoidInput,
} from '@/server/validators/accounts';

const ZERO = new Prisma.Decimal(0);
const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);

type Tx = Prisma.TransactionClient;

async function findOpenPeriod(tx: Tx, branchId: string, date: Date) {
  const period = await tx.period.findFirst({
    where: {
      branchId,
      startsAt: { lte: date },
      endsAt: { gte: date },
    },
  });
  if (!period) throw new ValidationError('No fiscal period covers this date for the branch');
  if (period.status !== 'OPEN') throw new ValidationError(`Period "${period.name}" is ${period.status}`);
  return period;
}

async function assertAccountsPostable(tx: Tx, lines: JournalLineInput[]) {
  const ids = Array.from(new Set(lines.map((l) => l.accountId)));
  const accounts = await tx.chartAccount.findMany({ where: { id: { in: ids } } });
  const byId = new Map(accounts.map((a) => [a.id, a]));
  for (const l of lines) {
    const acc = byId.get(l.accountId);
    if (!acc) throw new ValidationError(`Account ${l.accountId} not found`);
    if (!acc.isActive) throw new ValidationError(`Account ${acc.code} is inactive`);
    if (!acc.isPosting) throw new ValidationError(`Account ${acc.code} is a header — pick a posting account`);
  }
}

async function nextJournalNumber(tx: Tx, date: Date) {
  const year = date.getFullYear();
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);
  const count = await tx.journalEntry.count({
    where: { createdAt: { gte: start, lt: end } },
  });
  return nextDocumentNumber('JE', year, count, 4);
}

export type JournalPostInput = JournalCreateInput & {
  sourceModule?: string;
  sourceRefType?: string;
  sourceRefId?: string;
};

export const accountsService = {
  /**
   * Shared posting helper — callable both from the manual journal UI and
   * from other modules (POS, wholesale, purchase…) inside their own
   * transaction via the `tx` parameter.
   */
  async postJournal(session: AppSession | null, input: JournalPostInput, externalTx?: Tx) {
    const actor = await authorize(session, 'accounts:post');

    const debit = input.lines.reduce((s, l) => s.plus(D(l.debit || 0)), ZERO);
    const credit = input.lines.reduce((s, l) => s.plus(D(l.credit || 0)), ZERO);
    if (!debit.equals(credit)) throw new ValidationError('Debit total must equal credit total');
    if (debit.lte(0)) throw new ValidationError('Journal total must be greater than zero');

    const run = async (tx: Tx) => {
      const period = await findOpenPeriod(tx, input.branchId, input.date);
      await assertAccountsPostable(tx, input.lines);

      const number = await nextJournalNumber(tx, input.date);

      const entry = await tx.journalEntry.create({
        data: {
          number,
          branchId: input.branchId,
          periodId: period.id,
          date: input.date,
          memo: input.memo || null,
          reference: input.reference || null,
          status: input.post ? 'POSTED' : 'DRAFT',
          sourceModule: input.sourceModule ?? null,
          sourceRefType: input.sourceRefType ?? null,
          sourceRefId: input.sourceRefId ?? null,
          totalDebit: debit,
          totalCredit: credit,
          createdById: actor.userId,
          postedById: input.post ? actor.userId : null,
          postedAt: input.post ? new Date() : null,
          lines: {
            create: input.lines.map((l, idx) => ({
              lineNo: idx + 1,
              accountId: l.accountId,
              debit: D(l.debit || 0),
              credit: D(l.credit || 0),
              currency: l.currency,
              fxRate: D(l.fxRate),
              memo: l.memo || null,
              costCenter: l.costCenter || null,
            })),
          },
        },
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: input.branchId,
          module: 'accounts',
          action: input.post ? 'post' : 'create-draft',
          entityType: 'JournalEntry',
          entityId: entry.id,
          after: { number: entry.number, totalDebit: debit.toString(), status: entry.status },
        },
        tx,
      );
      return entry;
    };

    return externalTx ? run(externalTx) : prisma.$transaction(run);
  },

  async listEntries(
    session: AppSession | null,
    filters: {
      branchId?: string;
      status?: 'DRAFT' | 'POSTED' | 'VOIDED';
      from?: Date;
      to?: Date;
      accountId?: string;
      take?: number;
    } = {},
  ) {
    await authorize(session, 'accounts:read');
    return prisma.journalEntry.findMany({
      where: {
        branchId: filters.branchId,
        status: filters.status,
        date: {
          gte: filters.from,
          lte: filters.to,
        },
        lines: filters.accountId ? { some: { accountId: filters.accountId } } : undefined,
      },
      include: { branch: true, period: true },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: filters.take ?? 100,
    });
  },

  async getEntry(session: AppSession | null, id: string) {
    await authorize(session, 'accounts:read');
    const entry = await prisma.journalEntry.findUnique({
      where: { id },
      include: {
        branch: true,
        period: true,
        lines: {
          include: { account: true },
          orderBy: { lineNo: 'asc' },
        },
        reverses: true,
        reversedBy: true,
      },
    });
    if (!entry) throw new NotFoundError('Journal entry not found');
    return entry;
  },

  async postDraft(session: AppSession | null, id: string) {
    const actor = await authorize(session, 'accounts:post');
    return prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.findUnique({ where: { id }, include: { lines: true } });
      if (!entry) throw new NotFoundError('Journal entry not found');
      if (entry.status !== 'DRAFT') throw new ValidationError('Only draft entries can be posted');
      const period = await tx.period.findUnique({ where: { id: entry.periodId } });
      if (!period || period.status !== 'OPEN') throw new ValidationError('Period is not open');

      const updated = await tx.journalEntry.update({
        where: { id },
        data: { status: 'POSTED', postedById: actor.userId, postedAt: new Date() },
      });
      await recordAudit(
        {
          actorId: actor.userId,
          branchId: entry.branchId,
          module: 'accounts',
          action: 'post',
          entityType: 'JournalEntry',
          entityId: entry.id,
          before: { status: entry.status },
          after: { status: 'POSTED' },
        },
        tx,
      );
      return updated;
    });
  },

  /**
   * Reverse-entry void: creates a mirror JE with debit/credit swapped and
   * links via reversesId. Posted entries are never mutated.
   */
  async voidEntry(session: AppSession | null, input: JournalVoidInput) {
    const actor = await authorize(session, 'accounts:void');
    return prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.findUnique({
        where: { id: input.id },
        include: { lines: true },
      });
      if (!entry) throw new NotFoundError('Journal entry not found');
      if (entry.status !== 'POSTED') throw new ValidationError('Only posted entries can be voided');
      if (entry.reversesId) throw new ValidationError('Cannot void a reversal entry');

      const existingReversal = await tx.journalEntry.findUnique({ where: { reversesId: entry.id } });
      if (existingReversal) throw new ValidationError('Entry has already been reversed');

      const period = await findOpenPeriod(tx, entry.branchId, new Date());

      const number = await nextJournalNumber(tx, new Date());
      const reversal = await tx.journalEntry.create({
        data: {
          number,
          branchId: entry.branchId,
          periodId: period.id,
          date: new Date(),
          memo: `Reversal of ${entry.number}: ${input.reason}`,
          reference: entry.reference,
          status: 'POSTED',
          reversesId: entry.id,
          totalDebit: entry.totalCredit,
          totalCredit: entry.totalDebit,
          createdById: actor.userId,
          postedById: actor.userId,
          postedAt: new Date(),
          lines: {
            create: entry.lines.map((l) => ({
              lineNo: l.lineNo,
              accountId: l.accountId,
              debit: l.credit,
              credit: l.debit,
              currency: l.currency,
              fxRate: l.fxRate,
              memo: l.memo,
              costCenter: l.costCenter,
            })),
          },
        },
      });

      await tx.journalEntry.update({
        where: { id: entry.id },
        data: { status: 'VOIDED', voidedById: actor.userId, voidedAt: new Date() },
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: entry.branchId,
          module: 'accounts',
          action: 'void',
          entityType: 'JournalEntry',
          entityId: entry.id,
          before: { status: 'POSTED' },
          after: { status: 'VOIDED', reversalNumber: reversal.number, reason: input.reason },
        },
        tx,
      );
      return { entry, reversal };
    });
  },

  async resolveSystemAccount(tx: Tx, key: SystemAccountKey, branchId: string | null) {
    const branchMap = branchId
      ? await tx.systemAccountMapping.findFirst({ where: { key, branchId } })
      : null;
    const globalMap = branchMap
      ? null
      : await tx.systemAccountMapping.findFirst({ where: { key, branchId: null } });
    const map = branchMap ?? globalMap;
    if (!map) throw new ValidationError(`System account "${key}" is not mapped`);
    return map.accountId;
  },

  async accountLedger(
    session: AppSession | null,
    filters: { accountId: string; branchId?: string; from?: Date; to?: Date },
  ) {
    await authorize(session, 'accounts:read');
    const account = await prisma.chartAccount.findUnique({ where: { id: filters.accountId } });
    if (!account) throw new NotFoundError('Account not found');

    const lines = await prisma.journalEntryLine.findMany({
      where: {
        accountId: filters.accountId,
        entry: {
          status: 'POSTED',
          branchId: filters.branchId,
          date: { gte: filters.from, lte: filters.to },
        },
      },
      include: { entry: { include: { branch: true } } },
      orderBy: [{ entry: { date: 'asc' } }, { entry: { createdAt: 'asc' } }, { lineNo: 'asc' }],
    });

    let running =
      account.normalSide === 'DEBIT' ? account.openingBalance : account.openingBalance.negated();
    const rows = lines.map((l) => {
      const delta = account.normalSide === 'DEBIT' ? l.debit.minus(l.credit) : l.credit.minus(l.debit);
      running = running.plus(delta);
      return {
        id: l.id,
        date: l.entry.date,
        entryId: l.entryId,
        number: l.entry.number,
        branchCode: l.entry.branch.code,
        memo: l.memo ?? l.entry.memo ?? '',
        reference: l.entry.reference ?? '',
        debit: l.debit,
        credit: l.credit,
        balance: running,
      };
    });

    return { account, opening: account.openingBalance, rows, closing: running };
  },

  async listPeriods(session: AppSession | null, filters: { branchId?: string } = {}) {
    await authorize(session, 'accounts:read');
    return prisma.period.findMany({
      where: { branchId: filters.branchId },
      include: { branch: true, _count: { select: { journalEntries: true } } },
      orderBy: [{ branchId: 'asc' }, { startsAt: 'desc' }],
    });
  },

  async createPeriod(
    session: AppSession | null,
    input: { branchId: string; name: string; startsAt: Date; endsAt: Date },
  ) {
    const actor = await authorize(session, 'accounts:close-period');
    if (input.endsAt <= input.startsAt) throw new ValidationError('End date must be after start date');
    const overlap = await prisma.period.findFirst({
      where: {
        branchId: input.branchId,
        startsAt: { lte: input.endsAt },
        endsAt: { gte: input.startsAt },
      },
    });
    if (overlap) throw new ValidationError(`Overlaps period "${overlap.name}"`);

    return prisma.$transaction(async (tx) => {
      const p = await tx.period.create({
        data: { branchId: input.branchId, name: input.name, startsAt: input.startsAt, endsAt: input.endsAt },
      });
      await recordAudit(
        {
          actorId: actor.userId,
          branchId: input.branchId,
          module: 'accounts',
          action: 'create-period',
          entityType: 'Period',
          entityId: p.id,
          after: { name: p.name, startsAt: p.startsAt, endsAt: p.endsAt },
        },
        tx,
      );
      return p;
    });
  },

  async setPeriodStatus(
    session: AppSession | null,
    input: { id: string; status: 'OPEN' | 'LOCKED' | 'CLOSED' },
  ) {
    const actor = await authorize(session, 'accounts:close-period');
    return prisma.$transaction(async (tx) => {
      const existing = await tx.period.findUnique({ where: { id: input.id } });
      if (!existing) throw new NotFoundError('Period not found');
      if (existing.status === 'CLOSED' && input.status !== 'CLOSED') {
        throw new ValidationError('Closed periods cannot be reopened');
      }
      if (input.status === 'CLOSED') {
        const drafts = await tx.journalEntry.count({
          where: { periodId: input.id, status: 'DRAFT' },
        });
        if (drafts > 0) throw new ValidationError(`${drafts} draft entries must be posted or discarded first`);
      }
      const updated = await tx.period.update({
        where: { id: input.id },
        data: { status: input.status },
      });
      await recordAudit(
        {
          actorId: actor.userId,
          branchId: existing.branchId,
          module: 'accounts',
          action: 'period-status',
          entityType: 'Period',
          entityId: existing.id,
          before: { status: existing.status },
          after: { status: updated.status },
        },
        tx,
      );
      return updated;
    });
  },

  async balanceSheet(
    session: AppSession | null,
    filters: { branchId?: string; asOf?: Date } = {},
  ) {
    const tb = await this.trialBalance(session, filters);
    const asset = tb.filter((r) => r.type === 'ASSET');
    const liability = tb.filter((r) => r.type === 'LIABILITY');
    const equity = tb.filter((r) => r.type === 'EQUITY');
    const totalAsset = asset.reduce((s, r) => s.plus(r.balance), ZERO);
    const totalLiability = liability.reduce((s, r) => s.plus(r.credit.minus(r.debit)), ZERO);
    const totalEquity = equity.reduce((s, r) => s.plus(r.credit.minus(r.debit)), ZERO);
    const income = tb
      .filter((r) => r.type === 'INCOME')
      .reduce((s, r) => s.plus(r.credit.minus(r.debit)), ZERO);
    const expense = tb
      .filter((r) => r.type === 'EXPENSE')
      .reduce((s, r) => s.plus(r.debit.minus(r.credit)), ZERO);
    const retained = income.minus(expense);
    return {
      asset,
      liability,
      equity,
      totals: {
        asset: totalAsset,
        liability: totalLiability,
        equity: totalEquity,
        retained,
        liabilityPlusEquity: totalLiability.plus(totalEquity).plus(retained),
      },
    };
  },

  async incomeStatement(
    session: AppSession | null,
    filters: { branchId?: string; from?: Date; to?: Date } = {},
  ) {
    await authorize(session, 'accounts:read');
    const rows = await prisma.journalEntryLine.groupBy({
      by: ['accountId'],
      where: {
        entry: {
          status: 'POSTED',
          branchId: filters.branchId,
          date: { gte: filters.from, lte: filters.to },
        },
      },
      _sum: { debit: true, credit: true },
    });
    const accounts = await prisma.chartAccount.findMany({
      where: { id: { in: rows.map((r) => r.accountId) }, type: { in: ['INCOME', 'EXPENSE'] } },
    });
    const byId = new Map(accounts.map((a) => [a.id, a]));
    const income: { id: string; code: string; name: string; amount: Prisma.Decimal }[] = [];
    const expense: { id: string; code: string; name: string; amount: Prisma.Decimal }[] = [];
    let totalIncome = ZERO;
    let totalExpense = ZERO;
    for (const r of rows) {
      const acc = byId.get(r.accountId);
      if (!acc) continue;
      const d = r._sum.debit ?? ZERO;
      const c = r._sum.credit ?? ZERO;
      if (acc.type === 'INCOME') {
        const amt = c.minus(d);
        income.push({ id: acc.id, code: acc.code, name: acc.name, amount: amt });
        totalIncome = totalIncome.plus(amt);
      } else {
        const amt = d.minus(c);
        expense.push({ id: acc.id, code: acc.code, name: acc.name, amount: amt });
        totalExpense = totalExpense.plus(amt);
      }
    }
    income.sort((a, b) => a.code.localeCompare(b.code));
    expense.sort((a, b) => a.code.localeCompare(b.code));
    return {
      income,
      expense,
      totals: { income: totalIncome, expense: totalExpense, net: totalIncome.minus(totalExpense) },
    };
  },

  async trialBalance(
    session: AppSession | null,
    filters: { branchId?: string; asOf?: Date } = {},
  ) {
    await authorize(session, 'accounts:read');
    const rows = await prisma.journalEntryLine.groupBy({
      by: ['accountId'],
      where: {
        entry: {
          status: 'POSTED',
          branchId: filters.branchId,
          date: filters.asOf ? { lte: filters.asOf } : undefined,
        },
      },
      _sum: { debit: true, credit: true },
    });
    const accounts = await prisma.chartAccount.findMany({
      where: { id: { in: rows.map((r) => r.accountId) } },
    });
    const byId = new Map(accounts.map((a) => [a.id, a]));
    return rows
      .map((r) => {
        const acc = byId.get(r.accountId);
        const debit = r._sum.debit ?? ZERO;
        const credit = r._sum.credit ?? ZERO;
        return {
          accountId: r.accountId,
          code: acc?.code ?? '',
          name: acc?.name ?? '',
          type: acc?.type ?? 'ASSET',
          debit,
          credit,
          balance: debit.minus(credit),
        };
      })
      .sort((a, b) => a.code.localeCompare(b.code));
  },

  async cashFlowStatement(
    session: AppSession | null,
    filters: { branchId?: string; from: Date; to: Date },
  ) {
    await authorize(session, 'accounts:read');

    // Net profit for the period
    const is = await this.incomeStatement(session, filters);
    const netProfit = is.totals.net;

    // Depreciation: sum of all asset depreciation entries in the period
    const depreciationRows = await prisma.assetMovement.aggregate({
      _sum: { amount: true },
      where: {
        type: 'DEPRECIATION',
        createdAt: { gte: filters.from, lte: filters.to },
        ...(filters.branchId ? { branchId: filters.branchId } : {}),
      },
    });
    const depreciation = depreciationRows._sum.amount ?? ZERO;

    // Helper: get total balance of a COA type as-of a date
    const balanceByType = async (types: string[], asOf: Date) => {
      const tb = await this.trialBalance(session, { branchId: filters.branchId, asOf });
      return tb
        .filter((r) => types.includes(r.type))
        .reduce((s, r) => {
          const net = r.type === 'ASSET' ? r.debit.minus(r.credit) : r.credit.minus(r.debit);
          return s.plus(net);
        }, ZERO);
    };

    // Changes in working capital (end vs start)
    const startDate = new Date(filters.from.getTime() - 1);
    const [inventoryEnd, inventoryStart] = await Promise.all([
      balanceByType(['ASSET'], filters.to), // rough proxy — ideally filter by COA code
      balanceByType(['ASSET'], startDate),
    ]);

    // Inventory change from InventoryLedger (qty movement, not used in monetary calc below)
    await prisma.inventoryLedger.groupBy({
      by: ['direction'],
      where: {
        ...(filters.branchId ? { branchId: filters.branchId } : {}),
        createdAt: { gte: filters.from, lte: filters.to },
      },
      _sum: { quantity: true },
    });
    // Use TB-based inventory delta for monetary change
    const inventoryChange = inventoryEnd.minus(inventoryStart).negated();

    // Investing: fixed asset acquisitions in period
    const assetAcquisitions = await prisma.asset.aggregate({
      _sum: { purchaseCost: true },
      where: {
        purchaseDate: { gte: filters.from, lte: filters.to },
        ...(filters.branchId ? { branchId: filters.branchId } : {}),
      },
    });
    const assetPurchases = (assetAcquisitions._sum.purchaseCost ?? ZERO).negated();

    // Financing: equity movements
    const equityStart = await this.trialBalance(session, { branchId: filters.branchId, asOf: startDate });
    const equityEnd = await this.trialBalance(session, { branchId: filters.branchId, asOf: filters.to });
    const equityStartTotal = equityStart.filter((r) => r.type === 'EQUITY').reduce((s, r) => s.plus(r.credit.minus(r.debit)), ZERO);
    const equityEndTotal = equityEnd.filter((r) => r.type === 'EQUITY').reduce((s, r) => s.plus(r.credit.minus(r.debit)), ZERO);
    const shareCapitalChange = equityEndTotal.minus(equityStartTotal);

    const operatingCF = netProfit.plus(depreciation).plus(inventoryChange);
    const investingCF = assetPurchases;
    const financingCF = shareCapitalChange;
    const netChange = operatingCF.plus(investingCF).plus(financingCF);

    // Opening cash: sum of all POSTED journal lines on cash/bank accounts before from
    const cashTBStart = await this.trialBalance(session, { branchId: filters.branchId, asOf: startDate });
    const openingCash = cashTBStart
      .filter((r) => r.code.startsWith('1') && r.type === 'ASSET')
      .reduce((s, r) => s.plus(r.debit.minus(r.credit)), ZERO);
    const closingCash = openingCash.plus(netChange);

    return {
      operating: {
        netProfit,
        depreciation,
        inventoryChange,
        total: operatingCF,
      },
      investing: {
        assetPurchases,
        total: investingCF,
      },
      financing: {
        shareCapitalChange,
        total: financingCF,
      },
      netChange,
      openingCash,
      closingCash,
    };
  },

  async changesInEquity(
    session: AppSession | null,
    filters: { branchId?: string; from: Date; to: Date },
  ) {
    await authorize(session, 'accounts:read');

    const startDate = new Date(filters.from.getTime() - 1);
    const [tbStart, tbEnd] = await Promise.all([
      this.trialBalance(session, { branchId: filters.branchId, asOf: startDate }),
      this.trialBalance(session, { branchId: filters.branchId, asOf: filters.to }),
    ]);

    const equityBalance = (tb: typeof tbStart, name: string) =>
      tb.filter((r) => r.type === 'EQUITY' && r.name.toLowerCase().includes(name.toLowerCase()))
        .reduce((s, r) => s.plus(r.credit.minus(r.debit)), ZERO);

    const shareCapitalStart = equityBalance(tbStart, 'share capital');
    const shareCapitalEnd = equityBalance(tbEnd, 'share capital');

    const is = await this.incomeStatement(session, filters);
    const netProfit = is.totals.net;

    const retainedStart = equityBalance(tbStart, 'retained');
    const retainedEnd = retainedStart.plus(netProfit);

    return {
      current: {
        period: filters.to.getFullYear(),
        openingShareCapital: shareCapitalStart,
        shareCapitalAdded: shareCapitalEnd.minus(shareCapitalStart),
        closeShareCapital: shareCapitalEnd,
        openingRetained: retainedStart,
        netProfit,
        closingRetained: retainedEnd,
        totalEquity: shareCapitalEnd.plus(retainedEnd),
      },
    };
  },

  async financialNotes(
    session: AppSession | null,
    filters: { branchId?: string; asOf: Date },
  ) {
    await authorize(session, 'accounts:read');

    // PP&E schedule from Asset model
    const assets = await prisma.asset.findMany({
      where: {
        ...(filters.branchId ? { branchId: filters.branchId } : {}),
        purchaseDate: { lte: filters.asOf },
        status: { not: 'DISPOSED' },
      },
      include: { category: { select: { name: true } } },
    });

    const totalCost = assets.reduce((s, a) => s.plus(a.purchaseCost), ZERO);
    const totalAccumDep = assets.reduce((s, a) => s.plus(a.accumulatedDepreciation), ZERO);
    const totalWDV = totalCost.minus(totalAccumDep);

    const ppe = {
      openingCost: totalCost,
      additions: ZERO,
      closingCost: totalCost,
      openingAccumDep: totalAccumDep,
      depreciationForYear: ZERO,
      closingAccumDep: totalAccumDep,
      writtenDownValue: totalWDV,
      assets: assets.map((a) => ({
        name: a.name,
        category: a.category?.name ?? '—',
        cost: a.purchaseCost,
        accumDep: a.accumulatedDepreciation,
        wdv: a.purchaseCost.minus(a.accumulatedDepreciation),
      })),
    };

    // Inventory breakdown from InventoryLedger aggregated by product type
    const branchFilter = filters.branchId
      ? Prisma.sql`AND il."branchId" = ${filters.branchId}`
      : Prisma.empty;
    const invRows = await prisma.$queryRaw<{ type: string; value: number }[]>(
      Prisma.sql`
        SELECT p.type, COALESCE(SUM(CASE WHEN il.direction = 'IN' THEN il.quantity ELSE -il.quantity END * il."costPerUnit"), 0) as value
        FROM "InventoryLedger" il
        JOIN "Product" p ON p.id = il."productId"
        WHERE il."createdAt" <= ${filters.asOf}
        ${branchFilter}
        GROUP BY p.type
      `,
    );

    const invByType = new Map(invRows.map((r) => [r.type, new Prisma.Decimal(r.value)]));
    const inventories = {
      rawMaterials: invByType.get('RAW_MATERIAL') ?? ZERO,
      wip: invByType.get('WORK_IN_PROGRESS') ?? ZERO,
      finishedGoods: invByType.get('FINISHED_GOOD') ?? ZERO,
      total: ZERO as Prisma.Decimal,
    };
    inventories.total = inventories.rawMaterials.plus(inventories.wip).plus(inventories.finishedGoods);

    // Advances: sub-accounts with "advance" or "deposit" in name
    const advanceTB = await this.trialBalance(session, { branchId: filters.branchId, asOf: filters.asOf });
    const advances = advanceTB
      .filter((r) => r.type === 'ASSET' && (r.name.toLowerCase().includes('advance') || r.name.toLowerCase().includes('deposit')))
      .map((r) => ({ code: r.code, name: r.name, amount: r.debit.minus(r.credit) }));

    return { ppe, inventories, advances };
  },

  async dailyCashFlow(
    session: AppSession | null,
    filters: { branchId?: string; from: Date; to: Date },
  ) {
    await authorize(session, 'accounts:read');

    const rangeStart = new Date(filters.from);
    rangeStart.setUTCHours(0, 0, 0, 0);
    const rangeEnd = new Date(filters.to);
    rangeEnd.setUTCHours(0, 0, 0, 0);

    // Fetch operational cash transactions in range
    const [posRows, wsPayRows, corpPayRows, supPayRows, cashEntryRows, sentTransferRows, receivedTransferRows] = await Promise.all([
      prisma.posSale.findMany({
        where: {
          branchId: filters.branchId,
          saleDate: { gte: filters.from, lte: filters.to },
          status: { not: 'VOIDED' },
        },
        select: { saleDate: true, paidTotal: true },
      }),
      prisma.wholesalePayment.findMany({
        where: {
          paidAt: { gte: filters.from, lte: filters.to },
          invoice: { branchId: filters.branchId },
        },
        select: { paidAt: true, amount: true },
      }),
      prisma.corporateInvoicePayment.findMany({
        where: {
          paidAt: { gte: filters.from, lte: filters.to },
          invoice: { branchId: filters.branchId },
        },
        select: { paidAt: true, amount: true },
      }),
      prisma.supplierPayment.findMany({
        where: {
          branchId: filters.branchId,
          paymentDate: { gte: filters.from, lte: filters.to },
        },
        select: { paymentDate: true, amount: true },
      }),
      prisma.cashEntry.findMany({
        where: {
          branchId: filters.branchId,
          date: { gte: filters.from, lte: filters.to },
        },
        select: { date: true, type: true, totalAmount: true },
      }),
      filters.branchId
        ? prisma.cashTransfer.findMany({
            where: {
              fromBranchId: filters.branchId,
              transferDate: { gte: filters.from, lte: filters.to },
            },
            select: { transferDate: true, amount: true },
          })
        : Promise.resolve([]),
      filters.branchId
        ? prisma.cashTransfer.findMany({
            where: {
              toBranchId: filters.branchId,
              transferDate: { gte: filters.from, lte: filters.to },
            },
            select: { transferDate: true, amount: true },
          })
        : Promise.resolve([]),
    ]);

    // Opening balance: net from all history before range start
    const [posOpenAgg, wsOpenAgg, corpOpenAgg, supOpenAgg, cashInOpenAgg, cashOutOpenAgg, sentTransferOpenAgg, receivedTransferOpenAgg, openingEntriesBeforeRange] = await Promise.all([
      prisma.posSale.aggregate({
        where: {
          branchId: filters.branchId,
          saleDate: { lt: filters.from },
          status: { not: 'VOIDED' },
        },
        _sum: { paidTotal: true },
      }),
      prisma.wholesalePayment.aggregate({
        where: { paidAt: { lt: filters.from }, invoice: { branchId: filters.branchId } },
        _sum: { amount: true },
      }),
      prisma.corporateInvoicePayment.aggregate({
        where: { paidAt: { lt: filters.from }, invoice: { branchId: filters.branchId } },
        _sum: { amount: true },
      }),
      prisma.supplierPayment.aggregate({
        where: { branchId: filters.branchId, paymentDate: { lt: filters.from } },
        _sum: { amount: true },
      }),
      prisma.cashEntry.aggregate({
        where: { type: 'CASH_IN', branchId: filters.branchId, date: { lt: filters.from } },
        _sum: { totalAmount: true },
      }),
      prisma.cashEntry.aggregate({
        where: { type: 'CASH_OUT', branchId: filters.branchId, date: { lt: filters.from } },
        _sum: { totalAmount: true },
      }),
      filters.branchId
        ? prisma.cashTransfer.aggregate({
            where: { fromBranchId: filters.branchId, transferDate: { lt: filters.from } },
            _sum: { amount: true },
          })
        : Promise.resolve({ _sum: { amount: ZERO } }),
      filters.branchId
        ? prisma.cashTransfer.aggregate({
            where: { toBranchId: filters.branchId, transferDate: { lt: filters.from } },
            _sum: { amount: true },
          })
        : Promise.resolve({ _sum: { amount: ZERO } }),
      prisma.openingBalanceEntry.findMany({
        where: {
          branchId: filters.branchId,
          date: { lte: filters.from },
        },
        select: { normalSide: true, amount: true },
      }),
    ]);

    const openingEntryNet = openingEntriesBeforeRange.reduce(
      (sum, row) => sum.plus(row.normalSide === 'DEBIT' ? row.amount : row.amount.negated()),
      ZERO,
    );

    const openingBalance = (posOpenAgg._sum.paidTotal ?? ZERO)
      .plus(wsOpenAgg._sum.amount ?? ZERO)
      .plus(corpOpenAgg._sum.amount ?? ZERO)
      .plus(cashInOpenAgg._sum.totalAmount ?? ZERO)
      .plus(receivedTransferOpenAgg._sum.amount ?? ZERO)
      .plus(openingEntryNet)
      .minus(supOpenAgg._sum.amount ?? ZERO)
      .minus(cashOutOpenAgg._sum.totalAmount ?? ZERO)
      .minus(sentTransferOpenAgg._sum.amount ?? ZERO);

    // Group by date
    type DayBucket = { totalIn: Prisma.Decimal; totalOut: Prisma.Decimal; countIn: number; countOut: number };
    const byDate = new Map<string, DayBucket>();

    const addIn = (date: Date, amount: Prisma.Decimal) => {
      const key = date.toISOString().slice(0, 10);
      const d = byDate.get(key) ?? { totalIn: ZERO, totalOut: ZERO, countIn: 0, countOut: 0 };
      d.totalIn = d.totalIn.plus(amount);
      d.countIn++;
      byDate.set(key, d);
    };

    const addOut = (date: Date, amount: Prisma.Decimal) => {
      const key = date.toISOString().slice(0, 10);
      const d = byDate.get(key) ?? { totalIn: ZERO, totalOut: ZERO, countIn: 0, countOut: 0 };
      d.totalOut = d.totalOut.plus(amount);
      d.countOut++;
      byDate.set(key, d);
    };

    for (const r of posRows) addIn(r.saleDate, r.paidTotal);
    for (const r of wsPayRows) addIn(r.paidAt, r.amount);
    for (const r of corpPayRows) addIn(r.paidAt, r.amount);
    for (const r of supPayRows) addOut(r.paymentDate, r.amount);
    for (const r of cashEntryRows) {
      if (r.type === 'CASH_IN') addIn(r.date, r.totalAmount);
      else addOut(r.date, r.totalAmount);
    }
    for (const r of receivedTransferRows) addIn(r.transferDate, r.amount);
    for (const r of sentTransferRows) addOut(r.transferDate, r.amount);

    // Build rows with running balance (oldest-first, then reversed for display)
    let running = openingBalance;
    const rows: Array<{
      date: string;
      openingBalance: Prisma.Decimal;
      totalIn: Prisma.Decimal;
      totalOut: Prisma.Decimal;
      netBalance: Prisma.Decimal;
      closingBalance: Prisma.Decimal;
      countIn: number;
      countOut: number;
    }> = [];

    for (let day = new Date(rangeStart); day <= rangeEnd; day.setUTCDate(day.getUTCDate() + 1)) {
      const date = day.toISOString().slice(0, 10);
      const d = byDate.get(date) ?? { totalIn: ZERO, totalOut: ZERO, countIn: 0, countOut: 0 };
        const opening = running;
        const net = d.totalIn.minus(d.totalOut);
        const closing = opening.plus(net);
        running = closing;
        rows.push({
          date,
          openingBalance: opening,
          totalIn: d.totalIn,
          totalOut: d.totalOut,
          netBalance: net,
          closingBalance: closing,
          countIn: d.countIn,
          countOut: d.countOut,
        });
    }

    rows.reverse();

    const totalIn = rows.reduce((s, r) => s.plus(r.totalIn), ZERO);
    const totalOut = rows.reduce((s, r) => s.plus(r.totalOut), ZERO);
    const closingBalance = openingBalance.plus(totalIn).minus(totalOut);

    return {
      summary: { openingBalance, totalIn, totalOut, closingBalance },
      rows,
    };
  },

  async dailyCashFlowDetails(
    session: AppSession | null,
    filters: { branchId?: string; date: Date },
  ) {
    await authorize(session, 'accounts:read');

    const from = new Date(filters.date);
    from.setUTCHours(0, 0, 0, 0);
    const to = new Date(filters.date);
    to.setUTCHours(23, 59, 59, 999);

    const [posRows, wsPayRows, corpPayRows, supPayRows, cashEntryRows, sentTransferRows, receivedTransferRows] = await Promise.all([
      prisma.posSale.findMany({
        where: {
          branchId: filters.branchId,
          saleDate: { gte: from, lte: to },
          status: { not: 'VOIDED' },
        },
        select: {
          id: true,
          number: true,
          saleDate: true,
          paidTotal: true,
          customer: { select: { name: true } },
          notes: true,
        },
        orderBy: { saleDate: 'asc' },
      }),
      prisma.wholesalePayment.findMany({
        where: {
          paidAt: { gte: from, lte: to },
          invoice: { branchId: filters.branchId },
        },
        select: {
          id: true,
          paidAt: true,
          amount: true,
          method: true,
          reference: true,
          invoice: {
            select: {
              number: true,
              customer: { select: { name: true } },
            },
          },
        },
        orderBy: { paidAt: 'asc' },
      }),
      prisma.corporateInvoicePayment.findMany({
        where: {
          paidAt: { gte: from, lte: to },
          invoice: { branchId: filters.branchId },
        },
        select: {
          id: true,
          paidAt: true,
          amount: true,
          method: true,
          reference: true,
          invoice: {
            select: {
              number: true,
              customer: { select: { name: true } },
            },
          },
        },
        orderBy: { paidAt: 'asc' },
      }),
      prisma.supplierPayment.findMany({
        where: {
          branchId: filters.branchId,
          paymentDate: { gte: from, lte: to },
        },
        select: {
          id: true,
          number: true,
          paymentDate: true,
          amount: true,
          method: true,
          reference: true,
          notes: true,
          supplier: { select: { name: true } },
        },
        orderBy: { paymentDate: 'asc' },
      }),
      prisma.cashEntry.findMany({
        where: {
          branchId: filters.branchId,
          date: { gte: from, lte: to },
        },
        select: {
          id: true,
          number: true,
          date: true,
          type: true,
          totalAmount: true,
          receiveMode: true,
          category: true,
          reference: true,
          remarks: true,
          contact: { select: { name: true } },
          contactName: true,
        },
        orderBy: { date: 'asc' },
      }),
      filters.branchId
        ? prisma.cashTransfer.findMany({
            where: {
              fromBranchId: filters.branchId,
              transferDate: { gte: from, lte: to },
            },
            select: {
              id: true,
              number: true,
              transferDate: true,
              amount: true,
              transferVia: true,
              reference: true,
              remarks: true,
              toBranch: { select: { name: true } },
            },
            orderBy: { transferDate: 'asc' },
          })
        : Promise.resolve([]),
      filters.branchId
        ? prisma.cashTransfer.findMany({
            where: {
              toBranchId: filters.branchId,
              transferDate: { gte: from, lte: to },
            },
            select: {
              id: true,
              number: true,
              transferDate: true,
              amount: true,
              transferVia: true,
              reference: true,
              remarks: true,
              fromBranch: { select: { name: true } },
            },
            orderBy: { transferDate: 'asc' },
          })
        : Promise.resolve([]),
    ]);

    const items = [
      ...posRows.map((r) => ({
        id: r.id,
        dateTime: r.saleDate,
        direction: 'IN' as const,
        module: 'POS sale',
        number: r.number,
        partyName: r.customer?.name ?? 'Walk-in customer',
        reference: null,
        method: 'Cash',
        notes: r.notes ?? null,
        amount: r.paidTotal,
      })),
      ...wsPayRows.map((r) => ({
        id: r.id,
        dateTime: r.paidAt,
        direction: 'IN' as const,
        module: 'Wholesale payment',
        number: r.invoice.number,
        partyName: r.invoice.customer?.name ?? 'Wholesale customer',
        reference: r.reference ?? null,
        method: r.method,
        notes: null,
        amount: r.amount,
      })),
      ...corpPayRows.map((r) => ({
        id: r.id,
        dateTime: r.paidAt,
        direction: 'IN' as const,
        module: 'Corporate payment',
        number: r.invoice.number,
        partyName: r.invoice.customer.name,
        reference: r.reference ?? null,
        method: r.method,
        notes: null,
        amount: r.amount,
      })),
      ...supPayRows.map((r) => ({
        id: r.id,
        dateTime: r.paymentDate,
        direction: 'OUT' as const,
        module: 'Supplier payment',
        number: r.number,
        partyName: r.supplier.name,
        reference: r.reference ?? null,
        method: r.method,
        notes: r.notes ?? null,
        amount: r.amount,
      })),
      ...cashEntryRows.map((r) => ({
        id: r.id,
        dateTime: r.date,
        direction: r.type === 'CASH_IN' ? ('IN' as const) : ('OUT' as const),
        module: r.type === 'CASH_IN' ? 'Manual cash in' : 'Manual cash out',
        number: r.number,
        partyName: r.contact?.name ?? r.contactName ?? null,
        reference: r.reference ?? null,
        method: r.receiveMode,
        notes: r.remarks ?? r.category,
        amount: r.totalAmount,
      })),
      ...receivedTransferRows.map((r) => ({
        id: r.id,
        dateTime: r.transferDate,
        direction: 'IN' as const,
        module: 'Cash transfer',
        number: r.number,
        partyName: r.fromBranch.name,
        reference: r.reference ?? null,
        method: r.transferVia ?? null,
        notes: r.remarks ?? null,
        amount: r.amount,
      })),
      ...sentTransferRows.map((r) => ({
        id: r.id,
        dateTime: r.transferDate,
        direction: 'OUT' as const,
        module: 'Cash transfer',
        number: r.number,
        partyName: r.toBranch.name,
        reference: r.reference ?? null,
        method: r.transferVia ?? null,
        notes: r.remarks ?? null,
        amount: r.amount,
      })),
    ].sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime());

    const summary = items.reduce(
      (acc, item) => {
        if (item.direction === 'IN') {
          acc.totalIn = acc.totalIn.plus(item.amount);
          acc.countIn += 1;
        } else {
          acc.totalOut = acc.totalOut.plus(item.amount);
          acc.countOut += 1;
        }
        return acc;
      },
      { totalIn: ZERO, totalOut: ZERO, countIn: 0, countOut: 0 },
    );

    return {
      date: from.toISOString().slice(0, 10),
      summary: {
        totalIn: summary.totalIn,
        totalOut: summary.totalOut,
        netBalance: summary.totalIn.minus(summary.totalOut),
        countIn: summary.countIn,
        countOut: summary.countOut,
      },
      items,
    };
  },

  async listVouchers(
    session: AppSession | null,
    filters: {
      branchId?: string;
      from?: Date;
      to?: Date;
      type: 'CASH_IN' | 'CASH_OUT' | 'CASH_TRANSFER' | 'BULK';
    },
  ) {
    await authorize(session, 'accounts:read');

    type VRow = {
      id: string;
      number: string;
      date: string;
      memo: string;
      reference: string;
      branchName: string;
      totalDebit: string;
      totalCredit: string;
      cashIn: string;
      cashOut: string;
      lineCount: number;
      sourceModule: string;
    };

    const isCash = (acc: { type: string; code: string }) =>
      acc.type === 'ASSET' && acc.code.startsWith('1');

    // Shared helper to fetch manual journal entries (no sourceModule) with cash lines
    const fetchManualJe = () =>
      prisma.journalEntry.findMany({
        where: {
          status: 'POSTED',
          sourceModule: null,
          ...(filters.branchId ? { branchId: filters.branchId } : {}),
          ...(filters.from || filters.to ? { date: { gte: filters.from, lte: filters.to } } : {}),
          lines: { some: { account: { type: 'ASSET', code: { startsWith: '1' } } } },
        },
        select: {
          id: true,
          number: true,
          date: true,
          memo: true,
          reference: true,
          totalDebit: true,
          totalCredit: true,
          sourceModule: true,
          branch: { select: { name: true } },
          lines: {
            select: { debit: true, credit: true, account: { select: { type: true, code: true } } },
          },
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: 100,
      });

    // ── CASH_IN: POS sales + wholesale/corporate payments + manual journal entries ──
    if (filters.type === 'CASH_IN') {
      const [posRows, wsRows, corpRows, jeRows] = await Promise.all([
        prisma.posSale.findMany({
          where: {
            branchId: filters.branchId,
            saleDate: { gte: filters.from, lte: filters.to },
            status: { not: 'VOIDED' },
          },
          select: {
            id: true,
            number: true,
            saleDate: true,
            paidTotal: true,
            branch: { select: { name: true } },
          },
          orderBy: { saleDate: 'desc' },
          take: 200,
        }),
        prisma.wholesalePayment.findMany({
          where: {
            paidAt: { gte: filters.from, lte: filters.to },
            invoice: { branchId: filters.branchId },
          },
          select: {
            id: true,
            amount: true,
            paidAt: true,
            reference: true,
            invoice: { select: { number: true, branch: { select: { name: true } } } },
          },
          orderBy: { paidAt: 'desc' },
          take: 100,
        }),
        prisma.corporateInvoicePayment.findMany({
          where: {
            paidAt: { gte: filters.from, lte: filters.to },
            invoice: { branchId: filters.branchId },
          },
          select: {
            id: true,
            amount: true,
            paidAt: true,
            reference: true,
            invoice: { select: { number: true, branch: { select: { name: true } } } },
          },
          orderBy: { paidAt: 'desc' },
          take: 100,
        }),
        fetchManualJe(),
      ]);

      const jeIn: VRow[] = jeRows
        .filter((e) => {
          const net = e.lines
            .filter((l) => isCash(l.account))
            .reduce((s, l) => s.plus(l.debit).minus(l.credit), ZERO);
          return net.greaterThan(0);
        })
        .map((e) => {
          const cashIn = e.lines
            .filter((l) => isCash(l.account))
            .reduce((s, l) => s.plus(l.debit), ZERO);
          return {
            id: e.id,
            number: e.number,
            date: e.date.toISOString().slice(0, 10),
            memo: e.memo ?? '',
            reference: e.reference ?? '',
            branchName: e.branch.name,
            totalDebit: e.totalDebit.toString(),
            totalCredit: e.totalCredit.toString(),
            cashIn: cashIn.toString(),
            cashOut: '0',
            lineCount: e.lines.length,
            sourceModule: '',
          };
        });

      return [
        ...posRows.map((r): VRow => ({
          id: r.id,
          number: r.number,
          date: r.saleDate.toISOString().slice(0, 10),
          memo: 'POS Sale',
          reference: r.number,
          branchName: r.branch.name,
          totalDebit: r.paidTotal.toString(),
          totalCredit: '0',
          cashIn: r.paidTotal.toString(),
          cashOut: '0',
          lineCount: 1,
          sourceModule: 'pos',
        })),
        ...wsRows.map((r): VRow => ({
          id: r.id,
          number: r.invoice.number,
          date: r.paidAt.toISOString().slice(0, 10),
          memo: `Wholesale payment — ${r.invoice.number}`,
          reference: r.reference ?? r.invoice.number,
          branchName: r.invoice.branch.name,
          totalDebit: r.amount.toString(),
          totalCredit: '0',
          cashIn: r.amount.toString(),
          cashOut: '0',
          lineCount: 1,
          sourceModule: 'wholesale',
        })),
        ...corpRows.map((r): VRow => ({
          id: r.id,
          number: r.invoice.number,
          date: r.paidAt.toISOString().slice(0, 10),
          memo: `Corporate payment — ${r.invoice.number}`,
          reference: r.reference ?? r.invoice.number,
          branchName: r.invoice.branch.name,
          totalDebit: r.amount.toString(),
          totalCredit: '0',
          cashIn: r.amount.toString(),
          cashOut: '0',
          lineCount: 1,
          sourceModule: 'corporate',
        })),
        ...jeIn,
      ].sort((a, b) => b.date.localeCompare(a.date));
    }

    // ── CASH_OUT: supplier payments + manual journal entries ──
    if (filters.type === 'CASH_OUT') {
      const [supRows, jeRows] = await Promise.all([
        prisma.supplierPayment.findMany({
          where: {
            branchId: filters.branchId,
            paymentDate: { gte: filters.from, lte: filters.to },
          },
          select: {
            id: true,
            number: true,
            amount: true,
            paymentDate: true,
            reference: true,
            supplier: { select: { name: true } },
            branch: { select: { name: true } },
          },
          orderBy: { paymentDate: 'desc' },
          take: 200,
        }),
        fetchManualJe(),
      ]);

      const jeOut: VRow[] = jeRows
        .filter((e) => {
          const net = e.lines
            .filter((l) => isCash(l.account))
            .reduce((s, l) => s.plus(l.debit).minus(l.credit), ZERO);
          return net.lessThan(0);
        })
        .map((e) => {
          const cashOut = e.lines
            .filter((l) => isCash(l.account))
            .reduce((s, l) => s.plus(l.credit), ZERO);
          return {
            id: e.id,
            number: e.number,
            date: e.date.toISOString().slice(0, 10),
            memo: e.memo ?? '',
            reference: e.reference ?? '',
            branchName: e.branch.name,
            totalDebit: e.totalDebit.toString(),
            totalCredit: e.totalCredit.toString(),
            cashIn: '0',
            cashOut: cashOut.toString(),
            lineCount: e.lines.length,
            sourceModule: '',
          };
        });

      return [
        ...supRows.map((r): VRow => ({
          id: r.id,
          number: r.number,
          date: r.paymentDate.toISOString().slice(0, 10),
          memo: `Supplier payment — ${r.supplier.name}`,
          reference: r.reference ?? '',
          branchName: r.branch.name,
          totalDebit: '0',
          totalCredit: r.amount.toString(),
          cashIn: '0',
          cashOut: r.amount.toString(),
          lineCount: 1,
          sourceModule: 'supplier',
        })),
        ...jeOut,
      ].sort((a, b) => b.date.localeCompare(a.date));
    }

    if (filters.type === 'CASH_TRANSFER') {
      const rows = await prisma.cashTransfer.findMany({
        where: {
          ...(filters.branchId
            ? { OR: [{ fromBranchId: filters.branchId }, { toBranchId: filters.branchId }] }
            : {}),
          transferDate: { gte: filters.from, lte: filters.to },
        },
        include: {
          fromBranch: { select: { name: true } },
          toBranch: { select: { name: true } },
        },
        orderBy: [{ transferDate: 'desc' }, { createdAt: 'desc' }],
        take: 200,
      });

      return rows.map((r): VRow => {
        const isReceived = filters.branchId ? r.toBranchId === filters.branchId : false;
        const isSent = filters.branchId ? r.fromBranchId === filters.branchId : false;
        return {
          id: r.id,
          number: r.number,
          date: r.transferDate.toISOString().slice(0, 10),
          memo: `Cash transfer from ${r.fromBranch.name} to ${r.toBranch.name}`,
          reference: r.reference ?? '',
          branchName: isReceived ? r.toBranch.name : r.fromBranch.name,
          totalDebit: isReceived || !filters.branchId ? r.amount.toString() : '0',
          totalCredit: isSent || !filters.branchId ? r.amount.toString() : '0',
          cashIn: isReceived || !filters.branchId ? r.amount.toString() : '0',
          cashOut: isSent || !filters.branchId ? r.amount.toString() : '0',
          lineCount: 1,
          sourceModule: 'cash-transfer',
        };
      });
    }

    // ── BULK: journal entries only ──
    const entries = await prisma.journalEntry.findMany({
      where: {
        status: 'POSTED',
        ...(filters.branchId ? { branchId: filters.branchId } : {}),
        ...(filters.from || filters.to ? { date: { gte: filters.from, lte: filters.to } } : {}),
      },
      select: {
        id: true,
        number: true,
        date: true,
        memo: true,
        reference: true,
        totalDebit: true,
        totalCredit: true,
        sourceModule: true,
        branch: { select: { name: true } },
        lines: {
          select: { debit: true, credit: true, account: { select: { type: true, code: true } } },
        },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    });

    const filtered = entries.filter((e) => {
      if (filters.type === 'BULK') return e.lines.length > 2;
      const cashLines = e.lines.filter((l) => isCash(l.account));
      const cashDebit = cashLines.reduce((s, l) => s.plus(l.debit), ZERO);
      const cashCredit = cashLines.reduce((s, l) => s.plus(l.credit), ZERO);
      return cashDebit.greaterThan(0) && cashCredit.greaterThan(0);
    });

    return filtered.map((e): VRow => {
      const cashLines = e.lines.filter((l) => isCash(l.account));
      const cashDebit = cashLines.reduce((s, l) => s.plus(l.debit), ZERO);
      const cashCredit = cashLines.reduce((s, l) => s.plus(l.credit), ZERO);
      return {
        id: e.id,
        number: e.number,
        date: e.date.toISOString().slice(0, 10),
        memo: e.memo ?? '',
        reference: e.reference ?? '',
        branchName: e.branch.name,
        totalDebit: e.totalDebit.toString(),
        totalCredit: e.totalCredit.toString(),
        cashIn: cashDebit.toString(),
        cashOut: cashCredit.toString(),
        lineCount: e.lines.length,
        sourceModule: e.sourceModule ?? '',
      };
    });
  },

  async createCashTransfer(
    session: AppSession | null,
    input: {
      fromBranchId: string;
      toBranchId: string;
      amount: string;
      transferDate: Date;
      transferVia?: string;
      reference?: string;
      remarks: string;
      imageUrl?: string;
    },
  ) {
    const actor = await authorize(session, 'accounts:post');

    if (input.fromBranchId === input.toBranchId) {
      throw new ValidationError('Source and destination branch must be different');
    }
    const amount = D(input.amount);
    if (amount.lte(0)) throw new ValidationError('Amount must be greater than zero');

    return prisma.$transaction(async (tx) => {
      const year = input.transferDate.getFullYear();
      const count = await tx.cashTransfer.count({
        where: { createdAt: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) } },
      });
      const number = nextDocumentNumber('CT', year, count, 6);

      const transfer = await tx.cashTransfer.create({
        data: {
          number,
          fromBranchId: input.fromBranchId,
          toBranchId: input.toBranchId,
          amount,
          transferDate: input.transferDate,
          transferVia: input.transferVia ?? null,
          reference: input.reference ?? null,
          remarks: input.remarks,
          imageUrl: input.imageUrl ?? null,
          status: 'PENDING',
          createdById: actor.userId,
        },
        include: {
          fromBranch: { select: { code: true, name: true } },
          toBranch: { select: { code: true, name: true } },
        },
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: input.fromBranchId,
          module: 'accounts',
          action: 'create-cash-transfer',
          entityType: 'CashTransfer',
          entityId: transfer.id,
          after: {
            number: transfer.number,
            amount: amount.toString(),
            toBranch: transfer.toBranch.code,
          },
        },
        tx,
      );

      return transfer;
    });
  },

  async listCashTransfers(
    session: AppSession | null,
    filters: {
      branchId: string;
      direction: 'SENT' | 'RECEIVED';
      from?: Date;
      to?: Date;
    },
  ) {
    await authorize(session, 'accounts:read');

    const where =
      filters.direction === 'SENT'
        ? {
            fromBranchId: filters.branchId,
            transferDate: { gte: filters.from, lte: filters.to },
          }
        : {
            toBranchId: filters.branchId,
            transferDate: { gte: filters.from, lte: filters.to },
          };

    const rows = await prisma.cashTransfer.findMany({
      where,
      include: {
        fromBranch: { select: { code: true, name: true } },
        toBranch: { select: { code: true, name: true } },
      },
      orderBy: { transferDate: 'desc' },
      take: 200,
    });

    return rows.map((r) => ({
      id: r.id,
      number: r.number,
      transferDate: r.transferDate.toISOString(),
      fromBranch: r.fromBranch.name,
      toBranch: r.toBranch.name,
      amount: r.amount.toString(),
      transferVia: r.transferVia ?? '',
      reference: r.reference ?? '',
      remarks: r.remarks,
      imageUrl: r.imageUrl ?? '',
      status: r.status,
    }));
  },

  // ── Cash Entries (manual cash in / cash out) ──────────────────────────────

  async createCashEntry(
    session: AppSession | null,
    input: {
      type: 'CASH_IN' | 'CASH_OUT';
      branchId: string;
      date: Date;
      amount: string;
      taxPercent?: string;
      contactId?: string;
      contactName?: string;
      contactType?: string;
      receiveMode: string;
      category: string;
      reference?: string;
      projectName?: string;
      remarks?: string;
      imageUrl?: string;
    },
  ) {
    const actor = await authorize(session, 'accounts:post');

    const amount = D(input.amount);
    if (amount.lte(0)) throw new ValidationError('Amount must be greater than zero');

    const taxPercent = input.taxPercent ? D(input.taxPercent) : null;
    const taxAmount = taxPercent ? amount.times(taxPercent).div(100) : null;
    const totalAmount = taxAmount ? amount.plus(taxAmount) : amount;

    return prisma.$transaction(async (tx) => {
      const year = input.date.getFullYear();
      const count = await tx.cashEntry.count({
        where: { createdAt: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) } },
      });
      const number = nextDocumentNumber('TR', year, count, 4);

      const entry = await tx.cashEntry.create({
        data: {
          number,
          type: input.type,
          branchId: input.branchId,
          date: input.date,
          amount,
          taxPercent: taxPercent ?? null,
          taxAmount: taxAmount ?? null,
          totalAmount,
          contactId: input.contactId ?? null,
          contactName: input.contactName ?? null,
          contactType: input.contactType ?? null,
          receiveMode: input.receiveMode,
          category: input.category,
          reference: input.reference ?? null,
          projectName: input.projectName ?? null,
          remarks: input.remarks ?? null,
          imageUrl: input.imageUrl ?? null,
          createdById: actor.userId,
        },
        include: {
          branch: { select: { name: true, currency: true } },
          contact: { select: { name: true, type: true } },
        },
      });

      await recordAudit(
        {
          actorId: actor.userId,
          branchId: input.branchId,
          module: 'accounts',
          action: `create-cash-${input.type === 'CASH_IN' ? 'in' : 'out'}`,
          entityType: 'CashEntry',
          entityId: entry.id,
          after: { number: entry.number, amount: amount.toString(), type: entry.type },
        },
        tx,
      );

      return entry;
    });
  },

  async listCashEntries(
    session: AppSession | null,
    filters: {
      type: 'CASH_IN' | 'CASH_OUT';
      branchId?: string;
      from?: Date;
      to?: Date;
      take?: number;
    },
  ) {
    await authorize(session, 'accounts:read');
    return prisma.cashEntry.findMany({
      where: {
        type: filters.type,
        branchId: filters.branchId,
        date: { gte: filters.from, lte: filters.to },
      },
      include: {
        branch: { select: { name: true, currency: true } },
        contact: { select: { name: true, type: true } },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: filters.take ?? 50,
    });
  },

  async cashEntrySummary(
    session: AppSession | null,
    filters: {
      type: 'CASH_IN' | 'CASH_OUT';
      branchId?: string;
      from?: Date;
      to?: Date;
    },
  ) {
    await authorize(session, 'accounts:read');

    const [
      inRange,
      posInRange,
      wholesaleInRange,
      corporateInRange,
      supplierOutRange,
      cashInRange,
      cashOutRange,
      sentTransferInRange,
      receivedTransferInRange,
      posBeforeRange,
      wholesaleBeforeRange,
      corporateBeforeRange,
      supplierBeforeRange,
      cashInBeforeRange,
      cashOutBeforeRange,
      sentTransferBeforeRange,
      receivedTransferBeforeRange,
    ] = await Promise.all([
      prisma.cashEntry.aggregate({
        where: {
          type: filters.type,
          branchId: filters.branchId,
          date: { gte: filters.from, lte: filters.to },
        },
        _sum: { totalAmount: true },
        _count: true,
      }),
      prisma.posSale.aggregate({
        where: {
          branchId: filters.branchId,
          saleDate: { gte: filters.from, lte: filters.to },
          status: { not: 'VOIDED' },
        },
        _sum: { paidTotal: true },
      }),
      prisma.wholesalePayment.aggregate({
        where: {
          paidAt: { gte: filters.from, lte: filters.to },
          invoice: { branchId: filters.branchId },
        },
        _sum: { amount: true },
      }),
      prisma.corporateInvoicePayment.aggregate({
        where: {
          paidAt: { gte: filters.from, lte: filters.to },
          invoice: { branchId: filters.branchId },
        },
        _sum: { amount: true },
      }),
      prisma.supplierPayment.aggregate({
        where: {
          branchId: filters.branchId,
          paymentDate: { gte: filters.from, lte: filters.to },
        },
        _sum: { amount: true },
      }),
      prisma.cashEntry.aggregate({
        where: {
          type: 'CASH_IN',
          branchId: filters.branchId,
          date: { gte: filters.from, lte: filters.to },
        },
        _sum: { totalAmount: true },
      }),
      prisma.cashEntry.aggregate({
        where: {
          type: 'CASH_OUT',
          branchId: filters.branchId,
          date: { gte: filters.from, lte: filters.to },
        },
        _sum: { totalAmount: true },
      }),
      filters.branchId
        ? prisma.cashTransfer.aggregate({
            where: {
              fromBranchId: filters.branchId,
              transferDate: { gte: filters.from, lte: filters.to },
            },
            _sum: { amount: true },
          })
        : Promise.resolve({ _sum: { amount: ZERO } }),
      filters.branchId
        ? prisma.cashTransfer.aggregate({
            where: {
              toBranchId: filters.branchId,
              transferDate: { gte: filters.from, lte: filters.to },
            },
            _sum: { amount: true },
          })
        : Promise.resolve({ _sum: { amount: ZERO } }),
      prisma.posSale.aggregate({
        where: {
          branchId: filters.branchId,
          saleDate: { lt: filters.from },
          status: { not: 'VOIDED' },
        },
        _sum: { paidTotal: true },
      }),
      prisma.wholesalePayment.aggregate({
        where: {
          paidAt: { lt: filters.from },
          invoice: { branchId: filters.branchId },
        },
        _sum: { amount: true },
      }),
      prisma.corporateInvoicePayment.aggregate({
        where: {
          paidAt: { lt: filters.from },
          invoice: { branchId: filters.branchId },
        },
        _sum: { amount: true },
      }),
      prisma.supplierPayment.aggregate({
        where: {
          branchId: filters.branchId,
          paymentDate: { lt: filters.from },
        },
        _sum: { amount: true },
      }),
      prisma.cashEntry.aggregate({
        where: {
          type: 'CASH_IN',
          branchId: filters.branchId,
          date: { lt: filters.from },
        },
        _sum: { totalAmount: true },
      }),
      prisma.cashEntry.aggregate({
        where: {
          type: 'CASH_OUT',
          branchId: filters.branchId,
          date: { lt: filters.from },
        },
        _sum: { totalAmount: true },
      }),
      filters.branchId
        ? prisma.cashTransfer.aggregate({
            where: { fromBranchId: filters.branchId, transferDate: { lt: filters.from } },
            _sum: { amount: true },
          })
        : Promise.resolve({ _sum: { amount: ZERO } }),
      filters.branchId
        ? prisma.cashTransfer.aggregate({
            where: { toBranchId: filters.branchId, transferDate: { lt: filters.from } },
            _sum: { amount: true },
          })
        : Promise.resolve({ _sum: { amount: ZERO } }),
    ]);

    const [openingEntriesBeforeRange] = await Promise.all([
      prisma.openingBalanceEntry.findMany({
        where: {
          branchId: filters.branchId,
          date: { lte: filters.from },
        },
        select: { normalSide: true, amount: true },
      }),
    ]);

    const openingEntryNet = openingEntriesBeforeRange.reduce(
      (sum, row) => sum.plus(row.normalSide === 'DEBIT' ? row.amount : row.amount.negated()),
      ZERO,
    );

    const openingBalance = (posBeforeRange._sum.paidTotal ?? ZERO)
      .plus(wholesaleBeforeRange._sum.amount ?? ZERO)
      .plus(corporateBeforeRange._sum.amount ?? ZERO)
      .plus(cashInBeforeRange._sum.totalAmount ?? ZERO)
      .plus(receivedTransferBeforeRange._sum.amount ?? ZERO)
      .plus(openingEntryNet)
      .minus(supplierBeforeRange._sum.amount ?? ZERO)
      .minus(cashOutBeforeRange._sum.totalAmount ?? ZERO)
      .minus(sentTransferBeforeRange._sum.amount ?? ZERO);
    const totalIn = (posInRange._sum.paidTotal ?? ZERO)
      .plus(wholesaleInRange._sum.amount ?? ZERO)
      .plus(corporateInRange._sum.amount ?? ZERO)
      .plus(cashInRange._sum.totalAmount ?? ZERO)
      .plus(receivedTransferInRange._sum.amount ?? ZERO);
    const totalOut = (supplierOutRange._sum.amount ?? ZERO)
      .plus(cashOutRange._sum.totalAmount ?? ZERO)
      .plus(sentTransferInRange._sum.amount ?? ZERO);
    const netBalance = openingBalance.plus(totalIn).minus(totalOut);

    return { openingBalance, totalIn, totalOut, netBalance, count: inRange._count };
  },

  async listContactsForBranch(session: AppSession | null, branchId: string) {
    await authorize(session, 'accounts:read');
    return prisma.customer.findMany({
      where: { branchId, status: 'ACTIVE' },
      select: { id: true, name: true, type: true, code: true },
      orderBy: { name: 'asc' },
      take: 300,
    });
  },

  async nextCashEntryNumber(session: AppSession | null) {
    await authorize(session, 'accounts:read');
    const year = new Date().getFullYear();
    const count = await prisma.cashEntry.count({
      where: { createdAt: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) } },
    });
    return nextDocumentNumber('TR', year, count, 4);
  },
};
