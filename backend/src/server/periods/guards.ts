import 'server-only';
import { prisma } from '@/server/db';
import type { Prisma } from '@prisma/client';
import { ValidationError } from '@/lib/errors';

type PeriodClient = Pick<typeof prisma, 'period'> | Prisma.TransactionClient;

export async function assertOpenPeriod(
  client: PeriodClient,
  branchId: string,
  date: Date = new Date(),
) {
  const period = await client.period.findFirst({
    where: {
      branchId,
      startsAt: { lte: date },
      endsAt: { gte: date },
    },
  });

  if (!period) throw new ValidationError('No fiscal period covers this date for the branch');
  if (period.status !== 'OPEN') {
    throw new ValidationError(`Period "${period.name}" is ${period.status}`);
  }
  return period;
}
