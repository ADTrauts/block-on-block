# Migration Recovery Plan
**DO NOT RESTART FROM SCRATCH** - Use this incremental approach instead

## Current Situation

✅ **Good News:**
- Local database is up to date (69 migrations applied)
- You already have a baseline migration (20260121070521_baseline_current_state)
- Most tables likely have migrations

⚠️ **Issue:**
- 18-33 models in schema may not have CREATE TABLE statements in migrations
- Some tables might exist in production but not in migration history
- Some models might be in schema but tables don't exist yet

## Recovery Strategy (Incremental - NO DATA LOSS)

### Phase 1: Audit What Actually Exists

**Goal:** Understand what's in production vs what's in schema

```bash
# 1. Check production database directly (if you have access)
# Connect to production and list all tables
psql $PRODUCTION_DATABASE_URL -c "\dt" > production_tables.txt

# 2. Compare with schema models
node scripts/check-migration-coverage.js > coverage_report.txt

# 3. Identify gaps:
#    - Tables in production but no migration
#    - Models in schema but no table in production
#    - Models in schema and tables exist but no migration
```

### Phase 2: Create Baseline Migrations for Existing Tables

**For tables that exist in production but have no migration:**

```bash
# Option A: Create empty baseline migration and mark as applied
pnpm prisma migrate dev --name baseline_existing_[table_name] --create-only

# Edit the migration file to be empty (just SELECT 1;)
# Then mark it as applied without running
pnpm prisma migrate resolve --applied baseline_existing_[table_name]
```

**For tables that exist but schema changed:**

```bash
# 1. Create migration that adds missing columns
pnpm prisma migrate dev --name add_missing_columns_to_[table] --create-only

# 2. Review the SQL - it should only add what's missing
# 3. Apply to production
pnpm prisma migrate deploy
```

### Phase 3: Create Migrations for Missing Tables

**For models in schema but no table exists:**

```bash
# 1. Ensure schema is built
pnpm prisma:build

# 2. Create migration for missing tables
pnpm prisma migrate dev --name create_missing_[table_name] --create-only

# 3. Review migration SQL
# 4. Apply to production
pnpm prisma migrate deploy
```

### Phase 4: Verify and Document

```bash
# 1. Verify all migrations are applied
pnpm prisma migrate status

# 2. Check for any remaining drift
pnpm prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-schema-datasource prisma/schema.prisma

# 3. Run coverage check again
node scripts/check-migration-coverage.js
```

## Specific Examples

### Example 1: Table Exists in Production, No Migration

**Problem:** `ai_conversations` table exists in production but no CREATE TABLE in migrations

**Solution:**
```bash
# 1. Create baseline migration
pnpm prisma migrate dev --name baseline_ai_conversations --create-only

# 2. Edit migration to be empty (table already exists)
# migration.sql: SELECT 1; -- Table already exists in production

# 3. Mark as applied
pnpm prisma migrate resolve --applied baseline_ai_conversations
```

### Example 2: Model in Schema, Table Doesn't Exist

**Problem:** `PricingConfig` model in schema but no table in production

**Solution:**
```bash
# 1. Create migration
pnpm prisma migrate dev --name create_pricing_configs --create-only

# 2. Review SQL (should have CREATE TABLE)
# 3. Apply to production
pnpm prisma migrate deploy
```

### Example 3: Table Exists but Missing Column

**Problem:** `module_ai_context_registry` exists but missing `version` column

**Solution:**
```bash
# 1. Create migration (already done: 20260126192000_add_version_to_module_ai_context_registry)
# 2. Apply to production
pnpm prisma migrate deploy
```

## Why NOT Restart?

❌ **Restarting would:**
- Lose all migration history
- Require recreating 69 migrations
- Risk data loss if not careful
- Break production deployments
- Lose audit trail

✅ **Incremental approach:**
- Preserves migration history
- No data loss
- Can be done gradually
- Maintains audit trail
- Safer for production

## Next Steps

1. **Run audit on production** (if possible) to see what actually exists
2. **Create baseline migrations** for existing tables without migrations
3. **Create migrations** for missing tables
4. **Apply incrementally** - one module at a time
5. **Verify** after each batch

## Prevention Going Forward

1. **Always create migrations** when schema changes
2. **Use `--create-only`** to review before applying
3. **Run coverage check** before deployments
4. **Never skip** the migration workflow
