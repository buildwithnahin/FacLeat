import { notFound } from 'next/navigation';
import { getSession } from '@/server/auth/session';
import { backendFetch, BackendApiError } from '@/lib/backend-client';
import { PageHeader } from '@/components/shared/page-header';
import { AccountForm } from '../account-form';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Edit account' };

interface ChartAccountDto {
  id: string;
  code: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
  normalSide: 'DEBIT' | 'CREDIT';
  parentId: string | null;
  path: string;
  isPosting: boolean;
  isControl: boolean;
  currency: 'BDT' | 'INR' | 'USD' | 'EUR';
  branchId: string | null;
  openingBalance: string;
  detailType: string | null;
  openingBalanceDate: string | null;
  description: string | null;
  isActive: boolean;
}

interface BranchOptionDto {
  id: string;
  code: string;
  name: string;
}

export default async function EditAccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session?.permissions.includes('coa:write')) notFound();

  let account: ChartAccountDto;
  try {
    account = await backendFetch<ChartAccountDto>(`/api/mobile/coa/${id}`);
  } catch (e) {
    if (e instanceof BackendApiError && e.status === 404) notFound();
    throw e;
  }

  const [accounts, branches] = await Promise.all([
    backendFetch<ChartAccountDto[]>('/api/mobile/coa'),
    backendFetch<BranchOptionDto[]>('/api/mobile/branches'),
  ]);

  return (
    <div>
      <PageHeader title={`Edit ${account.code}`} description={account.name} />
      <AccountForm
        mode="edit"
        parents={accounts
          .filter((a) => a.id !== account.id && !a.path.startsWith(`${account.path}/`))
          .map((a) => ({ id: a.id, code: a.code, name: a.name, type: a.type, path: a.path }))}
        branches={branches.map((b) => ({ id: b.id, code: b.code, name: b.name }))}
        initial={{
          id: account.id,
          code: account.code,
          name: account.name,
          type: account.type,
          normalSide: account.normalSide,
          parentId: account.parentId,
          isPosting: account.isPosting,
          isControl: account.isControl,
          currency: account.currency,
          branchId: account.branchId,
          openingBalance: account.openingBalance,
          detailType: account.detailType,
          openingBalanceDate: account.openingBalanceDate?.slice(0, 10) ?? null,
          description: account.description,
          isActive: account.isActive,
        }}
      />
    </div>
  );
}
