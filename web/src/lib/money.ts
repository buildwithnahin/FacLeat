import { Decimal as DecimalJs } from 'decimal.js';

// Prisma's `Prisma.Decimal` is decimal.js re-exported — importing decimal.js
// directly here (instead of `@prisma/client`) gives the exact same type and
// runtime behavior without pulling Prisma's client (and its Node-only
// engine) into the browser bundle. Backend API responses still serialize
// Decimal fields as plain numbers/strings over JSON either way, so nothing
// about the wire format changes.
export const Decimal = DecimalJs;
export type Decimal = DecimalJs;

export type DecimalValue = string | number | Decimal;

export function d(v: DecimalValue): Decimal {
  return new DecimalJs(v);
}

export function sumDecimal(values: DecimalValue[]): Decimal {
  return values.reduce<Decimal>((acc, v) => acc.plus(v), new DecimalJs(0));
}

export type CurrencyCode = 'BDT' | 'INR' | 'USD' | 'EUR';

const SYMBOL: Record<CurrencyCode, string> = {
  BDT: '৳',
  INR: '₹',
  USD: '$',
  EUR: '€',
};

const LOCALE: Record<CurrencyCode, string> = {
  BDT: 'en-BD',
  INR: 'en-IN',
  USD: 'en-US',
  EUR: 'en-GB',
};

export function formatCurrency(
  value: DecimalValue,
  currency: CurrencyCode = 'BDT',
  opts: Intl.NumberFormatOptions = {},
): string {
  const n = typeof value === 'object' && 'toNumber' in value ? value.toNumber() : Number(value);
  const formatted = new Intl.NumberFormat(LOCALE[currency], {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...opts,
  }).format(n);
  return `${SYMBOL[currency]}${formatted}`;
}
