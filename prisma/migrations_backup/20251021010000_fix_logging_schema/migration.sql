-- Fix logs table - add missing columns
ALTER TABLE "logs" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "logs" ADD COLUMN IF NOT EXISTS "statusCode" INTEGER;

-- Fix log_retention_policies table - rename column
ALTER TABLE "log_retention_policies" RENAME COLUMN "lastCleanupRun" TO "lastCleanup";

