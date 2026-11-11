import { LogOut } from 'lucide-react';
import { getModulesForAccess } from '@/constants/navigation';
import { logoutAction } from '@/server/actions/auth';
import { BranchSwitcher } from '@/components/shared/branch-switcher';
import { CompanySwitcher } from '@/components/shared/company-switcher';
import { NotificationBell } from '@/components/shared/notification-bell';
import { SearchCommand } from '@/components/shared/search-command';
import { SidebarNav, type ClientNavItem, type ClientNavModule } from '@/components/shared/sidebar-nav';
import { MobileNavProvider, MobileSidebarFrame, SidebarToggleButton } from '@/components/shared/mobile-nav';
import { backendFetch } from '@/lib/backend-client';
import type { AppSession } from '@/server/auth/session';
import type { NavItem } from '@/constants/navigation';

interface NotificationDto {
  id: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  module: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
}

async function renderBell() {
  const [{ count: unread }, items] = await Promise.all([
    backendFetch<{ count: number }>('/api/mobile/notifications/unread-count'),
    backendFetch<NotificationDto[]>('/api/mobile/notifications?limit=20'),
  ]);
  return <NotificationBell initialUnread={unread} initialItems={items} />;
}

export async function AppShell({
  children,
  session,
}: {
  children: React.ReactNode;
  session: AppSession;
}) {
  const initials =
    session.name
      .split(/\s+/)
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?';

  const perms = session.permissions;
  const can = (p?: string) => !p || perms.includes(p);
  const modules = getModulesForAccess({
    roles: session.roles,
    permissions: session.permissions,
  });

  const visibleItems = (items?: NavItem[]): ClientNavItem[] | undefined => {
    const filtered: ClientNavItem[] = [];

    for (const item of items ?? []) {
      const children = visibleItems(item.items);
      const visible = can(item.permission) && (!!item.href || !!children?.length);
      if (!visible) continue;

      const navItem: ClientNavItem = { label: item.label };
      if (item.href) navItem.href = item.href;
      if (children) navItem.items = children;
      filtered.push(navItem);
    }

    return filtered && filtered.length > 0 ? filtered : undefined;
  };

  const visibleModules: ClientNavModule[] = modules.filter((m) => {
    if (!can(m.permission)) return false;
    const childrenVisible = !!visibleItems(m.items)?.length;
    return !m.items || childrenVisible || can(m.permission);
  }).map((m, index) => ({
    number: m.number,
    displayNumber: index + 1,
    label: m.label,
    href: m.href,
    iconName: m.iconName,
    items: visibleItems(m.items),
  }));

  return (
    <div className="min-h-screen bg-muted/30">
      <MobileNavProvider>
        <div className="flex">
          <MobileSidebarFrame>
            <div className="px-5 py-5 border-b border-white/10">
              <p className="text-base font-semibold">DeshIT-BD SME ERP</p>
              <p className="text-xs text-white/60 mt-0.5">Enterprise ERP</p>
            </div>
            <SidebarNav modules={visibleModules} />
            <div className="shrink-0 border-t border-white/10 p-3 space-y-2">
              <div className="px-2 text-xs text-white/80">
                <p className="font-medium truncate">{session.name}</p>
                <p className="text-white/50 truncate">{session.email}</p>
              </div>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="w-full flex items-center gap-2 rounded-md px-2 py-2 text-sm text-white/80 hover:bg-white/5 hover:text-white transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign out</span>
                </button>
              </form>
            </div>
          </MobileSidebarFrame>

          <div className="flex-1 flex flex-col min-w-0">
            <header className="h-14 bg-background border-b sticky top-0 z-10 flex items-center gap-2 px-3 sm:gap-3 sm:px-6">
              <SidebarToggleButton />
              <div className="min-w-0 flex-1 sm:max-w-xl">
                <SearchCommand modules={visibleModules} />
              </div>
              <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                <CompanySwitcher session={session} />
                <BranchSwitcher session={session} />
                {await renderBell()}
                <div className="h-9 w-9 shrink-0 rounded-full bg-primary text-primary-foreground grid place-items-center text-xs font-semibold">
                  {initials}
                </div>
              </div>
            </header>
            <main className="flex-1 p-4 sm:p-6">{children}</main>
          </div>
        </div>
      </MobileNavProvider>
    </div>
  );
}
