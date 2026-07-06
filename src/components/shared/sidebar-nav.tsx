'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  ChevronDown,
  Search,
  LayoutDashboard,
  ScanBarcode,
  Boxes,
  Warehouse,
  Factory,
  ShoppingCart,
  Building2,
  Package,
  Globe,
  Ship,
  Truck,
  Users,
  Banknote,
  BookOpen,
  BarChart3,
  UserCog,
  History,
  Bell,
  Network,
  FileCheck2,
  ShieldCheck,
  FolderOpen,
  UsersRound,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  Scale,
  ListOrdered,
  ClipboardList,
  PackageCheck,
  Receipt,
  Wallet,
  Landmark,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  ScanBarcode,
  Boxes,
  Warehouse,
  Factory,
  ShoppingCart,
  Building2,
  Package,
  Globe,
  Ship,
  Truck,
  Users,
  Banknote,
  BookOpen,
  BarChart3,
  UserCog,
  History,
  Bell,
  Network,
  FileCheck2,
  ShieldCheck,
  FolderOpen,
  UsersRound,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  Scale,
  ListOrdered,
  ClipboardList,
  PackageCheck,
  Receipt,
  Wallet,
  Landmark,
};

export interface ClientNavItem {
  label: string;
  href?: string;
  iconName?: string;
  items?: ClientNavItem[];
}

export interface ClientNavModule {
  number: number;
  displayNumber?: number;
  label: string;
  href: string;
  iconName: string;
  items?: ClientNavItem[];
}

export function SidebarNav({ modules }: { modules: ClientNavModule[] }) {
  const pathname = usePathname() ?? '';

  const isItemActive = (item: ClientNavItem): boolean =>
    (!!item.href && pathname === item.href) || !!item.items?.some(isItemActive);

  const isModuleActive = (m: ClientNavModule) =>
    pathname === m.href || pathname.startsWith(m.href + '/') || !!m.items?.some(isItemActive);

  const [open, setOpen] = useState<Record<number, boolean>>(() => {
    const initial: Record<number, boolean> = {};
    for (const m of modules) {
      if (m.items && isModuleActive(m)) initial[m.number] = true;
    }
    return initial;
  });
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};

    const visit = (items: ClientNavItem[] | undefined, parentKey: string) => {
      for (const item of items ?? []) {
        const key = item.href ?? `${parentKey}/${item.label}`;
        if (item.items && isItemActive(item)) initial[key] = true;
        visit(item.items, key);
      }
    };

    for (const m of modules) visit(m.items, String(m.number));
    return initial;
  });
  const [query, setQuery] = useState('');

  const toggle = (n: number) => setOpen((s) => ({ ...s, [n]: !s[n] }));
  const toggleGroup = (key: string) => setOpenGroups((s) => ({ ...s, [key]: !s[key] }));

  const filterItems = (items: ClientNavItem[] | undefined, search: string): ClientNavItem[] | undefined => {
    const filtered = items
      ?.map((item) => {
        const itemHit = item.label.toLowerCase().includes(search);
        const matchingChildren = filterItems(item.items, search);
        if (itemHit) return item;
        if (matchingChildren?.length) return { ...item, items: matchingChildren };
        return null;
      })
      .filter((item): item is ClientNavItem => item !== null);

    return filtered && filtered.length > 0 ? filtered : undefined;
  };

  const q = query.trim().toLowerCase();
  const filtered = !q
    ? modules
    : modules
        .map((m) => {
          const moduleHit =
            m.label.toLowerCase().includes(q) ||
            String(m.displayNumber ?? m.number).includes(q);
          const matchingItems = filterItems(m.items, q);
          if (moduleHit) return m;
          if (matchingItems && matchingItems.length > 0) {
            return { ...m, items: matchingItems };
          }
          return null;
        })
        .filter((m): m is ClientNavModule => m !== null);

  const expandedForModule = (n: number, hasChildren: boolean) => {
    if (!hasChildren) return false;
    if (q) return true;
    return !!open[n];
  };

  const renderItems = (items: ClientNavItem[], parentKey: string, depth = 0) => (
    <ul
      className={cn(
        'mt-0.5 space-y-0.5 border-l border-white/10 pl-2',
        depth === 0 ? 'ml-8' : 'ml-3',
      )}
    >
      {items.map((item) => {
        const key = item.href ?? `${parentKey}/${item.label}`;
        const hasChildren = !!item.items?.length;
        const active = isItemActive(item);
        const isOpen = q || !!openGroups[key];

        if (hasChildren) {
          return (
            <li key={key}>
              <button
                type="button"
                onClick={() => toggleGroup(key)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors',
                  active ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white',
                )}
              >
                <span className="flex-1 truncate text-left">{item.label}</span>
                <ChevronDown
                  className={cn(
                    'h-3.5 w-3.5 shrink-0 transition-transform',
                    isOpen ? 'rotate-180' : 'rotate-0',
                  )}
                />
              </button>
              {isOpen && renderItems(item.items!, key, depth + 1)}
            </li>
          );
        }

        return (
          <li key={key}>
            <Link
              href={item.href ?? '#'}
              className={cn(
                'block rounded-md px-2 py-1.5 text-[13px] transition-colors',
                active ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white',
              )}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <nav className="flex-1 flex flex-col min-h-0 py-3 px-2">
      <div className="relative mb-2 px-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search modules…"
          className="w-full h-8 pl-8 pr-2 rounded-md bg-white/5 border border-white/10 text-xs text-white placeholder:text-white/40 outline-none focus:bg-white/10 focus:border-white/20"
        />
      </div>
      <ul className="sidebar-scrollbar flex-1 overflow-y-auto space-y-0.5 pr-1">
        {filtered.length === 0 && (
          <li className="px-2 py-4 text-center text-xs text-white/40">No matches</li>
        )}
        {filtered.map((m) => {
          const Icon = ICONS[m.iconName];
          const active = isModuleActive(m);
          const hasChildren = !!m.items && m.items.length > 0;
          const isOpen = expandedForModule(m.number, hasChildren);

          const numberBadge = (
            <span
              className={cn(
                'shrink-0 w-6 h-5 rounded text-[10px] font-semibold grid place-items-center tabular-nums',
                active ? 'bg-white/20 text-white' : 'bg-white/5 text-white/50',
              )}
            >
              {m.displayNumber ?? m.number}
            </span>
          );

          const rowClasses = cn(
            'group w-full flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors',
            active ? 'bg-primary/90 text-white' : 'text-white/80 hover:bg-white/5 hover:text-white',
          );

          return (
            <li key={m.number}>
              {hasChildren ? (
                <button type="button" onClick={() => toggle(m.number)} className={rowClasses}>
                  {numberBadge}
                  {Icon && <Icon className="h-4 w-4 shrink-0" />}
                  <span className="flex-1 text-left truncate">{m.label}</span>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 shrink-0 transition-transform',
                      isOpen ? 'rotate-180' : 'rotate-0',
                    )}
                  />
                </button>
              ) : (
                <Link href={m.href} className={rowClasses}>
                  {numberBadge}
                  {Icon && <Icon className="h-4 w-4 shrink-0" />}
                  <span className="flex-1 truncate">{m.label}</span>
                </Link>
              )}

              {hasChildren && isOpen && (
                renderItems(m.items!, String(m.number))
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
