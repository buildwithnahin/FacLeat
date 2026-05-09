import { getSession } from '@/server/auth/session';
import { coaService } from '@/server/services/coa.service';
import { CoaClient } from '@/components/coa/coa-client';

export const metadata = { title: 'Chart of Accounts' };

export default async function CoaPage() {
  const session = await getSession();
  const accounts = await coaService.tree(session);
  const canWrite = session?.permissions.includes('coa:write') ?? false;

  return (
    <CoaClient
      canWrite={canWrite}
      accounts={accounts.map((account) => ({
        id: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
        normalSide: account.normalSide,
        parentId: account.parentId,
        depth: account.depth,
        isPosting: account.isPosting,
        isActive: account.isActive,
        openingBalance: account.openingBalance.toString(),
        detailType: account.detailType,
        openingBalanceDate: account.openingBalanceDate?.toISOString() ?? null,
        createdAt: new Date(account.createdAt).toISOString(),
      }))}
    />
  );
}
