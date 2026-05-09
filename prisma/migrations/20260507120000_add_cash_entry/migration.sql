-- CreateEnum
CREATE TYPE "CashEntryType" AS ENUM ('CASH_IN', 'CASH_OUT');

-- CreateTable
CREATE TABLE "CashEntry" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "type" "CashEntryType" NOT NULL,
    "branchId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DECIMAL(18,4) NOT NULL,
    "taxPercent" DECIMAL(5,2),
    "taxAmount" DECIMAL(18,4),
    "totalAmount" DECIMAL(18,4) NOT NULL,
    "contactId" TEXT,
    "contactName" TEXT,
    "contactType" TEXT,
    "receiveMode" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "reference" TEXT,
    "projectName" TEXT,
    "remarks" TEXT,
    "imageUrl" TEXT,
    "sourceModule" TEXT,
    "sourceRefType" TEXT,
    "sourceRefId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CashEntry_number_key" ON "CashEntry"("number");

-- CreateIndex
CREATE INDEX "CashEntry_branchId_date_idx" ON "CashEntry"("branchId", "date");

-- CreateIndex
CREATE INDEX "CashEntry_type_branchId_idx" ON "CashEntry"("type", "branchId");

-- CreateIndex
CREATE INDEX "CashEntry_contactId_idx" ON "CashEntry"("contactId");

-- AddForeignKey
ALTER TABLE "CashEntry" ADD CONSTRAINT "CashEntry_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashEntry" ADD CONSTRAINT "CashEntry_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
