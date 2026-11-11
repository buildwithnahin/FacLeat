-- CreateEnum
CREATE TYPE "PromotionType" AS ENUM ('REGULAR', 'ADJUSTMENT', 'UPGRADE', 'ACTING');

-- CreateEnum
CREATE TYPE "PromotionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PENDING_MANAGER_APPROVAL', 'PENDING_HR_APPROVAL', 'APPROVED', 'COMPLETED', 'REJECTED_BY_MANAGER', 'REJECTED_BY_HR');

-- CreateEnum
CREATE TYPE "PromotionApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "EmployeePromotion" (
    "id" TEXT NOT NULL,
    "promotionNumber" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "promotionType" "PromotionType" NOT NULL,
    "status" "PromotionStatus" NOT NULL DEFAULT 'DRAFT',
    "currentBranch" TEXT,
    "currentDepartment" TEXT,
    "currentDesignation" TEXT,
    "currentSalary" DECIMAL(18,2),
    "reportingManagerId" TEXT,
    "newDesignation" TEXT NOT NULL,
    "newSalary" DECIMAL(18,2) NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "remarks" TEXT,
    "managerApprovalStatus" "PromotionApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "managerApprovalDate" TIMESTAMP(3),
    "managerRemarks" TEXT,
    "hrApprovalStatus" "PromotionApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "hrApprovalDate" TIMESTAMP(3),
    "hrRemarks" TEXT,
    "approvedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeePromotion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmployeePromotion_promotionNumber_key" ON "EmployeePromotion"("promotionNumber");

-- CreateIndex
CREATE INDEX "EmployeePromotion_branchId_status_idx" ON "EmployeePromotion"("branchId", "status");

-- CreateIndex
CREATE INDEX "EmployeePromotion_employeeId_status_idx" ON "EmployeePromotion"("employeeId", "status");

-- CreateIndex
CREATE INDEX "EmployeePromotion_promotionType_status_idx" ON "EmployeePromotion"("promotionType", "status");

-- CreateIndex
CREATE INDEX "EmployeePromotion_effectiveDate_idx" ON "EmployeePromotion"("effectiveDate");

-- CreateIndex
CREATE INDEX "EmployeePromotion_createdAt_idx" ON "EmployeePromotion"("createdAt");

-- AddForeignKey
ALTER TABLE "EmployeePromotion" ADD CONSTRAINT "EmployeePromotion_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePromotion" ADD CONSTRAINT "EmployeePromotion_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePromotion" ADD CONSTRAINT "EmployeePromotion_reportingManagerId_fkey" FOREIGN KEY ("reportingManagerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
