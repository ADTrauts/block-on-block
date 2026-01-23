-- Add composite index for impersonation queries
-- This optimizes queries that filter by adminId and endedAt (for finding active impersonations)
CREATE INDEX IF NOT EXISTS "admin_impersonations_adminId_endedAt_idx" 
ON "admin_impersonations"("adminId", "endedAt");
