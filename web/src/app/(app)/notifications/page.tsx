import Link from 'next/link';
import { Check } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pill } from '@/components/shared/pill';
import { backendFetch } from '@/lib/backend-client';
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from '@/server/actions/notifications';

export const dynamic = 'force-dynamic';

async function markAllReadFormAction() {
  'use server';
  await markAllNotificationsReadAction();
}

async function markSingleReadFormAction(formData: FormData) {
  'use server';
  const id = formData.get('id');
  if (typeof id === 'string' && id) {
    await markNotificationReadAction(id);
  }
}

export const metadata = { title: 'Notifications' };

interface Search {
  unread?: string;
}

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

type PillTone = 'blue' | 'amber' | 'red';

const TONE: Record<'INFO' | 'WARNING' | 'CRITICAL', PillTone> = {
  INFO: 'blue',
  WARNING: 'amber',
  CRITICAL: 'red',
};

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const onlyUnread = sp.unread === '1';
  const listQuery = new URLSearchParams({ limit: '200' });
  if (onlyUnread) listQuery.set('unread', '1');

  const [items, { count: unread }] = await Promise.all([
    backendFetch<NotificationDto[]>(`/api/mobile/notifications?${listQuery.toString()}`),
    backendFetch<{ count: number }>('/api/mobile/notifications/unread-count'),
  ]);

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Notifications"
        description={`${unread} unread of ${items.length} shown`}
      >
        <form action={markAllReadFormAction}>
          <Button type="submit" variant="outline" disabled={unread === 0}>
            Mark all read
          </Button>
        </form>
      </PageHeader>

      <Card className="p-2 flex gap-2">
        <Button variant={onlyUnread ? 'ghost' : 'dark'} size="sm" asChild>
          <Link href="/notifications">All</Link>
        </Button>
        <Button variant={onlyUnread ? 'dark' : 'ghost'} size="sm" asChild>
          <Link href="/notifications?unread=1">Unread</Link>
        </Button>
      </Card>

      <Card className="p-0">
        {items.length === 0 ? (
          <div className="p-8 text-sm text-muted-foreground text-center">
            {onlyUnread ? 'No unread notifications.' : 'No notifications yet.'}
          </div>
        ) : (
          <ul className="divide-y">
            {items.map((n) => (
              <li key={n.id} className={`flex items-center justify-between gap-3 px-4 py-3 ${n.readAt ? '' : 'bg-blue-50/40'}`}>
                {n.href ? (
                  <Link href={n.href} className="flex-1 min-w-0 hover:underline">
                    <NotificationRow n={n} />
                  </Link>
                ) : (
                  <div className="flex-1 min-w-0">
                    <NotificationRow n={n} />
                  </div>
                )}
                {!n.readAt && (
                  <form action={markSingleReadFormAction} className="shrink-0">
                    <input type="hidden" name="id" value={n.id} />
                    <Button type="submit" variant="ghost" size="xs" className="text-xs text-muted-foreground hover:text-foreground">
                      <Check className="h-3.5 w-3.5 mr-1" />
                      Mark read
                    </Button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function NotificationRow({
  n,
}: {
  n: {
    severity: 'INFO' | 'WARNING' | 'CRITICAL';
    module: string;
    title: string;
    body: string | null;
    createdAt: string;
    readAt: string | null;
  };
}) {
  return (
    <div className="flex items-start gap-3">
      <Pill tone={TONE[n.severity]}>{n.severity.toLowerCase()}</Pill>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{n.title}</span>
          {!n.readAt && <span className="text-[10px] font-semibold text-blue-600">NEW</span>}
        </div>
        {n.body && <div className="text-sm text-muted-foreground mt-0.5">{n.body}</div>}
        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
          <span className="uppercase tracking-wider">{n.module}</span>
          <span className="tabular">{new Date(n.createdAt).toISOString().replace('T', ' ').slice(0, 16)}</span>
        </div>
      </div>
    </div>
  );
}
