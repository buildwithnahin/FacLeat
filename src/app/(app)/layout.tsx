import { redirect } from 'next/navigation';
import { AppShell } from '@/components/shared/app-shell';
import { getSession } from '@/server/auth/session';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');
  return <AppShell session={session}>{children}</AppShell>;
}
