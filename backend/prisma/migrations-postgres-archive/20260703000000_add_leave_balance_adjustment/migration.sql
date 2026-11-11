-- Fix: LeaveBalanceAdjustment was added to schema.prisma without a corresponding
-- CREATE TABLE migration, leaving 20260704120000_add_leave_type_master to ALTER
-- a table that never existed. This migration creates it at the correct point in
-- history (LeaveType enum still exists here; it's dropped later in 20260704120000).

CREATE TABLE "LeaveBalanceAdjustment" (
    "id"             TEXT NOT NULL,
    "adjustmentNo"   TEXT NOT NULL,
    "employeeId"     TEXT NOT NULL,
    "leaveType"      "LeaveType" NOT NULL,
    "leaveYear"      INTEGER NOT NULL,
    "adjustmentType" TEXT NOT NULL,
    "days"           DECIMAL(18,2) NOT NULL,
    "reason"         TEXT NOT NULL,
    "attachmentPath" TEXT,
    "effectiveDate"  DATE NOT NULL,
    "adjustedById"   TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaveBalanceAdjustment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LeaveBalanceAdjustment_adjustmentNo_key" ON "LeaveBalanceAdjustment"("adjustmentNo");
CREATE INDEX "LeaveBalanceAdjustment_employeeId_leaveYear_leaveType_idx" ON "LeaveBalanceAdjustment"("employeeId", "leaveYear", "leaveType");
CREATE INDEX "LeaveBalanceAdjustment_leaveYear_leaveType_idx" ON "LeaveBalanceAdjustment"("leaveYear", "leaveType");

ALTER TABLE "LeaveBalanceAdjustment"
  ADD CONSTRAINT "LeaveBalanceAdjustment_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
