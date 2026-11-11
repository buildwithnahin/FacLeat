'use client';

import * as React from 'react';
import { Command } from 'cmdk';
import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { ClientNavItem, ClientNavModule } from '@/components/shared/sidebar-nav';
import { cn } from '@/lib/utils';

type SearchItem = { label: string; href: string };

export function SearchCommand({ modules }: { modules: ClientNavModule[] }) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const items = React.useMemo(() => {
    const flattenItems = (
      moduleLabel: string,
      navItems: ClientNavItem[] | undefined,
      parents: string[] = [],
    ): SearchItem[] =>
      navItems?.flatMap((item) => {
        const path = [...parents, item.label];
        const current = item.href
          ? [{ label: `${moduleLabel} / ${path.join(' / ')}`, href: item.href }]
          : [];
        return [...current, ...flattenItems(moduleLabel, item.items, path)];
      }) ?? [];

    return modules.flatMap((module) => {
      const moduleItem: SearchItem[] = [{ label: module.label, href: module.href }];
      const children = flattenItems(module.label, module.items);
      return [...moduleItem, ...children];
    });
  }, [modules]);

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
