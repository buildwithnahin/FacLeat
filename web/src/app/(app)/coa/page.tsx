import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { CoaClient } from '@/components/coa/coa-client';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Chart of Accounts' };

interface CoaTreeAccountDto {
  id: string;
  code: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
  normalSide: 'DEBIT' | 'CREDIT';
  parentId: string | null;
  depth: number;
  isPosting: boolean;
  isActive: boolean;
  openingBalance: string;
  currentBalance: string;
  detailType: string | null;
  openingBalanceDate: string | null;
  createdAt: string;
}

export default async function CoaPage() {
  const session = await getSession();
  const accounts = await backendFetch<CoaTreeAccountDto[]>('/api/mobile/coa/tree');
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
        openingBalance: account.openingBalance,
        currentBalance: account.currentBalance,
        detailType: account.detailType,
        openingBalanceDate: account.openingBalanceDate,
        createdAt: new Date(account.createdAt).toISOString(),
      }))}
    />
  );
}
