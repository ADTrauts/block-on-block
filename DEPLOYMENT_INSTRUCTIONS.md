# Production Deployment Instructions
**Date:** 2026-01-26  
**Purpose:** Deploy all missing schema migrations to Google Cloud production

## ✅ Local Status
- ✅ All 70 migrations created and applied
- ✅ Local database matches schema completely
- ✅ No drift detected
- ✅ Prisma client generated

## 🚀 Production Deployment Steps

### Step 1: Backup Production Database (CRITICAL)
```bash
# Create a backup before deploying
gcloud sql backups create --instance=vssyl-production-db
```

### Step 2: Deploy Migrations to Production
```bash
# Set production database URL
export DATABASE_URL="postgresql://user:pass@172.30.0.15:5432/vssyl_production?connection_limit=20&pool_timeout=20"

# Deploy all migrations
pnpm prisma migrate deploy
```

**Expected Output:**
- Should apply 2 new migrations:
  1. `20260126192000_add_version_to_module_ai_context_registry`
  2. `20260126200000_add_all_missing_schema_elements`

### Step 3: Verify Production Database
```bash
# IMPORTANT: Make sure DATABASE_URL is still set to production
echo "Current DATABASE_URL: $DATABASE_URL"

# Check migration status (should show all 70 migrations applied)
pnpm prisma migrate status

# Verify no drift
pnpm prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-schema-datasource prisma/schema.prisma

# If it still shows localhost, you need to set DATABASE_URL again
```

### Step 4: Regenerate Prisma Client (if needed)
```bash
# Prisma client should be regenerated during build, but if needed:
pnpm prisma:generate
```

## 📋 Migration Summary

### Migration 1: `20260126192000_add_version_to_module_ai_context_registry`
**Purpose:** Add missing `version` column to `module_ai_context_registry` table  
**Impact:** Low - adds a column with default value  
**Idempotent:** Yes - uses `IF NOT EXISTS`

### Migration 2: `20260126200000_add_all_missing_schema_elements`
**Purpose:** Add all missing tables, columns, indexes, and foreign keys  
**Impact:** High - creates 33+ new tables  
**Idempotent:** Yes - all operations use `IF NOT EXISTS` or `DO $$ BEGIN ... END $$` blocks

**Tables Created:**
- AI: `ai_conversations`, `ai_messages`, `ai_query_balances`, `ai_query_purchases`
- Billing: `pricing_configs`, `price_changes`, `refunds`
- Front Page: `business_front_page_configs`, `business_front_widgets`, `user_front_page_customizations`
- Drive: `folder_permissions`
- HR: `time_off_requests`, `attendance_policies`, `attendance_shift_templates`, `attendance_shift_assignments`, `attendance_records`, `attendance_exceptions`
- Scheduling: `schedules`, `schedule_shifts`, `shift_templates`, `schedule_templates`, `employee_availability`, `shift_swap_requests`, `job_locations`
- Tasks: `tasks`, `task_dependencies`, `task_attachments`, `task_file_links`, `task_event_links`, `task_comments`, `task_watchers`, `task_projects`, `task_time_logs`

**Enums Created:**
- `AttendanceExceptionStatus`, `AttendanceExceptionType`, `AttendanceMethod`
- `AttendanceRecordStatus`, `AttendanceShiftAssignmentStatus`
- `AvailabilityType`, `EmploymentStatus`
- `ScheduleStatus`, `ShiftStatus`, `SwapStatus`
- `TaskPriority`, `TaskStatus`
- `TimeOffStatus`, `TimeOffType`

**Columns Added:**
- `Notification.priority`, `Notification.snoozedUntil`
- `ai_autonomy_settings.workHoursStart/End`, `familyTimeStart/End`, `sleepHoursStart/End`
- `user_ai_context.tags` (nullable)

## ⚠️ Important Notes

1. **Idempotent Migrations:** Both migrations are safe to run multiple times - they use `IF NOT EXISTS` checks
2. **No Data Loss:** All operations are additive - no tables or columns are dropped
3. **Production Safety:** The migrations are designed to work even if some tables already exist
4. **Rollback:** If needed, you can manually drop tables, but data will be lost

## 🔍 Post-Deployment Verification

After deployment, verify:

1. **Check all tables exist:**
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

2. **Check migration history:**
```bash
pnpm prisma migrate status
```

3. **Test application:**
- Verify AI conversations work
- Verify billing/pricing works
- Verify HR features work
- Verify scheduling works
- Verify tasks work

## 🐛 Troubleshooting

### If migration fails:
1. Check error message
2. Verify database connection
3. Check if tables already exist (migration should handle this)
4. Review migration SQL manually if needed

### If drift detected after deployment:
```bash
# Check what's different
pnpm prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-schema-datasource prisma/schema.prisma

# Create additional migration if needed
pnpm prisma migrate dev --name fix_drift --create-only
```

## 📞 Support

If issues occur:
1. Check Cloud SQL logs
2. Check application logs
3. Verify database connectivity
4. Review migration files in `prisma/migrations/`
