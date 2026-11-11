'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from '@/server/actions/notifications';

interface NotificationLite {
  id: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  module: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
}

export function NotificationBell({
  initialUnread,
  initialItems,
}: {
  initialUnread: number;
  initialItems: NotificationLite[];
}) {
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState<NotificationLite[]>(initialItems);
  const [open, setOpen] = useState(false);
  const seenIds = useRef(new Set(initialItems.map((item) => item.id)));

  // Live push via SSE: backend/'s cookie-based /api/sse/notifications route
  // is unreachable from web/'s origin (different NextAuth cookie scope, and a
  // plain EventSource can't attach a Bearer header). Instead: fetch a
  // short-lived, SSE-only token from web/'s own /api/notifications/sse-token
  // route (which reads the NextAuth session server-side), then open an
  // EventSource straight at backend/'s token-in-query-string SSE route
  // (/api/mobile/sse/notifications). New notifications for this user arrive
  // as `data:` events and get prepended live, no page reload needed.
  useEffect(() => {
    let es: EventSource | null = null;
    let cancelled = false;

    async function connect() {
      try {
        const res = await fetch('/api/notifications/sse-token', { cache: 'no-store' });
        const json = await res.json().catch(() => null);
        if (cancelled || !res.ok || !json?.token || !json?.backendUrl) return;

        es = new EventSource(`${json.backendUrl}/api/mobile/sse/notifications?token=${encodeURIComponent(json.token)}`);
        es.onmessage = (event) => {
          let payload: unknown;
          try {
            payload = JSON.parse(event.data);
          } catch {
            return;
          }
          if (
            !payload ||
            typeof payload !== 'object' ||
            (payload as { type?: string }).type === 'connected'
          ) {
            return;
          }
          const n = payload as NotificationLite;
          if (!n.id || seenIds.current.has(n.id)) return;
          seenIds.current.add(n.id);
          setItems((prev) => [n, ...prev].slice(0, 20));
          setUnread((prev) => prev + 1);
        };
        es.onerror = () => {
          // EventSource retries automatically; nothing to do here beyond
          // letting the browser's built-in reconnect handle transient drops.
        };
      } catch {
        // No live updates this session; initial data from the page load
        // still stands and a future navigation/mount will retry.
      }
    }

    void connect();

    return () => {
      cancelled = true;
      es?.close();
    };
  }, []);

  async function markSeen(id: string) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id && !item.readAt
          ? { ...item, readAt: new Date().toISOString() }
          : item,
      ),
    );
    setUnread((prev) => Math.max(0, prev - 1));
    await markNotificationReadAction(id);
  }

  async function markAllRead() {
    const seenAt = new Date().toISOString();
    setItems((prev) =>
      prev.map((item) => (item.readAt ? item : { ...item, readAt: seenAt })),
    );
    setUnread(0);
    await markAllNotificationsReadAction();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative h-9 w-9 rounded-md border bg-background grid place-items-center hover:bg-muted/60"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-semibold rounded-full min-w-4 h-4 px-1 grid place-items-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-hidden
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-80 rounded-md border bg-background shadow-lg z-20 overflow-hidden">
            <div className="px-3 py-2 border-b flex items-center justify-between">
              <span className="text-sm font-medium">Notifications</span>
              <div className="flex items-center gap-3">
                {unread > 0 && (
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => void markAllRead()}
                  >
                    Mark all read
                  </button>
                )}
                <Link
                  href="/notifications"
                  className="text-xs text-primary hover:underline"
                  onClick={() => setOpen(false)}
                >
                  View all
                </Link>
              </div>
            </div>
            <ul className="max-h-96 overflow-y-auto divide-y">
              {items.length === 0 ? (
                <li className="px-3 py-6 text-xs text-muted-foreground text-center">
                  No notifications yet.
                </li>
              ) : (
                items.map((n) => {
                  const tone =
                    n.severity === 'CRITICAL'
                      ? 'bg-red-500'
                      : n.severity === 'WARNING'
                        ? 'bg-amber-500'
                        : 'bg-blue-500';
                  const content = (
                    <div className="px-3 py-2 hover:bg-muted/50">
                      <div className="flex items-start gap-2">
                        <span className={cn('mt-1 h-2 w-2 rounded-full flex-shrink-0', tone)} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium truncate">{n.title}</div>
                            <span
                              className={cn(
                                'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                                n.readAt
                                  ? 'bg-muted text-muted-foreground'
                                  : 'bg-blue-100 text-blue-700',
                              )}
                            >
                              {n.readAt ? 'Seen' : 'Unseen'}
                            </span>
                          </div>
                          {n.body && (
                            <div className="text-xs text-muted-foreground line-clamp-2">{n.body}</div>
                          )}
                          <div className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider">
                            {n.module}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                  return (
                    <li key={n.id}>
                      {n.href ? (
                        <Link
                          href={n.href}
                          onClick={() => {
                            void markSeen(n.id);
                            setOpen(false);
                          }}
                        >
                          {content}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          className="w-full text-left"
                          onClick={() => void markSeen(n.id)}
                        >
                          {content}
                        </button>
                      )}
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
