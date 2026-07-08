-- Add WIP to SystemAccountKey so production module postings (material
-- consumption, finished-goods receive) can resolve a Work in Progress
-- chart account per branch, mirroring how INVENTORY/COGS are mapped.
ALTER TYPE "SystemAccountKey" ADD VALUE 'WIP';
