-- CreateEnum
CREATE TYPE "DebitNoteStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProcessTrackingStatus" AS ENUM ('PENDING', 'RUNNING', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "QualityCheckStatus" AS ENUM ('PENDING', 'PASSED', 'FAILED', 'REWORK');

-- CreateEnum
CREATE TYPE "ProductionPlanStatus" AS ENUM ('DRAFT', 'APPROVED', 'SCHEDULED', 'RUNNING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('PENDING', 'ASSIGNED', 'RUNNING', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DelayReason" AS ENUM ('MACHINE_BREAKDOWN', 'MATERIAL_SHORTAGE', 'OPERATOR_ABSENT', 'POWER_FAILURE', 'QUALITY_ISSUE', 'MAINTENANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "ProductionIssueStatus" AS ENUM ('DRAFT', 'REQUESTED', 'APPROVED', 'ISSUED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CorporateReturnStatus" AS ENUM ('REQUESTED', 'APPROVED', 'GOODS_RECEIVED', 'QC_INSPECTION', 'INVENTORY_UPDATED', 'CREDIT_NOTE_ISSUED', 'CLOSED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReturnCondition" AS ENUM ('RESALABLE', 'REPAIRABLE', 'DAMAGED', 'MANUFACTURING_DEFECT');

-- CreateEnum
CREATE TYPE "RefundType" AS ENUM ('CASH', 'BANK', 'CREDIT_NOTE', 'REPLACEMENT');

-- CreateEnum
CREATE TYPE "PayslipStatus" AS ENUM ('GENERATED', 'PUBLISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');

-- CreateEnum
CREATE TYPE "AttendanceAdjustmentType" AS ENUM ('MISSING_CHECK_IN', 'MISSING_CHECK_OUT', 'WRONG_PUNCH', 'MANUAL_ATTENDANCE', 'SHIFT_CHANGE', 'OFFICIAL_DUTY', 'FIELD_WORK', 'HOLIDAY_WORK', 'OT_CORRECTION');

-- CreateEnum
CREATE TYPE "AttendanceAdjustmentStatus" AS ENUM ('DRAFT', 'UPDATED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OvertimeType" AS ENUM ('REGULAR', 'HOLIDAY', 'WEEKEND', 'NIGHT', 'EMERGENCY', 'PRODUCTION');

-- CreateEnum
CREATE TYPE "OvertimeSource" AS ENUM ('ATTENDANCE_BASED', 'MANUAL_ENTRY', 'DEVICE_IMPORT');

-- CreateEnum
CREATE TYPE "OvertimeRateType" AS ENUM ('FIXED_RATE', 'BASIC_SALARY_BASED', 'GROSS_SALARY_BASED', 'MANUAL_RATE');

-- CreateEnum
CREATE TYPE "OvertimeStatus" AS ENUM ('DRAFT', 'PENDING_MANAGER', 'PENDING_HR', 'PENDING_ACCOUNTS', 'APPROVED', 'POSTED_TO_PAYROLL', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AttendanceSummaryStatus" AS ENUM ('GENERATED', 'UNDER_REVIEW', 'ADJUSTMENT_REQUIRED', 'READY_FOR_PAYROLL', 'LOCKED', 'SENT_TO_PAYROLL', 'PAYROLL_PROCESSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ResignationType" AS ENUM ('VOLUNTARY', 'MUTUAL', 'RETIREMENT');

-- CreateEnum
CREATE TYPE "ResignationStatus" AS ENUM ('DRAFT', 'PENDING_MANAGER_APPROVAL', 'PENDING_HR_APPROVAL', 'PENDING_ACCOUNTS_APPROVAL', 'PENDING_EXIT_CLEARANCE', 'COMPLETED', 'REJECTED', 'CANCELLED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ResignationReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SENT_BACK', 'HOLD', 'CORRECTION_REQUESTED');

-- CreateEnum
CREATE TYPE "ExitType" AS ENUM ('RESIGNATION', 'TERMINATION', 'RETIREMENT', 'END_OF_CONTRACT', 'DEATH');

-- CreateEnum
CREATE TYPE "ExitClearanceStatus" AS ENUM ('DRAFT', 'PENDING_DEPARTMENT_CLEARANCE', 'PENDING_ACCOUNTS_APPROVAL', 'PENDING_HR_APPROVAL', 'COMPLETED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ExitClearanceReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SENT_BACK', 'HOLD', 'NOT_REQUIRED');

-- CreateEnum
CREATE TYPE "ExitAssetCondition" AS ENUM ('GOOD', 'DAMAGED', 'LOST');

-- CreateEnum
CREATE TYPE "TransferType" AS ENUM ('BRANCH', 'DEPARTMENT', 'SHIFT', 'TEMPORARY', 'PERMANENT');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ConfirmationType" AS ENUM ('PROBATION_TO_PERMANENT', 'INTERNSHIP_TO_PERMANENT');

-- CreateEnum
CREATE TYPE "ConfirmationStatus" AS ENUM ('DRAFT', 'PENDING_MANAGER_APPROVAL', 'PENDING_HR_APPROVAL', 'PENDING_ACCOUNTS_APPROVAL', 'CONFIRMED', 'EXTENDED', 'REJECTED', 'CANCELLED', 'SENT_BACK');

-- CreateEnum
CREATE TYPE "ConfirmationReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SENT_BACK', 'EXTENDED', 'REVISION_REQUESTED');

-- CreateEnum
CREATE TYPE "MissingPunchType" AS ENUM ('MISSING_IN', 'MISSING_OUT', 'BOTH_MISSING', 'INVALID_SEQUENCE', 'DUPLICATE_PUNCH');

-- CreateEnum
CREATE TYPE "PunchCorrectionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SalaryComponentCategory" AS ENUM ('EARNINGS', 'DEDUCTION');

-- CreateEnum
CREATE TYPE "SalaryComponentType" AS ENUM ('FIXED', 'VARIABLE');

-- CreateEnum
CREATE TYPE "SalaryCalculationType" AS ENUM ('FIXED_AMOUNT', 'PERCENTAGE', 'FORMULA', 'MANUAL_ENTRY');

-- CreateEnum
CREATE TYPE "SalaryComponentStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "PayrollFrequency" AS ENUM ('MONTHLY', 'WEEKLY', 'DAILY', 'HOURLY');

-- CreateEnum
CREATE TYPE "SalaryStructureStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "PayrollPeriodStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "LoanType" AS ENUM ('EMPLOYEE_LOAN', 'SALARY_ADVANCE');

-- CreateEnum
CREATE TYPE "LoanPurpose" AS ENUM ('MEDICAL', 'EDUCATION', 'EMERGENCY', 'PERSONAL', 'FESTIVAL', 'HOUSE_RENT', 'OTHERS');

-- CreateEnum
CREATE TYPE "LoanInstallmentType" AS ENUM ('MONTHLY', 'ONE_TIME');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PENDING_HR', 'PENDING_ACCOUNTS', 'PENDING_MANAGEMENT', 'APPROVED', 'DISBURSED', 'ACTIVE', 'COMPLETED', 'REJECTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "RepaymentStatus" AS ENUM ('PENDING', 'PAID', 'SKIPPED');

-- CreateEnum
CREATE TYPE "BonusType" AS ENUM ('FESTIVAL', 'ATTENDANCE', 'PRODUCTION', 'PERFORMANCE', 'SALES_INCENTIVE', 'SPECIAL', 'YEARLY', 'JOINING', 'RETENTION', 'OTHER');

-- CreateEnum
CREATE TYPE "BonusCalculationMethod" AS ENUM ('FIXED_AMOUNT', 'PERCENTAGE', 'FORMULA');

-- CreateEnum
CREATE TYPE "BonusBasedOn" AS ENUM ('BASIC_SALARY', 'GROSS_SALARY', 'NET_SALARY');

-- CreateEnum
CREATE TYPE "BonusStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PENDING_HR', 'PENDING_MANAGEMENT', 'APPROVED', 'PUBLISHED', 'PAID', 'REJECTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "BonusPaymentMethod" AS ENUM ('PAYROLL', 'CASH', 'BANK_TRANSFER');

-- CreateEnum
CREATE TYPE "PayrollAdjustmentType" AS ENUM ('ALLOWANCE', 'DEDUCTION', 'BONUS_CORRECTION', 'SALARY_CORRECTION', 'TAX_ADJUSTMENT', 'OVERTIME_ADJUSTMENT', 'ATTENDANCE_ADJUSTMENT', 'LOAN_ADJUSTMENT', 'ADVANCE_ADJUSTMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "PayrollAdjustmentCategory" AS ENUM ('ONE_TIME', 'RECURRING');

-- CreateEnum
CREATE TYPE "PayrollAdjustmentReason" AS ENUM ('ATTENDANCE_CORRECTION', 'MANUAL_BONUS', 'LATE_SALARY_REVISION', 'OT_CORRECTION', 'RECOVERY', 'OTHER');

-- CreateEnum
CREATE TYPE "PayrollAdjustmentStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PENDING_HR', 'PENDING_MANAGEMENT', 'APPROVED', 'APPLIED', 'COMPLETED', 'REJECTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "FinalSettlementStatus" AS ENUM ('DRAFT', 'CALCULATED', 'PENDING_HR', 'PENDING_FINANCE', 'PENDING_MANAGEMENT', 'APPROVED', 'PAID', 'CLOSED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AttendanceStatus" ADD VALUE 'WEEKEND';
ALTER TYPE "AttendanceStatus" ADD VALUE 'OFFICIAL_DUTY';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CorporateDeliveryStatus" ADD VALUE 'APPROVED';
ALTER TYPE "CorporateDeliveryStatus" ADD VALUE 'PICKING';
ALTER TYPE "CorporateDeliveryStatus" ADD VALUE 'PACKED';
ALTER TYPE "CorporateDeliveryStatus" ADD VALUE 'CLOSED';

-- AlterEnum
BEGIN;
CREATE TYPE "LeaveStatus_new" AS ENUM ('DRAFT', 'PENDING_MANAGER', 'PENDING_HR', 'APPROVED', 'REJECTED', 'RETURNED', 'CANCELLED', 'WITHDRAWN');
ALTER TABLE "public"."LeaveRequest" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "LeaveRequest" ALTER COLUMN "status" TYPE "LeaveStatus_new" USING ("status"::text::"LeaveStatus_new");
ALTER TYPE "LeaveStatus" RENAME TO "LeaveStatus_old";
ALTER TYPE "LeaveStatus_new" RENAME TO "LeaveStatus";
DROP TYPE "public"."LeaveStatus_old";
ALTER TABLE "LeaveRequest" ALTER COLUMN "status" SET DEFAULT 'PENDING_MANAGER';
COMMIT;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PayrollRunStatus" ADD VALUE 'PREPARING';
ALTER TYPE "PayrollRunStatus" ADD VALUE 'CALCULATED';
ALTER TYPE "PayrollRunStatus" ADD VALUE 'PENDING_HR';
ALTER TYPE "PayrollRunStatus" ADD VALUE 'PENDING_FINANCE';
ALTER TYPE "PayrollRunStatus" ADD VALUE 'PENDING_MANAGEMENT';
ALTER TYPE "PayrollRunStatus" ADD VALUE 'COMPLETED';
ALTER TYPE "PayrollRunStatus" ADD VALUE 'CLOSED';

-- AlterEnum
BEGIN;
CREATE TYPE "PurchaseInvoiceMatch_new" AS ENUM ('UNMATCHED', 'MATCHED', 'MISMATCH');
ALTER TABLE "public"."PurchaseInvoice" ALTER COLUMN "matching" DROP DEFAULT;
ALTER TABLE "PurchaseInvoice" ALTER COLUMN "matching" TYPE "PurchaseInvoiceMatch_new" USING ("matching"::text::"PurchaseInvoiceMatch_new");
ALTER TYPE "PurchaseInvoiceMatch" RENAME TO "PurchaseInvoiceMatch_old";
ALTER TYPE "PurchaseInvoiceMatch_new" RENAME TO "PurchaseInvoiceMatch";
DROP TYPE "public"."PurchaseInvoiceMatch_old";
ALTER TABLE "PurchaseInvoice" ALTER COLUMN "matching" SET DEFAULT 'UNMATCHED';
COMMIT;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PurchaseInvoiceStatus" ADD VALUE 'DRAFT';
ALTER TYPE "PurchaseInvoiceStatus" ADD VALUE 'SUBMITTED';
ALTER TYPE "PurchaseInvoiceStatus" ADD VALUE 'ON_HOLD';
ALTER TYPE "PurchaseInvoiceStatus" ADD VALUE 'APPROVED';
ALTER TYPE "PurchaseInvoiceStatus" ADD VALUE 'POSTED';

-- AlterEnum
ALTER TYPE "SalaryHistorySourceType" ADD VALUE 'CONFIRMATION';

-- AlterTable
ALTER TABLE "AttendanceRecord" ADD COLUMN     "earlyExitMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isEarlyExit" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isLateEntry" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isMissingPunch" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lateMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "overtimeMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "workingMinutes" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Company" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CorporateDelivery" DROP COLUMN "carrier",
ADD COLUMN     "customerSignature" TEXT,
ADD COLUMN     "deliveryAddress" VARCHAR(500),
ADD COLUMN     "driverName" TEXT,
ADD COLUMN     "driverPhone" TEXT,
ADD COLUMN     "expectedDate" DATE,
ADD COLUMN     "gatePassNo" TEXT,
ADD COLUMN     "podAttachment" TEXT,
ADD COLUMN     "receivedById" TEXT,
ADD COLUMN     "transportCompany" TEXT,
ADD COLUMN     "vehicleNo" TEXT,
ALTER COLUMN "deliveryDate" DROP NOT NULL,
ALTER COLUMN "deliveryDate" DROP DEFAULT,
ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "employmentType" TEXT DEFAULT 'PERMANENT',
ADD COLUMN     "reportingManagerId" TEXT,
ADD COLUMN     "systemRoleId" TEXT;

-- AlterTable
ALTER TABLE "EmployeeLeavePolicy" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "LeaveBalanceAdjustment" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "LeavePolicy" DROP COLUMN "encashmentAllowed",
DROP COLUMN "maxEncashmentDays",
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "LeavePolicyRule" DROP COLUMN "encashmentAllowed",
DROP COLUMN "maxEncashmentDays",
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "LeaveRequest" ADD COLUMN     "attachmentPath" TEXT,
ADD COLUMN     "emergencyContact" TEXT,
ADD COLUMN     "halfDay" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "halfDayType" TEXT,
ADD COLUMN     "handoverEmployeeId" TEXT,
ADD COLUMN     "hrApprovedAt" TIMESTAMP(3),
ADD COLUMN     "hrId" TEXT,
ADD COLUMN     "hrRemarks" TEXT,
ADD COLUMN     "hrStatus" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "leaveRequestNo" TEXT NOT NULL,
ADD COLUMN     "managerApprovedAt" TIMESTAMP(3),
ADD COLUMN     "managerId" TEXT,
ADD COLUMN     "managerRemarks" TEXT,
ADD COLUMN     "managerStatus" TEXT NOT NULL DEFAULT 'PENDING',
ALTER COLUMN "days" SET DATA TYPE DECIMAL(18,2),
ALTER COLUMN "reason" SET NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'PENDING_MANAGER';

-- AlterTable
ALTER TABLE "LeaveType" DROP COLUMN "encashmentAllowed",
DROP COLUMN "maximumEncashmentDays",
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PayrollRun" ADD COLUMN     "financeApproval" TEXT,
ADD COLUMN     "hrApproval" TEXT,
ADD COLUMN     "managementApproval" TEXT,
ADD COLUMN     "payrollPeriodId" TEXT,
ADD COLUMN     "totalAdvance" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "totalBonus" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "totalEmployees" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalLoan" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "totalOT" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "totalTax" DECIMAL(18,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Payslip" ADD COLUMN     "absentDeduction" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "advanceDeduction" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "attendanceBonus" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "bankAccount" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "lateDeduction" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "loanDeduction" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "no" TEXT,
ADD COLUMN     "overtimeAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "paymentDate" TIMESTAMP(3),
ADD COLUMN     "paymentMethod" TEXT,
ADD COLUMN     "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "payrollAdjustmentsAddition" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "payrollAdjustmentsDeduction" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "status" "PayslipStatus" NOT NULL DEFAULT 'GENERATED',
ADD COLUMN     "transactionRef" TEXT;

-- AlterTable
ALTER TABLE "ProductionOrder" ADD COLUMN     "planId" TEXT;

-- AlterTable
ALTER TABLE "PurchaseInvoice" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "employeeId" TEXT;

-- CreateTable
CREATE TABLE "DebitNote" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "grnId" TEXT,
    "returnDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "DebitNoteStatus" NOT NULL DEFAULT 'DRAFT',
    "totalAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "vatAdjustment" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "reason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DebitNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DebitNoteItem" (
    "id" TEXT NOT NULL,
    "debitNoteId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "returnedQty" DECIMAL(18,4) NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "total" DECIMAL(18,4) NOT NULL,
    "reason" TEXT,
    "condition" TEXT,

    CONSTRAINT "DebitNoteItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionPlan" (
    "id" TEXT NOT NULL,
    "planNo" TEXT NOT NULL,
    "planningDate" DATE NOT NULL,
    "branchId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "priority" TEXT,
    "plannedStartDate" TIMESTAMP(3) NOT NULL,
    "plannedEndDate" TIMESTAMP(3) NOT NULL,
    "productionLine" TEXT,
    "machine" TEXT,
    "shift" TEXT,
    "plannerId" TEXT,
    "status" "ProductionPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrder" (
    "id" TEXT NOT NULL,
    "workOrderNo" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "department" TEXT,
    "machine" TEXT,
    "operatorId" TEXT,
    "shift" TEXT,
    "inputQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "targetQty" DECIMAL(18,4) NOT NULL,
    "outputQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "scrapQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'PENDING',
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DelayTracking" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "reason" "DelayReason" NOT NULL,
    "notes" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "durationMins" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DelayTracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionIssueVoucher" (
    "id" TEXT NOT NULL,
    "voucherNo" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "branchId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "status" "ProductionIssueStatus" NOT NULL DEFAULT 'DRAFT',
    "requestedById" TEXT,
    "approvedById" TEXT,
    "issuedById" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionIssueVoucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionIssueItem" (
    "id" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "batchNo" TEXT,
    "lotNo" TEXT,
    "requiredQty" DECIMAL(18,4) NOT NULL,
    "issuedQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "uom" "UnitOfMeasure" NOT NULL DEFAULT 'PCS',

    CONSTRAINT "ProductionIssueItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessTracking" (
    "id" TEXT NOT NULL,
    "trackingNo" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "batchNo" TEXT,
    "machine" TEXT,
    "operatorId" TEXT,
    "status" "ProcessTrackingStatus" NOT NULL DEFAULT 'PENDING',
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "durationMinutes" INTEGER,
    "inputQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "outputQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "rejectedQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "scrapQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "reworkQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "remainingQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "materialCost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "labourCost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "machineCost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "overheadCost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "totalProcessCost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcessTracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WipLedger" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "branchId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "stageId" TEXT,
    "productId" TEXT NOT NULL,
    "voucher" TEXT,
    "operatorId" TEXT,
    "inQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "outQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "balance" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WipLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapLedger" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "branchId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "stageId" TEXT,
    "scrapType" TEXT NOT NULL,
    "operatorId" TEXT,
    "qty" DECIMAL(18,4) NOT NULL,
    "cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScrapLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinishedGoodsReceiveVoucher" (
    "id" TEXT NOT NULL,
    "receiveNo" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "branchId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "receivedById" TEXT,
    "approvedById" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinishedGoodsReceiveVoucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinishedGoodsReceiveItem" (
    "id" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "batchNo" TEXT,
    "quantity" DECIMAL(18,4) NOT NULL,
    "uom" "UnitOfMeasure" NOT NULL DEFAULT 'PCS',
    "qualityStatus" "QualityCheckStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "FinishedGoodsReceiveItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorporateSalesReturn" (
    "id" TEXT NOT NULL,
    "returnNo" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "warehouseId" TEXT NOT NULL,
    "returnDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "CorporateReturnStatus" NOT NULL DEFAULT 'REQUESTED',
    "refundType" "RefundType" NOT NULL DEFAULT 'CREDIT_NOTE',
    "reason" TEXT,
    "notes" TEXT,
    "qcOfficerId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CorporateSalesReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorporateSalesReturnItem" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "batchNo" TEXT,
    "soldQty" DECIMAL(18,4) NOT NULL,
    "returnedQty" DECIMAL(18,4) NOT NULL,
    "condition" "ReturnCondition" NOT NULL DEFAULT 'RESALABLE',
    "inspectionResult" TEXT,
    "damageType" TEXT,
    "photoAttachment" TEXT,

    CONSTRAINT "CorporateSalesReturnItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "type" TEXT NOT NULL,
    "branchId" TEXT,
    "isPaid" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "description" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrMasterData" (
    "id" TEXT NOT NULL,
    "branchId" TEXT,
    "type" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrMasterData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrWorkflowRecord" (
    "id" TEXT NOT NULL,
    "branchId" TEXT,
    "employeeId" TEXT,
    "section" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subject" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "amount" DECIMAL(18,2),
    "owner" TEXT,
    "notes" TEXT,
    "metadata" JSONB,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrWorkflowRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeConfirmation" (
    "id" TEXT NOT NULL,
    "confirmationNumber" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "confirmationType" "ConfirmationType" NOT NULL,
    "status" "ConfirmationStatus" NOT NULL DEFAULT 'DRAFT',
    "currentBranch" TEXT,
    "currentDepartment" TEXT,
    "currentDesignation" TEXT,
    "currentEmploymentType" TEXT,
    "currentBasicSalary" DECIMAL(18,2) NOT NULL,
    "currentGrossSalary" DECIMAL(18,2) NOT NULL,
    "reportingManagerId" TEXT,
    "probationEndDate" DATE,
    "effectiveDate" DATE NOT NULL,
    "salaryRevisionRequired" BOOLEAN NOT NULL DEFAULT false,
    "incrementAmount" DECIMAL(18,2),
    "newBasicSalary" DECIMAL(18,2) NOT NULL,
    "newGrossSalary" DECIMAL(18,2) NOT NULL,
    "benefitsRevision" TEXT,
    "reason" TEXT NOT NULL,
    "performanceSummary" TEXT,
    "remarks" TEXT,
    "managerReviewStatus" "ConfirmationReviewStatus" NOT NULL DEFAULT 'PENDING',
    "managerReviewDate" TIMESTAMP(3),
    "managerRemarks" TEXT,
    "hrReviewStatus" "ConfirmationReviewStatus" NOT NULL DEFAULT 'PENDING',
    "hrReviewDate" TIMESTAMP(3),
    "hrRemarks" TEXT,
    "accountsReviewStatus" "ConfirmationReviewStatus" NOT NULL DEFAULT 'PENDING',
    "accountsReviewDate" TIMESTAMP(3),
    "accountsRemarks" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "letterGeneratedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeTransfer" (
    "id" TEXT NOT NULL,
    "transferNumber" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "transferType" "TransferType" NOT NULL,
    "status" "TransferStatus" NOT NULL DEFAULT 'DRAFT',
    "currentBranch" TEXT,
    "currentDepartment" TEXT,
    "currentDesignation" TEXT,
    "currentShiftId" TEXT,
    "newBranchId" TEXT,
    "newDepartment" TEXT,
    "newShiftId" TEXT,
    "tempBranchId" TEXT,
    "tempDepartment" TEXT,
    "tempShiftId" TEXT,
    "startDate" DATE,
    "endDate" DATE,
    "effectiveDate" DATE,
    "reason" TEXT NOT NULL,
    "newReportingManagerId" TEXT,
    "remarks" TEXT,
    "submittedAt" TIMESTAMP(3),
    "submittedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectedById" TEXT,
    "rejectionReason" TEXT,
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeResignation" (
    "id" TEXT NOT NULL,
    "resignationNumber" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "reportingManagerId" TEXT,
    "resignationType" "ResignationType" NOT NULL,
    "status" "ResignationStatus" NOT NULL DEFAULT 'DRAFT',
    "currentDepartment" TEXT,
    "currentDesignation" TEXT,
    "currentEmploymentType" TEXT,
    "currentEmployeeStatus" TEXT,
    "joiningDate" DATE,
    "confirmationDate" DATE,
    "resignationDate" DATE NOT NULL,
    "lastWorkingDate" DATE NOT NULL,
    "noticeRequired" BOOLEAN NOT NULL DEFAULT true,
    "noticePeriodDays" INTEGER NOT NULL DEFAULT 0,
    "noticeServedDays" INTEGER NOT NULL DEFAULT 0,
    "noticeWaived" BOOLEAN NOT NULL DEFAULT false,
    "buyoutAmount" DECIMAL(18,2),
    "reason" TEXT NOT NULL,
    "employeeRemarks" TEXT,
    "attachmentUrl" TEXT,
    "managerPerformance" TEXT,
    "currentProjects" TEXT,
    "handoverStatus" TEXT,
    "replacementNeeded" BOOLEAN,
    "assetsReturned" BOOLEAN,
    "managerRecommendation" TEXT,
    "attendanceVerified" BOOLEAN DEFAULT false,
    "leaveBalanceVerified" BOOLEAN DEFAULT false,
    "noticePeriodVerified" BOOLEAN DEFAULT false,
    "documentsVerified" BOOLEAN DEFAULT false,
    "policyVerified" BOOLEAN DEFAULT false,
    "pendingSalary" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "leaveEncashment" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "bonus" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "overtime" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "loanDeduction" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "advanceDeduction" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxDeduction" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "gratuity" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "finalPayable" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "settlementRequired" BOOLEAN NOT NULL DEFAULT false,
    "managerReviewStatus" "ResignationReviewStatus" NOT NULL DEFAULT 'PENDING',
    "managerReviewDate" TIMESTAMP(3),
    "managerRemarks" TEXT,
    "hrReviewStatus" "ResignationReviewStatus" NOT NULL DEFAULT 'PENDING',
    "hrReviewDate" TIMESTAMP(3),
    "hrRemarks" TEXT,
    "accountsReviewStatus" "ResignationReviewStatus" NOT NULL DEFAULT 'PENDING',
    "accountsReviewDate" TIMESTAMP(3),
    "accountsRemarks" TEXT,
    "acceptanceLetterGeneratedAt" TIMESTAMP(3),
    "experienceLetterGeneratedAt" TIMESTAMP(3),
    "relievingLetterGeneratedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeResignation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeExitClearance" (
    "id" TEXT NOT NULL,
    "clearanceNumber" TEXT NOT NULL,
    "resignationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "exitType" "ExitType" NOT NULL DEFAULT 'RESIGNATION',
    "status" "ExitClearanceStatus" NOT NULL DEFAULT 'DRAFT',
    "lastWorkingDate" DATE NOT NULL,
    "reasonForExit" TEXT,
    "noticePeriodServed" BOOLEAN NOT NULL DEFAULT false,
    "handoverCompleted" BOOLEAN NOT NULL DEFAULT false,
    "replacementAssigned" BOOLEAN NOT NULL DEFAULT false,
    "exitInterviewCompleted" BOOLEAN NOT NULL DEFAULT false,
    "hrRemarks" TEXT,
    "departmentClearedAt" TIMESTAMP(3),
    "accountsApprovedAt" TIMESTAMP(3),
    "hrApprovedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "clearanceCertificateGeneratedAt" TIMESTAMP(3),
    "relievingLetterGeneratedAt" TIMESTAMP(3),
    "experienceLetterGeneratedAt" TIMESTAMP(3),
    "noDueCertificateGeneratedAt" TIMESTAMP(3),
    "fullAndFinalGeneratedAt" TIMESTAMP(3),
    "serviceCertificateGeneratedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeExitClearance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeExitDepartmentClearance" (
    "id" TEXT NOT NULL,
    "clearanceId" TEXT NOT NULL,
    "departmentKey" TEXT NOT NULL,
    "departmentName" TEXT NOT NULL,
    "responsiblePerson" TEXT,
    "approverId" TEXT,
    "status" "ExitClearanceReviewStatus" NOT NULL DEFAULT 'PENDING',
    "remarks" TEXT,
    "approvedAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeExitDepartmentClearance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeExitAssetReturn" (
    "id" TEXT NOT NULL,
    "clearanceId" TEXT NOT NULL,
    "assetKey" TEXT NOT NULL,
    "assetName" TEXT NOT NULL,
    "returned" BOOLEAN NOT NULL DEFAULT false,
    "condition" "ExitAssetCondition" NOT NULL DEFAULT 'GOOD',
    "deductionAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "remarks" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeExitAssetReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeExitSystemAccess" (
    "id" TEXT NOT NULL,
    "clearanceId" TEXT NOT NULL,
    "erpAccountDisabled" BOOLEAN NOT NULL DEFAULT false,
    "emailDisabled" BOOLEAN NOT NULL DEFAULT false,
    "attendanceDeviceDisabled" BOOLEAN NOT NULL DEFAULT false,
    "vpnDisabled" BOOLEAN NOT NULL DEFAULT false,
    "fingerprintRemoved" BOOLEAN NOT NULL DEFAULT false,
    "doorAccessRemoved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeExitSystemAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeExitAccountsSettlement" (
    "id" TEXT NOT NULL,
    "clearanceId" TEXT NOT NULL,
    "status" "ExitClearanceReviewStatus" NOT NULL DEFAULT 'PENDING',
    "pendingSalary" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "leaveEncashment" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "bonus" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "overtime" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "loanRecovery" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "advanceRecovery" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "assetDamageRecovery" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "noticePay" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "gratuity" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxDeduction" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "otherDeduction" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "netPayable" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeExitAccountsSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeExitInterview" (
    "id" TEXT NOT NULL,
    "clearanceId" TEXT NOT NULL,
    "reasonForLeaving" TEXT,
    "companyRating" INTEGER,
    "managerRating" INTEGER,
    "suggestions" TEXT,
    "rehireEligible" BOOLEAN,
    "interviewConductedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeExitInterview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "contractNo" TEXT NOT NULL,
    "employeeId" TEXT,
    "candidateId" TEXT,
    "offerId" TEXT,
    "candidateName" TEXT,
    "branchId" TEXT,
    "department" TEXT,
    "designation" TEXT,
    "contractType" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "basicSalary" DECIMAL(18,2) NOT NULL,
    "allowances" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "shiftId" TEXT,
    "weeklyOff" TEXT NOT NULL DEFAULT 'Friday',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "attachmentUrl" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "branchId" TEXT,
    "department" TEXT,
    "shiftId" TEXT,
    "graceLateEntryMinutes" INTEGER NOT NULL DEFAULT 15,
    "graceEarlyExitMinutes" INTEGER NOT NULL DEFAULT 15,
    "minWorkingHoursPresent" DECIMAL(5,2) NOT NULL DEFAULT 6,
    "minWorkingHoursHalfDay" DECIMAL(5,2) NOT NULL DEFAULT 4,
    "overtimeStartAfterMinutes" INTEGER NOT NULL DEFAULT 30,
    "minOvertimeMinutes" INTEGER NOT NULL DEFAULT 30,
    "allowMissingPunch" BOOLEAN NOT NULL DEFAULT false,
    "allowLatePunch" BOOLEAN NOT NULL DEFAULT false,
    "autoApproveOvertime" BOOLEAN NOT NULL DEFAULT false,
    "requireHrApproval" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceException" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "type" TEXT NOT NULL,
    "missingType" "MissingPunchType",
    "actualTime" TIMESTAMP(3),
    "expectedTime" TIMESTAMP(3),
    "diffMinutes" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT,
    "attachment" TEXT,
    "status" "PunchCorrectionStatus" NOT NULL DEFAULT 'PENDING',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OvertimeRecord" (
    "id" TEXT NOT NULL,
    "otNumber" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "shiftId" TEXT,
    "otDate" DATE NOT NULL,
    "otMonth" TEXT NOT NULL,
    "otType" "OvertimeType" NOT NULL DEFAULT 'REGULAR',
    "source" "OvertimeSource" NOT NULL DEFAULT 'ATTENDANCE_BASED',
    "status" "OvertimeStatus" NOT NULL DEFAULT 'DRAFT',
    "attendanceDate" DATE NOT NULL,
    "checkIn" TIMESTAMP(3),
    "checkOut" TIMESTAMP(3),
    "totalWorkedMinutes" INTEGER NOT NULL DEFAULT 0,
    "regularDutyMinutes" INTEGER NOT NULL DEFAULT 0,
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,
    "extraWorkedMinutes" INTEGER NOT NULL DEFAULT 0,
    "lateMinutes" INTEGER NOT NULL DEFAULT 0,
    "earlyExitMinutes" INTEGER NOT NULL DEFAULT 0,
    "eligibleOtMinutes" INTEGER NOT NULL DEFAULT 0,
    "approvedOtMinutes" INTEGER NOT NULL DEFAULT 0,
    "otRateType" "OvertimeRateType" NOT NULL DEFAULT 'FIXED_RATE',
    "otRatePerHour" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "otAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "roundOtHours" BOOLEAN NOT NULL DEFAULT false,
    "minOtMinutes" INTEGER NOT NULL DEFAULT 0,
    "remarks" TEXT,
    "managerStatus" TEXT,
    "managerOtMinutes" INTEGER,
    "managerRemarks" TEXT,
    "managerApprovedById" TEXT,
    "managerApprovedAt" TIMESTAMP(3),
    "hrStatus" TEXT,
    "hrVerifiedMinutes" INTEGER,
    "hrRemarks" TEXT,
    "hrVerifiedById" TEXT,
    "hrVerifiedAt" TIMESTAMP(3),
    "accountsStatus" TEXT,
    "accountsOtRate" DECIMAL(18,2),
    "accountsOtAmount" DECIMAL(18,2),
    "payrollMonth" TEXT,
    "costCenter" TEXT,
    "accountsRemarks" TEXT,
    "accountsApprovedById" TEXT,
    "accountsApprovedAt" TIMESTAMP(3),
    "postedToPayroll" BOOLEAN NOT NULL DEFAULT false,
    "postedAt" TIMESTAMP(3),
    "postedById" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OvertimeRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceAdjustment" (
    "id" TEXT NOT NULL,
    "adjustmentNumber" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "attendanceDate" DATE NOT NULL,
    "adjustmentType" "AttendanceAdjustmentType" NOT NULL,
    "reason" TEXT NOT NULL,
    "remarks" TEXT,
    "attachmentUrl" TEXT,
    "adjustedById" TEXT NOT NULL,
    "adjustedAt" TIMESTAMP(3),
    "status" "AttendanceAdjustmentStatus" NOT NULL DEFAULT 'DRAFT',
    "oldShiftId" TEXT,
    "newShiftId" TEXT,
    "oldCheckIn" TIMESTAMP(3),
    "oldCheckOut" TIMESTAMP(3),
    "oldStatus" "AttendanceStatus" NOT NULL,
    "oldWorkingMinutes" INTEGER NOT NULL DEFAULT 0,
    "oldOtMinutes" INTEGER NOT NULL DEFAULT 0,
    "oldLateMinutes" INTEGER NOT NULL DEFAULT 0,
    "oldEarlyMinutes" INTEGER NOT NULL DEFAULT 0,
    "newCheckIn" TIMESTAMP(3),
    "newCheckOut" TIMESTAMP(3),
    "newStatus" "AttendanceStatus" NOT NULL,
    "newWorkingMinutes" INTEGER NOT NULL DEFAULT 0,
    "newOtMinutes" INTEGER NOT NULL DEFAULT 0,
    "newLateMinutes" INTEGER NOT NULL DEFAULT 0,
    "newEarlyMinutes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceSummaryRecord" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "summaryMonth" TEXT NOT NULL,
    "totalCalendarDays" INTEGER NOT NULL DEFAULT 0,
    "weeklyOffDays" INTEGER NOT NULL DEFAULT 0,
    "holidayDays" INTEGER NOT NULL DEFAULT 0,
    "workingDays" INTEGER NOT NULL DEFAULT 0,
    "presentDays" INTEGER NOT NULL DEFAULT 0,
    "absentDays" INTEGER NOT NULL DEFAULT 0,
    "leaveDays" INTEGER NOT NULL DEFAULT 0,
    "halfDays" INTEGER NOT NULL DEFAULT 0,
    "lateDays" INTEGER NOT NULL DEFAULT 0,
    "earlyExitDays" INTEGER NOT NULL DEFAULT 0,
    "totalWorkedHours" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalOtHours" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "payableDays" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "AttendanceSummaryStatus" NOT NULL DEFAULT 'GENERATED',
    "payrollMonth" TEXT,
    "isPayrollReady" BOOLEAN NOT NULL DEFAULT false,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "sentToPayroll" BOOLEAN NOT NULL DEFAULT false,
    "sentById" TEXT,
    "sentAt" TIMESTAMP(3),
    "payrollProcessed" BOOLEAN NOT NULL DEFAULT false,
    "remarks" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceSummaryRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryComponent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "category" "SalaryComponentCategory" NOT NULL,
    "type" "SalaryComponentType" NOT NULL,
    "calculationType" "SalaryCalculationType" NOT NULL,
    "value" DECIMAL(18,4),
    "formula" TEXT,
    "baseComponent" TEXT,
    "isTaxable" BOOLEAN NOT NULL DEFAULT true,
    "includeInGross" BOOLEAN NOT NULL DEFAULT true,
    "includeInNet" BOOLEAN NOT NULL DEFAULT true,
    "showInPayslip" BOOLEAN NOT NULL DEFAULT true,
    "isSystemGenerated" BOOLEAN NOT NULL DEFAULT false,
    "isMandatory" BOOLEAN NOT NULL DEFAULT false,
    "isEditableDuringPayroll" BOOLEAN NOT NULL DEFAULT false,
    "allowNegativeValue" BOOLEAN NOT NULL DEFAULT false,
    "maxAmount" DECIMAL(18,4),
    "minAmount" DECIMAL(18,4),
    "status" "SalaryComponentStatus" NOT NULL DEFAULT 'ACTIVE',
    "applicableEmploymentTypes" TEXT[],
    "applicableDepartments" TEXT[],
    "applicableDesignations" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalaryComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryStructure" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "status" "SalaryStructureStatus" NOT NULL DEFAULT 'ACTIVE',
    "grossSalary" DECIMAL(18,4) NOT NULL,
    "netSalary" DECIMAL(18,4),
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "payrollFrequency" "PayrollFrequency" NOT NULL DEFAULT 'MONTHLY',
    "currency" "CurrencyCode" NOT NULL DEFAULT 'BDT',
    "employmentTypes" TEXT[],
    "departmentIds" TEXT[],
    "designationIds" TEXT[],
    "branchIds" TEXT[],
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalaryStructure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryStructureComponent" (
    "id" TEXT NOT NULL,
    "salaryStructureId" TEXT NOT NULL,
    "salaryComponentId" TEXT NOT NULL,
    "value" DECIMAL(18,4) NOT NULL,
    "isAutoCalculated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalaryStructureComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeSalaryStructureAssignment" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "salaryStructureId" TEXT NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeSalaryStructureAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollPeriod" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "processingDate" DATE,
    "paymentDate" DATE,
    "attendanceCutoffDate" DATE,
    "overtimeCutoffDate" DATE,
    "leaveCutoffDate" DATE,
    "includeAttendance" BOOLEAN NOT NULL DEFAULT true,
    "includeLeave" BOOLEAN NOT NULL DEFAULT true,
    "includeOvertime" BOOLEAN NOT NULL DEFAULT true,
    "includeBonus" BOOLEAN NOT NULL DEFAULT true,
    "includeLoanDeduction" BOOLEAN NOT NULL DEFAULT true,
    "includeSalaryAdvance" BOOLEAN NOT NULL DEFAULT true,
    "includeTax" BOOLEAN NOT NULL DEFAULT true,
    "allowReprocessing" BOOLEAN NOT NULL DEFAULT false,
    "autoCloseAfterPayroll" BOOLEAN NOT NULL DEFAULT true,
    "lockPayrollAfterClosing" BOOLEAN NOT NULL DEFAULT true,
    "status" "PayrollPeriodStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanRequest" (
    "id" TEXT NOT NULL,
    "referenceNo" TEXT NOT NULL,
    "requestType" "LoanType" NOT NULL DEFAULT 'EMPLOYEE_LOAN',
    "employeeId" TEXT NOT NULL,
    "loanAmount" DECIMAL(18,4) NOT NULL,
    "purpose" "LoanPurpose" NOT NULL,
    "disbursementDate" DATE NOT NULL,
    "repaymentStartMonth" TEXT NOT NULL,
    "installmentType" "LoanInstallmentType" NOT NULL DEFAULT 'MONTHLY',
    "numberOfInstallments" INTEGER NOT NULL DEFAULT 1,
    "monthlyDeduction" DECIMAL(18,4) NOT NULL,
    "outstandingBalance" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "paidAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "remarks" TEXT,
    "status" "LoanStatus" NOT NULL DEFAULT 'DRAFT',
    "hrApprovalStatus" TEXT,
    "accountsVerification" TEXT,
    "managementDecision" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanRepaymentSchedule" (
    "id" TEXT NOT NULL,
    "loanRequestId" TEXT NOT NULL,
    "payrollMonth" TEXT NOT NULL,
    "installment" DECIMAL(18,4) NOT NULL,
    "remainingBalance" DECIMAL(18,4) NOT NULL,
    "status" "RepaymentStatus" NOT NULL DEFAULT 'PENDING',
    "payrollRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanRepaymentSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bonus" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "bonusType" "BonusType" NOT NULL DEFAULT 'FESTIVAL',
    "effectivePayrollMonth" TEXT NOT NULL,
    "description" TEXT,
    "calculationMethod" "BonusCalculationMethod" NOT NULL DEFAULT 'FIXED_AMOUNT',
    "amount" DECIMAL(18,4),
    "percentage" DECIMAL(18,4),
    "basedOn" "BonusBasedOn",
    "minimumServiceMonths" INTEGER NOT NULL DEFAULT 0,
    "paymentMethod" "BonusPaymentMethod" NOT NULL DEFAULT 'PAYROLL',
    "paymentDate" DATE,
    "includeInPayslip" BOOLEAN NOT NULL DEFAULT true,
    "status" "BonusStatus" NOT NULL DEFAULT 'DRAFT',
    "hrApprovalStatus" TEXT,
    "managementDecision" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bonus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeBonus" (
    "id" TEXT NOT NULL,
    "bonusId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "payrollRunId" TEXT,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeBonus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollAdjustment" (
    "id" TEXT NOT NULL,
    "no" TEXT NOT NULL,
    "payrollPeriodId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "adjustmentDate" DATE NOT NULL,
    "type" "PayrollAdjustmentType" NOT NULL,
    "category" "PayrollAdjustmentCategory" NOT NULL DEFAULT 'ONE_TIME',
    "amount" DECIMAL(18,4) NOT NULL,
    "description" TEXT,
    "includeInGrossSalary" BOOLEAN NOT NULL DEFAULT true,
    "includeInTax" BOOLEAN NOT NULL DEFAULT false,
    "includeInPayslip" BOOLEAN NOT NULL DEFAULT true,
    "reason" "PayrollAdjustmentReason" NOT NULL,
    "remarks" TEXT,
    "status" "PayrollAdjustmentStatus" NOT NULL DEFAULT 'DRAFT',
    "hrDecision" TEXT,
    "managementDecision" TEXT,
    "payrollRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinalSettlement" (
    "id" TEXT NOT NULL,
    "no" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "resignationId" TEXT,
    "separationType" TEXT NOT NULL,
    "lastWorkingDate" DATE NOT NULL,
    "reason" TEXT,
    "pendingSalary" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "leaveEncashment" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "overtimeAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "bonusAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "otherEarnings" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalEarnings" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "loanRecovery" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "advanceRecovery" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "incomeTax" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "noticePayRecovery" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "assetRecovery" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "otherDeductions" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalDeductions" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "netSettlement" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "FinalSettlementStatus" NOT NULL DEFAULT 'DRAFT',
    "hrApproval" TEXT,
    "financeApproval" TEXT,
    "managementApproval" TEXT,
    "remarks" TEXT,
    "paymentMethod" TEXT,
    "paymentDate" TIMESTAMP(3),
    "transactionRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinalSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DebitNote_number_key" ON "DebitNote"("number");

-- CreateIndex
CREATE INDEX "DebitNote_branchId_status_idx" ON "DebitNote"("branchId", "status");

-- CreateIndex
CREATE INDEX "DebitNote_supplierId_idx" ON "DebitNote"("supplierId");

-- CreateIndex
CREATE INDEX "DebitNoteItem_debitNoteId_idx" ON "DebitNoteItem"("debitNoteId");

-- CreateIndex
CREATE INDEX "DebitNoteItem_productId_idx" ON "DebitNoteItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionPlan_planNo_key" ON "ProductionPlan"("planNo");

-- CreateIndex
CREATE INDEX "ProductionPlan_branchId_status_idx" ON "ProductionPlan"("branchId", "status");

-- CreateIndex
CREATE INDEX "ProductionPlan_productId_idx" ON "ProductionPlan"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrder_workOrderNo_key" ON "WorkOrder"("workOrderNo");

-- CreateIndex
CREATE INDEX "WorkOrder_orderId_status_idx" ON "WorkOrder"("orderId", "status");

-- CreateIndex
CREATE INDEX "WorkOrder_operatorId_idx" ON "WorkOrder"("operatorId");

-- CreateIndex
CREATE INDEX "DelayTracking_workOrderId_idx" ON "DelayTracking"("workOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionIssueVoucher_voucherNo_key" ON "ProductionIssueVoucher"("voucherNo");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessTracking_trackingNo_key" ON "ProcessTracking"("trackingNo");

-- CreateIndex
CREATE UNIQUE INDEX "FinishedGoodsReceiveVoucher_receiveNo_key" ON "FinishedGoodsReceiveVoucher"("receiveNo");

-- CreateIndex
CREATE UNIQUE INDEX "CorporateSalesReturn_returnNo_key" ON "CorporateSalesReturn"("returnNo");

-- CreateIndex
CREATE INDEX "CorporateSalesReturn_branchId_returnDate_idx" ON "CorporateSalesReturn"("branchId", "returnDate");

-- CreateIndex
CREATE INDEX "CorporateSalesReturn_orderId_idx" ON "CorporateSalesReturn"("orderId");

-- CreateIndex
CREATE INDEX "CorporateSalesReturnItem_returnId_idx" ON "CorporateSalesReturnItem"("returnId");

-- CreateIndex
CREATE INDEX "CorporateSalesReturnItem_productId_idx" ON "CorporateSalesReturnItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_code_key" ON "Holiday"("code");

-- CreateIndex
CREATE INDEX "Holiday_startDate_endDate_status_idx" ON "Holiday"("startDate", "endDate", "status");

-- CreateIndex
CREATE INDEX "Holiday_branchId_startDate_endDate_idx" ON "Holiday"("branchId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "Holiday_type_status_idx" ON "Holiday"("type", "status");

-- CreateIndex
CREATE INDEX "HrMasterData_branchId_type_idx" ON "HrMasterData"("branchId", "type");

-- CreateIndex
CREATE INDEX "HrMasterData_type_status_idx" ON "HrMasterData"("type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "HrMasterData_type_code_key" ON "HrMasterData"("type", "code");

-- CreateIndex
CREATE INDEX "HrWorkflowRecord_branchId_section_idx" ON "HrWorkflowRecord"("branchId", "section");

-- CreateIndex
CREATE INDEX "HrWorkflowRecord_employeeId_section_idx" ON "HrWorkflowRecord"("employeeId", "section");

-- CreateIndex
CREATE INDEX "HrWorkflowRecord_section_status_idx" ON "HrWorkflowRecord"("section", "status");

-- CreateIndex
CREATE INDEX "HrWorkflowRecord_startDate_idx" ON "HrWorkflowRecord"("startDate");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeConfirmation_confirmationNumber_key" ON "EmployeeConfirmation"("confirmationNumber");

-- CreateIndex
CREATE INDEX "EmployeeConfirmation_branchId_status_idx" ON "EmployeeConfirmation"("branchId", "status");

-- CreateIndex
CREATE INDEX "EmployeeConfirmation_employeeId_status_idx" ON "EmployeeConfirmation"("employeeId", "status");

-- CreateIndex
CREATE INDEX "EmployeeConfirmation_confirmationType_status_idx" ON "EmployeeConfirmation"("confirmationType", "status");

-- CreateIndex
CREATE INDEX "EmployeeConfirmation_effectiveDate_idx" ON "EmployeeConfirmation"("effectiveDate");

-- CreateIndex
CREATE INDEX "EmployeeConfirmation_createdAt_idx" ON "EmployeeConfirmation"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeTransfer_transferNumber_key" ON "EmployeeTransfer"("transferNumber");

-- CreateIndex
CREATE INDEX "EmployeeTransfer_branchId_status_idx" ON "EmployeeTransfer"("branchId", "status");

-- CreateIndex
CREATE INDEX "EmployeeTransfer_employeeId_status_idx" ON "EmployeeTransfer"("employeeId", "status");

-- CreateIndex
CREATE INDEX "EmployeeTransfer_transferType_status_idx" ON "EmployeeTransfer"("transferType", "status");

-- CreateIndex
CREATE INDEX "EmployeeTransfer_effectiveDate_idx" ON "EmployeeTransfer"("effectiveDate");

-- CreateIndex
CREATE INDEX "EmployeeTransfer_startDate_endDate_idx" ON "EmployeeTransfer"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "EmployeeTransfer_createdAt_idx" ON "EmployeeTransfer"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeResignation_resignationNumber_key" ON "EmployeeResignation"("resignationNumber");

-- CreateIndex
CREATE INDEX "EmployeeResignation_branchId_status_idx" ON "EmployeeResignation"("branchId", "status");

-- CreateIndex
CREATE INDEX "EmployeeResignation_employeeId_status_idx" ON "EmployeeResignation"("employeeId", "status");

-- CreateIndex
CREATE INDEX "EmployeeResignation_resignationType_status_idx" ON "EmployeeResignation"("resignationType", "status");

-- CreateIndex
CREATE INDEX "EmployeeResignation_lastWorkingDate_idx" ON "EmployeeResignation"("lastWorkingDate");

-- CreateIndex
CREATE INDEX "EmployeeResignation_createdAt_idx" ON "EmployeeResignation"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeExitClearance_clearanceNumber_key" ON "EmployeeExitClearance"("clearanceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeExitClearance_resignationId_key" ON "EmployeeExitClearance"("resignationId");

-- CreateIndex
CREATE INDEX "EmployeeExitClearance_branchId_status_idx" ON "EmployeeExitClearance"("branchId", "status");

-- CreateIndex
CREATE INDEX "EmployeeExitClearance_employeeId_status_idx" ON "EmployeeExitClearance"("employeeId", "status");

-- CreateIndex
CREATE INDEX "EmployeeExitClearance_lastWorkingDate_status_idx" ON "EmployeeExitClearance"("lastWorkingDate", "status");

-- CreateIndex
CREATE INDEX "EmployeeExitDepartmentClearance_clearanceId_status_idx" ON "EmployeeExitDepartmentClearance"("clearanceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeExitDepartmentClearance_clearanceId_departmentKey_key" ON "EmployeeExitDepartmentClearance"("clearanceId", "departmentKey");

-- CreateIndex
CREATE INDEX "EmployeeExitAssetReturn_clearanceId_idx" ON "EmployeeExitAssetReturn"("clearanceId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeExitAssetReturn_clearanceId_assetKey_key" ON "EmployeeExitAssetReturn"("clearanceId", "assetKey");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeExitSystemAccess_clearanceId_key" ON "EmployeeExitSystemAccess"("clearanceId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeExitAccountsSettlement_clearanceId_key" ON "EmployeeExitAccountsSettlement"("clearanceId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeExitInterview_clearanceId_key" ON "EmployeeExitInterview"("clearanceId");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_contractNo_key" ON "Contract"("contractNo");

-- CreateIndex
CREATE INDEX "Contract_employeeId_idx" ON "Contract"("employeeId");

-- CreateIndex
CREATE INDEX "Contract_candidateId_idx" ON "Contract"("candidateId");

-- CreateIndex
CREATE INDEX "Contract_offerId_idx" ON "Contract"("offerId");

-- CreateIndex
CREATE INDEX "Contract_branchId_idx" ON "Contract"("branchId");

-- CreateIndex
CREATE INDEX "Contract_status_idx" ON "Contract"("status");

-- CreateIndex
CREATE INDEX "Contract_endDate_idx" ON "Contract"("endDate");

-- CreateIndex
CREATE INDEX "AttendanceException_employeeId_date_idx" ON "AttendanceException"("employeeId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "OvertimeRecord_otNumber_key" ON "OvertimeRecord"("otNumber");

-- CreateIndex
CREATE INDEX "OvertimeRecord_branchId_status_idx" ON "OvertimeRecord"("branchId", "status");

-- CreateIndex
CREATE INDEX "OvertimeRecord_employeeId_otDate_idx" ON "OvertimeRecord"("employeeId", "otDate");

-- CreateIndex
CREATE INDEX "OvertimeRecord_otMonth_status_idx" ON "OvertimeRecord"("otMonth", "status");

-- CreateIndex
CREATE INDEX "OvertimeRecord_status_idx" ON "OvertimeRecord"("status");

-- CreateIndex
CREATE INDEX "OvertimeRecord_createdAt_idx" ON "OvertimeRecord"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceAdjustment_adjustmentNumber_key" ON "AttendanceAdjustment"("adjustmentNumber");

-- CreateIndex
CREATE INDEX "AttendanceAdjustment_branchId_status_idx" ON "AttendanceAdjustment"("branchId", "status");

-- CreateIndex
CREATE INDEX "AttendanceAdjustment_employeeId_attendanceDate_idx" ON "AttendanceAdjustment"("employeeId", "attendanceDate");

-- CreateIndex
CREATE INDEX "AttendanceAdjustment_attendanceDate_status_idx" ON "AttendanceAdjustment"("attendanceDate", "status");

-- CreateIndex
CREATE INDEX "AttendanceSummaryRecord_branchId_summaryMonth_idx" ON "AttendanceSummaryRecord"("branchId", "summaryMonth");

-- CreateIndex
CREATE INDEX "AttendanceSummaryRecord_status_idx" ON "AttendanceSummaryRecord"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceSummaryRecord_employeeId_summaryMonth_key" ON "AttendanceSummaryRecord"("employeeId", "summaryMonth");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryComponent_code_key" ON "SalaryComponent"("code");

-- CreateIndex
CREATE INDEX "SalaryComponent_category_idx" ON "SalaryComponent"("category");

-- CreateIndex
CREATE INDEX "SalaryComponent_type_idx" ON "SalaryComponent"("type");

-- CreateIndex
CREATE INDEX "SalaryComponent_status_idx" ON "SalaryComponent"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryStructure_code_key" ON "SalaryStructure"("code");

-- CreateIndex
CREATE INDEX "SalaryStructure_status_idx" ON "SalaryStructure"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryStructureComponent_salaryStructureId_salaryComponentI_key" ON "SalaryStructureComponent"("salaryStructureId", "salaryComponentId");

-- CreateIndex
CREATE INDEX "EmployeeSalaryStructureAssignment_employeeId_idx" ON "EmployeeSalaryStructureAssignment"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeSalaryStructureAssignment_salaryStructureId_idx" ON "EmployeeSalaryStructureAssignment"("salaryStructureId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPeriod_code_key" ON "PayrollPeriod"("code");

-- CreateIndex
CREATE INDEX "PayrollPeriod_status_idx" ON "PayrollPeriod"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPeriod_month_year_key" ON "PayrollPeriod"("month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "LoanRequest_referenceNo_key" ON "LoanRequest"("referenceNo");

-- CreateIndex
CREATE INDEX "LoanRequest_employeeId_status_idx" ON "LoanRequest"("employeeId", "status");

-- CreateIndex
CREATE INDEX "LoanRequest_requestType_idx" ON "LoanRequest"("requestType");

-- CreateIndex
CREATE INDEX "LoanRepaymentSchedule_loanRequestId_idx" ON "LoanRepaymentSchedule"("loanRequestId");

-- CreateIndex
CREATE INDEX "LoanRepaymentSchedule_payrollMonth_idx" ON "LoanRepaymentSchedule"("payrollMonth");

-- CreateIndex
CREATE UNIQUE INDEX "Bonus_code_key" ON "Bonus"("code");

-- CreateIndex
CREATE INDEX "Bonus_effectivePayrollMonth_idx" ON "Bonus"("effectivePayrollMonth");

-- CreateIndex
CREATE INDEX "Bonus_status_idx" ON "Bonus"("status");

-- CreateIndex
CREATE INDEX "EmployeeBonus_employeeId_idx" ON "EmployeeBonus"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeBonus_bonusId_employeeId_key" ON "EmployeeBonus"("bonusId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollAdjustment_no_key" ON "PayrollAdjustment"("no");

-- CreateIndex
CREATE INDEX "PayrollAdjustment_payrollPeriodId_idx" ON "PayrollAdjustment"("payrollPeriodId");

-- CreateIndex
CREATE INDEX "PayrollAdjustment_employeeId_idx" ON "PayrollAdjustment"("employeeId");

-- CreateIndex
CREATE INDEX "PayrollAdjustment_status_idx" ON "PayrollAdjustment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "FinalSettlement_no_key" ON "FinalSettlement"("no");

-- CreateIndex
CREATE UNIQUE INDEX "FinalSettlement_resignationId_key" ON "FinalSettlement"("resignationId");

-- CreateIndex
CREATE INDEX "FinalSettlement_employeeId_idx" ON "FinalSettlement"("employeeId");

-- CreateIndex
CREATE INDEX "FinalSettlement_status_idx" ON "FinalSettlement"("status");

-- CreateIndex
CREATE INDEX "Employee_designation_idx" ON "Employee"("designation");

-- CreateIndex
CREATE INDEX "Employee_employmentType_idx" ON "Employee"("employmentType");

-- CreateIndex
CREATE INDEX "Employee_reportingManagerId_idx" ON "Employee"("reportingManagerId");

-- CreateIndex
CREATE INDEX "Employee_systemRoleId_idx" ON "Employee"("systemRoleId");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveRequest_leaveRequestNo_key" ON "LeaveRequest"("leaveRequestNo");

-- CreateIndex
CREATE UNIQUE INDEX "Payslip_no_key" ON "Payslip"("no");

-- CreateIndex
CREATE UNIQUE INDEX "User_employeeId_key" ON "User"("employeeId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebitNote" ADD CONSTRAINT "DebitNote_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebitNote" ADD CONSTRAINT "DebitNote_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebitNote" ADD CONSTRAINT "DebitNote_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "PurchaseInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebitNote" ADD CONSTRAINT "DebitNote_grnId_fkey" FOREIGN KEY ("grnId") REFERENCES "GoodsReceiving"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebitNoteItem" ADD CONSTRAINT "DebitNoteItem_debitNoteId_fkey" FOREIGN KEY ("debitNoteId") REFERENCES "DebitNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebitNoteItem" ADD CONSTRAINT "DebitNoteItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionPlan" ADD CONSTRAINT "ProductionPlan_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionPlan" ADD CONSTRAINT "ProductionPlan_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionPlan" ADD CONSTRAINT "ProductionPlan_plannerId_fkey" FOREIGN KEY ("plannerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ProductionPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ProductionOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DelayTracking" ADD CONSTRAINT "DelayTracking_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionIssueVoucher" ADD CONSTRAINT "ProductionIssueVoucher_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionIssueVoucher" ADD CONSTRAINT "ProductionIssueVoucher_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ProductionOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionIssueVoucher" ADD CONSTRAINT "ProductionIssueVoucher_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionIssueVoucher" ADD CONSTRAINT "ProductionIssueVoucher_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionIssueVoucher" ADD CONSTRAINT "ProductionIssueVoucher_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionIssueVoucher" ADD CONSTRAINT "ProductionIssueVoucher_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionIssueItem" ADD CONSTRAINT "ProductionIssueItem_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "ProductionIssueVoucher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionIssueItem" ADD CONSTRAINT "ProductionIssueItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessTracking" ADD CONSTRAINT "ProcessTracking_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ProductionOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessTracking" ADD CONSTRAINT "ProcessTracking_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessTracking" ADD CONSTRAINT "ProcessTracking_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessTracking" ADD CONSTRAINT "ProcessTracking_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "ProductionStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessTracking" ADD CONSTRAINT "ProcessTracking_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WipLedger" ADD CONSTRAINT "WipLedger_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WipLedger" ADD CONSTRAINT "WipLedger_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ProductionOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WipLedger" ADD CONSTRAINT "WipLedger_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "ProductionStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WipLedger" ADD CONSTRAINT "WipLedger_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WipLedger" ADD CONSTRAINT "WipLedger_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrapLedger" ADD CONSTRAINT "ScrapLedger_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrapLedger" ADD CONSTRAINT "ScrapLedger_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ProductionOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrapLedger" ADD CONSTRAINT "ScrapLedger_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "ProductionStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrapLedger" ADD CONSTRAINT "ScrapLedger_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinishedGoodsReceiveVoucher" ADD CONSTRAINT "FinishedGoodsReceiveVoucher_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinishedGoodsReceiveVoucher" ADD CONSTRAINT "FinishedGoodsReceiveVoucher_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ProductionOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinishedGoodsReceiveVoucher" ADD CONSTRAINT "FinishedGoodsReceiveVoucher_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinishedGoodsReceiveVoucher" ADD CONSTRAINT "FinishedGoodsReceiveVoucher_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinishedGoodsReceiveVoucher" ADD CONSTRAINT "FinishedGoodsReceiveVoucher_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinishedGoodsReceiveItem" ADD CONSTRAINT "FinishedGoodsReceiveItem_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "FinishedGoodsReceiveVoucher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinishedGoodsReceiveItem" ADD CONSTRAINT "FinishedGoodsReceiveItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorporateDelivery" ADD CONSTRAINT "CorporateDelivery_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorporateSalesReturn" ADD CONSTRAINT "CorporateSalesReturn_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorporateSalesReturn" ADD CONSTRAINT "CorporateSalesReturn_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorporateSalesReturn" ADD CONSTRAINT "CorporateSalesReturn_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CorporateOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorporateSalesReturn" ADD CONSTRAINT "CorporateSalesReturn_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "CorporateInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorporateSalesReturn" ADD CONSTRAINT "CorporateSalesReturn_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorporateSalesReturn" ADD CONSTRAINT "CorporateSalesReturn_qcOfficerId_fkey" FOREIGN KEY ("qcOfficerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorporateSalesReturnItem" ADD CONSTRAINT "CorporateSalesReturnItem_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "CorporateSalesReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorporateSalesReturnItem" ADD CONSTRAINT "CorporateSalesReturnItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "CorporateOrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorporateSalesReturnItem" ADD CONSTRAINT "CorporateSalesReturnItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_reportingManagerId_fkey" FOREIGN KEY ("reportingManagerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_systemRoleId_fkey" FOREIGN KEY ("systemRoleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holiday" ADD CONSTRAINT "Holiday_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrMasterData" ADD CONSTRAINT "HrMasterData_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrWorkflowRecord" ADD CONSTRAINT "HrWorkflowRecord_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrWorkflowRecord" ADD CONSTRAINT "HrWorkflowRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeConfirmation" ADD CONSTRAINT "EmployeeConfirmation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeConfirmation" ADD CONSTRAINT "EmployeeConfirmation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeConfirmation" ADD CONSTRAINT "EmployeeConfirmation_reportingManagerId_fkey" FOREIGN KEY ("reportingManagerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeTransfer" ADD CONSTRAINT "EmployeeTransfer_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeTransfer" ADD CONSTRAINT "EmployeeTransfer_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeTransfer" ADD CONSTRAINT "EmployeeTransfer_currentShiftId_fkey" FOREIGN KEY ("currentShiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeTransfer" ADD CONSTRAINT "EmployeeTransfer_newBranchId_fkey" FOREIGN KEY ("newBranchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeTransfer" ADD CONSTRAINT "EmployeeTransfer_newShiftId_fkey" FOREIGN KEY ("newShiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeTransfer" ADD CONSTRAINT "EmployeeTransfer_tempBranchId_fkey" FOREIGN KEY ("tempBranchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeTransfer" ADD CONSTRAINT "EmployeeTransfer_tempShiftId_fkey" FOREIGN KEY ("tempShiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeTransfer" ADD CONSTRAINT "EmployeeTransfer_newReportingManagerId_fkey" FOREIGN KEY ("newReportingManagerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeResignation" ADD CONSTRAINT "EmployeeResignation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeResignation" ADD CONSTRAINT "EmployeeResignation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeResignation" ADD CONSTRAINT "EmployeeResignation_reportingManagerId_fkey" FOREIGN KEY ("reportingManagerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeExitClearance" ADD CONSTRAINT "EmployeeExitClearance_resignationId_fkey" FOREIGN KEY ("resignationId") REFERENCES "EmployeeResignation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeExitClearance" ADD CONSTRAINT "EmployeeExitClearance_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeExitClearance" ADD CONSTRAINT "EmployeeExitClearance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeExitDepartmentClearance" ADD CONSTRAINT "EmployeeExitDepartmentClearance_clearanceId_fkey" FOREIGN KEY ("clearanceId") REFERENCES "EmployeeExitClearance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeExitAssetReturn" ADD CONSTRAINT "EmployeeExitAssetReturn_clearanceId_fkey" FOREIGN KEY ("clearanceId") REFERENCES "EmployeeExitClearance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeExitSystemAccess" ADD CONSTRAINT "EmployeeExitSystemAccess_clearanceId_fkey" FOREIGN KEY ("clearanceId") REFERENCES "EmployeeExitClearance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeExitAccountsSettlement" ADD CONSTRAINT "EmployeeExitAccountsSettlement_clearanceId_fkey" FOREIGN KEY ("clearanceId") REFERENCES "EmployeeExitClearance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeExitInterview" ADD CONSTRAINT "EmployeeExitInterview_clearanceId_fkey" FOREIGN KEY ("clearanceId") REFERENCES "EmployeeExitClearance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRule" ADD CONSTRAINT "AttendanceRule_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRule" ADD CONSTRAINT "AttendanceRule_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceException" ADD CONSTRAINT "AttendanceException_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceException" ADD CONSTRAINT "AttendanceException_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OvertimeRecord" ADD CONSTRAINT "OvertimeRecord_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OvertimeRecord" ADD CONSTRAINT "OvertimeRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OvertimeRecord" ADD CONSTRAINT "OvertimeRecord_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceAdjustment" ADD CONSTRAINT "AttendanceAdjustment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceAdjustment" ADD CONSTRAINT "AttendanceAdjustment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceAdjustment" ADD CONSTRAINT "AttendanceAdjustment_oldShiftId_fkey" FOREIGN KEY ("oldShiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceAdjustment" ADD CONSTRAINT "AttendanceAdjustment_newShiftId_fkey" FOREIGN KEY ("newShiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_handoverEmployeeId_fkey" FOREIGN KEY ("handoverEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSummaryRecord" ADD CONSTRAINT "AttendanceSummaryRecord_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSummaryRecord" ADD CONSTRAINT "AttendanceSummaryRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_payrollPeriodId_fkey" FOREIGN KEY ("payrollPeriodId") REFERENCES "PayrollPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryStructureComponent" ADD CONSTRAINT "SalaryStructureComponent_salaryStructureId_fkey" FOREIGN KEY ("salaryStructureId") REFERENCES "SalaryStructure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryStructureComponent" ADD CONSTRAINT "SalaryStructureComponent_salaryComponentId_fkey" FOREIGN KEY ("salaryComponentId") REFERENCES "SalaryComponent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSalaryStructureAssignment" ADD CONSTRAINT "EmployeeSalaryStructureAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSalaryStructureAssignment" ADD CONSTRAINT "EmployeeSalaryStructureAssignment_salaryStructureId_fkey" FOREIGN KEY ("salaryStructureId") REFERENCES "SalaryStructure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanRequest" ADD CONSTRAINT "LoanRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanRepaymentSchedule" ADD CONSTRAINT "LoanRepaymentSchedule_loanRequestId_fkey" FOREIGN KEY ("loanRequestId") REFERENCES "LoanRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeBonus" ADD CONSTRAINT "EmployeeBonus_bonusId_fkey" FOREIGN KEY ("bonusId") REFERENCES "Bonus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeBonus" ADD CONSTRAINT "EmployeeBonus_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAdjustment" ADD CONSTRAINT "PayrollAdjustment_payrollPeriodId_fkey" FOREIGN KEY ("payrollPeriodId") REFERENCES "PayrollPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollAdjustment" ADD CONSTRAINT "PayrollAdjustment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalSettlement" ADD CONSTRAINT "FinalSettlement_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalSettlement" ADD CONSTRAINT "FinalSettlement_resignationId_fkey" FOREIGN KEY ("resignationId") REFERENCES "EmployeeResignation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

