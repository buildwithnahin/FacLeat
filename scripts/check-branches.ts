import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Branches:', await prisma.branch.findMany({ select: { id: true, name: true, isActive: true } }));
  console.log('User:', await prisma.user.findUnique({
    where: { email: 'admin@annex.local' },
    select: { branchAccessType: true, defaultBranchId: true, branchAccesses: true }
  }));
}

main().finally(() => prisma.$disconnect());
