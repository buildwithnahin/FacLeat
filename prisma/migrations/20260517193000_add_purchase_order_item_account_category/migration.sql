CREATE TYPE "PurchaseAccountCategory" AS ENUM (
  'INVENTORY',
  'ADMINISTRATIVE_EXPENSE',
  'SALES_AND_DISTRIBUTIVE',
  'ASSET'
);

ALTER TABLE "PurchaseOrderItem"
ADD COLUMN "accountCategory" "PurchaseAccountCategory" NOT NULL DEFAULT 'INVENTORY';
