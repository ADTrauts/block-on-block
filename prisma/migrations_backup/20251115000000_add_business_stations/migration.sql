-- ============================================================================
-- Add Business Stations Model
-- ============================================================================
-- Business-level stations shared across all positions
-- Used for station-based scheduling (e.g., "Grill 1", "Server 1-10", "ICU Nurse")
-- ============================================================================

-- Create business_stations table
CREATE TABLE IF NOT EXISTS "business_stations" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "stationType" "StationType" NOT NULL,
  "jobFunction" "JobFunction",
  "description" TEXT,
  "color" TEXT,
  "isRequired" BOOLEAN NOT NULL DEFAULT false,
  "priority" INTEGER,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "business_stations_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint for businessId + name
CREATE UNIQUE INDEX IF NOT EXISTS "business_stations_businessId_name_key" ON "business_stations"("businessId", "name");

-- Create indexes
CREATE INDEX IF NOT EXISTS "business_stations_businessId_idx" ON "business_stations"("businessId");
CREATE INDEX IF NOT EXISTS "business_stations_stationType_idx" ON "business_stations"("stationType");
CREATE INDEX IF NOT EXISTS "business_stations_jobFunction_idx" ON "business_stations"("jobFunction");
CREATE INDEX IF NOT EXISTS "business_stations_isActive_idx" ON "business_stations"("isActive");

-- Add foreign key constraint
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'business_stations_businessId_fkey'
  ) THEN
    ALTER TABLE "business_stations" 
    ADD CONSTRAINT "business_stations_businessId_fkey" 
    FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

