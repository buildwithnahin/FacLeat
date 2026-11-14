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

interface BranchDto {
  id: string;
  code: string;
  name: string;
}

export default async function CoaPage({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string }>;
}) {
  const { branchId } = await searchParams;
  const session = await getSession();

  const queryParams = new URLSearchParams();
  if (branchId) queryParams.set('branchId', branchId);

  const [accounts, branches] = await Promise.all([
    backendFetch<CoaTreeAccountDto[]>(
      queryParams.toString() ? `/api/mobile/coa/tree?${queryParams.toString()}` : '/api/mobile/coa/tree',
    ),
    backendFetch<BranchDto[]>('/api/mobile/branches').catch(() => []),
  ]);
  const canWrite = session?.permissions.includes('coa:write') ?? false;

  return (
    <CoaClient
      canWrite={canWrite}
      branches={branches}
      selectedBranchId={branchId ?? ''}
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
