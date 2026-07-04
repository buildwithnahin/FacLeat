import type { ProductType, WarehouseType } from '@prisma/client';

export const INVENTORY_SECTION_SLUGS = [
  'raw-material',
  'work-in-progress',
  'finished-goods',
] as const;

export type InventorySectionSlug = (typeof INVENTORY_SECTION_SLUGS)[number];

export const INVENTORY_SECTION_META: Record<
  InventorySectionSlug,
  {
    label: string;
    shortLabel: string;
    description: string;
  }
> = {
  'raw-material': {
    label: 'Raw Material',
    shortLabel: 'RM',
    description: 'Purchase, receive, issue, transfer, and stock balance for production inputs.',
  },
  'work-in-progress': {
    label: 'Work In Progress',
    shortLabel: 'WIP',
    description: 'Production issue, production receive, and process tracking for semi-finished stock.',
  },
  'finished-goods': {
    label: 'Finished Goods',
    shortLabel: 'FG',
    description: 'Finished-goods receive, warehouse stock, delivery, sales dispatch, and stock reports.',
  },
};

export function parseInventorySection(value?: string | null): InventorySectionSlug | null {
  if (!value) return null;
  return INVENTORY_SECTION_SLUGS.includes(value as InventorySectionSlug)
    ? (value as InventorySectionSlug)
    : null;
}

export function matchesInventorySection(params: {
  section: InventorySectionSlug;
  productType?: ProductType | null;
  warehouseType?: WarehouseType | null;
}) {
  const { section, productType, warehouseType } = params;

  switch (section) {
    case 'raw-material':
      return productType === 'RAW_MATERIAL' && warehouseType !== 'WIP';
    case 'work-in-progress':
      return warehouseType === 'WIP' || productType === 'WORK_IN_PROGRESS';
    case 'finished-goods':
      return productType === 'FINISHED_GOOD' && warehouseType !== 'WIP';
  }
}
