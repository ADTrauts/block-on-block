-- AlterTable
-- Add revenue tracking columns to modules table (idempotent)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'modules' AND column_name = 'totalLifetimeRevenue'
    ) THEN
        ALTER TABLE "modules" ADD COLUMN "totalLifetimeRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'modules' AND column_name = 'smallBusinessEligible'
    ) THEN
        ALTER TABLE "modules" ADD COLUMN "smallBusinessEligible" BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;
