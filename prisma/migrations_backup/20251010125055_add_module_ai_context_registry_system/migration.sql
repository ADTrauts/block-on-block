-- Drop existing tables if they have wrong schema (safe since they're likely empty)
DROP TABLE IF EXISTS "module_ai_performance_metrics" CASCADE;
DROP TABLE IF EXISTS "user_ai_context_cache" CASCADE;
DROP TABLE IF EXISTS "module_ai_context_registry" CASCADE;

-- Add module tracking fields to AILearningEvent
ALTER TABLE "ai_learning_events" ADD COLUMN IF NOT EXISTS "sourceModule" TEXT;
ALTER TABLE "ai_learning_events" ADD COLUMN IF NOT EXISTS "sourceModuleVersion" TEXT;
ALTER TABLE "ai_learning_events" ADD COLUMN IF NOT EXISTS "moduleActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ai_learning_events" ADD COLUMN IF NOT EXISTS "moduleSpecificData" JSONB;

-- Add indexes for module filtering
CREATE INDEX IF NOT EXISTS "ai_learning_events_sourceModule_idx" ON "ai_learning_events"("sourceModule");
CREATE INDEX IF NOT EXISTS "ai_learning_events_moduleActive_idx" ON "ai_learning_events"("moduleActive");

-- Add module tracking fields to GlobalLearningEvent
ALTER TABLE "global_learning_events" ADD COLUMN IF NOT EXISTS "sourceModule" TEXT;
ALTER TABLE "global_learning_events" ADD COLUMN IF NOT EXISTS "moduleCategory" TEXT;

-- Add indexes for global learning
CREATE INDEX IF NOT EXISTS "global_learning_events_sourceModule_idx" ON "global_learning_events"("sourceModule");
CREATE INDEX IF NOT EXISTS "global_learning_events_moduleCategory_idx" ON "global_learning_events"("moduleCategory");

-- Add module tracking fields to GlobalPattern
ALTER TABLE "global_patterns" ADD COLUMN IF NOT EXISTS "primaryModule" TEXT;
ALTER TABLE "global_patterns" ADD COLUMN IF NOT EXISTS "moduleCategory" TEXT;

-- Add indexes for global patterns
CREATE INDEX IF NOT EXISTS "global_patterns_primaryModule_idx" ON "global_patterns"("primaryModule");
CREATE INDEX IF NOT EXISTS "global_patterns_moduleCategory_idx" ON "global_patterns"("moduleCategory");

-- Create ModuleAIContextRegistry table
CREATE TABLE "module_ai_context_registry" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "moduleName" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "keywords" TEXT[],
    "patterns" TEXT[],
    "concepts" TEXT[],
    "entities" JSONB NOT NULL,
    "actions" JSONB NOT NULL,
    "contextProviders" JSONB NOT NULL,
    "queryableData" JSONB,
    "relationships" JSONB,
    "fullAIContext" JSONB NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "lastUpdated" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "module_ai_context_registry_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint and indexes for registry
CREATE UNIQUE INDEX IF NOT EXISTS "module_ai_context_registry_moduleId_key" ON "module_ai_context_registry"("moduleId");
CREATE INDEX IF NOT EXISTS "module_ai_context_registry_category_idx" ON "module_ai_context_registry"("category");
CREATE INDEX IF NOT EXISTS "module_ai_context_registry_keywords_idx" ON "module_ai_context_registry" USING GIN ("keywords");
CREATE INDEX IF NOT EXISTS "module_ai_context_registry_patterns_idx" ON "module_ai_context_registry" USING GIN ("patterns");
CREATE INDEX IF NOT EXISTS "module_ai_context_registry_moduleName_idx" ON "module_ai_context_registry"("moduleName");

-- Create UserAIContextCache table
CREATE TABLE "user_ai_context_cache" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cachedContext" JSONB NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "missCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "user_ai_context_cache_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint and indexes for cache
CREATE UNIQUE INDEX IF NOT EXISTS "user_ai_context_cache_userId_key" ON "user_ai_context_cache"("userId");
CREATE INDEX IF NOT EXISTS "user_ai_context_cache_expiresAt_idx" ON "user_ai_context_cache"("expiresAt");

-- Create ModuleAIPerformanceMetric table
CREATE TABLE "module_ai_performance_metrics" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalQueries" INTEGER NOT NULL DEFAULT 0,
    "successfulQueries" INTEGER NOT NULL DEFAULT 0,
    "failedQueries" INTEGER NOT NULL DEFAULT 0,
    "averageLatency" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "contextFetchCount" INTEGER NOT NULL DEFAULT 0,
    "contextFetchErrors" INTEGER NOT NULL DEFAULT 0,
    "averageContextSize" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cacheHitRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "positiveRatings" INTEGER NOT NULL DEFAULT 0,
    "negativeRatings" INTEGER NOT NULL DEFAULT 0,
    "averageRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estimatedCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tokenCount" INTEGER NOT NULL DEFAULT 0,
    "learningEventsGenerated" INTEGER NOT NULL DEFAULT 0,
    "patternsContributed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "module_ai_performance_metrics_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint and indexes for performance metrics
CREATE UNIQUE INDEX IF NOT EXISTS "module_ai_performance_metrics_moduleId_date_key" ON "module_ai_performance_metrics"("moduleId", "date");
CREATE INDEX IF NOT EXISTS "module_ai_performance_metrics_moduleId_idx" ON "module_ai_performance_metrics"("moduleId");
CREATE INDEX IF NOT EXISTS "module_ai_performance_metrics_date_idx" ON "module_ai_performance_metrics"("date");

-- Add cached context fields to ModuleInstallation
ALTER TABLE "module_installations" ADD COLUMN IF NOT EXISTS "cachedContext" JSONB;
ALTER TABLE "module_installations" ADD COLUMN IF NOT EXISTS "contextCachedAt" TIMESTAMP(3);

-- Add foreign key constraints
ALTER TABLE "module_ai_context_registry" ADD CONSTRAINT "module_ai_context_registry_moduleId_fkey" 
    FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_ai_context_cache" ADD CONSTRAINT "user_ai_context_cache_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "module_ai_performance_metrics" ADD CONSTRAINT "module_ai_performance_metrics_moduleId_fkey" 
    FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

