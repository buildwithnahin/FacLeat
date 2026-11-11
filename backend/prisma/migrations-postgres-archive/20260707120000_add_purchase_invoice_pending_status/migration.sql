-- No-op: PENDING was already present in PurchaseInvoiceStatus's original
-- CREATE TYPE list (see 20260417155013_phase3_suppliers_procurement). This
-- migration was originally written on the mistaken assumption it was
-- missing; corrected to a no-op so shadow-database replay and fresh
-- `migrate deploy` don't fail on a duplicate enum label.
SELECT 1;
