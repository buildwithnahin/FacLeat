/**
 * Bulk demo-data generator for verifying the mobile app end-to-end against
 * realistic volume. Additive only — never truncates existing data. Safe to
 * re-run (uses unique, run-stamped numbers so re-running just adds more).
 *
 * Not wired into package.json db:seed:* — run directly with:
 *   pnpm exec tsx prisma/seed-mobile-verify.ts
 */
import { PrismaClient, Prisma } from '../src/generated/prisma';

const prisma = new PrismaClient();
const D = (v: number | string) => new Prisma.Decimal(v);

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick<T>(arr: T[]): T {
  return arr[randomInt(0, arr.length - 1)];
}
function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function main() {
  const runStamp = Date.now().toString().slice(-6);
  console.log(`Bulk-verify seed run ${runStamp} starting...`);

  const branch = await prisma.branch.findUniqueOrThrow({ where: { code: 'HQ' } });
  const warehouse = await prisma.warehouse.findFirstOrThrow({ where: { branchId: branch.id, code: 'MAIN' } });
  const period = await prisma.period.findFirstOrThrow({ where: { branchId: branch.id, status: 'OPEN' } });
  const products = await prisma.product.findMany({ where: {} });
  const customers = await prisma.customer.findMany({ where: { branchId: branch.id } });
  const suppliers = await prisma.supplier.findMany({ where: { branchId: branch.id } });
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@annex.local' } });
  const cashier = await prisma.user.findUniqueOrThrow({ where: { email: 'cashier@annex.local' } });

  const coa = await prisma.chartAccount.findMany({ where: { isPosting: true } });
  const byCode = (code: string) => {
    const acc = coa.find((a) => a.code === code);
    if (!acc) throw new Error(`Missing COA account ${code}`);
    return acc;
  };
  const cash = byCode('1110');
  const salesRevenue = byCode('4110');
  const cogs = byCode('5100');
  const inventoryAsset = byCode('1142');
  const ap = byCode('2100');
  const purchaseExpense = byCode('5200');
  const rawMaterials = byCode('1141');
  const expenseAccounts = coa.filter((a) => a.type === 'EXPENSE');
  const incomeAccounts = coa.filter((a) => a.type === 'INCOME');

  if (products.length === 0) throw new Error('No products found — run pnpm db:seed first.');
  if (customers.length === 0) throw new Error('No customers found — run pnpm db:seed first.');
  if (suppliers.length === 0) throw new Error('No suppliers found — run pnpm db:seed first.');

  // ── 1. POS session + 45 sales spread over the last 45 days ──────────────
  const session = await prisma.posSession.create({
    data: {
      branchId: branch.id,
      warehouseId: warehouse.id,
      cashierId: cashier.id,
      openingFloat: D(5000),
      status: 'OPEN',
      openedAt: daysAgo(45),
    },
  });

  const POS_SALE_COUNT = 45;
  let posCreated = 0;
  for (let i = 0; i < POS_SALE_COUNT; i++) {
    const saleDate = daysAgo(randomInt(0, 44));
    const itemCount = randomInt(1, 3);
    const chosenProducts = Array.from({ length: itemCount }, () => pick(products));

    let subtotal = new Prisma.Decimal(0);
    const items = chosenProducts.map((p) => {
      const qty = D(randomInt(1, 4));
      const unitPrice = new Prisma.Decimal(p.sellPrice);
      const lineTotal = qty.mul(unitPrice);
      subtotal = subtotal.add(lineTotal);
      return {
        productId: p.id,
        quantity: qty,
        unitPrice,
        lineTotal,
      };
    });
    const grandTotal = subtotal;

    const sale = await prisma.posSale.create({
      data: {
        number: `POS-VERIFY-${runStamp}-${String(i + 1).padStart(4, '0')}`,
        branchId: branch.id,
        warehouseId: warehouse.id,
        sessionId: session.id,
        customerId: Math.random() < 0.6 ? pick(customers).id : null,
        cashierId: cashier.id,
        saleDate,
        subtotal,
        grandTotal,
        paidTotal: grandTotal,
        status: 'COMPLETED',
        items: { create: items.map((it) => ({ ...it, unit: 'PCS' as const })) },
        payments: {
          create: [{ method: pick(['CASH', 'CARD', 'MOBILE_BANKING'] as const), amount: grandTotal }],
        },
      },
      include: { items: true },
    });

    // Inventory ledger OUT per line, so inventory-valuation reflects movement.
    for (const item of sale.items) {
      const product = chosenProducts.find((p) => p.id === item.productId)!;
      await prisma.inventoryLedger.create({
        data: {
          branchId: branch.id,
          warehouseId: warehouse.id,
          productId: item.productId,
          direction: 'OUT',
          quantity: item.quantity,
          costPerUnit: new Prisma.Decimal(product.costPrice),
          refType: 'PosSale',
          refId: sale.id,
          note: 'Bulk verify seed',
          createdAt: saleDate,
        },
      });
    }

    // Balanced journal entry mirroring the sale (Dr Cash / Cr Sales Revenue,
    // Dr COGS / Cr Inventory) so financial statements pick it up too.
    const costTotal = items.reduce((sum, it, idx) => {
      const product = chosenProducts[idx];
      return sum.add(it.quantity.mul(new Prisma.Decimal(product.costPrice)));
    }, new Prisma.Decimal(0));

    await prisma.journalEntry.create({
      data: {
        number: `JE-POS-${runStamp}-${String(i + 1).padStart(4, '0')}`,
        branchId: branch.id,
        periodId: period.id,
        date: saleDate,
        memo: `POS sale ${sale.number}`,
        status: 'POSTED',
        sourceModule: 'pos',
        sourceRefType: 'PosSale',
        sourceRefId: sale.id,
        postedById: admin.id,
        postedAt: saleDate,
        totalDebit: grandTotal.add(costTotal),
        totalCredit: grandTotal.add(costTotal),
        lines: {
          create: [
            { lineNo: 1, accountId: cash.id, debit: grandTotal, credit: D(0) },
            { lineNo: 2, accountId: salesRevenue.id, debit: D(0), credit: grandTotal },
            { lineNo: 3, accountId: cogs.id, debit: costTotal, credit: D(0) },
            { lineNo: 4, accountId: inventoryAsset.id, debit: D(0), credit: costTotal },
          ],
        },
      },
    });

    posCreated++;
  }
  console.log(`  ✓ ${posCreated} POS sales + ledger + journal entries`);

  // ── 2. 40 purchase invoices spread over the last 60 days ────────────────
  const PURCHASE_COUNT = 40;
  let purchaseCreated = 0;
  for (let i = 0; i < PURCHASE_COUNT; i++) {
    const invoiceDate = daysAgo(randomInt(0, 59));
    const supplier = pick(suppliers);
    const itemCount = randomInt(1, 4);
    const chosenProducts = Array.from({ length: itemCount }, () => pick(products));

    let subtotal = new Prisma.Decimal(0);
    const items = chosenProducts.map((p) => {
      const qty = D(randomInt(5, 50));
      const unitPrice = new Prisma.Decimal(p.costPrice);
      const lineTotal = qty.mul(unitPrice);
      subtotal = subtotal.add(lineTotal);
      return { productId: p.id, quantity: qty, unitPrice, lineTotal };
    });

    const invoice = await prisma.purchaseInvoice.create({
      data: {
        branchId: branch.id,
        number: `PI-VERIFY-${runStamp}-${String(i + 1).padStart(4, '0')}`,
        supplierId: supplier.id,
        status: pick(['POSTED', 'APPROVED', 'PAID'] as const),
        invoiceDate,
        dueDate: new Date(invoiceDate.getTime() + 30 * 86400000),
        subtotal,
        grandTotal: subtotal,
        paidAmount: Math.random() < 0.5 ? subtotal : D(0),
        createdById: admin.id,
        items: { create: items },
      },
    });

    await prisma.journalEntry.create({
      data: {
        number: `JE-PUR-${runStamp}-${String(i + 1).padStart(4, '0')}`,
        branchId: branch.id,
        periodId: period.id,
        date: invoiceDate,
        memo: `Purchase invoice ${invoice.number}`,
        status: 'POSTED',
        sourceModule: 'purchase',
        sourceRefType: 'PurchaseInvoice',
        sourceRefId: invoice.id,
        postedById: admin.id,
        postedAt: invoiceDate,
        totalDebit: subtotal,
        totalCredit: subtotal,
        lines: {
          create: [
            { lineNo: 1, accountId: rawMaterials.id, debit: subtotal, credit: D(0) },
            { lineNo: 2, accountId: ap.id, debit: D(0), credit: subtotal },
          ],
        },
      },
    });

    purchaseCreated++;
  }
  console.log(`  ✓ ${purchaseCreated} purchase invoices + journal entries`);

  // ── 3. 40 general operating-expense journal entries across many months ──
  const EXPENSE_JE_COUNT = 40;
  let expenseJeCreated = 0;
  for (let i = 0; i < EXPENSE_JE_COUNT; i++) {
    const date = daysAgo(randomInt(0, 179)); // spread across ~6 months for trend reports
    const amount = D(randomInt(500, 25000));
    const expenseAcc = pick(expenseAccounts);

    await prisma.journalEntry.create({
      data: {
        number: `JE-OPEX-${runStamp}-${String(i + 1).padStart(4, '0')}`,
        branchId: branch.id,
        periodId: period.id,
        date,
        memo: `${expenseAcc.name} — bulk verify seed`,
        status: 'POSTED',
        postedById: admin.id,
        postedAt: date,
        totalDebit: amount,
        totalCredit: amount,
        lines: {
          create: [
            { lineNo: 1, accountId: expenseAcc.id, debit: amount, credit: D(0) },
            { lineNo: 2, accountId: cash.id, debit: D(0), credit: amount },
          ],
        },
      },
    });
    expenseJeCreated++;
  }
  console.log(`  ✓ ${expenseJeCreated} operating-expense journal entries`);

  const dashboardKpiCheck = await prisma.posSale.count();
  const journalCount = await prisma.journalEntry.count();
  const purchaseInvoiceCount = await prisma.purchaseInvoice.count();
  const ledgerCount = await prisma.inventoryLedger.count();

  console.log('\nTotals in DB now:');
  console.log(`  PosSale: ${dashboardKpiCheck}`);
  console.log(`  JournalEntry: ${journalCount}`);
  console.log(`  PurchaseInvoice: ${purchaseInvoiceCount}`);
  console.log(`  InventoryLedger: ${ledgerCount}`);
  console.log('\n🎉 Bulk verify seed complete!');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
