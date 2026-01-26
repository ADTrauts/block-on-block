# Migration Audit Report
**Generated:** 2026-01-26

## Summary

- **Total Models in Schema:** 188
- **Total Tables in Migrations:** 170
- **Potential Gap:** 18-33 models (depending on mapping)

## Critical Finding

Many models in the Prisma schema do not have corresponding `CREATE TABLE` statements in migrations. This indicates:

1. **Schema Drift**: The schema has models that were never migrated
2. **Manual Table Creation**: Some tables may have been created outside of Prisma migrations
3. **Missing Migrations**: Schema changes were made without creating migrations

## Models Potentially Missing Migrations

### AI & Billing Models
- `AIConversation` → `ai_conversations`
- `AIMessage` → `ai_messages`
- `AIQueryBalance` → `ai_query_balances`
- `AIQueryPurchase` → `ai_query_purchases`
- `PricingConfig` → `pricing_configs`
- `PriceChange` → `price_changes`
- `Refund` → `refunds`

### HR & Scheduling Models
- `TimeOffRequest` → `time_off_requests`
- `AttendancePolicy` → `attendance_policies`
- `AttendanceShiftTemplate` → `attendance_shift_templates`
- `AttendanceShiftAssignment` → `attendance_shift_assignments`
- `AttendanceRecord` → `attendance_records`
- `AttendanceException` → `attendance_exceptions`
- `Schedule` → `schedules`
- `ScheduleShift` → `schedule_shifts`
- `ShiftTemplate` → `shift_templates`
- `EmployeeAvailability` → `employee_availability`
- `ShiftSwapRequest` → `shift_swap_requests`
- `ScheduleTemplate` → `schedule_templates`
- `JobLocation` → `job_locations`

### Task Management Models
- `Task` → `tasks`
- `TaskDependency` → `task_dependencies`
- `TaskAttachment` → `task_attachments`
- `TaskFileLink` → `task_file_links`
- `TaskEventLink` → `task_event_links`
- `TaskComment` → `task_comments`
- `TaskWatcher` → `task_watchers`
- `TaskProject` → `task_projects`
- `TaskTimeLog` → `task_time_logs`

### Front Page Models
- `BusinessFrontPageConfig` → `business_front_page_configs`
- `BusinessFrontWidget` → `business_front_widgets`
- `UserFrontPageCustomization` → `user_front_page_customizations`

### Drive Models
- `FolderPermission` → `folder_permissions`

## Root Cause Analysis

1. **Schema-first development**: Models were added to schema files but migrations weren't created
2. **Manual database changes**: Some tables may have been created directly in production
3. **Incomplete migration workflow**: The mandatory workflow (schema → build → migrate) wasn't always followed

## Recommended Actions

### Immediate (Critical)
1. **Audit Production Database**: Check which of these tables actually exist in production
2. **Create Missing Migrations**: For tables that exist in production but not in migrations, create baseline migrations
3. **Document Drift**: Create a migration to align production with schema

### Short-term
1. **Enforce Migration Workflow**: Always create migrations when schema changes
2. **Add Pre-commit Hook**: Check that schema changes have corresponding migrations
3. **Regular Audits**: Run the coverage script before each deployment

### Long-term
1. **Migration Testing**: Add tests to ensure all models have migrations
2. **CI/CD Checks**: Automate migration coverage checks in CI
3. **Documentation**: Update developer docs with mandatory migration workflow

## Next Steps

1. Run: `node scripts/check-migration-coverage.js` regularly
2. Before each deployment, verify: `pnpm prisma migrate status`
3. If drift detected, create baseline migrations for existing tables
4. Never skip migration creation - it's mandatory per coding standards
