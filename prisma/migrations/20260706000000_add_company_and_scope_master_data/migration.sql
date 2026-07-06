-- Multi-company support: introduces the Company model as the new top-level
-- org unit above Branch, and scopes previously-global master data (Product,
-- ProductCategory, ProductBrand, AssetCategory, CustomerCategory) to a Company.
-- Also fixes 4 branch-scoped models (Supplier, Asset, Customer, Employee) whose
-- "code" field was globally unique instead of unique-per-branch.
--
-- A single default Company is created and all existing Branch/master-data rows
-- are backfilled onto it, so this migration is safe to run against the existing
-- seeded dataset without data loss.

-- 1. Company table
CREATE TABLE "Company" (
    "id"        TEXT NOT NULL,
    "code"      TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "address"   TEXT,
    "phone"     TEXT,
    "email"     TEXT,
    "currency"  "CurrencyCode" NOT NULL DEFAULT 'BDT',
    "isActive"  BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Company_code_key" ON "Company"("code");
CREATE INDEX "Company_isActive_idx" ON "Company"("isActive");

-- 2. Seed one default company to backfill onto
INSERT INTO "Company" ("id", "code", "name", "currency", "isActive", "createdAt", "updatedAt")
VALUES ('default-company', 'DEFAULT', 'Annex Leather', 'BDT', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 3. Branch.companyId
ALTER TABLE "Branch" ADD COLUMN "companyId" TEXT;
UPDATE "Branch" SET "companyId" = 'default-company';
ALTER TABLE "Branch" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Branch_companyId_idx" ON "Branch"("companyId");

-- 4. ProductCategory.companyId + scoped unique constraint
ALTER TABLE "ProductCategory" ADD COLUMN "companyId" TEXT;
UPDATE "ProductCategory" SET "companyId" = 'default-company';
ALTER TABLE "ProductCategory" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "ProductCategory_companyId_idx" ON "ProductCategory"("companyId");
DROP INDEX IF EXISTS "ProductCategory_name_key";
CREATE UNIQUE INDEX "ProductCategory_companyId_name_key" ON "ProductCategory"("companyId", "name");

-- 5. ProductBrand.companyId + scoped unique constraint
ALTER TABLE "ProductBrand" ADD COLUMN "companyId" TEXT;
UPDATE "ProductBrand" SET "companyId" = 'default-company';
ALTER TABLE "ProductBrand" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "ProductBrand" ADD CONSTRAINT "ProductBrand_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "ProductBrand_companyId_idx" ON "ProductBrand"("companyId");
DROP INDEX IF EXISTS "ProductBrand_name_key";
CREATE UNIQUE INDEX "ProductBrand_companyId_name_key" ON "ProductBrand"("companyId", "name");

-- 6. AssetCategory.companyId + scoped unique constraint
ALTER TABLE "AssetCategory" ADD COLUMN "companyId" TEXT;
UPDATE "AssetCategory" SET "companyId" = 'default-company';
ALTER TABLE "AssetCategory" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "AssetCategory" ADD CONSTRAINT "AssetCategory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "AssetCategory_companyId_idx" ON "AssetCategory"("companyId");
DROP INDEX IF EXISTS "AssetCategory_name_key";
CREATE UNIQUE INDEX "AssetCategory_companyId_name_key" ON "AssetCategory"("companyId", "name");

-- 7. CustomerCategory.companyId + scoped unique constraint
ALTER TABLE "CustomerCategory" ADD COLUMN "companyId" TEXT;
UPDATE "CustomerCategory" SET "companyId" = 'default-company';
ALTER TABLE "CustomerCategory" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "CustomerCategory" ADD CONSTRAINT "CustomerCategory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "CustomerCategory_companyId_idx" ON "CustomerCategory"("companyId");
DROP INDEX IF EXISTS "CustomerCategory_name_key";
CREATE UNIQUE INDEX "CustomerCategory_companyId_name_key" ON "CustomerCategory"("companyId", "name");

-- 8. Product.companyId + scoped unique constraints (sku, barcode)
ALTER TABLE "Product" ADD COLUMN "companyId" TEXT;
UPDATE "Product" SET "companyId" = 'default-company';
ALTER TABLE "Product" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Product" ADD CONSTRAINT "Product_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Product_companyId_idx" ON "Product"("companyId");
DROP INDEX IF EXISTS "Product_sku_key";
DROP INDEX IF EXISTS "Product_barcode_key";
CREATE UNIQUE INDEX "Product_companyId_sku_key" ON "Product"("companyId", "sku");
CREATE UNIQUE INDEX "Product_companyId_barcode_key" ON "Product"("companyId", "barcode");

-- 9. Fix branch-scoped-but-globally-unique codes: Supplier, Asset, Customer, Employee
DROP INDEX IF EXISTS "Supplier_code_key";
CREATE UNIQUE INDEX "Supplier_branchId_code_key" ON "Supplier"("branchId", "code");

DROP INDEX IF EXISTS "Asset_code_key";
CREATE UNIQUE INDEX "Asset_branchId_code_key" ON "Asset"("branchId", "code");

DROP INDEX IF EXISTS "Customer_code_key";
CREATE UNIQUE INDEX "Customer_branchId_code_key" ON "Customer"("branchId", "code");

DROP INDEX IF EXISTS "Employee_code_key";
CREATE UNIQUE INDEX "Employee_branchId_code_key" ON "Employee"("branchId", "code");

-- 10. User.defaultCompanyId, backfilled from the user's default branch's company
ALTER TABLE "User" ADD COLUMN "defaultCompanyId" TEXT;
ALTER TABLE "User" ADD CONSTRAINT "User_defaultCompanyId_fkey" FOREIGN KEY ("defaultCompanyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
UPDATE "User" u SET "defaultCompanyId" = b."companyId"
FROM "Branch" b
WHERE u."defaultBranchId" = b."id";
