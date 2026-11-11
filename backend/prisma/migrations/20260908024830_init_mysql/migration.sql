-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `avatarUrl` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE', 'DISABLED', 'PENDING') NOT NULL DEFAULT 'ACTIVE',
    `branchAccessType` ENUM('ALL_BRANCHES', 'ASSIGNED_BRANCHES', 'OWN_BRANCH_ONLY') NOT NULL DEFAULT 'OWN_BRANCH_ONLY',
    `defaultBranchId` VARCHAR(191) NULL,
    `defaultCompanyId` VARCHAR(191) NULL,
    `activeBranchId` VARCHAR(191) NULL,
    `activeCompanyId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_employeeId_key`(`employeeId`),
    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `User_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MobileRefreshToken` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `deviceLabel` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `MobileRefreshToken_tokenHash_key`(`tokenHash`),
    INDEX `MobileRefreshToken_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Role` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `isSystem` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Role_companyId_idx`(`companyId`),
    UNIQUE INDEX `Role_companyId_name_key`(`companyId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Permission` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `module` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `Permission_key_key`(`key`),
    INDEX `Permission_module_idx`(`module`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserRole` (
    `userId` VARCHAR(191) NOT NULL,
    `roleId` VARCHAR(191) NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`userId`, `roleId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserBranchAccess` (
    `userId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `UserBranchAccess_branchId_idx`(`branchId`),
    PRIMARY KEY (`userId`, `branchId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RolePermission` (
    `roleId` VARCHAR(191) NOT NULL,
    `permissionId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`roleId`, `permissionId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Branch` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'MAIN',
    `currency` ENUM('BDT', 'INR', 'USD', 'EUR') NOT NULL DEFAULT 'BDT',
    `address` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `allowNegativeStock` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `vatNumber` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Branch_code_key`(`code`),
    INDEX `Branch_isActive_idx`(`isActive`),
    INDEX `Branch_companyId_idx`(`companyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Company` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `address` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `currency` ENUM('BDT', 'INR', 'USD', 'EUR') NOT NULL DEFAULT 'BDT',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Company_code_key`(`code`),
    INDEX `Company_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Period` (
    `id` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `startsAt` DATETIME(3) NOT NULL,
    `endsAt` DATETIME(3) NOT NULL,
    `status` ENUM('OPEN', 'CLOSED', 'LOCKED') NOT NULL DEFAULT 'OPEN',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Period_branchId_status_idx`(`branchId`, `status`),
    INDEX `Period_startsAt_endsAt_idx`(`startsAt`, `endsAt`),
    UNIQUE INDEX `Period_branchId_name_key`(`branchId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `branchId` VARCHAR(191) NULL,
    `module` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NULL,
    `before` JSON NULL,
    `after` JSON NULL,
    `ip` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_actorId_createdAt_idx`(`actorId`, `createdAt`),
    INDEX `AuditLog_module_createdAt_idx`(`module`, `createdAt`),
    INDEX `AuditLog_entityType_entityId_idx`(`entityType`, `entityId`),
    INDEX `AuditLog_branchId_createdAt_idx`(`branchId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `id` VARCHAR(191) NOT NULL,
    `recipientId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NULL,
    `severity` ENUM('INFO', 'WARNING', 'CRITICAL') NOT NULL DEFAULT 'INFO',
    `module` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `body` VARCHAR(191) NULL,
    `href` VARCHAR(191) NULL,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Notification_recipientId_readAt_createdAt_idx`(`recipientId`, `readAt`, `createdAt`),
    INDEX `Notification_module_idx`(`module`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductCategory` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `parentId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ProductCategory_parentId_idx`(`parentId`),
    INDEX `ProductCategory_companyId_idx`(`companyId`),
    UNIQUE INDEX `ProductCategory_companyId_name_key`(`companyId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductBrand` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ProductBrand_companyId_idx`(`companyId`),
    UNIQUE INDEX `ProductBrand_companyId_name_key`(`companyId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Product` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `sku` VARCHAR(191) NOT NULL,
    `barcode` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `size` VARCHAR(191) NULL,
    `type` ENUM('RAW_MATERIAL', 'WORK_IN_PROGRESS', 'FINISHED_GOOD', 'CONSUMABLE', 'SERVICE') NOT NULL DEFAULT 'FINISHED_GOOD',
    `unit` ENUM('PCS', 'KG', 'G', 'M', 'M2', 'L', 'ML', 'BOX', 'PACK', 'PAIR', 'SET') NOT NULL DEFAULT 'PCS',
    `categoryId` VARCHAR(191) NULL,
    `brandId` VARCHAR(191) NULL,
    `costPrice` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `sellPrice` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `taxRate` DECIMAL(5, 2) NOT NULL DEFAULT 15,
    `reorderLevel` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `reorderQty` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `imageUrl` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Product_categoryId_idx`(`categoryId`),
    INDEX `Product_brandId_idx`(`brandId`),
    INDEX `Product_isActive_idx`(`isActive`),
    INDEX `Product_name_idx`(`name`),
    INDEX `Product_companyId_idx`(`companyId`),
    UNIQUE INDEX `Product_companyId_sku_key`(`companyId`, `sku`),
    UNIQUE INDEX `Product_companyId_barcode_key`(`companyId`, `barcode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Warehouse` (
    `id` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('MAIN', 'STORE', 'WIP', 'QUARANTINE', 'DAMAGED', 'SHOWROOM') NOT NULL DEFAULT 'MAIN',
    `address` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Warehouse_branchId_isActive_idx`(`branchId`, `isActive`),
    UNIQUE INDEX `Warehouse_branchId_code_key`(`branchId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InventoryLedger` (
    `id` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `warehouseId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `direction` ENUM('IN', 'OUT') NOT NULL,
    `quantity` DECIMAL(18, 4) NOT NULL,
    `costPerUnit` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `refType` VARCHAR(191) NOT NULL,
    `refId` VARCHAR(191) NULL,
    `note` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `InventoryLedger_productId_createdAt_idx`(`productId`, `createdAt`),
    INDEX `InventoryLedger_branchId_warehouseId_productId_idx`(`branchId`, `warehouseId`, `productId`),
    INDEX `InventoryLedger_refType_refId_idx`(`refType`, `refId`),
    INDEX `InventoryLedger_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StockRequisition` (
    `id` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `showroomWarehouseId` VARCHAR(191) NOT NULL,
    `sourceWarehouseId` VARCHAR(191) NULL,
    `priority` VARCHAR(191) NOT NULL DEFAULT 'MEDIUM',
    `requiredDate` DATE NOT NULL,
    `status` ENUM('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'WAREHOUSE_ASSIGNED', 'PICKING', 'PACKED', 'DISPATCHED', 'IN_TRANSIT', 'RECEIVED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'SUBMITTED',
    `remarks` VARCHAR(191) NULL,
    `approvalNote` VARCHAR(191) NULL,
    `rejectionReason` VARCHAR(191) NULL,
    `requestedById` VARCHAR(191) NULL,
    `approvedById` VARCHAR(191) NULL,
    `rejectedById` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `rejectedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `StockRequisition_number_key`(`number`),
    INDEX `StockRequisition_branchId_status_createdAt_idx`(`branchId`, `status`, `createdAt`),
    INDEX `StockRequisition_showroomWarehouseId_status_idx`(`showroomWarehouseId`, `status`),
    INDEX `StockRequisition_sourceWarehouseId_status_idx`(`sourceWarehouseId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StockRequisitionItem` (
    `id` VARCHAR(191) NOT NULL,
    `requisitionId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `unit` ENUM('PCS', 'KG', 'G', 'M', 'M2', 'L', 'ML', 'BOX', 'PACK', 'PAIR', 'SET') NOT NULL DEFAULT 'PCS',
    `requestedQty` DECIMAL(18, 4) NOT NULL,
    `approvedQty` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `dispatchedQty` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `receivedQty` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `StockRequisitionItem_requisitionId_idx`(`requisitionId`),
    INDEX `StockRequisitionItem_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StockTransfer` (
    `id` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `requisitionId` VARCHAR(191) NOT NULL,
    `fromBranchId` VARCHAR(191) NOT NULL,
    `toBranchId` VARCHAR(191) NOT NULL,
    `fromWarehouseId` VARCHAR(191) NOT NULL,
    `toWarehouseId` VARCHAR(191) NOT NULL,
    `status` ENUM('DRAFT', 'PICKING', 'PACKED', 'DISPATCHED', 'IN_TRANSIT', 'RECEIVED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PICKING',
    `expectedDate` DATE NULL,
    `packedBy` VARCHAR(191) NULL,
    `vehicle` VARCHAR(191) NULL,
    `driverName` VARCHAR(191) NULL,
    `driverPhone` VARCHAR(191) NULL,
    `gatePassNo` VARCHAR(191) NULL,
    `trackingNo` VARCHAR(191) NULL,
    `remarks` VARCHAR(191) NULL,
    `dispatchNote` VARCHAR(191) NULL,
    `receiveRemarks` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `dispatchedById` VARCHAR(191) NULL,
    `receivedById` VARCHAR(191) NULL,
    `dispatchDate` DATETIME(3) NULL,
    `receivedDate` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `StockTransfer_number_key`(`number`),
    INDEX `StockTransfer_requisitionId_status_idx`(`requisitionId`, `status`),
    INDEX `StockTransfer_fromWarehouseId_status_idx`(`fromWarehouseId`, `status`),
    INDEX `StockTransfer_toWarehouseId_status_idx`(`toWarehouseId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StockTransferItem` (
    `id` VARCHAR(191) NOT NULL,
    `transferId` VARCHAR(191) NOT NULL,
    `requisitionItemId` VARCHAR(191) NULL,
    `productId` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(18, 4) NOT NULL,
    `receivedQty` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `damagedQty` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `missingQty` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `StockTransferItem_transferId_idx`(`transferId`),
    INDEX `StockTransferItem_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CustomerReturn` (
    `id` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `warehouseId` VARCHAR(191) NOT NULL,
    `inspectionWarehouseId` VARCHAR(191) NOT NULL,
    `sourceDocumentType` VARCHAR(191) NULL,
    `sourceDocumentNumber` VARCHAR(191) NULL,
    `customerName` VARCHAR(191) NULL,
    `customerPhone` VARCHAR(191) NULL,
    `returnDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` ENUM('PENDING_INSPECTION', 'INSPECTED', 'COMPLETED', 'REJECTED') NOT NULL DEFAULT 'PENDING_INSPECTION',
    `financeAction` ENUM('NONE', 'REFUND', 'EXCHANGE', 'CREDIT_ADJUSTMENT') NOT NULL DEFAULT 'NONE',
    `financeNote` VARCHAR(191) NULL,
    `intakeNote` VARCHAR(191) NULL,
    `inspectionNote` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `inspectedById` VARCHAR(191) NULL,
    `inspectedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CustomerReturn_number_key`(`number`),
    INDEX `CustomerReturn_branchId_returnDate_idx`(`branchId`, `returnDate`),
    INDEX `CustomerReturn_status_createdAt_idx`(`status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CustomerReturnItem` (
    `id` VARCHAR(191) NOT NULL,
    `returnId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(18, 4) NOT NULL,
    `disposition` ENUM('RESTOCK', 'REWORK', 'DAMAGED', 'REJECT') NULL,
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CustomerReturnItem_returnId_idx`(`returnId`),
    INDEX `CustomerReturnItem_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DamageReport` (
    `id` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `warehouseId` VARCHAR(191) NOT NULL,
    `quarantineWarehouseId` VARCHAR(191) NOT NULL,
    `reportDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reason` VARCHAR(191) NOT NULL,
    `note` VARCHAR(191) NULL,
    `status` ENUM('REPORTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'RESOLVED') NOT NULL DEFAULT 'REPORTED',
    `estimatedValue` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `requiresApproval` BOOLEAN NOT NULL DEFAULT false,
    `resolution` ENUM('SCRAP', 'REPAIR', 'B_GRADE', 'SUPPLIER_CLAIM') NULL,
    `supplierId` VARCHAR(191) NULL,
    `grnId` VARCHAR(191) NULL,
    `purchaseInvoiceId` VARCHAR(191) NULL,
    `claimAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `claimReference` VARCHAR(191) NULL,
    `resolutionNote` VARCHAR(191) NULL,
    `reportedById` VARCHAR(191) NULL,
    `resolvedById` VARCHAR(191) NULL,
    `resolvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DamageReport_number_key`(`number`),
    INDEX `DamageReport_branchId_reportDate_idx`(`branchId`, `reportDate`),
    INDEX `DamageReport_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `DamageReport_supplierId_idx`(`supplierId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DamageReportItem` (
    `id` VARCHAR(191) NOT NULL,
    `reportId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(18, 4) NOT NULL,
    `costPerUnit` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DamageReportItem_reportId_idx`(`reportId`),
    INDEX `DamageReportItem_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Supplier` (
    `id` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `contactPerson` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `country` VARCHAR(191) NULL,
    `taxId` VARCHAR(191) NULL,
    `paymentTerms` ENUM('COD', 'NET_15', 'NET_30', 'NET_45', 'NET_60', 'NET_90') NOT NULL DEFAULT 'NET_30',
    `currency` ENUM('BDT', 'INR', 'USD', 'EUR') NOT NULL DEFAULT 'BDT',
    `openingBalance` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `status` ENUM('ACTIVE', 'INACTIVE', 'BLOCKED') NOT NULL DEFAULT 'ACTIVE',
    `notes` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Supplier_branchId_status_idx`(`branchId`, `status`),
    INDEX `Supplier_name_idx`(`name`),
    UNIQUE INDEX `Supplier_branchId_code_key`(`branchId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PurchaseRequisition` (
    `id` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `department` VARCHAR(191) NOT NULL,
    `requestedBy` VARCHAR(191) NOT NULL,
    `priority` ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') NOT NULL DEFAULT 'MEDIUM',
    `status` ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'CLOSED') NOT NULL DEFAULT 'DRAFT',
    `requiredDate` DATETIME(3) NOT NULL,
    `notes` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `approvedById` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `rejectedReason` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PurchaseRequisition_number_key`(`number`),
    INDEX `PurchaseRequisition_branchId_status_createdAt_idx`(`branchId`, `status`, `createdAt`),
    INDEX `PurchaseRequisition_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PurchaseRequisitionItem` (
    `id` VARCHAR(191) NOT NULL,
    `requisitionId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NULL,
    `productName` VARCHAR(191) NOT NULL,
    `unit` ENUM('PCS', 'KG', 'G', 'M', 'M2', 'L', 'ML', 'BOX', 'PACK', 'PAIR', 'SET') NOT NULL DEFAULT 'PCS',
    `quantity` DECIMAL(18, 4) NOT NULL,
    `estimatedPrice` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `note` VARCHAR(191) NULL,

    INDEX `PurchaseRequisitionItem_requisitionId_idx`(`requisitionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PurchaseOrder` (
    `id` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `supplierId` VARCHAR(191) NOT NULL,
    `requisitionId` VARCHAR(191) NULL,
    `department` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'PENDING', 'APPROVED', 'PARTIALLY_RECEIVED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `orderDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deliveryDate` DATETIME(3) NOT NULL,
    `currency` ENUM('BDT', 'INR', 'USD', 'EUR') NOT NULL DEFAULT 'BDT',
    `subtotal` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `taxTotal` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `discountTotal` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `grandTotal` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `notes` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `approvedById` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PurchaseOrder_number_key`(`number`),
    INDEX `PurchaseOrder_branchId_status_createdAt_idx`(`branchId`, `status`, `createdAt`),
    INDEX `PurchaseOrder_supplierId_idx`(`supplierId`),
    INDEX `PurchaseOrder_requisitionId_idx`(`requisitionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PurchaseOrderItem` (
    `id` VARCHAR(191) NOT NULL,
    `purchaseOrderId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `accountCategory` ENUM('INVENTORY', 'ADMINISTRATIVE_EXPENSE', 'SALES_AND_DISTRIBUTIVE', 'ASSET') NOT NULL DEFAULT 'INVENTORY',
    `size` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `unit` ENUM('PCS', 'KG', 'G', 'M', 'M2', 'L', 'ML', 'BOX', 'PACK', 'PAIR', 'SET') NOT NULL DEFAULT 'PCS',
    `orderedQty` DECIMAL(18, 4) NOT NULL,
    `receivedQty` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `unitPrice` DECIMAL(18, 4) NOT NULL,
    `taxRate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `discountRate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `lineTotal` DECIMAL(18, 4) NOT NULL DEFAULT 0,

    INDEX `PurchaseOrderItem_purchaseOrderId_idx`(`purchaseOrderId`),
    INDEX `PurchaseOrderItem_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GoodsReceiving` (
    `id` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `purchaseOrderId` VARCHAR(191) NOT NULL,
    `supplierId` VARCHAR(191) NOT NULL,
    `warehouseId` VARCHAR(191) NOT NULL,
    `status` ENUM('DRAFT', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `receivedDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `receivedById` VARCHAR(191) NOT NULL,
    `notes` VARCHAR(191) NULL,
    `invoiceId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `GoodsReceiving_number_key`(`number`),
    INDEX `GoodsReceiving_branchId_status_createdAt_idx`(`branchId`, `status`, `createdAt`),
    INDEX `GoodsReceiving_purchaseOrderId_idx`(`purchaseOrderId`),
    INDEX `GoodsReceiving_supplierId_idx`(`supplierId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GoodsReceivingItem` (
    `id` VARCHAR(191) NOT NULL,
    `grnId` VARCHAR(191) NOT NULL,
    `purchaseOrderItemId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `size` VARCHAR(191) NULL,
    `receivedQty` DECIMAL(18, 4) NOT NULL,
    `rejectedQty` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `unitCost` DECIMAL(18, 4) NOT NULL,
    `note` VARCHAR(191) NULL,

    INDEX `GoodsReceivingItem_grnId_idx`(`grnId`),
    INDEX `GoodsReceivingItem_purchaseOrderItemId_idx`(`purchaseOrderItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PurchaseInvoice` (
    `id` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `supplierId` VARCHAR(191) NOT NULL,
    `purchaseOrderId` VARCHAR(191) NULL,
    `grnId` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'PENDING', 'SUBMITTED', 'ON_HOLD', 'APPROVED', 'POSTED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `matching` ENUM('UNMATCHED', 'MATCHED', 'MISMATCH') NOT NULL DEFAULT 'UNMATCHED',
    `invoiceDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `dueDate` DATETIME(3) NOT NULL,
    `currency` ENUM('BDT', 'INR', 'USD', 'EUR') NOT NULL DEFAULT 'BDT',
    `subtotal` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `taxTotal` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `discountTotal` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `grandTotal` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `paidAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `notes` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PurchaseInvoice_number_key`(`number`),
    INDEX `PurchaseInvoice_branchId_status_createdAt_idx`(`branchId`, `status`, `createdAt`),
    INDEX `PurchaseInvoice_supplierId_idx`(`supplierId`),
    INDEX `PurchaseInvoice_dueDate_idx`(`dueDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PurchaseInvoiceItem` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `size` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `unit` ENUM('PCS', 'KG', 'G', 'M', 'M2', 'L', 'ML', 'BOX', 'PACK', 'PAIR', 'SET') NOT NULL DEFAULT 'PCS',
    `quantity` DECIMAL(18, 4) NOT NULL,
    `unitPrice` DECIMAL(18, 4) NOT NULL,
    `taxRate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `lineTotal` DECIMAL(18, 4) NOT NULL,

    INDEX `PurchaseInvoiceItem_invoiceId_idx`(`invoiceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SupplierPayment` (
    `id` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `supplierId` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NULL,
    `method` ENUM('CASH', 'BANK_TRANSFER', 'CHEQUE', 'WIRE_TRANSFER', 'MOBILE_BANKING', 'OTHER') NOT NULL DEFAULT 'BANK_TRANSFER',
    `paymentDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `amount` DECIMAL(18, 4) NOT NULL,
    `currency` ENUM('BDT', 'INR', 'USD', 'EUR') NOT NULL DEFAULT 'BDT',
    `reference` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SupplierPayment_number_key`(`number`),
    INDEX `SupplierPayment_branchId_createdAt_idx`(`branchId`, `createdAt`),
    INDEX `SupplierPayment_supplierId_createdAt_idx`(`supplierId`, `createdAt`),
    INDEX `SupplierPayment_invoiceId_idx`(`invoiceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SupplierLedger` (
    `id` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `supplierId` VARCHAR(191) NOT NULL,
    `entryType` ENUM('PURCHASE', 'PAYMENT', 'ADJUSTMENT', 'OPENING') NOT NULL,
    `refType` VARCHAR(191) NOT NULL,
    `refId` VARCHAR(191) NULL,
    `description` VARCHAR(191) NOT NULL,
    `debit` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `credit` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `entryDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SupplierLedger_supplierId_createdAt_idx`(`supplierId`, `createdAt`),
    INDEX `SupplierLedger_branchId_createdAt_idx`(`branchId`, `createdAt`),
    INDEX `SupplierLedger_refType_refId_idx`(`refType`, `refId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DebitNote` (
    `id` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `supplierId` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NULL,
    `grnId` VARCHAR(191) NULL,
    `returnDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` ENUM('DRAFT', 'SUBMITTED', 'APPROVED', 'POSTED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `totalAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `vatAdjustment` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `reason` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DebitNote_number_key`(`number`),
    INDEX `DebitNote_branchId_status_idx`(`branchId`, `status`),
    INDEX `DebitNote_supplierId_idx`(`supplierId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DebitNoteItem` (
    `id` VARCHAR(191) NOT NULL,
    `debitNoteId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `returnedQty` DECIMAL(18, 4) NOT NULL,
    `unitPrice` DECIMAL(18, 4) NOT NULL,
    `total` DECIMAL(18, 4) NOT NULL,
    `reason` VARCHAR(191) NULL,
    `condition` VARCHAR(191) NULL,

    INDEX `DebitNoteItem_debitNoteId_idx`(`debitNoteId`),
    INDEX `DebitNoteItem_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductionPlan` (
    `id` VARCHAR(191) NOT NULL,
    `planNo` VARCHAR(191) NOT NULL,
    `planningDate` DATE NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(18, 4) NOT NULL,
    `priority` VARCHAR(191) NULL,
    `plannedStartDate` DATETIME(3) NOT NULL,
    `plannedEndDate` DATETIME(3) NOT NULL,
    `productionLine` VARCHAR(191) NULL,
    `machine` VARCHAR(191) NULL,
    `shift` VARCHAR(191) NULL,
    `plannerId` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'APPROVED', 'SCHEDULED', 'RUNNING', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ProductionPlan_planNo_key`(`planNo`),
    INDEX `ProductionPlan_branchId_status_idx`(`branchId`, `status`),
    INDEX `ProductionPlan_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductionOrder` (
    `id` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `planId` VARCHAR(191) NULL,
    `plannedQty` DECIMAL(18, 4) NOT NULL,
    `producedQty` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `unit` ENUM('PCS', 'KG', 'G', 'M', 'M2', 'L', 'ML', 'BOX', 'PACK', 'PAIR', 'SET') NOT NULL DEFAULT 'PCS',
    `status` ENUM('DRAFT', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ON_HOLD') NOT NULL DEFAULT 'DRAFT',
    `plannedStartDate` DATETIME(3) NOT NULL,
    `plannedEndDate` DATETIME(3) NOT NULL,
    `actualStartDate` DATETIME(3) NULL,
    `actualEndDate` DATETIME(3) NULL,
    `notes` VARCHAR(191) NULL,
    `overheadRate` DECIMAL(7, 4) NULL,
    `buyerName` VARCHAR(191) NULL,
    `batchName` VARCHAR(191) NULL,
    `saleAmount` DECIMAL(18, 4) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ProductionOrder_number_key`(`number`),
    INDEX `ProductionOrder_branchId_status_createdAt_idx`(`branchId`, `status`, `createdAt`),
    INDEX `ProductionOrder_productId_idx`(`productId`),
    INDEX `ProductionOrder_plannedEndDate_idx`(`plannedEndDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkOrder` (
    `id` VARCHAR(191) NOT NULL,
    `workOrderNo` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `department` VARCHAR(191) NULL,
    `machine` VARCHAR(191) NULL,
    `operatorId` VARCHAR(191) NULL,
    `shift` VARCHAR(191) NULL,
    `inputQty` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `targetQty` DECIMAL(18, 4) NOT NULL,
    `outputQty` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `scrapQty` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `status` ENUM('PENDING', 'ASSIGNED', 'RUNNING', 'PAUSED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `startTime` DATETIME(3) NULL,
    `endTime` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `WorkOrder_workOrderNo_key`(`workOrderNo`),
    INDEX `WorkOrder_orderId_status_idx`(`orderId`, `status`),
    INDEX `WorkOrder_operatorId_idx`(`operatorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DelayTracking` (
    `id` VARCHAR(191) NOT NULL,
    `workOrderId` VARCHAR(191) NOT NULL,
    `reason` ENUM('MACHINE_BREAKDOWN', 'MATERIAL_SHORTAGE', 'OPERATOR_ABSENT', 'POWER_FAILURE', 'QUALITY_ISSUE', 'MAINTENANCE', 'OTHER') NOT NULL,
    `notes` VARCHAR(191) NULL,
    `startTime` DATETIME(3) NOT NULL,
    `endTime` DATETIME(3) NULL,
    `durationMins` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DelayTracking_workOrderId_idx`(`workOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductionStage` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `sequence` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED') NOT NULL DEFAULT 'PENDING',
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `notes` VARCHAR(191) NULL,

    INDEX `ProductionStage_orderId_idx`(`orderId`),
    UNIQUE INDEX `ProductionStage_orderId_sequence_key`(`orderId`, `sequence`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductionMaterial` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `unit` ENUM('PCS', 'KG', 'G', 'M', 'M2', 'L', 'ML', 'BOX', 'PACK', 'PAIR', 'SET') NOT NULL DEFAULT 'PCS',
    `plannedQty` DECIMAL(18, 4) NOT NULL,
    `consumedQty` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `fromWarehouseId` VARCHAR(191) NULL,
    `materialType` ENUM('LEATHER', 'ACCESSORY', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `unitCost` DECIMAL(18, 4) NULL,
    `note` VARCHAR(191) NULL,

    INDEX `ProductionMaterial_orderId_idx`(`orderId`),
    INDEX `ProductionMaterial_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductionOutput` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `unit` ENUM('PCS', 'KG', 'G', 'M', 'M2', 'L', 'ML', 'BOX', 'PACK', 'PAIR', 'SET') NOT NULL DEFAULT 'PCS',
    `quantity` DECIMAL(18, 4) NOT NULL,
    `costPerUnit` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `toWarehouseId` VARCHAR(191) NOT NULL,
    `note` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ProductionOutput_orderId_idx`(`orderId`),
    INDEX `ProductionOutput_productId_createdAt_idx`(`productId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductionCostEntry` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `type` ENUM('OVERHEAD', 'WEDGE', 'LABOUR') NOT NULL,
    `description` VARCHAR(255) NOT NULL,
    `hours` DECIMAL(10, 4) NULL,
    `rate` DECIMAL(18, 4) NULL,
    `amount` DECIMAL(18, 4) NOT NULL,
    `note` VARCHAR(500) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ProductionCostEntry_orderId_type_idx`(`orderId`, `type`),
    INDEX `ProductionCostEntry_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductionIssueVoucher` (
    `id` VARCHAR(191) NOT NULL,
    `voucherNo` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `warehouseId` VARCHAR(191) NOT NULL,
    `status` ENUM('DRAFT', 'REQUESTED', 'APPROVED', 'ISSUED', 'REJECTED') NOT NULL DEFAULT 'DRAFT',
    `requestedById` VARCHAR(191) NULL,
    `approvedById` VARCHAR(191) NULL,
    `issuedById` VARCHAR(191) NULL,
    `remarks` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ProductionIssueVoucher_voucherNo_key`(`voucherNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductionIssueItem` (
    `id` VARCHAR(191) NOT NULL,
    `voucherId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `batchNo` VARCHAR(191) NULL,
    `lotNo` VARCHAR(191) NULL,
    `requiredQty` DECIMAL(18, 4) NOT NULL,
    `issuedQty` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `uom` ENUM('PCS', 'KG', 'G', 'M', 'M2', 'L', 'ML', 'BOX', 'PACK', 'PAIR', 'SET') NOT NULL DEFAULT 'PCS',

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProcessTracking` (
    `id` VARCHAR(191) NOT NULL,
    `trackingNo` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `stageId` VARCHAR(191) NOT NULL,
    `batchNo` VARCHAR(191) NULL,
    `machine` VARCHAR(191) NULL,
    `operatorId` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'RUNNING', 'PAUSED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `startTime` DATETIME(3) NULL,
    `endTime` DATETIME(3) NULL,
    `durationMinutes` INTEGER NULL,
    `inputQty` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `outputQty` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `rejectedQty` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `scrapQty` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `reworkQty` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `remainingQty` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `materialCost` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `labourCost` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `machineCost` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `overheadCost` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `totalProcessCost` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ProcessTracking_trackingNo_key`(`trackingNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WipLedger` (
    `id` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `stageId` VARCHAR(191) NULL,
    `productId` VARCHAR(191) NOT NULL,
    `voucher` VARCHAR(191) NULL,
    `operatorId` VARCHAR(191) NULL,
    `inQty` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `outQty` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `balance` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `cost` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ScrapLedger` (
    `id` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `stageId` VARCHAR(191) NULL,
    `scrapType` VARCHAR(191) NOT NULL,
    `operatorId` VARCHAR(191) NULL,
    `qty` DECIMAL(18, 4) NOT NULL,
    `cost` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FinishedGoodsReceiveVoucher` (
    `id` VARCHAR(191) NOT NULL,
    `receiveNo` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `warehouseId` VARCHAR(191) NOT NULL,
    `receivedById` VARCHAR(191) NULL,
    `approvedById` VARCHAR(191) NULL,
    `remarks` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `FinishedGoodsReceiveVoucher_receiveNo_key`(`receiveNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FinishedGoodsReceiveItem` (
    `id` VARCHAR(191) NOT NULL,
    `voucherId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `batchNo` VARCHAR(191) NULL,
    `quantity` DECIMAL(18, 4) NOT NULL,
    `uom` ENUM('PCS', 'KG', 'G', 'M', 'M2', 'L', 'ML', 'BOX', 'PACK', 'PAIR', 'SET') NOT NULL DEFAULT 'PCS',
    `qualityStatus` ENUM('PENDING', 'PASSED', 'FAILED', 'REWORK') NOT NULL DEFAULT 'PENDING',

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AssetCategory` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `depreciationMethod` ENUM('STRAIGHT_LINE', 'DECLINING_BALANCE', 'NONE') NOT NULL DEFAULT 'STRAIGHT_LINE',
    `defaultLifeMonths` INTEGER NOT NULL DEFAULT 60,
    `defaultSalvageRate` DECIMAL(5, 4) NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AssetCategory_companyId_idx`(`companyId`),
    UNIQUE INDEX `AssetCategory_companyId_name_key`(`companyId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Asset` (
    `id` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `categoryId` VARCHAR(191) NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `serialNumber` VARCHAR(191) NULL,
    `location` VARCHAR(191) NULL,
    `assignedTo` VARCHAR(191) NULL,
    `condition` ENUM('NEW', 'GOOD', 'FAIR', 'POOR') NOT NULL DEFAULT 'GOOD',
    `status` ENUM('IN_USE', 'IN_STORAGE', 'UNDER_MAINTENANCE', 'DISPOSED', 'LOST') NOT NULL DEFAULT 'IN_USE',
    `purchaseDate` DATETIME(3) NOT NULL,
    `purchaseCost` DECIMAL(18, 4) NOT NULL,
    `salvageValue` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `usefulLifeMonths` INTEGER NOT NULL DEFAULT 60,
    `depreciationMethod` ENUM('STRAIGHT_LINE', 'DECLINING_BALANCE', 'NONE') NOT NULL DEFAULT 'STRAIGHT_LINE',
    `accumulatedDepreciation` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `lastDepreciatedAt` DATETIME(3) NULL,
    `disposedAt` DATETIME(3) NULL,
    `disposalValue` DECIMAL(18, 4) NULL,
    `disposalReason` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Asset_branchId_status_idx`(`branchId`, `status`),
    INDEX `Asset_categoryId_idx`(`categoryId`),
    INDEX `Asset_serialNumber_idx`(`serialNumber`),
    UNIQUE INDEX `Asset_branchId_code_key`(`branchId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AssetMovement` (
    `id` VARCHAR(191) NOT NULL,
    `assetId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `type` ENUM('REGISTRATION', 'TRANSFER', 'MAINTENANCE', 'DEPRECIATION', 'DISPOSAL', 'REVALUATION') NOT NULL,
    `fromLocation` VARCHAR(191) NULL,
    `toLocation` VARCHAR(191) NULL,
    `fromAssignee` VARCHAR(191) NULL,
    `toAssignee` VARCHAR(191) NULL,
    `amount` DECIMAL(18, 4) NULL,
    `note` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AssetMovement_assetId_createdAt_idx`(`assetId`, `createdAt`),
    INDEX `AssetMovement_branchId_createdAt_idx`(`branchId`, `createdAt`),
    INDEX `AssetMovement_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ApprovalRule` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `module` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `minAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `escalateAfterHours` INTEGER NOT NULL DEFAULT 24,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `description` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ApprovalRule_module_action_isActive_idx`(`module`, `action`, `isActive`),
    UNIQUE INDEX `ApprovalRule_module_action_minAmount_key`(`module`, `action`, `minAmount`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ApprovalRuleApprover` (
    `id` VARCHAR(191) NOT NULL,
    `ruleId` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL,
    `sequence` INTEGER NOT NULL,

    INDEX `ApprovalRuleApprover_ruleId_idx`(`ruleId`),
    UNIQUE INDEX `ApprovalRuleApprover_ruleId_sequence_key`(`ruleId`, `sequence`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ApprovalRequest` (
    `id` VARCHAR(191) NOT NULL,
    `ruleId` VARCHAR(191) NULL,
    `module` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `summary` VARCHAR(191) NULL,
    `amount` DECIMAL(18, 4) NULL,
    `currency` ENUM('BDT', 'INR', 'USD', 'EUR') NULL,
    `branchId` VARCHAR(191) NULL,
    `requestedById` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'CHANGES_REQUESTED', 'ESCALATED') NOT NULL DEFAULT 'PENDING',
    `decidedAt` DATETIME(3) NULL,
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ApprovalRequest_module_action_status_idx`(`module`, `action`, `status`),
    INDEX `ApprovalRequest_entityType_entityId_idx`(`entityType`, `entityId`),
    INDEX `ApprovalRequest_requestedById_status_idx`(`requestedById`, `status`),
    INDEX `ApprovalRequest_status_createdAt_idx`(`status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ApprovalStep` (
    `id` VARCHAR(191) NOT NULL,
    `requestId` VARCHAR(191) NOT NULL,
    `sequence` INTEGER NOT NULL,
    `approverRole` VARCHAR(191) NOT NULL,
    `approverId` VARCHAR(191) NULL,
    `status` ENUM('WAITING', 'ACTIVE', 'APPROVED', 'REJECTED', 'SKIPPED', 'CHANGES_REQUESTED') NOT NULL DEFAULT 'WAITING',
    `decidedAt` DATETIME(3) NULL,
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ApprovalStep_requestId_status_idx`(`requestId`, `status`),
    INDEX `ApprovalStep_approverRole_status_idx`(`approverRole`, `status`),
    UNIQUE INDEX `ApprovalStep_requestId_sequence_key`(`requestId`, `sequence`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AppSetting` (
    `key` VARCHAR(191) NOT NULL,
    `value` VARCHAR(191) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Document` (
    `id` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `originalName` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `size` INTEGER NOT NULL,
    `storagePath` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NULL,
    `uploadedById` VARCHAR(191) NOT NULL,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Document_branchId_createdAt_idx`(`branchId`, `createdAt`),
    INDEX `Document_category_idx`(`category`),
    INDEX `Document_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DocumentTag` (
    `id` VARCHAR(191) NOT NULL,
    `documentId` VARCHAR(191) NOT NULL,
    `tag` VARCHAR(191) NOT NULL,

    INDEX `DocumentTag_tag_idx`(`tag`),
    UNIQUE INDEX `DocumentTag_documentId_tag_key`(`documentId`, `tag`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DocumentLink` (
    `id` VARCHAR(191) NOT NULL,
    `documentId` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DocumentLink_entityType_entityId_idx`(`entityType`, `entityId`),
    UNIQUE INDEX `DocumentLink_documentId_entityType_entityId_key`(`documentId`, `entityType`, `entityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CustomerCategory` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `discountPct` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CustomerCategory_companyId_idx`(`companyId`),
    UNIQUE INDEX `CustomerCategory_companyId_name_key`(`companyId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Customer` (
    `id` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('RETAIL', 'WHOLESALE', 'CORPORATE', 'ONLINE', 'EXPORT') NOT NULL DEFAULT 'RETAIL',
    `categoryId` VARCHAR(191) NULL,
    `contactPerson` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `country` VARCHAR(191) NULL,
    `taxId` VARCHAR(191) NULL,
    `creditLimit` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `creditDays` INTEGER NOT NULL DEFAULT 0,
    `currency` ENUM('BDT', 'INR', 'USD', 'EUR') NOT NULL DEFAULT 'BDT',
    `openingBalance` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `loyaltyPoints` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('ACTIVE', 'INACTIVE', 'BLOCKED') NOT NULL DEFAULT 'ACTIVE',
    `notes` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Customer_branchId_status_idx`(`branchId`, `status`),
    INDEX `Customer_type_idx`(`type`),
    INDEX `Customer_name_idx`(`name`),
    UNIQUE INDEX `Customer_branchId_code_key`(`branchId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CustomerInteraction` (
    `id` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `type` ENUM('CALL', 'EMAIL', 'MEETING', 'NOTE', 'COMPLAINT', 'FOLLOW_UP', 'OTHER') NOT NULL DEFAULT 'NOTE',
    `subject` VARCHAR(191) NOT NULL,
    `body` VARCHAR(191) NULL,
    `followUpAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CustomerInteraction_customerId_createdAt_idx`(`customerId`, `createdAt`),
    INDEX `CustomerInteraction_followUpAt_idx`(`followUpAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CustomerLedger` (
    `id` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `entryType` ENUM('OPENING', 'INVOICE', 'PAYMENT', 'RETURN', 'ADJUSTMENT') NOT NULL,
    `refType` VARCHAR(191) NOT NULL,
    `refId` VARCHAR(191) NULL,
    `description` VARCHAR(191) NOT NULL,
    `debit` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `credit` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `entryDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CustomerLedger_customerId_createdAt_idx`(`customerId`, `createdAt`),
    INDEX `CustomerLedger_branchId_createdAt_idx`(`branchId`, `createdAt`),
    INDEX `CustomerLedger_refType_refId_idx`(`refType`, `refId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PosSession` (
    `id` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `warehouseId` VARCHAR(191) NOT NULL,
    `cashierId` VARCHAR(191) NOT NULL,
    `openedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `closedAt` DATETIME(3) NULL,
    `openingFloat` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `expectedCash` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `countedCash` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `cashVariance` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `status` ENUM('OPEN', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PosSession_branchId_status_idx`(`branchId`, `status`),
    INDEX `PosSession_cashierId_status_idx`(`cashierId`, `status`),
    INDEX `PosSession_openedAt_idx`(`openedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PosSale` (
    `id` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `warehouseId` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NULL,
    `customerId` VARCHAR(191) NULL,
    `cashierId` VARCHAR(191) NOT NULL,
    `saleDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `currency` ENUM('BDT', 'INR', 'USD', 'EUR') NOT NULL DEFAULT 'BDT',
    `subtotal` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `discountTotal` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `taxTotal` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `grandTotal` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `paidTotal` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `changeDue` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `creditAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `status` ENUM('COMPLETED', 'VOIDED', 'REFUNDED', 'PARTIALLY_REFUNDED') NOT NULL DEFAULT 'COMPLETED',
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PosSale_number_key`(`number`),
    INDEX `PosSale_branchId_status_saleDate_idx`(`branchId`, `status`, `saleDate`),
    INDEX `PosSale_cashierId_saleDate_idx`(`cashierId`, `saleDate`),
    INDEX `PosSale_customerId_saleDate_idx`(`customerId`, `saleDate`),
    INDEX `PosSale_sessionId_idx`(`sessionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PosSaleItem` (
    `id` VARCHAR(191) NOT NULL,
    `saleId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `unit` ENUM('PCS', 'KG', 'G', 'M', 'M2', 'L', 'ML', 'BOX', 'PACK', 'PAIR', 'SET') NOT NULL DEFAULT 'PCS',
    `quantity` DECIMAL(18, 4) NOT NULL,
    `unitPrice` DECIMAL(18, 4) NOT NULL,
    `discountRate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `taxRate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `lineTotal` DECIMAL(18, 4) NOT NULL,
    `returnedQty` DECIMAL(18, 4) NOT NULL DEFAULT 0,

    INDEX `PosSaleItem_saleId_idx`(`saleId`),
    INDEX `PosSaleItem_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PosSalePayment` (
    `id` VARCHAR(191) NOT NULL,
    `saleId` VARCHAR(191) NOT NULL,
    `method` ENUM('CASH', 'CARD', 'MOBILE_BANKING', 'BANK_TRANSFER', 'CREDIT', 'GIFT_CARD', 'OTHER') NOT NULL,
    `amount` DECIMAL(18, 4) NOT NULL,
    `reference` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PosSalePayment_saleId_idx`(`saleId`),
    INDEX `PosSalePayment_method_idx`(`method`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PosReturn` (
    `id` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `warehouseId` VARCHAR(191) NOT NULL,
    `saleId` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NULL,
    `returnDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `refundAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `refundMethod` ENUM('CASH', 'CARD', 'MOBILE_BANKING', 'BANK_TRANSFER', 'CREDIT', 'GIFT_CARD', 'OTHER') NOT NULL DEFAULT 'CASH',
    `status` ENUM('COMPLETED', 'VOIDED') NOT NULL DEFAULT 'COMPLETED',
    `reason` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PosReturn_number_key`(`number`),
    INDEX `PosReturn_branchId_returnDate_idx`(`branchId`, `returnDate`),
    INDEX `PosReturn_saleId_idx`(`saleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PosReturnItem` (
    `id` VARCHAR(191) NOT NULL,
    `returnId` VARCHAR(191) NOT NULL,
    `saleItemId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(18, 4) NOT NULL,
    `unitPrice` DECIMAL(18, 4) NOT NULL,
    `lineTotal` DECIMAL(18, 4) NOT NULL,

    INDEX `PosReturnItem_returnId_idx`(`returnId`),
    INDEX `PosReturnItem_saleItemId_idx`(`saleItemId`),
    INDEX `PosReturnItem_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EcommerceChannel` (
    `id` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('SHOPIFY', 'WOOCOMMERCE', 'FACEBOOK', 'DARAZ', 'MANUAL', 'OTHER') NOT NULL DEFAULT 'MANUAL',
    `storeUrl` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `lastSyncAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EcommerceChannel_branchId_isActive_idx`(`branchId`, `isActive`),
    UNIQUE INDEX `EcommerceChannel_branchId_code_key`(`branchId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EcommerceOrder` (
    `id` VARCHAR(191) NOT NULL,
    `channelId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `warehouseId` VARCHAR(191) NULL,
    `customerId` VARCHAR(191) NULL,
    `externalId` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `orderDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` ENUM('SYNCED', 'PACKING', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'PARTIALLY_RETURNED', 'RETURNED') NOT NULL DEFAULT 'SYNCED',
    `paymentStatus` ENUM('PENDING', 'PARTIALLY_PAID', 'PAID', 'RECONCILED', 'REFUNDED') NOT NULL DEFAULT 'PENDING',
    `currency` ENUM('BDT', 'INR', 'USD', 'EUR') NOT NULL DEFAULT 'BDT',
    `subtotal` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `discountTotal` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `shippingTotal` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `taxTotal` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `grandTotal` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `paidTotal` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `reconciledAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `customerName` VARCHAR(191) NULL,
    `customerPhone` VARCHAR(191) NULL,
    `customerEmail` VARCHAR(191) NULL,
    `shipToAddress` VARCHAR(191) NULL,
    `courier` VARCHAR(191) NULL,
    `trackingNo` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `EcommerceOrder_number_key`(`number`),
    INDEX `EcommerceOrder_branchId_status_orderDate_idx`(`branchId`, `status`, `orderDate`),
    INDEX `EcommerceOrder_customerId_orderDate_idx`(`customerId`, `orderDate`),
    INDEX `EcommerceOrder_paymentStatus_idx`(`paymentStatus`),
    UNIQUE INDEX `EcommerceOrder_channelId_externalId_key`(`channelId`, `externalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EcommerceOrderItem` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NULL,
    `sku` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `unit` ENUM('PCS', 'KG', 'G', 'M', 'M2', 'L', 'ML', 'BOX', 'PACK', 'PAIR', 'SET') NOT NULL DEFAULT 'PCS',
    `quantity` DECIMAL(18, 4) NOT NULL,
    `packedQty` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `fulfilledQty` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `returnedQty` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `unitPrice` DECIMAL(18, 4) NOT NULL,
    `discountRate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `taxRate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `lineTotal` DECIMAL(18, 4) NOT NULL,

    INDEX `EcommerceOrderItem_orderId_idx`(`orderId`),
    INDEX `EcommerceOrderItem_productId_idx`(`productId`),
    INDEX `EcommerceOrderItem_sku_idx`(`sku`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EcommerceFulfillment` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `warehouseId` VARCHAR(191) NOT NULL,
    `status` ENUM('PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED') NOT NULL DEFAULT 'PACKED',
    `packedAt` DATETIME(3) NULL,
    `shippedAt` DATETIME(3) NULL,
    `deliveredAt` DATETIME(3) NULL,
    `courier` VARCHAR(191) NULL,
    `trackingNo` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EcommerceFulfillment_orderId_idx`(`orderId`),
    INDEX `EcommerceFulfillment_branchId_status_idx`(`branchId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EcommerceFulfillmentItem` (
    `id` VARCHAR(191) NOT NULL,
    `fulfillmentId` VARCHAR(191) NOT NULL,
    `orderItemId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NULL,
    `quantity` DECIMAL(18, 4) NOT NULL,

    INDEX `EcommerceFulfillmentItem_fulfillmentId_idx`(`fulfillmentId`),
    INDEX `EcommerceFulfillmentItem_orderItemId_idx`(`orderItemId`),
    INDEX `EcommerceFulfillmentItem_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EcommercePayment` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `method` ENUM('CASH', 'CARD', 'MOBILE_BANKING', 'BANK_TRANSFER', 'CREDIT', 'GIFT_CARD', 'OTHER') NOT NULL,
    `provider` VARCHAR(191) NULL,
    `externalId` VARCHAR(191) NULL,
    `amount` DECIMAL(18, 4) NOT NULL,
    `fee` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `receivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reconciledAt` DATETIME(3) NULL,
    `status` ENUM('PENDING', 'PARTIALLY_PAID', 'PAID', 'RECONCILED', 'REFUNDED') NOT NULL DEFAULT 'PAID',
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `EcommercePayment_orderId_idx`(`orderId`),
    INDEX `EcommercePayment_branchId_receivedAt_idx`(`branchId`, `receivedAt`),
    INDEX `EcommercePayment_externalId_idx`(`externalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EcommerceReturn` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `status` ENUM('REQUESTED', 'RECEIVED', 'REFUNDED', 'REJECTED') NOT NULL DEFAULT 'RECEIVED',
    `refundAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `refundMethod` ENUM('CASH', 'CARD', 'MOBILE_BANKING', 'BANK_TRANSFER', 'CREDIT', 'GIFT_CARD', 'OTHER') NOT NULL DEFAULT 'CASH',
    `refundReference` VARCHAR(191) NULL,
    `reason` VARCHAR(191) NULL,
    `receivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EcommerceReturn_orderId_idx`(`orderId`),
    INDEX `EcommerceReturn_branchId_receivedAt_idx`(`branchId`, `receivedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EcommerceReturnItem` (
    `id` VARCHAR(191) NOT NULL,
    `returnId` VARCHAR(191) NOT NULL,
    `orderItemId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NULL,
    `quantity` DECIMAL(18, 4) NOT NULL,
    `lineTotal` DECIMAL(18, 4) NOT NULL,

    INDEX `EcommerceReturnItem_returnId_idx`(`returnId`),
    INDEX `EcommerceReturnItem_orderItemId_idx`(`orderItemId`),
    INDEX `EcommerceReturnItem_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EcommerceReconciliationRun` (
    `id` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `channelId` VARCHAR(191) NOT NULL,
    `periodStart` DATETIME(3) NOT NULL,
    `periodEnd` DATETIME(3) NOT NULL,
    `status` ENUM('DRAFT', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'DRAFT',
    `matchedCount` INTEGER NOT NULL DEFAULT 0,
    `unmatchedCount` INTEGER NOT NULL DEFAULT 0,
    `totalSettled` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `notes` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `EcommerceReconciliationRun_branchId_periodStart_periodEnd_idx`(`branchId`, `periodStart`, `periodEnd`),
    INDEX `EcommerceReconciliationRun_channelId_createdAt_idx`(`channelId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WholesaleInvoice` (
    `id` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `warehouseId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `salesRepId` VARCHAR(191) NULL,
    `invoiceDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `dueDate` DATETIME(3) NULL,
    `currency` ENUM('BDT', 'INR', 'USD', 'EUR') NOT NULL DEFAULT 'BDT',
    `subtotal` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `discountTotal` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `taxTotal` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `grandTotal` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `paidTotal` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `balanceDue` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `status` ENUM('DRAFT', 'CONFIRMED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOIDED', 'PARTIALLY_RETURNED', 'RETURNED') NOT NULL DEFAULT 'CONFIRMED',
    `notes` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `WholesaleInvoice_number_key`(`number`),
    INDEX `WholesaleInvoice_branchId_status_invoiceDate_idx`(`branchId`, `status`, `invoiceDate`),
    INDEX `WholesaleInvoice_customerId_invoiceDate_idx`(`customerId`, `invoiceDate`),
    INDEX `WholesaleInvoice_dueDate_idx`(`dueDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WholesaleInvoiceItem` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `unit` ENUM('PCS', 'KG', 'G', 'M', 'M2', 'L', 'ML', 'BOX', 'PACK', 'PAIR', 'SET') NOT NULL DEFAULT 'PCS',
    `quantity` DECIMAL(18, 4) NOT NULL,
    `unitPrice` DECIMAL(18, 4) NOT NULL,
    `discountRate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `taxRate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `lineTotal` DECIMAL(18, 4) NOT NULL,
    `returnedQty` DECIMAL(18, 4) NOT NULL DEFAULT 0,

    INDEX `WholesaleInvoiceItem_invoiceId_idx`(`invoiceId`),
    INDEX `WholesaleInvoiceItem_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WholesalePayment` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `method` ENUM('CASH', 'CARD', 'MOBILE_BANKING', 'BANK_TRANSFER', 'CREDIT', 'GIFT_CARD', 'OTHER') NOT NULL,
    `amount` DECIMAL(18, 4) NOT NULL,
    `reference` VARCHAR(191) NULL,
    `paidAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WholesalePayment_invoiceId_idx`(`invoiceId`),
    INDEX `WholesalePayment_method_idx`(`method`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WholesaleReturn` (
    `id` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `warehouseId` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `returnDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `refundAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `refundToBalance` BOOLEAN NOT NULL DEFAULT true,
    `refundMethod` ENUM('CASH', 'CARD', 'MOBILE_BANKING', 'BANK_TRANSFER', 'CREDIT', 'GIFT_CARD', 'OTHER') NOT NULL DEFAULT 'CASH',
    `status` ENUM('COMPLETED', 'VOIDED') NOT NULL DEFAULT 'COMPLETED',
    `reason` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `WholesaleReturn_number_key`(`number`),
    INDEX `WholesaleReturn_branchId_returnDate_idx`(`branchId`, `returnDate`),
    INDEX `WholesaleReturn_invoiceId_idx`(`invoiceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WholesaleReturnItem` (
    `id` VARCHAR(191) NOT NULL,
    `returnId` VARCHAR(191) NOT NULL,
    `invoiceItemId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(18, 4) NOT NULL,
    `unitPrice` DECIMAL(18, 4) NOT NULL,
    `lineTotal` DECIMAL(18, 4) NOT NULL,

    INDEX `WholesaleReturnItem_returnId_idx`(`returnId`),
    INDEX `WholesaleReturnItem_invoiceItemId_idx`(`invoiceItemId`),
    INDEX `WholesaleReturnItem_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CorporateQuote` (
    `id` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `salesRepId` VARCHAR(191) NULL,
    `quoteDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `validUntil` DATETIME(3) NULL,
    `currency` ENUM('BDT', 'INR', 'USD', 'EUR') NOT NULL DEFAULT 'BDT',
    `subtotal` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `discountTotal` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `taxTotal` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `grandTotal` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `status` ENUM('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED') NOT NULL DEFAULT 'DRAFT',
    `notes` VARCHAR(191) NULL,
    `rejectReason` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CorporateQuote_number_key`(`number`),
    INDEX `CorporateQuote_branchId_status_quoteDate_idx`(`branchId`, `status`, `quoteDate`),
    INDEX `CorporateQuote_customerId_quoteDate_idx`(`customerId`, `quoteDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CorporateQuoteItem` (
    `id` VARCHAR(191) NOT NULL,
    `quoteId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `unit` ENUM('PCS', 'KG', 'G', 'M', 'M2', 'L', 'ML', 'BOX', 'PACK', 'PAIR', 'SET') NOT NULL DEFAULT 'PCS',
    `quantity` DECIMAL(18, 4) NOT NULL,
    `unitPrice` DECIMAL(18, 4) NOT NULL,
    `discountRate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `taxRate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `lineTotal` DECIMAL(18, 4) NOT NULL,

    INDEX `CorporateQuoteItem_quoteId_idx`(`quoteId`),
    INDEX `CorporateQuoteItem_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CorporateOrder` (
    `id` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `warehouseId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `quoteId` VARCHAR(191) NULL,
    `salesRepId` VARCHAR(191) NULL,
    `orderDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expectedDate` DATETIME(3) NULL,
    `paymentTerms` ENUM('COD', 'NET_15', 'NET_30', 'NET_45', 'NET_60', 'NET_90') NOT NULL DEFAULT 'NET_30',
    `currency` ENUM('BDT', 'INR', 'USD', 'EUR') NOT NULL DEFAULT 'BDT',
    `subtotal` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `discountTotal` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `taxTotal` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `grandTotal` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `status` ENUM('DRAFT', 'CONFIRMED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'INVOICED', 'CLOSED', 'CANCELED') NOT NULL DEFAULT 'DRAFT',
    `notes` VARCHAR(191) NULL,
    `cancelReason` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CorporateOrder_number_key`(`number`),
    INDEX `CorporateOrder_branchId_status_orderDate_idx`(`branchId`, `status`, `orderDate`),
    INDEX `CorporateOrder_customerId_orderDate_idx`(`customerId`, `orderDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CorporateOrderItem` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `unit` ENUM('PCS', 'KG', 'G', 'M', 'M2', 'L', 'ML', 'BOX', 'PACK', 'PAIR', 'SET') NOT NULL DEFAULT 'PCS',
    `quantity` DECIMAL(18, 4) NOT NULL,
    `unitPrice` DECIMAL(18, 4) NOT NULL,
    `discountRate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `taxRate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `lineTotal` DECIMAL(18, 4) NOT NULL,
    `deliveredQty` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `invoicedQty` DECIMAL(18, 4) NOT NULL DEFAULT 0,

    INDEX `CorporateOrderItem_orderId_idx`(`orderId`),
    INDEX `CorporateOrderItem_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CorporateDelivery` (
    `id` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `warehouseId` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `deliveryAddress` VARCHAR(500) NULL,
    `expectedDate` DATE NULL,
    `deliveryDate` DATETIME(3) NULL,
    `status` ENUM('DRAFT', 'APPROVED', 'PICKING', 'PACKED', 'DISPATCHED', 'DELIVERED', 'CLOSED', 'VOIDED') NOT NULL DEFAULT 'DRAFT',
    `vehicleNo` VARCHAR(191) NULL,
    `driverName` VARCHAR(191) NULL,
    `driverPhone` VARCHAR(191) NULL,
    `transportCompany` VARCHAR(191) NULL,
    `trackingNo` VARCHAR(191) NULL,
    `gatePassNo` VARCHAR(191) NULL,
    `receivedById` VARCHAR(191) NULL,
    `customerSignature` VARCHAR(191) NULL,
    `podAttachment` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CorporateDelivery_number_key`(`number`),
    INDEX `CorporateDelivery_branchId_deliveryDate_idx`(`branchId`, `deliveryDate`),
    INDEX `CorporateDelivery_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CorporateDeliveryItem` (
    `id` VARCHAR(191) NOT NULL,
    `deliveryId` VARCHAR(191) NOT NULL,
    `orderItemId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(18, 4) NOT NULL,

    INDEX `CorporateDeliveryItem_deliveryId_idx`(`deliveryId`),
    INDEX `CorporateDeliveryItem_orderItemId_idx`(`orderItemId`),
    INDEX `CorporateDeliveryItem_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CorporateSalesReturn` (
    `id` VARCHAR(191) NOT NULL,
    `returnNo` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NULL,
    `warehouseId` VARCHAR(191) NOT NULL,
    `returnDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` ENUM('REQUESTED', 'APPROVED', 'GOODS_RECEIVED', 'QC_INSPECTION', 'INVENTORY_UPDATED', 'CREDIT_NOTE_ISSUED', 'CLOSED', 'REJECTED') NOT NULL DEFAULT 'REQUESTED',
    `refundType` ENUM('CASH', 'BANK', 'CREDIT_NOTE', 'REPLACEMENT') NOT NULL DEFAULT 'CREDIT_NOTE',
    `reason` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `qcOfficerId` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CorporateSalesReturn_returnNo_key`(`returnNo`),
    INDEX `CorporateSalesReturn_branchId_returnDate_idx`(`branchId`, `returnDate`),
    INDEX `CorporateSalesReturn_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CorporateSalesReturnItem` (
    `id` VARCHAR(191) NOT NULL,
    `returnId` VARCHAR(191) NOT NULL,
    `orderItemId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `batchNo` VARCHAR(191) NULL,
    `soldQty` DECIMAL(18, 4) NOT NULL,
    `returnedQty` DECIMAL(18, 4) NOT NULL,
    `condition` ENUM('RESALABLE', 'REPAIRABLE', 'DAMAGED', 'MANUFACTURING_DEFECT') NOT NULL DEFAULT 'RESALABLE',
    `inspectionResult` VARCHAR(191) NULL,
    `damageType` VARCHAR(191) NULL,
    `photoAttachment` VARCHAR(191) NULL,

    INDEX `CorporateSalesReturnItem_returnId_idx`(`returnId`),
    INDEX `CorporateSalesReturnItem_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CorporateInvoice` (
    `id` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `invoiceDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `dueDate` DATETIME(3) NULL,
    `currency` ENUM('BDT', 'INR', 'USD', 'EUR') NOT NULL DEFAULT 'BDT',
    `subtotal` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `discountTotal` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `taxTotal` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `grandTotal` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `paidTotal` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `balanceDue` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `status` ENUM('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOIDED') NOT NULL DEFAULT 'ISSUED',
    `notes` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CorporateInvoice_number_key`(`number`),
    INDEX `CorporateInvoice_branchId_status_invoiceDate_idx`(`branchId`, `status`, `invoiceDate`),
    INDEX `CorporateInvoice_customerId_invoiceDate_idx`(`customerId`, `invoiceDate`),
    INDEX `CorporateInvoice_orderId_idx`(`orderId`),
    INDEX `CorporateInvoice_dueDate_idx`(`dueDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CorporateInvoiceItem` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `orderItemId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `colorDesign` VARCHAR(191) NULL,
    `quantity` DECIMAL(18, 4) NOT NULL,
    `unitPrice` DECIMAL(18, 4) NOT NULL,
    `discountRate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `taxRate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `lineTotal` DECIMAL(18, 4) NOT NULL,

    INDEX `CorporateInvoiceItem_invoiceId_idx`(`invoiceId`),
    INDEX `CorporateInvoiceItem_orderItemId_idx`(`orderItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CorporateInvoicePayment` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `method` ENUM('CASH', 'CARD', 'MOBILE_BANKING', 'BANK_TRANSFER', 'CREDIT', 'GIFT_CARD', 'OTHER') NOT NULL,
    `amount` DECIMAL(18, 4) NOT NULL,
    `reference` VARCHAR(191) NULL,
    `paidAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CorporateInvoicePayment_invoiceId_idx`(`invoiceId`),
    INDEX `CorporateInvoicePayment_method_idx`(`method`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChartAccount` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE') NOT NULL,
    `normalSide` ENUM('DEBIT', 'CREDIT') NOT NULL,
    `parentId` VARCHAR(191) NULL,
    `path` VARCHAR(191) NOT NULL,
    `depth` INTEGER NOT NULL DEFAULT 0,
    `isPosting` BOOLEAN NOT NULL DEFAULT true,
    `isControl` BOOLEAN NOT NULL DEFAULT false,
    `currency` ENUM('BDT', 'INR', 'USD', 'EUR') NOT NULL DEFAULT 'BDT',
    `branchId` VARCHAR(191) NULL,
    `openingBalance` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `description` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `detailType` VARCHAR(191) NULL,
    `openingBalanceDate` DATETIME(3) NULL,
    `isSystem` BOOLEAN NOT NULL DEFAULT false,
    `createdById` VARCHAR(191) NULL,
    `updatedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ChartAccount_code_key`(`code`),
    INDEX `ChartAccount_type_idx`(`type`),
    INDEX `ChartAccount_parentId_idx`(`parentId`),
    INDEX `ChartAccount_path_idx`(`path`),
    INDEX `ChartAccount_branchId_idx`(`branchId`),
    INDEX `ChartAccount_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OpeningBalanceEntry` (
    `id` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `periodId` VARCHAR(191) NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `amount` DECIMAL(18, 4) NOT NULL,
    `normalSide` ENUM('DEBIT', 'CREDIT') NOT NULL,
    `reference` VARCHAR(191) NULL,
    `remarks` VARCHAR(191) NULL,
    `sourceRefType` VARCHAR(191) NULL,
    `sourceRefId` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `OpeningBalanceEntry_branchId_date_idx`(`branchId`, `date`),
    INDEX `OpeningBalanceEntry_periodId_idx`(`periodId`),
    INDEX `OpeningBalanceEntry_accountId_date_idx`(`accountId`, `date`),
    INDEX `OpeningBalanceEntry_sourceRefType_sourceRefId_idx`(`sourceRefType`, `sourceRefId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SystemAccountMapping` (
    `id` VARCHAR(191) NOT NULL,
    `key` ENUM('CASH', 'BANK_DEFAULT', 'AR_CONTROL', 'AP_CONTROL', 'INVENTORY', 'INVENTORY_RAW_MATERIAL', 'INVENTORY_FINISHED_GOODS', 'WIP', 'COGS', 'SALES_REVENUE', 'SALES_REVENUE_POS', 'SALES_REVENUE_WHOLESALE', 'SALES_REVENUE_CORPORATE', 'SALES_RETURNS', 'DISCOUNT_GIVEN', 'TAX_PAYABLE', 'TAX_RECOVERABLE', 'PURCHASE_EXPENSE', 'FX_GAIN', 'FX_LOSS', 'RETAINED_EARNINGS', 'OPENING_BALANCE_EQUITY', 'ROUNDING', 'INTERBRANCH_CLEARING') NOT NULL,
    `branchId` VARCHAR(191) NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SystemAccountMapping_accountId_idx`(`accountId`),
    UNIQUE INDEX `SystemAccountMapping_key_branchId_key`(`key`, `branchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `JournalEntry` (
    `id` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `periodId` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `memo` VARCHAR(191) NULL,
    `reference` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'POSTED', 'VOIDED') NOT NULL DEFAULT 'DRAFT',
    `sourceModule` VARCHAR(191) NULL,
    `sourceRefType` VARCHAR(191) NULL,
    `sourceRefId` VARCHAR(191) NULL,
    `reversesId` VARCHAR(191) NULL,
    `totalDebit` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `totalCredit` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `createdById` VARCHAR(191) NULL,
    `postedById` VARCHAR(191) NULL,
    `postedAt` DATETIME(3) NULL,
    `voidedById` VARCHAR(191) NULL,
    `voidedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `JournalEntry_number_key`(`number`),
    UNIQUE INDEX `JournalEntry_reversesId_key`(`reversesId`),
    INDEX `JournalEntry_branchId_date_idx`(`branchId`, `date`),
    INDEX `JournalEntry_status_idx`(`status`),
    INDEX `JournalEntry_periodId_idx`(`periodId`),
    UNIQUE INDEX `JournalEntry_sourceModule_sourceRefType_sourceRefId_key`(`sourceModule`, `sourceRefType`, `sourceRefId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `JournalEntryLine` (
    `id` VARCHAR(191) NOT NULL,
    `entryId` VARCHAR(191) NOT NULL,
    `lineNo` INTEGER NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `debit` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `credit` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `currency` ENUM('BDT', 'INR', 'USD', 'EUR') NOT NULL DEFAULT 'BDT',
    `fxRate` DECIMAL(18, 6) NOT NULL DEFAULT 1,
    `costCenter` VARCHAR(191) NULL,
    `memo` VARCHAR(191) NULL,

    INDEX `JournalEntryLine_entryId_idx`(`entryId`),
    INDEX `JournalEntryLine_accountId_idx`(`accountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Employee` (
    `id` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `shiftId` VARCHAR(191) NULL,
    `reportingManagerId` VARCHAR(191) NULL,
    `systemRoleId` VARCHAR(191) NULL,
    `code` VARCHAR(191) NOT NULL,
    `firstName` VARCHAR(191) NOT NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `designation` VARCHAR(191) NULL,
    `department` VARCHAR(191) NULL,
    `employmentType` VARCHAR(191) NULL DEFAULT 'PERMANENT',
    `joinedAt` DATETIME(3) NOT NULL,
    `leftAt` DATETIME(3) NULL,
    `status` ENUM('ACTIVE', 'ON_LEAVE', 'TERMINATED', 'RESIGNED') NOT NULL DEFAULT 'ACTIVE',
    `basicSalary` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `houseAllowance` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `transportAllowance` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `medicalAllowance` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `otherAllowance` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `providentFund` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `taxDeduction` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `bankName` VARCHAR(191) NULL,
    `bankAccount` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `updatedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Employee_email_key`(`email`),
    INDEX `Employee_branchId_status_idx`(`branchId`, `status`),
    INDEX `Employee_department_idx`(`department`),
    INDEX `Employee_designation_idx`(`designation`),
    INDEX `Employee_employmentType_idx`(`employmentType`),
    INDEX `Employee_shiftId_idx`(`shiftId`),
    INDEX `Employee_reportingManagerId_idx`(`reportingManagerId`),
    INDEX `Employee_systemRoleId_idx`(`systemRoleId`),
    UNIQUE INDEX `Employee_branchId_code_key`(`branchId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Shift` (
    `id` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `description` VARCHAR(191) NULL,
    `shiftType` VARCHAR(191) NOT NULL,
    `startTime` VARCHAR(191) NOT NULL,
    `endTime` VARCHAR(191) NOT NULL,
    `breakStart` VARCHAR(191) NULL,
    `breakEnd` VARCHAR(191) NULL,
    `lateGraceMinutes` INTEGER NOT NULL DEFAULT 0,
    `earlyExitGraceMinutes` INTEGER NOT NULL DEFAULT 0,
    `minPresentMinutes` INTEGER NOT NULL,
    `minHalfDayMinutes` INTEGER NOT NULL,
    `absentBelowMinutes` INTEGER NOT NULL,
    `overtimeAllowed` BOOLEAN NOT NULL DEFAULT false,
    `otStartsAfter` VARCHAR(191) NULL,
    `minOtMinutes` INTEGER NOT NULL DEFAULT 0,
    `maxOtMinutesPerDay` INTEGER NOT NULL DEFAULT 0,
    `weeklyOffDays` JSON NULL,
    `createdById` VARCHAR(191) NULL,
    `updatedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Shift_branchId_status_idx`(`branchId`, `status`),
    INDEX `Shift_branchId_name_idx`(`branchId`, `name`),
    UNIQUE INDEX `Shift_branchId_code_key`(`branchId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Holiday` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `startDate` DATE NOT NULL,
    `endDate` DATE NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NULL,
    `isPaid` BOOLEAN NOT NULL DEFAULT true,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `description` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `updatedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Holiday_code_key`(`code`),
    INDEX `Holiday_startDate_endDate_status_idx`(`startDate`, `endDate`, `status`),
    INDEX `Holiday_branchId_startDate_endDate_idx`(`branchId`, `startDate`, `endDate`),
    INDEX `Holiday_type_status_idx`(`type`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HrMasterData` (
    `id` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NULL,
    `type` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `metadata` JSON NULL,
    `createdById` VARCHAR(191) NULL,
    `updatedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `HrMasterData_branchId_type_idx`(`branchId`, `type`),
    INDEX `HrMasterData_type_status_idx`(`type`, `status`),
    UNIQUE INDEX `HrMasterData_type_code_key`(`type`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HrWorkflowRecord` (
    `id` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NULL,
    `employeeId` VARCHAR(191) NULL,
    `section` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'OPEN',
    `priority` VARCHAR(191) NOT NULL DEFAULT 'NORMAL',
    `startDate` DATETIME(3) NULL,
    `endDate` DATETIME(3) NULL,
    `amount` DECIMAL(18, 2) NULL,
    `owner` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `createdById` VARCHAR(191) NULL,
    `updatedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `HrWorkflowRecord_branchId_section_idx`(`branchId`, `section`),
    INDEX `HrWorkflowRecord_employeeId_section_idx`(`employeeId`, `section`),
    INDEX `HrWorkflowRecord_section_status_idx`(`section`, `status`),
    INDEX `HrWorkflowRecord_startDate_idx`(`startDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmployeePromotion` (
    `id` VARCHAR(191) NOT NULL,
    `promotionNumber` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `promotionType` ENUM('REGULAR', 'ADJUSTMENT', 'UPGRADE', 'ACTING') NOT NULL,
    `status` ENUM('DRAFT', 'SUBMITTED', 'PENDING_MANAGER_APPROVAL', 'PENDING_HR_APPROVAL', 'APPROVED', 'COMPLETED', 'REJECTED_BY_MANAGER', 'REJECTED_BY_HR') NOT NULL DEFAULT 'DRAFT',
    `currentBranch` VARCHAR(191) NULL,
    `currentDepartment` VARCHAR(191) NULL,
    `currentDesignation` VARCHAR(191) NULL,
    `currentSalary` DECIMAL(18, 2) NULL,
    `reportingManagerId` VARCHAR(191) NULL,
    `newDesignation` VARCHAR(191) NOT NULL,
    `newSalary` DECIMAL(18, 2) NOT NULL,
    `effectiveDate` DATE NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `remarks` VARCHAR(191) NULL,
    `managerApprovalStatus` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `managerApprovalDate` DATETIME(3) NULL,
    `managerRemarks` VARCHAR(191) NULL,
    `hrApprovalStatus` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `hrApprovalDate` DATETIME(3) NULL,
    `hrRemarks` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdById` VARCHAR(191) NULL,
    `updatedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `EmployeePromotion_promotionNumber_key`(`promotionNumber`),
    INDEX `EmployeePromotion_branchId_status_idx`(`branchId`, `status`),
    INDEX `EmployeePromotion_employeeId_status_idx`(`employeeId`, `status`),
    INDEX `EmployeePromotion_promotionType_status_idx`(`promotionType`, `status`),
    INDEX `EmployeePromotion_effectiveDate_idx`(`effectiveDate`),
    INDEX `EmployeePromotion_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmployeeIncrement` (
    `id` VARCHAR(191) NOT NULL,
    `incrementNumber` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `incrementType` ENUM('ANNUAL', 'PERFORMANCE', 'MERIT', 'ADJUSTMENT', 'SPECIAL') NOT NULL,
    `status` ENUM('DRAFT', 'SUBMITTED', 'PENDING_HR_APPROVAL', 'PENDING_ACCOUNTS_APPROVAL', 'PENDING_MANAGER_APPROVAL', 'APPROVED', 'APPLIED', 'REJECTED') NOT NULL DEFAULT 'DRAFT',
    `incrementMethod` ENUM('PERCENTAGE', 'FIXED_AMOUNT') NOT NULL,
    `currentBranch` VARCHAR(191) NULL,
    `currentDepartment` VARCHAR(191) NULL,
    `currentDesignation` VARCHAR(191) NULL,
    `currentEmploymentType` VARCHAR(191) NULL,
    `currentBasicSalary` DECIMAL(18, 2) NOT NULL,
    `currentGrossSalary` DECIMAL(18, 2) NOT NULL,
    `reportingManagerId` VARCHAR(191) NULL,
    `incrementValue` DECIMAL(18, 2) NOT NULL,
    `newBasicSalary` DECIMAL(18, 2) NOT NULL,
    `newGrossSalary` DECIMAL(18, 2) NOT NULL,
    `effectiveDate` DATE NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `performanceSummary` VARCHAR(191) NULL,
    `remarks` VARCHAR(191) NULL,
    `hrApprovalStatus` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `hrApprovalDate` DATETIME(3) NULL,
    `hrRemarks` VARCHAR(191) NULL,
    `accountsApprovalStatus` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `accountsApprovalDate` DATETIME(3) NULL,
    `budgetVerified` BOOLEAN NULL,
    `accountsRemarks` VARCHAR(191) NULL,
    `managerApprovalStatus` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `managerApprovalDate` DATETIME(3) NULL,
    `managerRemarks` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `letterGeneratedAt` DATETIME(3) NULL,
    `appliedAt` DATETIME(3) NULL,
    `createdById` VARCHAR(191) NULL,
    `updatedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `EmployeeIncrement_incrementNumber_key`(`incrementNumber`),
    INDEX `EmployeeIncrement_branchId_status_idx`(`branchId`, `status`),
    INDEX `EmployeeIncrement_employeeId_status_idx`(`employeeId`, `status`),
    INDEX `EmployeeIncrement_incrementType_status_idx`(`incrementType`, `status`),
    INDEX `EmployeeIncrement_effectiveDate_idx`(`effectiveDate`),
    INDEX `EmployeeIncrement_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmployeeConfirmation` (
    `id` VARCHAR(191) NOT NULL,
    `confirmationNumber` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `confirmationType` ENUM('PROBATION_TO_PERMANENT', 'INTERNSHIP_TO_PERMANENT') NOT NULL,
    `status` ENUM('DRAFT', 'PENDING_MANAGER_APPROVAL', 'PENDING_HR_APPROVAL', 'PENDING_ACCOUNTS_APPROVAL', 'CONFIRMED', 'EXTENDED', 'REJECTED', 'CANCELLED', 'SENT_BACK') NOT NULL DEFAULT 'DRAFT',
    `currentBranch` VARCHAR(191) NULL,
    `currentDepartment` VARCHAR(191) NULL,
    `currentDesignation` VARCHAR(191) NULL,
    `currentEmploymentType` VARCHAR(191) NULL,
    `currentBasicSalary` DECIMAL(18, 2) NOT NULL,
    `currentGrossSalary` DECIMAL(18, 2) NOT NULL,
    `reportingManagerId` VARCHAR(191) NULL,
    `probationEndDate` DATE NULL,
    `effectiveDate` DATE NOT NULL,
    `salaryRevisionRequired` BOOLEAN NOT NULL DEFAULT false,
    `incrementAmount` DECIMAL(18, 2) NULL,
    `newBasicSalary` DECIMAL(18, 2) NOT NULL,
    `newGrossSalary` DECIMAL(18, 2) NOT NULL,
    `benefitsRevision` VARCHAR(191) NULL,
    `reason` VARCHAR(191) NOT NULL,
    `performanceSummary` VARCHAR(191) NULL,
    `remarks` VARCHAR(191) NULL,
    `managerReviewStatus` ENUM('PENDING', 'APPROVED', 'REJECTED', 'SENT_BACK', 'EXTENDED', 'REVISION_REQUESTED') NOT NULL DEFAULT 'PENDING',
    `managerReviewDate` DATETIME(3) NULL,
    `managerRemarks` VARCHAR(191) NULL,
    `hrReviewStatus` ENUM('PENDING', 'APPROVED', 'REJECTED', 'SENT_BACK', 'EXTENDED', 'REVISION_REQUESTED') NOT NULL DEFAULT 'PENDING',
    `hrReviewDate` DATETIME(3) NULL,
    `hrRemarks` VARCHAR(191) NULL,
    `accountsReviewStatus` ENUM('PENDING', 'APPROVED', 'REJECTED', 'SENT_BACK', 'EXTENDED', 'REVISION_REQUESTED') NOT NULL DEFAULT 'PENDING',
    `accountsReviewDate` DATETIME(3) NULL,
    `accountsRemarks` VARCHAR(191) NULL,
    `confirmedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `letterGeneratedAt` DATETIME(3) NULL,
    `createdById` VARCHAR(191) NULL,
    `updatedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `EmployeeConfirmation_confirmationNumber_key`(`confirmationNumber`),
    INDEX `EmployeeConfirmation_branchId_status_idx`(`branchId`, `status`),
    INDEX `EmployeeConfirmation_employeeId_status_idx`(`employeeId`, `status`),
    INDEX `EmployeeConfirmation_confirmationType_status_idx`(`confirmationType`, `status`),
    INDEX `EmployeeConfirmation_effectiveDate_idx`(`effectiveDate`),
    INDEX `EmployeeConfirmation_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmployeeSalaryHistory` (
    `id` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `sourceType` ENUM('INCREMENT', 'CONFIRMATION') NOT NULL,
    `sourceId` VARCHAR(191) NULL,
    `effectiveDate` DATE NOT NULL,
    `oldBasicSalary` DECIMAL(18, 2) NOT NULL,
    `newBasicSalary` DECIMAL(18, 2) NOT NULL,
    `oldGrossSalary` DECIMAL(18, 2) NOT NULL,
    `newGrossSalary` DECIMAL(18, 2) NOT NULL,
    `remarks` VARCHAR(191) NULL,
    `appliedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdById` VARCHAR(191) NULL,
    `updatedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EmployeeSalaryHistory_branchId_effectiveDate_idx`(`branchId`, `effectiveDate`),
    INDEX `EmployeeSalaryHistory_employeeId_effectiveDate_idx`(`employeeId`, `effectiveDate`),
    INDEX `EmployeeSalaryHistory_sourceType_sourceId_idx`(`sourceType`, `sourceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmployeeTransfer` (
    `id` VARCHAR(191) NOT NULL,
    `transferNumber` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `transferType` ENUM('BRANCH', 'DEPARTMENT', 'SHIFT', 'TEMPORARY', 'PERMANENT') NOT NULL,
    `status` ENUM('DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `currentBranch` VARCHAR(191) NULL,
    `currentDepartment` VARCHAR(191) NULL,
    `currentDesignation` VARCHAR(191) NULL,
    `currentShiftId` VARCHAR(191) NULL,
    `newBranchId` VARCHAR(191) NULL,
    `newDepartment` VARCHAR(191) NULL,
    `newShiftId` VARCHAR(191) NULL,
    `tempBranchId` VARCHAR(191) NULL,
    `tempDepartment` VARCHAR(191) NULL,
    `tempShiftId` VARCHAR(191) NULL,
    `startDate` DATE NULL,
    `endDate` DATE NULL,
    `effectiveDate` DATE NULL,
    `reason` VARCHAR(191) NOT NULL,
    `newReportingManagerId` VARCHAR(191) NULL,
    `remarks` VARCHAR(191) NULL,
    `submittedAt` DATETIME(3) NULL,
    `submittedById` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `approvedById` VARCHAR(191) NULL,
    `rejectedAt` DATETIME(3) NULL,
    `rejectedById` VARCHAR(191) NULL,
    `rejectionReason` VARCHAR(191) NULL,
    `completedAt` DATETIME(3) NULL,
    `completedById` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `updatedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `EmployeeTransfer_transferNumber_key`(`transferNumber`),
    INDEX `EmployeeTransfer_branchId_status_idx`(`branchId`, `status`),
    INDEX `EmployeeTransfer_employeeId_status_idx`(`employeeId`, `status`),
    INDEX `EmployeeTransfer_transferType_status_idx`(`transferType`, `status`),
    INDEX `EmployeeTransfer_effectiveDate_idx`(`effectiveDate`),
    INDEX `EmployeeTransfer_startDate_endDate_idx`(`startDate`, `endDate`),
    INDEX `EmployeeTransfer_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmployeeResignation` (
    `id` VARCHAR(191) NOT NULL,
    `resignationNumber` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `reportingManagerId` VARCHAR(191) NULL,
    `resignationType` ENUM('VOLUNTARY', 'MUTUAL', 'RETIREMENT') NOT NULL,
    `status` ENUM('DRAFT', 'PENDING_MANAGER_APPROVAL', 'PENDING_HR_APPROVAL', 'PENDING_ACCOUNTS_APPROVAL', 'PENDING_EXIT_CLEARANCE', 'COMPLETED', 'REJECTED', 'CANCELLED', 'WITHDRAWN') NOT NULL DEFAULT 'DRAFT',
    `currentDepartment` VARCHAR(191) NULL,
    `currentDesignation` VARCHAR(191) NULL,
    `currentEmploymentType` VARCHAR(191) NULL,
    `currentEmployeeStatus` VARCHAR(191) NULL,
    `joiningDate` DATE NULL,
    `confirmationDate` DATE NULL,
    `resignationDate` DATE NOT NULL,
    `lastWorkingDate` DATE NOT NULL,
    `noticeRequired` BOOLEAN NOT NULL DEFAULT true,
    `noticePeriodDays` INTEGER NOT NULL DEFAULT 0,
    `noticeServedDays` INTEGER NOT NULL DEFAULT 0,
    `noticeWaived` BOOLEAN NOT NULL DEFAULT false,
    `buyoutAmount` DECIMAL(18, 2) NULL,
    `reason` VARCHAR(191) NOT NULL,
    `employeeRemarks` VARCHAR(191) NULL,
    `attachmentUrl` VARCHAR(191) NULL,
    `managerPerformance` VARCHAR(191) NULL,
    `currentProjects` VARCHAR(191) NULL,
    `handoverStatus` VARCHAR(191) NULL,
    `replacementNeeded` BOOLEAN NULL,
    `assetsReturned` BOOLEAN NULL,
    `managerRecommendation` VARCHAR(191) NULL,
    `attendanceVerified` BOOLEAN NULL DEFAULT false,
    `leaveBalanceVerified` BOOLEAN NULL DEFAULT false,
    `noticePeriodVerified` BOOLEAN NULL DEFAULT false,
    `documentsVerified` BOOLEAN NULL DEFAULT false,
    `policyVerified` BOOLEAN NULL DEFAULT false,
    `pendingSalary` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `leaveEncashment` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `bonus` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `overtime` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `loanDeduction` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `advanceDeduction` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `taxDeduction` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `gratuity` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `finalPayable` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `settlementRequired` BOOLEAN NOT NULL DEFAULT false,
    `managerReviewStatus` ENUM('PENDING', 'APPROVED', 'REJECTED', 'SENT_BACK', 'HOLD', 'CORRECTION_REQUESTED') NOT NULL DEFAULT 'PENDING',
    `managerReviewDate` DATETIME(3) NULL,
    `managerRemarks` VARCHAR(191) NULL,
    `hrReviewStatus` ENUM('PENDING', 'APPROVED', 'REJECTED', 'SENT_BACK', 'HOLD', 'CORRECTION_REQUESTED') NOT NULL DEFAULT 'PENDING',
    `hrReviewDate` DATETIME(3) NULL,
    `hrRemarks` VARCHAR(191) NULL,
    `accountsReviewStatus` ENUM('PENDING', 'APPROVED', 'REJECTED', 'SENT_BACK', 'HOLD', 'CORRECTION_REQUESTED') NOT NULL DEFAULT 'PENDING',
    `accountsReviewDate` DATETIME(3) NULL,
    `accountsRemarks` VARCHAR(191) NULL,
    `acceptanceLetterGeneratedAt` DATETIME(3) NULL,
    `experienceLetterGeneratedAt` DATETIME(3) NULL,
    `relievingLetterGeneratedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `archivedAt` DATETIME(3) NULL,
    `createdById` VARCHAR(191) NULL,
    `updatedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `EmployeeResignation_resignationNumber_key`(`resignationNumber`),
    INDEX `EmployeeResignation_branchId_status_idx`(`branchId`, `status`),
    INDEX `EmployeeResignation_employeeId_status_idx`(`employeeId`, `status`),
    INDEX `EmployeeResignation_resignationType_status_idx`(`resignationType`, `status`),
    INDEX `EmployeeResignation_lastWorkingDate_idx`(`lastWorkingDate`),
    INDEX `EmployeeResignation_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmployeeExitClearance` (
    `id` VARCHAR(191) NOT NULL,
    `clearanceNumber` VARCHAR(191) NOT NULL,
    `resignationId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `exitType` ENUM('RESIGNATION', 'TERMINATION', 'RETIREMENT', 'END_OF_CONTRACT', 'DEATH') NOT NULL DEFAULT 'RESIGNATION',
    `status` ENUM('DRAFT', 'PENDING_DEPARTMENT_CLEARANCE', 'PENDING_ACCOUNTS_APPROVAL', 'PENDING_HR_APPROVAL', 'COMPLETED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `lastWorkingDate` DATE NOT NULL,
    `reasonForExit` VARCHAR(191) NULL,
    `noticePeriodServed` BOOLEAN NOT NULL DEFAULT false,
    `handoverCompleted` BOOLEAN NOT NULL DEFAULT false,
    `replacementAssigned` BOOLEAN NOT NULL DEFAULT false,
    `exitInterviewCompleted` BOOLEAN NOT NULL DEFAULT false,
    `hrRemarks` VARCHAR(191) NULL,
    `departmentClearedAt` DATETIME(3) NULL,
    `accountsApprovedAt` DATETIME(3) NULL,
    `hrApprovedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `clearanceCertificateGeneratedAt` DATETIME(3) NULL,
    `relievingLetterGeneratedAt` DATETIME(3) NULL,
    `experienceLetterGeneratedAt` DATETIME(3) NULL,
    `noDueCertificateGeneratedAt` DATETIME(3) NULL,
    `fullAndFinalGeneratedAt` DATETIME(3) NULL,
    `serviceCertificateGeneratedAt` DATETIME(3) NULL,
    `createdById` VARCHAR(191) NULL,
    `updatedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `EmployeeExitClearance_clearanceNumber_key`(`clearanceNumber`),
    UNIQUE INDEX `EmployeeExitClearance_resignationId_key`(`resignationId`),
    INDEX `EmployeeExitClearance_branchId_status_idx`(`branchId`, `status`),
    INDEX `EmployeeExitClearance_employeeId_status_idx`(`employeeId`, `status`),
    INDEX `EmployeeExitClearance_lastWorkingDate_status_idx`(`lastWorkingDate`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmployeeExitDepartmentClearance` (
    `id` VARCHAR(191) NOT NULL,
    `clearanceId` VARCHAR(191) NOT NULL,
    `departmentKey` VARCHAR(191) NOT NULL,
    `departmentName` VARCHAR(191) NOT NULL,
    `responsiblePerson` VARCHAR(191) NULL,
    `approverId` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'SENT_BACK', 'HOLD', 'NOT_REQUIRED') NOT NULL DEFAULT 'PENDING',
    `remarks` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EmployeeExitDepartmentClearance_clearanceId_status_idx`(`clearanceId`, `status`),
    UNIQUE INDEX `EmployeeExitDepartmentClearance_clearanceId_departmentKey_key`(`clearanceId`, `departmentKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmployeeExitAssetReturn` (
    `id` VARCHAR(191) NOT NULL,
    `clearanceId` VARCHAR(191) NOT NULL,
    `assetKey` VARCHAR(191) NOT NULL,
    `assetName` VARCHAR(191) NOT NULL,
    `returned` BOOLEAN NOT NULL DEFAULT false,
    `condition` ENUM('GOOD', 'DAMAGED', 'LOST') NOT NULL DEFAULT 'GOOD',
    `deductionAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `remarks` VARCHAR(191) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EmployeeExitAssetReturn_clearanceId_idx`(`clearanceId`),
    UNIQUE INDEX `EmployeeExitAssetReturn_clearanceId_assetKey_key`(`clearanceId`, `assetKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmployeeExitSystemAccess` (
    `id` VARCHAR(191) NOT NULL,
    `clearanceId` VARCHAR(191) NOT NULL,
    `erpAccountDisabled` BOOLEAN NOT NULL DEFAULT false,
    `emailDisabled` BOOLEAN NOT NULL DEFAULT false,
    `attendanceDeviceDisabled` BOOLEAN NOT NULL DEFAULT false,
    `vpnDisabled` BOOLEAN NOT NULL DEFAULT false,
    `fingerprintRemoved` BOOLEAN NOT NULL DEFAULT false,
    `doorAccessRemoved` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `EmployeeExitSystemAccess_clearanceId_key`(`clearanceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmployeeExitAccountsSettlement` (
    `id` VARCHAR(191) NOT NULL,
    `clearanceId` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'SENT_BACK', 'HOLD', 'NOT_REQUIRED') NOT NULL DEFAULT 'PENDING',
    `pendingSalary` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `leaveEncashment` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `bonus` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `overtime` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `loanRecovery` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `advanceRecovery` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `assetDamageRecovery` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `noticePay` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `gratuity` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `taxDeduction` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `otherDeduction` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `netPayable` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `approvedById` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `remarks` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `EmployeeExitAccountsSettlement_clearanceId_key`(`clearanceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmployeeExitInterview` (
    `id` VARCHAR(191) NOT NULL,
    `clearanceId` VARCHAR(191) NOT NULL,
    `reasonForLeaving` VARCHAR(191) NULL,
    `companyRating` INTEGER NULL,
    `managerRating` INTEGER NULL,
    `suggestions` VARCHAR(191) NULL,
    `rehireEligible` BOOLEAN NULL,
    `interviewConductedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `EmployeeExitInterview_clearanceId_key`(`clearanceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Contract` (
    `id` VARCHAR(191) NOT NULL,
    `contractNo` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NULL,
    `candidateId` VARCHAR(191) NULL,
    `offerId` VARCHAR(191) NULL,
    `candidateName` VARCHAR(191) NULL,
    `branchId` VARCHAR(191) NULL,
    `department` VARCHAR(191) NULL,
    `designation` VARCHAR(191) NULL,
    `contractType` VARCHAR(191) NOT NULL,
    `startDate` DATE NOT NULL,
    `endDate` DATE NULL,
    `basicSalary` DECIMAL(18, 2) NOT NULL,
    `allowances` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `shiftId` VARCHAR(191) NULL,
    `weeklyOff` VARCHAR(191) NOT NULL DEFAULT 'Friday',
    `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `attachmentUrl` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `updatedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Contract_contractNo_key`(`contractNo`),
    INDEX `Contract_employeeId_idx`(`employeeId`),
    INDEX `Contract_candidateId_idx`(`candidateId`),
    INDEX `Contract_offerId_idx`(`offerId`),
    INDEX `Contract_branchId_idx`(`branchId`),
    INDEX `Contract_status_idx`(`status`),
    INDEX `Contract_endDate_idx`(`endDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AttendanceRule` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NULL,
    `department` VARCHAR(191) NULL,
    `shiftId` VARCHAR(191) NULL,
    `graceLateEntryMinutes` INTEGER NOT NULL DEFAULT 15,
    `graceEarlyExitMinutes` INTEGER NOT NULL DEFAULT 15,
    `minWorkingHoursPresent` DECIMAL(5, 2) NOT NULL DEFAULT 6,
    `minWorkingHoursHalfDay` DECIMAL(5, 2) NOT NULL DEFAULT 4,
    `overtimeStartAfterMinutes` INTEGER NOT NULL DEFAULT 30,
    `minOvertimeMinutes` INTEGER NOT NULL DEFAULT 30,
    `allowMissingPunch` BOOLEAN NOT NULL DEFAULT false,
    `allowLatePunch` BOOLEAN NOT NULL DEFAULT false,
    `autoApproveOvertime` BOOLEAN NOT NULL DEFAULT false,
    `requireHrApproval` BOOLEAN NOT NULL DEFAULT false,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AttendanceException` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `missingType` ENUM('MISSING_IN', 'MISSING_OUT', 'BOTH_MISSING', 'INVALID_SEQUENCE', 'DUPLICATE_PUNCH') NULL,
    `actualTime` DATETIME(3) NULL,
    `expectedTime` DATETIME(3) NULL,
    `diffMinutes` INTEGER NOT NULL DEFAULT 0,
    `reason` VARCHAR(191) NULL,
    `attachment` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `approvedById` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AttendanceException_employeeId_date_idx`(`employeeId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AttendanceRecord` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `checkIn` DATETIME(3) NULL,
    `checkOut` DATETIME(3) NULL,
    `status` ENUM('PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'ON_LEAVE', 'HOLIDAY', 'WEEKEND', 'OFFICIAL_DUTY') NOT NULL DEFAULT 'PRESENT',
    `remarks` VARCHAR(191) NULL,
    `lateMinutes` INTEGER NOT NULL DEFAULT 0,
    `earlyExitMinutes` INTEGER NOT NULL DEFAULT 0,
    `workingMinutes` INTEGER NOT NULL DEFAULT 0,
    `overtimeMinutes` INTEGER NOT NULL DEFAULT 0,
    `isMissingPunch` BOOLEAN NOT NULL DEFAULT false,
    `isLateEntry` BOOLEAN NOT NULL DEFAULT false,
    `isEarlyExit` BOOLEAN NOT NULL DEFAULT false,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AttendanceRecord_date_idx`(`date`),
    UNIQUE INDEX `AttendanceRecord_employeeId_date_key`(`employeeId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OvertimeRecord` (
    `id` VARCHAR(191) NOT NULL,
    `otNumber` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `shiftId` VARCHAR(191) NULL,
    `otDate` DATE NOT NULL,
    `otMonth` VARCHAR(191) NOT NULL,
    `otType` ENUM('REGULAR', 'HOLIDAY', 'WEEKEND', 'NIGHT', 'EMERGENCY', 'PRODUCTION') NOT NULL DEFAULT 'REGULAR',
    `source` ENUM('ATTENDANCE_BASED', 'MANUAL_ENTRY', 'DEVICE_IMPORT') NOT NULL DEFAULT 'ATTENDANCE_BASED',
    `status` ENUM('DRAFT', 'PENDING_MANAGER', 'PENDING_HR', 'PENDING_ACCOUNTS', 'APPROVED', 'POSTED_TO_PAYROLL', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `attendanceDate` DATE NOT NULL,
    `checkIn` DATETIME(3) NULL,
    `checkOut` DATETIME(3) NULL,
    `totalWorkedMinutes` INTEGER NOT NULL DEFAULT 0,
    `regularDutyMinutes` INTEGER NOT NULL DEFAULT 0,
    `breakMinutes` INTEGER NOT NULL DEFAULT 0,
    `extraWorkedMinutes` INTEGER NOT NULL DEFAULT 0,
    `lateMinutes` INTEGER NOT NULL DEFAULT 0,
    `earlyExitMinutes` INTEGER NOT NULL DEFAULT 0,
    `eligibleOtMinutes` INTEGER NOT NULL DEFAULT 0,
    `approvedOtMinutes` INTEGER NOT NULL DEFAULT 0,
    `otRateType` ENUM('FIXED_RATE', 'BASIC_SALARY_BASED', 'GROSS_SALARY_BASED', 'MANUAL_RATE') NOT NULL DEFAULT 'FIXED_RATE',
    `otRatePerHour` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `otAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `roundOtHours` BOOLEAN NOT NULL DEFAULT false,
    `minOtMinutes` INTEGER NOT NULL DEFAULT 0,
    `remarks` VARCHAR(191) NULL,
    `managerStatus` VARCHAR(191) NULL,
    `managerOtMinutes` INTEGER NULL,
    `managerRemarks` VARCHAR(191) NULL,
    `managerApprovedById` VARCHAR(191) NULL,
    `managerApprovedAt` DATETIME(3) NULL,
    `hrStatus` VARCHAR(191) NULL,
    `hrVerifiedMinutes` INTEGER NULL,
    `hrRemarks` VARCHAR(191) NULL,
    `hrVerifiedById` VARCHAR(191) NULL,
    `hrVerifiedAt` DATETIME(3) NULL,
    `accountsStatus` VARCHAR(191) NULL,
    `accountsOtRate` DECIMAL(18, 2) NULL,
    `accountsOtAmount` DECIMAL(18, 2) NULL,
    `payrollMonth` VARCHAR(191) NULL,
    `costCenter` VARCHAR(191) NULL,
    `accountsRemarks` VARCHAR(191) NULL,
    `accountsApprovedById` VARCHAR(191) NULL,
    `accountsApprovedAt` DATETIME(3) NULL,
    `postedToPayroll` BOOLEAN NOT NULL DEFAULT false,
    `postedAt` DATETIME(3) NULL,
    `postedById` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `updatedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `OvertimeRecord_otNumber_key`(`otNumber`),
    INDEX `OvertimeRecord_branchId_status_idx`(`branchId`, `status`),
    INDEX `OvertimeRecord_employeeId_otDate_idx`(`employeeId`, `otDate`),
    INDEX `OvertimeRecord_otMonth_status_idx`(`otMonth`, `status`),
    INDEX `OvertimeRecord_status_idx`(`status`),
    INDEX `OvertimeRecord_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AttendanceAdjustment` (
    `id` VARCHAR(191) NOT NULL,
    `adjustmentNumber` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `attendanceDate` DATE NOT NULL,
    `adjustmentType` ENUM('MISSING_CHECK_IN', 'MISSING_CHECK_OUT', 'WRONG_PUNCH', 'MANUAL_ATTENDANCE', 'SHIFT_CHANGE', 'OFFICIAL_DUTY', 'FIELD_WORK', 'HOLIDAY_WORK', 'OT_CORRECTION') NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `remarks` VARCHAR(191) NULL,
    `attachmentUrl` VARCHAR(191) NULL,
    `adjustedById` VARCHAR(191) NOT NULL,
    `adjustedAt` DATETIME(3) NULL,
    `status` ENUM('DRAFT', 'UPDATED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `oldShiftId` VARCHAR(191) NULL,
    `newShiftId` VARCHAR(191) NULL,
    `oldCheckIn` DATETIME(3) NULL,
    `oldCheckOut` DATETIME(3) NULL,
    `oldStatus` ENUM('PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'ON_LEAVE', 'HOLIDAY', 'WEEKEND', 'OFFICIAL_DUTY') NOT NULL,
    `oldWorkingMinutes` INTEGER NOT NULL DEFAULT 0,
    `oldOtMinutes` INTEGER NOT NULL DEFAULT 0,
    `oldLateMinutes` INTEGER NOT NULL DEFAULT 0,
    `oldEarlyMinutes` INTEGER NOT NULL DEFAULT 0,
    `newCheckIn` DATETIME(3) NULL,
    `newCheckOut` DATETIME(3) NULL,
    `newStatus` ENUM('PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'ON_LEAVE', 'HOLIDAY', 'WEEKEND', 'OFFICIAL_DUTY') NOT NULL,
    `newWorkingMinutes` INTEGER NOT NULL DEFAULT 0,
    `newOtMinutes` INTEGER NOT NULL DEFAULT 0,
    `newLateMinutes` INTEGER NOT NULL DEFAULT 0,
    `newEarlyMinutes` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AttendanceAdjustment_adjustmentNumber_key`(`adjustmentNumber`),
    INDEX `AttendanceAdjustment_branchId_status_idx`(`branchId`, `status`),
    INDEX `AttendanceAdjustment_employeeId_attendanceDate_idx`(`employeeId`, `attendanceDate`),
    INDEX `AttendanceAdjustment_attendanceDate_status_idx`(`attendanceDate`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeaveRequest` (
    `id` VARCHAR(191) NOT NULL,
    `leaveRequestNo` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `fromDate` DATE NOT NULL,
    `toDate` DATE NOT NULL,
    `days` DECIMAL(18, 2) NOT NULL,
    `halfDay` BOOLEAN NOT NULL DEFAULT false,
    `halfDayType` VARCHAR(191) NULL,
    `reason` VARCHAR(191) NOT NULL,
    `attachmentPath` VARCHAR(191) NULL,
    `emergencyContact` VARCHAR(191) NULL,
    `handoverEmployeeId` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'PENDING_MANAGER', 'PENDING_HR', 'APPROVED', 'REJECTED', 'RETURNED', 'CANCELLED', 'WITHDRAWN') NOT NULL DEFAULT 'PENDING_MANAGER',
    `managerStatus` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `managerRemarks` VARCHAR(191) NULL,
    `managerId` VARCHAR(191) NULL,
    `managerApprovedAt` DATETIME(3) NULL,
    `hrStatus` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `hrRemarks` VARCHAR(191) NULL,
    `hrId` VARCHAR(191) NULL,
    `hrApprovedAt` DATETIME(3) NULL,
    `decidedById` VARCHAR(191) NULL,
    `decidedAt` DATETIME(3) NULL,
    `decisionNote` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `LeaveRequest_leaveRequestNo_key`(`leaveRequestNo`),
    INDEX `LeaveRequest_employeeId_status_idx`(`employeeId`, `status`),
    INDEX `LeaveRequest_fromDate_toDate_idx`(`fromDate`, `toDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeaveType` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `paidLeave` BOOLEAN NOT NULL DEFAULT true,
    `annualEntitlement` DECIMAL(18, 2) NULL,
    `maxConsecutiveDays` DECIMAL(18, 2) NULL,
    `minimumLeaveDays` DECIMAL(18, 2) NULL,
    `applyBeforeDays` INTEGER NULL,
    `unit` VARCHAR(191) NOT NULL DEFAULT 'FULL_DAY',
    `applicableEmploymentTypes` JSON NULL,
    `genderApplicability` VARCHAR(191) NOT NULL DEFAULT 'ALL',
    `applicableDepartment` VARCHAR(191) NULL,
    `applicableDesignation` VARCHAR(191) NULL,
    `applicableBranchId` VARCHAR(191) NULL,
    `attachmentRequired` BOOLEAN NOT NULL DEFAULT false,
    `medicalCertificateRequired` BOOLEAN NOT NULL DEFAULT false,
    `allowHalfDay` BOOLEAN NOT NULL DEFAULT false,
    `allowBackdatedApplication` BOOLEAN NOT NULL DEFAULT false,
    `allowFutureApplication` BOOLEAN NOT NULL DEFAULT true,
    `approvalRequired` BOOLEAN NOT NULL DEFAULT true,
    `autoApprove` BOOLEAN NOT NULL DEFAULT false,
    `holidayIncluded` BOOLEAN NOT NULL DEFAULT false,
    `weekendIncluded` BOOLEAN NOT NULL DEFAULT false,
    `carryForwardAllowed` BOOLEAN NOT NULL DEFAULT false,
    `maximumCarryForwardDays` DECIMAL(18, 2) NULL,
    `carryForwardExpiryMonths` INTEGER NULL,
    `requiredAttachmentTypes` JSON NULL,
    `allowNegativeBalance` BOOLEAN NOT NULL DEFAULT false,
    `displayOrder` INTEGER NOT NULL DEFAULT 0,
    `createdById` VARCHAR(191) NULL,
    `updatedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `LeaveType_code_key`(`code`),
    INDEX `LeaveType_status_displayOrder_idx`(`status`, `displayOrder`),
    INDEX `LeaveType_applicableBranchId_status_idx`(`applicableBranchId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeavePolicy` (
    `id` VARCHAR(191) NOT NULL,
    `policyCode` VARCHAR(191) NOT NULL,
    `policyName` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NULL,
    `department` VARCHAR(191) NULL,
    `designation` VARCHAR(191) NULL,
    `employmentType` VARCHAR(191) NULL,
    `employeeCategory` VARCHAR(191) NULL,
    `gender` VARCHAR(191) NULL,
    `grade` VARCHAR(191) NULL,
    `effectiveFrom` DATE NOT NULL,
    `effectiveTo` DATE NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `description` VARCHAR(191) NULL,
    `approvalRequired` BOOLEAN NOT NULL DEFAULT true,
    `managerApprovalRequired` BOOLEAN NOT NULL DEFAULT true,
    `hrApprovalRequired` BOOLEAN NOT NULL DEFAULT true,
    `accountsApprovalRequired` BOOLEAN NOT NULL DEFAULT false,
    `autoApproveAllowed` BOOLEAN NOT NULL DEFAULT false,
    `hrCanOverrideBalance` BOOLEAN NOT NULL DEFAULT true,
    `allowProbationEmployees` BOOLEAN NOT NULL DEFAULT false,
    `carryForwardAllowed` BOOLEAN NOT NULL DEFAULT false,
    `maxCarryForwardDays` DECIMAL(18, 2) NULL,
    `carryForwardExpiryMonth` INTEGER NULL,
    `carryForwardExpiryDay` INTEGER NULL,
    `autoClosing` BOOLEAN NOT NULL DEFAULT false,
    `payrollImpactDefault` VARCHAR(191) NOT NULL DEFAULT 'NO_PAYROLL_IMPACT',
    `createdById` VARCHAR(191) NULL,
    `updatedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `LeavePolicy_policyCode_key`(`policyCode`),
    INDEX `LeavePolicy_branchId_status_idx`(`branchId`, `status`),
    INDEX `LeavePolicy_employmentType_status_idx`(`employmentType`, `status`),
    INDEX `LeavePolicy_effectiveFrom_effectiveTo_idx`(`effectiveFrom`, `effectiveTo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeavePolicyRule` (
    `id` VARCHAR(191) NOT NULL,
    `policyId` VARCHAR(191) NOT NULL,
    `leaveType` VARCHAR(191) NOT NULL,
    `leaveCode` VARCHAR(191) NOT NULL,
    `paidLeave` BOOLEAN NOT NULL DEFAULT true,
    `entitledDays` DECIMAL(18, 2) NULL,
    `isUnlimited` BOOLEAN NOT NULL DEFAULT false,
    `accrualMethod` VARCHAR(191) NOT NULL,
    `minimumServiceMonths` INTEGER NULL,
    `maxLeavePerRequest` DECIMAL(18, 2) NULL,
    `maxLeavePerMonth` DECIMAL(18, 2) NULL,
    `halfDayAllowed` BOOLEAN NOT NULL DEFAULT false,
    `attachmentRequired` BOOLEAN NOT NULL DEFAULT false,
    `reasonRequired` BOOLEAN NOT NULL DEFAULT true,
    `allowNegativeBalance` BOOLEAN NOT NULL DEFAULT false,
    `includeWeekend` BOOLEAN NOT NULL DEFAULT false,
    `includeHoliday` BOOLEAN NOT NULL DEFAULT false,
    `sandwichRuleApplicable` BOOLEAN NOT NULL DEFAULT false,
    `carryForwardAllowed` BOOLEAN NOT NULL DEFAULT false,
    `maxCarryForwardDays` DECIMAL(18, 2) NULL,
    `payrollImpact` VARCHAR(191) NOT NULL DEFAULT 'NO_PAYROLL_IMPACT',
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `LeavePolicyRule_policyId_status_idx`(`policyId`, `status`),
    UNIQUE INDEX `LeavePolicyRule_policyId_leaveType_key`(`policyId`, `leaveType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmployeeLeavePolicy` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `policyId` VARCHAR(191) NOT NULL,
    `assignedDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EmployeeLeavePolicy_employeeId_status_idx`(`employeeId`, `status`),
    INDEX `EmployeeLeavePolicy_policyId_status_idx`(`policyId`, `status`),
    UNIQUE INDEX `EmployeeLeavePolicy_employeeId_policyId_key`(`employeeId`, `policyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeaveBalanceAdjustment` (
    `id` VARCHAR(191) NOT NULL,
    `adjustmentNo` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `leaveType` VARCHAR(191) NOT NULL,
    `leaveYear` INTEGER NOT NULL,
    `adjustmentType` VARCHAR(191) NOT NULL,
    `days` DECIMAL(18, 2) NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `attachmentPath` VARCHAR(191) NULL,
    `effectiveDate` DATE NOT NULL,
    `adjustedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `LeaveBalanceAdjustment_adjustmentNo_key`(`adjustmentNo`),
    INDEX `LeaveBalanceAdjustment_employeeId_leaveYear_leaveType_idx`(`employeeId`, `leaveYear`, `leaveType`),
    INDEX `LeaveBalanceAdjustment_leaveYear_leaveType_idx`(`leaveYear`, `leaveType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AttendanceSummaryRecord` (
    `id` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `summaryMonth` VARCHAR(191) NOT NULL,
    `totalCalendarDays` INTEGER NOT NULL DEFAULT 0,
    `weeklyOffDays` INTEGER NOT NULL DEFAULT 0,
    `holidayDays` INTEGER NOT NULL DEFAULT 0,
    `workingDays` INTEGER NOT NULL DEFAULT 0,
    `presentDays` INTEGER NOT NULL DEFAULT 0,
    `absentDays` INTEGER NOT NULL DEFAULT 0,
    `leaveDays` INTEGER NOT NULL DEFAULT 0,
    `halfDays` INTEGER NOT NULL DEFAULT 0,
    `lateDays` INTEGER NOT NULL DEFAULT 0,
    `earlyExitDays` INTEGER NOT NULL DEFAULT 0,
    `totalWorkedHours` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `totalOtHours` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `payableDays` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `status` ENUM('GENERATED', 'UNDER_REVIEW', 'ADJUSTMENT_REQUIRED', 'READY_FOR_PAYROLL', 'LOCKED', 'SENT_TO_PAYROLL', 'PAYROLL_PROCESSED', 'CANCELLED') NOT NULL DEFAULT 'GENERATED',
    `payrollMonth` VARCHAR(191) NULL,
    `isPayrollReady` BOOLEAN NOT NULL DEFAULT false,
    `isLocked` BOOLEAN NOT NULL DEFAULT false,
    `sentToPayroll` BOOLEAN NOT NULL DEFAULT false,
    `sentById` VARCHAR(191) NULL,
    `sentAt` DATETIME(3) NULL,
    `payrollProcessed` BOOLEAN NOT NULL DEFAULT false,
    `remarks` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `updatedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AttendanceSummaryRecord_branchId_summaryMonth_idx`(`branchId`, `summaryMonth`),
    INDEX `AttendanceSummaryRecord_status_idx`(`status`),
    UNIQUE INDEX `AttendanceSummaryRecord_employeeId_summaryMonth_key`(`employeeId`, `summaryMonth`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PayrollRun` (
    `id` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `period` VARCHAR(191) NOT NULL,
    `payrollPeriodId` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'PREPARING', 'CALCULATED', 'PENDING_HR', 'PENDING_FINANCE', 'PENDING_MANAGEMENT', 'APPROVED', 'PAID', 'COMPLETED', 'CLOSED', 'LOCKED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `notes` VARCHAR(191) NULL,
    `totalEmployees` INTEGER NOT NULL DEFAULT 0,
    `totalGross` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `totalDeduction` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `totalNet` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `totalOT` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `totalBonus` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `totalLoan` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `totalAdvance` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `totalTax` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `journalEntryId` VARCHAR(191) NULL,
    `hrApproval` VARCHAR(191) NULL,
    `financeApproval` VARCHAR(191) NULL,
    `managementApproval` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `approvedById` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `paidById` VARCHAR(191) NULL,
    `paidAt` DATETIME(3) NULL,
    `lockedById` VARCHAR(191) NULL,
    `lockedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PayrollRun_journalEntryId_key`(`journalEntryId`),
    INDEX `PayrollRun_status_idx`(`status`),
    UNIQUE INDEX `PayrollRun_branchId_period_key`(`branchId`, `period`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payslip` (
    `id` VARCHAR(191) NOT NULL,
    `no` VARCHAR(191) NULL,
    `payrollRunId` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `status` ENUM('GENERATED', 'PUBLISHED', 'CANCELLED') NOT NULL DEFAULT 'GENERATED',
    `paymentStatus` ENUM('PENDING', 'PAID', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `paymentMethod` VARCHAR(191) NULL,
    `bankName` VARCHAR(191) NULL,
    `bankAccount` VARCHAR(191) NULL,
    `paymentDate` DATETIME(3) NULL,
    `transactionRef` VARCHAR(191) NULL,
    `workedDays` INTEGER NOT NULL,
    `leaveDays` INTEGER NOT NULL DEFAULT 0,
    `absentDays` INTEGER NOT NULL DEFAULT 0,
    `basic` DECIMAL(18, 2) NOT NULL,
    `houseAllowance` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `transportAllowance` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `medicalAllowance` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `otherAllowance` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `attendanceBonus` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `overtimeAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `bonus` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `payrollAdjustmentsAddition` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `providentFund` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `taxDeduction` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `loanDeduction` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `advanceDeduction` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `lateDeduction` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `absentDeduction` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `payrollAdjustmentsDeduction` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `otherDeduction` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `gross` DECIMAL(18, 2) NOT NULL,
    `net` DECIMAL(18, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Payslip_no_key`(`no`),
    INDEX `Payslip_employeeId_idx`(`employeeId`),
    UNIQUE INDEX `Payslip_payrollRunId_employeeId_key`(`payrollRunId`, `employeeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TradeOrder` (
    `id` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `type` ENUM('EXPORT', 'IMPORT') NOT NULL,
    `status` ENUM('DRAFT', 'CONFIRMED', 'IN_PRODUCTION', 'READY_TO_SHIP', 'SHIPPED', 'AT_CUSTOMS', 'DELIVERED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `customerId` VARCHAR(191) NULL,
    `supplierId` VARCHAR(191) NULL,
    `contractRef` VARCHAR(191) NULL,
    `currency` ENUM('BDT', 'INR', 'USD', 'EUR') NOT NULL DEFAULT 'USD',
    `totalValue` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `exchangeRate` DECIMAL(18, 6) NOT NULL DEFAULT 1,
    `localValue` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `portOfLoading` VARCHAR(191) NULL,
    `portOfDischarge` VARCHAR(191) NULL,
    `incoterms` VARCHAR(191) NULL,
    `latestShipDate` DATE NULL,
    `expectedArrival` DATE NULL,
    `goodsDescription` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `updatedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TradeOrder_number_key`(`number`),
    INDEX `TradeOrder_branchId_status_idx`(`branchId`, `status`),
    INDEX `TradeOrder_branchId_type_idx`(`branchId`, `type`),
    INDEX `TradeOrder_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TradeOrderItem` (
    `id` VARCHAR(191) NOT NULL,
    `tradeOrderId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NULL,
    `description` VARCHAR(191) NOT NULL,
    `hsCode` VARCHAR(191) NULL,
    `quantity` DECIMAL(18, 4) NOT NULL,
    `unit` VARCHAR(191) NOT NULL DEFAULT 'PCS',
    `unitPrice` DECIMAL(18, 4) NOT NULL,
    `lineTotal` DECIMAL(18, 4) NOT NULL,

    INDEX `TradeOrderItem_tradeOrderId_idx`(`tradeOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TradeShipment` (
    `id` VARCHAR(191) NOT NULL,
    `tradeOrderId` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'BOOKING_CONFIRMED', 'IN_TRANSIT', 'AT_PORT', 'CUSTOMS_CLEARANCE', 'DELIVERED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `sequence` INTEGER NOT NULL DEFAULT 1,
    `carrierName` VARCHAR(191) NULL,
    `vesselName` VARCHAR(191) NULL,
    `voyageNumber` VARCHAR(191) NULL,
    `blNumber` VARCHAR(191) NULL,
    `blDate` DATE NULL,
    `bookingRef` VARCHAR(191) NULL,
    `portOfLoading` VARCHAR(191) NULL,
    `portOfDischarge` VARCHAR(191) NULL,
    `etd` DATE NULL,
    `eta` DATE NULL,
    `actualDeparture` DATE NULL,
    `actualArrival` DATE NULL,
    `containerNumbers` VARCHAR(191) NULL,
    `sealNumbers` VARCHAR(191) NULL,
    `grossWeight` DECIMAL(18, 4) NULL,
    `netWeight` DECIMAL(18, 4) NULL,
    `volume` DECIMAL(18, 4) NULL,
    `packages` INTEGER NULL,
    `freightCost` DECIMAL(18, 4) NULL,
    `insuranceCost` DECIMAL(18, 4) NULL,
    `notes` VARCHAR(191) NULL,
    `customsClearedAt` DATETIME(3) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TradeShipment_tradeOrderId_status_idx`(`tradeOrderId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LetterOfCredit` (
    `id` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `tradeOrderId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `type` ENUM('SIGHT', 'USANCE', 'RED_CLAUSE', 'REVOLVING', 'STANDBY', 'TRANSFERABLE') NOT NULL DEFAULT 'SIGHT',
    `status` ENUM('DRAFT', 'ISSUED', 'ADVISED', 'CONFIRMED', 'ACTIVE', 'AMENDED', 'PARTIALLY_UTILIZED', 'FULLY_UTILIZED', 'EXPIRED', 'CLOSED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `paymentMode` ENUM('AT_SIGHT', 'USANCE_30', 'USANCE_60', 'USANCE_90', 'USANCE_120', 'USANCE_180', 'DEFERRED') NOT NULL DEFAULT 'AT_SIGHT',
    `applicantName` VARCHAR(191) NOT NULL,
    `beneficiaryName` VARCHAR(191) NOT NULL,
    `issuingBank` VARCHAR(191) NOT NULL,
    `issuingBankSwift` VARCHAR(191) NULL,
    `advisingBank` VARCHAR(191) NULL,
    `advisingBankSwift` VARCHAR(191) NULL,
    `confirmingBank` VARCHAR(191) NULL,
    `currency` ENUM('BDT', 'INR', 'USD', 'EUR') NOT NULL DEFAULT 'USD',
    `lcAmount` DECIMAL(18, 4) NOT NULL,
    `tolerancePlus` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `toleranceMinus` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `utilizedAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `availableAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `issueDate` DATE NOT NULL,
    `expiryDate` DATE NOT NULL,
    `expiryPlace` VARCHAR(191) NULL,
    `latestShipDate` DATE NULL,
    `presentationDays` INTEGER NOT NULL DEFAULT 21,
    `partialShipment` BOOLEAN NOT NULL DEFAULT false,
    `transhipmentAllowed` BOOLEAN NOT NULL DEFAULT false,
    `portOfLoading` VARCHAR(191) NULL,
    `portOfDischarge` VARCHAR(191) NULL,
    `airPortOfLoading` VARCHAR(191) NULL,
    `airPortOfDestination` VARCHAR(191) NULL,
    `flightNumber` VARCHAR(191) NULL,
    `airlineName` VARCHAR(191) NULL,
    `shipPortOfLoading` VARCHAR(191) NULL,
    `shipPortOfDischarge` VARCHAR(191) NULL,
    `vesselName` VARCHAR(191) NULL,
    `voyageNumber` VARCHAR(191) NULL,
    `goodsDescription` VARCHAR(191) NULL,
    `specialConditions` VARCHAR(191) NULL,
    `swiftMt700Ref` VARCHAR(191) NULL,
    `issuedById` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `updatedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `LetterOfCredit_number_key`(`number`),
    UNIQUE INDEX `LetterOfCredit_tradeOrderId_key`(`tradeOrderId`),
    INDEX `LetterOfCredit_branchId_status_idx`(`branchId`, `status`),
    INDEX `LetterOfCredit_expiryDate_idx`(`expiryDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LCAmendment` (
    `id` VARCHAR(191) NOT NULL,
    `lcId` VARCHAR(191) NOT NULL,
    `amendmentNumber` INTEGER NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'CHANGES_REQUESTED', 'ESCALATED') NOT NULL DEFAULT 'PENDING',
    `newExpiryDate` DATE NULL,
    `newLcAmount` DECIMAL(18, 4) NULL,
    `newLatestShipDate` DATE NULL,
    `newSpecialConditions` VARCHAR(191) NULL,
    `reason` VARCHAR(191) NOT NULL,
    `requestedById` VARCHAR(191) NULL,
    `approvedById` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `rejectedById` VARCHAR(191) NULL,
    `rejectionNote` VARCHAR(191) NULL,
    `swiftMt707Ref` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `LCAmendment_lcId_status_idx`(`lcId`, `status`),
    UNIQUE INDEX `LCAmendment_lcId_amendmentNumber_key`(`lcId`, `amendmentNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LCDrawdown` (
    `id` VARCHAR(191) NOT NULL,
    `lcId` VARCHAR(191) NOT NULL,
    `drawdownNumber` INTEGER NOT NULL,
    `status` ENUM('DRAFT', 'DOCUMENTS_SUBMITTED', 'DOCUMENTS_ACCEPTED', 'PAYMENT_RECEIVED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `presentationDate` DATE NOT NULL,
    `documentsDueBy` DATE NULL,
    `amount` DECIMAL(18, 4) NOT NULL,
    `commercialInvoiceRef` VARCHAR(191) NULL,
    `blRef` VARCHAR(191) NULL,
    `packingListRef` VARCHAR(191) NULL,
    `certificateOfOrigin` BOOLEAN NOT NULL DEFAULT false,
    `inspectionCert` BOOLEAN NOT NULL DEFAULT false,
    `otherDocs` VARCHAR(191) NULL,
    `paymentDueDate` DATE NULL,
    `paymentReceivedAt` DATE NULL,
    `bankCharges` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `notes` VARCHAR(191) NULL,
    `discrepancyNote` VARCHAR(191) NULL,
    `rejectionReason` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `updatedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `LCDrawdown_lcId_status_idx`(`lcId`, `status`),
    UNIQUE INDEX `LCDrawdown_lcId_drawdownNumber_key`(`lcId`, `drawdownNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TradePayment` (
    `id` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `tradeOrderId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'PARTIALLY_PAID', 'PAID', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `currency` ENUM('BDT', 'INR', 'USD', 'EUR') NOT NULL DEFAULT 'USD',
    `amount` DECIMAL(18, 4) NOT NULL,
    `exchangeRate` DECIMAL(18, 6) NOT NULL,
    `localAmount` DECIMAL(18, 4) NOT NULL,
    `bankName` VARCHAR(191) NULL,
    `bankReference` VARCHAR(191) NULL,
    `swiftRef` VARCHAR(191) NULL,
    `paymentDate` DATE NULL,
    `valueDate` DATE NULL,
    `notes` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TradePayment_number_key`(`number`),
    INDEX `TradePayment_tradeOrderId_idx`(`tradeOrderId`),
    INDEX `TradePayment_branchId_status_idx`(`branchId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CashTransfer` (
    `id` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `fromBranchId` VARCHAR(191) NOT NULL,
    `toBranchId` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(18, 4) NOT NULL,
    `transferDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `transferVia` VARCHAR(191) NULL,
    `reference` VARCHAR(191) NULL,
    `remarks` VARCHAR(191) NOT NULL,
    `imageUrl` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CashTransfer_number_key`(`number`),
    INDEX `CashTransfer_fromBranchId_transferDate_idx`(`fromBranchId`, `transferDate`),
    INDEX `CashTransfer_toBranchId_transferDate_idx`(`toBranchId`, `transferDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CashEntry` (
    `id` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `type` ENUM('CASH_IN', 'CASH_OUT') NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `amount` DECIMAL(18, 4) NOT NULL,
    `taxPercent` DECIMAL(5, 2) NULL,
    `taxAmount` DECIMAL(18, 4) NULL,
    `totalAmount` DECIMAL(18, 4) NOT NULL,
    `contactId` VARCHAR(191) NULL,
    `contactName` VARCHAR(191) NULL,
    `contactType` VARCHAR(191) NULL,
    `receiveMode` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NULL,
    `projectName` VARCHAR(191) NULL,
    `remarks` VARCHAR(191) NULL,
    `imageUrl` VARCHAR(191) NULL,
    `sourceModule` VARCHAR(191) NULL,
    `sourceRefType` VARCHAR(191) NULL,
    `sourceRefId` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CashEntry_number_key`(`number`),
    INDEX `CashEntry_branchId_date_idx`(`branchId`, `date`),
    INDEX `CashEntry_type_branchId_idx`(`type`, `branchId`),
    INDEX `CashEntry_contactId_idx`(`contactId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SalaryComponent` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `category` ENUM('EARNINGS', 'DEDUCTION') NOT NULL,
    `type` ENUM('FIXED', 'VARIABLE') NOT NULL,
    `calculationType` ENUM('FIXED_AMOUNT', 'PERCENTAGE', 'FORMULA', 'MANUAL_ENTRY') NOT NULL,
    `value` DECIMAL(18, 4) NULL,
    `formula` VARCHAR(191) NULL,
    `baseComponent` VARCHAR(191) NULL,
    `isTaxable` BOOLEAN NOT NULL DEFAULT true,
    `includeInGross` BOOLEAN NOT NULL DEFAULT true,
    `includeInNet` BOOLEAN NOT NULL DEFAULT true,
    `showInPayslip` BOOLEAN NOT NULL DEFAULT true,
    `isSystemGenerated` BOOLEAN NOT NULL DEFAULT false,
    `isMandatory` BOOLEAN NOT NULL DEFAULT false,
    `isEditableDuringPayroll` BOOLEAN NOT NULL DEFAULT false,
    `allowNegativeValue` BOOLEAN NOT NULL DEFAULT false,
    `maxAmount` DECIMAL(18, 4) NULL,
    `minAmount` DECIMAL(18, 4) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SalaryComponent_code_key`(`code`),
    INDEX `SalaryComponent_category_idx`(`category`),
    INDEX `SalaryComponent_type_idx`(`type`),
    INDEX `SalaryComponent_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SalaryComponentApplicability` (
    `id` VARCHAR(191) NOT NULL,
    `componentId` VARCHAR(191) NOT NULL,
    `kind` ENUM('EMPLOYMENT_TYPE', 'DEPARTMENT', 'DESIGNATION') NOT NULL,
    `value` VARCHAR(191) NOT NULL,

    INDEX `SalaryComponentApplicability_componentId_idx`(`componentId`),
    UNIQUE INDEX `SalaryComponentApplicability_componentId_kind_value_key`(`componentId`, `kind`, `value`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SalaryStructure` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `grossSalary` DECIMAL(18, 4) NOT NULL,
    `netSalary` DECIMAL(18, 4) NULL,
    `effectiveFrom` DATE NOT NULL,
    `effectiveTo` DATE NULL,
    `payrollFrequency` ENUM('MONTHLY', 'WEEKLY', 'DAILY', 'HOURLY') NOT NULL DEFAULT 'MONTHLY',
    `currency` ENUM('BDT', 'INR', 'USD', 'EUR') NOT NULL DEFAULT 'BDT',
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SalaryStructure_code_key`(`code`),
    INDEX `SalaryStructure_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SalaryStructureApplicability` (
    `id` VARCHAR(191) NOT NULL,
    `salaryStructureId` VARCHAR(191) NOT NULL,
    `kind` ENUM('EMPLOYMENT_TYPE', 'DEPARTMENT', 'DESIGNATION', 'BRANCH') NOT NULL,
    `value` VARCHAR(191) NOT NULL,

    INDEX `SalaryStructureApplicability_salaryStructureId_idx`(`salaryStructureId`),
    UNIQUE INDEX `SalaryStructureApplicability_salaryStructureId_kind_value_key`(`salaryStructureId`, `kind`, `value`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SalaryStructureComponent` (
    `id` VARCHAR(191) NOT NULL,
    `salaryStructureId` VARCHAR(191) NOT NULL,
    `salaryComponentId` VARCHAR(191) NOT NULL,
    `value` DECIMAL(18, 4) NOT NULL,
    `isAutoCalculated` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SalaryStructureComponent_salaryStructureId_salaryComponentId_key`(`salaryStructureId`, `salaryComponentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmployeeSalaryStructureAssignment` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `salaryStructureId` VARCHAR(191) NOT NULL,
    `effectiveFrom` DATE NOT NULL,
    `effectiveTo` DATE NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EmployeeSalaryStructureAssignment_employeeId_idx`(`employeeId`),
    INDEX `EmployeeSalaryStructureAssignment_salaryStructureId_idx`(`salaryStructureId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PayrollPeriod` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `month` INTEGER NOT NULL,
    `year` INTEGER NOT NULL,
    `startDate` DATE NOT NULL,
    `endDate` DATE NOT NULL,
    `processingDate` DATE NULL,
    `paymentDate` DATE NULL,
    `attendanceCutoffDate` DATE NULL,
    `overtimeCutoffDate` DATE NULL,
    `leaveCutoffDate` DATE NULL,
    `includeAttendance` BOOLEAN NOT NULL DEFAULT true,
    `includeLeave` BOOLEAN NOT NULL DEFAULT true,
    `includeOvertime` BOOLEAN NOT NULL DEFAULT true,
    `includeBonus` BOOLEAN NOT NULL DEFAULT true,
    `includeLoanDeduction` BOOLEAN NOT NULL DEFAULT true,
    `includeSalaryAdvance` BOOLEAN NOT NULL DEFAULT true,
    `includeTax` BOOLEAN NOT NULL DEFAULT true,
    `allowReprocessing` BOOLEAN NOT NULL DEFAULT false,
    `autoCloseAfterPayroll` BOOLEAN NOT NULL DEFAULT true,
    `lockPayrollAfterClosing` BOOLEAN NOT NULL DEFAULT true,
    `status` ENUM('DRAFT', 'OPEN', 'CLOSED') NOT NULL DEFAULT 'DRAFT',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PayrollPeriod_code_key`(`code`),
    INDEX `PayrollPeriod_status_idx`(`status`),
    UNIQUE INDEX `PayrollPeriod_month_year_key`(`month`, `year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LoanRequest` (
    `id` VARCHAR(191) NOT NULL,
    `referenceNo` VARCHAR(191) NOT NULL,
    `requestType` ENUM('EMPLOYEE_LOAN', 'SALARY_ADVANCE') NOT NULL DEFAULT 'EMPLOYEE_LOAN',
    `employeeId` VARCHAR(191) NOT NULL,
    `loanAmount` DECIMAL(18, 4) NOT NULL,
    `purpose` ENUM('MEDICAL', 'EDUCATION', 'EMERGENCY', 'PERSONAL', 'FESTIVAL', 'HOUSE_RENT', 'OTHERS') NOT NULL,
    `disbursementDate` DATE NOT NULL,
    `repaymentStartMonth` VARCHAR(191) NOT NULL,
    `installmentType` ENUM('MONTHLY', 'ONE_TIME') NOT NULL DEFAULT 'MONTHLY',
    `numberOfInstallments` INTEGER NOT NULL DEFAULT 1,
    `monthlyDeduction` DECIMAL(18, 4) NOT NULL,
    `outstandingBalance` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `paidAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `remarks` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'SUBMITTED', 'PENDING_HR', 'PENDING_ACCOUNTS', 'PENDING_MANAGEMENT', 'APPROVED', 'DISBURSED', 'ACTIVE', 'COMPLETED', 'REJECTED', 'CLOSED') NOT NULL DEFAULT 'DRAFT',
    `hrApprovalStatus` VARCHAR(191) NULL,
    `accountsVerification` VARCHAR(191) NULL,
    `managementDecision` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `LoanRequest_referenceNo_key`(`referenceNo`),
    INDEX `LoanRequest_employeeId_status_idx`(`employeeId`, `status`),
    INDEX `LoanRequest_requestType_idx`(`requestType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LoanRepaymentSchedule` (
    `id` VARCHAR(191) NOT NULL,
    `loanRequestId` VARCHAR(191) NOT NULL,
    `payrollMonth` VARCHAR(191) NOT NULL,
    `installment` DECIMAL(18, 4) NOT NULL,
    `remainingBalance` DECIMAL(18, 4) NOT NULL,
    `status` ENUM('PENDING', 'PAID', 'SKIPPED') NOT NULL DEFAULT 'PENDING',
    `payrollRunId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `LoanRepaymentSchedule_loanRequestId_idx`(`loanRequestId`),
    INDEX `LoanRepaymentSchedule_payrollMonth_idx`(`payrollMonth`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Bonus` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `bonusType` ENUM('FESTIVAL', 'ATTENDANCE', 'PRODUCTION', 'PERFORMANCE', 'SALES_INCENTIVE', 'SPECIAL', 'YEARLY', 'JOINING', 'RETENTION', 'OTHER') NOT NULL DEFAULT 'FESTIVAL',
    `effectivePayrollMonth` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `calculationMethod` ENUM('FIXED_AMOUNT', 'PERCENTAGE', 'FORMULA') NOT NULL DEFAULT 'FIXED_AMOUNT',
    `amount` DECIMAL(18, 4) NULL,
    `percentage` DECIMAL(18, 4) NULL,
    `basedOn` ENUM('BASIC_SALARY', 'GROSS_SALARY', 'NET_SALARY') NULL,
    `minimumServiceMonths` INTEGER NOT NULL DEFAULT 0,
    `paymentMethod` ENUM('PAYROLL', 'CASH', 'BANK_TRANSFER') NOT NULL DEFAULT 'PAYROLL',
    `paymentDate` DATE NULL,
    `includeInPayslip` BOOLEAN NOT NULL DEFAULT true,
    `status` ENUM('DRAFT', 'SUBMITTED', 'PENDING_HR', 'PENDING_MANAGEMENT', 'APPROVED', 'PUBLISHED', 'PAID', 'REJECTED', 'CLOSED') NOT NULL DEFAULT 'DRAFT',
    `hrApprovalStatus` VARCHAR(191) NULL,
    `managementDecision` VARCHAR(191) NULL,
    `remarks` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Bonus_code_key`(`code`),
    INDEX `Bonus_effectivePayrollMonth_idx`(`effectivePayrollMonth`),
    INDEX `Bonus_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmployeeBonus` (
    `id` VARCHAR(191) NOT NULL,
    `bonusId` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(18, 4) NOT NULL,
    `payrollRunId` VARCHAR(191) NULL,
    `isPaid` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EmployeeBonus_employeeId_idx`(`employeeId`),
    UNIQUE INDEX `EmployeeBonus_bonusId_employeeId_key`(`bonusId`, `employeeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PayrollAdjustment` (
    `id` VARCHAR(191) NOT NULL,
    `no` VARCHAR(191) NOT NULL,
    `payrollPeriodId` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `adjustmentDate` DATE NOT NULL,
    `type` ENUM('ALLOWANCE', 'DEDUCTION', 'BONUS_CORRECTION', 'SALARY_CORRECTION', 'TAX_ADJUSTMENT', 'OVERTIME_ADJUSTMENT', 'ATTENDANCE_ADJUSTMENT', 'LOAN_ADJUSTMENT', 'ADVANCE_ADJUSTMENT', 'OTHER') NOT NULL,
    `category` ENUM('ONE_TIME', 'RECURRING') NOT NULL DEFAULT 'ONE_TIME',
    `amount` DECIMAL(18, 4) NOT NULL,
    `description` VARCHAR(191) NULL,
    `includeInGrossSalary` BOOLEAN NOT NULL DEFAULT true,
    `includeInTax` BOOLEAN NOT NULL DEFAULT false,
    `includeInPayslip` BOOLEAN NOT NULL DEFAULT true,
    `reason` ENUM('ATTENDANCE_CORRECTION', 'MANUAL_BONUS', 'LATE_SALARY_REVISION', 'OT_CORRECTION', 'RECOVERY', 'OTHER') NOT NULL,
    `remarks` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'SUBMITTED', 'PENDING_HR', 'PENDING_MANAGEMENT', 'APPROVED', 'APPLIED', 'COMPLETED', 'REJECTED', 'CLOSED') NOT NULL DEFAULT 'DRAFT',
    `hrDecision` VARCHAR(191) NULL,
    `managementDecision` VARCHAR(191) NULL,
    `payrollRunId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PayrollAdjustment_no_key`(`no`),
    INDEX `PayrollAdjustment_payrollPeriodId_idx`(`payrollPeriodId`),
    INDEX `PayrollAdjustment_employeeId_idx`(`employeeId`),
    INDEX `PayrollAdjustment_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FinalSettlement` (
    `id` VARCHAR(191) NOT NULL,
    `no` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `resignationId` VARCHAR(191) NULL,
    `separationType` VARCHAR(191) NOT NULL,
    `lastWorkingDate` DATE NOT NULL,
    `reason` VARCHAR(191) NULL,
    `pendingSalary` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `leaveEncashment` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `overtimeAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `bonusAmount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `otherEarnings` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `totalEarnings` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `loanRecovery` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `advanceRecovery` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `incomeTax` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `noticePayRecovery` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `assetRecovery` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `otherDeductions` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `totalDeductions` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `netSettlement` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `status` ENUM('DRAFT', 'CALCULATED', 'PENDING_HR', 'PENDING_FINANCE', 'PENDING_MANAGEMENT', 'APPROVED', 'PAID', 'CLOSED', 'REJECTED') NOT NULL DEFAULT 'DRAFT',
    `hrApproval` VARCHAR(191) NULL,
    `financeApproval` VARCHAR(191) NULL,
    `managementApproval` VARCHAR(191) NULL,
    `remarks` VARCHAR(191) NULL,
    `paymentMethod` VARCHAR(191) NULL,
    `paymentDate` DATETIME(3) NULL,
    `transactionRef` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `FinalSettlement_no_key`(`no`),
    UNIQUE INDEX `FinalSettlement_resignationId_key`(`resignationId`),
    INDEX `FinalSettlement_employeeId_idx`(`employeeId`),
    INDEX `FinalSettlement_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Announcement` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `body` VARCHAR(191) NOT NULL,
    `audienceType` ENUM('ALL', 'BRANCH', 'DEPARTMENT', 'USER') NOT NULL DEFAULT 'ALL',
    `audienceBranchId` VARCHAR(191) NULL,
    `audienceDepartment` VARCHAR(191) NULL,
    `audienceUserId` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Announcement_audienceType_createdAt_idx`(`audienceType`, `createdAt`),
    INDEX `Announcement_createdById_idx`(`createdById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_defaultBranchId_fkey` FOREIGN KEY (`defaultBranchId`) REFERENCES `Branch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_defaultCompanyId_fkey` FOREIGN KEY (`defaultCompanyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_activeBranchId_fkey` FOREIGN KEY (`activeBranchId`) REFERENCES `Branch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_activeCompanyId_fkey` FOREIGN KEY (`activeCompanyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MobileRefreshToken` ADD CONSTRAINT `MobileRefreshToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Role` ADD CONSTRAINT `Role_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserRole` ADD CONSTRAINT `UserRole_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserRole` ADD CONSTRAINT `UserRole_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserBranchAccess` ADD CONSTRAINT `UserBranchAccess_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserBranchAccess` ADD CONSTRAINT `UserBranchAccess_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RolePermission` ADD CONSTRAINT `RolePermission_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RolePermission` ADD CONSTRAINT `RolePermission_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `Permission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Branch` ADD CONSTRAINT `Branch_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Period` ADD CONSTRAINT `Period_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_recipientId_fkey` FOREIGN KEY (`recipientId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductCategory` ADD CONSTRAINT `ProductCategory_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductCategory` ADD CONSTRAINT `ProductCategory_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `ProductCategory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductBrand` ADD CONSTRAINT `ProductBrand_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `ProductCategory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_brandId_fkey` FOREIGN KEY (`brandId`) REFERENCES `ProductBrand`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Warehouse` ADD CONSTRAINT `Warehouse_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryLedger` ADD CONSTRAINT `InventoryLedger_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryLedger` ADD CONSTRAINT `InventoryLedger_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `Warehouse`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryLedger` ADD CONSTRAINT `InventoryLedger_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockRequisition` ADD CONSTRAINT `StockRequisition_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockRequisition` ADD CONSTRAINT `StockRequisition_showroomWarehouseId_fkey` FOREIGN KEY (`showroomWarehouseId`) REFERENCES `Warehouse`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockRequisition` ADD CONSTRAINT `StockRequisition_sourceWarehouseId_fkey` FOREIGN KEY (`sourceWarehouseId`) REFERENCES `Warehouse`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockRequisitionItem` ADD CONSTRAINT `StockRequisitionItem_requisitionId_fkey` FOREIGN KEY (`requisitionId`) REFERENCES `StockRequisition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockRequisitionItem` ADD CONSTRAINT `StockRequisitionItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockTransfer` ADD CONSTRAINT `StockTransfer_requisitionId_fkey` FOREIGN KEY (`requisitionId`) REFERENCES `StockRequisition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockTransfer` ADD CONSTRAINT `StockTransfer_fromBranchId_fkey` FOREIGN KEY (`fromBranchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockTransfer` ADD CONSTRAINT `StockTransfer_toBranchId_fkey` FOREIGN KEY (`toBranchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockTransfer` ADD CONSTRAINT `StockTransfer_fromWarehouseId_fkey` FOREIGN KEY (`fromWarehouseId`) REFERENCES `Warehouse`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockTransfer` ADD CONSTRAINT `StockTransfer_toWarehouseId_fkey` FOREIGN KEY (`toWarehouseId`) REFERENCES `Warehouse`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockTransferItem` ADD CONSTRAINT `StockTransferItem_transferId_fkey` FOREIGN KEY (`transferId`) REFERENCES `StockTransfer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockTransferItem` ADD CONSTRAINT `StockTransferItem_requisitionItemId_fkey` FOREIGN KEY (`requisitionItemId`) REFERENCES `StockRequisitionItem`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockTransferItem` ADD CONSTRAINT `StockTransferItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerReturn` ADD CONSTRAINT `CustomerReturn_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerReturn` ADD CONSTRAINT `CustomerReturn_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `Warehouse`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerReturn` ADD CONSTRAINT `CustomerReturn_inspectionWarehouseId_fkey` FOREIGN KEY (`inspectionWarehouseId`) REFERENCES `Warehouse`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerReturnItem` ADD CONSTRAINT `CustomerReturnItem_returnId_fkey` FOREIGN KEY (`returnId`) REFERENCES `CustomerReturn`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerReturnItem` ADD CONSTRAINT `CustomerReturnItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DamageReport` ADD CONSTRAINT `DamageReport_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DamageReport` ADD CONSTRAINT `DamageReport_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `Warehouse`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DamageReport` ADD CONSTRAINT `DamageReport_quarantineWarehouseId_fkey` FOREIGN KEY (`quarantineWarehouseId`) REFERENCES `Warehouse`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DamageReport` ADD CONSTRAINT `DamageReport_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DamageReport` ADD CONSTRAINT `DamageReport_grnId_fkey` FOREIGN KEY (`grnId`) REFERENCES `GoodsReceiving`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DamageReport` ADD CONSTRAINT `DamageReport_purchaseInvoiceId_fkey` FOREIGN KEY (`purchaseInvoiceId`) REFERENCES `PurchaseInvoice`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DamageReportItem` ADD CONSTRAINT `DamageReportItem_reportId_fkey` FOREIGN KEY (`reportId`) REFERENCES `DamageReport`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DamageReportItem` ADD CONSTRAINT `DamageReportItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Supplier` ADD CONSTRAINT `Supplier_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseRequisition` ADD CONSTRAINT `PurchaseRequisition_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseRequisitionItem` ADD CONSTRAINT `PurchaseRequisitionItem_requisitionId_fkey` FOREIGN KEY (`requisitionId`) REFERENCES `PurchaseRequisition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseRequisitionItem` ADD CONSTRAINT `PurchaseRequisitionItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseOrder` ADD CONSTRAINT `PurchaseOrder_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseOrder` ADD CONSTRAINT `PurchaseOrder_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseOrder` ADD CONSTRAINT `PurchaseOrder_requisitionId_fkey` FOREIGN KEY (`requisitionId`) REFERENCES `PurchaseRequisition`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseOrderItem` ADD CONSTRAINT `PurchaseOrderItem_purchaseOrderId_fkey` FOREIGN KEY (`purchaseOrderId`) REFERENCES `PurchaseOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseOrderItem` ADD CONSTRAINT `PurchaseOrderItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GoodsReceiving` ADD CONSTRAINT `GoodsReceiving_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GoodsReceiving` ADD CONSTRAINT `GoodsReceiving_purchaseOrderId_fkey` FOREIGN KEY (`purchaseOrderId`) REFERENCES `PurchaseOrder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GoodsReceiving` ADD CONSTRAINT `GoodsReceiving_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GoodsReceiving` ADD CONSTRAINT `GoodsReceiving_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `Warehouse`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GoodsReceivingItem` ADD CONSTRAINT `GoodsReceivingItem_grnId_fkey` FOREIGN KEY (`grnId`) REFERENCES `GoodsReceiving`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GoodsReceivingItem` ADD CONSTRAINT `GoodsReceivingItem_purchaseOrderItemId_fkey` FOREIGN KEY (`purchaseOrderItemId`) REFERENCES `PurchaseOrderItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GoodsReceivingItem` ADD CONSTRAINT `GoodsReceivingItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseInvoice` ADD CONSTRAINT `PurchaseInvoice_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseInvoice` ADD CONSTRAINT `PurchaseInvoice_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseInvoice` ADD CONSTRAINT `PurchaseInvoice_purchaseOrderId_fkey` FOREIGN KEY (`purchaseOrderId`) REFERENCES `PurchaseOrder`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseInvoice` ADD CONSTRAINT `PurchaseInvoice_grnId_fkey` FOREIGN KEY (`grnId`) REFERENCES `GoodsReceiving`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseInvoiceItem` ADD CONSTRAINT `PurchaseInvoiceItem_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `PurchaseInvoice`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseInvoiceItem` ADD CONSTRAINT `PurchaseInvoiceItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupplierPayment` ADD CONSTRAINT `SupplierPayment_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupplierPayment` ADD CONSTRAINT `SupplierPayment_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupplierPayment` ADD CONSTRAINT `SupplierPayment_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `PurchaseInvoice`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupplierLedger` ADD CONSTRAINT `SupplierLedger_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupplierLedger` ADD CONSTRAINT `SupplierLedger_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DebitNote` ADD CONSTRAINT `DebitNote_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DebitNote` ADD CONSTRAINT `DebitNote_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DebitNote` ADD CONSTRAINT `DebitNote_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `PurchaseInvoice`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DebitNote` ADD CONSTRAINT `DebitNote_grnId_fkey` FOREIGN KEY (`grnId`) REFERENCES `GoodsReceiving`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DebitNoteItem` ADD CONSTRAINT `DebitNoteItem_debitNoteId_fkey` FOREIGN KEY (`debitNoteId`) REFERENCES `DebitNote`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DebitNoteItem` ADD CONSTRAINT `DebitNoteItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductionPlan` ADD CONSTRAINT `ProductionPlan_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductionPlan` ADD CONSTRAINT `ProductionPlan_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductionPlan` ADD CONSTRAINT `ProductionPlan_plannerId_fkey` FOREIGN KEY (`plannerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductionOrder` ADD CONSTRAINT `ProductionOrder_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductionOrder` ADD CONSTRAINT `ProductionOrder_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductionOrder` ADD CONSTRAINT `ProductionOrder_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `ProductionPlan`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkOrder` ADD CONSTRAINT `WorkOrder_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `ProductionOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkOrder` ADD CONSTRAINT `WorkOrder_operatorId_fkey` FOREIGN KEY (`operatorId`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DelayTracking` ADD CONSTRAINT `DelayTracking_workOrderId_fkey` FOREIGN KEY (`workOrderId`) REFERENCES `WorkOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductionStage` ADD CONSTRAINT `ProductionStage_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `ProductionOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductionMaterial` ADD CONSTRAINT `ProductionMaterial_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `ProductionOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductionMaterial` ADD CONSTRAINT `ProductionMaterial_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductionMaterial` ADD CONSTRAINT `ProductionMaterial_fromWarehouseId_fkey` FOREIGN KEY (`fromWarehouseId`) REFERENCES `Warehouse`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductionOutput` ADD CONSTRAINT `ProductionOutput_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `ProductionOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductionOutput` ADD CONSTRAINT `ProductionOutput_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductionOutput` ADD CONSTRAINT `ProductionOutput_toWarehouseId_fkey` FOREIGN KEY (`toWarehouseId`) REFERENCES `Warehouse`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductionCostEntry` ADD CONSTRAINT `ProductionCostEntry_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `ProductionOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductionIssueVoucher` ADD CONSTRAINT `ProductionIssueVoucher_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductionIssueVoucher` ADD CONSTRAINT `ProductionIssueVoucher_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `ProductionOrder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductionIssueVoucher` ADD CONSTRAINT `ProductionIssueVoucher_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `Warehouse`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductionIssueVoucher` ADD CONSTRAINT `ProductionIssueVoucher_requestedById_fkey` FOREIGN KEY (`requestedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductionIssueVoucher` ADD CONSTRAINT `ProductionIssueVoucher_approvedById_fkey` FOREIGN KEY (`approvedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductionIssueVoucher` ADD CONSTRAINT `ProductionIssueVoucher_issuedById_fkey` FOREIGN KEY (`issuedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductionIssueItem` ADD CONSTRAINT `ProductionIssueItem_voucherId_fkey` FOREIGN KEY (`voucherId`) REFERENCES `ProductionIssueVoucher`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductionIssueItem` ADD CONSTRAINT `ProductionIssueItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProcessTracking` ADD CONSTRAINT `ProcessTracking_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `ProductionOrder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProcessTracking` ADD CONSTRAINT `ProcessTracking_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProcessTracking` ADD CONSTRAINT `ProcessTracking_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProcessTracking` ADD CONSTRAINT `ProcessTracking_stageId_fkey` FOREIGN KEY (`stageId`) REFERENCES `ProductionStage`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProcessTracking` ADD CONSTRAINT `ProcessTracking_operatorId_fkey` FOREIGN KEY (`operatorId`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WipLedger` ADD CONSTRAINT `WipLedger_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WipLedger` ADD CONSTRAINT `WipLedger_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `ProductionOrder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WipLedger` ADD CONSTRAINT `WipLedger_stageId_fkey` FOREIGN KEY (`stageId`) REFERENCES `ProductionStage`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WipLedger` ADD CONSTRAINT `WipLedger_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WipLedger` ADD CONSTRAINT `WipLedger_operatorId_fkey` FOREIGN KEY (`operatorId`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScrapLedger` ADD CONSTRAINT `ScrapLedger_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScrapLedger` ADD CONSTRAINT `ScrapLedger_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `ProductionOrder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScrapLedger` ADD CONSTRAINT `ScrapLedger_stageId_fkey` FOREIGN KEY (`stageId`) REFERENCES `ProductionStage`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScrapLedger` ADD CONSTRAINT `ScrapLedger_operatorId_fkey` FOREIGN KEY (`operatorId`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FinishedGoodsReceiveVoucher` ADD CONSTRAINT `FinishedGoodsReceiveVoucher_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FinishedGoodsReceiveVoucher` ADD CONSTRAINT `FinishedGoodsReceiveVoucher_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `ProductionOrder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FinishedGoodsReceiveVoucher` ADD CONSTRAINT `FinishedGoodsReceiveVoucher_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `Warehouse`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FinishedGoodsReceiveVoucher` ADD CONSTRAINT `FinishedGoodsReceiveVoucher_receivedById_fkey` FOREIGN KEY (`receivedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FinishedGoodsReceiveVoucher` ADD CONSTRAINT `FinishedGoodsReceiveVoucher_approvedById_fkey` FOREIGN KEY (`approvedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FinishedGoodsReceiveItem` ADD CONSTRAINT `FinishedGoodsReceiveItem_voucherId_fkey` FOREIGN KEY (`voucherId`) REFERENCES `FinishedGoodsReceiveVoucher`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FinishedGoodsReceiveItem` ADD CONSTRAINT `FinishedGoodsReceiveItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AssetCategory` ADD CONSTRAINT `AssetCategory_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Asset` ADD CONSTRAINT `Asset_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Asset` ADD CONSTRAINT `Asset_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `AssetCategory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AssetMovement` ADD CONSTRAINT `AssetMovement_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `Asset`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AssetMovement` ADD CONSTRAINT `AssetMovement_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApprovalRuleApprover` ADD CONSTRAINT `ApprovalRuleApprover_ruleId_fkey` FOREIGN KEY (`ruleId`) REFERENCES `ApprovalRule`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApprovalRequest` ADD CONSTRAINT `ApprovalRequest_ruleId_fkey` FOREIGN KEY (`ruleId`) REFERENCES `ApprovalRule`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ApprovalStep` ADD CONSTRAINT `ApprovalStep_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `ApprovalRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DocumentTag` ADD CONSTRAINT `DocumentTag_documentId_fkey` FOREIGN KEY (`documentId`) REFERENCES `Document`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DocumentLink` ADD CONSTRAINT `DocumentLink_documentId_fkey` FOREIGN KEY (`documentId`) REFERENCES `Document`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerCategory` ADD CONSTRAINT `CustomerCategory_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Customer` ADD CONSTRAINT `Customer_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Customer` ADD CONSTRAINT `Customer_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `CustomerCategory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerInteraction` ADD CONSTRAINT `CustomerInteraction_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerLedger` ADD CONSTRAINT `CustomerLedger_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerLedger` ADD CONSTRAINT `CustomerLedger_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PosSession` ADD CONSTRAINT `PosSession_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PosSession` ADD CONSTRAINT `PosSession_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `Warehouse`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PosSale` ADD CONSTRAINT `PosSale_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PosSale` ADD CONSTRAINT `PosSale_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `Warehouse`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PosSale` ADD CONSTRAINT `PosSale_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `PosSession`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PosSale` ADD CONSTRAINT `PosSale_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PosSaleItem` ADD CONSTRAINT `PosSaleItem_saleId_fkey` FOREIGN KEY (`saleId`) REFERENCES `PosSale`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PosSaleItem` ADD CONSTRAINT `PosSaleItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PosSalePayment` ADD CONSTRAINT `PosSalePayment_saleId_fkey` FOREIGN KEY (`saleId`) REFERENCES `PosSale`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PosReturn` ADD CONSTRAINT `PosReturn_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PosReturn` ADD CONSTRAINT `PosReturn_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `Warehouse`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PosReturn` ADD CONSTRAINT `PosReturn_saleId_fkey` FOREIGN KEY (`saleId`) REFERENCES `PosSale`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PosReturn` ADD CONSTRAINT `PosReturn_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `PosSession`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PosReturnItem` ADD CONSTRAINT `PosReturnItem_returnId_fkey` FOREIGN KEY (`returnId`) REFERENCES `PosReturn`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PosReturnItem` ADD CONSTRAINT `PosReturnItem_saleItemId_fkey` FOREIGN KEY (`saleItemId`) REFERENCES `PosSaleItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PosReturnItem` ADD CONSTRAINT `PosReturnItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EcommerceChannel` ADD CONSTRAINT `EcommerceChannel_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EcommerceOrder` ADD CONSTRAINT `EcommerceOrder_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `EcommerceChannel`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EcommerceOrder` ADD CONSTRAINT `EcommerceOrder_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EcommerceOrder` ADD CONSTRAINT `EcommerceOrder_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `Warehouse`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EcommerceOrder` ADD CONSTRAINT `EcommerceOrder_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EcommerceOrderItem` ADD CONSTRAINT `EcommerceOrderItem_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `EcommerceOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EcommerceOrderItem` ADD CONSTRAINT `EcommerceOrderItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EcommerceFulfillment` ADD CONSTRAINT `EcommerceFulfillment_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `EcommerceOrder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EcommerceFulfillment` ADD CONSTRAINT `EcommerceFulfillment_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EcommerceFulfillment` ADD CONSTRAINT `EcommerceFulfillment_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `Warehouse`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EcommerceFulfillmentItem` ADD CONSTRAINT `EcommerceFulfillmentItem_fulfillmentId_fkey` FOREIGN KEY (`fulfillmentId`) REFERENCES `EcommerceFulfillment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EcommerceFulfillmentItem` ADD CONSTRAINT `EcommerceFulfillmentItem_orderItemId_fkey` FOREIGN KEY (`orderItemId`) REFERENCES `EcommerceOrderItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EcommerceFulfillmentItem` ADD CONSTRAINT `EcommerceFulfillmentItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EcommercePayment` ADD CONSTRAINT `EcommercePayment_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `EcommerceOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EcommercePayment` ADD CONSTRAINT `EcommercePayment_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EcommerceReturn` ADD CONSTRAINT `EcommerceReturn_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `EcommerceOrder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EcommerceReturn` ADD CONSTRAINT `EcommerceReturn_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EcommerceReturnItem` ADD CONSTRAINT `EcommerceReturnItem_returnId_fkey` FOREIGN KEY (`returnId`) REFERENCES `EcommerceReturn`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EcommerceReturnItem` ADD CONSTRAINT `EcommerceReturnItem_orderItemId_fkey` FOREIGN KEY (`orderItemId`) REFERENCES `EcommerceOrderItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EcommerceReturnItem` ADD CONSTRAINT `EcommerceReturnItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EcommerceReconciliationRun` ADD CONSTRAINT `EcommerceReconciliationRun_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EcommerceReconciliationRun` ADD CONSTRAINT `EcommerceReconciliationRun_channelId_fkey` FOREIGN KEY (`channelId`) REFERENCES `EcommerceChannel`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WholesaleInvoice` ADD CONSTRAINT `WholesaleInvoice_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WholesaleInvoice` ADD CONSTRAINT `WholesaleInvoice_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `Warehouse`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WholesaleInvoice` ADD CONSTRAINT `WholesaleInvoice_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WholesaleInvoiceItem` ADD CONSTRAINT `WholesaleInvoiceItem_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `WholesaleInvoice`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WholesaleInvoiceItem` ADD CONSTRAINT `WholesaleInvoiceItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WholesalePayment` ADD CONSTRAINT `WholesalePayment_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `WholesaleInvoice`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WholesaleReturn` ADD CONSTRAINT `WholesaleReturn_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WholesaleReturn` ADD CONSTRAINT `WholesaleReturn_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `Warehouse`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WholesaleReturn` ADD CONSTRAINT `WholesaleReturn_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `WholesaleInvoice`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WholesaleReturnItem` ADD CONSTRAINT `WholesaleReturnItem_returnId_fkey` FOREIGN KEY (`returnId`) REFERENCES `WholesaleReturn`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WholesaleReturnItem` ADD CONSTRAINT `WholesaleReturnItem_invoiceItemId_fkey` FOREIGN KEY (`invoiceItemId`) REFERENCES `WholesaleInvoiceItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WholesaleReturnItem` ADD CONSTRAINT `WholesaleReturnItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CorporateQuote` ADD CONSTRAINT `CorporateQuote_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CorporateQuote` ADD CONSTRAINT `CorporateQuote_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CorporateQuoteItem` ADD CONSTRAINT `CorporateQuoteItem_quoteId_fkey` FOREIGN KEY (`quoteId`) REFERENCES `CorporateQuote`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CorporateQuoteItem` ADD CONSTRAINT `CorporateQuoteItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CorporateOrder` ADD CONSTRAINT `CorporateOrder_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CorporateOrder` ADD CONSTRAINT `CorporateOrder_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `Warehouse`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CorporateOrder` ADD CONSTRAINT `CorporateOrder_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CorporateOrder` ADD CONSTRAINT `CorporateOrder_quoteId_fkey` FOREIGN KEY (`quoteId`) REFERENCES `CorporateQuote`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CorporateOrderItem` ADD CONSTRAINT `CorporateOrderItem_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `CorporateOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CorporateOrderItem` ADD CONSTRAINT `CorporateOrderItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CorporateDelivery` ADD CONSTRAINT `CorporateDelivery_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CorporateDelivery` ADD CONSTRAINT `CorporateDelivery_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `Warehouse`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CorporateDelivery` ADD CONSTRAINT `CorporateDelivery_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `CorporateOrder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CorporateDelivery` ADD CONSTRAINT `CorporateDelivery_receivedById_fkey` FOREIGN KEY (`receivedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CorporateDeliveryItem` ADD CONSTRAINT `CorporateDeliveryItem_deliveryId_fkey` FOREIGN KEY (`deliveryId`) REFERENCES `CorporateDelivery`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CorporateDeliveryItem` ADD CONSTRAINT `CorporateDeliveryItem_orderItemId_fkey` FOREIGN KEY (`orderItemId`) REFERENCES `CorporateOrderItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CorporateDeliveryItem` ADD CONSTRAINT `CorporateDeliveryItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CorporateSalesReturn` ADD CONSTRAINT `CorporateSalesReturn_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CorporateSalesReturn` ADD CONSTRAINT `CorporateSalesReturn_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CorporateSalesReturn` ADD CONSTRAINT `CorporateSalesReturn_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `CorporateOrder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CorporateSalesReturn` ADD CONSTRAINT `CorporateSalesReturn_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `CorporateInvoice`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CorporateSalesReturn` ADD CONSTRAINT `CorporateSalesReturn_warehouseId_fkey` FOREIGN KEY (`warehouseId`) REFERENCES `Warehouse`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CorporateSalesReturn` ADD CONSTRAINT `CorporateSalesReturn_qcOfficerId_fkey` FOREIGN KEY (`qcOfficerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CorporateSalesReturnItem` ADD CONSTRAINT `CorporateSalesReturnItem_returnId_fkey` FOREIGN KEY (`returnId`) REFERENCES `CorporateSalesReturn`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CorporateSalesReturnItem` ADD CONSTRAINT `CorporateSalesReturnItem_orderItemId_fkey` FOREIGN KEY (`orderItemId`) REFERENCES `CorporateOrderItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CorporateSalesReturnItem` ADD CONSTRAINT `CorporateSalesReturnItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CorporateInvoice` ADD CONSTRAINT `CorporateInvoice_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CorporateInvoice` ADD CONSTRAINT `CorporateInvoice_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CorporateInvoice` ADD CONSTRAINT `CorporateInvoice_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `CorporateOrder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CorporateInvoiceItem` ADD CONSTRAINT `CorporateInvoiceItem_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `CorporateInvoice`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CorporateInvoiceItem` ADD CONSTRAINT `CorporateInvoiceItem_orderItemId_fkey` FOREIGN KEY (`orderItemId`) REFERENCES `CorporateOrderItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CorporateInvoiceItem` ADD CONSTRAINT `CorporateInvoiceItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CorporateInvoicePayment` ADD CONSTRAINT `CorporateInvoicePayment_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `CorporateInvoice`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChartAccount` ADD CONSTRAINT `ChartAccount_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `ChartAccount`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChartAccount` ADD CONSTRAINT `ChartAccount_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OpeningBalanceEntry` ADD CONSTRAINT `OpeningBalanceEntry_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OpeningBalanceEntry` ADD CONSTRAINT `OpeningBalanceEntry_periodId_fkey` FOREIGN KEY (`periodId`) REFERENCES `Period`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OpeningBalanceEntry` ADD CONSTRAINT `OpeningBalanceEntry_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `ChartAccount`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SystemAccountMapping` ADD CONSTRAINT `SystemAccountMapping_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `ChartAccount`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JournalEntry` ADD CONSTRAINT `JournalEntry_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JournalEntry` ADD CONSTRAINT `JournalEntry_periodId_fkey` FOREIGN KEY (`periodId`) REFERENCES `Period`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JournalEntry` ADD CONSTRAINT `JournalEntry_reversesId_fkey` FOREIGN KEY (`reversesId`) REFERENCES `JournalEntry`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JournalEntryLine` ADD CONSTRAINT `JournalEntryLine_entryId_fkey` FOREIGN KEY (`entryId`) REFERENCES `JournalEntry`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `JournalEntryLine` ADD CONSTRAINT `JournalEntryLine_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `ChartAccount`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Employee` ADD CONSTRAINT `Employee_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Employee` ADD CONSTRAINT `Employee_shiftId_fkey` FOREIGN KEY (`shiftId`) REFERENCES `Shift`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Employee` ADD CONSTRAINT `Employee_reportingManagerId_fkey` FOREIGN KEY (`reportingManagerId`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Employee` ADD CONSTRAINT `Employee_systemRoleId_fkey` FOREIGN KEY (`systemRoleId`) REFERENCES `Role`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Shift` ADD CONSTRAINT `Shift_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Holiday` ADD CONSTRAINT `Holiday_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HrMasterData` ADD CONSTRAINT `HrMasterData_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HrWorkflowRecord` ADD CONSTRAINT `HrWorkflowRecord_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HrWorkflowRecord` ADD CONSTRAINT `HrWorkflowRecord_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeePromotion` ADD CONSTRAINT `EmployeePromotion_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeePromotion` ADD CONSTRAINT `EmployeePromotion_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeePromotion` ADD CONSTRAINT `EmployeePromotion_reportingManagerId_fkey` FOREIGN KEY (`reportingManagerId`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeIncrement` ADD CONSTRAINT `EmployeeIncrement_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeIncrement` ADD CONSTRAINT `EmployeeIncrement_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeIncrement` ADD CONSTRAINT `EmployeeIncrement_reportingManagerId_fkey` FOREIGN KEY (`reportingManagerId`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeConfirmation` ADD CONSTRAINT `EmployeeConfirmation_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeConfirmation` ADD CONSTRAINT `EmployeeConfirmation_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeConfirmation` ADD CONSTRAINT `EmployeeConfirmation_reportingManagerId_fkey` FOREIGN KEY (`reportingManagerId`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeSalaryHistory` ADD CONSTRAINT `EmployeeSalaryHistory_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeSalaryHistory` ADD CONSTRAINT `EmployeeSalaryHistory_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeTransfer` ADD CONSTRAINT `EmployeeTransfer_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeTransfer` ADD CONSTRAINT `EmployeeTransfer_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeTransfer` ADD CONSTRAINT `EmployeeTransfer_currentShiftId_fkey` FOREIGN KEY (`currentShiftId`) REFERENCES `Shift`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeTransfer` ADD CONSTRAINT `EmployeeTransfer_newBranchId_fkey` FOREIGN KEY (`newBranchId`) REFERENCES `Branch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeTransfer` ADD CONSTRAINT `EmployeeTransfer_newShiftId_fkey` FOREIGN KEY (`newShiftId`) REFERENCES `Shift`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeTransfer` ADD CONSTRAINT `EmployeeTransfer_tempBranchId_fkey` FOREIGN KEY (`tempBranchId`) REFERENCES `Branch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeTransfer` ADD CONSTRAINT `EmployeeTransfer_tempShiftId_fkey` FOREIGN KEY (`tempShiftId`) REFERENCES `Shift`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeTransfer` ADD CONSTRAINT `EmployeeTransfer_newReportingManagerId_fkey` FOREIGN KEY (`newReportingManagerId`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeResignation` ADD CONSTRAINT `EmployeeResignation_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeResignation` ADD CONSTRAINT `EmployeeResignation_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeResignation` ADD CONSTRAINT `EmployeeResignation_reportingManagerId_fkey` FOREIGN KEY (`reportingManagerId`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeExitClearance` ADD CONSTRAINT `EmployeeExitClearance_resignationId_fkey` FOREIGN KEY (`resignationId`) REFERENCES `EmployeeResignation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeExitClearance` ADD CONSTRAINT `EmployeeExitClearance_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeExitClearance` ADD CONSTRAINT `EmployeeExitClearance_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeExitDepartmentClearance` ADD CONSTRAINT `EmployeeExitDepartmentClearance_clearanceId_fkey` FOREIGN KEY (`clearanceId`) REFERENCES `EmployeeExitClearance`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeExitAssetReturn` ADD CONSTRAINT `EmployeeExitAssetReturn_clearanceId_fkey` FOREIGN KEY (`clearanceId`) REFERENCES `EmployeeExitClearance`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeExitSystemAccess` ADD CONSTRAINT `EmployeeExitSystemAccess_clearanceId_fkey` FOREIGN KEY (`clearanceId`) REFERENCES `EmployeeExitClearance`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeExitAccountsSettlement` ADD CONSTRAINT `EmployeeExitAccountsSettlement_clearanceId_fkey` FOREIGN KEY (`clearanceId`) REFERENCES `EmployeeExitClearance`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeExitInterview` ADD CONSTRAINT `EmployeeExitInterview_clearanceId_fkey` FOREIGN KEY (`clearanceId`) REFERENCES `EmployeeExitClearance`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Contract` ADD CONSTRAINT `Contract_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Contract` ADD CONSTRAINT `Contract_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Contract` ADD CONSTRAINT `Contract_shiftId_fkey` FOREIGN KEY (`shiftId`) REFERENCES `Shift`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendanceRule` ADD CONSTRAINT `AttendanceRule_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendanceRule` ADD CONSTRAINT `AttendanceRule_shiftId_fkey` FOREIGN KEY (`shiftId`) REFERENCES `Shift`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendanceException` ADD CONSTRAINT `AttendanceException_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendanceException` ADD CONSTRAINT `AttendanceException_approvedById_fkey` FOREIGN KEY (`approvedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendanceRecord` ADD CONSTRAINT `AttendanceRecord_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OvertimeRecord` ADD CONSTRAINT `OvertimeRecord_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OvertimeRecord` ADD CONSTRAINT `OvertimeRecord_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OvertimeRecord` ADD CONSTRAINT `OvertimeRecord_shiftId_fkey` FOREIGN KEY (`shiftId`) REFERENCES `Shift`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendanceAdjustment` ADD CONSTRAINT `AttendanceAdjustment_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendanceAdjustment` ADD CONSTRAINT `AttendanceAdjustment_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendanceAdjustment` ADD CONSTRAINT `AttendanceAdjustment_oldShiftId_fkey` FOREIGN KEY (`oldShiftId`) REFERENCES `Shift`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendanceAdjustment` ADD CONSTRAINT `AttendanceAdjustment_newShiftId_fkey` FOREIGN KEY (`newShiftId`) REFERENCES `Shift`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeaveRequest` ADD CONSTRAINT `LeaveRequest_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeaveRequest` ADD CONSTRAINT `LeaveRequest_handoverEmployeeId_fkey` FOREIGN KEY (`handoverEmployeeId`) REFERENCES `Employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeaveType` ADD CONSTRAINT `LeaveType_applicableBranchId_fkey` FOREIGN KEY (`applicableBranchId`) REFERENCES `Branch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeavePolicy` ADD CONSTRAINT `LeavePolicy_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeavePolicyRule` ADD CONSTRAINT `LeavePolicyRule_policyId_fkey` FOREIGN KEY (`policyId`) REFERENCES `LeavePolicy`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeLeavePolicy` ADD CONSTRAINT `EmployeeLeavePolicy_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeLeavePolicy` ADD CONSTRAINT `EmployeeLeavePolicy_policyId_fkey` FOREIGN KEY (`policyId`) REFERENCES `LeavePolicy`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeaveBalanceAdjustment` ADD CONSTRAINT `LeaveBalanceAdjustment_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendanceSummaryRecord` ADD CONSTRAINT `AttendanceSummaryRecord_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttendanceSummaryRecord` ADD CONSTRAINT `AttendanceSummaryRecord_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PayrollRun` ADD CONSTRAINT `PayrollRun_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PayrollRun` ADD CONSTRAINT `PayrollRun_payrollPeriodId_fkey` FOREIGN KEY (`payrollPeriodId`) REFERENCES `PayrollPeriod`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payslip` ADD CONSTRAINT `Payslip_payrollRunId_fkey` FOREIGN KEY (`payrollRunId`) REFERENCES `PayrollRun`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payslip` ADD CONSTRAINT `Payslip_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TradeOrder` ADD CONSTRAINT `TradeOrder_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TradeOrder` ADD CONSTRAINT `TradeOrder_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TradeOrder` ADD CONSTRAINT `TradeOrder_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `Supplier`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TradeOrderItem` ADD CONSTRAINT `TradeOrderItem_tradeOrderId_fkey` FOREIGN KEY (`tradeOrderId`) REFERENCES `TradeOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TradeOrderItem` ADD CONSTRAINT `TradeOrderItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TradeShipment` ADD CONSTRAINT `TradeShipment_tradeOrderId_fkey` FOREIGN KEY (`tradeOrderId`) REFERENCES `TradeOrder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LetterOfCredit` ADD CONSTRAINT `LetterOfCredit_tradeOrderId_fkey` FOREIGN KEY (`tradeOrderId`) REFERENCES `TradeOrder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LetterOfCredit` ADD CONSTRAINT `LetterOfCredit_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LCAmendment` ADD CONSTRAINT `LCAmendment_lcId_fkey` FOREIGN KEY (`lcId`) REFERENCES `LetterOfCredit`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LCDrawdown` ADD CONSTRAINT `LCDrawdown_lcId_fkey` FOREIGN KEY (`lcId`) REFERENCES `LetterOfCredit`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TradePayment` ADD CONSTRAINT `TradePayment_tradeOrderId_fkey` FOREIGN KEY (`tradeOrderId`) REFERENCES `TradeOrder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TradePayment` ADD CONSTRAINT `TradePayment_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CashTransfer` ADD CONSTRAINT `CashTransfer_fromBranchId_fkey` FOREIGN KEY (`fromBranchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CashTransfer` ADD CONSTRAINT `CashTransfer_toBranchId_fkey` FOREIGN KEY (`toBranchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CashEntry` ADD CONSTRAINT `CashEntry_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CashEntry` ADD CONSTRAINT `CashEntry_contactId_fkey` FOREIGN KEY (`contactId`) REFERENCES `Customer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SalaryComponentApplicability` ADD CONSTRAINT `SalaryComponentApplicability_componentId_fkey` FOREIGN KEY (`componentId`) REFERENCES `SalaryComponent`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SalaryStructureApplicability` ADD CONSTRAINT `SalaryStructureApplicability_salaryStructureId_fkey` FOREIGN KEY (`salaryStructureId`) REFERENCES `SalaryStructure`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SalaryStructureComponent` ADD CONSTRAINT `SalaryStructureComponent_salaryStructureId_fkey` FOREIGN KEY (`salaryStructureId`) REFERENCES `SalaryStructure`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SalaryStructureComponent` ADD CONSTRAINT `SalaryStructureComponent_salaryComponentId_fkey` FOREIGN KEY (`salaryComponentId`) REFERENCES `SalaryComponent`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeSalaryStructureAssignment` ADD CONSTRAINT `EmployeeSalaryStructureAssignment_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeSalaryStructureAssignment` ADD CONSTRAINT `EmployeeSalaryStructureAssignment_salaryStructureId_fkey` FOREIGN KEY (`salaryStructureId`) REFERENCES `SalaryStructure`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LoanRequest` ADD CONSTRAINT `LoanRequest_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LoanRepaymentSchedule` ADD CONSTRAINT `LoanRepaymentSchedule_loanRequestId_fkey` FOREIGN KEY (`loanRequestId`) REFERENCES `LoanRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeBonus` ADD CONSTRAINT `EmployeeBonus_bonusId_fkey` FOREIGN KEY (`bonusId`) REFERENCES `Bonus`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployeeBonus` ADD CONSTRAINT `EmployeeBonus_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PayrollAdjustment` ADD CONSTRAINT `PayrollAdjustment_payrollPeriodId_fkey` FOREIGN KEY (`payrollPeriodId`) REFERENCES `PayrollPeriod`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PayrollAdjustment` ADD CONSTRAINT `PayrollAdjustment_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FinalSettlement` ADD CONSTRAINT `FinalSettlement_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FinalSettlement` ADD CONSTRAINT `FinalSettlement_resignationId_fkey` FOREIGN KEY (`resignationId`) REFERENCES `EmployeeResignation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Announcement` ADD CONSTRAINT `Announcement_audienceBranchId_fkey` FOREIGN KEY (`audienceBranchId`) REFERENCES `Branch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Announcement` ADD CONSTRAINT `Announcement_audienceUserId_fkey` FOREIGN KEY (`audienceUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Announcement` ADD CONSTRAINT `Announcement_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
