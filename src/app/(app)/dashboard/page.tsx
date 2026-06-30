import { redirect } from 'next/navigation';
import { getSession, type AppSession } from '@/server/auth/session';
import { AccountsDashboard } from './accounts-dashboard';

export const metadata = { title: 'Dashboard' };

type DashboardRole =
  | 'super-admin'
  | 'admin'
  | 'hr'
  | 'accounts'
  | 'commercial'
  | 'inventory'
  | 'production'
  | 'purchase'
  | 'store'
  | 'sales'
  | 'management';

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const role = resolveDashboardRole(session);

  if (role === 'accounts') {
    return <AccountsDashboard session={session} />;
  }

  const { RoleDashboardPage } = await import('./role-dashboard');
  return <RoleDashboardPage session={session} role={role} />;
}

function resolveDashboardRole(session: AppSession): DashboardRole {
  const roleNames = session.roles.map((role) => role.toLowerCase());

  if (roleNames.some((role) => role.includes('super admin'))) return 'super-admin';
  if (roleNames.some((role) => role === 'admin' || role.endsWith(' admin'))) return 'admin';
  if (roleNames.some((role) => role.includes('hr'))) return 'hr';
  if (roleNames.some((role) => role.includes('account'))) return 'accounts';
  if (roleNames.some((role) => role.includes('commercial') || role.includes('trade') || role.includes('export') || role.includes('import'))) return 'commercial';
  if (roleNames.some((role) => role.includes('warehouse') || role.includes('store'))) return 'store';
  if (roleNames.some((role) => role.includes('inventory'))) return 'inventory';
  if (roleNames.some((role) => role.includes('factory') || role.includes('production'))) return 'production';
  if (roleNames.some((role) => role.includes('purchase') || role.includes('procurement'))) return 'purchase';
  if (roleNames.some((role) => role.includes('sales'))) return 'sales';
  if (roleNames.some((role) => role.includes('management'))) return 'management';

  if (session.permissions.includes('trade:read')) return 'commercial';
  if (session.permissions.includes('hr:read')) return 'hr';
  if (session.permissions.includes('accounts:read')) return 'accounts';
  if (session.permissions.includes('factory:read')) return 'production';
  if (session.permissions.includes('purchase:read')) return 'purchase';
  if (session.permissions.includes('warehouse:read')) return 'store';
  if (
    session.permissions.includes('wholesale:read') ||
    session.permissions.includes('corporate-sales:read') ||
    session.permissions.includes('crm:read')
  ) {
    return 'sales';
  }
  return 'admin';
}
