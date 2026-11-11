/**
 * Comprehensive additional QA demo-data seed.
 *
 * Builds on top of `prisma/seed.ts` (foundation: company, branches, users,
 * roles/permissions, products, suppliers, customers, employees, chart of
 * accounts, approval rules, holidays — all already present). This script
 * does NOT modify or re-run seed.ts, and does NOT assume seed-demo.ts has
 * run. It only reads foundation rows by their known codes/emails/skus and
 * adds fresh transactional data across every module so the app has
 * realistic, interconnected data everywhere for QA.
 *
 * Safe to re-run: every human-readable document number below carries a
 * distinctive "FDS" (full-demo-seed) marker, and the very first thing this
 * script does is bail out early if that marker is already present, so
 * running it twice against the same database is a no-op rather than a
 * pile of duplicate-key errors.
 *
 * Run:
 *   tsx prisma/seed-full-demo.ts
 */
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();
const D = (n: number | string | Prisma.Decimal) => new Prisma.Decimal(n);
const ZERO = new Prisma.Decimal(0);

// ── generic helpers ──────────────────────────────────────────────────────
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function dateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randDaysAgo(maxDays = 120, minDays = 1): number {
  return randInt(minDays, maxDays);
}
function pick<T>(arr: readonly T[]): T {
  return arr[randInt(0, arr.length - 1)] as T;
}
function pickN<T>(arr: readonly T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && copy.length > 0; i++) {
    const idx = randInt(0, copy.length - 1);
    out.push(copy.splice(idx, 1)[0] as T);
  }
  return out;
}
function pad(n: number, len = 4): string {
  return String(n).padStart(len, '0');
}
const seqCounters = new Map<string, number>();
function nextNo(prefix: string, len = 4): string {
  const n = (seqCounters.get(prefix) ?? 0) + 1;
  seqCounters.set(prefix, n);
  return `${prefix}-FDS-${pad(n, len)}`;
}

/** Wraps a section so one module's bug doesn't stop the whole run. */
async function run(name: string, fn: () => Promise<void>) {
  const start = Date.now();
  try {
    await fn();
    console.log(`  ✓ ${name} (${((Date.now() - start) / 1000).toFixed(1)}s)`);
  } catch (err) {
    console.error(`  ✗ ${name} FAILED:`, err instanceof Error ? err.stack ?? err.message : err);
  }
}

