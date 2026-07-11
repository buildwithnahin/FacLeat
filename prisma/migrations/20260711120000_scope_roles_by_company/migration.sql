ALTER TABLE "Role"
ADD COLUMN "companyId" TEXT;

ALTER TABLE "Role"
ADD CONSTRAINT "Role_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

UPDATE "Role" AS r
SET "companyId" = scoped."companyId"
FROM (
  SELECT ur."roleId", MIN(u."defaultCompanyId") AS "companyId"
  FROM "UserRole" AS ur
  INNER JOIN "User" AS u ON u."id" = ur."userId"
  WHERE u."defaultCompanyId" IS NOT NULL
  GROUP BY ur."roleId"
  HAVING COUNT(DISTINCT u."defaultCompanyId") = 1
) AS scoped
WHERE r."id" = scoped."roleId"
  AND r."isSystem" = false
  AND r."companyId" IS NULL;

DROP INDEX "Role_name_key";

CREATE UNIQUE INDEX "Role_companyId_name_key" ON "Role"("companyId", "name");
CREATE INDEX "Role_companyId_idx" ON "Role"("companyId");
