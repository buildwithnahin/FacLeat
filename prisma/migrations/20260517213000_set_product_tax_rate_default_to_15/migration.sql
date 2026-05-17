-- Set product VAT default to 15% and backfill existing zero-rated products.
ALTER TABLE "Product"
ALTER COLUMN "taxRate" SET DEFAULT 15;

UPDATE "Product"
SET "taxRate" = 15
WHERE "taxRate" = 0;
