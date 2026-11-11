-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "description" TEXT,
    "shiftType" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "breakStart" TEXT,
    "breakEnd" TEXT,
    "lateGraceMinutes" INTEGER NOT NULL DEFAULT 0,
    "earlyExitGraceMinutes" INTEGER NOT NULL DEFAULT 0,
    "minPresentMinutes" INTEGER NOT NULL,
    "minHalfDayMinutes" INTEGER NOT NULL,
    "absentBelowMinutes" INTEGER NOT NULL,
    "overtimeAllowed" BOOLEAN NOT NULL DEFAULT false,
    "otStartsAfter" TEXT,
    "minOtMinutes" INTEGER NOT NULL DEFAULT 0,
    "maxOtMinutesPerDay" INTEGER NOT NULL DEFAULT 0,
    "weeklyOffDays" JSONB,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN "shiftId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Shift_branchId_code_key" ON "Shift"("branchId", "code");

-- CreateIndex
CREATE INDEX "Shift_branchId_status_idx" ON "Shift"("branchId", "status");

-- CreateIndex
CREATE INDEX "Shift_branchId_name_idx" ON "Shift"("branchId", "name");

-- CreateIndex
CREATE INDEX "Employee_shiftId_idx" ON "Employee"("shiftId");

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;
