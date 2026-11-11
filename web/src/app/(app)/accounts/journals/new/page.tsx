import { notFound } from 'next/navigation';
import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { PageHeader } from '@/components/shared/page-header';
import { JournalEditor } from '../_components/journal-editor';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'New journal entry' };

interface CoaListAccountDto {
  id: string;
  code: string;
  name: string;
  type: string;
  isPosting: boolean;
  isActive: boolean;
}

interface BranchOptionDto {
  id: string;
  code: string;
  name: string;
  currency: string;
}

export default async function NewJournalPage() {
  const session = await getSession();
  if (!session?.permissions.includes('accounts:post')) notFound();
  const [accounts, branches] = await Promise.all([
    backendFetch<CoaListAccountDto[]>('/api/mobile/coa?activeOnly=true'),
    backendFetch<BranchOptionDto[]>('/api/mobile/branches'),
  ]);

  const postingAccounts = accounts
    .filter((a) => a.isPosting && a.isActive)
    .map((a) => ({ id: a.id, code: a.code, name: a.name, type: a.type }));

  return (
    <div>
      <PageHeader title="New journal entry" description="Manual debit/credit entry. Totals must balance before posting." />
      <JournalEditor
        branches={branches.map((b) => ({ id: b.id, code: b.code, name: b.name, currency: b.currency }))}
        accounts={postingAccounts}
        defaultBranchId={session?.activeBranchId ?? branches[0]?.id ?? ''}
      />
    </div>
  );
}
