-- Add PENDING to PurchaseInvoiceStatus enum.
-- The real invoice lifecycle used everywhere in the app (createInvoice, supplier
-- payment lookups, dashboard KPIs, invoice list/detail pages) is
-- DRAFT -> PENDING -> PARTIALLY_PAID -> PAID/CANCELLED, but PENDING was
-- missing from the enum declaration itself.
ALTER TYPE "PurchaseInvoiceStatus" ADD VALUE 'PENDING';
