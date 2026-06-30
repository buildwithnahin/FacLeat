ALTER TABLE "DamageReport"
ADD COLUMN "supplierId" TEXT,
ADD COLUMN "grnId" TEXT,
ADD COLUMN "purchaseInvoiceId" TEXT,
ADD COLUMN "claimAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
ADD COLUMN "claimReference" TEXT;

CREATE INDEX "DamageReport_supplierId_idx" ON "DamageReport"("supplierId");

ALTER TABLE "DamageReport"
ADD CONSTRAINT "DamageReport_supplierId_fkey"
FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DamageReport"
ADD CONSTRAINT "DamageReport_grnId_fkey"
FOREIGN KEY ("grnId") REFERENCES "GoodsReceiving"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DamageReport"
ADD CONSTRAINT "DamageReport_purchaseInvoiceId_fkey"
FOREIGN KEY ("purchaseInvoiceId") REFERENCES "PurchaseInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
