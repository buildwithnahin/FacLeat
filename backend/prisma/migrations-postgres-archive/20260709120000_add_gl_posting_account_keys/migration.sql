-- Add system account keys needed to post real GL entries from the sales
-- and purchase modules: separate raw-material vs finished-goods inventory
-- accounts (mirrors the RM/WIP/FG split already tracked operationally),
-- and per-channel sales revenue accounts (POS/Wholesale/Corporate).
ALTER TYPE "SystemAccountKey" ADD VALUE 'INVENTORY_RAW_MATERIAL';
ALTER TYPE "SystemAccountKey" ADD VALUE 'INVENTORY_FINISHED_GOODS';
ALTER TYPE "SystemAccountKey" ADD VALUE 'SALES_REVENUE_POS';
ALTER TYPE "SystemAccountKey" ADD VALUE 'SALES_REVENUE_WHOLESALE';
ALTER TYPE "SystemAccountKey" ADD VALUE 'SALES_REVENUE_CORPORATE';
