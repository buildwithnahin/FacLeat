-- Convert enum-backed leave fields to text and introduce leave type master data.

ALTER TABLE "LeaveRequest"
  ALTER COLUMN "type" TYPE TEXT USING "type"::text;

ALTER TABLE "LeavePolicyRule"
  ALTER COLUMN "leaveType" TYPE TEXT USING "leaveType"::text;

ALTER TABLE "LeaveBalanceAdjustment"
  ALTER COLUMN "leaveType" TYPE TEXT USING "leaveType"::text;

DROP TYPE IF EXISTS "LeaveType";

CREATE TABLE "LeaveType" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "paidLeave" BOOLEAN NOT NULL DEFAULT true,
  "annualEntitlement" DECIMAL(18,2),
  "maxConsecutiveDays" DECIMAL(18,2),
  "minimumLeaveDays" DECIMAL(18,2),
  "applyBeforeDays" INTEGER,
  "unit" TEXT NOT NULL DEFAULT 'FULL_DAY',
  "applicableEmploymentTypes" JSONB,
  "genderApplicability" TEXT NOT NULL DEFAULT 'ALL',
  "applicableDepartment" TEXT,
  "applicableDesignation" TEXT,
  "applicableBranchId" TEXT,
  "attachmentRequired" BOOLEAN NOT NULL DEFAULT false,
  "medicalCertificateRequired" BOOLEAN NOT NULL DEFAULT false,
  "allowHalfDay" BOOLEAN NOT NULL DEFAULT false,
  "allowBackdatedApplication" BOOLEAN NOT NULL DEFAULT false,
  "allowFutureApplication" BOOLEAN NOT NULL DEFAULT true,
  "approvalRequired" BOOLEAN NOT NULL DEFAULT true,
  "autoApprove" BOOLEAN NOT NULL DEFAULT false,
  "holidayIncluded" BOOLEAN NOT NULL DEFAULT false,
  "weekendIncluded" BOOLEAN NOT NULL DEFAULT false,
  "carryForwardAllowed" BOOLEAN NOT NULL DEFAULT false,
  "maximumCarryForwardDays" DECIMAL(18,2),
  "carryForwardExpiryMonths" INTEGER,
  "encashmentAllowed" BOOLEAN NOT NULL DEFAULT false,
  "maximumEncashmentDays" DECIMAL(18,2),
  "requiredAttachmentTypes" JSONB,
  "allowNegativeBalance" BOOLEAN NOT NULL DEFAULT false,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LeaveType_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LeaveType_code_key" ON "LeaveType"("code");
CREATE INDEX "LeaveType_status_displayOrder_idx" ON "LeaveType"("status", "displayOrder");
CREATE INDEX "LeaveType_applicableBranchId_status_idx" ON "LeaveType"("applicableBranchId", "status");

ALTER TABLE "LeaveType"
  ADD CONSTRAINT "LeaveType_applicableBranchId_fkey"
  FOREIGN KEY ("applicableBranchId") REFERENCES "Branch"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "LeaveType" (
  "id", "code", "name", "description", "status", "paidLeave", "annualEntitlement",
  "unit", "allowHalfDay", "approvalRequired", "holidayIncluded", "weekendIncluded",
  "carryForwardAllowed", "encashmentAllowed", "allowNegativeBalance", "displayOrder"
)
VALUES
  ('lt_casual', 'CASUAL', 'Casual Leave', 'General short-term personal leave.', 'ACTIVE', true, 10, 'FULL_DAY', true, true, false, false, false, false, false, 10),
  ('lt_sick', 'SICK', 'Sick Leave', 'Paid sick leave for illness and recovery.', 'ACTIVE', true, 14, 'FULL_DAY', true, true, false, false, false, false, false, 20),
  ('lt_earned', 'EARNED', 'Earned Leave', 'Earned or privilege leave based on service.', 'ACTIVE', true, 15, 'FULL_DAY', true, true, false, false, true, true, false, 30),
  ('lt_annual', 'ANNUAL', 'Annual Leave', 'Annual planned leave allocation.', 'ACTIVE', true, 20, 'FULL_DAY', true, true, false, false, true, true, false, 40),
  ('lt_maternity', 'MATERNITY', 'Maternity Leave', 'Extended maternity leave entitlement.', 'ACTIVE', true, 112, 'FULL_DAY', false, true, false, false, false, false, false, 50),
  ('lt_paternity', 'PATERNITY', 'Paternity Leave', 'Paternity leave entitlement.', 'ACTIVE', true, 10, 'FULL_DAY', true, true, false, false, false, false, false, 60),
  ('lt_emergency', 'EMERGENCY', 'Emergency Leave', 'Emergency short-notice leave.', 'ACTIVE', true, 5, 'FULL_DAY', true, true, false, false, false, false, false, 70),
  ('lt_unpaid', 'UNPAID', 'Unpaid Leave', 'Leave without pay when paid balance is unavailable.', 'ACTIVE', false, 100, 'FULL_DAY', true, true, false, false, false, false, true, 80),
  ('lt_compensatory', 'COMPENSATORY', 'Compensatory Leave', 'Comp-off against approved extra duty.', 'ACTIVE', true, 10, 'FULL_DAY', true, true, false, false, true, false, false, 90),
  ('lt_special', 'SPECIAL', 'Special Leave', 'Management-approved special purpose leave.', 'ACTIVE', true, 10, 'FULL_DAY', true, true, false, false, false, false, false, 100),
  ('lt_festival', 'FESTIVAL', 'Festival Leave', 'Festival or religious observance leave.', 'ACTIVE', true, 2, 'FULL_DAY', true, true, false, false, false, false, false, 110),
  ('lt_other', 'OTHER', 'Other Leave', 'Miscellaneous leave bucket.', 'ACTIVE', true, 10, 'FULL_DAY', true, true, false, false, false, false, false, 120);
