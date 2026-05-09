-- CreateTable
CREATE TABLE "OpeningBalanceEntry" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "periodId" TEXT,
    "accountId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "normalSide" "AccountNormalSide" NOT NULL,
    "reference" TEXT,
    "remarks" TEXT,
    "sourceRefType" TEXT,
    "sourceRefId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpeningBalanceEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OpeningBalanceEntry_branchId_date_idx" ON "OpeningBalanceEntry"("branchId", "date");

-- CreateIndex
CREATE INDEX "OpeningBalanceEntry_periodId_idx" ON "OpeningBalanceEntry"("periodId");

-- CreateIndex
CREATE INDEX "OpeningBalanceEntry_accountId_date_idx" ON "OpeningBalanceEntry"("accountId", "date");

-- CreateIndex
CREATE INDEX "OpeningBalanceEntry_sourceRefType_sourceRefId_idx" ON "OpeningBalanceEntry"("sourceRefType", "sourceRefId");

-- AddForeignKey
ALTER TABLE "OpeningBalanceEntry" ADD CONSTRAINT "OpeningBalanceEntry_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpeningBalanceEntry" ADD CONSTRAINT "OpeningBalanceEntry_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpeningBalanceEntry" ADD CONSTRAINT "OpeningBalanceEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ChartAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed a branch cash opening balance of 1,000,000 effective on 1 April 2026.
INSERT INTO "OpeningBalanceEntry" (
    "id",
    "branchId",
    "accountId",
    "date",
    "amount",
    "normalSide",
    "reference",
    "remarks",
    "sourceRefType",
    "sourceRefId",
    "createdAt",
    "updatedAt"
)
SELECT
    'opening-balance-2026-04-01',
    b."id",
    sam."accountId",
    TIMESTAMP '2026-04-01 00:00:00',
    1000000.0000,
    'DEBIT'::"AccountNormalSide",
    'OB-2026-04-01',
    'Opening balance seeded for cash flow',
    'SEED',
    'opening-balance-2026-04-01',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Branch" b
JOIN "SystemAccountMapping" sam
  ON sam."branchId" = b."id"
 AND sam."key" = 'CASH'
WHERE (
    b."name" = 'Headquarters'
    OR b."code" = 'HQ'
)
AND NOT EXISTS (
    SELECT 1
    FROM "OpeningBalanceEntry" obe
    WHERE obe."sourceRefType" = 'SEED'
      AND obe."sourceRefId" = 'opening-balance-2026-04-01'
      AND obe."branchId" = b."id"
)
LIMIT 1;
