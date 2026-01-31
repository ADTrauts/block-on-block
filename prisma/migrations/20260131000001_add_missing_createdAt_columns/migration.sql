-- Add createdAt column to module_ai_context_registry if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'module_ai_context_registry' 
        AND column_name = 'createdAt'
    ) THEN
        ALTER TABLE "module_ai_context_registry" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- Add lastUpdated column if it doesn't exist (might also be missing)
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'module_ai_context_registry' 
        AND column_name = 'lastUpdated'
    ) THEN
        ALTER TABLE "module_ai_context_registry" ADD COLUMN "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;
