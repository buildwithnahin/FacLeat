import { NextRequest } from 'next/server';
import { getSession } from '@/server/auth/session';
import { productService } from '@/server/services/product.service';
import { createSimplePdf, pdfResponse } from '@/server/pdf/simple-pdf';
import {
  PRODUCT_EXPORT_COLS,
  ALL_PRODUCT_COL_KEYS,
  type ProductColKey,
} from '@/lib/product-export-columns';

type ProductRow = Awaited<ReturnType<typeof productService.list>>[number];

function getValue(p: ProductRow, col: ProductColKey): string {
  const qty = p.availableQty.toNumber();
  const cost = p.costPrice.toNumber();
  const sell = p.sellPrice.toNumber();
  switch (col) {
    case 'sku':          return p.sku;
    case 'barcode':      return p.barcode ?? '-';
    case 'name':         return p.name;
    case 'category':     return p.category?.name ?? 'Uncategorized';
    case 'unit':         return p.unit;
    case 'costPrice':    return cost.toFixed(2);
    case 'sellPrice':    return sell.toFixed(2);
    case 'reorderLevel': return p.reorderLevel.toNumber().toFixed(2);
    case 'availableQty': return qty.toFixed(2);
    case 'totalCost':    return (cost * qty).toFixed(2);
    case 'totalSell':    return (sell * qty).toFixed(2);
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

  const headers = cols.map(
    (k) => PRODUCT_EXPORT_COLS.find((c) => c.key === k)!.label,
  );
  const rows = products.map((p) => cols.map((k) => getValue(p, k)));

  const bytes = await createSimplePdf({
    title: 'Products',
    subtitle: `Generated ${new Date().toISOString().slice(0, 10)} · ${products.length} record(s)`,
    sections: [{ title: 'Product List', table: { headers, rows } }],
  });

  return pdfResponse('products.pdf', bytes);
}
