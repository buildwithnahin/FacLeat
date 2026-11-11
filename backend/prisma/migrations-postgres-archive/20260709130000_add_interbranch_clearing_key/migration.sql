-- Add a system account key for inter-branch cash transfers. Each leg of a
-- transfer needs its own balanced JournalEntry (one per branch/period), so
-- a shared clearing account bridges the two entries.
ALTER TYPE "SystemAccountKey" ADD VALUE 'INTERBRANCH_CLEARING';
