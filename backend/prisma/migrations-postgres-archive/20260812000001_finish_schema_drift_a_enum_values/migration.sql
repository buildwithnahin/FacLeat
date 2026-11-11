ALTER TYPE "PurchaseInvoiceStatus" ADD VALUE 'DRAFT';
ALTER TYPE "PurchaseInvoiceStatus" ADD VALUE 'SUBMITTED';
ALTER TYPE "PurchaseInvoiceStatus" ADD VALUE 'ON_HOLD';
ALTER TYPE "PurchaseInvoiceStatus" ADD VALUE 'APPROVED';
ALTER TYPE "PurchaseInvoiceStatus" ADD VALUE 'POSTED';

-- AlterEnum
ALTER TYPE "SalaryHistorySourceType" ADD VALUE 'CONFIRMATION';
