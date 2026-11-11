'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const MobileNavContext = createContext<{ open: boolean; setOpen: (v: boolean) => void } | null>(
  null,
);

function useMobileNav() {
  const ctx = useContext(MobileNavContext);
  if (!ctx) throw new Error('useMobileNav must be used within MobileNavProvider');
  return ctx;
}

/** Wraps the shell body; owns the open/closed state and auto-closes the drawer on navigation. */
export function MobileNavProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <MobileNavContext.Provider value={{ open, setOpen }}>{children}</MobileNavContext.Provider>
  );
}

/** Hamburger button shown in the topbar below the `lg` breakpoint. */
export function SidebarToggleButton() {
  const { open, setOpen } = useMobileNav();
  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      aria-label={open ? 'Close navigation' : 'Open navigation'}
      aria-expanded={open}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-background text-foreground hover:bg-muted/50 lg:hidden"
    >
      {open ? <X className="h-4.5 w-4.5" /> : <Menu className="h-4.5 w-4.5" />}
    </button>
  );
}

/**
 * Renders the sidebar as an off-canvas drawer below `lg`, and as the normal
 * static/sticky column at `lg` and above — the desktop layout is unchanged.
 */
export function MobileSidebarFrame({ children }: { children: React.ReactNode }) {
  const { open, setOpen } = useMobileNav();
  return (
    <>
      {open && (
        <div
          aria-hidden
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-col overflow-hidden bg-sidebar text-sidebar-foreground transition-transform duration-200 ease-in-out',
          'lg:sticky lg:top-0 lg:z-auto lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {children}
      </aside>
    </>
  );
}
