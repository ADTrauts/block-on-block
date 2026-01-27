-- Add AI context caching fields to module_installations
ALTER TABLE "module_installations" ADD COLUMN IF NOT EXISTS "cachedContext" JSONB;
ALTER TABLE "module_installations" ADD COLUMN IF NOT EXISTS "contextCachedAt" TIMESTAMP(3);
