'use client';

import * as React from 'react';
import Decimal from 'decimal.js';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface MoneyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'inputMode' | 'onChange'> {
  currency?: string;
  scale?: number;
  onValueChange?: (value: string) => void;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
}

function normalizeMoney(value: string, scale: number) {
  const cleaned = value.replace(/[^\d.]/g, '');
  const [whole = '', ...rest] = cleaned.split('.');
  const decimals = rest.join('').slice(0, scale);
  return decimals ? `${whole}.${decimals}` : whole;
}

export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ className, currency, scale = 2, value, defaultValue, onValueChange, onChange, onBlur, ...props }, ref) => {
    const [inner, setInner] = React.useState(String(defaultValue ?? ''));
    const controlled = value !== undefined;
    const current = String(controlled ? value : inner);

    return (
      <div className={cn('relative', className)}>
        {currency && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
            {currency}
          </span>
        )}
        <Input
          {...props}
          ref={ref}
          type="text"
          inputMode="decimal"
          value={current}
          className={cn(currency && 'pl-12')}
          onChange={(event) => {
            const next = normalizeMoney(event.target.value, scale);
            if (!controlled) setInner(next);
            onValueChange?.(next);
            if (next !== event.target.value) {
              event.currentTarget.value = next;
            }
            onChange?.(event);
          }}
          onBlur={(event) => {
            const next = event.target.value;
            if (next) {
              const fixed = new Decimal(next || 0).toFixed(scale);
              if (!controlled) setInner(fixed);
              onValueChange?.(fixed);
            }
            onBlur?.(event);
          }}
        />
      </div>
    );
  },
);
MoneyInput.displayName = 'MoneyInput';
