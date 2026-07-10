'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SwitcherItem {
  id: string;
  name: string;
  meta: string;
}

/**
 * Click-toggle dropdown (not hover-reveal) so it works on touch devices —
 * shared by CompanySwitcher and BranchSwitcher.
 */
export function SwitcherDropdown({
  icon,
  triggerLabel,
  panelTitle,
  emptyLabel,
  items,
  activeId,
  action,
  fieldName,
}: {
  icon: React.ReactNode;
  triggerLabel: string;
  panelTitle: string;
  emptyLabel: string;
  items: SwitcherItem[];
  activeId?: string;
  action: (formData: FormData) => void | Promise<void>;
  fieldName: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-sm hover:bg-muted/50"
      >
        {icon}
        <span className="max-w-[8rem] truncate font-medium sm:max-w-[14rem]">{triggerLabel}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-hidden
            className="fixed inset-0 z-20 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-30 mt-1 min-w-[220px] rounded-md border bg-popover text-popover-foreground shadow-md">
            <div className="border-b px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground">
              {panelTitle}
            </div>
            <ul className="max-h-80 overflow-y-auto py-1">
              {items.map((item) => (
                <li key={item.id}>
                  <form action={action} onSubmit={() => setOpen(false)}>
                    <input type="hidden" name={fieldName} value={item.id} />
                    <button
                      type="submit"
                      className={
                        'w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground ' +
                        (item.id === activeId ? 'bg-muted/50 font-medium' : '')
                      }
                    >
                      <span className="block">{item.name}</span>
                      <span className="block text-xs text-muted-foreground">{item.meta}</span>
                    </button>
                  </form>
                </li>
              ))}
              {items.length === 0 && (
                <li className="px-3 py-6 text-center text-sm text-muted-foreground">{emptyLabel}</li>
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
