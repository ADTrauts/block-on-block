-- Add trashedAt column to events table for global trash system support
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "trashedAt" TIMESTAMP(3);

-- Create index on trashedAt for efficient queries
CREATE INDEX IF NOT EXISTS "events_trashedAt_idx" ON "events"("trashedAt");

