import { notFound } from 'next/navigation';
import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { PageHeader } from '@/components/shared/page-header';
import { AccountForm } from '../account-form';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'New account' };

interface CoaListAccountDto {
  id: string;
  code: string;
  name: string;
  type: string;
  path: string;
}

interface BranchOptionDto {
  id: string;
  code: string;
  name: string;
}

export default async function NewAccountPage() {
  const session = await getSession();
  if (!session?.permissions.includes('coa:write')) notFound();
  const [accounts, branches] = await Promise.all([
    backendFetch<CoaListAccountDto[]>('/api/mobile/coa'),
    backendFetch<BranchOptionDto[]>('/api/mobile/branches'),
  ]);
  return (
    <div>
      <PageHeader title="New account" description="Add a ledger account to the chart." />
      <AccountForm
        mode="create"
        parents={accounts.map((a) => ({ id: a.id, code: a.code, name: a.name, type: a.type, path: a.path }))}
        branches={branches.map((b) => ({ id: b.id, code: b.code, name: b.name }))}
      />
    </div>
  );
}
