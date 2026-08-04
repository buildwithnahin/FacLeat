/**
 * Bulk demo-data generator for verifying the mobile Notification Center
 * end-to-end against realistic content. Additive only. Safe to re-run.
 *
 * Not wired into package.json db:seed:* — run directly with:
 *   npx tsx prisma/seed-notifications-verify.ts
 */
import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@annex.local' } });
  const branch = await prisma.branch.findUniqueOrThrow({ where: { code: 'HQ' } });

  function hoursAgo(n: number) {
    const d = new Date();
    d.setHours(d.getHours() - n);
    return d;
  }

  const rows = [
    {
      severity: 'CRITICAL' as const,
      module: 'approvals',
      title: 'Approval pending: Raw material requisition',
      body: 'Salman Khan submitted a purchase requisition for 84,500 BDT awaiting your approval.',
      href: '/approvals',
      createdAt: hoursAgo(1),
    },
    {
      severity: 'WARNING' as const,
      module: 'inventory',
      title: 'Low stock alert — Brass Buckle 25mm',
      body: 'Stock has dropped below the reorder threshold at Headquarters.',
      href: '/inventory',
      createdAt: hoursAgo(5),
    },
    {
      severity: 'WARNING' as const,
      module: 'accounts',
      title: 'Payment overdue — Meridian Leather Supply',
      body: 'A supplier invoice is now 12 days past its due date.',
      href: '/accounts',
      createdAt: hoursAgo(20),
    },
    {
      severity: 'INFO' as const,
      module: 'hr',
      title: 'New joiner onboarded',
      body: 'Rahim Ahmed completed onboarding at Headquarters.',
      href: '/hr',
      createdAt: hoursAgo(30),
      readAt: hoursAgo(28),
    },
    {
      severity: 'INFO' as const,
      module: 'audit',
      title: 'Weekly audit summary ready',
      body: '214 actions logged across all branches this week.',
      href: '/audit',
      createdAt: hoursAgo(48),
      readAt: hoursAgo(40),
    },
  ];

  for (const row of rows) {
    await prisma.notification.create({
      data: { recipientId: admin.id, branchId: branch.id, ...row },
    });
  }

  const total = await prisma.notification.count({ where: { recipientId: admin.id } });
  const unread = await prisma.notification.count({ where: { recipientId: admin.id, readAt: null } });
  console.log(`Seeded ${rows.length} notifications. Admin now has ${total} total, ${unread} unread.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
