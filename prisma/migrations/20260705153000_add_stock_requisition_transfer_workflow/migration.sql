CREATE TYPE "StockRequisitionStatus" AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'WAREHOUSE_ASSIGNED',
  'PICKING',
  'PACKED',
  'DISPATCHED',
  'IN_TRANSIT',
  'RECEIVED',
  'COMPLETED',
  'CANCELLED'
);

CREATE TYPE "StockTransferStatus" AS ENUM (
  'DRAFT',
  'PICKING',
  'PACKED',
  'DISPATCHED',
  'IN_TRANSIT',
  'RECEIVED',
  'COMPLETED',
  'CANCELLED'
);

CREATE TABLE "StockRequisition" (
  "id" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "showroomWarehouseId" TEXT NOT NULL,
  "sourceWarehouseId" TEXT,
  "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
  "requiredDate" DATE NOT NULL,
  "status" "StockRequisitionStatus" NOT NULL DEFAULT 'SUBMITTED',
  "remarks" TEXT,
  "approvalNote" TEXT,
  "rejectionReason" TEXT,
  "requestedById" TEXT,
  "approvedById" TEXT,
  "rejectedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StockRequisition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StockRequisitionItem" (
  "id" TEXT NOT NULL,
  "requisitionId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "unit" "UnitOfMeasure" NOT NULL DEFAULT 'PCS',
  "requestedQty" DECIMAL(18,4) NOT NULL,
  "approvedQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "dispatchedQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "receivedQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StockRequisitionItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StockTransfer" (
  "id" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "requisitionId" TEXT NOT NULL,
  "fromBranchId" TEXT NOT NULL,
  "toBranchId" TEXT NOT NULL,
  "fromWarehouseId" TEXT NOT NULL,
  "toWarehouseId" TEXT NOT NULL,
  "status" "StockTransferStatus" NOT NULL DEFAULT 'PICKING',
  "expectedDate" DATE,
  "packedBy" TEXT,
  "vehicle" TEXT,
  "driverName" TEXT,
  "driverPhone" TEXT,
  "gatePassNo" TEXT,
  "trackingNo" TEXT,
  "remarks" TEXT,
  "dispatchNote" TEXT,
  "receiveRemarks" TEXT,
  "createdById" TEXT,
  "dispatchedById" TEXT,
  "receivedById" TEXT,
  "dispatchDate" TIMESTAMP(3),
  "receivedDate" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StockTransfer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StockTransferItem" (
  "id" TEXT NOT NULL,
  "transferId" TEXT NOT NULL,
  "requisitionItemId" TEXT,
  "productId" TEXT NOT NULL,
  "quantity" DECIMAL(18,4) NOT NULL,
  "receivedQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "damagedQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "missingQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StockTransferItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StockRequisition_number_key" ON "StockRequisition"("number");
CREATE INDEX "StockRequisition_branchId_status_createdAt_idx" ON "StockRequisition"("branchId", "status", "createdAt");
CREATE INDEX "StockRequisition_showroomWarehouseId_status_idx" ON "StockRequisition"("showroomWarehouseId", "status");
CREATE INDEX "StockRequisition_sourceWarehouseId_status_idx" ON "StockRequisition"("sourceWarehouseId", "status");

CREATE INDEX "StockRequisitionItem_requisitionId_idx" ON "StockRequisitionItem"("requisitionId");
CREATE INDEX "StockRequisitionItem_productId_idx" ON "StockRequisitionItem"("productId");

CREATE UNIQUE INDEX "StockTransfer_number_key" ON "StockTransfer"("number");
CREATE INDEX "StockTransfer_requisitionId_status_idx" ON "StockTransfer"("requisitionId", "status");
CREATE INDEX "StockTransfer_fromWarehouseId_status_idx" ON "StockTransfer"("fromWarehouseId", "status");
CREATE INDEX "StockTransfer_toWarehouseId_status_idx" ON "StockTransfer"("toWarehouseId", "status");

CREATE INDEX "StockTransferItem_transferId_idx" ON "StockTransferItem"("transferId");
CREATE INDEX "StockTransferItem_productId_idx" ON "StockTransferItem"("productId");

ALTER TABLE "StockRequisition"
  ADD CONSTRAINT "StockRequisition_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StockRequisition"
  ADD CONSTRAINT "StockRequisition_showroomWarehouseId_fkey"
  FOREIGN KEY ("showroomWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StockRequisition"
  ADD CONSTRAINT "StockRequisition_sourceWarehouseId_fkey"
  FOREIGN KEY ("sourceWarehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StockRequisitionItem"
  ADD CONSTRAINT "StockRequisitionItem_requisitionId_fkey"
  FOREIGN KEY ("requisitionId") REFERENCES "StockRequisition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StockRequisitionItem"
  ADD CONSTRAINT "StockRequisitionItem_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StockTransfer"
  ADD CONSTRAINT "StockTransfer_requisitionId_fkey"
  FOREIGN KEY ("requisitionId") REFERENCES "StockRequisition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StockTransfer"
  ADD CONSTRAINT "StockTransfer_fromBranchId_fkey"
  FOREIGN KEY ("fromBranchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StockTransfer"
  ADD CONSTRAINT "StockTransfer_toBranchId_fkey"
  FOREIGN KEY ("toBranchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StockTransfer"
  ADD CONSTRAINT "StockTransfer_fromWarehouseId_fkey"
  FOREIGN KEY ("fromWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StockTransfer"
  ADD CONSTRAINT "StockTransfer_toWarehouseId_fkey"
  FOREIGN KEY ("toWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StockTransferItem"
  ADD CONSTRAINT "StockTransferItem_transferId_fkey"
  FOREIGN KEY ("transferId") REFERENCES "StockTransfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StockTransferItem"
  ADD CONSTRAINT "StockTransferItem_requisitionItemId_fkey"
  FOREIGN KEY ("requisitionItemId") REFERENCES "StockRequisitionItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StockTransferItem"
  ADD CONSTRAINT "StockTransferItem_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
