DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'IncrementType') THEN
    CREATE TYPE "IncrementType" AS ENUM ('ANNUAL', 'PERFORMANCE', 'MERIT', 'ADJUSTMENT', 'SPECIAL');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'IncrementStatus') THEN
    CREATE TYPE "IncrementStatus" AS ENUM (
      'DRAFT',
      'SUBMITTED',
      'PENDING_HR_APPROVAL',
      'PENDING_ACCOUNTS_APPROVAL',
      'PENDING_MANAGER_APPROVAL',
      'APPROVED',
      'APPLIED',
      'REJECTED'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'IncrementMethod') THEN
    CREATE TYPE "IncrementMethod" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'IncrementApprovalStatus') THEN
    CREATE TYPE "IncrementApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SalaryHistorySourceType') THEN
    CREATE TYPE "SalaryHistorySourceType" AS ENUM ('INCREMENT');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "EmployeeIncrement" (
  "id" TEXT NOT NULL,
  "incrementNumber" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "incrementType" "IncrementType" NOT NULL,
  "status" "IncrementStatus" NOT NULL DEFAULT 'DRAFT',
  "incrementMethod" "IncrementMethod" NOT NULL,
  "currentBranch" TEXT,
  "currentDepartment" TEXT,
  "currentDesignation" TEXT,
  "currentEmploymentType" TEXT,
  "currentBasicSalary" DECIMAL(18,2) NOT NULL,
  "currentGrossSalary" DECIMAL(18,2) NOT NULL,
  "reportingManagerId" TEXT,
  "incrementValue" DECIMAL(18,2) NOT NULL,
  "newBasicSalary" DECIMAL(18,2) NOT NULL,
  "newGrossSalary" DECIMAL(18,2) NOT NULL,
  "effectiveDate" DATE NOT NULL,
  "reason" TEXT NOT NULL,
  "performanceSummary" TEXT,
  "remarks" TEXT,
  "hrApprovalStatus" "IncrementApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "hrApprovalDate" TIMESTAMP(3),
  "hrRemarks" TEXT,
  "accountsApprovalStatus" "IncrementApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "accountsApprovalDate" TIMESTAMP(3),
  "budgetVerified" BOOLEAN,
  "accountsRemarks" TEXT,
  "managerApprovalStatus" "IncrementApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "managerApprovalDate" TIMESTAMP(3),
  "managerRemarks" TEXT,
  "approvedAt" TIMESTAMP(3),
  "letterGeneratedAt" TIMESTAMP(3),
  "appliedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmployeeIncrement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EmployeeSalaryHistory" (
  "id" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "sourceType" "SalaryHistorySourceType" NOT NULL,
  "sourceId" TEXT,
  "effectiveDate" DATE NOT NULL,
  "oldBasicSalary" DECIMAL(18,2) NOT NULL,
  "newBasicSalary" DECIMAL(18,2) NOT NULL,
  "oldGrossSalary" DECIMAL(18,2) NOT NULL,
  "newGrossSalary" DECIMAL(18,2) NOT NULL,
  "remarks" TEXT,
  "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmployeeSalaryHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EmployeeIncrement_incrementNumber_key" ON "EmployeeIncrement"("incrementNumber");
CREATE INDEX IF NOT EXISTS "EmployeeIncrement_branchId_status_idx" ON "EmployeeIncrement"("branchId", "status");
CREATE INDEX IF NOT EXISTS "EmployeeIncrement_employeeId_status_idx" ON "EmployeeIncrement"("employeeId", "status");
CREATE INDEX IF NOT EXISTS "EmployeeIncrement_incrementType_status_idx" ON "EmployeeIncrement"("incrementType", "status");
CREATE INDEX IF NOT EXISTS "EmployeeIncrement_effectiveDate_idx" ON "EmployeeIncrement"("effectiveDate");
CREATE INDEX IF NOT EXISTS "EmployeeIncrement_createdAt_idx" ON "EmployeeIncrement"("createdAt");

CREATE INDEX IF NOT EXISTS "EmployeeSalaryHistory_branchId_effectiveDate_idx" ON "EmployeeSalaryHistory"("branchId", "effectiveDate");
CREATE INDEX IF NOT EXISTS "EmployeeSalaryHistory_employeeId_effectiveDate_idx" ON "EmployeeSalaryHistory"("employeeId", "effectiveDate");
CREATE INDEX IF NOT EXISTS "EmployeeSalaryHistory_sourceType_sourceId_idx" ON "EmployeeSalaryHistory"("sourceType", "sourceId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'EmployeeIncrement_branchId_fkey'
  ) THEN
    ALTER TABLE "EmployeeIncrement"
      ADD CONSTRAINT "EmployeeIncrement_branchId_fkey"
      FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'EmployeeIncrement_employeeId_fkey'
  ) THEN
    ALTER TABLE "EmployeeIncrement"
      ADD CONSTRAINT "EmployeeIncrement_employeeId_fkey"
      FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'EmployeeIncrement_reportingManagerId_fkey'
  ) THEN
    ALTER TABLE "EmployeeIncrement"
      ADD CONSTRAINT "EmployeeIncrement_reportingManagerId_fkey"
      FOREIGN KEY ("reportingManagerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'EmployeeSalaryHistory_branchId_fkey'
  ) THEN
    ALTER TABLE "EmployeeSalaryHistory"
      ADD CONSTRAINT "EmployeeSalaryHistory_branchId_fkey"
      FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'EmployeeSalaryHistory_employeeId_fkey'
  ) THEN
    ALTER TABLE "EmployeeSalaryHistory"
      ADD CONSTRAINT "EmployeeSalaryHistory_employeeId_fkey"
      FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;
