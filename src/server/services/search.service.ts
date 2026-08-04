import 'server-only';
import { prisma } from '@/server/db';
import { authorize } from '@/server/auth/authorize';
import { customerService } from '@/server/services/customer.service';
import { supplierService } from '@/server/services/supplier.service';
import { posService } from '@/server/services/pos.service';
import type { AppSession } from '@/server/auth/session';

export type GlobalSearchResult = {
  customers: Array<{
    id: string;
    name: string;
    code: string;
    phone: string | null;
    email: string | null;
  }>;
  suppliers: Array<{
    id: string;
    name: string;
    code: string;
    phone: string | null;
    email: string | null;
  }>;
  products: Array<{
    id: string;
    name: string;
    sku: string;
    barcode: string | null;
    sellPrice: string;
  }>;
  sales: Array<{
    id: string;
    number: string;
    customerName: string | null;
    grandTotal: string;
    status: string;
    saleDate: Date;
  }>;
  purchases: Array<{
    id: string;
    number: string;
    supplierName: string;
    grandTotal: string;
    status: string;
    invoiceDate: Date;
  }>;
};

const EMPTY_RESULT: GlobalSearchResult = {
  customers: [],
  suppliers: [],
  products: [],
  sales: [],
  purchases: [],
};

export const searchService = {
  async globalSearch(
    session: AppSession | null,
    query: string,
    limit = 8,
  ): Promise<GlobalSearchResult> {
    const q = query.trim();
    if (q.length < 2) return EMPTY_RESULT;

    const [customers, suppliers, products, sales, purchases] = await Promise.all([
      customerService
        .list(session, { search: q })
        .then((rows) =>
          rows.slice(0, limit).map((c) => ({
            id: c.id,
            name: c.name,
            code: c.code,
            phone: c.phone,
            email: c.email,
          })),
        ),
      supplierService
        .list(session, { search: q })
        .then((rows) =>
          rows.slice(0, limit).map((s) => ({
            id: s.id,
            name: s.name,
            code: s.code,
            phone: s.phone,
            email: s.email,
          })),
        ),
      searchProducts(session, q, limit),
      posService
        .listSales(session, { search: q, limit })
        .then((rows) =>
          rows.slice(0, limit).map((s) => ({
            id: s.id,
            number: s.number,
            customerName: s.customer?.name ?? null,
            grandTotal: s.grandTotal.toString(),
            status: s.status,
            saleDate: s.saleDate,
          })),
        ),
      searchPurchaseInvoices(session, q, limit),
    ]);

    return { customers, suppliers, products, sales, purchases };
  },
};

async function searchProducts(session: AppSession | null, query: string, limit: number) {
  if (!query) return [];
  await authorize(session, 'inventory:read');
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { sku: { contains: query, mode: 'insensitive' } },
        { barcode: { contains: query, mode: 'insensitive' } },
      ],
    },
    take: limit,
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      sku: true,
      barcode: true,
      sellPrice: true,
    },
  });
  return products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    barcode: p.barcode,
    sellPrice: p.sellPrice.toString(),
  }));
}

/**
 * Searches PurchaseInvoice, not PurchaseOrder — this codebase's actual
 * purchase data (seeded and real) lives on invoices; PurchaseOrder rows
 * are rarely if ever created by the flows currently in use, so searching
 * it left this category structurally empty. Invoice is also the more
 * useful thing for a superadmin to find ("did we pay this supplier?").
 */
async function searchPurchaseInvoices(session: AppSession | null, query: string, limit: number) {
  if (!query) return [];
  await authorize(session, 'purchase:read');
  const invoices = await prisma.purchaseInvoice.findMany({
    where: {
      OR: [
        { number: { contains: query, mode: 'insensitive' } },
        { supplier: { name: { contains: query, mode: 'insensitive' } } },
      ],
    },
    take: limit,
    orderBy: { invoiceDate: 'desc' },
    select: {
      id: true,
      number: true,
      grandTotal: true,
      status: true,
      invoiceDate: true,
      supplier: { select: { name: true } },
    },
  });
  return invoices.map((inv) => ({
    id: inv.id,
    number: inv.number,
    supplierName: inv.supplier.name,
    grandTotal: inv.grandTotal.toString(),
    status: inv.status,
    invoiceDate: inv.invoiceDate,
  }));
}
