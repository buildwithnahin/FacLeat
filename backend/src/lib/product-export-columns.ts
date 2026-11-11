// Shared between the web app's product table column-picker UI and this
// backend's PDF/XLSX export routes — pure data, no framework dependency, so
// it lives in `lib/` rather than under a frontend-only or backend-only path.
export const PRODUCT_EXPORT_COLS = [
  { key: 'sku',          label: 'SKU' },
  { key: 'barcode',      label: 'Barcode' },
  { key: 'name',         label: 'Name' },
  { key: 'category',     label: 'Category' },
  { key: 'unit',         label: 'Unit' },
  { key: 'costPrice',    label: 'Buy Price' },
  { key: 'sellPrice',    label: 'Sell Price' },
  { key: 'reorderLevel', label: 'Reorder Level' },
  { key: 'availableQty', label: 'Available Qty' },
  { key: 'totalCost',    label: 'Total Cost' },
  { key: 'totalSell',    label: 'Total Sell Value' },
  { key: 'status',       label: 'Status' },
] as const;

export type ProductColKey = (typeof PRODUCT_EXPORT_COLS)[number]['key'];

export const ALL_PRODUCT_COL_KEYS: ProductColKey[] = PRODUCT_EXPORT_COLS.map(
  (c) => c.key as ProductColKey,
);
