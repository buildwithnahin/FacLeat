import { describe, expect, it, beforeEach, vi } from 'vitest';
import { Prisma } from '@prisma/client';

const mocks = vi.hoisted(() => {
  const tx = {
    period: { findFirst: vi.fn(), findUnique: vi.fn() },
    chartAccount: { findMany: vi.fn() },
    journalEntry: { count: vi.fn(), create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  };
  return {
    tx,
    prisma: { $transaction: vi.fn((fn: (txArg: typeof tx) => unknown) => fn(tx)) },
    authorize: vi.fn(),
    recordAudit: vi.fn(),
  };
});

vi.mock('@/server/db', () => ({ prisma: mocks.prisma }));
vi.mock('@/server/auth/authorize', () => ({ authorize: mocks.authorize }));
vi.mock('@/server/audit/logger', () => ({ recordAudit: mocks.recordAudit }));

import { accountsService } from './accounts.service';

const session = {
  userId: 'user_1',
  email: 'admin@example.com',
  name: 'Admin',
  roles: ['Admin'],
  permissions: ['accounts:post'],
  activeBranchId: 'branch_1',
};

const balancedInput = {
  branchId: 'branch_1',
  date: new Date('2026-05-01T00:00:00.000Z'),
  memo: 'Unit test journal',
  reference: '',
  post: true,
  lines: [
    {
      accountId: 'cash',
      debit: 100,
      credit: 0,
      currency: 'BDT' as const,
      fxRate: 1,
      memo: '',
      costCenter: '',
    },
    {
      accountId: 'sales',
      debit: 0,
      credit: 100,
      currency: 'BDT' as const,
      fxRate: 1,
      memo: '',
      costCenter: '',
    },
  ],
};

describe('accountsService.postJournal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorize.mockResolvedValue({ userId: 'user_1', permissions: ['accounts:post'] });
    mocks.tx.period.findFirst.mockResolvedValue({
      id: 'period_1',
      name: 'May 2026',
      status: 'OPEN',
    });
    mocks.tx.chartAccount.findMany.mockResolvedValue([
      { id: 'cash', code: '1110', isActive: true, isPosting: true },
      { id: 'sales', code: '4110', isActive: true, isPosting: true },
    ]);
    mocks.tx.journalEntry.count.mockResolvedValue(0);
    mocks.tx.journalEntry.create.mockResolvedValue({
      id: 'journal_1',
      number: 'JE-2026-0001',
      totalDebit: new Prisma.Decimal(100),
      status: 'POSTED',
    });
  });

  it('rejects unbalanced journal lines before writing', async () => {
    await expect(
      accountsService.postJournal(session, {
        ...balancedInput,
        lines: [
          balancedInput.lines[0],
          { ...balancedInput.lines[1], credit: 90 },
        ],
      }),
    ).rejects.toThrow('Debit total must equal credit total');

    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    expect(mocks.tx.journalEntry.create).not.toHaveBeenCalled();
  });

  it('rejects posting into a locked period', async () => {
    mocks.tx.period.findFirst.mockResolvedValue({
      id: 'period_1',
      name: 'May 2026',
      status: 'LOCKED',
    });

    await expect(accountsService.postJournal(session, balancedInput)).rejects.toThrow(
      'Period "May 2026" is LOCKED',
    );

    expect(mocks.tx.journalEntry.create).not.toHaveBeenCalled();
  });

  it('creates a posted journal when debit equals credit and period is open', async () => {
    const created = await accountsService.postJournal(session, balancedInput);

    expect(created.id).toBe('journal_1');
    expect(mocks.tx.journalEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'POSTED',
          totalDebit: expect.any(Prisma.Decimal),
          totalCredit: expect.any(Prisma.Decimal),
        }),
      }),
    );
    expect(mocks.recordAudit).toHaveBeenCalled();
  });
});
