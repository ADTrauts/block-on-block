-- Add missing columns to module_ai_context_registry if they don't exist
-- This fixes the production database where columns are missing
DO $$ 
BEGIN
    -- Add version column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'module_ai_context_registry' AND column_name = 'version'
    ) THEN
        ALTER TABLE "module_ai_context_registry" 
        ADD COLUMN "version" TEXT NOT NULL DEFAULT '1.0.0';
    END IF;
    
    -- Add createdAt column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'module_ai_context_registry' AND column_name = 'createdAt'
    ) THEN
        ALTER TABLE "module_ai_context_registry" 
        ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
    
    -- Add lastUpdated column if missing (should exist but being safe)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'module_ai_context_registry' AND column_name = 'lastUpdated'
    ) THEN
        ALTER TABLE "module_ai_context_registry" 
        ADD COLUMN "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;
