import { redirect } from 'next/navigation';
import { getSession } from '@/server/auth/session';
import { RoleDashboardPage } from './role-dashboard';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return <RoleDashboardPage session={session} />;
}
