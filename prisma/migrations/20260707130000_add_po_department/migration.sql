-- Add department to PurchaseOrder for department-level purchase analytics.
-- Copied from the linked PurchaseRequisition.department at creation time when
-- a PO originates from a PR; standalone POs stay NULL ("Unassigned" in reports).
ALTER TABLE "PurchaseOrder" ADD COLUMN "department" TEXT;
