-- Fix missing columns in module_ai_context_registry table
-- This migration adds version, createdAt, and lastUpdated columns if they don't exist
-- Safe to run multiple times (idempotent)

DO $$ 
BEGIN
    -- Add version column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'module_ai_context_registry' AND column_name = 'version'
    ) THEN
        ALTER TABLE "module_ai_context_registry" 
        ADD COLUMN "version" TEXT NOT NULL DEFAULT '1.0.0';
        RAISE NOTICE 'Added version column to module_ai_context_registry';
    END IF;
    
    -- Add createdAt column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'module_ai_context_registry' AND column_name = 'createdAt'
    ) THEN
        ALTER TABLE "module_ai_context_registry" 
        ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
        RAISE NOTICE 'Added createdAt column to module_ai_context_registry';
    END IF;
    
    -- Add lastUpdated column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'module_ai_context_registry' AND column_name = 'lastUpdated'
    ) THEN
        ALTER TABLE "module_ai_context_registry" 
        ADD COLUMN "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
        RAISE NOTICE 'Added lastUpdated column to module_ai_context_registry';
    END IF;
END $$;
