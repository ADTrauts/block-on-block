# URGENT: Fix module_ai_context_registry Missing Columns

## The Problem
Production database is missing `createdAt` (and possibly `version` and `lastUpdated`) columns in `module_ai_context_registry` table.

## The Solution

### Quick Fix: Apply Migration to Production

```bash
# 1. Set production DATABASE_URL (see QUICK_DEPLOY.md for details)
export DATABASE_URL="postgresql://vssyl_user:PASSWORD@172.30.0.4:5432/vssyl_production?connection_limit=20&pool_timeout=20"

# 2. Apply the fix migration
pnpm prisma migrate deploy
```

This will apply migration `20260126210000_fix_module_ai_context_registry_columns` which adds:
- `version` column (if missing)
- `createdAt` column (if missing) 
- `lastUpdated` column (if missing)

### Manual SQL Fix (if migration doesn't work)

If you need to run the SQL directly:

```sql
-- Run this in production database
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
    
    -- Add lastUpdated column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'module_ai_context_registry' AND column_name = 'lastUpdated'
    ) THEN
        ALTER TABLE "module_ai_context_registry" 
        ADD COLUMN "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;
```

## Verification

After applying, verify the columns exist:

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'module_ai_context_registry'
ORDER BY column_name;
```

Should show: `createdAt`, `lastUpdated`, `version`
