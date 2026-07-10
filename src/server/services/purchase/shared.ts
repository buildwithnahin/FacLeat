import { Prisma, type SystemAccountKey, type ProductType } from '@prisma/client';

export const INVENTORY_KEY_BY_PRODUCT_TYPE: Record<ProductType, SystemAccountKey> = {
  RAW_MATERIAL: 'INVENTORY_RAW_MATERIAL',
  FINISHED_GOOD: 'INVENTORY_FINISHED_GOODS',
  WORK_IN_PROGRESS: 'WIP',
  CONSUMABLE: 'INVENTORY',
  SERVICE: 'PURCHASE_EXPENSE',
};

export const ZERO = new Prisma.Decimal(0);

export function computeLineTotal(
  qty: Prisma.Decimal,
  price: Prisma.Decimal,
  taxRate: Prisma.Decimal,
  discountRate: Prisma.Decimal,
) {
  const gross = qty.mul(price);
  const discount = gross.mul(discountRate).div(100);
  const afterDiscount = gross.minus(discount);
  const tax = afterDiscount.mul(taxRate).div(100);
  return { gross, discount, tax, total: afterDiscount.plus(tax) };
}

export function isShoesCategory(name: string | null | undefined) {
  return name?.trim().toLowerCase() === 'shoes';
}

export function normalizeSize(size: string | null | undefined) {
  const value = size?.trim();
  return value ? value : null;
}
