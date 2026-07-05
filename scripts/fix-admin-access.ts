import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.user.update({
    where: { email: 'admin@annex.local' },
    data: { branchAccessType: 'ALL_BRANCHES' }
  });
  console.log('Updated admin@annex.local to have ALL_BRANCHES access.');
}

main().finally(() => prisma.$disconnect());
