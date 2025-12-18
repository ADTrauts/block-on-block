# Migration Drift Investigation - Profile Photo Library

**Date**: December 17, 2025  
**Issue**: Database reset required due to missing migration  
**Root Cause**: Schema changes added without creating corresponding migration

## What Happened

1. **Initial Migration** (`20250922232423_add_profile_photos`):
   - Only added `personalPhoto` and `businessPhoto` TEXT columns to `users` table
   - This was the original, simpler implementation

2. **Schema Enhancement** (Later):
   - Added `UserProfilePhoto` model to `prisma/modules/auth/profile-photos.prisma`
   - Added `personalPhotoId` and `businessPhotoId` foreign key fields to `User` model
   - Added `profilePhotos` relation array
   - **CRITICAL ERROR**: No migration was created for these changes

3. **Code Started Using New Fields**:
   - `profilePhotoController.ts` started querying `personalPhotoId` and `businessPhotoId`
   - Code tried to create `UserProfilePhoto` records
   - Database didn't have these columns/tables

4. **Prisma Errors**:
   - `The column users.personalPhotoId does not exist in the current database`
   - Migration drift detected
   - Database became unusable

5. **Result**: Database had to be reset, losing all data

## Root Cause Analysis

**The Critical Mistake**: Schema changes were added to Prisma module files, but `prisma migrate dev` was never run to create a migration.

### What Should Have Happened

1. ✅ Add schema changes to `prisma/modules/auth/profile-photos.prisma` and `user.prisma`
2. ✅ Run `pnpm prisma:build` to rebuild schema
3. ✅ Run `pnpm prisma migrate dev --name add_profile_photo_library` to create migration
4. ✅ Verify migration file was created correctly
5. ✅ Test that migration applies successfully

### What Actually Happened

1. ✅ Schema changes added
2. ✅ `prisma:build` run (schema rebuilt)
3. ❌ **Migration never created**
4. ❌ Code deployed using fields that didn't exist
5. ❌ Database errors, drift, reset required

## Prevention Measures

### Mandatory Workflow for Schema Changes

**NEVER** add schema changes without following this exact sequence:

```bash
# 1. Make schema changes in prisma/modules/
# 2. Rebuild schema
pnpm prisma:build

# 3. Create migration (MANDATORY)
pnpm prisma migrate dev --name descriptive_name

# 4. Verify migration file was created
ls -la prisma/migrations/

# 5. Review migration SQL to ensure it's correct
cat prisma/migrations/[timestamp]_descriptive_name/migration.sql

# 6. Generate Prisma client
pnpm prisma:generate

# 7. Test that code works with new schema
```

### Code Review Checklist

Before merging any PR that touches Prisma schema:

- [ ] Migration file exists in `prisma/migrations/`
- [ ] Migration SQL looks correct (creates tables/columns as expected)
- [ ] No direct edits to `prisma/schema.prisma` (must edit modules)
- [ ] `prisma:build` was run
- [ ] `prisma migrate dev` was run
- [ ] Migration was tested locally

### Red Flags to Watch For

1. **Schema changes without migration file**: If you see schema changes but no new migration, STOP
2. **Prisma errors about missing columns**: This means schema and database are out of sync
3. **Migration drift warnings**: Prisma will warn you - don't ignore it
4. **Code using fields that don't exist**: Check if migration was created

## The Fix

Created migration `20251217_add_profile_photo_library` that:

1. Creates `user_profile_photos` table
2. Adds `personalPhotoId` and `businessPhotoId` columns to `users`
3. Creates indexes and foreign keys
4. Properly links everything together

This migration should be applied to any fresh database.

## Lessons Learned

1. **Schema changes are not optional** - they MUST have migrations
2. **Test migrations locally** before deploying
3. **Never skip the migration step** - it's not "optional cleanup"
4. **Prisma drift warnings are serious** - don't ignore them
5. **Always verify migrations were created** after schema changes

## Impact

- **Data Loss**: All development database data was lost
- **Time Lost**: Had to reset and recreate database
- **Trust Impact**: User lost confidence in migration process

This should never happen again. The workflow is now documented and mandatory.

