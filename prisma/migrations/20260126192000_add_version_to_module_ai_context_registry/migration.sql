-- Add version column to module_ai_context_registry if it doesn't exist
-- This fixes the production database where the column is missing
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'module_ai_context_registry' AND column_name = 'version'
    ) THEN
        ALTER TABLE "module_ai_context_registry" 
        ADD COLUMN "version" TEXT NOT NULL DEFAULT '1.0.0';
    END IF;
END $$;
