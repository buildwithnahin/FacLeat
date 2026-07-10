import { NextRequest } from 'next/server';
import ExcelJS from 'exceljs';
import { getSession } from '@/server/auth/session';
import { productService } from '@/server/services/product.service';
import {
  PRODUCT_EXPORT_COLS,
  ALL_PRODUCT_COL_KEYS,
  type ProductColKey,
} from '@/app/(app)/inventory/products/product-columns';

type ProductRow = Awaited<ReturnType<typeof productService.list>>[number];

const NUMERIC_COLS = new Set<ProductColKey>([
  'costPrice',
  'sellPrice',
  'reorderLevel',
  'availableQty',
  'totalCost',
  'totalSell',
]);

function getValue(p: ProductRow, col: ProductColKey): string | number {
  const qty = p.availableQty.toNumber();
  const cost = p.costPrice.toNumber();
  const sell = p.sellPrice.toNumber();
  switch (col) {
    case 'sku':          return p.sku;
    case 'barcode':      return p.barcode ?? '';
    case 'name':         return p.name;
    case 'category':     return p.category?.name ?? 'Uncategorized';
    case 'unit':         return p.unit;
    case 'costPrice':    return cost;
    case 'sellPrice':    return sell;
    case 'reorderLevel': return p.reorderLevel.toNumber();
    case 'availableQty': return qty;
    case 'totalCost':    return parseFloat((cost * qty).toFixed(4));
    case 'totalSell':    return parseFloat((sell * qty).toFixed(4));
    case 'status':       return p.isActive ? 'Active' : 'Inactive';
  }
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  const sp = req.nextUrl.searchParams;
  const colsParam = sp.get('cols');

  const cols: ProductColKey[] = colsParam
    ? (colsParam
        .split(',')
        .filter((k): k is ProductColKey =>
          ALL_PRODUCT_COL_KEYS.includes(k as ProductColKey),
        ))
    : [...ALL_PRODUCT_COL_KEYS];

  const products = await productService.list(session);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'DeshIT-BD SME ERP';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Products');

  // Set column widths
  sheet.columns = cols.map((k) => ({
    key: k,
    header: PRODUCT_EXPORT_COLS.find((c) => c.key === k)!.label,
    width: NUMERIC_COLS.has(k) ? 16 : k === 'name' ? 32 : 18,
  }));

  // Style header row
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FF111827' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE5E7EB' },
  };
  headerRow.border = { bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } } };
  headerRow.alignment = { vertical: 'middle' };
  headerRow.height = 20;

  // Add data rows
  for (const p of products) {
    const rowData: Record<string, string | number> = {};
    for (const col of cols) rowData[col] = getValue(p, col);
    const row = sheet.addRow(rowData);
    // Right-align numeric columns
    for (let i = 0; i < cols.length; i++) {
      if (NUMERIC_COLS.has(cols[i])) {
        row.getCell(i + 1).alignment = { horizontal: 'right' };
        row.getCell(i + 1).numFmt = '#,##0.00';
      }
    }
  }

  // Freeze first row
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  // Auto-filter
  if (products.length > 0) {
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: cols.length },
    };
  }

  const buffer = await workbook.xlsx.writeBuffer();

  return new Response(buffer as ArrayBuffer, {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="products.xlsx"',
      'Cache-Control': 'private, max-age=0',
    },
  });
}