async function main() {
  console.log('🌱 Seeding full demo data…');

  // Idempotency guard — if this script already ran, bail out.
  const marker = await prisma.purchaseRequisition.findUnique({ where: { number: 'PR-FDS-0001' } });
  if (marker) {
    console.log('  Already seeded (PR-FDS-0001 exists) — nothing to do.');
    return;
  }

  // ── Load foundation reference data ───────────────────────────────────
  const company = await prisma.company.findFirstOrThrow();
  const branches = await prisma.branch.findMany();
  const HQ = branches.find((b) => b.code === 'HQ')!;
  const DHAKA = branches.find((b) => b.code === 'DHAKA')!;
  const CTG = branches.find((b) => b.code === 'CTG')!;
  const FACTORY = branches.find((b) => b.code === 'FACTORY')!;
  const INDIA = branches.find((b) => b.code === 'INDIA')!;

  const warehouses = await prisma.warehouse.findMany();
  const wh = (branchId: string, code: string) => {
    const w = warehouses.find((x) => x.branchId === branchId && x.code === code);
    if (!w) throw new Error(`warehouse ${branchId}/${code} not found`);
    return w;
  };
  const hqMain = wh(HQ.id, 'MAIN');
  const hqStore = wh(HQ.id, 'STORE');
  const hqQrt = wh(HQ.id, 'QRT');
  const hqDmg = wh(HQ.id, 'DMG');
  const hqWip = wh(HQ.id, 'WIP');
  const dhakaMain = wh(DHAKA.id, 'MAIN');
  const ctgMain = wh(CTG.id, 'MAIN');
  const factoryMain = wh(FACTORY.id, 'MAIN');
  const factoryWip = wh(FACTORY.id, 'WIP');
  const indiaMain = wh(INDIA.id, 'MAIN');

  const users = await prisma.user.findMany();
  const byEmail = (email: string) => {
    const u = users.find((x) => x.email === email);
    if (!u) throw new Error(`user ${email} not found`);
    return u;
  };
  const admin = byEmail('admin@annex.local'); // Super Admin
  const branchAdmin = byEmail('branchadmin@annex.local'); // Admin
  const accountant = byEmail('accountant@annex.local'); // Accounts
  const purchaseUser = byEmail('purchase@annex.local'); // Purchase
  const storeUser = byEmail('warehouse@annex.local'); // Store
  const cashier = byEmail('cashier@annex.local'); // Sales
  const salesUser = byEmail('sales@annex.local'); // Commercial
  const factoryUser = byEmail('factory@annex.local'); // Production
  const hrUser = byEmail('hr@annex.local'); // HR
  const allUsers = [admin, branchAdmin, accountant, purchaseUser, storeUser, cashier, salesUser, factoryUser, hrUser];

  const products = await prisma.product.findMany();
  const prod = (sku: string) => {
    const p = products.find((x) => x.sku === sku);
    if (!p) throw new Error(`product ${sku} not found`);
    return p;
  };
  const rawMaterials = products.filter((p) => p.type === 'RAW_MATERIAL');
  const finishedGoods = products.filter((p) => p.type === 'FINISHED_GOOD');
  const consumables = products.filter((p) => p.type === 'CONSUMABLE');
  const sellables = [...finishedGoods, ...consumables];

  const suppliers = await prisma.supplier.findMany();
  const customers = await prisma.customer.findMany();
  const wholesaleCustomers = customers.filter((c) => c.type === 'WHOLESALE');
  const retailCustomers = customers.filter((c) => c.type === 'RETAIL');
  const corporateCustomers = customers.filter((c) => c.type === 'CORPORATE');
  const exportCustomers = customers.filter((c) => c.type === 'EXPORT');

  const employees = await prisma.employee.findMany();

  const chartAccounts = await prisma.chartAccount.findMany();
  const acc = (code: string) => {
    const a = chartAccounts.find((x) => x.code === code);
    if (!a) throw new Error(`chart account ${code} not found`);
    return a;
  };

  const periods = await prisma.period.findMany({ where: { status: 'OPEN' } });
  const openPeriod = (branchId: string) => {
    const p = periods.find((x) => x.branchId === branchId);
    if (!p) throw new Error(`open period for branch ${branchId} not found`);
    return p;
  };

  const approvalRules = await prisma.approvalRule.findMany({
    include: { approvers: { orderBy: { sequence: 'asc' } } },
  });

  // Shared store of things created in one section that later sections link to.
  const store: {
    purchaseOrders: Array<{ id: string; number: string; branchId: string; grandTotal: Prisma.Decimal }>;
    grns: Array<{ id: string; number: string }>;
    purchaseInvoices: Array<{ id: string; number: string; grandTotal: Prisma.Decimal }>;
    assets: Array<{ id: string; code: string }>;
    productionOrders: Array<{ id: string; number: string }>;
    corporateOrders: Array<{ id: string; number: string }>;
    tradeOrders: Array<{ id: string; number: string }>;
    payrollRuns: Array<{ id: string; period: string }>;
    posSales: Array<{ id: string; number: string }>;
    wholesaleInvoices: Array<{ id: string; number: string }>;
  } = {
    purchaseOrders: [],
    grns: [],
    purchaseInvoices: [],
    assets: [],
    productionOrders: [],
    corporateOrders: [],
    tradeOrders: [],
    payrollRuns: [],
    posSales: [],
    wholesaleInvoices: [],
  };

  const PO_STATUSES_RECEIVABLE = ['PARTIALLY_RECEIVED', 'COMPLETED'] as const;

  // ════════════════════════════════════════════════════════════════════
  // 1. PURCHASE: PR → PO → GRN → Invoice → Payment
  // ════════════════════════════════════════════════════════════════════
  await run('Purchase requisitions', async () => {
    const PR_STATUSES = ['DRAFT', 'DRAFT', 'PENDING', 'PENDING', 'APPROVED', 'APPROVED', 'APPROVED', 'APPROVED',
      'APPROVED', 'APPROVED', 'APPROVED', 'APPROVED', 'APPROVED', 'REJECTED', 'REJECTED', 'CANCELLED', 'CLOSED', 'CLOSED'] as const;
    const approvedPRs: string[] = [];
    for (let i = 0; i < 18; i++) {
      const status = PR_STATUSES[i]!;
      const items = pickN([...rawMaterials, ...consumables], randInt(1, 3));
      const pr = await prisma.purchaseRequisition.create({
        data: {
          branchId: pick([HQ, FACTORY]).id,
          number: nextNo('PR'),
          department: pick(['Purchase', 'Production', 'Store', 'Admin']),
          requestedBy: pick(['Karim Hassan', 'Jahid Hasan', 'Ali Miah', 'Farida Islam']),
          priority: pick(['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const),
          status,
          requiredDate: addDays(new Date(), randInt(5, 30)),
          notes: 'Bulk-seeded demo requisition',
          createdById: purchaseUser.id,
          approvedById: status === 'APPROVED' || status === 'CLOSED' ? branchAdmin.id : null,
          approvedAt: status === 'APPROVED' || status === 'CLOSED' ? daysAgo(randDaysAgo(90, 20)) : null,
          rejectedReason: status === 'REJECTED' ? 'Budget not available this quarter' : null,
          items: {
            create: items.map((p) => ({
              productId: p.id,
              productName: p.name,
              unit: p.unit,
              quantity: D(randInt(10, 200)),
              estimatedPrice: p.costPrice,
              note: null,
            })),
          },
        },
      });
      if (status === 'APPROVED') approvedPRs.push(pr.id);
    }
    console.log(`    18 PRs created, ${approvedPRs.length} approved`);
  });

  await run('Purchase orders + GRNs + invoices + payments', async () => {
    const approvedPRs = await prisma.purchaseRequisition.findMany({
      where: { number: { startsWith: 'PR-FDS-' }, status: 'APPROVED' },
    });
    const POStatuses = ['DRAFT', 'DRAFT', 'PENDING', 'PENDING', 'APPROVED', 'APPROVED', 'APPROVED', 'APPROVED',
      'PARTIALLY_RECEIVED', 'PARTIALLY_RECEIVED', 'PARTIALLY_RECEIVED', 'PARTIALLY_RECEIVED', 'PARTIALLY_RECEIVED', 'PARTIALLY_RECEIVED',
      'COMPLETED', 'COMPLETED', 'COMPLETED', 'CANCELLED'] as const;

    for (let i = 0; i < 18; i++) {
      const status = POStatuses[i]!;
      const supplier = pick(suppliers);
      const requisition = i < approvedPRs.length ? approvedPRs[i] : undefined;
      const items = pickN([...rawMaterials, ...consumables], randInt(1, 3));
      let subtotal = ZERO;
      const itemRows = items.map((p) => {
        const qty = D(randInt(10, 150));
        const price = p.costPrice;
        const lineTotal = qty.mul(price);
        subtotal = subtotal.plus(lineTotal);
        return {
          productId: p.id,
          accountCategory: 'INVENTORY' as const,
          unit: p.unit,
          orderedQty: qty,
          receivedQty: ZERO,
          unitPrice: price,
          taxRate: D(0),
          discountRate: D(0),
          lineTotal,
        };
      });
      const grandTotal = subtotal;
      const branchId = supplier.branchId === HQ.id ? pick([HQ, FACTORY]).id : HQ.id;
      const po = await prisma.purchaseOrder.create({
        data: {
          branchId,
          number: nextNo('PO'),
          supplierId: supplier.id,
          requisitionId: requisition?.id ?? null,
          department: 'Purchase',
          status,
          orderDate: daysAgo(randDaysAgo(100, 30)),
          deliveryDate: addDays(new Date(), randInt(-10, 20)),
          currency: 'BDT',
          subtotal,
          taxTotal: ZERO,
          discountTotal: ZERO,
          grandTotal,
          notes: 'Bulk-seeded demo purchase order',
          createdById: purchaseUser.id,
          approvedById: status === 'DRAFT' || status === 'PENDING' ? null : branchAdmin.id,
          approvedAt: status === 'DRAFT' || status === 'PENDING' ? null : daysAgo(randDaysAgo(80, 15)),
          cancelledAt: status === 'CANCELLED' ? daysAgo(randDaysAgo(50, 5)) : null,
          items: { create: itemRows },
        },
        include: { items: true },
      });
      store.purchaseOrders.push({ id: po.id, number: po.number, branchId: po.branchId, grandTotal: po.grandTotal });

      if (!PO_STATUSES_RECEIVABLE.includes(status as (typeof PO_STATUSES_RECEIVABLE)[number])) continue;

      // GRN — partial for PARTIALLY_RECEIVED, full for COMPLETED
      const fraction = status === 'COMPLETED' ? 1 : 0.6;
      const receivedById = storeUser.id;
      const grnWarehouse = branchId === FACTORY.id ? factoryMain : hqMain;
      const grn = await prisma.goodsReceiving.create({
        data: {
          branchId,
          number: nextNo('GRN'),
          purchaseOrderId: po.id,
          supplierId: supplier.id,
          warehouseId: grnWarehouse.id,
          status: 'COMPLETED',
          receivedDate: daysAgo(randDaysAgo(60, 5)),
          receivedById,
          notes: 'Bulk-seeded demo GRN',
          items: {
            create: po.items.map((it) => ({
              purchaseOrderItemId: it.id,
              productId: it.productId,
              receivedQty: it.orderedQty.mul(fraction),
              rejectedQty: ZERO,
              unitCost: it.unitPrice,
            })),
          },
        },
        include: { items: true },
      });
      store.grns.push({ id: grn.id, number: grn.number });

      for (const item of po.items) {
        const receivedQty = item.orderedQty.mul(fraction);
        await prisma.purchaseOrderItem.update({
          where: { id: item.id },
          data: { receivedQty },
        });
        await prisma.inventoryLedger.create({
          data: {
            branchId,
            warehouseId: grnWarehouse.id,
            productId: item.productId,
            direction: 'IN',
            quantity: receivedQty,
            costPerUnit: item.unitPrice,
            refType: 'GRN',
            refId: grn.id,
            note: `GRN ${grn.number}`,
            createdById: storeUser.id,
          },
        });
      }

      // Invoice
      const invStatuses = ['DRAFT', 'PENDING', 'APPROVED', 'POSTED', 'PARTIALLY_PAID', 'PARTIALLY_PAID', 'PAID', 'PAID', 'PAID'] as const;
      const invStatus = pick(invStatuses);
      const invSubtotal = grandTotal.mul(fraction);
      let paid = ZERO;
      if (invStatus === 'PAID') paid = invSubtotal;
      else if (invStatus === 'PARTIALLY_PAID') paid = invSubtotal.mul(0.4);
      const invoice = await prisma.purchaseInvoice.create({
        data: {
          branchId,
          number: nextNo('SUPI'),
          supplierId: supplier.id,
          purchaseOrderId: po.id,
          grnId: grn.id,
          status: invStatus,
          matching: 'MATCHED',
          invoiceDate: daysAgo(randDaysAgo(55, 3)),
          dueDate: addDays(new Date(), randInt(-10, 30)),
          currency: 'BDT',
          subtotal: invSubtotal,
          taxTotal: ZERO,
          discountTotal: ZERO,
          grandTotal: invSubtotal,
          paidAmount: paid,
          notes: 'Bulk-seeded demo invoice',
          createdById: accountant.id,
          items: {
            create: po.items.map((it) => ({
              productId: it.productId,
              unit: it.unit,
              quantity: it.orderedQty.mul(fraction),
              unitPrice: it.unitPrice,
              taxRate: D(0),
              lineTotal: it.orderedQty.mul(fraction).mul(it.unitPrice),
            })),
          },
        },
      });
      store.purchaseInvoices.push({ id: invoice.id, number: invoice.number, grandTotal: invoice.grandTotal });

      await prisma.supplierLedger.create({
        data: {
          branchId,
          supplierId: supplier.id,
          entryType: 'PURCHASE',
          refType: 'PurchaseInvoice',
          refId: invoice.id,
          description: `Invoice ${invoice.number} against ${po.number}`,
          debit: invSubtotal,
          credit: ZERO,
          entryDate: invoice.invoiceDate,
          createdById: accountant.id,
        },
      });

      if (paid.gt(0)) {
        const payment = await prisma.supplierPayment.create({
          data: {
            branchId,
            number: nextNo('SPAY'),
            supplierId: supplier.id,
            invoiceId: invoice.id,
            method: pick(['CASH', 'BANK_TRANSFER', 'CHEQUE', 'MOBILE_BANKING'] as const),
            paymentDate: addDays(invoice.invoiceDate, randInt(2, 20)),
            amount: paid,
            currency: 'BDT',
            reference: `REF-${randInt(10000, 99999)}`,
            notes: 'Bulk-seeded demo payment',
            createdById: accountant.id,
          },
        });
        await prisma.supplierLedger.create({
          data: {
            branchId,
            supplierId: supplier.id,
            entryType: 'PAYMENT',
            refType: 'SupplierPayment',
            refId: payment.id,
            description: `Payment ${payment.number} for ${invoice.number}`,
            debit: ZERO,
            credit: paid,
            entryDate: payment.paymentDate,
            createdById: accountant.id,
          },
        });
      }
    }

    // A handful of on-account payments not tied to a specific invoice
    for (let i = 0; i < 4; i++) {
      const supplier = pick(suppliers);
      const amount = D(randInt(5000, 40000));
      const payment = await prisma.supplierPayment.create({
        data: {
          branchId: supplier.branchId,
          number: nextNo('SPAY'),
          supplierId: supplier.id,
          method: pick(['CASH', 'BANK_TRANSFER'] as const),
          paymentDate: daysAgo(randDaysAgo(60, 2)),
          amount,
          currency: 'BDT',
          reference: `ONACC-${randInt(1000, 9999)}`,
          notes: 'On-account advance payment',
          createdById: accountant.id,
        },
      });
      await prisma.supplierLedger.create({
        data: {
          branchId: supplier.branchId,
          supplierId: supplier.id,
          entryType: 'PAYMENT',
          refType: 'SupplierPayment',
          refId: payment.id,
          description: `On-account payment ${payment.number}`,
          debit: ZERO,
          credit: amount,
          entryDate: payment.paymentDate,
          createdById: accountant.id,
        },
      });
    }

    // Debit notes (supplier returns / claims) against a few GRNs
    const grnSample = store.grns.slice(0, 5);
    for (const g of grnSample) {
      const grn = await prisma.goodsReceiving.findUniqueOrThrow({
        where: { id: g.id },
        include: { items: true, supplier: true },
      });
      const items = grn.items.slice(0, randInt(1, 2));
      let total = ZERO;
      const itemRows = items.map((it) => {
        const qty = it.receivedQty.mul(0.1);
        const lineTotal = qty.mul(it.unitCost);
        total = total.plus(lineTotal);
        return {
          productId: it.productId,
          returnedQty: qty,
          unitPrice: it.unitCost,
          total: lineTotal,
          reason: 'Quality reject on inspection',
          condition: 'DAMAGED',
        };
      });
      const dn = await prisma.debitNote.create({
        data: {
          branchId: grn.branchId,
          number: nextNo('DN'),
          supplierId: grn.supplierId,
          grnId: grn.id,
          returnDate: daysAgo(randDaysAgo(40, 5)),
          status: pick(['DRAFT', 'SUBMITTED', 'APPROVED', 'POSTED'] as const),
          totalAmount: total,
          vatAdjustment: ZERO,
          reason: 'Damaged goods identified during quality inspection',
          createdById: storeUser.id,
          items: { create: itemRows },
        },
      });
      await prisma.supplierLedger.create({
        data: {
          branchId: grn.branchId,
          supplierId: grn.supplierId,
          entryType: 'ADJUSTMENT',
          refType: 'DebitNote',
          refId: dn.id,
          description: `Debit note ${dn.number}`,
          debit: ZERO,
          credit: total,
          entryDate: dn.returnDate,
          createdById: storeUser.id,
        },
      });
    }
    console.log(`    ${store.purchaseOrders.length} POs, ${store.grns.length} GRNs, ${store.purchaseInvoices.length} invoices`);
  });

  // ════════════════════════════════════════════════════════════════════
  // 2. WAREHOUSE / INVENTORY
  // ════════════════════════════════════════════════════════════════════
  await run('Stock requisitions + transfers', async () => {
    const REQ_STATUSES = ['SUBMITTED', 'SUBMITTED', 'APPROVED', 'APPROVED', 'WAREHOUSE_ASSIGNED', 'PICKING', 'PACKED',
      'DISPATCHED', 'IN_TRANSIT', 'RECEIVED', 'COMPLETED', 'COMPLETED', 'COMPLETED', 'REJECTED', 'CANCELLED'] as const;
    for (let i = 0; i < 15; i++) {
      const status = REQ_STATUSES[i]!;
      const showroom = pick([dhakaMain, hqStore]);
      const source = pick([hqMain, ctgMain]);
      const items = pickN(sellables, randInt(1, 3));
      const req = await prisma.stockRequisition.create({
        data: {
          number: nextNo('SREQ'),
          branchId: showroom.branchId,
          showroomWarehouseId: showroom.id,
          sourceWarehouseId: source.id,
          priority: pick(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
          requiredDate: addDays(new Date(), randInt(3, 15)),
          status,
          remarks: 'Bulk-seeded demo requisition',
          requestedById: storeUser.id,
          approvedById: status === 'REJECTED' || status === 'SUBMITTED' ? null : branchAdmin.id,
          approvedAt: status === 'REJECTED' || status === 'SUBMITTED' ? null : daysAgo(randDaysAgo(30, 3)),
          rejectionReason: status === 'REJECTED' ? 'Insufficient stock at source warehouse' : null,
          completedAt: status === 'COMPLETED' ? daysAgo(randDaysAgo(15, 1)) : null,
          items: {
            create: items.map((p) => ({
              productId: p.id,
              unit: p.unit,
              requestedQty: D(randInt(5, 50)),
              approvedQty: status === 'SUBMITTED' || status === 'REJECTED' ? ZERO : D(randInt(5, 50)),
              dispatchedQty: ZERO,
              receivedQty: ZERO,
            })),
          },
        },
        include: { items: true },
      });

      if (status === 'REJECTED' || status === 'CANCELLED' || status === 'SUBMITTED') continue;

      const dispatched = ['DISPATCHED', 'IN_TRANSIT', 'RECEIVED', 'COMPLETED'].includes(status);
      const transferStatus =
        status === 'APPROVED' || status === 'WAREHOUSE_ASSIGNED'
          ? 'PICKING'
          : status === 'PICKING'
            ? 'PICKING'
            : status === 'PACKED'
              ? 'PACKED'
              : status === 'DISPATCHED'
                ? 'DISPATCHED'
                : status === 'IN_TRANSIT'
                  ? 'IN_TRANSIT'
                  : status === 'RECEIVED'
                    ? 'RECEIVED'
                    : 'COMPLETED';

      const transfer = await prisma.stockTransfer.create({
        data: {
          number: nextNo('TRF'),
          requisitionId: req.id,
          fromBranchId: source.branchId,
          toBranchId: showroom.branchId,
          fromWarehouseId: source.id,
          toWarehouseId: showroom.id,
          status: transferStatus,
          expectedDate: addDays(new Date(), randInt(1, 10)),
          packedBy: storeUser.name,
          vehicle: `DHAKA-METRO-${randInt(1000, 9999)}`,
          driverName: pick(['Habib', 'Rafiq', 'Selim']),
          driverPhone: `+8801${randInt(700000000, 799999999)}`,
          gatePassNo: `GP-${randInt(1000, 9999)}`,
          trackingNo: dispatched ? `TRK-${randInt(100000, 999999)}` : null,
          remarks: 'Bulk-seeded demo transfer',
          createdById: storeUser.id,
          dispatchedById: dispatched ? storeUser.id : null,
          receivedById: status === 'RECEIVED' || status === 'COMPLETED' ? storeUser.id : null,
          dispatchDate: dispatched ? daysAgo(randDaysAgo(20, 3)) : null,
          receivedDate: status === 'RECEIVED' || status === 'COMPLETED' ? daysAgo(randDaysAgo(10, 1)) : null,
          items: {
            create: req.items.map((it) => ({
              requisitionItemId: it.id,
              productId: it.productId,
              quantity: it.approvedQty.gt(0) ? it.approvedQty : it.requestedQty,
              receivedQty: status === 'RECEIVED' || status === 'COMPLETED' ? (it.approvedQty.gt(0) ? it.approvedQty : it.requestedQty) : ZERO,
              damagedQty: ZERO,
              missingQty: ZERO,
            })),
          },
        },
        include: { items: true },
      });

      if (dispatched) {
        for (const it of transfer.items) {
          await prisma.inventoryLedger.create({
            data: {
              branchId: source.branchId,
              warehouseId: source.id,
              productId: it.productId,
              direction: 'OUT',
              quantity: it.quantity,
              costPerUnit: prod(products.find((p) => p.id === it.productId)!.sku).costPrice,
              refType: 'STOCK_TRANSFER',
              refId: transfer.id,
              note: `Transfer ${transfer.number}`,
              createdById: storeUser.id,
            },
          });
        }
      }
      if (status === 'RECEIVED' || status === 'COMPLETED') {
        for (const it of transfer.items) {
          await prisma.inventoryLedger.create({
            data: {
              branchId: showroom.branchId,
              warehouseId: showroom.id,
              productId: it.productId,
              direction: 'IN',
              quantity: it.receivedQty,
              costPerUnit: prod(products.find((p) => p.id === it.productId)!.sku).costPrice,
              refType: 'STOCK_TRANSFER',
              refId: transfer.id,
              note: `Transfer ${transfer.number} received`,
              createdById: storeUser.id,
            },
          });
        }
      }
    }
  });

  await run('Damage reports', async () => {
    const DMG_STATUSES = ['REPORTED', 'REPORTED', 'PENDING_APPROVAL', 'PENDING_APPROVAL', 'APPROVED', 'APPROVED',
      'REJECTED', 'RESOLVED', 'RESOLVED', 'RESOLVED', 'RESOLVED', 'RESOLVED'] as const;
    for (let i = 0; i < 12; i++) {
      const status = DMG_STATUSES[i]!;
      const source = pick([hqMain, ctgMain, factoryMain]);
      const items = pickN(products, randInt(1, 2));
      const resolution = status === 'RESOLVED' ? pick(['SCRAP', 'REPAIR', 'B_GRADE', 'SUPPLIER_CLAIM'] as const) : null;
      const supplier = resolution === 'SUPPLIER_CLAIM' ? pick(suppliers) : null;
      let estValue = ZERO;
      const itemRows = items.map((p) => {
        const qty = D(randInt(1, 15));
        const cost = p.costPrice;
        estValue = estValue.plus(qty.mul(cost));
        return { productId: p.id, quantity: qty, costPerUnit: cost, note: 'Damaged during handling' };
      });
      const report = await prisma.damageReport.create({
        data: {
          number: nextNo('DMG'),
          branchId: source.branchId,
          warehouseId: source.id,
          quarantineWarehouseId: source.branchId === HQ.id ? hqQrt.id : source.id,
          reportDate: daysAgo(randDaysAgo(80, 2)),
          reason: pick(['Water damage during storage', 'Torn during transit', 'Manufacturing defect found', 'Rodent damage', 'Dropped during handling']),
          note: 'Bulk-seeded demo damage report',
          status,
          estimatedValue: estValue,
          requiresApproval: estValue.gt(10000),
          resolution,
          supplierId: supplier?.id ?? null,
          claimAmount: resolution === 'SUPPLIER_CLAIM' ? estValue : ZERO,
          claimReference: resolution === 'SUPPLIER_CLAIM' ? `CLAIM-${randInt(1000, 9999)}` : null,
          resolutionNote: status === 'RESOLVED' ? `Resolved via ${resolution}` : null,
          reportedById: storeUser.id,
          resolvedById: status === 'RESOLVED' ? branchAdmin.id : null,
          resolvedAt: status === 'RESOLVED' ? daysAgo(randDaysAgo(20, 1)) : null,
          items: { create: itemRows },
        },
        include: { items: true },
      });

      if (status === 'REJECTED') continue;
      const qWh = source.branchId === HQ.id ? hqQrt : source;
      for (const it of report.items) {
        await prisma.inventoryLedger.create({
          data: {
            branchId: source.branchId,
            warehouseId: source.id,
            productId: it.productId,
            direction: 'OUT',
            quantity: it.quantity,
            costPerUnit: it.costPerUnit,
            refType: 'DAMAGE_REPORT',
            refId: report.id,
            note: `Damage report ${report.number}`,
            createdById: storeUser.id,
          },
        });
        if (qWh.id !== source.id) {
          await prisma.inventoryLedger.create({
            data: {
              branchId: source.branchId,
              warehouseId: qWh.id,
              productId: it.productId,
              direction: 'IN',
              quantity: it.quantity,
              costPerUnit: it.costPerUnit,
              refType: 'DAMAGE_REPORT',
              refId: report.id,
              note: `Damage report ${report.number} — quarantined`,
              createdById: storeUser.id,
            },
          });
        }
        if (resolution === 'SCRAP') {
          await prisma.inventoryLedger.create({
            data: {
              branchId: source.branchId,
              warehouseId: qWh.id,
              productId: it.productId,
              direction: 'OUT',
              quantity: it.quantity,
              costPerUnit: it.costPerUnit,
              refType: 'DAMAGE_SCRAP',
              refId: report.id,
              note: `Damage report ${report.number} — written off`,
              createdById: branchAdmin.id,
            },
          });
        }
      }
    }
  });

  await run('Customer returns', async () => {
    const CR_STATUSES = ['PENDING_INSPECTION', 'PENDING_INSPECTION', 'INSPECTED', 'INSPECTED', 'COMPLETED',
      'COMPLETED', 'COMPLETED', 'COMPLETED', 'COMPLETED', 'COMPLETED', 'REJECTED', 'REJECTED'] as const;
    for (let i = 0; i < 12; i++) {
      const status = CR_STATUSES[i]!;
      const branch = pick([HQ, DHAKA]);
      const w = branch.id === HQ.id ? hqStore : dhakaMain;
      const customer = pick(customers);
      const items = pickN(sellables, randInt(1, 2));
      const disposition = status === 'COMPLETED' ? pick(['RESTOCK', 'REWORK', 'DAMAGED', 'REJECT'] as const) : null;
      const cr = await prisma.customerReturn.create({
        data: {
          number: nextNo('CRT'),
          branchId: branch.id,
          warehouseId: w.id,
          inspectionWarehouseId: w.id,
          sourceDocumentType: pick(['PosSale', 'WholesaleInvoice']),
          sourceDocumentNumber: `SRC-${randInt(1000, 9999)}`,
          customerName: customer.name,
          customerPhone: customer.phone,
          returnDate: daysAgo(randDaysAgo(70, 2)),
          status,
          financeAction: status === 'COMPLETED' ? pick(['REFUND', 'EXCHANGE', 'CREDIT_ADJUSTMENT'] as const) : 'NONE',
          financeNote: status === 'COMPLETED' ? 'Processed per return policy' : null,
          intakeNote: 'Customer reported issue at counter',
          inspectionNote: status !== 'PENDING_INSPECTION' ? 'Inspected by store team' : null,
          createdById: cashier.id,
          inspectedById: status !== 'PENDING_INSPECTION' ? storeUser.id : null,
          inspectedAt: status !== 'PENDING_INSPECTION' ? daysAgo(randDaysAgo(60, 1)) : null,
          completedAt: status === 'COMPLETED' ? daysAgo(randDaysAgo(50, 1)) : null,
          items: {
            create: items.map((p) => ({
              productId: p.id,
              quantity: D(randInt(1, 5)),
              disposition,
              note: 'Bulk-seeded demo return item',
            })),
          },
        },
        include: { items: true },
      });

      if (disposition === 'RESTOCK') {
        for (const it of cr.items) {
          await prisma.inventoryLedger.create({
            data: {
              branchId: branch.id,
              warehouseId: w.id,
              productId: it.productId,
              direction: 'IN',
              quantity: it.quantity,
              costPerUnit: products.find((p) => p.id === it.productId)!.costPrice,
              refType: 'CUSTOMER_RETURN',
              refId: cr.id,
              note: `Customer return ${cr.number} restocked`,
              createdById: storeUser.id,
            },
          });
        }
      }
    }
  });

  // ════════════════════════════════════════════════════════════════════
  // 3. FACTORY
  // ════════════════════════════════════════════════════════════════════
  await run('Production plans, orders, stages, materials, outputs, costs', async () => {
    const plans: string[] = [];
    for (let i = 0; i < 10; i++) {
      const product = pick(finishedGoods);
      const plan = await prisma.productionPlan.create({
        data: {
          planNo: nextNo('PLN'),
          planningDate: dateOnly(daysAgo(randDaysAgo(90, 10))),
          branchId: FACTORY.id,
          productId: product.id,
          quantity: D(randInt(50, 500)),
          priority: pick(['LOW', 'MEDIUM', 'HIGH']),
          plannedStartDate: daysAgo(randDaysAgo(80, 10)),
          plannedEndDate: addDays(new Date(), randInt(1, 30)),
          productionLine: pick(['Line A', 'Line B', 'Line C']),
          machine: pick(['Cutting-01', 'Stitching-02', 'Finishing-03']),
          shift: pick(['Day', 'Night']),
          plannerId: factoryUser.id,
          status: pick(['DRAFT', 'APPROVED', 'SCHEDULED', 'RUNNING', 'COMPLETED'] as const),
        },
      });
      plans.push(plan.id);
    }

    const ORDER_STATUSES = ['DRAFT', 'PLANNED', 'PLANNED', 'IN_PROGRESS', 'IN_PROGRESS', 'IN_PROGRESS', 'IN_PROGRESS',
      'COMPLETED', 'COMPLETED', 'COMPLETED', 'COMPLETED', 'COMPLETED', 'CANCELLED', 'ON_HOLD', 'ON_HOLD'] as const;
    const stageNames = ['Cutting', 'Skiving', 'Stitching', 'Assembly', 'Finishing', 'Quality Check', 'Packing'];

    for (let i = 0; i < 15; i++) {
      const status = ORDER_STATUSES[i]!;
      const product = pick(finishedGoods);
      const plannedQty = D(randInt(50, 400));
      const producedQty = status === 'COMPLETED' ? plannedQty : status === 'IN_PROGRESS' ? plannedQty.mul(0.5) : ZERO;
      const order = await prisma.productionOrder.create({
        data: {
          branchId: FACTORY.id,
          number: nextNo('PRO'),
          productId: product.id,
          planId: i < plans.length ? plans[i] : null,
          plannedQty,
          producedQty,
          unit: product.unit,
          status,
          plannedStartDate: daysAgo(randDaysAgo(75, 15)),
          plannedEndDate: addDays(new Date(), randInt(-5, 25)),
          actualStartDate: status === 'DRAFT' || status === 'PLANNED' ? null : daysAgo(randDaysAgo(70, 10)),
          actualEndDate: status === 'COMPLETED' ? daysAgo(randDaysAgo(10, 1)) : null,
          notes: 'Bulk-seeded demo production order',
          overheadRate: D(12.5),
          buyerName: pick(['Local Retail', 'Export Buyer Co.', null]),
          batchName: `BATCH-${2026}-${pad(i + 1, 3)}`,
          saleAmount: producedQty.gt(0) ? producedQty.mul(product.sellPrice) : null,
          createdById: factoryUser.id,
        },
      });
      store.productionOrders.push({ id: order.id, number: order.number });

      const stages = pickN(stageNames, randInt(2, 4)).map((n, idx) => ({ name: n, seq: idx + 1 }));
      let createdStages: Array<{ id: string; sequence: number }> = [];
      for (const s of stages) {
        const stageStatus =
          status === 'COMPLETED' ? 'COMPLETED' : status === 'IN_PROGRESS' && s.seq === 1 ? 'COMPLETED' : status === 'IN_PROGRESS' && s.seq === 2 ? 'IN_PROGRESS' : 'PENDING';
        const stage = await prisma.productionStage.create({
          data: {
            orderId: order.id,
            sequence: s.seq,
            name: s.name,
            status: stageStatus as never,
            startedAt: stageStatus !== 'PENDING' ? daysAgo(randDaysAgo(60, 10)) : null,
            completedAt: stageStatus === 'COMPLETED' ? daysAgo(randDaysAgo(30, 2)) : null,
          },
        });
        createdStages.push({ id: stage.id, sequence: stage.sequence });
      }

      if (status === 'DRAFT' || status === 'CANCELLED') continue;

      // Material consumption
      const mats = pickN([...rawMaterials, ...consumables], randInt(1, 3));
      for (const m of mats) {
        const plannedMatQty = D(randInt(20, 300));
        const consumedQty = status === 'COMPLETED' || status === 'IN_PROGRESS' ? plannedMatQty : ZERO;
        await prisma.productionMaterial.create({
          data: {
            orderId: order.id,
            productId: m.id,
            unit: m.unit,
            plannedQty: plannedMatQty,
            consumedQty,
            fromWarehouseId: factoryMain.id,
            materialType: m.type === 'RAW_MATERIAL' ? 'LEATHER' : 'ACCESSORY',
            unitCost: m.costPrice,
            note: null,
          },
        });
        if (consumedQty.gt(0)) {
          await prisma.inventoryLedger.create({
            data: {
              branchId: FACTORY.id,
              warehouseId: factoryMain.id,
              productId: m.id,
              direction: 'OUT',
              quantity: consumedQty,
              costPerUnit: m.costPrice,
              refType: 'PRODUCTION_MATERIAL',
              refId: order.id,
              note: `Consumed on ${order.number}`,
              createdById: factoryUser.id,
            },
          });
        }
      }

      // Output
      if (producedQty.gt(0)) {
        await prisma.productionOutput.create({
          data: {
            orderId: order.id,
            productId: product.id,
            unit: product.unit,
            quantity: producedQty,
            costPerUnit: product.costPrice,
            toWarehouseId: factoryMain.id,
            note: 'Finished goods output',
            createdById: factoryUser.id,
          },
        });
        await prisma.inventoryLedger.create({
          data: {
            branchId: FACTORY.id,
            warehouseId: factoryMain.id,
            productId: product.id,
            direction: 'IN',
            quantity: producedQty,
            costPerUnit: product.costPrice,
            refType: 'PRODUCTION_OUTPUT',
            refId: order.id,
            note: `Output from ${order.number}`,
            createdById: factoryUser.id,
          },
        });
      }

      // Cost entries
      for (const type of pickN(['OVERHEAD', 'WEDGE', 'LABOUR'] as const, randInt(1, 3))) {
        await prisma.productionCostEntry.create({
          data: {
            orderId: order.id,
            type,
            description: `${type} cost for ${order.number}`,
            hours: type === 'LABOUR' ? D(randInt(8, 80)) : null,
            rate: type === 'LABOUR' ? D(randInt(50, 150)) : null,
            amount: D(randInt(2000, 25000)),
            note: null,
            createdById: factoryUser.id,
          },
        });
      }

      // Process tracking + WIP ledger per stage (subset)
      let runningBalance = ZERO;
      for (const stage of createdStages.slice(0, 2)) {
        const inQty = D(randInt(20, 200));
        const outQty = inQty.mul(0.85);
        runningBalance = runningBalance.plus(inQty).minus(outQty);
        await prisma.processTracking.create({
          data: {
            trackingNo: nextNo('PT'),
            orderId: order.id,
            branchId: FACTORY.id,
            productId: product.id,
            stageId: stage.id,
            batchNo: `BATCH-${pad(stage.sequence, 2)}`,
            machine: pick(['Cutting-01', 'Stitching-02']),
            operatorId: pick(employees).id,
            status: status === 'COMPLETED' ? 'COMPLETED' : 'RUNNING',
            startTime: daysAgo(randDaysAgo(50, 5)),
            endTime: status === 'COMPLETED' ? daysAgo(randDaysAgo(40, 2)) : null,
            durationMinutes: randInt(60, 480),
            inputQty: inQty,
            outputQty: outQty,
            rejectedQty: inQty.mul(0.03),
            scrapQty: inQty.mul(0.02),
            reworkQty: ZERO,
            remainingQty: runningBalance.gt(0) ? runningBalance : ZERO,
            materialCost: D(randInt(1000, 8000)),
            labourCost: D(randInt(500, 4000)),
            machineCost: D(randInt(200, 2000)),
            overheadCost: D(randInt(200, 1500)),
            totalProcessCost: D(randInt(2000, 15000)),
          },
        });
        await prisma.wipLedger.create({
          data: {
            date: dateOnly(daysAgo(randDaysAgo(45, 5))),
            branchId: FACTORY.id,
            orderId: order.id,
            stageId: stage.id,
            productId: product.id,
            voucher: `WIP-${order.number}`,
            operatorId: pick(employees).id,
            inQty,
            outQty,
            balance: runningBalance.gt(0) ? runningBalance : ZERO,
            cost: D(randInt(1000, 6000)),
          },
        });
      }

      // Scrap ledger occasionally
      if (Math.random() > 0.5) {
        await prisma.scrapLedger.create({
          data: {
            date: dateOnly(daysAgo(randDaysAgo(40, 3))),
            branchId: FACTORY.id,
            orderId: order.id,
            stageId: createdStages[0]?.id ?? null,
            scrapType: pick(['Leather offcuts', 'Rejected stitching', 'Trim waste']),
            operatorId: pick(employees).id,
            qty: D(randInt(1, 20)),
            cost: D(randInt(100, 2000)),
            notes: 'Bulk-seeded scrap entry',
          },
        });
      }

      // Work order
      const wo = await prisma.workOrder.create({
        data: {
          workOrderNo: nextNo('WO'),
          orderId: order.id,
          department: 'Production',
          machine: pick(['Cutting-01', 'Stitching-02', 'Finishing-03']),
          operatorId: pick(employees).id,
          shift: pick(['Day', 'Night']),
          inputQty: plannedQty,
          targetQty: plannedQty,
          outputQty: producedQty,
          scrapQty: producedQty.mul(0.02),
          status: status === 'COMPLETED' ? 'COMPLETED' : status === 'IN_PROGRESS' ? 'RUNNING' : 'PENDING',
          startTime: daysAgo(randDaysAgo(60, 10)),
          endTime: status === 'COMPLETED' ? daysAgo(randDaysAgo(20, 2)) : null,
        },
      });
      if (Math.random() > 0.6) {
        await prisma.delayTracking.create({
          data: {
            workOrderId: wo.id,
            reason: pick(['MACHINE_BREAKDOWN', 'MATERIAL_SHORTAGE', 'OPERATOR_ABSENT', 'POWER_FAILURE', 'QUALITY_ISSUE', 'MAINTENANCE', 'OTHER'] as const),
            notes: 'Bulk-seeded delay entry',
            startTime: daysAgo(randDaysAgo(45, 10)),
            endTime: daysAgo(randDaysAgo(45, 10)),
            durationMins: randInt(15, 240),
          },
        });
      }
    }
  });

  await run('Production issue vouchers + finished goods receive vouchers', async () => {
    const orders = store.productionOrders;
    if (orders.length === 0) return;
    for (let i = 0; i < 10; i++) {
      const order = pick(orders);
      const items = pickN([...rawMaterials, ...consumables], randInt(1, 2));
      const status = pick(['DRAFT', 'REQUESTED', 'APPROVED', 'ISSUED', 'ISSUED', 'REJECTED'] as const);
      const voucher = await prisma.productionIssueVoucher.create({
        data: {
          voucherNo: nextNo('PIV'),
          date: dateOnly(daysAgo(randDaysAgo(60, 5))),
          branchId: FACTORY.id,
          orderId: order.id,
          warehouseId: factoryMain.id,
          status,
          requestedById: factoryUser.id,
          approvedById: status === 'DRAFT' || status === 'REQUESTED' ? null : branchAdmin.id,
          issuedById: status === 'ISSUED' ? storeUser.id : null,
          remarks: 'Bulk-seeded issue voucher',
          items: {
            create: items.map((p) => ({
              productId: p.id,
              batchNo: `BATCH-${randInt(100, 999)}`,
              requiredQty: D(randInt(10, 100)),
              issuedQty: status === 'ISSUED' ? D(randInt(10, 100)) : ZERO,
              uom: p.unit,
            })),
          },
        },
        include: { items: true },
      });
      if (status === 'ISSUED') {
        for (const it of voucher.items) {
          if (it.issuedQty.lte(0)) continue;
          await prisma.inventoryLedger.create({
            data: {
              branchId: FACTORY.id,
              warehouseId: factoryMain.id,
              productId: it.productId,
              direction: 'OUT',
              quantity: it.issuedQty,
              costPerUnit: products.find((p) => p.id === it.productId)!.costPrice,
              refType: 'PRODUCTION_ISSUE',
              refId: voucher.id,
              note: `Issue voucher ${voucher.voucherNo}`,
              createdById: storeUser.id,
            },
          });
        }
      }
    }

    for (let i = 0; i < 8; i++) {
      const order = pick(orders);
      const product = pick(finishedGoods);
      const qty = D(randInt(20, 150));
      const voucher = await prisma.finishedGoodsReceiveVoucher.create({
        data: {
          receiveNo: nextNo('FGR'),
          date: dateOnly(daysAgo(randDaysAgo(50, 3))),
          branchId: FACTORY.id,
          orderId: order.id,
          warehouseId: factoryMain.id,
          receivedById: factoryUser.id,
          approvedById: branchAdmin.id,
          remarks: 'Bulk-seeded FG receive',
          items: {
            create: [
              {
                productId: product.id,
                batchNo: `BATCH-${randInt(100, 999)}`,
                quantity: qty,
                uom: product.unit,
                qualityStatus: pick(['PENDING', 'PASSED', 'PASSED', 'FAILED', 'REWORK'] as const),
              },
            ],
          },
        },
      });
      await prisma.inventoryLedger.create({
        data: {
          branchId: FACTORY.id,
          warehouseId: factoryMain.id,
          productId: product.id,
          direction: 'IN',
          quantity: qty,
          costPerUnit: product.costPrice,
          refType: 'FG_RECEIVE',
          refId: voucher.id,
          note: `FG receive ${voucher.receiveNo}`,
          createdById: factoryUser.id,
        },
      });
    }
  });

  console.log('  … running sales, accounts, HR, assets, docs, approvals, notifications (see log lines below)');

  await runSalesStack();
  await runAccounts();
  await runTrade();
  await runHr();
  await runAssets();
  await runDocumentsAndApprovals();
  await runNotificationsAndAnnouncements();

  console.log('\n🎉 Full demo seed complete!');

  // ══════════════════════════════════════════════════════════════════
  // Nested section functions (closures over reference data above)
  // ══════════════════════════════════════════════════════════════════

  async function runSalesStack() {
    await run('Corporate sales (quote → order → delivery → invoice → payment)', async () => {
      for (let i = 0; i < 10; i++) {
        const customer = pick([...corporateCustomers, ...wholesaleCustomers]);
        const items = pickN(sellables, randInt(2, 4));
        let subtotal = ZERO;
        const quoteItems = items.map((p) => {
          const qty = D(randInt(5, 60));
          const lineTotal = qty.mul(p.sellPrice);
          subtotal = subtotal.plus(lineTotal);
          return { productId: p.id, unit: p.unit, quantity: qty, unitPrice: p.sellPrice, lineTotal };
        });
        const quote = await prisma.corporateQuote.create({
          data: {
            number: nextNo('CQ'),
            branchId: HQ.id,
            customerId: customer.id,
            salesRepId: salesUser.id,
            quoteDate: daysAgo(randDaysAgo(90, 20)),
            validUntil: addDays(new Date(), randInt(5, 30)),
            currency: 'BDT',
            subtotal,
            grandTotal: subtotal,
            status: pick(['DRAFT', 'SENT', 'ACCEPTED', 'ACCEPTED', 'CONVERTED', 'CONVERTED', 'REJECTED', 'EXPIRED'] as const),
            notes: 'Bulk-seeded demo quote',
            createdById: salesUser.id,
            items: { create: quoteItems },
          },
        });

        if (i >= 8) continue; // keep 2 quotes standalone (not yet converted)

        const order = await prisma.corporateOrder.create({
          data: {
            number: nextNo('CORD'),
            branchId: HQ.id,
            warehouseId: hqMain.id,
            customerId: customer.id,
            quoteId: quote.id,
            salesRepId: salesUser.id,
            orderDate: daysAgo(randDaysAgo(80, 15)),
            expectedDate: addDays(new Date(), randInt(2, 20)),
            paymentTerms: 'NET_30',
            currency: 'BDT',
            subtotal,
            grandTotal: subtotal,
            status: pick(['CONFIRMED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'DELIVERED', 'INVOICED', 'INVOICED', 'CLOSED'] as const),
            notes: 'Bulk-seeded demo order',
            createdById: salesUser.id,
            items: {
              create: quoteItems.map((it) => ({
                productId: it.productId,
                unit: it.unit,
                quantity: it.quantity,
                unitPrice: it.unitPrice,
                lineTotal: it.lineTotal,
                deliveredQty: ZERO,
                invoicedQty: ZERO,
              })),
            },
          },
          include: { items: true },
        });
        store.corporateOrders.push({ id: order.id, number: order.number });

        if (i >= 6) continue; // some orders stay undelivered

        const delivery = await prisma.corporateDelivery.create({
          data: {
            number: nextNo('CDN'),
            branchId: HQ.id,
            warehouseId: hqMain.id,
            orderId: order.id,
            deliveryAddress: customer.address ?? `${customer.city ?? 'Dhaka'}, Bangladesh`,
            expectedDate: dateOnly(addDays(new Date(), randInt(1, 10))),
            deliveryDate: daysAgo(randDaysAgo(60, 5)),
            status: 'DELIVERED',
            vehicleNo: `DHAKA-METRO-${randInt(1000, 9999)}`,
            driverName: pick(['Kamal', 'Jasim', 'Rafiq']),
            driverPhone: `+8801${randInt(700000000, 799999999)}`,
            transportCompany: 'Annex Logistics',
            trackingNo: `TRK-${randInt(100000, 999999)}`,
            gatePassNo: `GP-${randInt(1000, 9999)}`,
            receivedById: cashier.id,
            notes: 'Bulk-seeded demo delivery',
            createdById: salesUser.id,
            items: {
              create: order.items.map((it) => ({
                orderItemId: it.id,
                productId: it.productId,
                quantity: it.quantity,
              })),
            },
          },
          include: { items: true },
        });
        for (const it of delivery.items) {
          await prisma.inventoryLedger.create({
            data: {
              branchId: HQ.id,
              warehouseId: hqMain.id,
              productId: it.productId,
              direction: 'OUT',
              quantity: it.quantity,
              costPerUnit: products.find((p) => p.id === it.productId)!.costPrice,
              refType: 'CORPORATE_DELIVERY',
              refId: delivery.id,
              note: `Delivery ${delivery.number}`,
              createdById: salesUser.id,
            },
          });
          await prisma.corporateOrderItem.update({ where: { id: it.orderItemId }, data: { deliveredQty: it.quantity } });
        }

        if (i >= 4) continue; // some deliveries stay uninvoiced

        const invStatus = pick(['ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'] as const);
        const invoice = await prisma.corporateInvoice.create({
          data: {
            number: nextNo('CINV'),
            branchId: HQ.id,
            customerId: customer.id,
            orderId: order.id,
            invoiceDate: addDays(delivery.deliveryDate ?? new Date(), 1),
            dueDate: addDays(delivery.deliveryDate ?? new Date(), 30),
            currency: 'BDT',
            subtotal,
            grandTotal: subtotal,
            paidTotal: invStatus === 'PAID' ? subtotal : invStatus === 'PARTIALLY_PAID' ? subtotal.mul(0.4) : ZERO,
            balanceDue: invStatus === 'PAID' ? ZERO : invStatus === 'PARTIALLY_PAID' ? subtotal.mul(0.6) : subtotal,
            status: invStatus,
            notes: 'Bulk-seeded demo invoice',
            createdById: accountant.id,
            items: {
              create: delivery.items.map((it) => {
                const orderItem = order.items.find((oi) => oi.id === it.orderItemId)!;
                return {
                  orderItemId: it.orderItemId,
                  productId: it.productId,
                  quantity: it.quantity,
                  unitPrice: orderItem.unitPrice,
                  lineTotal: it.quantity.mul(orderItem.unitPrice),
                };
              }),
            },
          },
        });
        await prisma.customerLedger.create({
          data: {
            branchId: HQ.id,
            customerId: customer.id,
            entryType: 'INVOICE',
            refType: 'CorporateInvoice',
            refId: invoice.id,
            description: `Invoice ${invoice.number}`,
            debit: subtotal,
            credit: ZERO,
            entryDate: invoice.invoiceDate,
            createdById: accountant.id,
          },
        });
        if (invStatus === 'PAID' || invStatus === 'PARTIALLY_PAID') {
          const paid = invStatus === 'PAID' ? subtotal : subtotal.mul(0.4);
          await prisma.corporateInvoicePayment.create({
            data: {
              invoiceId: invoice.id,
              method: pick(['BANK_TRANSFER', 'OTHER', 'CASH'] as const),
              amount: paid,
              reference: `REF-${randInt(10000, 99999)}`,
              paidAt: addDays(invoice.invoiceDate, randInt(2, 15)),
              createdById: accountant.id,
            },
          });
          await prisma.customerLedger.create({
            data: {
              branchId: HQ.id,
              customerId: customer.id,
              entryType: 'PAYMENT',
              refType: 'CorporateInvoice',
              refId: invoice.id,
              description: `Payment against ${invoice.number}`,
              debit: ZERO,
              credit: paid,
              entryDate: addDays(invoice.invoiceDate, randInt(2, 15)),
              createdById: accountant.id,
            },
          });
        }

        if (i < 4) {
          const returnItem = order.items[0]!;
          await prisma.corporateSalesReturn.create({
            data: {
              returnNo: nextNo('CSR'),
              branchId: HQ.id,
              customerId: customer.id,
              orderId: order.id,
              invoiceId: invoice.id,
              warehouseId: hqMain.id,
              returnDate: addDays(invoice.invoiceDate, randInt(3, 20)),
              status: pick(['REQUESTED', 'APPROVED', 'GOODS_RECEIVED', 'CLOSED'] as const),
              refundType: pick(['CASH', 'BANK', 'CREDIT_NOTE', 'REPLACEMENT'] as const),
              reason: 'Customer reported quality issue',
              qcOfficerId: storeUser.id,
              createdById: salesUser.id,
              items: {
                create: [
                  {
                    orderItemId: returnItem.id,
                    productId: returnItem.productId,
                    soldQty: returnItem.quantity,
                    returnedQty: returnItem.quantity.mul(0.2),
                    condition: pick(['RESALABLE', 'REPAIRABLE', 'DAMAGED', 'MANUFACTURING_DEFECT'] as const),
                    inspectionResult: 'Inspected on arrival',
                  },
                ],
              },
            },
          });
        }
      }
    });

    await run('Wholesale invoices + payments + returns', async () => {
      for (let i = 0; i < 15; i++) {
        const customer = pick(wholesaleCustomers);
        const items = pickN(sellables, randInt(1, 4));
        let subtotal = ZERO;
        const itemRows = items.map((p) => {
          const qty = D(randInt(5, 80));
          const lineTotal = qty.mul(p.sellPrice);
          subtotal = subtotal.plus(lineTotal);
          return { productId: p.id, unit: p.unit, quantity: qty, unitPrice: p.sellPrice, lineTotal, returnedQty: ZERO };
        });
        const paidFraction = pick([0, 0, 0.3, 0.5, 1, 1]);
        const paid = subtotal.mul(paidFraction);
        const status = paidFraction === 0 ? 'CONFIRMED' : paidFraction === 1 ? 'PAID' : 'PARTIALLY_PAID';
        const invoice = await prisma.wholesaleInvoice.create({
          data: {
            number: nextNo('WSI'),
            branchId: HQ.id,
            warehouseId: hqMain.id,
            customerId: customer.id,
            salesRepId: salesUser.id,
            invoiceDate: daysAgo(randDaysAgo(90, 2)),
            dueDate: addDays(new Date(), randInt(-10, 30)),
            currency: 'BDT',
            subtotal,
            grandTotal: subtotal,
            paidTotal: paid,
            balanceDue: subtotal.minus(paid),
            status,
            notes: 'Bulk-seeded demo wholesale invoice',
            createdById: salesUser.id,
            items: { create: itemRows },
          },
          include: { items: true },
        });
        store.wholesaleInvoices.push({ id: invoice.id, number: invoice.number });

        for (const it of invoice.items) {
          await prisma.inventoryLedger.create({
            data: {
              branchId: HQ.id,
              warehouseId: hqMain.id,
              productId: it.productId,
              direction: 'OUT',
              quantity: it.quantity,
              costPerUnit: products.find((p) => p.id === it.productId)!.costPrice,
              refType: 'WHOLESALE_INVOICE',
              refId: invoice.id,
              note: `Wholesale invoice ${invoice.number}`,
              createdById: salesUser.id,
            },
          });
        }
        await prisma.customerLedger.create({
          data: {
            branchId: HQ.id,
            customerId: customer.id,
            entryType: 'INVOICE',
            refType: 'WholesaleInvoice',
            refId: invoice.id,
            description: `Wholesale invoice ${invoice.number}`,
            debit: subtotal,
            credit: ZERO,
            entryDate: invoice.invoiceDate,
            createdById: salesUser.id,
          },
        });
        if (paid.gt(0)) {
          await prisma.wholesalePayment.create({
            data: {
              invoiceId: invoice.id,
              method: pick(['CASH', 'BANK_TRANSFER', 'MOBILE_BANKING', 'OTHER'] as const),
              amount: paid,
              reference: `REF-${randInt(10000, 99999)}`,
              paidAt: addDays(invoice.invoiceDate, randInt(1, 15)),
              createdById: accountant.id,
            },
          });
          await prisma.customerLedger.create({
            data: {
              branchId: HQ.id,
              customerId: customer.id,
              entryType: 'PAYMENT',
              refType: 'WholesaleInvoice',
              refId: invoice.id,
              description: `Payment for ${invoice.number}`,
              debit: ZERO,
              credit: paid,
              entryDate: addDays(invoice.invoiceDate, randInt(1, 15)),
              createdById: accountant.id,
            },
          });
        }

        if (i < 5) {
          const retItem = invoice.items[0]!;
          const retQty = retItem.quantity.mul(0.15);
          const retTotal = retQty.mul(retItem.unitPrice);
          const wReturn = await prisma.wholesaleReturn.create({
            data: {
              number: nextNo('WSR'),
              branchId: HQ.id,
              warehouseId: hqMain.id,
              invoiceId: invoice.id,
              returnDate: addDays(invoice.invoiceDate, randInt(3, 20)),
              refundAmount: retTotal,
              refundToBalance: true,
              refundMethod: 'CASH',
              status: 'COMPLETED',
              reason: 'Customer returned excess stock',
              createdById: salesUser.id,
              items: {
                create: [
                  {
                    invoiceItemId: retItem.id,
                    productId: retItem.productId,
                    quantity: retQty,
                    unitPrice: retItem.unitPrice,
                    lineTotal: retTotal,
                  },
                ],
              },
            },
          });
          await prisma.inventoryLedger.create({
            data: {
              branchId: HQ.id,
              warehouseId: hqMain.id,
              productId: retItem.productId,
              direction: 'IN',
              quantity: retQty,
              costPerUnit: products.find((p) => p.id === retItem.productId)!.costPrice,
              refType: 'WHOLESALE_RETURN',
              refId: wReturn.id,
              note: `Wholesale return ${wReturn.number}`,
              createdById: salesUser.id,
            },
          });
          await prisma.customerLedger.create({
            data: {
              branchId: HQ.id,
              customerId: customer.id,
              entryType: 'RETURN',
              refType: 'WholesaleReturn',
              refId: wReturn.id,
              description: `Return ${wReturn.number}`,
              debit: ZERO,
              credit: retTotal,
              entryDate: wReturn.returnDate,
              createdById: salesUser.id,
            },
          });
        }
      }
    });

    await run('POS sessions, sales, returns', async () => {
      const closedSessions: string[] = [];
      for (let i = 0; i < 8; i++) {
        const openedAt = daysAgo(randDaysAgo(90, 10));
        const session = await prisma.posSession.create({
          data: {
            branchId: HQ.id,
            warehouseId: hqStore.id,
            cashierId: cashier.id,
            openedAt,
            closedAt: addDays(openedAt, 0),
            openingFloat: D(5000),
            expectedCash: D(randInt(8000, 30000)),
            countedCash: D(randInt(8000, 30000)),
            cashVariance: D(randInt(-200, 200)),
            status: 'CLOSED',
            notes: 'Bulk-seeded closed session',
          },
        });
        closedSessions.push(session.id);
      }

      for (let i = 0; i < 25; i++) {
        const useCredit = Math.random() < 0.25;
        const customer = useCredit ? pick(retailCustomers.length ? retailCustomers : customers) : Math.random() < 0.5 ? pick(customers) : null;
        const items = pickN(sellables, randInt(1, 4));
        let subtotal = ZERO;
        const itemRows = items.map((p) => {
          const qty = D(randInt(1, 6));
          const lineTotal = qty.mul(p.sellPrice);
          subtotal = subtotal.plus(lineTotal);
          return { productId: p.id, unit: p.unit, quantity: qty, unitPrice: p.sellPrice, lineTotal, returnedQty: ZERO };
        });
        const discount = Math.random() < 0.15 ? subtotal.mul(0.1) : ZERO;
        const grand = subtotal.minus(discount);
        const creditAmount = useCredit ? grand.mul(0.5) : ZERO;
        const paid = grand.minus(creditAmount);
        const sale = await prisma.posSale.create({
          data: {
            number: nextNo('POSS'),
            branchId: HQ.id,
            warehouseId: hqStore.id,
            sessionId: pick(closedSessions),
            customerId: customer?.id ?? null,
            cashierId: cashier.id,
            saleDate: daysAgo(randDaysAgo(85, 1)),
            currency: 'BDT',
            subtotal,
            discountTotal: discount,
            taxTotal: ZERO,
            grandTotal: grand,
            paidTotal: paid,
            changeDue: ZERO,
            creditAmount,
            status: 'COMPLETED',
            notes: 'Bulk-seeded demo POS sale',
            items: { create: itemRows },
            payments: {
              create: paid.gt(0) ? [{ method: pick(['CASH', 'CARD', 'MOBILE_BANKING'] as const), amount: paid }] : [],
            },
          },
          include: { items: true },
        });
        store.posSales.push({ id: sale.id, number: sale.number });

        for (const it of sale.items) {
          await prisma.inventoryLedger.create({
            data: {
              branchId: HQ.id,
              warehouseId: hqStore.id,
              productId: it.productId,
              direction: 'OUT',
              quantity: it.quantity,
              costPerUnit: products.find((p) => p.id === it.productId)!.costPrice,
              refType: 'POS_SALE',
              refId: sale.id,
              note: `POS sale ${sale.number}`,
              createdById: cashier.id,
            },
          });
        }
        if (customer && creditAmount.gt(0)) {
          await prisma.customerLedger.create({
            data: {
              branchId: HQ.id,
              customerId: customer.id,
              entryType: 'INVOICE',
              refType: 'PosSale',
              refId: sale.id,
              description: `POS credit sale ${sale.number}`,
              debit: creditAmount,
              credit: ZERO,
              entryDate: sale.saleDate,
              createdById: cashier.id,
            },
          });
        }

        if (i < 8) {
          const retItem = sale.items[0]!;
          const retQty = retItem.quantity.mul(0.5).toDP(4, Prisma.Decimal.ROUND_DOWN);
          const finalRetQty = retQty.gt(0) ? retQty : D(1);
          const retTotal = finalRetQty.mul(retItem.unitPrice);
          const posReturn = await prisma.posReturn.create({
            data: {
              number: nextNo('POSR'),
              branchId: HQ.id,
              warehouseId: hqStore.id,
              saleId: sale.id,
              sessionId: sale.sessionId,
              returnDate: addDays(sale.saleDate, randInt(1, 10)),
              refundAmount: retTotal,
              refundMethod: pick(['CASH', 'CARD'] as const),
              status: 'COMPLETED',
              reason: 'Customer changed mind',
              createdById: cashier.id,
              items: {
                create: [
                  {
                    saleItemId: retItem.id,
                    productId: retItem.productId,
                    quantity: finalRetQty,
                    unitPrice: retItem.unitPrice,
                    lineTotal: retTotal,
                  },
                ],
              },
            },
          });
          await prisma.inventoryLedger.create({
            data: {
              branchId: HQ.id,
              warehouseId: hqStore.id,
              productId: retItem.productId,
              direction: 'IN',
              quantity: finalRetQty,
              costPerUnit: products.find((p) => p.id === retItem.productId)!.costPrice,
              refType: 'POS_RETURN',
              refId: posReturn.id,
              note: `POS return ${posReturn.number}`,
              createdById: cashier.id,
            },
          });
        }
      }
    });

    await run('E-commerce channels, orders, fulfillment, payments, returns', async () => {
      const channelDefs = [
        { code: 'DARAZ', name: 'Daraz Storefront', type: 'DARAZ' as const },
        { code: 'FB', name: 'Facebook Shop', type: 'FACEBOOK' as const },
        { code: 'SHOPIFY', name: 'Shopify Store', type: 'SHOPIFY' as const },
      ];
      const channels = [];
      for (const c of channelDefs) {
        const channel = await prisma.ecommerceChannel.create({
          data: {
            branchId: HQ.id,
            code: c.code,
            name: c.name,
            type: c.type,
            storeUrl: `https://${c.code.toLowerCase()}.example.com/annex-leather`,
            isActive: true,
            lastSyncAt: daysAgo(1),
          },
        });
        channels.push(channel);
      }

      const ORDER_STATUSES = ['SYNCED', 'PACKING', 'PACKED', 'SHIPPED', 'SHIPPED', 'DELIVERED', 'DELIVERED', 'DELIVERED',
        'CANCELLED', 'PARTIALLY_RETURNED', 'RETURNED', 'DELIVERED', 'SHIPPED', 'PACKED', 'SYNCED'] as const;
      let fulfillCount = 0;
      let paymentCount = 0;
      let returnCount = 0;
      for (let i = 0; i < 15; i++) {
        const status = ORDER_STATUSES[i]!;
        const channel = pick(channels);
        const customer = Math.random() < 0.5 ? pick(customers) : null;
        const items = pickN(sellables, randInt(1, 3));
        let subtotal = ZERO;
        const itemRows = items.map((p) => {
          const qty = D(randInt(1, 5));
          const lineTotal = qty.mul(p.sellPrice);
          subtotal = subtotal.plus(lineTotal);
          return {
            productId: p.id,
            sku: p.sku,
            name: p.name,
            unit: p.unit,
            quantity: qty,
            packedQty: ZERO,
            fulfilledQty: ZERO,
            returnedQty: ZERO,
            unitPrice: p.sellPrice,
            lineTotal,
          };
        });
        const shippingTotal = D(randInt(60, 200));
        const grand = subtotal.plus(shippingTotal);
        const order = await prisma.ecommerceOrder.create({
          data: {
            channelId: channel.id,
            branchId: HQ.id,
            warehouseId: hqMain.id,
            customerId: customer?.id ?? null,
            externalId: `EXT-${channel.code}-${randInt(100000, 999999)}`,
            number: nextNo('ECOM'),
            orderDate: daysAgo(randDaysAgo(75, 1)),
            status,
            paymentStatus: status === 'CANCELLED' ? 'PENDING' : status === 'RETURNED' ? 'REFUNDED' : pick(['PENDING', 'PAID', 'PAID', 'RECONCILED'] as const),
            currency: 'BDT',
            subtotal,
            shippingTotal,
            grandTotal: grand,
            paidTotal: status === 'CANCELLED' ? ZERO : grand,
            customerName: customer?.name ?? 'Online Customer',
            customerPhone: customer?.phone ?? `+8801${randInt(700000000, 799999999)}`,
            shipToAddress: customer?.address ?? 'Dhaka, Bangladesh',
            courier: pick(['Pathao', 'RedX', 'Steadfast', 'Sundarban']),
            trackingNo: status === 'SHIPPED' || status === 'DELIVERED' ? `TRK-${randInt(100000, 999999)}` : null,
            notes: 'Bulk-seeded demo ecommerce order',
            createdById: salesUser.id,
            items: { create: itemRows },
          },
          include: { items: true },
        });

        if (status === 'CANCELLED' || status === 'SYNCED') continue;

        const fulfillment = await prisma.ecommerceFulfillment.create({
          data: {
            orderId: order.id,
            branchId: HQ.id,
            warehouseId: hqMain.id,
            status: status === 'PACKING' ? 'PACKED' : status === 'PACKED' ? 'PACKED' : status === 'SHIPPED' ? 'SHIPPED' : 'DELIVERED',
            packedAt: daysAgo(randDaysAgo(60, 5)),
            shippedAt: status !== 'PACKING' && status !== 'PACKED' ? daysAgo(randDaysAgo(50, 3)) : null,
            deliveredAt: status === 'DELIVERED' || status === 'PARTIALLY_RETURNED' || status === 'RETURNED' ? daysAgo(randDaysAgo(40, 1)) : null,
            courier: order.courier,
            trackingNo: order.trackingNo,
            createdById: storeUser.id,
            items: {
              create: order.items.map((it) => ({ orderItemId: it.id, productId: it.productId, quantity: it.quantity })),
            },
          },
          include: { items: true },
        });
        fulfillCount++;
        for (const it of fulfillment.items) {
          await prisma.inventoryLedger.create({
            data: {
              branchId: HQ.id,
              warehouseId: hqMain.id,
              productId: it.productId!,
              direction: 'OUT',
              quantity: it.quantity,
              costPerUnit: products.find((p) => p.id === it.productId)!.costPrice,
              refType: 'ECOMMERCE_FULFILLMENT',
              refId: fulfillment.id,
              note: `Ecommerce order ${order.number}`,
              createdById: storeUser.id,
            },
          });
        }

        if (order.paidTotal.gt(0)) {
          await prisma.ecommercePayment.create({
            data: {
              orderId: order.id,
              branchId: HQ.id,
              method: pick(['MOBILE_BANKING', 'CARD', 'CASH'] as const),
              provider: pick(['bKash', 'Nagad', 'SSLCommerz', null]),
              externalId: `PAY-${randInt(100000, 999999)}`,
              amount: order.paidTotal,
              fee: order.paidTotal.mul(0.015),
              receivedAt: daysAgo(randDaysAgo(60, 2)),
              status: order.paymentStatus,
              createdById: salesUser.id,
            },
          });
          paymentCount++;
        }

        if (status === 'PARTIALLY_RETURNED' || status === 'RETURNED') {
          const retItem = order.items[0]!;
          const retQty = status === 'RETURNED' ? retItem.quantity : retItem.quantity.mul(0.5);
          const retTotal = retQty.mul(retItem.unitPrice);
          const ret = await prisma.ecommerceReturn.create({
            data: {
              orderId: order.id,
              branchId: HQ.id,
              status: 'REFUNDED',
              refundAmount: retTotal,
              refundMethod: 'MOBILE_BANKING',
              reason: 'Customer requested return',
              receivedAt: daysAgo(randDaysAgo(30, 1)),
              createdById: salesUser.id,
              items: {
                create: [{ orderItemId: retItem.id, productId: retItem.productId, quantity: retQty, lineTotal: retTotal }],
              },
            },
          });
          returnCount++;
          await prisma.inventoryLedger.create({
            data: {
              branchId: HQ.id,
              warehouseId: hqMain.id,
              productId: retItem.productId!,
              direction: 'IN',
              quantity: retQty,
              costPerUnit: products.find((p) => p.id === retItem.productId)!.costPrice,
              refType: 'ECOMMERCE_RETURN',
              refId: ret.id,
              note: `Ecommerce return for ${order.number}`,
              createdById: storeUser.id,
            },
          });
        }
      }

      for (const channel of channels) {
        await prisma.ecommerceReconciliationRun.create({
          data: {
            branchId: HQ.id,
            channelId: channel.id,
            periodStart: daysAgo(30),
            periodEnd: daysAgo(1),
            status: 'COMPLETED',
            matchedCount: randInt(5, 20),
            unmatchedCount: randInt(0, 3),
            totalSettled: D(randInt(20000, 150000)),
            notes: 'Bulk-seeded reconciliation run',
            createdById: accountant.id,
          },
        });
      }
      console.log(`    3 channels, 15 orders, ${fulfillCount} fulfillments, ${paymentCount} payments, ${returnCount} returns`);
    });

    await run('CRM customer interactions', async () => {
      const rows: Prisma.CustomerInteractionCreateManyInput[] = [];
      for (let i = 0; i < 35; i++) {
        const customer = pick(customers);
        const type = pick(['CALL', 'EMAIL', 'MEETING', 'NOTE', 'COMPLAINT', 'FOLLOW_UP', 'OTHER'] as const);
        const createdAt = daysAgo(randDaysAgo(120, 1));
        rows.push({
          customerId: customer.id,
          type,
          subject: pick([
            'Discussed upcoming bulk order',
            'Followed up on overdue payment',
            'Customer requested new catalog',
            'Complaint about delayed delivery',
            'Quarterly relationship review',
            'Interested in export pricing',
            'Requested sample leather swatches',
          ]),
          body: 'Bulk-seeded CRM interaction note for QA testing.',
          followUpAt: type === 'FOLLOW_UP' ? addDays(createdAt, randInt(3, 14)) : null,
          completedAt: Math.random() < 0.5 ? addDays(createdAt, randInt(1, 5)) : null,
          createdById: pick([salesUser, cashier, branchAdmin]).id,
          createdAt,
        });
      }
      await prisma.customerInteraction.createMany({ data: rows });
    });
  }

  async function runAccounts() {
    await run('Journal entries', async () => {
      const memoTemplates: Array<{ memo: string; debit: string; credit: string; min: number; max: number }> = [
        { memo: 'Office rent payment', debit: '5320', credit: '1110', min: 25000, max: 45000 },
        { memo: 'Electricity & utility bill', debit: '5330', credit: '1120', min: 8000, max: 20000 },
        { memo: 'Depreciation for the month', debit: '5340', credit: '1220', min: 5000, max: 30000 },
        { memo: 'Bank charges', debit: '5375', credit: '1120', min: 300, max: 2500 },
        { memo: 'Marketing & advertising spend', debit: '5395', credit: '1120', min: 5000, max: 25000 },
        { memo: 'IT & software subscriptions', debit: '5396', credit: '1120', min: 3000, max: 12000 },
        { memo: 'Fuel & vehicle running cost', debit: '5397', credit: '1110', min: 2000, max: 10000 },
        { memo: 'Employee welfare expense', debit: '5398', credit: '1110', min: 1500, max: 8000 },
        { memo: 'Phone & internet bill', debit: '5399', credit: '1120', min: 2000, max: 6000 },
        { memo: 'Legal & professional fees', debit: '5380', credit: '1120', min: 10000, max: 40000 },
        { memo: 'Printing & stationery purchase', debit: '5385', credit: '1110', min: 1000, max: 5000 },
        { memo: 'Travel & conveyance reimbursement', debit: '5390', credit: '1110', min: 1500, max: 9000 },
        { memo: 'Freight & carriage outward', debit: '5365', credit: '1110', min: 2000, max: 12000 },
        { memo: 'Insurance premium', debit: '5370', credit: '1120', min: 8000, max: 30000 },
        { memo: 'Salary accrual', debit: '5310', credit: '2110', min: 200000, max: 400000 },
        { memo: 'Provident fund contribution', debit: '5310', credit: '2400', min: 10000, max: 30000 },
        { memo: 'VAT payment to authority', debit: '2200', credit: '1120', min: 15000, max: 60000 },
        { memo: 'Cash deposit into bank', debit: '1120', credit: '1110', min: 20000, max: 100000 },
        { memo: 'Owner capital injection', debit: '1120', credit: '3100', min: 100000, max: 500000 },
        { memo: 'FX gain on export receipt', debit: '1120', credit: '4200', min: 5000, max: 25000 },
        { memo: 'FX loss on import payment', debit: '5400', credit: '1120', min: 3000, max: 15000 },
        { memo: 'Bad debt write-off', debit: '5160', credit: '1130', min: 5000, max: 20000 },
        { memo: 'Repairs & maintenance expense', debit: '5350', credit: '1110', min: 3000, max: 18000 },
        { memo: 'Import duty & customs expense', debit: '5250', credit: '1120', min: 15000, max: 80000 },
        { memo: 'Rounding adjustment', debit: '4900', credit: '1110', min: 5, max: 50 },
      ];
      let seq = 0;
      for (const t of memoTemplates) {
        seq++;
        const branch = pick(branches);
        const period = openPeriod(branch.id);
        const amount = D(randInt(t.min, t.max));
        const status = seq % 12 === 0 ? 'VOIDED' : seq % 9 === 0 ? 'DRAFT' : 'POSTED';
        const date = daysAgo(randDaysAgo(110, 3));
        await prisma.journalEntry.create({
          data: {
            number: nextNo('JE'),
            branchId: branch.id,
            periodId: period.id,
            date,
            memo: t.memo,
            reference: `MANUAL-${randInt(1000, 9999)}`,
            status,
            sourceModule: 'manual',
            totalDebit: amount,
            totalCredit: amount,
            createdById: accountant.id,
            postedById: status === 'POSTED' ? accountant.id : null,
            postedAt: status === 'POSTED' ? date : null,
            voidedById: status === 'VOIDED' ? admin.id : null,
            voidedAt: status === 'VOIDED' ? addDays(date, 1) : null,
            lines: {
              create: [
                { lineNo: 1, accountId: acc(t.debit).id, debit: amount, credit: ZERO, currency: 'BDT', fxRate: 1 },
                { lineNo: 2, accountId: acc(t.credit).id, debit: ZERO, credit: amount, currency: 'BDT', fxRate: 1 },
              ],
            },
          },
        });
      }
    });

    await run('Cash transfers + cash entries', async () => {
      const branchPairs: Array<[typeof HQ, typeof HQ]> = [
        [HQ, DHAKA], [HQ, CTG], [HQ, FACTORY], [DHAKA, HQ], [CTG, HQ], [FACTORY, HQ], [HQ, INDIA], [INDIA, HQ],
      ];
      for (const [from, to] of branchPairs) {
        await prisma.cashTransfer.create({
          data: {
            number: nextNo('CTR'),
            fromBranchId: from.id,
            toBranchId: to.id,
            amount: D(randInt(10000, 150000)),
            transferDate: daysAgo(randDaysAgo(80, 2)),
            transferVia: pick(['Bank transfer', 'Cash courier', 'Mobile banking']),
            reference: `CTR-REF-${randInt(1000, 9999)}`,
            remarks: 'Bulk-seeded inter-branch cash transfer',
            status: pick(['PENDING', 'COMPLETED', 'COMPLETED', 'COMPLETED'] as const),
            createdById: accountant.id,
          },
        });
      }

      const categories = ['Sales Collection', 'Office Expense', 'Supplier Payment', 'Salary Advance', 'Utility Bill', 'Miscellaneous'];
      for (let i = 0; i < 30; i++) {
        const type = pick(['CASH_IN', 'CASH_OUT'] as const);
        const branch = pick(branches);
        const amount = D(randInt(500, 40000));
        const customer = Math.random() < 0.3 ? pick(customers) : null;
        await prisma.cashEntry.create({
          data: {
            number: nextNo('CE'),
            type,
            branchId: branch.id,
            date: daysAgo(randDaysAgo(90, 1)),
            amount,
            totalAmount: amount,
            contactId: customer?.id ?? null,
            contactName: customer?.name ?? pick(['Walk-in', 'Petty Cash', 'Office Vendor']),
            contactType: customer ? 'CUSTOMER' : 'OTHER',
            receiveMode: pick(['Cash', 'Bank', 'Mobile Banking']),
            category: pick(categories),
            reference: `CE-REF-${randInt(1000, 9999)}`,
            remarks: 'Bulk-seeded cash voucher',
            createdById: accountant.id,
          },
        });
      }
    });

    await run('Opening balance entries + historical closed period', async () => {
      for (const branch of branches) {
        const p = openPeriod(branch.id);
        await prisma.period.create({
          data: {
            branchId: branch.id,
            name: `FY2025-26 Prior`,
            startsAt: new Date(Date.UTC(p.startsAt.getUTCFullYear() - 1, p.startsAt.getUTCMonth(), 1)),
            endsAt: new Date(Date.UTC(p.startsAt.getUTCFullYear(), p.startsAt.getUTCMonth(), 0)),
            status: 'CLOSED',
          },
        });
      }

      const obAccounts = ['1110', '1120', '1130', '1141', '1142', '2100', '2110', '3100'];
      for (let i = 0; i < 10; i++) {
        const branch = pick(branches);
        const period = openPeriod(branch.id);
        const code = obAccounts[i % obAccounts.length]!;
        const account = acc(code);
        await prisma.openingBalanceEntry.create({
          data: {
            branchId: branch.id,
            periodId: period.id,
            accountId: account.id,
            date: period.startsAt,
            amount: D(randInt(10000, 300000)),
            normalSide: account.normalSide,
            reference: `OB-${branch.code}-${code}`,
            remarks: 'Bulk-seeded opening balance',
            sourceRefType: 'SEED',
            createdById: accountant.id,
          },
        });
      }
    });
  }

  async function runTrade() {
    await run('Trade orders, shipments, LC, payments', async () => {
      const indiaSupplier = suppliers.find((s) => s.code === 'SUP-003') ?? pick(suppliers);
      const exportCust = exportCustomers.length ? exportCustomers : customers;
      for (let i = 0; i < 8; i++) {
        const type = i % 2 === 0 ? 'EXPORT' : 'IMPORT';
        const customer = type === 'EXPORT' ? pick(exportCust) : null;
        const supplier = type === 'IMPORT' ? indiaSupplier : null;
        const items = pickN(products, randInt(1, 3));
        let totalValue = ZERO;
        const itemRows = items.map((p) => {
          const qty = D(randInt(50, 500));
          const price = D(randInt(10, 60));
          const lineTotal = qty.mul(price);
          totalValue = totalValue.plus(lineTotal);
          return { productId: p.id, description: p.name, hsCode: `41${randInt(10, 99)}.${randInt(10, 99)}`, quantity: qty, unit: 'PCS', unitPrice: price, lineTotal };
        });
        const status = pick(['DRAFT', 'CONFIRMED', 'IN_PRODUCTION', 'READY_TO_SHIP', 'SHIPPED', 'AT_CUSTOMS', 'DELIVERED', 'COMPLETED'] as const);
        const order = await prisma.tradeOrder.create({
          data: {
            number: nextNo('TRO'),
            branchId: HQ.id,
            type,
            status,
            customerId: customer?.id ?? null,
            supplierId: supplier?.id ?? null,
            contractRef: `CONTRACT-${randInt(1000, 9999)}`,
            currency: 'USD',
            totalValue,
            exchangeRate: D(118.5),
            localValue: totalValue.mul(118.5),
            portOfLoading: type === 'EXPORT' ? 'Chittagong Port' : 'Kolkata Port',
            portOfDischarge: type === 'EXPORT' ? 'Hamburg Port' : 'Chittagong Port',
            incoterms: pick(['FOB', 'CIF', 'EXW']),
            latestShipDate: addDays(new Date(), randInt(5, 40)),
            expectedArrival: addDays(new Date(), randInt(20, 60)),
            goodsDescription: 'Finished leather goods and raw hides',
            notes: 'Bulk-seeded demo trade order',
            createdById: purchaseUser.id,
            items: { create: itemRows },
          },
        });
        store.tradeOrders.push({ id: order.id, number: order.number });

        await prisma.tradeShipment.create({
          data: {
            tradeOrderId: order.id,
            status: pick(['PENDING', 'BOOKING_CONFIRMED', 'IN_TRANSIT', 'AT_PORT', 'CUSTOMS_CLEARANCE', 'DELIVERED'] as const),
            sequence: 1,
            carrierName: pick(['Maersk', 'MSC', 'CMA CGM']),
            vesselName: `MV ${pick(['Sagor', 'Padma', 'Meghna'])}`,
            voyageNumber: `V${randInt(100, 999)}`,
            blNumber: `BL-${randInt(100000, 999999)}`,
            blDate: daysAgo(randDaysAgo(60, 5)),
            bookingRef: `BK-${randInt(10000, 99999)}`,
            portOfLoading: order.portOfLoading,
            portOfDischarge: order.portOfDischarge,
            etd: addDays(new Date(), randInt(-30, 5)),
            eta: addDays(new Date(), randInt(5, 45)),
            containerNumbers: `MSKU${randInt(1000000, 9999999)}`,
            sealNumbers: `SL${randInt(10000, 99999)}`,
            grossWeight: D(randInt(500, 5000)),
            netWeight: D(randInt(400, 4500)),
            packages: randInt(10, 200),
            freightCost: D(randInt(500, 3000)),
            insuranceCost: D(randInt(100, 800)),
            notes: 'Bulk-seeded shipment',
            createdById: purchaseUser.id,
          },
        });

        if (i < 5) {
          const lc = await prisma.letterOfCredit.create({
            data: {
              number: nextNo('LC'),
              tradeOrderId: order.id,
              branchId: HQ.id,
              type: pick(['SIGHT', 'USANCE', 'TRANSFERABLE'] as const),
              status: pick(['DRAFT', 'ISSUED', 'ADVISED', 'CONFIRMED', 'ACTIVE', 'PARTIALLY_UTILIZED'] as const),
              paymentMode: pick(['AT_SIGHT', 'USANCE_60', 'USANCE_90'] as const),
              applicantName: type === 'IMPORT' ? 'DeshIT-BD SME ERP' : (customer?.name ?? 'Overseas Buyer'),
              beneficiaryName: type === 'IMPORT' ? (supplier?.name ?? 'Overseas Supplier') : 'DeshIT-BD SME ERP',
              issuingBank: pick(['Standard Chartered Bangladesh', 'HSBC Bangladesh', 'Sonali Bank']),
              issuingBankSwift: 'SCBLBDDX',
              advisingBank: 'City Bank',
              advisingBankSwift: 'CIBLBDDH',
              currency: 'USD',
              lcAmount: totalValue,
              tolerancePlus: D(5),
              toleranceMinus: D(5),
              utilizedAmount: totalValue.mul(0.3),
              availableAmount: totalValue.mul(0.7),
              issueDate: daysAgo(randDaysAgo(70, 20)),
              expiryDate: addDays(new Date(), randInt(30, 120)),
              expiryPlace: 'Dhaka',
              latestShipDate: addDays(new Date(), randInt(10, 50)),
              partialShipment: true,
              transhipmentAllowed: false,
              portOfLoading: order.portOfLoading,
              portOfDischarge: order.portOfDischarge,
              goodsDescription: order.goodsDescription,
              swiftMt700Ref: `MT700-${randInt(10000, 99999)}`,
              issuedById: accountant.id,
              createdById: accountant.id,
            },
          });

          if (Math.random() > 0.4) {
            await prisma.lCAmendment.create({
              data: {
                lcId: lc.id,
                amendmentNumber: 1,
                status: pick(['PENDING', 'APPROVED'] as const),
                newExpiryDate: addDays(lc.expiryDate, 30),
                reason: 'Extend shipment window at buyer request',
                requestedById: accountant.id,
                approvedById: branchAdmin.id,
                approvedAt: daysAgo(randDaysAgo(20, 2)),
                swiftMt707Ref: `MT707-${randInt(10000, 99999)}`,
              },
            });
          }

          await prisma.lCDrawdown.create({
            data: {
              lcId: lc.id,
              drawdownNumber: 1,
              status: pick(['DRAFT', 'DOCUMENTS_SUBMITTED', 'DOCUMENTS_ACCEPTED', 'PAYMENT_RECEIVED'] as const),
              presentationDate: daysAgo(randDaysAgo(40, 5)),
              documentsDueBy: addDays(new Date(), randInt(5, 20)),
              amount: totalValue.mul(0.5),
              commercialInvoiceRef: `CI-${randInt(1000, 9999)}`,
              blRef: `BL-${randInt(100000, 999999)}`,
              packingListRef: `PL-${randInt(1000, 9999)}`,
              certificateOfOrigin: true,
              inspectionCert: Math.random() > 0.5,
              paymentDueDate: addDays(new Date(), randInt(10, 40)),
              bankCharges: D(randInt(50, 400)),
              notes: 'Bulk-seeded drawdown',
              createdById: accountant.id,
            },
          });
        }

        await prisma.tradePayment.create({
          data: {
            number: nextNo('TPAY'),
            tradeOrderId: order.id,
            branchId: HQ.id,
            status: pick(['PENDING', 'PARTIALLY_PAID', 'PAID'] as const),
            currency: 'USD',
            amount: totalValue.mul(0.5),
            exchangeRate: D(118.5),
            localAmount: totalValue.mul(0.5).mul(118.5),
            bankName: 'Standard Chartered Bangladesh',
            bankReference: `TT-${randInt(100000, 999999)}`,
            swiftRef: `MT103-${randInt(10000, 99999)}`,
            paymentDate: daysAgo(randDaysAgo(50, 3)),
            valueDate: daysAgo(randDaysAgo(48, 3)),
            notes: 'Bulk-seeded trade payment',
            createdById: accountant.id,
          },
        });
      }
    });
  }

  async function runHr() {
    let shiftGeneral: { id: string } | null = null;
    let shiftFactory: { id: string } | null = null;

    await run('Shifts + attendance rules', async () => {
      shiftGeneral = await prisma.shift.create({
        data: {
          branchId: HQ.id,
          name: 'General Shift',
          code: 'GEN',
          shiftType: 'GENERAL',
          startTime: '09:00',
          endTime: '18:00',
          breakStart: '13:00',
          breakEnd: '14:00',
          lateGraceMinutes: 15,
          earlyExitGraceMinutes: 15,
          minPresentMinutes: 360,
          minHalfDayMinutes: 240,
          absentBelowMinutes: 60,
          overtimeAllowed: true,
          otStartsAfter: '18:00',
          minOtMinutes: 30,
          maxOtMinutesPerDay: 180,
          weeklyOffDays: ['FRIDAY'],
        },
      });
      shiftFactory = await prisma.shift.create({
        data: {
          branchId: FACTORY.id,
          name: 'Factory Day Shift',
          code: 'FAC-DAY',
          shiftType: 'FACTORY',
          startTime: '08:00',
          endTime: '17:00',
          breakStart: '12:30',
          breakEnd: '13:15',
          lateGraceMinutes: 10,
          earlyExitGraceMinutes: 10,
          minPresentMinutes: 400,
          minHalfDayMinutes: 240,
          absentBelowMinutes: 60,
          overtimeAllowed: true,
          otStartsAfter: '17:00',
          minOtMinutes: 30,
          maxOtMinutesPerDay: 240,
          weeklyOffDays: ['FRIDAY'],
        },
      });

      for (const emp of employees) {
        await prisma.employee.update({
          where: { id: emp.id },
          data: { shiftId: emp.department === 'Production' ? shiftFactory.id : shiftGeneral.id },
        });
      }

      await prisma.attendanceRule.create({
        data: { name: 'General Staff Rule', branchId: HQ.id, shiftId: shiftGeneral.id },
      });
      await prisma.attendanceRule.create({
        data: { name: 'Factory Floor Rule', branchId: FACTORY.id, shiftId: shiftFactory.id, requireHrApproval: true },
      });
    });

    await run('Attendance records (90 days x 10 employees)', async () => {
      const rows: Prisma.AttendanceRecordCreateManyInput[] = [];
      for (const emp of employees) {
        for (let d = 90; d >= 1; d--) {
          const date = dateOnly(daysAgo(d));
          const dow = date.getUTCDay(); // 0=Sun..6=Sat; Friday=5 is weekly off
          if (dow === 5) {
            rows.push({ employeeId: emp.id, date, status: 'WEEKEND', workingMinutes: 0 });
            continue;
          }
          const roll = Math.random();
          if (roll < 0.04) {
            rows.push({ employeeId: emp.id, date, status: 'ABSENT', workingMinutes: 0 });
          } else if (roll < 0.12) {
            const checkIn = new Date(date);
            checkIn.setUTCHours(9, randInt(20, 55), 0, 0);
            const checkOut = new Date(date);
            checkOut.setUTCHours(18, randInt(0, 30), 0, 0);
            rows.push({
              employeeId: emp.id,
              date,
              checkIn,
              checkOut,
              status: 'LATE',
              lateMinutes: randInt(20, 55),
              workingMinutes: randInt(420, 500),
              isLateEntry: true,
            });
          } else {
            const checkIn = new Date(date);
            checkIn.setUTCHours(8, randInt(45, 59), 0, 0);
            const checkOut = new Date(date);
            checkOut.setUTCHours(17, randInt(50, 59), 0, 0);
            const ot = Math.random() < 0.15 ? randInt(30, 120) : 0;
            rows.push({
              employeeId: emp.id,
              date,
              checkIn,
              checkOut,
              status: 'PRESENT',
              workingMinutes: randInt(480, 540),
              overtimeMinutes: ot,
            });
          }
        }
      }
      await prisma.attendanceRecord.createMany({ data: rows, skipDuplicates: true });
      console.log(`    ${rows.length} attendance records`);

      const exceptionRows: Prisma.AttendanceExceptionCreateManyInput[] = [];
      for (let i = 0; i < 8; i++) {
        const emp = pick(employees);
        exceptionRows.push({
          employeeId: emp.id,
          date: dateOnly(daysAgo(randDaysAgo(60, 3))),
          type: 'MISSING_PUNCH',
          missingType: pick(['MISSING_IN', 'MISSING_OUT', 'BOTH_MISSING'] as const),
          diffMinutes: randInt(10, 90),
          reason: 'Forgot to punch — device offline',
          status: pick(['PENDING', 'APPROVED', 'REJECTED'] as const),
        });
      }
      await prisma.attendanceException.createMany({ data: exceptionRows });
    });

    await run('Attendance adjustments + overtime + summary records', async () => {
      for (let i = 0; i < 8; i++) {
        const emp = pick(employees);
        await prisma.attendanceAdjustment.create({
          data: {
            adjustmentNumber: nextNo('ATJ'),
            branchId: HQ.id,
            employeeId: emp.id,
            attendanceDate: dateOnly(daysAgo(randDaysAgo(60, 3))),
            adjustmentType: pick(['MISSING_CHECK_IN', 'MISSING_CHECK_OUT', 'WRONG_PUNCH', 'MANUAL_ATTENDANCE'] as const),
            reason: 'Correction requested by employee',
            adjustedById: hrUser.id,
            adjustedAt: daysAgo(randDaysAgo(50, 2)),
            status: pick(['DRAFT', 'UPDATED'] as const),
            oldStatus: 'ABSENT',
            newStatus: 'PRESENT',
            newWorkingMinutes: 480,
          },
        });
      }

      for (let i = 0; i < 20; i++) {
        const emp = pick(employees);
        const otDate = dateOnly(daysAgo(randDaysAgo(85, 2)));
        const minutes = randInt(30, 180);
        await prisma.overtimeRecord.create({
          data: {
            otNumber: nextNo('OT'),
            branchId: HQ.id,
            employeeId: emp.id,
            shiftId: emp.department === 'Production' ? shiftFactory!.id : shiftGeneral!.id,
            otDate,
            otMonth: `${otDate.getUTCFullYear()}-${pad(otDate.getUTCMonth() + 1, 2)}`,
            otType: pick(['REGULAR', 'HOLIDAY', 'WEEKEND', 'PRODUCTION'] as const),
            source: 'ATTENDANCE_BASED',
            status: pick(['DRAFT', 'PENDING_MANAGER', 'PENDING_HR', 'APPROVED', 'POSTED_TO_PAYROLL'] as const),
            attendanceDate: otDate,
            totalWorkedMinutes: 480 + minutes,
            regularDutyMinutes: 480,
            extraWorkedMinutes: minutes,
            eligibleOtMinutes: minutes,
            approvedOtMinutes: minutes,
            otRateType: 'BASIC_SALARY_BASED',
            otRatePerHour: D(150),
            otAmount: D(minutes).div(60).mul(150),
            remarks: 'Bulk-seeded overtime record',
          },
        });
      }

      for (let m = 3; m >= 1; m--) {
        const monthDate = new Date();
        monthDate.setMonth(monthDate.getMonth() - m);
        const summaryMonth = `${monthDate.getFullYear()}-${pad(monthDate.getMonth() + 1, 2)}`;
        for (const emp of employees) {
          await prisma.attendanceSummaryRecord.create({
            data: {
              branchId: HQ.id,
              employeeId: emp.id,
              summaryMonth,
              totalCalendarDays: 30,
              weeklyOffDays: 4,
              holidayDays: 1,
              workingDays: 25,
              presentDays: 23,
              absentDays: 1,
              leaveDays: 1,
              halfDays: 0,
              lateDays: 2,
              earlyExitDays: 0,
              totalWorkedHours: D(184),
              totalOtHours: D(6),
              payableDays: D(25),
              status: 'PAYROLL_PROCESSED',
              payrollMonth: summaryMonth,
              isPayrollReady: true,
              isLocked: true,
              sentToPayroll: true,
              sentById: hrUser.id,
              sentAt: addDays(monthDate, 28),
              payrollProcessed: true,
              createdById: hrUser.id,
            },
          });
        }
      }
    });

    await run('Leave types, policies, requests, balances', async () => {
      const leaveTypeDefs = [
        { code: 'CL', name: 'Casual Leave', annualEntitlement: 10 },
        { code: 'SL', name: 'Sick Leave', annualEntitlement: 14 },
        { code: 'EL', name: 'Earned Leave', annualEntitlement: 20 },
        { code: 'ML', name: 'Maternity Leave', annualEntitlement: 112 },
        { code: 'PL', name: 'Paternity Leave', annualEntitlement: 7 },
        { code: 'UL', name: 'Unpaid Leave', annualEntitlement: 0 },
      ];
      for (const lt of leaveTypeDefs) {
        await prisma.leaveType.create({
          data: {
            code: lt.code,
            name: lt.name,
            status: 'ACTIVE',
            paidLeave: lt.code !== 'UL',
            annualEntitlement: D(lt.annualEntitlement),
            unit: 'FULL_DAY',
            approvalRequired: true,
          },
        });
      }

      const policyGeneral = await prisma.leavePolicy.create({
        data: {
          policyCode: 'POL-GEN',
          policyName: 'General Staff Leave Policy',
          branchId: HQ.id,
          effectiveFrom: openPeriod(HQ.id).startsAt,
          status: 'ACTIVE',
          description: 'Default leave policy for HQ staff',
        },
      });
      const policyFactory = await prisma.leavePolicy.create({
        data: {
          policyCode: 'POL-FAC',
          policyName: 'Factory Floor Leave Policy',
          branchId: FACTORY.id,
          effectiveFrom: openPeriod(FACTORY.id).startsAt,
          status: 'ACTIVE',
          description: 'Leave policy for production employees',
        },
      });
      for (const lt of leaveTypeDefs) {
        for (const policy of [policyGeneral, policyFactory]) {
          await prisma.leavePolicyRule.create({
            data: {
              policyId: policy.id,
              leaveType: lt.name,
              leaveCode: lt.code,
              paidLeave: lt.code !== 'UL',
              entitledDays: D(lt.annualEntitlement),
              accrualMethod: 'ANNUAL',
              status: 'ACTIVE',
            },
          });
        }
      }
      for (const emp of employees) {
        await prisma.employeeLeavePolicy.create({
          data: {
            employeeId: emp.id,
            policyId: emp.department === 'Production' ? policyFactory.id : policyGeneral.id,
            status: 'ACTIVE',
            createdById: hrUser.id,
          },
        });
      }

      const LEAVE_STATUSES = ['PENDING_MANAGER', 'PENDING_HR', 'APPROVED', 'APPROVED', 'APPROVED', 'REJECTED', 'CANCELLED'] as const;
      for (let i = 0; i < 20; i++) {
        const emp = pick(employees);
        const type = pick(leaveTypeDefs);
        const status = LEAVE_STATUSES[i % LEAVE_STATUSES.length]!;
        const from = daysAgo(randDaysAgo(90, 5));
        const days = randInt(1, 4);
        await prisma.leaveRequest.create({
          data: {
            leaveRequestNo: nextNo('LV'),
            employeeId: emp.id,
            type: type.name,
            fromDate: dateOnly(from),
            toDate: dateOnly(addDays(from, days - 1)),
            days: D(days),
            reason: pick(['Family emergency', 'Medical appointment', 'Personal travel', 'Rest and recovery', 'Festival with family']),
            status,
            managerStatus: status === 'REJECTED' ? 'REJECTED' : status === 'PENDING_MANAGER' ? 'PENDING' : 'APPROVED',
            managerId: hrUser.id,
            hrStatus: status === 'APPROVED' ? 'APPROVED' : status === 'REJECTED' ? 'REJECTED' : 'PENDING',
            hrId: hrUser.id,
            decidedById: status === 'APPROVED' || status === 'REJECTED' ? hrUser.id : null,
            decidedAt: status === 'APPROVED' || status === 'REJECTED' ? daysAgo(randDaysAgo(80, 2)) : null,
            createdById: emp.id,
          },
        });
      }

      for (let i = 0; i < 8; i++) {
        const emp = pick(employees);
        await prisma.leaveBalanceAdjustment.create({
          data: {
            adjustmentNo: nextNo('LBA'),
            employeeId: emp.id,
            leaveType: pick(leaveTypeDefs).name,
            leaveYear: new Date().getFullYear(),
            adjustmentType: pick(['CARRY_FORWARD', 'MANUAL_CORRECTION', 'ENCASHMENT']),
            days: D(randInt(1, 5)),
            reason: 'Year-end balance correction',
            effectiveDate: daysAgo(randDaysAgo(30, 1)),
            adjustedById: hrUser.id,
          },
        });
      }
    });

    await run('Salary components, structures, assignments', async () => {
      const componentDefs = [
        { code: 'BASIC', name: 'Basic Salary', category: 'EARNINGS', type: 'FIXED', calc: 'FIXED_AMOUNT' },
        { code: 'HRA', name: 'House Rent Allowance', category: 'EARNINGS', type: 'FIXED', calc: 'PERCENTAGE' },
        { code: 'TRANS', name: 'Transport Allowance', category: 'EARNINGS', type: 'FIXED', calc: 'FIXED_AMOUNT' },
        { code: 'MED', name: 'Medical Allowance', category: 'EARNINGS', type: 'FIXED', calc: 'FIXED_AMOUNT' },
        { code: 'OTHER_ALW', name: 'Other Allowance', category: 'EARNINGS', type: 'VARIABLE', calc: 'MANUAL_ENTRY' },
        { code: 'PF', name: 'Provident Fund', category: 'DEDUCTION', type: 'FIXED', calc: 'PERCENTAGE' },
        { code: 'TAX', name: 'Income Tax', category: 'DEDUCTION', type: 'VARIABLE', calc: 'MANUAL_ENTRY' },
        { code: 'LATE_DED', name: 'Late Deduction', category: 'DEDUCTION', type: 'VARIABLE', calc: 'MANUAL_ENTRY' },
      ] as const;
      const components = [];
      for (const c of componentDefs) {
        const comp = await prisma.salaryComponent.create({
          data: {
            name: c.name,
            code: c.code,
            category: c.category,
            type: c.type,
            calculationType: c.calc,
            value: c.calc === 'PERCENTAGE' ? D(c.code === 'HRA' ? 20 : 5) : c.calc === 'FIXED_AMOUNT' ? D(c.code === 'TRANS' ? 3000 : c.code === 'MED' ? 1500 : 0) : null,
            baseComponent: c.calc === 'PERCENTAGE' ? 'BASIC' : null,
            isTaxable: c.category === 'EARNINGS',
            status: 'ACTIVE',
          },
        });
        components.push(comp);
      }

      const structureDefs = ['Standard Staff Structure', 'Factory Worker Structure', 'Management Structure'];
      const structures = [];
      for (const name of structureDefs) {
        const structure = await prisma.salaryStructure.create({
          data: {
            name,
            code: name.split(' ').map((w) => w[0]).join('').toUpperCase() + '-STR',
            grossSalary: D(name === 'Management Structure' ? 80000 : name === 'Factory Worker Structure' ? 30000 : 40000),
            effectiveFrom: openPeriod(HQ.id).startsAt,
            payrollFrequency: 'MONTHLY',
            currency: 'BDT',
            components: {
              create: components.map((c) => ({ salaryComponentId: c.id, value: c.value ?? D(0), isAutoCalculated: c.calculationType === 'PERCENTAGE' })),
            },
          },
        });
        structures.push(structure);
      }
      for (const emp of employees) {
        const structure = emp.department === 'Production' ? structures[1] : emp.designation?.includes('Manager') ? structures[2] : structures[0];
        await prisma.employeeSalaryStructureAssignment.create({
          data: { employeeId: emp.id, salaryStructureId: structure!.id, effectiveFrom: openPeriod(HQ.id).startsAt },
        });
      }
    });

    await run('Payroll periods, runs, payslips', async () => {
      const now = new Date();
      const runs: Array<{ id: string; period: string }> = [];
      for (let m = 3; m >= 1; m--) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - m, 1);
        const month = monthDate.getMonth() + 1;
        const year = monthDate.getFullYear();
        const periodCode = `${year}-${pad(month, 2)}`;
        const start = new Date(Date.UTC(year, month - 1, 1));
        const end = new Date(Date.UTC(year, month, 0));
        const payrollPeriod = await prisma.payrollPeriod.create({
          data: {
            name: `Payroll ${periodCode}`,
            code: `PP-${periodCode}`,
            month,
            year,
            startDate: start,
            endDate: end,
            processingDate: addDays(end, 2),
            paymentDate: addDays(end, 5),
            status: 'CLOSED',
          },
        });

        let totalGross = ZERO;
        let totalDeduction = ZERO;
        let totalNet = ZERO;
        const run0 = await prisma.payrollRun.create({
          data: {
            branchId: HQ.id,
            period: periodCode,
            payrollPeriodId: payrollPeriod.id,
            status: 'PAID',
            totalEmployees: employees.length,
            totalGross: ZERO,
            totalDeduction: ZERO,
            totalNet: ZERO,
            hrApproval: 'APPROVED',
            financeApproval: 'APPROVED',
            managementApproval: 'APPROVED',
            createdById: hrUser.id,
            approvedById: branchAdmin.id,
            approvedAt: addDays(end, 3),
            paidById: accountant.id,
            paidAt: addDays(end, 5),
          },
        });
        runs.push({ id: run0.id, period: periodCode });
        store.payrollRuns.push({ id: run0.id, period: periodCode });

        for (const emp of employees) {
          const basic = emp.basicSalary;
          const gross = basic.plus(emp.houseAllowance).plus(emp.transportAllowance).plus(emp.medicalAllowance);
          const pf = basic.mul(0.05);
          const tax = gross.gt(30000) ? gross.mul(0.03) : ZERO;
          const net = gross.minus(pf).minus(tax);
          totalGross = totalGross.plus(gross);
          totalDeduction = totalDeduction.plus(pf).plus(tax);
          totalNet = totalNet.plus(net);
          await prisma.payslip.create({
            data: {
              no: nextNo('PS'),
              payrollRunId: run0.id,
              employeeId: emp.id,
              status: 'PUBLISHED',
              paymentStatus: 'PAID',
              paymentMethod: 'Bank Transfer',
              bankName: 'Standard Chartered',
              bankAccount: `ACC-${randInt(100000, 999999)}`,
              paymentDate: addDays(end, 5),
              transactionRef: `TXN-${randInt(100000, 999999)}`,
              workedDays: 25,
              leaveDays: 1,
              absentDays: 0,
              basic,
              houseAllowance: emp.houseAllowance,
              transportAllowance: emp.transportAllowance,
              medicalAllowance: emp.medicalAllowance,
              otherAllowance: emp.otherAllowance,
              providentFund: pf,
              taxDeduction: tax,
              gross,
              net,
            },
          });
        }
        await prisma.payrollRun.update({
          where: { id: run0.id },
          data: { totalGross, totalDeduction, totalNet },
        });
      }
    });

    await run('Bonuses + loans + payroll adjustments', async () => {
      const bonusDefs = [
        { name: 'Eid Festival Bonus', type: 'FESTIVAL' as const, amount: 15000 },
        { name: 'Annual Performance Bonus', type: 'PERFORMANCE' as const, amount: 8000 },
        { name: 'Production Incentive Bonus', type: 'PRODUCTION' as const, amount: 5000 },
      ];
      for (const b of bonusDefs) {
        const bonus = await prisma.bonus.create({
          data: {
            name: b.name,
            code: `BON-${b.type}`,
            bonusType: b.type,
            effectivePayrollMonth: `${new Date().getFullYear()}-${pad(new Date().getMonth(), 2)}`,
            calculationMethod: 'FIXED_AMOUNT',
            amount: D(b.amount),
            paymentMethod: 'PAYROLL',
            includeInPayslip: true,
            status: 'APPROVED',
            hrApprovalStatus: 'APPROVED',
            managementDecision: 'APPROVED',
          },
        });
        for (const emp of pickN(employees, randInt(3, 6))) {
          await prisma.employeeBonus.create({
            data: { bonusId: bonus.id, employeeId: emp.id, amount: D(b.amount), isPaid: true },
          });
        }
      }

      for (let i = 0; i < 6; i++) {
        const emp = pick(employees);
        const amount = D(randInt(10000, 60000));
        const installments = randInt(3, 12);
        const monthly = amount.div(installments).toDP(2);
        const status = pick(['SUBMITTED', 'APPROVED', 'DISBURSED', 'ACTIVE', 'COMPLETED'] as const);
        const loan = await prisma.loanRequest.create({
          data: {
            referenceNo: nextNo('LOAN'),
            requestType: pick(['EMPLOYEE_LOAN', 'SALARY_ADVANCE'] as const),
            employeeId: emp.id,
            loanAmount: amount,
            purpose: pick(['MEDICAL', 'EDUCATION', 'EMERGENCY', 'PERSONAL', 'FESTIVAL', 'HOUSE_RENT'] as const),
            disbursementDate: daysAgo(randDaysAgo(90, 10)),
            repaymentStartMonth: `${new Date().getFullYear()}-${pad(new Date().getMonth() + 1, 2)}`,
            installmentType: 'MONTHLY',
            numberOfInstallments: installments,
            monthlyDeduction: monthly,
            outstandingBalance: status === 'COMPLETED' ? ZERO : amount.minus(monthly),
            paidAmount: status === 'COMPLETED' ? amount : monthly,
            status,
            hrApprovalStatus: 'APPROVED',
            accountsVerification: 'VERIFIED',
          },
        });
        for (let m = 0; m < Math.min(installments, 3); m++) {
          await prisma.loanRepaymentSchedule.create({
            data: {
              loanRequestId: loan.id,
              payrollMonth: `${new Date().getFullYear()}-${pad(new Date().getMonth() + 1 - m, 2)}`,
              installment: monthly,
              remainingBalance: amount.minus(monthly.mul(m + 1)),
              status: m === 0 ? 'PENDING' : 'PAID',
            },
          });
        }
      }

      const payrollPeriods = await prisma.payrollPeriod.findMany();
      for (let i = 0; i < 6; i++) {
        const emp = pick(employees);
        const period = pick(payrollPeriods);
        await prisma.payrollAdjustment.create({
          data: {
            no: nextNo('PADJ'),
            payrollPeriodId: period.id,
            employeeId: emp.id,
            adjustmentDate: period.startDate,
            type: pick(['ALLOWANCE', 'DEDUCTION', 'BONUS_CORRECTION', 'ATTENDANCE_ADJUSTMENT'] as const),
            category: pick(['ONE_TIME', 'RECURRING'] as const),
            amount: D(randInt(500, 8000)),
            description: 'Bulk-seeded payroll adjustment',
            reason: pick(['ATTENDANCE_CORRECTION', 'MANUAL_BONUS', 'OT_CORRECTION', 'OTHER'] as const),
            status: pick(['SUBMITTED', 'APPROVED', 'APPLIED'] as const),
          },
        });
      }
    });

    await run('Promotions, increments, confirmations, transfers, resignations', async () => {
      for (let i = 0; i < 3; i++) {
        const emp = pick(employees);
        await prisma.employeePromotion.create({
          data: {
            promotionNumber: nextNo('PROM'),
            branchId: HQ.id,
            employeeId: emp.id,
            promotionType: pick(['REGULAR', 'UPGRADE', 'ACTING'] as const),
            status: pick(['APPROVED', 'COMPLETED'] as const),
            currentDesignation: emp.designation,
            currentSalary: emp.basicSalary,
            newDesignation: `Senior ${emp.designation ?? 'Staff'}`,
            newSalary: emp.basicSalary.mul(1.15),
            effectiveDate: daysAgo(randDaysAgo(60, 5)),
            reason: 'Strong performance over the last review cycle',
            managerApprovalStatus: 'APPROVED',
            hrApprovalStatus: 'APPROVED',
            approvedAt: daysAgo(randDaysAgo(50, 3)),
            completedAt: daysAgo(randDaysAgo(40, 1)),
            createdById: hrUser.id,
          },
        });
      }

      for (let i = 0; i < 4; i++) {
        const emp = pick(employees);
        const gross = emp.basicSalary.plus(emp.houseAllowance).plus(emp.transportAllowance);
        await prisma.employeeIncrement.create({
          data: {
            incrementNumber: nextNo('INCR'),
            branchId: HQ.id,
            employeeId: emp.id,
            incrementType: pick(['ANNUAL', 'PERFORMANCE', 'MERIT'] as const),
            status: pick(['APPROVED', 'APPLIED'] as const),
            incrementMethod: 'PERCENTAGE',
            currentBasicSalary: emp.basicSalary,
            currentGrossSalary: gross,
            incrementValue: D(10),
            newBasicSalary: emp.basicSalary.mul(1.1),
            newGrossSalary: gross.mul(1.1),
            effectiveDate: daysAgo(randDaysAgo(70, 10)),
            reason: 'Annual increment cycle',
            hrApprovalStatus: 'APPROVED',
            accountsApprovalStatus: 'APPROVED',
            managerApprovalStatus: 'APPROVED',
            approvedAt: daysAgo(randDaysAgo(60, 5)),
            appliedAt: daysAgo(randDaysAgo(50, 2)),
            createdById: hrUser.id,
          },
        });
      }

      for (let i = 0; i < 3; i++) {
        const emp = pick(employees);
        const gross = emp.basicSalary.plus(emp.houseAllowance);
        await prisma.employeeConfirmation.create({
          data: {
            confirmationNumber: nextNo('CNF'),
            branchId: HQ.id,
            employeeId: emp.id,
            confirmationType: 'PROBATION_TO_PERMANENT',
            status: 'CONFIRMED',
            currentBasicSalary: emp.basicSalary,
            currentGrossSalary: gross,
            probationEndDate: daysAgo(randDaysAgo(30, 5)),
            effectiveDate: daysAgo(randDaysAgo(25, 2)),
            salaryRevisionRequired: false,
            newBasicSalary: emp.basicSalary,
            newGrossSalary: gross,
            reason: 'Successful completion of probation period',
            managerReviewStatus: 'APPROVED',
            hrReviewStatus: 'APPROVED',
            accountsReviewStatus: 'APPROVED',
            confirmedAt: daysAgo(randDaysAgo(20, 1)),
            createdById: hrUser.id,
          },
        });
      }

      for (let i = 0; i < 3; i++) {
        const emp = pick(employees);
        await prisma.employeeTransfer.create({
          data: {
            transferNumber: nextNo('TRF-EMP'),
            branchId: HQ.id,
            employeeId: emp.id,
            transferType: pick(['DEPARTMENT', 'TEMPORARY'] as const),
            status: pick(['APPROVED', 'COMPLETED'] as const),
            currentDepartment: emp.department,
            newDepartment: pick(['Sales', 'Warehouse', 'Accounts']),
            effectiveDate: daysAgo(randDaysAgo(50, 5)),
            reason: 'Operational requirement',
            submittedAt: daysAgo(randDaysAgo(55, 8)),
            approvedAt: daysAgo(randDaysAgo(45, 3)),
            approvedById: branchAdmin.id,
            createdById: hrUser.id,
          },
        });
      }

      const resignEmployees = pickN(employees, 2);
      for (const emp of resignEmployees) {
        const lastWorking = daysAgo(randDaysAgo(30, 5));
        const resignation = await prisma.employeeResignation.create({
          data: {
            resignationNumber: nextNo('RSGN'),
            branchId: HQ.id,
            employeeId: emp.id,
            resignationType: 'VOLUNTARY',
            status: 'PENDING_EXIT_CLEARANCE',
            resignationDate: daysAgo(randDaysAgo(60, 30)),
            lastWorkingDate: lastWorking,
            noticeRequired: true,
            noticePeriodDays: 30,
            noticeServedDays: 30,
            reason: 'Pursuing another opportunity',
            employeeRemarks: 'Thank you for the opportunity to work here.',
            managerReviewStatus: 'APPROVED',
            hrReviewStatus: 'APPROVED',
            accountsReviewStatus: 'APPROVED',
            pendingSalary: D(15000),
            leaveEncashment: D(3000),
            bonus: D(0),
            overtime: D(500),
            loanDeduction: D(0),
            advanceDeduction: D(0),
            taxDeduction: D(0),
            gratuity: D(0),
            finalPayable: D(18500),
            settlementRequired: true,
            createdById: hrUser.id,
          },
        });

        const clearance = await prisma.employeeExitClearance.create({
          data: {
            clearanceNumber: nextNo('EXIT'),
            resignationId: resignation.id,
            branchId: HQ.id,
            employeeId: emp.id,
            exitType: 'RESIGNATION',
            status: 'PENDING_HR_APPROVAL',
            lastWorkingDate: lastWorking,
            reasonForExit: 'Voluntary resignation',
            noticePeriodServed: true,
            handoverCompleted: true,
            replacementAssigned: false,
            exitInterviewCompleted: true,
            departmentClearedAt: daysAgo(randDaysAgo(20, 5)),
            accountsApprovedAt: daysAgo(randDaysAgo(15, 3)),
            createdById: hrUser.id,
            departments: {
              create: [
                { departmentKey: 'IT', departmentName: 'IT / Systems', status: 'APPROVED', approvedAt: daysAgo(18) },
                { departmentKey: 'FINANCE', departmentName: 'Finance', status: 'APPROVED', approvedAt: daysAgo(15) },
              ],
            },
            assets: {
              create: [
                { assetKey: 'ID_CARD', assetName: 'Employee ID Card', returned: true, condition: 'GOOD' },
                { assetKey: 'LAPTOP', assetName: 'Company Laptop', returned: true, condition: 'GOOD' },
              ],
            },
            systemAccess: {
              create: { erpAccountDisabled: true, emailDisabled: true, attendanceDeviceDisabled: true },
            },
            settlement: {
              create: {
                status: 'APPROVED',
                pendingSalary: D(15000),
                leaveEncashment: D(3000),
                overtime: D(500),
                netPayable: D(18500),
                approvedById: accountant.id,
                approvedAt: daysAgo(10),
              },
            },
            interview: {
              create: {
                reasonForLeaving: 'Career growth opportunity elsewhere',
                companyRating: 4,
                managerRating: 4,
                suggestions: 'More cross-department collaboration opportunities',
                rehireEligible: true,
                interviewConductedBy: hrUser.name,
              },
            },
          },
        });

        await prisma.finalSettlement.create({
          data: {
            no: nextNo('FS'),
            employeeId: emp.id,
            resignationId: resignation.id,
            separationType: 'RESIGNATION',
            lastWorkingDate: lastWorking,
            reason: 'Voluntary resignation',
            pendingSalary: D(15000),
            leaveEncashment: D(3000),
            overtimeAmount: D(500),
            totalEarnings: D(18500),
            totalDeductions: D(0),
            netSettlement: D(18500),
            status: 'APPROVED',
            hrApproval: 'APPROVED',
            financeApproval: 'APPROVED',
            managementApproval: 'APPROVED',
          },
        });
        void clearance;
      }

      for (const emp of employees) {
        await prisma.employeeSalaryHistory.create({
          data: {
            branchId: HQ.id,
            employeeId: emp.id,
            sourceType: 'INCREMENT',
            effectiveDate: daysAgo(randDaysAgo(70, 10)),
            oldBasicSalary: emp.basicSalary.mul(0.9),
            newBasicSalary: emp.basicSalary,
            oldGrossSalary: emp.basicSalary.mul(0.9).plus(emp.houseAllowance),
            newGrossSalary: emp.basicSalary.plus(emp.houseAllowance),
            remarks: 'Historical salary revision record',
          },
        });
      }
    });
  }

  async function runAssets() {
    await run('Assets + movements', async () => {
      const categories = await prisma.assetCategory.findMany();
      const catByName = Object.fromEntries(categories.map((c) => [c.name, c]));
      const assetDefs = [
        { cat: 'Office Equipment', name: 'Air Conditioner', cost: 65000 },
        { cat: 'Office Equipment', name: 'Photocopier', cost: 120000 },
        { cat: 'Vehicles', name: 'Delivery Van', cost: 1800000 },
        { cat: 'Vehicles', name: 'Pickup Truck', cost: 2200000 },
        { cat: 'Machinery', name: 'Industrial Sewing Machine', cost: 45000 },
        { cat: 'Machinery', name: 'Leather Splitting Machine', cost: 85000 },
        { cat: 'Machinery', name: 'Skiving Machine', cost: 60000 },
        { cat: 'Furniture', name: 'Office Desk Set', cost: 25000 },
        { cat: 'Furniture', name: 'Conference Table', cost: 40000 },
        { cat: 'Computers & IT', name: 'Desktop Computer', cost: 55000 },
        { cat: 'Computers & IT', name: 'Laptop', cost: 75000 },
        { cat: 'Computers & IT', name: 'Network Server', cost: 250000 },
        { cat: 'Building', name: 'Warehouse Extension', cost: 5000000 },
        { cat: 'Land', name: 'Factory Plot', cost: 15000000 },
      ];
      let idx = 0;
      for (const def of assetDefs) {
        for (let copy = 0; copy < (def.cat === 'Land' || def.cat === 'Building' ? 1 : 2); copy++) {
          idx++;
          const category = catByName[def.cat];
          const branch = pick(branches);
          const purchaseDate = daysAgo(randDaysAgo(700, 60));
          const status = pick(['IN_USE', 'IN_USE', 'IN_USE', 'IN_STORAGE', 'UNDER_MAINTENANCE', 'DISPOSED'] as const);
          const asset = await prisma.asset.create({
            data: {
              branchId: branch.id,
              categoryId: category?.id,
              code: `AST-${pad(idx, 4)}`,
              name: `${def.name} ${copy > 0 ? copy + 1 : ''}`.trim(),
              description: `Bulk-seeded ${def.name.toLowerCase()}`,
              serialNumber: `SN-${randInt(100000, 999999)}`,
              location: `${branch.name} — ${pick(['Ground Floor', '1st Floor', 'Store Room', 'Yard'])}`,
              assignedTo: pick(employees).firstName,
              condition: pick(['NEW', 'GOOD', 'GOOD', 'FAIR'] as const),
              status,
              purchaseDate,
              purchaseCost: D(def.cost),
              salvageValue: D(def.cost * 0.1),
              usefulLifeMonths: category?.defaultLifeMonths ?? 60,
              depreciationMethod: category?.depreciationMethod ?? 'STRAIGHT_LINE',
              accumulatedDepreciation: D(def.cost * 0.15),
              lastDepreciatedAt: daysAgo(30),
              disposedAt: status === 'DISPOSED' ? daysAgo(randDaysAgo(20, 2)) : null,
              disposalValue: status === 'DISPOSED' ? D(def.cost * 0.2) : null,
              disposalReason: status === 'DISPOSED' ? 'End of useful life' : null,
              notes: 'Bulk-seeded QA asset',
              createdById: accountant.id,
            },
          });
          store.assets.push({ id: asset.id, code: asset.code });

          await prisma.assetMovement.create({
            data: {
              assetId: asset.id,
              branchId: branch.id,
              type: 'REGISTRATION',
              toLocation: asset.location,
              toAssignee: asset.assignedTo,
              amount: asset.purchaseCost,
              note: 'Initial registration',
              createdById: accountant.id,
            },
          });
          await prisma.assetMovement.create({
            data: {
              assetId: asset.id,
              branchId: branch.id,
              type: 'DEPRECIATION',
              amount: D(def.cost * 0.15),
              note: 'Periodic depreciation posting',
              createdById: accountant.id,
            },
          });
          if (Math.random() > 0.6) {
            await prisma.assetMovement.create({
              data: {
                assetId: asset.id,
                branchId: branch.id,
                type: 'MAINTENANCE',
                amount: D(randInt(1000, 15000)),
                note: 'Routine maintenance service',
                createdById: storeUser.id,
              },
            });
          }
          if (status === 'DISPOSED') {
            await prisma.assetMovement.create({
              data: {
                assetId: asset.id,
                branchId: branch.id,
                type: 'DISPOSAL',
                fromLocation: asset.location,
                amount: asset.disposalValue,
                note: 'Asset disposed at end of life',
                createdById: branchAdmin.id,
              },
            });
          }
        }
      }
      console.log(`    ${store.assets.length} assets`);
    });
  }

  async function runDocumentsAndApprovals() {
    await run('Documents + document links', async () => {
      const targets: Array<{ entityType: string; entityId: string; label: string }> = [];
      for (const po of pickN(store.purchaseOrders, Math.min(6, store.purchaseOrders.length))) {
        targets.push({ entityType: 'PurchaseOrder', entityId: po.id, label: po.number });
      }
      for (const inv of pickN(store.purchaseInvoices, Math.min(5, store.purchaseInvoices.length))) {
        targets.push({ entityType: 'PurchaseInvoice', entityId: inv.id, label: inv.number });
      }
      for (const s of pickN(suppliers, Math.min(5, suppliers.length))) {
        targets.push({ entityType: 'Supplier', entityId: s.id, label: s.name });
      }
      for (const e of pickN(employees, Math.min(6, employees.length))) {
        targets.push({ entityType: 'Employee', entityId: e.id, label: `${e.firstName} ${e.lastName}` });
      }
      for (const a of pickN(store.assets, Math.min(5, store.assets.length))) {
        targets.push({ entityType: 'Asset', entityId: a.id, label: a.code });
      }
      for (const t of pickN(store.tradeOrders, Math.min(4, store.tradeOrders.length))) {
        targets.push({ entityType: 'TradeOrder', entityId: t.id, label: t.number });
      }

      const docTypes = [
        { cat: 'Contract', mime: 'application/pdf', ext: 'pdf' },
        { cat: 'Invoice', mime: 'application/pdf', ext: 'pdf' },
        { cat: 'ID Document', mime: 'image/jpeg', ext: 'jpg' },
        { cat: 'Certificate', mime: 'application/pdf', ext: 'pdf' },
        { cat: 'Photo', mime: 'image/jpeg', ext: 'jpg' },
      ];
      let created = 0;
      for (const target of targets.slice(0, 22)) {
        const dt = pick(docTypes);
        const doc = await prisma.document.create({
          data: {
            branchId: HQ.id,
            fileName: `seed-${created + 1}-${dt.cat.toLowerCase().replace(/\s+/g, '-')}.${dt.ext}`,
            originalName: `${target.label}-${dt.cat}.${dt.ext}`,
            mimeType: dt.mime,
            size: randInt(20000, 900000),
            storagePath: `/uploads/seed/${dt.cat.toLowerCase().replace(/\s+/g, '-')}-${created + 1}.${dt.ext}`,
            category: dt.cat,
            tags: {
              create: [dt.cat.toLowerCase(), target.entityType.toLowerCase()].map((tag) => ({ tag })),
            },
            expiresAt: dt.cat === 'Certificate' ? addDays(new Date(), randInt(30, 365)) : null,
            uploadedById: pick(allUsers).id,
            notes: 'Bulk-seeded document for QA',
            links: { create: [{ entityType: target.entityType, entityId: target.entityId, note: `Attached to ${target.label}` }] },
          },
        });
        created++;
        void doc;
      }
      console.log(`    ${created} documents linked`);
    });

    await run('Approval requests', async () => {
      const ruleByModuleAction = (module: string, action: string) => approvalRules.find((r) => r.module === module && r.action === action);

      const requestDefs: Array<{
        module: string;
        action: string;
        entityType: string;
        entityId: string;
        title: string;
        summary: string;
        amount: number;
        branchId: string;
        status: 'PENDING' | 'APPROVED' | 'REJECTED';
      }> = [];

      for (const po of pickN(store.purchaseOrders, Math.min(5, store.purchaseOrders.length))) {
        requestDefs.push({
          module: 'purchase', action: 'approve', entityType: 'PurchaseOrder', entityId: po.id,
          title: `PO ${po.number} awaiting approval`, summary: `Purchase order totaling ${po.grandTotal.toFixed(2)} BDT`,
          amount: po.grandTotal.toNumber(), branchId: po.branchId, status: pick(['PENDING', 'APPROVED', 'REJECTED']),
        });
      }
      for (const inv of pickN(store.purchaseInvoices, Math.min(3, store.purchaseInvoices.length))) {
        requestDefs.push({
          module: 'purchase', action: 'invoice-approve', entityType: 'PurchaseInvoice', entityId: inv.id,
          title: `Invoice ${inv.number} above threshold`, summary: 'Invoice amount requires accounts sign-off',
          amount: inv.grandTotal.toNumber(), branchId: HQ.id, status: pick(['PENDING', 'APPROVED']),
        });
      }
      for (const sale of pickN(store.posSales, Math.min(3, store.posSales.length))) {
        requestDefs.push({
          module: 'pos', action: 'discount-override', entityType: 'PosSale', entityId: sale.id,
          title: `High discount — ${sale.number}`, summary: 'Discount above standard threshold requested at checkout',
          amount: randInt(5000, 20000), branchId: HQ.id, status: pick(['PENDING', 'APPROVED', 'REJECTED']),
        });
      }
      for (const inv of pickN(store.wholesaleInvoices, Math.min(2, store.wholesaleInvoices.length))) {
        requestDefs.push({
          module: 'wholesale', action: 'discount-override', entityType: 'WholesaleInvoice', entityId: inv.id,
          title: `Wholesale discount override — ${inv.number}`, summary: 'Bulk discount requires manager approval',
          amount: randInt(10000, 50000), branchId: HQ.id, status: 'PENDING',
        });
      }
      for (const asset of pickN(store.assets, Math.min(2, store.assets.length))) {
        requestDefs.push({
          module: 'assets', action: 'dispose', entityType: 'Asset', entityId: asset.id,
          title: `Dispose asset ${asset.code}`, summary: 'Asset has reached end of useful life',
          amount: randInt(20000, 80000), branchId: HQ.id, status: pick(['PENDING', 'APPROVED']),
        });
      }
      for (const order of pickN(store.corporateOrders, Math.min(2, store.corporateOrders.length))) {
        requestDefs.push({
          module: 'corporate-sales', action: 'discount-override', entityType: 'CorporateOrder', entityId: order.id,
          title: `Corporate discount — ${order.number}`, summary: 'Bulk corporate order requesting extra discount',
          amount: randInt(100000, 500000), branchId: HQ.id, status: pick(['PENDING', 'REJECTED']),
        });
      }
      if (store.payrollRuns.length > 0) {
        const run0 = pick(store.payrollRuns);
        requestDefs.push({
          module: 'hr', action: 'approve-payroll', entityType: 'PayrollRun', entityId: run0.id,
          title: `Payroll run ${run0.period} approval`, summary: 'Monthly payroll ready for management approval',
          amount: randInt(300000, 900000), branchId: HQ.id, status: 'APPROVED',
        });
      }

      let created = 0;
      for (const d of requestDefs) {
        const rule = ruleByModuleAction(d.module, d.action);
        const req = await prisma.approvalRequest.create({
          data: {
            ruleId: rule?.id ?? null,
            module: d.module,
            action: d.action,
            entityType: d.entityType,
            entityId: d.entityId,
            title: d.title,
            summary: d.summary,
            amount: D(d.amount),
            currency: 'BDT',
            branchId: d.branchId,
            requestedById: pick(allUsers).id,
            status: d.status,
            decidedAt: d.status === 'PENDING' ? null : daysAgo(randDaysAgo(20, 1)),
            note: d.status === 'REJECTED' ? 'Does not meet current policy thresholds' : null,
            steps: {
              create: (rule?.approvers.map((a) => a.role) ?? ['Admin']).map((role, idx) => ({
                sequence: idx + 1,
                approverRole: role,
                approverId: d.status !== 'PENDING' && idx === 0 ? branchAdmin.id : null,
                status: d.status === 'PENDING' ? (idx === 0 ? 'ACTIVE' : 'WAITING') : d.status === 'APPROVED' ? 'APPROVED' : idx === 0 ? 'REJECTED' : 'SKIPPED',
                decidedAt: d.status === 'PENDING' ? null : daysAgo(randDaysAgo(20, 1)),
              })),
            },
          },
        });
        created++;
        void req;
      }
      console.log(`    ${created} approval requests`);
    });
  }

  async function runNotificationsAndAnnouncements() {
    await run('Notifications', async () => {
      const modules = ['inventory', 'purchase', 'accounts', 'hr', 'approvals', 'factory', 'pos', 'wholesale', 'corporate-sales', 'trade'];
      const templates: Array<{ severity: 'INFO' | 'WARNING' | 'CRITICAL'; title: string; body: string; href: string }> = [
        { severity: 'WARNING', title: 'Low stock alert', body: 'A product has dropped below its reorder level.', href: '/reports/inventory' },
        { severity: 'INFO', title: 'New GRN received', body: 'A goods receiving note was posted against a purchase order.', href: '/purchase/grn' },
        { severity: 'CRITICAL', title: 'Fiscal period closing soon', body: 'Review unposted entries before the period closes.', href: '/accounts/periods' },
        { severity: 'INFO', title: 'Payroll run due', body: 'Monthly payroll run is scheduled soon.', href: '/hr/payroll' },
        { severity: 'WARNING', title: 'Approvals awaiting you', body: 'You have pending approval requests.', href: '/approvals' },
        { severity: 'INFO', title: 'Shipment update', body: 'A trade shipment status has changed.', href: '/trade/shipments' },
        { severity: 'CRITICAL', title: 'Overdue supplier payment', body: 'A supplier invoice has passed its due date.', href: '/purchase/invoices' },
        { severity: 'WARNING', title: 'Customer overdue balance', body: 'A wholesale customer balance is overdue.', href: '/crm' },
        { severity: 'INFO', title: 'Production delay flagged', body: 'A production order is running behind schedule.', href: '/factory' },
        { severity: 'INFO', title: 'Document expiring soon', body: 'A stored document is approaching its expiry date.', href: '/documents' },
      ];
      const rows: Prisma.NotificationCreateManyInput[] = [];
      for (let i = 0; i < 60; i++) {
        const t = pick(templates);
        const recipient = pick(allUsers);
        const createdAt = daysAgo(randDaysAgo(60, 0));
        rows.push({
          recipientId: recipient.id,
          branchId: HQ.id,
          severity: t.severity,
          module: pick(modules),
          title: t.title,
          body: t.body,
          href: t.href,
          readAt: Math.random() < 0.5 ? addDays(createdAt, randInt(0, 3)) : null,
          createdAt,
        });
      }
      await prisma.notification.createMany({ data: rows });
    });

    await run('Announcements', async () => {
      const defs = [
        { title: 'Eid Holiday Schedule Announced', body: 'Please review the updated holiday calendar for Eid ul-Fitr.', audienceType: 'ALL' as const },
        { title: 'New Inventory Module Features', body: 'Continuous scan mode is now available in Warehouse.', audienceType: 'ALL' as const },
        { title: 'Dhaka Showroom Renovation', body: 'The Dhaka showroom will have limited hours next week.', audienceType: 'BRANCH' as const, branchId: DHAKA.id },
        { title: 'Factory Safety Briefing', body: 'Mandatory safety briefing for all production staff.', audienceType: 'DEPARTMENT' as const, department: 'Production' },
        { title: 'Payroll Cutoff Reminder', body: 'Submit attendance corrections before the 25th of each month.', audienceType: 'ALL' as const },
        { title: 'Year-End Stock Count', body: 'Physical stock verification scheduled across all warehouses.', audienceType: 'ALL' as const },
        { title: 'Export Compliance Update', body: 'New documentation requirements for EU shipments.', audienceType: 'DEPARTMENT' as const, department: 'Commercial' },
        { title: 'Welcome New Team Members', body: 'Please welcome our newest hires across departments.', audienceType: 'ALL' as const },
      ];
      for (const d of defs) {
        await prisma.announcement.create({
          data: {
            title: d.title,
            body: d.body,
            audienceType: d.audienceType,
            audienceBranchId: 'branchId' in d ? d.branchId : null,
            audienceDepartment: 'department' in d ? d.department : null,
            createdById: pick([admin, branchAdmin, hrUser]).id,
            createdAt: daysAgo(randDaysAgo(60, 1)),
          },
        });
      }
    });
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
