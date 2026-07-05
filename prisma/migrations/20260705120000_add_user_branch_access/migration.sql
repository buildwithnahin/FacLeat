CREATE TYPE "BranchAccessType" AS ENUM ('ALL_BRANCHES', 'ASSIGNED_BRANCHES', 'OWN_BRANCH_ONLY');

ALTER TABLE "User"
ADD COLUMN "branchAccessType" "BranchAccessType" NOT NULL DEFAULT 'OWN_BRANCH_ONLY';

CREATE TABLE "UserBranchAccess" (
    "userId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBranchAccess_pkey" PRIMARY KEY ("userId","branchId")
);

CREATE INDEX "UserBranchAccess_branchId_idx" ON "UserBranchAccess"("branchId");

ALTER TABLE "UserBranchAccess"
ADD CONSTRAINT "UserBranchAccess_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserBranchAccess"
ADD CONSTRAINT "UserBranchAccess_branchId_fkey"
FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "UserBranchAccess" ("userId", "branchId")
SELECT "id", "defaultBranchId"
FROM "User"
WHERE "defaultBranchId" IS NOT NULL
ON CONFLICT DO NOTHING;
