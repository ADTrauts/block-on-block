-- Comprehensive migration to ensure module_ai_context_registry has all required columns
-- This handles cases where the table was created with a partial schema

-- Add all potentially missing columns with safe IF NOT EXISTS checks

DO $$ 
BEGIN 
    -- Check if table exists first
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'module_ai_context_registry') THEN
        
        -- Add moduleName if missing
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'module_ai_context_registry' AND column_name = 'moduleName') THEN
            ALTER TABLE "module_ai_context_registry" ADD COLUMN "moduleName" TEXT NOT NULL DEFAULT '';
        END IF;
        
        -- Add purpose if missing
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'module_ai_context_registry' AND column_name = 'purpose') THEN
            ALTER TABLE "module_ai_context_registry" ADD COLUMN "purpose" TEXT NOT NULL DEFAULT '';
        END IF;
        
        -- Add category if missing
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'module_ai_context_registry' AND column_name = 'category') THEN
            ALTER TABLE "module_ai_context_registry" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'other';
        END IF;
        
        -- Add keywords if missing (array type)
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'module_ai_context_registry' AND column_name = 'keywords') THEN
            ALTER TABLE "module_ai_context_registry" ADD COLUMN "keywords" TEXT[] DEFAULT '{}';
        END IF;
        
        -- Add patterns if missing (array type)
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'module_ai_context_registry' AND column_name = 'patterns') THEN
            ALTER TABLE "module_ai_context_registry" ADD COLUMN "patterns" TEXT[] DEFAULT '{}';
        END IF;
        
        -- Add concepts if missing (array type)
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'module_ai_context_registry' AND column_name = 'concepts') THEN
            ALTER TABLE "module_ai_context_registry" ADD COLUMN "concepts" TEXT[] DEFAULT '{}';
        END IF;
        
        -- Add entities if missing (JSONB)
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'module_ai_context_registry' AND column_name = 'entities') THEN
            ALTER TABLE "module_ai_context_registry" ADD COLUMN "entities" JSONB NOT NULL DEFAULT '[]';
        END IF;
        
        -- Add actions if missing (JSONB)
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'module_ai_context_registry' AND column_name = 'actions') THEN
            ALTER TABLE "module_ai_context_registry" ADD COLUMN "actions" JSONB NOT NULL DEFAULT '[]';
        END IF;
        
        -- Add contextProviders if missing (JSONB)
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'module_ai_context_registry' AND column_name = 'contextProviders') THEN
            ALTER TABLE "module_ai_context_registry" ADD COLUMN "contextProviders" JSONB NOT NULL DEFAULT '[]';
        END IF;
        
        -- Add queryableData if missing (JSONB, nullable)
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'module_ai_context_registry' AND column_name = 'queryableData') THEN
            ALTER TABLE "module_ai_context_registry" ADD COLUMN "queryableData" JSONB;
        END IF;
        
        -- Add relationships if missing (JSONB, nullable)
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'module_ai_context_registry' AND column_name = 'relationships') THEN
            ALTER TABLE "module_ai_context_registry" ADD COLUMN "relationships" JSONB;
        END IF;
        
        -- Add fullAIContext if missing (JSONB)
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'module_ai_context_registry' AND column_name = 'fullAIContext') THEN
            ALTER TABLE "module_ai_context_registry" ADD COLUMN "fullAIContext" JSONB NOT NULL DEFAULT '{}';
        END IF;
        
        -- Add version if missing
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'module_ai_context_registry' AND column_name = 'version') THEN
            ALTER TABLE "module_ai_context_registry" ADD COLUMN "version" TEXT NOT NULL DEFAULT '1.0.0';
        END IF;
        
        -- Add lastUpdated if missing
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'module_ai_context_registry' AND column_name = 'lastUpdated') THEN
            ALTER TABLE "module_ai_context_registry" ADD COLUMN "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
        END IF;
        
        -- Add createdAt if missing
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'module_ai_context_registry' AND column_name = 'createdAt') THEN
            ALTER TABLE "module_ai_context_registry" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
        END IF;
        
        RAISE NOTICE 'module_ai_context_registry schema verification complete';
    ELSE
        RAISE NOTICE 'module_ai_context_registry table does not exist - will be created by initial migration';
    END IF;
END $$;

-- Ensure indexes exist
CREATE INDEX IF NOT EXISTS "module_ai_context_registry_keywords_idx" ON "module_ai_context_registry"("keywords");
CREATE INDEX IF NOT EXISTS "module_ai_context_registry_category_idx" ON "module_ai_context_registry"("category");
CREATE INDEX IF NOT EXISTS "module_ai_context_registry_moduleName_idx" ON "module_ai_context_registry"("moduleName");
