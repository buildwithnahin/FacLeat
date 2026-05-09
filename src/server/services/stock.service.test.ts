import { describe, expect, it, beforeEach, vi } from 'vitest';
import { Prisma } from '@prisma/client';

const mocks = vi.hoisted(() => {
  const tx = {
    period: { findFirst: vi.fn() },
    product: { findUnique: vi.fn() },
    inventoryLedger: { create: vi.fn() },
    auditLog: { create: vi.fn() },
    $queryRawUnsafe: vi.fn(),
  };
  return {
    tx,
    prisma: {
      warehouse: { findUnique: vi.fn() },
      product: { findMany: vi.fn() },
      $queryRawUnsafe: vi.fn(),
      $transaction: vi.fn((fn: (txArg: typeof tx) => unknown) => fn(tx)),
    },
    authorize: vi.fn(),
    recordAudit: vi.fn(),
  };
});

vi.mock('@/server/db', () => ({ prisma: mocks.prisma }));
vi.mock('@/server/auth/authorize', () => ({ authorize: mocks.authorize }));
vi.mock('@/server/audit/logger', () => ({ recordAudit: mocks.recordAudit }));
vi.mock('@/server/notifications/publisher', () => ({ publishToPermission: vi.fn() }));

import { stockService } from './stock.service';

const session = {
  userId: 'user_1',
  email: 'admin@example.com',
  name: 'Admin',
  roles: ['WarehouseOp'],
  permissions: ['warehouse:receive', 'warehouse:issue'],
  activeBranchId: 'branch_1',
};

describe('stockService stock mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorize.mockResolvedValue({ userId: 'user_1', permissions: session.permissions });
    mocks.prisma.warehouse.findUnique.mockResolvedValue({
      id: 'warehouse_1',
      branchId: 'branch_1',
      branch: { allowNegativeStock: false },
    });
    mocks.tx.period.findFirst.mockResolvedValue({
      id: 'period_1',
      name: 'May 2026',
      status: 'OPEN',
    });
    mocks.tx.product.findUnique.mockResolvedValue({ sku: 'SKU-001' });
    mocks.tx.inventoryLedger.create.mockResolvedValue({ id: 'ledger_1' });
    mocks.tx.$queryRawUnsafe.mockResolvedValue([
      {
        productId: 'product_1',
        warehouseId: 'warehouse_1',
        balance: new Prisma.Decimal(5),
      },
    ]);
    mocks.prisma.$queryRawUnsafe.mockResolvedValue([
      {
        productId: 'product_1',
        warehouseId: 'warehouse_1',
        balance: new Prisma.Decimal(2),
      },
    ]);
    mocks.prisma.product.findMany.mockResolvedValue([]);
  });

  it('blocks receipts when the branch period is locked', async () => {
    mocks.tx.period.findFirst.mockResolvedValue({
      id: 'period_1',
      name: 'May 2026',
      status: 'LOCKED',
    });

    await expect(
      stockService.postReceipt(session, {
        branchId: 'branch_1',
        warehouseId: 'warehouse_1',
        refType: 'MANUAL_ADJUST',
        items: [{ productId: 'product_1', quantity: '2', costPerUnit: '10' }],
      }),
    ).rejects.toThrow('Period "May 2026" is LOCKED');

    expect(mocks.tx.inventoryLedger.create).not.toHaveBeenCalled();
  });

  it('rejects issues that would make stock negative', async () => {
    await expect(
      stockService.postIssue(session, {
        branchId: 'branch_1',
        warehouseId: 'warehouse_1',
        refType: 'MANUAL_ADJUST',
        items: [{ productId: 'product_1', quantity: '6', costPerUnit: '0' }],
      }),
    ).rejects.toThrow('Insufficient stock for SKU-001');

    expect(mocks.tx.inventoryLedger.create).not.toHaveBeenCalled();
  });

  it('posts issue rows when stock and fiscal period are valid', async () => {
    const result = await stockService.postIssue(session, {
      branchId: 'branch_1',
      warehouseId: 'warehouse_1',
      refType: 'MANUAL_ADJUST',
      items: [{ productId: 'product_1', quantity: '3', costPerUnit: '0' }],
    });

    expect(result.count).toBe(1);
    expect(mocks.tx.inventoryLedger.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          direction: 'OUT',
          productId: 'product_1',
          quantity: expect.any(Prisma.Decimal),
        }),
      }),
    );
  });
});
