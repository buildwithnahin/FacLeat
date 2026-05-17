import { PrismaClient } from '../generated/prisma';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function createClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

function hasWorkflowDelegates(client: PrismaClient | undefined): client is PrismaClient {
  if (!client) return false;
  return (
    'customerReturn' in client &&
    typeof client.customerReturn === 'object' &&
    'damageReport' in client &&
    typeof client.damageReport === 'object'
  );
}

export const prisma = hasWorkflowDelegates(globalThis.__prisma)
  ? globalThis.__prisma
  : createClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}
