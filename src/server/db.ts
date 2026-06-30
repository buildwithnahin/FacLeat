import { PrismaClient } from '../generated/prisma';

declare global {
  var __prisma: PrismaClient | undefined;
}

function createClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

function hasWorkflowDelegates(client: PrismaClient | undefined): client is PrismaClient {
  if (!client) return false;
  const userFields = (client as any)._runtimeDataModel?.models?.User?.fields;
  const hasUserEmployeeRelation =
    Array.isArray(userFields) &&
    userFields.some((field: { name?: string; kind?: string }) => field.name === 'employee' && field.kind === 'object');
  return (
    hasUserEmployeeRelation &&
    'customerReturn' in client &&
    typeof client.customerReturn === 'object' &&
    'damageReport' in client &&
    typeof client.damageReport === 'object' &&
    'hrMasterData' in client &&
    typeof client.hrMasterData === 'object' &&
    'hrWorkflowRecord' in client &&
    typeof client.hrWorkflowRecord === 'object'
  );
}

export const prisma = hasWorkflowDelegates(globalThis.__prisma)
  ? globalThis.__prisma
  : createClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}
