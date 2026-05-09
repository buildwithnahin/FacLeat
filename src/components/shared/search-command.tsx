'use client';

import * as React from 'react';
import { Command } from 'cmdk';
import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { MODULES } from '@/constants/navigation';
import { cn } from '@/lib/utils';

export function SearchCommand({ permissions = [] }: { permissions?: string[] }) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const allowed = React.useMemo(() => new Set(permissions), [permissions]);
  const items = React.useMemo(() => {
    const can = (permission?: string) => !permission || allowed.has(permission);
    return MODULES.flatMap((module) => {
      if (!can(module.permission)) return [];
      const moduleItem = [{ label: module.label, href: module.href }];
      const children = module.items?.filter((item) => can(item.permission)).map((item) => ({
        label: `${module.label} / ${item.label}`,
        href: item.href,
      })) ?? [];
      return [...moduleItem, ...children];
    });
  }, [allowed]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative h-9 w-full rounded-md border bg-muted/40 pl-9 pr-3 text-left text-sm text-muted-foreground outline-none hover:bg-background focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
        Search
      </button>
      {open && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-hidden
            className="absolute inset-0 bg-black/30"
            onClick={() => setOpen(false)}
          />
          <Command
            className={cn(
              'relative mx-auto mt-24 w-[min(640px,calc(100vw-32px))] overflow-hidden rounded-md border bg-background shadow-xl',
            )}
          >
            <div className="flex items-center border-b px-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Command.Input
                autoFocus
                placeholder="Search"
                className="h-11 flex-1 bg-transparent px-3 text-sm outline-none"
              />
            </div>
            <Command.List className="max-h-80 overflow-y-auto p-2">
              <Command.Empty className="px-3 py-8 text-center text-sm text-muted-foreground">
                No results
              </Command.Empty>
              {items.map((item) => (
                <Command.Item
                  key={`${item.href}-${item.label}`}
                  value={`${item.label} ${item.href}`}
                  onSelect={() => go(item.href)}
                  className="cursor-pointer rounded-md px-3 py-2 text-sm aria-selected:bg-muted"
                >
                  <div className="font-medium">{item.label}</div>
                  <div className="text-xs text-muted-foreground">{item.href}</div>
                </Command.Item>
              ))}
            </Command.List>
          </Command>
        </div>
      )}
    </>
  );
}
