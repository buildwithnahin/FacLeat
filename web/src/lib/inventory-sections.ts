// Mirrors the `ProductType`/`WarehouseType` Prisma enums (prisma/schema.prisma,
// owned by the backend). Declared locally as string-literal unions instead of
// importing `@prisma/client` — the web app never links against Prisma's
// client directly, only against the backend's JSON API — and this file only
// ever needs the shape, not the runtime enum object.
type ProductType = 'RAW_MATERIAL' | 'WORK_IN_PROGRESS' | 'FINISHED_GOOD' | 'CONSUMABLE' | 'SERVICE';
type WarehouseType = 'MAIN' | 'STORE' | 'WIP' | 'QUARANTINE' | 'DAMAGED' | 'SHOWROOM';

export const INVENTORY_SECTION_SLUGS = [
  'raw-material',
  'work-in-progress',
  'finished-goods',
  'consumables',
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
  consumables: {
    label: 'Consumables & Other',
    shortLabel: 'Other',
    description: 'Chemicals, accessories, packaging, tools, and other stock that isn\'t itself produced or sold.',
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
    case 'consumables':
      return (
        (productType === 'CONSUMABLE' || productType === 'SERVICE') && warehouseType !== 'WIP'
      );
  }
}
