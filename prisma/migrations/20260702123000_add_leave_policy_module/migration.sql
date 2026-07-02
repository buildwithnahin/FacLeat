-- Leave policy configuration module

ALTER TYPE "LeaveType" ADD VALUE IF NOT EXISTS 'FESTIVAL';

CREATE TABLE "LeavePolicy" (
    "id" TEXT NOT NULL,
    "policyCode" TEXT NOT NULL,
    "policyName" TEXT NOT NULL,
    "branchId" TEXT,
    "department" TEXT,
    "designation" TEXT,
    "employmentType" TEXT,
    "employeeCategory" TEXT,
    "gender" TEXT,
    "grade" TEXT,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "approvalRequired" BOOLEAN NOT NULL DEFAULT true,
    "managerApprovalRequired" BOOLEAN NOT NULL DEFAULT true,
    "hrApprovalRequired" BOOLEAN NOT NULL DEFAULT true,
    "accountsApprovalRequired" BOOLEAN NOT NULL DEFAULT false,
    "autoApproveAllowed" BOOLEAN NOT NULL DEFAULT false,
    "hrCanOverrideBalance" BOOLEAN NOT NULL DEFAULT true,
    "allowProbationEmployees" BOOLEAN NOT NULL DEFAULT false,
    "carryForwardAllowed" BOOLEAN NOT NULL DEFAULT false,
    "maxCarryForwardDays" DECIMAL(18,2),
    "carryForwardExpiryMonth" INTEGER,
    "carryForwardExpiryDay" INTEGER,
    "encashmentAllowed" BOOLEAN NOT NULL DEFAULT false,
    "maxEncashmentDays" DECIMAL(18,2),
    "autoClosing" BOOLEAN NOT NULL DEFAULT false,
    "payrollImpactDefault" TEXT NOT NULL DEFAULT 'NO_PAYROLL_IMPACT',
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeavePolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeavePolicyRule" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "leaveType" "LeaveType" NOT NULL,
    "leaveCode" TEXT NOT NULL,
    "paidLeave" BOOLEAN NOT NULL DEFAULT true,
    "entitledDays" DECIMAL(18,2),
    "isUnlimited" BOOLEAN NOT NULL DEFAULT false,
    "accrualMethod" TEXT NOT NULL,
    "minimumServiceMonths" INTEGER,
    "maxLeavePerRequest" DECIMAL(18,2),
    "maxLeavePerMonth" DECIMAL(18,2),
    "halfDayAllowed" BOOLEAN NOT NULL DEFAULT false,
    "attachmentRequired" BOOLEAN NOT NULL DEFAULT false,
    "reasonRequired" BOOLEAN NOT NULL DEFAULT true,
    "allowNegativeBalance" BOOLEAN NOT NULL DEFAULT false,
    "includeWeekend" BOOLEAN NOT NULL DEFAULT false,
    "includeHoliday" BOOLEAN NOT NULL DEFAULT false,
    "sandwichRuleApplicable" BOOLEAN NOT NULL DEFAULT false,
    "carryForwardAllowed" BOOLEAN NOT NULL DEFAULT false,
    "maxCarryForwardDays" DECIMAL(18,2),
    "encashmentAllowed" BOOLEAN NOT NULL DEFAULT false,
    "maxEncashmentDays" DECIMAL(18,2),
    "payrollImpact" TEXT NOT NULL DEFAULT 'NO_PAYROLL_IMPACT',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeavePolicyRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmployeeLeavePolicy" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "assignedDate" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeLeavePolicy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LeavePolicy_policyCode_key" ON "LeavePolicy"("policyCode");
CREATE INDEX "LeavePolicy_branchId_status_idx" ON "LeavePolicy"("branchId", "status");
CREATE INDEX "LeavePolicy_employmentType_status_idx" ON "LeavePolicy"("employmentType", "status");
CREATE INDEX "LeavePolicy_effectiveFrom_effectiveTo_idx" ON "LeavePolicy"("effectiveFrom", "effectiveTo");

CREATE UNIQUE INDEX "LeavePolicyRule_policyId_leaveType_key" ON "LeavePolicyRule"("policyId", "leaveType");
CREATE INDEX "LeavePolicyRule_policyId_status_idx" ON "LeavePolicyRule"("policyId", "status");

CREATE UNIQUE INDEX "EmployeeLeavePolicy_employeeId_policyId_key" ON "EmployeeLeavePolicy"("employeeId", "policyId");
CREATE INDEX "EmployeeLeavePolicy_employeeId_status_idx" ON "EmployeeLeavePolicy"("employeeId", "status");
CREATE INDEX "EmployeeLeavePolicy_policyId_status_idx" ON "EmployeeLeavePolicy"("policyId", "status");

ALTER TABLE "LeavePolicy"
ADD CONSTRAINT "LeavePolicy_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LeavePolicyRule"
ADD CONSTRAINT "LeavePolicyRule_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "LeavePolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmployeeLeavePolicy"
ADD CONSTRAINT "EmployeeLeavePolicy_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmployeeLeavePolicy"
ADD CONSTRAINT "EmployeeLeavePolicy_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "LeavePolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
