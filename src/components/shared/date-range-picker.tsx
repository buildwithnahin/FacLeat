'use client';

import * as React from 'react';
import { CalendarDays, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface DateRangeValue {
  from?: string;
  to?: string;
}

export interface DateRangePickerProps {
  value?: DateRangeValue;
  onChange?: (value: DateRangeValue) => void;
  className?: string;
}

export function DateRangePicker({ value, onChange, className }: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [inner, setInner] = React.useState<DateRangeValue>(value ?? {});
  const current = value ?? inner;
  const label =
    current.from || current.to
      ? `${current.from ?? 'Start'} - ${current.to ?? 'End'}`
      : 'Date range';

  const setValue = (next: DateRangeValue) => {
    if (!value) setInner(next);
    onChange?.(next);
  };

  return (
    <div className={cn('relative inline-block', className)}>
      <Button type="button" variant="outline" onClick={() => setOpen((v) => !v)}>
        <CalendarDays className="h-4 w-4" />
        <span className="max-w-48 truncate">{label}</span>
      </Button>
      {open && (
        <>
          <button
            type="button"
            aria-hidden
            className="fixed inset-0 z-20 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-30 mt-2 w-72 rounded-md border bg-background p-3 shadow-lg">
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="date"
                value={current.from ?? ''}
                onChange={(event) => setValue({ ...current, from: event.target.value || undefined })}
              />
              <Input
                type="date"
                value={current.to ?? ''}
                onChange={(event) => setValue({ ...current, to: event.target.value || undefined })}
              />
            </div>
            <div className="mt-3 flex items-center justify-between">
              <Button type="button" size="sm" variant="ghost" onClick={() => setValue({})}>
                <X className="h-4 w-4" />
                Clear
              </Button>
              <Button type="button" size="sm" onClick={() => setOpen(false)}>
                Apply
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
