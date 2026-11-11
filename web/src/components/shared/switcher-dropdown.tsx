'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronDown, Loader2 } from 'lucide-react';

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
  onSelectUrl,
  fieldName,
}: {
  icon: React.ReactNode;
  triggerLabel: string;
  panelTitle: string;
  emptyLabel: string;
  items: SwitcherItem[];
  activeId?: string;
  onSelectUrl: string;
  fieldName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [currentActiveId, setCurrentActiveId] = useState(activeId);
  const [currentLabel, setCurrentLabel] = useState(triggerLabel);

  useEffect(() => {
    setCurrentActiveId(activeId);
  }, [activeId]);

  useEffect(() => {
    setCurrentLabel(triggerLabel);
  }, [triggerLabel]);

  function handleSelect(item: SwitcherItem) {
    if (pending || item.id === currentActiveId) {
      setOpen(false);
      return;
    }

    setCurrentActiveId(item.id);
    setCurrentLabel(item.name);
    setOpen(false);

    startTransition(async () => {
      const res = await fetch(onSelectUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [fieldName]: item.id }),
      });
      if (!res.ok) {
        setCurrentActiveId(activeId);
        setCurrentLabel(triggerLabel);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={currentLabel}
        disabled={pending}
        className="inline-flex h-9 items-center gap-2 rounded-md border bg-background px-2 text-sm hover:bg-muted/50 disabled:cursor-wait disabled:opacity-70 sm:px-3"
      >
        {icon}
        <span className="hidden max-w-[10rem] truncate font-medium sm:inline lg:max-w-[14rem]">
          {currentLabel}
        </span>
        {pending ? (
          <Loader2 className="hidden h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground sm:block" />
        ) : (
          <ChevronDown className="hidden h-3.5 w-3.5 shrink-0 text-muted-foreground sm:block" />
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-hidden
            className="fixed inset-0 z-20 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-30 mt-1 w-[min(220px,90vw)] rounded-md border bg-popover text-popover-foreground shadow-md">
            <div className="border-b px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground">
              {panelTitle}
            </div>
            <ul className="max-h-80 overflow-y-auto py-1">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => handleSelect(item)}
                    className={
                      'flex w-full items-start justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground disabled:cursor-wait disabled:opacity-70 ' +
                      (item.id === currentActiveId ? 'bg-muted/50 font-medium' : '')
                    }
                  >
                    <span className="min-w-0">
                      <span className="block">{item.name}</span>
                      <span className="block text-xs text-muted-foreground">{item.meta}</span>
                    </span>
                    {item.id === currentActiveId ? (
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : null}
                  </button>
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
