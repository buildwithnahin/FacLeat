export type VatMode = 'A' | 'B' | 'C';

export const VAT_MODE_LABELS: Record<
  VatMode,
  {
    title: string;
    description: string;
    formula: string;
    totalsLabel: string;
  }
> = {
  A: {
    title: 'Exclusive VAT',
    description: 'VAT is added separately on top of the base amount.',
    formula: 'VAT = A × r / 100, Final = A + VAT',
    totalsLabel: 'Base + VAT',
  },
  B: {
    title: 'Inclusive VAT',
    description: 'The total already includes VAT, so base and VAT are extracted from the final amount.',
    formula: 'Base = A × 100 / (100 + r), VAT = A - Base',
    totalsLabel: 'Included VAT',
  },
  C: {
    title: 'No VAT',
    description: 'VAT is ignored completely. Base and final amount stay the same.',
    formula: 'VAT = 0, Base = A, Final = A',
    totalsLabel: 'No VAT',
  },
};

export interface Mushak63InputLine {
  sku: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discountRate: number; // percentage 0-100
  taxRate: number;      // percentage e.g. 15
}

export interface Mushak63Line {
  sku: string;
  description: string;
  quantity: number;
  unit: string;
  grossValue: number;
  discount: number;
  baseValue: number;
  vatRate: number;
  vatAmount: number;
  lineTotal: number;
}

export interface VatBreakdown {
  grossValue: number;
  discount: number;
  baseValue: number;
  vatRate: number;
  vatAmount: number;
  lineTotal: number;
}

export interface Mushak63Result {
  mode: VatMode;
  lines: Mushak63Line[];
  subtotalBase: number;
  totalVat: number;
  grandTotal: number;
}

export function computeVatBreakdown(
  amount: number,
  discountRate: number,
  taxRate: number,
  mode: VatMode,
): VatBreakdown {
  const grossValue = amount;
  const discount = grossValue * (discountRate / 100);
  const afterDiscount = grossValue - discount;
  const vatRate = mode === 'C' ? 0 : taxRate;

  let baseValue: number;
  let vatAmount: number;

  if (mode === 'A') {
    baseValue = afterDiscount;
    vatAmount = baseValue * (vatRate / 100);
  } else if (mode === 'B') {
    baseValue = vatRate > 0 ? (afterDiscount * 100) / (100 + vatRate) : afterDiscount;
    vatAmount = afterDiscount - baseValue;
  } else {
    baseValue = afterDiscount;
    vatAmount = 0;
  }

  return {
    grossValue: round4(grossValue),
    discount: round4(discount),
    baseValue: round4(baseValue),
    vatRate: round4(vatRate),
    vatAmount: round4(vatAmount),
    lineTotal: round4(baseValue + vatAmount),
  };
}

export function computeMushak63(items: Mushak63InputLine[], mode: VatMode): Mushak63Result {
  const lines: Mushak63Line[] = items.map((item) => {
    const gross = item.quantity * item.unitPrice;
    const breakdown = computeVatBreakdown(gross, item.discountRate, item.taxRate, mode);

    return {
      sku: item.sku,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      grossValue: breakdown.grossValue,
      discount: breakdown.discount,
      baseValue: breakdown.baseValue,
      vatRate: breakdown.vatRate,
      vatAmount: breakdown.vatAmount,
      lineTotal: breakdown.lineTotal,
    };
  });

  const subtotalBase = round4(lines.reduce((a, l) => a + l.baseValue, 0));
  const totalVat = round4(lines.reduce((a, l) => a + l.vatAmount, 0));
  const grandTotal = round4(subtotalBase + totalVat);

  return { mode, lines, subtotalBase, totalVat, grandTotal };
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
