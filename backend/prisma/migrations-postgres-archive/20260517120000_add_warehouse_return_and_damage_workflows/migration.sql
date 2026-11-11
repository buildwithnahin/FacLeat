CREATE TYPE "CustomerReturnStatus" AS ENUM (
  'PENDING_INSPECTION',
  'INSPECTED',
  'COMPLETED',
  'REJECTED'
);

CREATE TYPE "CustomerReturnDisposition" AS ENUM (
  'RESTOCK',
  'REWORK',
  'DAMAGED',
  'REJECT'
);

CREATE TYPE "ReturnFinanceAction" AS ENUM (
  'NONE',
  'REFUND',
  'EXCHANGE',
  'CREDIT_ADJUSTMENT'
);

CREATE TYPE "DamageReportStatus" AS ENUM (
  'REPORTED',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'RESOLVED'
);

CREATE TYPE "DamageResolution" AS ENUM (
  'SCRAP',
  'REPAIR',
  'B_GRADE',
  'SUPPLIER_CLAIM'
);

CREATE TABLE "CustomerReturn" (
  "id" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "inspectionWarehouseId" TEXT NOT NULL,
  "sourceDocumentType" TEXT,
  "sourceDocumentNumber" TEXT,
  "customerName" TEXT,
  "customerPhone" TEXT,
  "returnDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" "CustomerReturnStatus" NOT NULL DEFAULT 'PENDING_INSPECTION',
  "financeAction" "ReturnFinanceAction" NOT NULL DEFAULT 'NONE',
  "financeNote" TEXT,
  "intakeNote" TEXT,
  "inspectionNote" TEXT,
  "createdById" TEXT,
  "inspectedById" TEXT,
  "inspectedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomerReturn_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerReturnItem" (
  "id" TEXT NOT NULL,
  "returnId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" DECIMAL(18,4) NOT NULL,
  "disposition" "CustomerReturnDisposition",
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerReturnItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DamageReport" (
  "id" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "quarantineWarehouseId" TEXT NOT NULL,
  "reportDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reason" TEXT NOT NULL,
  "note" TEXT,
  "status" "DamageReportStatus" NOT NULL DEFAULT 'REPORTED',
  "estimatedValue" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
  "resolution" "DamageResolution",
  "resolutionNote" TEXT,
  "reportedById" TEXT,
  "resolvedById" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DamageReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DamageReportItem" (
  "id" TEXT NOT NULL,
  "reportId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" DECIMAL(18,4) NOT NULL,
  "costPerUnit" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DamageReportItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerReturn_number_key" ON "CustomerReturn"("number");
CREATE UNIQUE INDEX "DamageReport_number_key" ON "DamageReport"("number");

CREATE INDEX "CustomerReturn_branchId_returnDate_idx" ON "CustomerReturn"("branchId", "returnDate");
CREATE INDEX "CustomerReturn_status_createdAt_idx" ON "CustomerReturn"("status", "createdAt");
CREATE INDEX "CustomerReturnItem_returnId_idx" ON "CustomerReturnItem"("returnId");
CREATE INDEX "CustomerReturnItem_productId_idx" ON "CustomerReturnItem"("productId");

CREATE INDEX "DamageReport_branchId_reportDate_idx" ON "DamageReport"("branchId", "reportDate");
CREATE INDEX "DamageReport_status_createdAt_idx" ON "DamageReport"("status", "createdAt");
CREATE INDEX "DamageReportItem_reportId_idx" ON "DamageReportItem"("reportId");
CREATE INDEX "DamageReportItem_productId_idx" ON "DamageReportItem"("productId");

ALTER TABLE "CustomerReturn"
ADD CONSTRAINT "CustomerReturn_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CustomerReturn"
ADD CONSTRAINT "CustomerReturn_warehouseId_fkey"
FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CustomerReturn"
ADD CONSTRAINT "CustomerReturn_inspectionWarehouseId_fkey"
FOREIGN KEY ("inspectionWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CustomerReturnItem"
ADD CONSTRAINT "CustomerReturnItem_returnId_fkey"
FOREIGN KEY ("returnId") REFERENCES "CustomerReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomerReturnItem"
ADD CONSTRAINT "CustomerReturnItem_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DamageReport"
ADD CONSTRAINT "DamageReport_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DamageReport"
ADD CONSTRAINT "DamageReport_warehouseId_fkey"
FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DamageReport"
ADD CONSTRAINT "DamageReport_quarantineWarehouseId_fkey"
FOREIGN KEY ("quarantineWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DamageReportItem"
ADD CONSTRAINT "DamageReportItem_reportId_fkey"
FOREIGN KEY ("reportId") REFERENCES "DamageReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DamageReportItem"
ADD CONSTRAINT "DamageReportItem_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
