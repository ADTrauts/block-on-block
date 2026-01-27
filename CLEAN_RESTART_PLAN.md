# Clean Schema & Migration Restart Plan
**Date:** 2026-01-26  
**Status:** ✅ RECOMMENDED - No data to lose, clean slate is best

## Why Restart?

✅ **You have no users/data** - Perfect time for a clean restart  
✅ **71 migrations with drift** - Complex to fix incrementally  
✅ **Keep finding missing columns** - Indicates fundamental issues  
✅ **Want clean state** - Better than patching forever  

## Clean Restart Strategy

### Phase 1: Backup Current State (For Reference)
```bash
# Save current migrations for reference (don't delete yet)
cp -r prisma/migrations prisma/migrations_backup_$(date +%Y%m%d)

# Document what tables exist
# (We'll recreate them all from schema)
```

### Phase 2: Reset Local Database
```bash
# Reset local database completely
pnpm prisma migrate reset --force

# This will:
# - Drop all tables
# - Delete all data
# - Clear migration history
```

### Phase 3: Create Fresh Baseline Migration
```bash
# Build schema from modules
pnpm prisma:build

# Create a single baseline migration with everything
pnpm prisma migrate dev --name initial_schema_baseline --create-only

# Review the migration SQL
cat prisma/migrations/*_initial_schema_baseline/migration.sql

# Apply it
pnpm prisma migrate dev
```

### Phase 4: Verify Everything Works
```bash
# Check migration status
pnpm prisma migrate status
# Should show: 1 migration, all applied

# Verify no drift
pnpm prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-schema-datasource prisma/schema.prisma
# Should show: No difference detected

# Generate Prisma client
pnpm prisma:generate

# Test that code works
pnpm dev
```

### Phase 5: Clean Up Old Migrations
```bash
# Once verified working locally, remove old migrations
rm -rf prisma/migrations_backup_*  # Only after confirming new setup works
```

## Production Deployment

After local is clean:

```bash
# 1. Reset production database (WARNING: Deletes all data)
# Connect to production and run:
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

# 2. Deploy the single baseline migration
export DATABASE_URL="postgresql://vssyl_user:PASSWORD@172.30.0.4:5432/vssyl_production"
pnpm prisma migrate deploy

# 3. Verify
pnpm prisma migrate status
```

## Benefits of Clean Restart

✅ **Single migration** - Easy to understand and maintain  
✅ **No drift** - Schema and database perfectly aligned  
✅ **Clean history** - No confusing migration chain  
✅ **Future-proof** - All future migrations build on clean foundation  
✅ **Less complexity** - One migration vs 71 with issues  

## What You'll Lose

❌ All existing data (but you said you have none)  
❌ Migration history (but it was problematic anyway)  
❌ Any manual database changes (will be recreated from schema)  

## What You'll Gain

✅ Clean, working database  
✅ Schema matches database perfectly  
✅ Simple migration history  
✅ No more "column doesn't exist" errors  
✅ Confidence in your database state  

## Decision: Should You Restart?

**YES, if:**
- ✅ No users/data to lose
- ✅ Want clean state
- ✅ Tired of fixing migration issues
- ✅ Willing to reset production too

**NO, if:**
- ❌ Have important data
- ❌ Want to preserve migration history
- ❌ Prefer incremental fixes

## Recommended: RESTART ✅

Given your situation (no data, ongoing issues), a clean restart is the best path forward.
