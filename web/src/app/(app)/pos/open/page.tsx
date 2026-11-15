import { redirect } from 'next/navigation';
import { getSession } from '@/server/auth/session';
import { backendFetch } from '@/lib/backend-client';
import { OpenSessionForm } from './open-session-form';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Open POS Session' };

interface Branch {
  id: string;
  name: string;
  code: string;
  currency: string;
}

interface Warehouse {
  id: string;
  name: string;
  code: string;
  branchId: string;
}

type OpenFormOptions =
  | { hasOpenSession: true }
  | {
      hasOpenSession: false;
      branches: Branch[];
      warehouses: Warehouse[];
      defaultBranch: string;
      defaultOpeningBalance: string;
      carriedFromPrevious: boolean;
    };

export default async function OpenSessionPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const branchId = session.activeBranchId ?? session.defaultBranchId ?? '';
  const query = branchId ? `?branchId=${encodeURIComponent(branchId)}` : '';
  const data = await backendFetch<OpenFormOptions>(`/api/mobile/pos/open${query}`);
  if (data.hasOpenSession) redirect('/pos');

  return (
    <OpenSessionForm
      branches={data.branches}
      warehouses={data.warehouses}
      defaultBranch={data.defaultBranch}
      defaultOpeningBalance={data.defaultOpeningBalance}
      carriedFromPrevious={data.carriedFromPrevious}
    />
  );
}
