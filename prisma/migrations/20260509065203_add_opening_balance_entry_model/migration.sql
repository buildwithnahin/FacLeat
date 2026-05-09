-- CreateEnum
CREATE TYPE "EcommerceChannelType" AS ENUM ('SHOPIFY', 'WOOCOMMERCE', 'FACEBOOK', 'DARAZ', 'MANUAL', 'OTHER');

-- CreateEnum
CREATE TYPE "EcommerceOrderStatus" AS ENUM ('SYNCED', 'PACKING', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'PARTIALLY_RETURNED', 'RETURNED');

-- CreateEnum
CREATE TYPE "EcommerceFulfillmentStatus" AS ENUM ('PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EcommercePaymentStatus" AS ENUM ('PENDING', 'PARTIALLY_PAID', 'PAID', 'RECONCILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "EcommerceReturnStatus" AS ENUM ('REQUESTED', 'RECEIVED', 'REFUNDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "EcommerceReconciliationStatus" AS ENUM ('DRAFT', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "EcommerceChannel" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "EcommerceChannelType" NOT NULL DEFAULT 'MANUAL',
    "storeUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcommerceChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcommerceOrder" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "warehouseId" TEXT,
    "customerId" TEXT,
    "externalId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "EcommerceOrderStatus" NOT NULL DEFAULT 'SYNCED',
    "paymentStatus" "EcommercePaymentStatus" NOT NULL DEFAULT 'PENDING',
    "currency" "CurrencyCode" NOT NULL DEFAULT 'BDT',
    "subtotal" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "discountTotal" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "shippingTotal" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "taxTotal" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "paidTotal" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "reconciledAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "customerEmail" TEXT,
    "shipToAddress" TEXT,
    "courier" TEXT,
    "trackingNo" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcommerceOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcommerceOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" "UnitOfMeasure" NOT NULL DEFAULT 'PCS',
    "quantity" DECIMAL(18,4) NOT NULL,
    "packedQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "fulfilledQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "returnedQty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "discountRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "EcommerceOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcommerceFulfillment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "status" "EcommerceFulfillmentStatus" NOT NULL DEFAULT 'PACKED',
    "packedAt" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "courier" TEXT,
    "trackingNo" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcommerceFulfillment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcommerceFulfillmentItem" (
    "id" TEXT NOT NULL,
    "fulfillmentId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "productId" TEXT,
    "quantity" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "EcommerceFulfillmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcommercePayment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "method" "PosPaymentMethod" NOT NULL,
    "provider" TEXT,
    "externalId" TEXT,
    "amount" DECIMAL(18,4) NOT NULL,
    "fee" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reconciledAt" TIMESTAMP(3),
    "status" "EcommercePaymentStatus" NOT NULL DEFAULT 'PAID',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EcommercePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcommerceReturn" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "status" "EcommerceReturnStatus" NOT NULL DEFAULT 'RECEIVED',
    "refundAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "refundMethod" "PosPaymentMethod" NOT NULL DEFAULT 'CASH',
    "refundReference" TEXT,
    "reason" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EcommerceReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcommerceReturnItem" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "productId" TEXT,
    "quantity" DECIMAL(18,4) NOT NULL,
    "lineTotal" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "EcommerceReturnItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcommerceReconciliationRun" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" "EcommerceReconciliationStatus" NOT NULL DEFAULT 'DRAFT',
    "matchedCount" INTEGER NOT NULL DEFAULT 0,
    "unmatchedCount" INTEGER NOT NULL DEFAULT 0,
    "totalSettled" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EcommerceReconciliationRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EcommerceChannel_branchId_isActive_idx" ON "EcommerceChannel"("branchId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "EcommerceChannel_branchId_code_key" ON "EcommerceChannel"("branchId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "EcommerceOrder_number_key" ON "EcommerceOrder"("number");

-- CreateIndex
CREATE INDEX "EcommerceOrder_branchId_status_orderDate_idx" ON "EcommerceOrder"("branchId", "status", "orderDate");

-- CreateIndex
CREATE INDEX "EcommerceOrder_customerId_orderDate_idx" ON "EcommerceOrder"("customerId", "orderDate");

-- CreateIndex
CREATE INDEX "EcommerceOrder_paymentStatus_idx" ON "EcommerceOrder"("paymentStatus");

-- CreateIndex
CREATE UNIQUE INDEX "EcommerceOrder_channelId_externalId_key" ON "EcommerceOrder"("channelId", "externalId");

-- CreateIndex
CREATE INDEX "EcommerceOrderItem_orderId_idx" ON "EcommerceOrderItem"("orderId");

-- CreateIndex
CREATE INDEX "EcommerceOrderItem_productId_idx" ON "EcommerceOrderItem"("productId");

-- CreateIndex
CREATE INDEX "EcommerceOrderItem_sku_idx" ON "EcommerceOrderItem"("sku");

-- CreateIndex
CREATE INDEX "EcommerceFulfillment_orderId_idx" ON "EcommerceFulfillment"("orderId");

-- CreateIndex
CREATE INDEX "EcommerceFulfillment_branchId_status_idx" ON "EcommerceFulfillment"("branchId", "status");

-- CreateIndex
CREATE INDEX "EcommerceFulfillmentItem_fulfillmentId_idx" ON "EcommerceFulfillmentItem"("fulfillmentId");

-- CreateIndex
CREATE INDEX "EcommerceFulfillmentItem_orderItemId_idx" ON "EcommerceFulfillmentItem"("orderItemId");

-- CreateIndex
CREATE INDEX "EcommerceFulfillmentItem_productId_idx" ON "EcommerceFulfillmentItem"("productId");

-- CreateIndex
CREATE INDEX "EcommercePayment_orderId_idx" ON "EcommercePayment"("orderId");

-- CreateIndex
CREATE INDEX "EcommercePayment_branchId_receivedAt_idx" ON "EcommercePayment"("branchId", "receivedAt");

-- CreateIndex
CREATE INDEX "EcommercePayment_externalId_idx" ON "EcommercePayment"("externalId");

-- CreateIndex
CREATE INDEX "EcommerceReturn_orderId_idx" ON "EcommerceReturn"("orderId");

-- CreateIndex
CREATE INDEX "EcommerceReturn_branchId_receivedAt_idx" ON "EcommerceReturn"("branchId", "receivedAt");

-- CreateIndex
CREATE INDEX "EcommerceReturnItem_returnId_idx" ON "EcommerceReturnItem"("returnId");

-- CreateIndex
CREATE INDEX "EcommerceReturnItem_orderItemId_idx" ON "EcommerceReturnItem"("orderItemId");

-- CreateIndex
CREATE INDEX "EcommerceReturnItem_productId_idx" ON "EcommerceReturnItem"("productId");

-- CreateIndex
CREATE INDEX "EcommerceReconciliationRun_branchId_periodStart_periodEnd_idx" ON "EcommerceReconciliationRun"("branchId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "EcommerceReconciliationRun_channelId_createdAt_idx" ON "EcommerceReconciliationRun"("channelId", "createdAt");

-- AddForeignKey
ALTER TABLE "EcommerceChannel" ADD CONSTRAINT "EcommerceChannel_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcommerceOrder" ADD CONSTRAINT "EcommerceOrder_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "EcommerceChannel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcommerceOrder" ADD CONSTRAINT "EcommerceOrder_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcommerceOrder" ADD CONSTRAINT "EcommerceOrder_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcommerceOrder" ADD CONSTRAINT "EcommerceOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcommerceOrderItem" ADD CONSTRAINT "EcommerceOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "EcommerceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcommerceOrderItem" ADD CONSTRAINT "EcommerceOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcommerceFulfillment" ADD CONSTRAINT "EcommerceFulfillment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "EcommerceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcommerceFulfillment" ADD CONSTRAINT "EcommerceFulfillment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcommerceFulfillment" ADD CONSTRAINT "EcommerceFulfillment_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcommerceFulfillmentItem" ADD CONSTRAINT "EcommerceFulfillmentItem_fulfillmentId_fkey" FOREIGN KEY ("fulfillmentId") REFERENCES "EcommerceFulfillment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcommerceFulfillmentItem" ADD CONSTRAINT "EcommerceFulfillmentItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "EcommerceOrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcommerceFulfillmentItem" ADD CONSTRAINT "EcommerceFulfillmentItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcommercePayment" ADD CONSTRAINT "EcommercePayment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "EcommerceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcommercePayment" ADD CONSTRAINT "EcommercePayment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcommerceReturn" ADD CONSTRAINT "EcommerceReturn_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "EcommerceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcommerceReturn" ADD CONSTRAINT "EcommerceReturn_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcommerceReturnItem" ADD CONSTRAINT "EcommerceReturnItem_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "EcommerceReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcommerceReturnItem" ADD CONSTRAINT "EcommerceReturnItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "EcommerceOrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcommerceReturnItem" ADD CONSTRAINT "EcommerceReturnItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcommerceReconciliationRun" ADD CONSTRAINT "EcommerceReconciliationRun_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcommerceReconciliationRun" ADD CONSTRAINT "EcommerceReconciliationRun_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "EcommerceChannel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
