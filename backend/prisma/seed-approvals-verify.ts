/**
 * Bulk demo-data generator for verifying the mobile Approvals feature
 * end-to-end against realistic content. Additive only — never truncates
 * existing data. Safe to re-run (uses unique, run-stamped numbers).
 *
 * Not wired into package.json db:seed:* — run directly with:
 *   npx tsx prisma/seed-approvals-verify.ts
 */
import { PrismaClient, Prisma } from '../src/generated/prisma';

const prisma = new PrismaClient();
const D = (v: number | string) => new Prisma.Decimal(v);

async function main() {
  const runStamp = Date.now().toString().slice(-6);
  console.log(`Approvals-verify seed run ${runStamp} starting...`);

  const branch = await prisma.branch.findUniqueOrThrow({ where: { code: 'HQ' } });
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@annex.local' } });
  const cashier = await prisma.user.findUniqueOrThrow({ where: { email: 'cashier@annex.local' } });

  function daysAgo(n: number) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
  }

  // 1. PENDING, requested by cashier, active step for "Super Admin" — admin can approve/reject live.
  const req1 = await prisma.approvalRequest.create({
    data: {
      module: 'purchase',
      action: 'requisition-approve',
      entityType: 'PurchaseRequisition',
      entityId: `verify-${runStamp}-1`,
      title: `Raw material requisition — Batch ${runStamp}`,
      summary: 'Requesting approval to raise a purchase requisition for tanning chemicals ahead of the next production run.',
      amount: D('84500.00'),
      currency: 'BDT',
      branchId: branch.id,
      requestedById: cashier.id,
      status: 'PENDING',
      createdAt: daysAgo(1),
      steps: {
        create: [{ sequence: 1, approverRole: 'Super Admin', status: 'ACTIVE', createdAt: daysAgo(1) }],
      },
    },
  });

  // 2. PENDING, requested by admin themself — tests the "I'm the requester, show Cancel" path.
  const req2 = await prisma.approvalRequest.create({
    data: {
      module: 'hr',
      action: 'expense-claim',
      entityType: 'ExpenseClaim',
      entityId: `verify-${runStamp}-2`,
      title: `Travel expense claim — Dhaka site visit`,
      summary: 'Reimbursement for transport and lodging during the Dhaka Showroom stock audit.',
      amount: D('6200.00'),
      currency: 'BDT',
      branchId: branch.id,
      requestedById: admin.id,
      status: 'PENDING',
      createdAt: daysAgo(2),
      steps: {
        create: [{ sequence: 1, approverRole: 'Super Admin', status: 'ACTIVE', createdAt: daysAgo(2) }],
      },
    },
  });

  // 3. CHANGES_REQUESTED — tests the re-decide path.
  const req3 = await prisma.approvalRequest.create({
    data: {
      module: 'sales',
      action: 'discount-approve',
      entityType: 'SalesOrder',
      entityId: `verify-${runStamp}-3`,
      title: `High discount request — Corporate order #ORD-${runStamp}`,
      summary: 'Requesting a 22% discount for a bulk corporate leather-goods order, above the standard 15% threshold.',
      amount: D('215000.00'),
      currency: 'BDT',
      branchId: branch.id,
      requestedById: cashier.id,
      status: 'CHANGES_REQUESTED',
      note: 'Please attach the customer PO reference before resubmitting.',
      createdAt: daysAgo(4),
      steps: {
        create: [
          {
            sequence: 1,
            approverRole: 'Super Admin',
            status: 'CHANGES_REQUESTED',
            approverId: admin.id,
            decidedAt: daysAgo(3),
            note: 'Please attach the customer PO reference before resubmitting.',
            createdAt: daysAgo(4),
          },
        ],
      },
    },
  });

  // 4. APPROVED — already decided, for list/detail display variety.
  const req4 = await prisma.approvalRequest.create({
    data: {
      module: 'inventory',
      action: 'adjustment-approve',
      entityType: 'StockAdjustment',
      entityId: `verify-${runStamp}-4`,
      title: `Stock adjustment — damaged goods write-off`,
      summary: 'Write-off for water-damaged leather rolls found during the Chittagong Warehouse cycle count.',
      branchId: branch.id,
      requestedById: cashier.id,
      status: 'APPROVED',
      decidedAt: daysAgo(5),
      createdAt: daysAgo(6),
      steps: {
        create: [
          {
            sequence: 1,
            approverRole: 'Super Admin',
            status: 'APPROVED',
            approverId: admin.id,
            decidedAt: daysAgo(5),
            createdAt: daysAgo(6),
          },
        ],
      },
    },
  });

  // 5. REJECTED — already decided, for list/detail display variety.
  const req5 = await prisma.approvalRequest.create({
    data: {
      module: 'purchase',
      action: 'vendor-registration',
      entityType: 'Supplier',
      entityId: `verify-${runStamp}-5`,
      title: `New vendor registration — Meridian Leather Supply`,
      summary: 'Onboarding a new leather supplier; rejected pending updated trade license documentation.',
      branchId: branch.id,
      requestedById: cashier.id,
      status: 'REJECTED',
      note: 'Trade license on file is expired — resubmit with a current copy.',
      decidedAt: daysAgo(8),
      createdAt: daysAgo(9),
      steps: {
        create: [
          {
            sequence: 1,
            approverRole: 'Super Admin',
            status: 'REJECTED',
            approverId: admin.id,
            decidedAt: daysAgo(8),
            note: 'Trade license on file is expired — resubmit with a current copy.',
            createdAt: daysAgo(9),
          },
        ],
      },
    },
  });

  console.log(`  Created: ${req1.id}, ${req2.id}, ${req3.id}, ${req4.id}, ${req5.id}`);

  const counts = await prisma.approvalRequest.groupBy({ by: ['status'], _count: true });
  console.log('\nApprovalRequest counts by status:', counts);
  console.log('\nApprovals-verify seed complete.');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
